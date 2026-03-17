param(
    [Parameter(Mandatory = $true)]
    [string]$ServerHost,

    [string]$RemoteUser = "root",

    [string]$IdentityFile = "",

    [string]$RemoteAppPath = "/opt/legal-ai",

    [string]$LocalBackupRoot = ".\\backups\\vps",

    [switch]$KeepRemoteArchive,

    [switch]$SkipExpand
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

    $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("legal-ai-backup-" + [System.Guid]::NewGuid().ToString("N") + ".sh")
    $remoteTempFile = "/tmp/" + [System.IO.Path]::GetFileName($tempFile)

    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($tempFile, $Script, $utf8NoBom)

        & scp @ScpArgs $tempFile "${Target}:$remoteTempFile"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to upload remote backup script."
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
Require-Command "tar"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeHost = ($ServerHost -replace "[^a-zA-Z0-9.-]", "_")
$backupId = "$safeHost-$timestamp"
$sshTarget = "$RemoteUser@$ServerHost"
$localBackupDir = Join-Path $LocalBackupRoot $backupId
$remoteTempDir = "/tmp/legal-ai-backup-$timestamp"
$remoteArchive = "/tmp/legal-ai-backup-$timestamp.tar.gz"
$remoteFolderName = "legal-ai-backup-$timestamp"
$localArchive = Join-Path $localBackupDir "$backupId.tar.gz"
$stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) ("legal-ai-vps-backup-" + [System.Guid]::NewGuid().ToString("N"))
$stagingArchive = Join-Path $stagingDir "$backupId.tar.gz"
$stagingExpandedDir = Join-Path $stagingDir $remoteFolderName
$sshArgs = @()
$scpArgs = @()

if ($IdentityFile) {
    $sshArgs += @("-i", $IdentityFile)
    $scpArgs += @("-i", $IdentityFile)
}

New-Item -ItemType Directory -Path $LocalBackupRoot -Force | Out-Null
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

try {
    Write-Host "Creating VPS backup on $sshTarget..."
    $remoteScript = @"
set -euo pipefail

remote_app_path="$RemoteAppPath"
remote_temp_dir="$remoteTempDir"
remote_archive="$remoteArchive"
remote_folder_name="$remoteFolderName"
backup_timestamp="$timestamp"
server_host="$ServerHost"

mkdir -p "`$remote_temp_dir"
printf 'backup_timestamp=%s\nserver=%s\nremote_app_path=%s\n' "`$backup_timestamp" "`$server_host" "`$remote_app_path" > "`$remote_temp_dir/backup-manifest.txt"

cd "`$remote_app_path"
docker compose ps >> "`$remote_temp_dir/backup-manifest.txt"
docker compose exec -T db pg_dump -U postgres -d legal_ai -Fc > "`$remote_temp_dir/legal_ai.dump"

cp "`$remote_app_path/.env" "`$remote_temp_dir/app.env"
cp "`$remote_app_path/docker-compose.yml" "`$remote_temp_dir/docker-compose.yml"
cp "`$remote_app_path/next.config.js" "`$remote_temp_dir/next.config.js"

if [ -f "`$remote_app_path/master_index.json" ]; then cp "`$remote_app_path/master_index.json" "`$remote_temp_dir/"; fi
if [ -f "`$remote_app_path/master_index.prev.json" ]; then cp "`$remote_app_path/master_index.prev.json" "`$remote_temp_dir/"; fi
if [ -d "`$remote_app_path/uploads" ]; then cp -a "`$remote_app_path/uploads" "`$remote_temp_dir/uploads"; fi
if [ -d "`$remote_app_path/data" ]; then cp -a "`$remote_app_path/data" "`$remote_temp_dir/data"; fi
if [ -f "/etc/caddy/Caddyfile" ]; then cp "/etc/caddy/Caddyfile" "`$remote_temp_dir/Caddyfile"; fi

tar -czf "`$remote_archive" -C "/tmp" "`$remote_folder_name"
"@
    Invoke-RemoteScript $sshTarget $remoteScript $scpArgs $sshArgs

    Write-Host "Downloading backup archive..."
    & scp @scpArgs "${sshTarget}:$remoteArchive" $stagingArchive
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to download archive from VPS."
    }

    if (-not $SkipExpand) {
        Write-Host "Expanding archive locally..."
        & tar -xzf $stagingArchive -C $stagingDir
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to expand local archive."
        }

        foreach ($requiredItem in @("backup-manifest.txt", "legal_ai.dump", "app.env")) {
            if (-not (Test-Path (Join-Path $stagingExpandedDir $requiredItem))) {
                throw "Backup archive is incomplete. Missing '$requiredItem'."
            }
        }
    }

    if (-not $KeepRemoteArchive) {
        Write-Host "Cleaning up temporary VPS backup files..."
        $cleanupScript = @"
set -euo pipefail
rm -rf "$remoteTempDir" "$remoteArchive"
"@
        Invoke-RemoteScript $sshTarget $cleanupScript $scpArgs $sshArgs
    }

    New-Item -ItemType Directory -Path $localBackupDir -Force | Out-Null
    Move-Item $stagingArchive $localArchive
    if (-not $SkipExpand) {
        Move-Item $stagingExpandedDir (Join-Path $localBackupDir $remoteFolderName)
    }

    Write-Host ""
    Write-Host "Backup complete."
    Write-Host "Local folder: $localBackupDir"
    Write-Host "Archive: $localArchive"
}
catch {
    if (Test-Path $localBackupDir) {
        Remove-Item $localBackupDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    throw
}
finally {
    if (Test-Path $stagingDir) {
        Remove-Item $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
