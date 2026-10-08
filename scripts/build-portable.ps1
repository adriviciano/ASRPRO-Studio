param([string]$SdkPath = (Join-Path $PSScriptRoot '../vendor/asrpro'))
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$release = Join-Path $root 'releases/ASRPRO-Studio-Windows-x64'
if (Test-Path $release) { throw 'La carpeta de salida ya existe. Usa una carpeta limpia antes de reconstruir.' }
if (!(Test-Path (Join-Path $SdkPath 'makebin.exe'))) { throw 'Falta el SDK y agente oficial.' }
Push-Location $root
try {
    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw 'Error de TypeScript.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Error de compilacion de la interfaz.' }
    $app = New-Item -ItemType Directory -Path (Join-Path $release 'app') -Force
    foreach ($directory in @('dist', 'server', 'firmware', 'node_modules')) {
        Copy-Item -LiteralPath (Join-Path $root $directory) -Destination $app.FullName -Recurse
    }
    foreach ($file in @('package.json', 'voice-commands.example.json', 'LICENSE', 'THIRD-PARTY-NOTICES.md')) {
        Copy-Item -LiteralPath (Join-Path $root $file) -Destination $app.FullName
    }
    $vendor = New-Item -ItemType Directory -Path (Join-Path $app 'vendor') -Force
    Copy-Item -LiteralPath $SdkPath -Destination (Join-Path $vendor 'asrpro') -Recurse
    $runtime = New-Item -ItemType Directory -Path (Join-Path $release 'runtime') -Force
    Copy-Item -LiteralPath (Get-Command node.exe).Source -Destination $runtime.FullName
    $nodeLicense = Join-Path $PSScriptRoot 'licenses/node-LICENSE'
    if (!(Test-Path $nodeLicense)) { throw 'Falta el aviso de licencia de Node.js.' }
    Copy-Item -LiteralPath $nodeLicense -Destination (Join-Path $runtime 'LICENSE')
    $csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    & $csc /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$release/ASRPRO-Studio.exe" (Join-Path $PSScriptRoot 'launcher.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Error compilando el ejecutable de inicio.' }
    Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination $release
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($release, "$release.zip", [System.IO.Compression.CompressionLevel]::Optimal, $true)
    Get-FileHash "$release.zip" -Algorithm SHA256
} finally { Pop-Location }
