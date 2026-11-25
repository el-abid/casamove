$db = if ($env:CASAMOVE_DATABASE_URL) {
  $env:CASAMOVE_DATABASE_URL
} else {
  "postgresql://casamove@127.0.0.1:5544/casamove_dev"
}

& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  $db `
  -f (Join-Path $PSScriptRoot "seed.sql")
