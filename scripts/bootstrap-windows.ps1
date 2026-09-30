$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

function Resolve-NodeDirectory {
  $candidates = @(
    $env:NVM_SYMLINK,
    "$env:ProgramFiles\nodejs",
    "${env:ProgramFiles(x86)}\nodejs",
    "$env:LOCALAPPDATA\Programs\nodejs",
    "$env:USERPROFILE\scoop\apps\nodejs-lts\current",
    "$env:USERPROFILE\scoop\apps\nodejs\current"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path (Join-Path $candidate "node.exe"))) {
      return $candidate
    }
  }

  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    return Split-Path $nodeCommand.Source -Parent
  }

  throw "Node.js was not found. Install Node.js LTS, reopen PowerShell, and run this script again."
}

$NodeDir = Resolve-NodeDirectory
$Node = Join-Path $NodeDir "node.exe"
$Npm = Join-Path $NodeDir "npm.cmd"
$env:Path = "$NodeDir;$env:APPDATA\npm;$env:Path"

Write-Host "Node: $(& $Node --version)"
Write-Host "npm:  $(& $Npm --version)"

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example."
}

# Make exported lockfiles portable outside build environments.
if (Test-Path "package-lock.json") {
  $lock = [System.IO.File]::ReadAllText((Resolve-Path "package-lock.json"))
  $fixed = [regex]::Replace(
    $lock,
    'https://packages\.[^"/]+\.internal\.api\.openai\.org/artifactory/api/npm/npm-public/',
    'https://registry.npmjs.org/'
  )
  if ($fixed -ne $lock) {
    [System.IO.File]::WriteAllText(
      (Resolve-Path "package-lock.json"),
      $fixed,
      (New-Object System.Text.UTF8Encoding($false))
    )
    Write-Host "Replaced internal registry URLs in package-lock.json."
  }
}

& $Npm config set registry "https://registry.npmjs.org/" --location=user
& $Npm ping

if (Test-Path "package-lock.json") {
  & $Npm ci --no-audit --no-fund
} else {
  & $Npm install --no-audit --no-fund
}

if ($LASTEXITCODE -ne 0) {
  throw "npm dependency installation failed."
}

$docker = Get-Command docker.exe -ErrorAction SilentlyContinue
if ($docker) {
  docker compose up -d postgres
  docker compose ps
} else {
  Write-Warning "Docker was not found. Dependencies are installed, but PostgreSQL was not started."
}

Write-Host ""
Write-Host "Jahiz workspace is ready." -ForegroundColor Green
Write-Host "Mobile LAN:    & `"$Npm`" run mobile:start"
Write-Host "Mobile tunnel: & `"$Npm`" --workspace @jahiz/mobile run start:tunnel"
Write-Host "Validation:    & `"$Npm`" run test"
