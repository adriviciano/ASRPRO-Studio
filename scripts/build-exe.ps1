param([string]$OutputDirectory = (Join-Path $PSScriptRoot '..\releases'))
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$output = [IO.Path]::GetFullPath($OutputDirectory)
$destination = Join-Path $output 'ASRPRO-Studio.exe'
if (Test-Path -LiteralPath $destination) { throw 'Output executable already exists. Choose another output directory.' }
$stage = Join-Path ([IO.Path]::GetTempPath()) ('ASRPRO-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
$package = Join-Path $stage 'ASRPRO-Studio-Windows-x64'
$app = Join-Path $package 'app'
$runtime = Join-Path $package 'runtime'
Push-Location $root
try {
    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    New-Item -ItemType Directory -Path $app,$runtime -Force | Out-Null
    New-Item -ItemType Directory -Path $output -Force | Out-Null
    foreach ($folder in @('dist','server','firmware')) {
        Copy-Item -LiteralPath (Join-Path $root $folder) -Destination $app -Recurse
    }
    foreach ($file in @('package.json','package-lock.json','voice-commands.example.json','LICENSE','THIRD-PARTY-NOTICES.md')) {
        Copy-Item -LiteralPath (Join-Path $root $file) -Destination $app
    }
    Push-Location $app
    try {
        & npm.cmd ci --omit=dev
        if ($LASTEXITCODE -ne 0) { throw 'Runtime dependency installation failed.' }
    } finally { Pop-Location }
    Copy-Item -LiteralPath (Get-Command node.exe).Source -Destination $runtime
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'licenses\node-LICENSE') -Destination (Join-Path $runtime 'LICENSE')
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $payload = Join-Path $stage 'payload.zip'
    [IO.Compression.ZipFile]::CreateFromDirectory($package,$payload,[IO.Compression.CompressionLevel]::Optimal,$true)
    $zip = [IO.Compression.ZipFile]::OpenRead($payload)
    try {
        if ($zip.Entries | Where-Object { $_.FullName.Replace('\','/') -match '(?i)/app/vendor/|makebin\.exe|ci-tool-kit|twenBlock|riscv-nuclei' }) {
            throw 'Manufacturer tools found in payload.'
        }
    } finally { $zip.Dispose() }
    $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    & $csc /nologo /target:winexe /platform:x64 /define:EXTERNAL_TOOLS /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Net.Http.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "/resource:$payload,payload.zip" "/out:$destination" (Join-Path $PSScriptRoot 'launcher.cs') (Join-Path $PSScriptRoot 'external-tools.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
    Get-FileHash -LiteralPath $destination -Algorithm SHA256
    Write-Output "Executable: $destination"
} finally { Pop-Location }
