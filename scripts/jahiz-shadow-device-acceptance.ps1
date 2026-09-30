param(
  [string]$Project = "C:\Dev\Jahiz",
  [string]$MobileHost = "",
  [string]$DevOwner = "jahiz-device-acceptance"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Section([string]$Title) {
  Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

function Pass([string]$Message) {
  Write-Host "PASS  $Message" -ForegroundColor Green
}

function Assert-NativeSuccess([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

function Resolve-LanIp {
  $Candidates = @(
    Get-NetIPConfiguration |
      Where-Object {
        $_.IPv4DefaultGateway -and
        $_.NetAdapter.Status -eq "Up"
      } |
      ForEach-Object {
        $_.IPv4Address.IPAddress
      } |
      Where-Object {
        $_ -and
        $_ -notlike "127.*" -and
        $_ -notlike "169.254.*"
      }
  )

  if ($Candidates.Count -eq 0) {
    throw (
      "Could not detect a LAN IPv4 address. " +
      "Re-run with -MobileHost <PC-LAN-IP>."
    )
  }

  return [string]$Candidates[0]
}

Set-Location -LiteralPath $Project

Section "JAHIZ REAL-DEVICE SHADOW ACCEPTANCE"

if ($PSVersionTable.PSVersion.Major -lt 5) {
  throw "PowerShell 5.1 or newer is required."
}

docker version --format "{{.Server.Version}}" |
  Out-Null
Assert-NativeSuccess "Docker runtime"

if (-not $MobileHost) {
  $MobileHost = Resolve-LanIp
}

Pass ("Mobile API host: " + $MobileHost)

Section "START POSTGRESQL"

docker compose up -d postgres
Assert-NativeSuccess "docker compose up postgres"

$ContainerPostgresUser = (
  docker compose exec -T postgres `
    printenv POSTGRES_USER
).Trim()

Assert-NativeSuccess "Read container POSTGRES_USER"

if (-not $ContainerPostgresUser) {
  throw "Container POSTGRES_USER is empty."
}

$PublishedPortLine = (
  docker compose port postgres 5432
).Trim()

Assert-NativeSuccess "Read PostgreSQL published port"

$PortMatch = [regex]::Match(
  $PublishedPortLine,
  ':(\d+)$'
)

if (-not $PortMatch.Success) {
  throw (
    "Could not parse PostgreSQL published port from: " +
    $PublishedPortLine
  )
}

$PublishedPostgresPort =
  $PortMatch.Groups[1].Value

Section "PROVISION DEVICE ACCEPTANCE DATABASE"

$TestRole = "jahiz_m7f2_device"
$TestDb = "jahiz_m7f2_device"
$TestPassword =
  "m7f2_" +
  [guid]::NewGuid().ToString("N")

$RoleExistsOutput =
  @(
    docker compose exec -T postgres `
      psql `
      -v ON_ERROR_STOP=1 `
      -U $ContainerPostgresUser `
      -d postgres `
      -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$TestRole';"
  )

Assert-NativeSuccess "Check device acceptance role"

$RoleExists =
  (($RoleExistsOutput -join "").Trim() -eq "1")

if ($RoleExists) {
  docker compose exec -T postgres `
    psql `
    -v ON_ERROR_STOP=1 `
    -U $ContainerPostgresUser `
    -d postgres `
    -c "ALTER ROLE $TestRole WITH LOGIN PASSWORD '$TestPassword';"

  Assert-NativeSuccess "Rotate device acceptance role password"
}
else {
  docker compose exec -T postgres `
    psql `
    -v ON_ERROR_STOP=1 `
    -U $ContainerPostgresUser `
    -d postgres `
    -c "CREATE ROLE $TestRole LOGIN PASSWORD '$TestPassword';"

  Assert-NativeSuccess "Create device acceptance role"
}

$DbExistsOutput =
  @(
    docker compose exec -T postgres `
      psql `
      -v ON_ERROR_STOP=1 `
      -U $ContainerPostgresUser `
      -d postgres `
      -tAc "SELECT 1 FROM pg_database WHERE datname = '$TestDb';"
  )

Assert-NativeSuccess "Check device acceptance database"

$DbExists =
  (($DbExistsOutput -join "").Trim() -eq "1")

if ($DbExists) {
  docker compose exec -T postgres `
    psql `
    -v ON_ERROR_STOP=1 `
    -U $ContainerPostgresUser `
    -d postgres `
    -c "ALTER DATABASE $TestDb OWNER TO $TestRole;"

  Assert-NativeSuccess "Keep existing device acceptance database"
}
else {
  docker compose exec -T postgres `
    psql `
    -v ON_ERROR_STOP=1 `
    -U $ContainerPostgresUser `
    -d postgres `
    -c "CREATE DATABASE $TestDb OWNER $TestRole;"

  Assert-NativeSuccess "Create device acceptance database"
}

Pass "Dedicated device acceptance database is persistent across harness restarts"
$RuntimeRoot = Join-Path `
  $Project `
  ".jahiz-runtime\m7f2-device"

New-Item `
  -ItemType Directory `
  -Force `
  -Path $RuntimeRoot |
  Out-Null

$ApiOut =
  Join-Path $RuntimeRoot "api.out.log"

$ApiErr =
  Join-Path $RuntimeRoot "api.err.log"

$Node =
  (Get-Command node.exe).Source

$env:POSTGRES_HOST = "127.0.0.1"
$env:POSTGRES_PORT = $PublishedPostgresPort
$env:POSTGRES_USER = $TestRole
$env:POSTGRES_PASSWORD = $TestPassword
$env:POSTGRES_DB = $TestDb
$env:NODE_ENV = "development"
$env:EXPO_PUBLIC_JAHIZ_SHADOW_CURSOR_NAMESPACE =
  "m7f2.device.acceptance.v2"
$env:JAHIZ_DEV_AUTH_ENABLED = "1"
$env:JAHIZ_API_HOST = "0.0.0.0"
$env:JAHIZ_API_PORT = "4010"

Section "START DEVICE ACCEPTANCE API"

$ApiProcess =
  Start-Process `
    -FilePath $Node `
    -ArgumentList @(
      "scripts/jahiz-shadow-device-api.mjs"
    ) `
    -WorkingDirectory $Project `
    -RedirectStandardOutput $ApiOut `
    -RedirectStandardError $ApiErr `
    -PassThru

try {
  $Healthy = $false

  for (
    $Attempt = 1;
    $Attempt -le 30;
    $Attempt += 1
  ) {
    Start-Sleep -Milliseconds 500

    if ($ApiProcess.HasExited) {
      throw (
        "Device API exited early. See " +
        $ApiErr
      )
    }

    try {
      $Health =
        Invoke-RestMethod `
          -Uri "http://127.0.0.1:4010/health" `
          -Method Get `
          -TimeoutSec 2

      if ($Health.status -eq "ok") {
        $Healthy = $true
        break
      }
    }
    catch {
      # Keep waiting.
    }
  }

  if (-not $Healthy) {
    throw (
      "Device API did not become healthy. Logs: " +
      $ApiOut +
      " / " +
      $ApiErr
    )
  }

  Pass "Device API health check passed"

  $env:EXPO_PUBLIC_JAHIZ_SHADOW_OBSERVE = "1"
  $env:EXPO_PUBLIC_JAHIZ_SHADOW_API_URL =
    "http://" + $MobileHost + ":4010"
  $env:EXPO_PUBLIC_JAHIZ_SHADOW_DEV_OWNER =
    $DevOwner
  $env:EXPO_PUBLIC_JAHIZ_SHADOW_DIAGNOSTICS = "1"

  Section "REAL-DEVICE ACCEPTANCE READY"

  Write-Host ""
  Write-Host (
    "API for phone : http://" +
    $MobileHost +
    ":4010"
  ) -ForegroundColor Yellow
  Write-Host (
    "Dev owner     : " +
    $DevOwner
  )
  Write-Host ""
  Write-Host "Requirements:" -ForegroundColor Cyan
  Write-Host "1. PC and phone must be on the same LAN/Wi-Fi."
  Write-Host "2. If Windows Firewall asks, allow Node on Private networks."
  Write-Host "3. Open the Expo project on the physical phone."
  Write-Host "4. The SHADOW button should appear at the top-right."
  Write-Host "5. Make normal trip edits; do not enter fake evidence just to raise counters."
  Write-Host "6. Open SHADOW and capture the aggregate diagnostics."
  Write-Host ""
  Write-Host "Expected first healthy evidence:" -ForegroundColor Cyan
  Write-Host "- Observe: Enabled"
  Write-Host "- Authority: local"
  Write-Host "- Bootstrap/server divergence: 0"
  Write-Host "- Invalid responses: 0"
  Write-Host "- Unauthorized: 0"
  Write-Host ""
  Write-Host "Press Ctrl+C when the device session is finished." -ForegroundColor Yellow
  Write-Host ""

  npm.cmd `
    --workspace @jahiz/mobile `
    run start

  Assert-NativeSuccess "Expo mobile start"
}
finally {
  if (
    $ApiProcess -and
    -not $ApiProcess.HasExited
  ) {
    Stop-Process `
      -Id $ApiProcess.Id `
      -Force `
      -ErrorAction SilentlyContinue
  }

  Write-Host ""
  Write-Host (
    "Device API logs: " +
    $ApiOut
  ) -ForegroundColor DarkGray
}
