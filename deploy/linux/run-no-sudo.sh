#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

ROOT_ENV_FILE="${REPO_ROOT}/.env.server"
BACKEND_ENV_FILE="${REPO_ROOT}/Backend/WebApi/.env.server"
GPU_COMPOSE_FILE="${REPO_ROOT}/docker-compose.gpu.yml"

APP_HOST="klocharchive.ru"
API_SCHEME="https"
FRONTEND_SCHEME="https"
API_PORT="443"
FRONTEND_PORT="443"
MARKETPLACE_NAME="Архив"
MYSQL_DATABASE="marketplaceDocker"
MYSQL_USER="testUserDocker"

log() {
  printf '[no-sudo-deploy] %s\n' "$1"
}

die() {
  printf '[no-sudo-deploy] error: %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

normalize_host() {
  local value="$1"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  printf '%s' "$value"
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
EOF_ENV
}

ensure_env_files() {
  local api_url="$1"
  local frontend_url="$2"

  mkdir -p "$(dirname "${BACKEND_ENV_FILE}")"

  if [[ ! -f "${ROOT_ENV_FILE}" ]]; then
    log "Creating ${ROOT_ENV_FILE}"
    create_root_env "$(generate_secret)" "$(generate_secret)" "${api_url}" "${frontend_url}"
  fi

  if [[ ! -f "${BACKEND_ENV_FILE}" ]]; then
    log "Creating ${BACKEND_ENV_FILE}"
    create_backend_env "$(generate_secret)" "${api_url}" "$(generate_strong_password)"
  fi

  set_env_value "${ROOT_ENV_FILE}" "NEXT_PUBLIC_API_BASE_URL" "${api_url}"
  set_env_value "${ROOT_ENV_FILE}" "NEXT_PUBLIC_MARKETPLACE_NAME" "${MARKETPLACE_NAME}"
  set_env_value "${ROOT_ENV_FILE}" "FRONTEND_BASE_URL" "${frontend_url}"
  set_env_value "${ROOT_ENV_FILE}" "MARKETPLACE_NAME" "${MARKETPLACE_NAME}"

  set_env_value "${BACKEND_ENV_FILE}" "Jwt__Issuer" "${api_url}/"
  set_env_value "${BACKEND_ENV_FILE}" "Jwt__Audience" "${api_url}"
  set_env_value "${BACKEND_ENV_FILE}" "SMTP_FROM_NAME" "${MARKETPLACE_NAME}"
  set_env_value "${BACKEND_ENV_FILE}" "SYSTEM_USER_NICKNAME" "${MARKETPLACE_NAME}"
}

detect_nvidia_gpu() {
  if [[ -f /proc/driver/nvidia/version ]]; then
    return 0
  fi

  if command_exists nvidia-smi && nvidia-smi -L >/dev/null 2>&1; then
    return 0
  fi

  if command_exists lspci && lspci | grep -Eqi '(vga|3d|display).*nvidia'; then
    return 0
  fi

  return 1
}

ensure_docker_access() {
  command_exists docker || die "docker не найден. Установите Docker на сервере."
  docker info >/dev/null 2>&1 || die "Нет доступа к Docker daemon от текущего пользователя."
  docker compose version >/dev/null 2>&1 || die "docker compose plugin не найден."
}

main() {
  cd "${REPO_ROOT}"
  ensure_docker_access

  APP_HOST="$(normalize_host "${APP_HOST}")"
  local api_url
  local frontend_url
  api_url="$(build_url "${API_SCHEME}" "${APP_HOST}" "${API_PORT}")"
  frontend_url="$(build_url "${FRONTEND_SCHEME}" "${APP_HOST}" "${FRONTEND_PORT}")"

  ensure_env_files "${api_url}" "${frontend_url}"

  local compose_files=(
    -f "${REPO_ROOT}/docker-compose.yml"
    -f "${REPO_ROOT}/deploy/linux/docker-compose.linux.yml"
  )

  if detect_nvidia_gpu && [[ -f "${GPU_COMPOSE_FILE}" ]]; then
    log "Detected NVIDIA GPU. Enabling docker-compose.gpu.yml"
    compose_files+=( -f "${GPU_COMPOSE_FILE}" )
  fi

  log "Starting deployment without sudo..."
  docker compose --env-file "${ROOT_ENV_FILE}" "${compose_files[@]}" up -d --build

  log "Done."
  log "Frontend: ${frontend_url}"
  log "API:      ${api_url}"
}

main "$@"
