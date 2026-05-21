#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PARENT_NAME="$(basename "$(dirname "${SCRIPT_DIR}")")"
SCRIPT_NAME="$(basename "${SCRIPT_DIR}")"

if [[ "${SCRIPT_PARENT_NAME}" == "deploy" && "${SCRIPT_NAME}" == "linux" ]]; then
  DEFAULT_REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
else
  DEFAULT_REPO_ROOT="${SCRIPT_DIR}"
fi

INSTALL_DIR=""
REPO_ROOT="${DEFAULT_REPO_ROOT}"

REPO_COMPOSE_FILE=""
REPO_LINUX_COMPOSE_FILE=""
OFFLINE_COMPOSE_FILE=""
OFFLINE_IMAGES_FILE_DEFAULT=""
GPU_COMPOSE_FILE=""

INSTALL_MODE=""
FORCE_OFFLINE_MODE=0
USE_GPU=0
GPU_FLAG_EXPLICIT=0
SKIP_DOCKER_INSTALL=0
FORCE_RECREATE_ENV=0
SKIP_IMAGE_LOAD=0
CUSTOM_IMAGES_FILE=""

GITHUB_REPO=""
GITHUB_REF="main"
GITHUB_TOKEN=""
GITHUB_IMAGES_URL=""
GITHUB_BUNDLE_URL=""
ALLOW_GITHUB_BOOTSTRAP=1

DOCKER_PREFIX=()
ROOT_ENV_FILE=""
BACKEND_ENV_FILE=""

APP_HOST=""
API_SCHEME="http"
FRONTEND_SCHEME="http"
API_PORT="7192"
FRONTEND_PORT="3000"
MYSQL_DATABASE="marketplaceDocker"
MYSQL_USER="testUserDocker"
MARKETPLACE_NAME="Архив"

print_usage() {
  cat <<'USAGE'
Usage:
  ./install.sh [options]

Options:
  --install-dir <path>            Installation root directory (default: auto)
  --host <domain-or-ip>           Public host for the app (default: auto-detect)
  --api-scheme <http|https>       API URL scheme (default: http)
  --frontend-scheme <http|https>  Frontend URL scheme (default: http)
  --api-port <port>               Public API port (default: 7192)
  --frontend-port <port>          Public frontend port (default: 3000)
  --marketplace-name <name>       Public marketplace name (default: Архив)
  --mysql-database <name>         MySQL database name (default: marketplaceDocker)
  --mysql-user <name>             MySQL application user (default: testUserDocker)
  --with-gpu                      Force GPU rembg override (repo mode only)
  --offline                       Force offline mode (no build from source)
  --images-file <path>            Path to docker images archive for offline mode
  --skip-image-load               Do not load images archive in offline mode
  --skip-docker-install           Fail if Docker is missing (do not auto-install)
  --force-recreate-env            Recreate .env.server files even if they exist

GitHub bootstrap options:
  --github-repo <owner/repo>      Download missing files from this GitHub repo
  --github-ref <branch-or-tag>    GitHub ref for raw files (default: main)
  --github-token <token>          Token for private GitHub repo access
  --github-images-url <url>       Direct URL to images archive (e.g. archiveweb-images.tar.gz)
  --github-bundle-url <url>       URL to full offline bundle (installer tar.gz); images extracted automatically
  --no-github                     Disable any GitHub fallback downloads

  --help                          Show this help
USAGE
}

log() {
  printf '[install] %s\n' "$1"
}

warn() {
  printf '[install] warning: %s\n' "$1" >&2
}

die() {
  printf '[install] error: %s\n' "$1" >&2
  exit 1
}

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi

  die "Root privileges are required to run: $*"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

detect_nvidia_gpu() {
  if [[ -f /proc/driver/nvidia/version ]]; then
    return 0
  fi

  if command_exists nvidia-smi; then
    if nvidia-smi -L >/dev/null 2>&1; then
      return 0
    fi
  fi

  if command_exists lspci; then
    if lspci | grep -Eqi '(vga|3d|display).*nvidia'; then
      return 0
    fi
  fi

  return 1
}

auto_enable_gpu_if_available() {
  if [[ "${GPU_FLAG_EXPLICIT}" -eq 1 ]]; then
    return
  fi

  if detect_nvidia_gpu; then
    USE_GPU=1
    log "Detected NVIDIA discrete GPU. Enabling docker-compose.gpu.yml automatically."
  fi
}

refresh_paths() {
  REPO_COMPOSE_FILE="${REPO_ROOT}/docker-compose.yml"
  REPO_LINUX_COMPOSE_FILE="${REPO_ROOT}/deploy/linux/docker-compose.linux.yml"
  OFFLINE_COMPOSE_FILE="${REPO_ROOT}/deploy/linux/docker-compose.offline.yml"
  OFFLINE_IMAGES_FILE_DEFAULT="${REPO_ROOT}/deploy/linux/images.tar.gz"
  GPU_COMPOSE_FILE="${REPO_ROOT}/docker-compose.gpu.yml"
}

docker_exec() {
  if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
    "${DOCKER_PREFIX[@]}" docker "$@"
    return
  fi

  docker "$@"
}

compose_exec() {
  if docker compose version >/dev/null 2>&1; then
    if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
      "${DOCKER_PREFIX[@]}" docker compose "$@"
      return
    fi

    docker compose "$@"
    return
  fi

  if command_exists docker-compose; then
    if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
      "${DOCKER_PREFIX[@]}" docker-compose "$@"
      return
    fi

    docker-compose "$@"
    return
  fi

  die "Docker Compose is not installed. Install Docker Compose v2 plugin or docker-compose."
}

ensure_linux() {
  if [[ "$(uname -s)" != "Linux" ]]; then
    die "This installer supports Linux only."
  fi
}

resolve_repo_root() {
  if [[ -n "${INSTALL_DIR}" ]]; then
    mkdir -p "${INSTALL_DIR}"
    REPO_ROOT="$(cd "${INSTALL_DIR}" && pwd)"
  else
    REPO_ROOT="${DEFAULT_REPO_ROOT}"
  fi

  refresh_paths
}

ensure_dependencies_for_install() {
  if command_exists curl; then
    return
  fi

  log "Installing curl (required for Docker installation and GitHub bootstrap)..."
  if command_exists apt-get; then
    run_as_root apt-get update
    run_as_root apt-get install -y curl
    return
  fi

  if command_exists dnf; then
    run_as_root dnf install -y curl
    return
  fi

  if command_exists yum; then
    run_as_root yum install -y curl
    return
  fi

  die "Could not install curl automatically. Install curl manually and retry."
}

ensure_downloader_available() {
  if command_exists curl || command_exists wget; then
    return
  fi

  ensure_dependencies_for_install

  if command_exists curl || command_exists wget; then
    return
  fi

  die "No downloader available (curl/wget)."
}

ensure_docker_service() {
  if docker_exec info >/dev/null 2>&1; then
    return
  fi

  if [[ "$(id -u)" -ne 0 ]] && ! command_exists sudo; then
    warn "Docker daemon is not reachable and sudo is unavailable. Start docker manually."
    return
  fi

  if command_exists systemctl; then
    run_as_root systemctl enable --now docker
    return
  fi

  if command_exists service; then
    run_as_root service docker start
    return
  fi

  warn "Could not detect system service manager to start docker. Ensure Docker daemon is running."
}

ensure_docker() {
  if command_exists docker; then
    return
  fi

  if [[ "${SKIP_DOCKER_INSTALL}" -eq 1 ]]; then
    die "Docker is not installed."
  fi

  log "Docker is missing. Installing Docker Engine..."
  ensure_dependencies_for_install
  curl -fsSL https://get.docker.com | run_as_root sh
  ensure_docker_service
}

ensure_docker_access() {
  if docker info >/dev/null 2>&1; then
    return
  fi

  if command_exists sudo; then
    if sudo docker info >/dev/null 2>&1; then
      DOCKER_PREFIX=(sudo)
      return
    fi
  fi

  die "Cannot access Docker daemon. Start Docker and ensure your user has Docker permissions."
}

normalize_host() {
  local value="$1"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  printf '%s' "$value"
}

detect_host() {
  if [[ -n "${APP_HOST}" ]]; then
    APP_HOST="$(normalize_host "${APP_HOST}")"
    return
  fi

  if command_exists hostname; then
    APP_HOST="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  if [[ -z "${APP_HOST}" ]] && command_exists ip; then
    APP_HOST="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") {print $(i+1); exit}}')"
  fi

  if [[ -z "${APP_HOST}" ]]; then
    APP_HOST="localhost"
  fi

  APP_HOST="$(normalize_host "${APP_HOST}")"
}

build_url() {
  local scheme="$1"
  local host="$2"
  local port="$3"

  if [[ "${scheme}" == "http" && "${port}" == "80" ]]; then
    printf '%s://%s' "${scheme}" "${host}"
    return
  fi

  if [[ "${scheme}" == "https" && "${port}" == "443" ]]; then
    printf '%s://%s' "${scheme}" "${host}"
    return
  fi

  printf '%s://%s:%s' "${scheme}" "${host}" "${port}"
}

generate_secret() {
  if command_exists openssl; then
    openssl rand -hex 16
    return
  fi

  od -An -N16 -tx1 /dev/urandom | tr -d ' \n'
}

generate_strong_password() {
  if command_exists openssl; then
    openssl rand -hex 12
    return
  fi

  od -An -N12 -tx1 /dev/urandom | tr -d ' \n'
}

set_env_value() {
  local file_path="$1"
  local key="$2"
  local value="$3"
  local tmp_file

  tmp_file="$(mktemp)"
  awk -v key="${key}" -v value="${value}" -F= '
    BEGIN { updated = 0 }
    $1 == key {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (updated == 0) {
        print key "=" value
      }
    }
  ' "${file_path}" > "${tmp_file}"
  mv "${tmp_file}" "${file_path}"
}

create_root_env() {
  local mysql_root_password="$1"
  local mysql_password="$2"
  local api_url="$3"
  local frontend_url="$4"

  cat > "${ROOT_ENV_FILE}" <<EOF_ENV
NEXT_PUBLIC_API_BASE_URL=${api_url}
NEXT_PUBLIC_MARKETPLACE_NAME=${MARKETPLACE_NAME}

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_ROOT_PASSWORD=${mysql_root_password}
MYSQL_DATABASE=${MYSQL_DATABASE}
MYSQL_USER=${MYSQL_USER}
MYSQL_PASSWORD=${mysql_password}

FRONTEND_BASE_URL=${frontend_url}
Rembg__TimeoutSeconds=120
MARKETPLACE_NAME=${MARKETPLACE_NAME}
EOF_ENV
}

create_backend_env() {
  local jwt_key="$1"
  local api_url="$2"
  local system_user_password="$3"

  cat > "${BACKEND_ENV_FILE}" <<EOF_ENV
Jwt__Key=${jwt_key}
Jwt__Issuer=${api_url}/
Jwt__Audience=${api_url}

SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=mailer@example.com
SMTP_PASS=change_me
SMTP_FROM=mailer@example.com
SMTP_FROM_NAME=${MARKETPLACE_NAME}
SMTP_ENABLE_SSL=true
SMTP_CHECK_CERTIFICATE_REVOCATION=false

SYSTEM_USER_EMAIL=system@archive.local
SYSTEM_USER_NICKNAME=${MARKETPLACE_NAME}
SYSTEM_USER_PASSWORD=${system_user_password}

Rembg__Endpoint=http://rembg:7000/api/remove

YandexAi__Endpoint=https://ai.api.cloud.yandex.net/v1/chat/completions
YandexAi__ApiKey=
YandexAi__FolderId=
YandexAi__Model=

# Optional:
# Bootstrap__AdminEmail=admin@example.com
EOF_ENV
}

ensure_env_files() {
  local api_url="$1"
  local frontend_url="$2"

  mkdir -p "$(dirname "${BACKEND_ENV_FILE}")"

  if [[ ! -f "${ROOT_ENV_FILE}" || "${FORCE_RECREATE_ENV}" -eq 1 ]]; then
    log "Creating ${ROOT_ENV_FILE}"
    create_root_env "$(generate_secret)" "$(generate_secret)" "${api_url}" "${frontend_url}"
  fi

  if [[ ! -f "${BACKEND_ENV_FILE}" || "${FORCE_RECREATE_ENV}" -eq 1 ]]; then
    log "Creating ${BACKEND_ENV_FILE}"
    create_backend_env "$(generate_secret)" "${api_url}" "$(generate_strong_password)"
  fi

  set_env_value "${ROOT_ENV_FILE}" "NEXT_PUBLIC_API_BASE_URL" "${api_url}"
  set_env_value "${ROOT_ENV_FILE}" "NEXT_PUBLIC_MARKETPLACE_NAME" "${MARKETPLACE_NAME}"
  set_env_value "${ROOT_ENV_FILE}" "FRONTEND_BASE_URL" "${frontend_url}"
  set_env_value "${ROOT_ENV_FILE}" "MARKETPLACE_NAME" "${MARKETPLACE_NAME}"
  set_env_value "${ROOT_ENV_FILE}" "MYSQL_DATABASE" "${MYSQL_DATABASE}"
  set_env_value "${ROOT_ENV_FILE}" "MYSQL_USER" "${MYSQL_USER}"

  set_env_value "${BACKEND_ENV_FILE}" "Jwt__Issuer" "${api_url}/"
  set_env_value "${BACKEND_ENV_FILE}" "Jwt__Audience" "${api_url}"
  set_env_value "${BACKEND_ENV_FILE}" "SMTP_FROM_NAME" "${MARKETPLACE_NAME}"
  set_env_value "${BACKEND_ENV_FILE}" "SYSTEM_USER_NICKNAME" "${MARKETPLACE_NAME}"
}

download_file() {
  local url="$1"
  local destination="$2"
  local tmp_file

  ensure_downloader_available
  mkdir -p "$(dirname "${destination}")"
  tmp_file="$(mktemp)"

  if command_exists curl; then
    local curl_args=(--fail --silent --show-error --location --retry 3 --connect-timeout 20)
    if [[ -n "${GITHUB_TOKEN}" ]]; then
      curl_args+=( -H "Authorization: Bearer ${GITHUB_TOKEN}" )
    fi

    if ! curl "${curl_args[@]}" "${url}" -o "${tmp_file}"; then
      rm -f "${tmp_file}"
      return 1
    fi
  else
    local wget_args=(--quiet)
    if [[ -n "${GITHUB_TOKEN}" ]]; then
      wget_args+=( --header="Authorization: Bearer ${GITHUB_TOKEN}" )
    fi

    if ! wget "${wget_args[@]}" -O "${tmp_file}" "${url}"; then
      rm -f "${tmp_file}"
      return 1
    fi
  fi

  mv "${tmp_file}" "${destination}"
  return 0
}

github_raw_url() {
  local repo_path="$1"
  printf 'https://raw.githubusercontent.com/%s/%s/%s' "${GITHUB_REPO}" "${GITHUB_REF}" "${repo_path}"
}

try_download_github_file() {
  local repo_path="$1"
  local destination="$2"

  if [[ "${ALLOW_GITHUB_BOOTSTRAP}" -ne 1 || -z "${GITHUB_REPO}" ]]; then
    return 1
  fi

  local url
  url="$(github_raw_url "${repo_path}")"
  log "Trying GitHub file: ${url}"

  if download_file "${url}" "${destination}"; then
    log "Downloaded ${repo_path}"
    return 0
  fi

  warn "Failed to download ${repo_path} from GitHub"
  return 1
}

write_embedded_linux_compose() {
  local destination="$1"

  cat > "${destination}" <<'EOF_COMPOSE'
services:
  backend:
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      MYSQL_HOST: db
      Rembg__Endpoint: http://rembg:7000/api/remove
    env_file:
      - ./.env.server
      - ./Backend/WebApi/.env.server

  frontend:
    environment:
      NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL}
      NEXT_PUBLIC_MARKETPLACE_NAME: ${NEXT_PUBLIC_MARKETPLACE_NAME}
      NODE_ENV: production
    build:
      args:
        NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL}
        NEXT_PUBLIC_MARKETPLACE_NAME: ${NEXT_PUBLIC_MARKETPLACE_NAME}
EOF_COMPOSE
}

write_embedded_offline_compose() {
  local destination="$1"

  cat > "${destination}" <<'EOF_COMPOSE'
services:
  db:
    image: marketplace-db:latest
    container_name: marketplace-db
    restart: unless-stopped
    command:
      - --log-bin-trust-function-creators=1
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysqlData:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    ports:
      - "3306:3306"

  phpmyadmin:
    image: phpmyadmin/phpmyadmin:latest
    container_name: pma
    restart: unless-stopped
    environment:
      PMA_HOST: db
      PMA_PORT: 3306
      PMA_ARBITRARY: 1
    ports:
      - "8082:80"
    depends_on:
      - db

  rembg:
    image: ${REMBG_IMAGE:-danielgatis/rembg:2.0.75}
    container_name: marketplace-rembg
    command: ["s", "--host", "0.0.0.0", "--port", "7000", "--log_level", "info", "--no-ui"]
    restart: unless-stopped
    ports:
      - "7000:7000"
    healthcheck:
      test:
        [
          "CMD",
          "python",
          "-c",
          "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7000/api', timeout=5)"
        ]
      interval: 10s
      timeout: 10s
      retries: 24
      start_period: 120s

  backend:
    image: marketplace-backend:latest
    container_name: marketplace-backend
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      rembg:
        condition: service_healthy
    env_file:
      - ../../.env.server
      - ../../backend.env.server
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      MYSQL_HOST: db
      Rembg__Endpoint: http://rembg:7000/api/remove
    volumes:
      - backendImages:/app/Images
    ports:
      - "7192:80"

  frontend:
    image: marketplace-frontend:latest
    container_name: marketplace-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL}
      NEXT_PUBLIC_MARKETPLACE_NAME: ${NEXT_PUBLIC_MARKETPLACE_NAME}
      NODE_ENV: production
    depends_on:
      - backend

volumes:
  mysqlData:
  backendImages:
EOF_COMPOSE
}

bootstrap_support_files() {
  mkdir -p "${REPO_ROOT}/deploy/linux"

  if [[ ! -f "${OFFLINE_COMPOSE_FILE}" ]]; then
    if ! try_download_github_file "deploy/linux/docker-compose.offline.yml" "${OFFLINE_COMPOSE_FILE}"; then
      log "Generating embedded offline compose file"
      write_embedded_offline_compose "${OFFLINE_COMPOSE_FILE}"
    fi
  fi

  if [[ ! -f "${REPO_LINUX_COMPOSE_FILE}" ]]; then
    if ! try_download_github_file "deploy/linux/docker-compose.linux.yml" "${REPO_LINUX_COMPOSE_FILE}"; then
      log "Generating embedded linux compose override"
      write_embedded_linux_compose "${REPO_LINUX_COMPOSE_FILE}"
    fi
  fi

  if [[ ! -f "${REPO_COMPOSE_FILE}" ]]; then
    try_download_github_file "docker-compose.yml" "${REPO_COMPOSE_FILE}" || true
  fi

  if [[ "${USE_GPU}" -eq 1 && ! -f "${GPU_COMPOSE_FILE}" ]]; then
    try_download_github_file "docker-compose.gpu.yml" "${GPU_COMPOSE_FILE}" || true
  fi
}

is_repo_build_tree_present() {
  [[ -f "${REPO_COMPOSE_FILE}" ]] &&
  [[ -f "${REPO_LINUX_COMPOSE_FILE}" ]] &&
  [[ -d "${REPO_ROOT}/Backend" ]] &&
  [[ -d "${REPO_ROOT}/Frontend" ]] &&
  [[ -d "${REPO_ROOT}/Database" ]]
}

detect_install_mode() {
  if [[ "${FORCE_OFFLINE_MODE}" -eq 1 ]]; then
    INSTALL_MODE="offline"
  elif is_repo_build_tree_present; then
    INSTALL_MODE="repo"
  else
    INSTALL_MODE="offline"
  fi

  if [[ "${INSTALL_MODE}" == "repo" ]]; then
    ROOT_ENV_FILE="${REPO_ROOT}/.env.server"
    BACKEND_ENV_FILE="${REPO_ROOT}/Backend/WebApi/.env.server"
  else
    ROOT_ENV_FILE="${REPO_ROOT}/.env.server"
    BACKEND_ENV_FILE="${REPO_ROOT}/backend.env.server"
  fi
}

ensure_mode_files() {
  if [[ "${INSTALL_MODE}" == "repo" ]]; then
    [[ -f "${REPO_COMPOSE_FILE}" ]] || die "docker-compose.yml not found: ${REPO_COMPOSE_FILE}"
    [[ -f "${REPO_LINUX_COMPOSE_FILE}" ]] || die "Linux override not found: ${REPO_LINUX_COMPOSE_FILE}"
    return
  fi

  [[ -f "${OFFLINE_COMPOSE_FILE}" ]] || die "Offline compose not found: ${OFFLINE_COMPOSE_FILE}"
}

get_images_file() {
  if [[ -n "${CUSTOM_IMAGES_FILE}" ]]; then
    printf '%s' "${CUSTOM_IMAGES_FILE}"
    return
  fi

  printf '%s' "${OFFLINE_IMAGES_FILE_DEFAULT}"
}

extract_images_from_bundle() {
  local bundle_file="$1"
  local destination="$2"

  mkdir -p "$(dirname "${destination}")"

  if tar -xzf "${bundle_file}" -O deploy/linux/images.tar.gz > "${destination}" 2>/dev/null; then
    return 0
  fi

  if tar -xzf "${bundle_file}" -O images.tar.gz > "${destination}" 2>/dev/null; then
    return 0
  fi

  return 1
}

try_fetch_images_from_github() {
  local destination="$1"

  if [[ "${ALLOW_GITHUB_BOOTSTRAP}" -ne 1 ]]; then
    return 1
  fi

  local direct_url="${GITHUB_IMAGES_URL}"
  local bundle_url="${GITHUB_BUNDLE_URL}"

  if [[ -z "${direct_url}" && -n "${GITHUB_REPO}" ]]; then
    direct_url="https://github.com/${GITHUB_REPO}/releases/latest/download/archiveweb-images.tar.gz"
  fi

  if [[ -z "${bundle_url}" && -n "${GITHUB_REPO}" ]]; then
    bundle_url="https://github.com/${GITHUB_REPO}/releases/latest/download/archiveweb-offline-installer.tar.gz"
  fi

  if [[ -n "${direct_url}" ]]; then
    log "Trying GitHub images archive: ${direct_url}"
    if download_file "${direct_url}" "${destination}"; then
      log "Downloaded images archive"
      return 0
    fi
  fi

  if [[ -n "${bundle_url}" ]]; then
    local tmp_bundle
    tmp_bundle="$(mktemp)"

    log "Trying GitHub offline bundle: ${bundle_url}"
    if download_file "${bundle_url}" "${tmp_bundle}"; then
      if extract_images_from_bundle "${tmp_bundle}" "${destination}"; then
        rm -f "${tmp_bundle}"
        log "Extracted images archive from offline bundle"
        return 0
      fi
      warn "Bundle downloaded, but images.tar.gz was not found inside"
    fi

    rm -f "${tmp_bundle}"
  fi

  return 1
}

load_offline_images_if_present() {
  if [[ "${INSTALL_MODE}" != "offline" || "${SKIP_IMAGE_LOAD}" -eq 1 ]]; then
    return
  fi

  local images_file
  images_file="$(get_images_file)"

  if [[ ! -f "${images_file}" ]]; then
    try_fetch_images_from_github "${images_file}" || true
  fi

  if [[ ! -f "${images_file}" ]]; then
    warn "Images archive not found (${images_file}). Will rely on pulling images from registry."
    return
  fi

  log "Loading docker images from ${images_file}. This may take several minutes..."
  case "${images_file}" in
    *.tar.gz|*.tgz)
      gzip -dc "${images_file}" | docker_exec load
      ;;
    *.tar.zst)
      if ! command_exists zstd; then
        die "zstd is required to load ${images_file}. Install zstd or use .tar.gz archive."
      fi
      zstd -dc "${images_file}" | docker_exec load
      ;;
    *.tar)
      docker_exec load -i "${images_file}"
      ;;
    *)
      warn "Unknown archive extension for ${images_file}. Trying docker load -i."
      docker_exec load -i "${images_file}"
      ;;
  esac
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --install-dir)
        INSTALL_DIR="${2:-}"
        shift 2
        ;;
      --host)
        APP_HOST="${2:-}"
        shift 2
        ;;
      --api-scheme)
        API_SCHEME="${2:-}"
        shift 2
        ;;
      --frontend-scheme)
        FRONTEND_SCHEME="${2:-}"
        shift 2
        ;;
      --api-port)
        API_PORT="${2:-}"
        shift 2
        ;;
      --frontend-port)
        FRONTEND_PORT="${2:-}"
        shift 2
        ;;
      --marketplace-name)
        MARKETPLACE_NAME="${2:-}"
        shift 2
        ;;
      --mysql-database)
        MYSQL_DATABASE="${2:-}"
        shift 2
        ;;
      --mysql-user)
        MYSQL_USER="${2:-}"
        shift 2
        ;;
      --with-gpu)
        USE_GPU=1
        GPU_FLAG_EXPLICIT=1
        shift
        ;;
      --offline)
        FORCE_OFFLINE_MODE=1
        shift
        ;;
      --images-file)
        CUSTOM_IMAGES_FILE="${2:-}"
        shift 2
        ;;
      --skip-image-load)
        SKIP_IMAGE_LOAD=1
        shift
        ;;
      --skip-docker-install)
        SKIP_DOCKER_INSTALL=1
        shift
        ;;
      --force-recreate-env)
        FORCE_RECREATE_ENV=1
        shift
        ;;
      --github-repo)
        GITHUB_REPO="${2:-}"
        shift 2
        ;;
      --github-ref)
        GITHUB_REF="${2:-}"
        shift 2
        ;;
      --github-token)
        GITHUB_TOKEN="${2:-}"
        shift 2
        ;;
      --github-images-url)
        GITHUB_IMAGES_URL="${2:-}"
        shift 2
        ;;
      --github-bundle-url)
        GITHUB_BUNDLE_URL="${2:-}"
        shift 2
        ;;
      --no-github)
        ALLOW_GITHUB_BOOTSTRAP=0
        shift
        ;;
      --help|-h)
        print_usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

validate_args() {
  case "${API_SCHEME}" in
    http|https) ;;
    *) die "Invalid --api-scheme value: ${API_SCHEME}" ;;
  esac

  case "${FRONTEND_SCHEME}" in
    http|https) ;;
    *) die "Invalid --frontend-scheme value: ${FRONTEND_SCHEME}" ;;
  esac

  [[ -n "${API_PORT}" ]] || die "--api-port cannot be empty"
  [[ -n "${FRONTEND_PORT}" ]] || die "--frontend-port cannot be empty"
  [[ -n "${MARKETPLACE_NAME}" ]] || die "--marketplace-name cannot be empty"

  if [[ -n "${GITHUB_REPO}" && ! "${GITHUB_REPO}" =~ ^[^/]+/[^/]+$ ]]; then
    die "--github-repo must be in format owner/repo"
  fi
}

run_compose_up() {
  local api_url="$1"
  local frontend_url="$2"

  if [[ "${INSTALL_MODE}" == "repo" ]]; then
    local compose_files=(
      -f "${REPO_COMPOSE_FILE}"
      -f "${REPO_LINUX_COMPOSE_FILE}"
    )

    if [[ "${USE_GPU}" -eq 1 && -f "${GPU_COMPOSE_FILE}" ]]; then
      compose_files+=( -f "${GPU_COMPOSE_FILE}" )
    fi

    log "Starting containers in repo mode (build from source)..."
    compose_exec --env-file "${ROOT_ENV_FILE}" "${compose_files[@]}" up -d --build
  else
    log "Starting containers in offline mode (single-file/ready-image deploy)..."
    compose_exec --env-file "${ROOT_ENV_FILE}" -f "${OFFLINE_COMPOSE_FILE}" up -d --no-build
  fi

  log "Done."
  log "Mode:     ${INSTALL_MODE}"
  log "Frontend: ${frontend_url}"
  log "API:      ${api_url}"
  log "Env files:"
  log "  ${ROOT_ENV_FILE}"
  log "  ${BACKEND_ENV_FILE}"
}

main() {
  parse_args "$@"
  resolve_repo_root
  validate_args
  ensure_linux
  auto_enable_gpu_if_available

  mkdir -p "${REPO_ROOT}"
  cd "${REPO_ROOT}"

  bootstrap_support_files
  detect_install_mode
  ensure_mode_files

  ensure_docker
  ensure_docker_service
  ensure_docker_access

  detect_host

  local api_url
  local frontend_url
  api_url="$(build_url "${API_SCHEME}" "${APP_HOST}" "${API_PORT}")"
  frontend_url="$(build_url "${FRONTEND_SCHEME}" "${APP_HOST}" "${FRONTEND_PORT}")"

  ensure_env_files "${api_url}" "${frontend_url}"
  load_offline_images_if_present
  run_compose_up "${api_url}" "${frontend_url}"
}

main "$@"
