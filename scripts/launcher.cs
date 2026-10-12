using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal sealed class Launcher : Form
{
    private static readonly bool selfTest = Array.IndexOf(Environment.GetCommandLineArgs(), "--self-test") >= 0;
    private static readonly bool extractOnly = Array.IndexOf(Environment.GetCommandLineArgs(), "--extract-only") >= 0;
    private Process server;
    private string url;
#if EXTERNAL_TOOLS
    private readonly bool spanish = false;
#else
    private readonly bool spanish = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "es";
#endif
    private readonly Label status = new Label { Dock = DockStyle.Top, Height = 60, Padding = new Padding(12) };
    private readonly Button open = new Button { Dock = DockStyle.Bottom, Height = 40, Enabled = false };

    private string TextFor(string en, string es) { return spanish ? es : en; }

    private Launcher()
    {
        Text = "ASRPRO Studio - ASRPRO-01";
        Width = 420; Height = 170;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        status.Text = TextFor("Starting...", "Iniciando...");
        open.Text = TextFor("Open ASRPRO Studio", "Abrir ASRPRO Studio");
        Controls.Add(status); Controls.Add(open);
        open.Click += delegate { Process.Start(url); };
        Shown += async delegate { if (selfTest || extractOnly) Hide(); await StartServer(); };
        FormClosed += delegate {
            if (server != null) {
                try { if (!server.HasExited) server.Kill(); } catch (InvalidOperationException) { }
                server.Dispose();
            }
        };
    }

    private static string PreparePackage()
    {
        using (Stream payload = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip")) {
            if (payload == null) return AppDomain.CurrentDomain.BaseDirectory;
            string hash;
            using (var sha = SHA256.Create()) {
                hash = BitConverter.ToString(sha.ComputeHash(payload)).Replace("-", "").Substring(0, 12);
            }
            payload.Position = 0;
            string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ASRPRO", hash);
            string marker = Path.Combine(root, ".ready");
            // El bloqueo impide que dos primeros arranques extraigan simultaneamente.
            using (var mutex = new Mutex(false, "Local\\ASRPRO-Extract-" + hash)) {
                try { mutex.WaitOne(); } catch (AbandonedMutexException) { }
                try {
                    if (!File.Exists(marker)) {
                        Directory.CreateDirectory(root);
                        using (var archive = new ZipArchive(payload, ZipArchiveMode.Read, true)) {
                            foreach (var entry in archive.Entries) {
                                string name = entry.FullName.Replace('\\', '/');
                                const string prefix = "ASRPRO-Studio-Windows-x64/";
                                if (!name.StartsWith(prefix, StringComparison.Ordinal)) throw new InvalidDataException("Unexpected package path.");
                                name = name.Substring(prefix.Length);
                                if (name.Length == 0) continue;
                                string target = Path.GetFullPath(Path.Combine(root, name.Replace('/', Path.DirectorySeparatorChar)));
                                if (!target.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Unsafe package path.");
                                if (name.EndsWith("/", StringComparison.Ordinal)) { Directory.CreateDirectory(target); continue; }
                                Directory.CreateDirectory(Path.GetDirectoryName(target));
                                using (Stream input = entry.Open())
                                using (Stream output = File.Create(target)) { input.CopyTo(output); }
                            }
                        }
                        if (!File.Exists(Path.Combine(root, "runtime", "node.exe")) ||
                            !File.Exists(Path.Combine(root, "app", "server", "server.mjs"))) throw new InvalidDataException("Incomplete package.");
                        File.WriteAllText(marker, hash);
                    }
                } finally { mutex.ReleaseMutex(); }
            }
            return root;
        }
    }

    private async Task StartServer()
    {
        try {
            status.Text = TextFor("Preparing application. First launch can take a few minutes...", "Preparando la aplicacion. El primer inicio puede tardar unos minutos...");
            string root = await Task.Run(() => PreparePackage());
            if (IsDisposed) return;
            if (extractOnly) {
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "asrpro-extract-test.txt"), root);
                Close();
                return;
            }
            string app = Path.Combine(root, "app");
#if EXTERNAL_TOOLS
            if (!await ExternalTools.Prepare(app, spanish, selfTest, message => status.Text = message)) { Close(); return; }
#endif
            // Se elige un puerto libre para no interferir con otra instancia.
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            int port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            url = "http://127.0.0.1:" + port + "/";
            var info = new ProcessStartInfo(Path.Combine(root, "runtime", "node.exe"), "server/server.mjs") {
                WorkingDirectory = app, UseShellExecute = false, CreateNoWindow = true
            };
            info.EnvironmentVariables["NODE_ENV"] = "production";
            info.EnvironmentVariables["PORT"] = port.ToString(CultureInfo.InvariantCulture);
            server = Process.Start(info);
            bool ready = false;
            for (int attempt = 0; attempt < 100; attempt++) {
                if (server.HasExited) throw new Exception(TextFor("The server could not start.", "No se pudo iniciar el servidor."));
                try {
                    using (var client = new WebClient()) {
                        await client.DownloadStringTaskAsync(url + "api/status");
                        ready = true;
                    }
                } catch (WebException) { }
                if (ready) break;
                await Task.Delay(200);
            }
            if (!ready) throw new Exception(TextFor("Startup timed out.", "Se agoto el tiempo de inicio."));
            if (selfTest) {
                using (var client = new WebClient()) {
                    string state = await client.DownloadStringTaskAsync(url + "api/status");
                    string html = await client.DownloadStringTaskAsync(url);
                    if (!state.Contains("\"sdkReady\":true") || !html.Contains("assets/index")) throw new Exception("Self-test failed.");
                }
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "asrpro-self-test.txt"), "OK " + root);
                Close();
                return;
            }
            status.Text = TextFor("Running. Close this window to stop the application.", "En marcha. Cierra esta ventana para detener la aplicacion.");
            open.Enabled = true;
            Process.Start(url);
        } catch (Exception error) {
            status.Text = TextFor("Startup failed: ", "Error de inicio: ") + error.Message;
            if (selfTest || extractOnly) {
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "asrpro-self-test-error.txt"), error.ToString());
                Environment.ExitCode = 1;
                Close();
            }
        }
    }

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Launcher());
    }
}
