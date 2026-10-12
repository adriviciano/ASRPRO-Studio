param(
    [Parameter(Mandatory=$true)][string]$ExecutablePath,
    [Parameter(Mandatory=$true)][string]$Commit,
    [string]$Repository = 'adriviciano/ASRPRO-Studio',
    [string]$Tag = 'v0.2.0',
    [switch]$RemoveLegacyRelease
)
$ErrorActionPreference = 'Stop'
$exe = Get-Item -LiteralPath $ExecutablePath
if ($exe.Name -ne 'ASRPRO-Studio.exe') { throw 'Unexpected executable name.' }
$credential = "protocol=https`nhost=github.com`n`n" | git credential fill
if ($LASTEXITCODE -ne 0) { throw 'GitHub authentication missing.' }
$fields = @{}
foreach ($line in $credential) {
    $parts = $line -split '=',2
    if ($parts.Length -eq 2) { $fields[$parts[0]] = $parts[1] }
}
$headers = @{ Authorization="Bearer $($fields['password'])"; Accept='application/vnd.github+json' }
$api = "https://api.github.com/repos/$Repository"
$repo = Invoke-RestMethod -Uri $api -Headers $headers
if ($repo.full_name -ne $Repository) { throw 'Unexpected repository identity.' }
$hash = (Get-FileHash -LiteralPath $exe.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$releases = Invoke-RestMethod -Uri "$api/releases" -Headers $headers
if ($releases | Where-Object tag_name -eq $Tag) { throw 'Release already exists; no automatic overwrite.' }
$body = @"
Single Windows x64 executable with an external Tianwen SDK. No manufacturer SDK, compiler, models or installer bundled.

Run ASRPRO-Studio.exe. The English startup assistant finds Tianwen, lets you select its folder, or offers the verified official download and interactive installer. Studio supports English and Spanish. Requires .NET Framework 4.5+, a browser and the CH340 USB driver.

Unsigned executable: SmartScreen may warn about an unknown publisher. A named antivirus detection must be investigated, not ignored.

Build from source: npm ci, then powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-exe.ps1. No Tianwen installation needed to build Studio. Firmware compilation requires Tianwen at runtime.

Startup and firmware compilation tested without flashing hardware. Full installation on a PC without Tianwen remains untested.

SHA256 (ASRPRO-Studio.exe): $hash
"@
$payload = @{tag_name=$Tag; target_commitish=$Commit; name="ASRPRO Studio $Tag"; draft=$true; prerelease=$false; body=$body} | ConvertTo-Json
$release = Invoke-RestMethod -Uri "$api/releases" -Headers $headers -Method Post -ContentType 'application/json' -Body $payload
$upload = $release.upload_url -replace '\{.*$', ''
$asset = Invoke-RestMethod -Uri "$($upload)?name=ASRPRO-Studio.exe" -Headers $headers -Method Post -ContentType 'application/octet-stream' -InFile $exe.FullName -TimeoutSec 1800
if ($asset.size -ne $exe.Length -or $asset.state -ne 'uploaded' -or $asset.digest -ne "sha256:$hash") { throw 'Uploaded asset verification failed; release remains draft.' }
$release = Invoke-RestMethod -Uri "$api/releases/$($release.id)" -Headers $headers -Method Patch -ContentType 'application/json' -Body '{"draft":false,"make_latest":"true"}'
if ($RemoveLegacyRelease) {
    foreach ($old in $releases | Where-Object tag_name -eq 'v0.1.0-private') {
        Invoke-RestMethod -Uri "$api/releases/$($old.id)" -Headers $headers -Method Delete | Out-Null
        Write-Output 'Removed legacy bundled release.'
    }
}
Write-Output "Release: $($release.html_url)"
Write-Output "Asset: $($asset.name), $($asset.size) bytes, SHA256 $hash"
