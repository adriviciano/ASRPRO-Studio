param([Parameter(Mandatory=$true)][string]$PackagePath)
$ErrorActionPreference = 'Stop'
$package = (Resolve-Path $PackagePath).Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$previousPort = $env:PORT
$previousMode = $env:NODE_ENV
$env:PORT = "$port"
$env:NODE_ENV = 'production'
$process = $null
try {
    $process = Start-Process -FilePath (Join-Path $package 'runtime/node.exe') -ArgumentList 'server/server.mjs' -WorkingDirectory (Join-Path $package 'app') -WindowStyle Hidden -PassThru
    $url = "http://127.0.0.1:$port"
    $status = $null
    for ($attempt=0; $attempt -lt 100; $attempt++) {
        if ($process.HasExited) { throw 'El servidor portatil termino antes de arrancar.' }
        try { $status = Invoke-RestMethod "$url/api/status"; break } catch { Start-Sleep -Milliseconds 200 }
    }
    if (!$status.sdkReady) { throw 'SDK no disponible en el paquete.' }
    $html = Invoke-WebRequest "$url/" -UseBasicParsing
    if ($html.StatusCode -ne 200 -or $html.Content -notmatch 'assets/index') { throw 'Frontend de produccion no disponible.' }
    $ports = Invoke-RestMethod "$url/api/ports"
    Write-Output 'Arranque, frontend, SDK y consulta USB correctos.'
    Invoke-RestMethod "$url/api/compile" -Method Post -ContentType 'application/json' -Body '{}' -TimeoutSec 300 | Out-Null
    $status = Invoke-RestMethod "$url/api/status"
    if (!$status.firmwareReady) { throw 'No se ha generado un firmware completo.' }
    Write-Output "Compilacion portatil correcta: $($status.firmwareBytes) bytes. No se ha conectado ni cargado ninguna placa."
} finally {
    if ($process -and !$process.HasExited) { Stop-Process -Id $process.Id }
    $env:PORT = $previousPort
    $env:NODE_ENV = $previousMode
}
