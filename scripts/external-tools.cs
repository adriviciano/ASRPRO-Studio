using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Threading;
using System.Windows.Forms;

internal static class ExternalTools
{
    internal const string DownloadUrl = "https://www.haohaodada.com/video/new/zipfiles/twenBlock.zip";
    internal const string ArchiveHash = "81DB6890C5B98E4428B7D5C20E6B60AC6F114946F0D93AD4FBBB9C1420A3358A";
    internal const string InstallerHash = "B30C033E0E9F87E0FD0E11CBAA09280BBAB21DF21F57918718B164C17EA73FAC";
    private const string AgentHash = "B8E5243B39BACF3C4AB72FC12D7DB154DE1D900886C9E9071FC4E90F8425F376";
    private static string T(bool es, string en, string spanish) { return es ? spanish : en; }

    internal static string HashFile(string file)
    {
        using (var stream = File.OpenRead(file))
        using (var sha = SHA256.Create()) { return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", ""); }
    }

    internal static bool IsSdk(string root)
    {
        foreach (string file in new[] { "makebin.exe", "gcc/bin/riscv-nuclei-elf-gcc.exe", "asr_pro_sdk/tools/ci-tool-kit.exe", "asr_pro_sdk/projects/cwsl_sample/project_file/makefile", "user_file/cmd_info/[60000]{cmd_info}.xlsx", "data/boot.bin", "voice/voice.bin" }) {
            if (!File.Exists(Path.Combine(root, file.Replace('/', Path.DirectorySeparatorChar)))) return false;
        }
        return HashFile(Path.Combine(root, "makebin.exe")) == AgentHash;
    }

    private static string FromFolder(string folder)
    {
        if (String.IsNullOrEmpty(folder) || !Directory.Exists(folder)) return null;
        if (IsSdk(folder)) return folder;
        string sdk = Path.Combine(folder, "asrpro");
        return IsSdk(sdk) ? sdk : null;
    }

    internal static string FindSdk(string besideExe)
    {
        string configured = FromFolder(Environment.GetEnvironmentVariable("ASRPRO_TIANWEN"));
        if (configured != null) return configured;
        string found = FromFolder(besideExe);
        if (found != null) return found;
        foreach (string directory in Directory.GetDirectories(besideExe)) {
            found = FromFolder(directory);
            if (found != null) return found;
        }
        string saved = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ASRPRO", "tianwen-path.txt");
        if (File.Exists(saved)) {
            found = FromFolder(File.ReadAllText(saved).Trim());
            if (found != null) return found;
        }
        foreach (string folder in new[] { @"C:\TianwenBlock", "C:\\" + "\u5929\u95eeBlock", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "TianwenBlock") }) {
            found = FromFolder(folder);
            if (found != null) return found;
        }
        return null;
    }

    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (string file in Directory.GetFiles(source)) {
            if ((File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0) throw new IOException("SDK contains a symbolic link.");
            File.Copy(file, Path.Combine(destination, Path.GetFileName(file)), true);
        }
        foreach (string directory in Directory.GetDirectories(source)) {
            if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) throw new IOException("SDK contains a symbolic link.");
            CopyDirectory(directory, Path.Combine(destination, Path.GetFileName(directory)));
        }
    }

    internal static void ValidateArchive(string archive)
    {
        if (HashFile(archive) != ArchiveHash) throw new InvalidDataException("The official download has changed. Do not run it; update the verified installer version.");
        using (var zip = ZipFile.OpenRead(archive)) {
            int executables = 0;
            foreach (var entry in zip.Entries) if (entry.FullName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) executables++;
            if (executables != 1) throw new InvalidDataException("Unexpected installer archive.");
        }
    }

    private static async Task Download(string destination, Action<string> status, bool es)
    {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        using (var handler = new HttpClientHandler { AllowAutoRedirect = false })
        using (var client = new HttpClient(handler) { Timeout = TimeSpan.FromMinutes(30) }) {
            // El origen se mantiene fijo y no se aceptan redirecciones a HTTP.
            using (var response = await client.GetAsync(DownloadUrl, HttpCompletionOption.ResponseHeadersRead)) {
                response.EnsureSuccessStatusCode();
                if (response.StatusCode != HttpStatusCode.OK) throw new IOException("Unexpected download response.");
                using (var input = await response.Content.ReadAsStreamAsync())
                using (var output = File.Create(destination)) {
                    byte[] buffer = new byte[65536];
                    long bytes = 0; int count; long reported = -1;
                    while ((count = await input.ReadAsync(buffer, 0, buffer.Length)) > 0) {
                        bytes += count;
                        if (bytes > 815745608L) throw new InvalidDataException("Download exceeds verified size.");
                        await output.WriteAsync(buffer, 0, count);
                        long megabytes = bytes / 1048576;
                        if (megabytes != reported) { reported = megabytes; status(T(es, "Downloading Tianwen Block: ", "Descargando Tianwen Block: ") + megabytes + " / 778 MB"); }
                    }
                    if (bytes != 815745608L) throw new InvalidDataException("Incomplete download.");
                }
            }
        }
    }

    internal static async Task<bool> Prepare(string app, bool es, bool testing, Action<string> status)
    {
        string destination = Path.Combine(app, "vendor", "asrpro");
        string marker = Path.Combine(destination, ".studio-external-ready");
        if (File.Exists(marker) && IsSdk(destination)) return true;
        string beside = AppDomain.CurrentDomain.BaseDirectory;
        string source = FindSdk(beside);
        if (source == null && testing) throw new FileNotFoundException("No compatible external Tianwen installation found.");
        while (source == null) {
            var answer = MessageBox.Show(T(es,
                "Tianwen Block is required and is not bundled.\nYes: download the verified official installer (816 MB).\nNo: select an existing installation.\nCancel: stop.",
                "Se necesita Tianwen Block y no va incluido.\nSi: descargar el instalador oficial verificado (816 MB).\nNo: seleccionar una instalacion existente.\nCancelar: salir."), "ASRPRO Studio", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Information);
            if (answer == DialogResult.Cancel) return false;
            if (answer == DialogResult.No) {
                using (var chooser = new FolderBrowserDialog { Description = T(es, "Select Tianwen Block or its asrpro folder", "Selecciona Tianwen Block o su carpeta asrpro") }) {
                    if (chooser.ShowDialog() == DialogResult.OK) source = FromFolder(chooser.SelectedPath);
                }
                if (source == null) MessageBox.Show(T(es, "No compatible SDK found. Use the verified 2025-1a0907 version.", "No se encontro un SDK compatible. Usa la version verificada 2025-1a0907."));
                continue;
            }
            string downloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ASRPRO", "downloads");
            Directory.CreateDirectory(downloads);
            string archive = Path.Combine(downloads, "twenBlock.zip");
            if (!File.Exists(archive) || HashFile(archive) != ArchiveHash) await Download(archive, status, es);
            await Task.Run(() => ValidateArchive(archive));
            string installer = Path.Combine(downloads, "tianwen-setup.exe");
            await Task.Run(() => {
                using (var zip = ZipFile.OpenRead(archive)) {
                    foreach (var entry in zip.Entries) if (entry.FullName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) {
                        using (var input = entry.Open())
                        using (var output = File.Create(installer)) { input.CopyTo(output); }
                    }
                }
                if (HashFile(installer) != InstallerHash) throw new InvalidDataException("Installer hash mismatch.");
            });
            if (MessageBox.Show(T(es,
                "Open the manufacturer's installer now? You must review its license and approve any Windows permission prompts. No license is accepted automatically.",
                "Abrir ahora el instalador del fabricante? Debes revisar su licencia y aprobar los permisos de Windows. No se acepta ninguna licencia automaticamente."), "Tianwen Block", MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK) return false;
            string target = Path.Combine(beside, "TianwenBlock");
            using (var setup = Process.Start(new ProcessStartInfo(installer, "/DIR=\"" + target + "\"") { UseShellExecute = true })) {
                await Task.Run(() => setup.WaitForExit());
            }
            source = FromFolder(target) ?? FindSdk(beside);
        }
        status(T(es, "Preparing a private SDK workspace...", "Preparando una copia local del SDK..."));
        await Task.Run(() => {
            using (var mutex = new Mutex(false, "Local\\ASRPRO-External-SDK")) {
                bool acquired = false;
                try {
                    try { acquired = mutex.WaitOne(TimeSpan.FromMinutes(5)); }
                    catch (AbandonedMutexException) { acquired = true; }
                    if (!acquired) throw new IOException("Another SDK setup is still running.");
                    if (File.Exists(marker) && IsSdk(destination)) return;
                    CopyDirectory(source, destination);
                    if (!IsSdk(destination)) throw new IOException("SDK copy verification failed.");
                    File.WriteAllText(marker, source);
                } finally { if (acquired) mutex.ReleaseMutex(); }
            }
        });
        string saved = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ASRPRO", "tianwen-path.txt");
        File.WriteAllText(saved, source);
        return true;
    }
}
