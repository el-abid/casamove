param(
  [ValidateSet("init", "start", "stop", "status")]
  [string]$Action = "status"
)

$bin = "C:\Program Files\PostgreSQL\18\bin"
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root ".pgdata"
$port = 5544

if (-not (Test-Path "$bin\pg_ctl.exe")) {
  Write-Error "PostgreSQL 18 introuvable dans $bin"
  exit 1
}

switch ($Action) {
  "init" {
    if (-not (Test-Path "$data\PG_VERSION")) {
      & "$bin\initdb.exe" -D $data -U casamove --auth=trust -E UTF8
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    & "$bin\pg_ctl.exe" -D $data -o "-p $port" -l "$data\server.log" start
    Start-Sleep -Seconds 2
    & "$bin\createdb.exe" -h 127.0.0.1 -p $port -U casamove casamove 2>$null
    Write-Output "Base casamove prete sur le port $port"
  }
  "start" {
    & "$bin\pg_ctl.exe" -D $data -o "-p $port" -l "$data\server.log" start
    Start-Sleep -Seconds 1
    & "$bin\pg_isready.exe" -h 127.0.0.1 -p $port
  }
  "stop" {
    & "$bin\pg_ctl.exe" -D $data stop
  }
  "status" {
    & "$bin\pg_isready.exe" -h 127.0.0.1 -p $port
  }
}
