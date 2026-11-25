& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  -h 127.0.0.1 -p 5544 -U casamove -d casamove `
  -f (Join-Path $PSScriptRoot "seed.sql")
