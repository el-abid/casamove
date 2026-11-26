$root = Split-Path -Parent $PSScriptRoot
$db = $env:CASAMOVE_DATABASE_URL

if (-not $db) {
  $envFile = Join-Path $root ".env.local"
  if (Test-Path $envFile) {
    $line = Get-Content $envFile |
      Where-Object { $_ -match '^\s*CASAMOVE_DATABASE_URL\s*=' } |
      Select-Object -First 1

    if ($line) {
      $db = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
    }
  }
}

if (-not $db) {
  $db = "postgresql://casamove@127.0.0.1:5544/casamove"
}

& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  $db `
  -f (Join-Path $PSScriptRoot "seed.sql")
