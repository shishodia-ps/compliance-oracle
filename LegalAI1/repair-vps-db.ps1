param(
    [Parameter(Mandatory = $true)]
    [string]$ServerHost,

    [string]$RemoteUser = "root",

    [string]$IdentityFile = "",

    [string]$RemoteAppPath = "/opt/legal-ai"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Invoke-RemoteScript {
    param(
        [string]$Target,
        [string]$Script,
        [string[]]$ScpArgs,
        [string[]]$SshArgs
    )

    $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("legal-ai-db-repair-" + [System.Guid]::NewGuid().ToString("N") + ".sh")
    $remoteTempFile = "/tmp/" + [System.IO.Path]::GetFileName($tempFile)

    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($tempFile, $Script, $utf8NoBom)

        & scp @ScpArgs $tempFile "${Target}:$remoteTempFile"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to upload remote script."
        }

        & ssh @SshArgs $Target "bash $remoteTempFile; status=`$?; rm -f $remoteTempFile; exit `$status"
        if ($LASTEXITCODE -ne 0) {
            throw "Remote script failed."
        }
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
}

Require-Command "ssh"
Require-Command "scp"

$sshTarget = "$RemoteUser@$ServerHost"
$sshArgs = @()
$scpArgs = @()

if ($IdentityFile) {
    $sshArgs += @("-i", $IdentityFile)
    $scpArgs += @("-i", $IdentityFile)
}

$remoteScript = @'
set -euo pipefail

remote_app_path="__REMOTE_APP_PATH__"

cd "$remote_app_path"

docker compose up -d db redis

for i in {1..30}; do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose exec -T db psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"

db_exists="$(docker compose exec -T db psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='legal_ai'" | tr -d '\r')"
if [ "$db_exists" != "1" ]; then
  docker compose exec -T db psql -U postgres -d postgres -c "CREATE DATABASE legal_ai;"
fi

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'legalai_app') THEN CREATE ROLE legalai_app LOGIN PASSWORD 'legalai_app'; ELSE ALTER ROLE legalai_app WITH LOGIN PASSWORD 'legalai_app'; END IF; END \$\$;"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "ALTER DATABASE legal_ai OWNER TO legalai_app;"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d legal_ai -c "GRANT ALL PRIVILEGES ON DATABASE legal_ai TO legalai_app;"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d legal_ai -c "GRANT USAGE, CREATE ON SCHEMA public TO legalai_app;"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d legal_ai -c "DO \$\$ DECLARE obj record; BEGIN FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP EXECUTE format('ALTER TABLE public.%I OWNER TO legalai_app', obj.tablename); END LOOP; FOR obj IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP EXECUTE format('ALTER SEQUENCE public.%I OWNER TO legalai_app', obj.sequencename); END LOOP; FOR obj IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP EXECUTE format('ALTER VIEW public.%I OWNER TO legalai_app', obj.viewname); END LOOP; END \$\$;"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d legal_ai -c "GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO legalai_app;"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d legal_ai -c "GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO legalai_app;"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d legal_ai -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES TO legalai_app;"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d legal_ai -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO legalai_app;"
docker compose exec -T db sh -lc "PGPASSWORD=legalai_app psql -h localhost -U legalai_app -d legal_ai -tAc 'SELECT 1'" >/dev/null

docker compose restart app pipeline
docker compose ps
wget -T 10 -qO- http://localhost:3001/api/health
'@
$remoteScript = $remoteScript.Replace('__REMOTE_APP_PATH__', $RemoteAppPath)

Write-Host "Repairing VPS database runtime on $sshTarget..."
Invoke-RemoteScript $sshTarget $remoteScript $scpArgs $sshArgs
Write-Host ""
Write-Host "DB repair complete."
