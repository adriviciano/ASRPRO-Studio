using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading.Tasks;
using System.Windows.Forms;

internal sealed class Launcher : Form
{
    private Process server;
    private string url;
    private readonly bool spanish = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "es";
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
        Shown += async delegate { await StartServer(); };
        FormClosed += delegate {
            if (server != null) {
                try { if (!server.HasExited) server.Kill(); } catch (InvalidOperationException) { }
                server.Dispose();
            }
        };
    }

    private async Task StartServer()
    {
        try {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string app = Path.Combine(root, "app");
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
            status.Text = TextFor("Running. Close this window to stop the application.", "En marcha. Cierra esta ventana para detener la aplicacion.");
            open.Enabled = true;
            Process.Start(url);
        } catch (Exception error) {
            status.Text = TextFor("Startup failed: ", "Error de inicio: ") + error.Message;
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
