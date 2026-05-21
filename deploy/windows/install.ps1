[CmdletBinding()]
param(
    [string]$HostName,
    [ValidateSet('http', 'https')]
    [string]$ApiScheme = 'http',
    [ValidateSet('http', 'https')]
    [string]$FrontendScheme = 'http',
    [int]$ApiPort = 7192,
    [int]$FrontendPort = 3000,
    [string]$MarketplaceName = 'Архив',
    [string]$MySqlDatabase = 'marketplaceDocker',
    [string]$MySqlUser = 'testUserDocker',
    [switch]$ForceRecreateEnv,
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)
    Write-Host "[install] $Message"
}

function Write-Fail {
    param([string]$Message)
    throw "[install] error: $Message"
}

function Get-ScriptRoot {
    return Split-Path -Parent $PSCommandPath
}

function Get-RepoRoot {
    $scriptRoot = Get-ScriptRoot
    return (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
}

function Test-CommandExists {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-DetectedHost {
    if ($HostName) {
        return ($HostName -replace '^https?://', '').Trim('/').Trim()
    }

    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object {
                $_.IPAddress -notlike '127.*' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.PrefixOrigin -ne 'WellKnown'
            } |
            Select-Object -First 1 -ExpandProperty IPAddress)

        if ($ip) {
            return $ip
        }
    }
    catch {
    }

    return 'localhost'
}

function New-HexSecret {
    param([int]$ByteLength = 16)

    $bytes = New-Object byte[] $ByteLength
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

function New-StrongPassword {
    return "$(New-HexSecret -ByteLength 8)!Aa1"
}

function Build-Url {
    param(
        [string]$Scheme,
        [string]$Host,
        [int]$Port
    )

    if (($Scheme -eq 'http' -and $Port -eq 80) -or ($Scheme -eq 'https' -and $Port -eq 443)) {
        return "${Scheme}://${Host}"
    }

    return "${Scheme}://${Host}:${Port}"
}

function Set-OrAddEnvValue {
    param(
        [string]$Path,
        [string]$Key,
        [string]$Value
    )

    $lines = @()
    if (Test-Path $Path) {
        $lines = Get-Content -Path $Path -Encoding UTF8
    }

    $updated = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^$([Regex]::Escape($Key))=") {
            $lines[$i] = "$Key=$Value"
            $updated = $true
        }
    }

    if (-not $updated) {
        $lines += "$Key=$Value"
    }

    Set-Content -Path $Path -Encoding UTF8 -Value $lines
}

function Ensure-RootEnv {
    param(
        [string]$Path,
        [string]$ApiUrl,
        [string]$FrontendUrl,
        [string]$MarketName,
        [string]$DbName,
        [string]$DbUser,
        [switch]$Recreate
    )

    if ($Recreate -or -not (Test-Path $Path)) {
        Write-Info "Создаю $Path"
        $content = @"
NEXT_PUBLIC_API_BASE_URL=$ApiUrl
NEXT_PUBLIC_MARKETPLACE_NAME=$MarketName

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_ROOT_PASSWORD=$(New-HexSecret)
MYSQL_DATABASE=$DbName
MYSQL_USER=$DbUser
MYSQL_PASSWORD=$(New-HexSecret)

FRONTEND_BASE_URL=$FrontendUrl
Rembg__TimeoutSeconds=120
MARKETPLACE_NAME=$MarketName
"@
        Set-Content -Path $Path -Encoding UTF8 -Value $content
    }

    Set-OrAddEnvValue -Path $Path -Key 'NEXT_PUBLIC_API_BASE_URL' -Value $ApiUrl
    Set-OrAddEnvValue -Path $Path -Key 'NEXT_PUBLIC_MARKETPLACE_NAME' -Value $MarketName
    Set-OrAddEnvValue -Path $Path -Key 'FRONTEND_BASE_URL' -Value $FrontendUrl
    Set-OrAddEnvValue -Path $Path -Key 'MARKETPLACE_NAME' -Value $MarketName
    Set-OrAddEnvValue -Path $Path -Key 'MYSQL_DATABASE' -Value $DbName
    Set-OrAddEnvValue -Path $Path -Key 'MYSQL_USER' -Value $DbUser
}

function Ensure-BackendEnv {
    param(
        [string]$Path,
        [string]$ApiUrl,
        [string]$MarketName,
        [switch]$Recreate
    )

    if ($Recreate -or -not (Test-Path $Path)) {
        Write-Info "Создаю $Path"
        $content = @"
Jwt__Key=$(New-HexSecret)
Jwt__Issuer=$ApiUrl/
Jwt__Audience=$ApiUrl

SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=mailer@example.com
SMTP_PASS=change_me
SMTP_FROM=mailer@example.com
SMTP_FROM_NAME=$MarketName
SMTP_ENABLE_SSL=true
SMTP_CHECK_CERTIFICATE_REVOCATION=false

SYSTEM_USER_EMAIL=system@archive.local
SYSTEM_USER_NICKNAME=$MarketName
SYSTEM_USER_PASSWORD=$(New-StrongPassword)

Rembg__Endpoint=http://rembg:7000/api/remove

YandexAi__Endpoint=https://ai.api.cloud.yandex.net/v1/chat/completions
YandexAi__ApiKey=
YandexAi__FolderId=
YandexAi__Model=

# Optional:
# Bootstrap__AdminEmail=admin@example.com
"@
        Set-Content -Path $Path -Encoding UTF8 -Value $content
    }

    Set-OrAddEnvValue -Path $Path -Key 'Jwt__Issuer' -Value "$ApiUrl/"
    Set-OrAddEnvValue -Path $Path -Key 'Jwt__Audience' -Value $ApiUrl
    Set-OrAddEnvValue -Path $Path -Key 'SMTP_FROM_NAME' -Value $MarketName
    Set-OrAddEnvValue -Path $Path -Key 'SYSTEM_USER_NICKNAME' -Value $MarketName
}

function Ensure-DockerAvailable {
    if (-not (Test-CommandExists -Name 'docker')) {
        Write-Fail 'Docker не найден. Установи Docker Desktop и повтори запуск.'
    }

    $null = docker version

    try {
        $null = docker compose version
    }
    catch {
        Write-Fail 'Docker Compose v2 не найден. Обнови Docker Desktop.'
    }
}

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

$composeFile = Join-Path $repoRoot 'docker-compose.yml'
$windowsComposeOverride = Join-Path $repoRoot 'deploy/windows/docker-compose.windows.yml'
$rootEnvFile = Join-Path $repoRoot '.env.server'
$backendEnvFile = Join-Path $repoRoot 'Backend/WebApi/.env.server'

if (-not (Test-Path $composeFile)) {
    Write-Fail "Не найден $composeFile"
}

if (-not (Test-Path $windowsComposeOverride)) {
    Write-Fail "Не найден $windowsComposeOverride"
}

Ensure-DockerAvailable

$resolvedHost = Get-DetectedHost
$apiUrl = Build-Url -Scheme $ApiScheme -Host $resolvedHost -Port $ApiPort
$frontendUrl = Build-Url -Scheme $FrontendScheme -Host $resolvedHost -Port $FrontendPort

Ensure-RootEnv -Path $rootEnvFile -ApiUrl $apiUrl -FrontendUrl $frontendUrl -MarketName $MarketplaceName -DbName $MySqlDatabase -DbUser $MySqlUser -Recreate:$ForceRecreateEnv
Ensure-BackendEnv -Path $backendEnvFile -ApiUrl $apiUrl -MarketName $MarketplaceName -Recreate:$ForceRecreateEnv

Write-Info 'Запускаю docker compose...'
$composeArgs = @(
    '--env-file', $rootEnvFile,
    '-f', $composeFile,
    '-f', $windowsComposeOverride,
    'up', '-d'
)

if (-not $SkipBuild) {
    $composeArgs += '--build'
}

& docker compose @composeArgs

Write-Info 'Готово.'
Write-Info "Frontend: $frontendUrl"
Write-Info "API:      $apiUrl"
Write-Info "Env:      $rootEnvFile"
Write-Info "Backend:  $backendEnvFile"
