param(
    [Parameter(Mandatory=$true)][string]$ArchivePath,
    [Parameter(Mandatory=$true)][string]$Commit,
    [string]$Repository = 'adriviciano/ASRPRO-Studio',
    [string]$Tag = 'v0.1.0-private'
)
$ErrorActionPreference = 'Stop'
$archive = Get-Item -LiteralPath $ArchivePath
# Se reutiliza la autenticacion de Git sin escribir ni mostrar el token.
$credential = "protocol=https`nhost=github.com`n`n" | git credential fill
if ($LASTEXITCODE -ne 0) { throw 'Falta autenticacion de GitHub.' }
$fields = @{}
foreach ($line in $credential) {
    $parts = $line -split '=',2
    if ($parts.Length -eq 2) { $fields[$parts[0]] = $parts[1] }
}
$headers = @{ Authorization="Bearer $($fields['password'])"; Accept='application/vnd.github+json' }
$api = "https://api.github.com/repos/$Repository"
$repo = Invoke-RestMethod -Uri $api -Headers $headers
if (!$repo.private) { throw 'Se cancela la subida: el repositorio no es privado.' }
$releases = Invoke-RestMethod -Uri "$api/releases" -Headers $headers
$release = $releases | Where-Object { $_.tag_name -eq $Tag } | Select-Object -First 1
if (!$release) {
    $payload = @{
        tag_name=$Tag; target_commitish=$Commit; name='ASRPRO Studio 0.1.0 - Private Windows portable';
        draft=$true; prerelease=$true;
        body='Personal-use private backup. Extract the entire ZIP to a short writable path such as C:\ASRPRO-Studio and run ASRPRO-Studio.exe. The manufacturer compiler fails in long paths. Includes the local manufacturer toolchain; not cleared for public redistribution. No board recordings or flash backups included. Windows x64, .NET Framework 4.5+, CH340 USB driver required. Unsigned launcher. Source checks and tests pass; portable startup and firmware compilation tested without flashing a board.'
    } | ConvertTo-Json
    $release = Invoke-RestMethod -Uri "$api/releases" -Headers $headers -Method Post -ContentType 'application/json' -Body $payload
}
if ($release.assets | Where-Object { $_.name -eq $archive.Name }) { throw 'La descarga ya existe. No se sobrescribe automaticamente.' }
$uploadUrl = $release.upload_url -replace '\{.*$', ''
$asset = Invoke-RestMethod -Uri "$($uploadUrl)?name=$([Uri]::EscapeDataString($archive.Name))" -Headers $headers -Method Post -ContentType 'application/zip' -InFile $archive.FullName -TimeoutSec 1800
if ($asset.size -ne $archive.Length -or $asset.state -ne 'uploaded') { throw 'La subida no se ha confirmado correctamente.' }
$localHash = (Get-FileHash $archive.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
if ($asset.digest -and $asset.digest -ne "sha256:$localHash") { throw 'El hash remoto no coincide.' }
$repo = Invoke-RestMethod -Uri $api -Headers $headers
if (!$repo.private) { throw 'El repositorio ha dejado de ser privado. Se conserva la release como borrador.' }
$release = Invoke-RestMethod -Uri "$api/releases/$($release.id)" -Headers $headers -Method Patch -ContentType 'application/json' -Body '{"draft":false}'
Write-Output "Release: $($release.html_url)"
Write-Output "Asset: $($asset.name), $($asset.size) bytes, SHA256 $localHash"
