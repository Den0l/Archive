#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

OUTPUT_FILE="${SCRIPT_DIR}/dist/archiveweb-offline-installer.tar.gz"
IMAGES_ASSET_FILE="${SCRIPT_DIR}/dist/archiveweb-images.tar.gz"
SKIP_BUILD=0
API_BASE_URL="http://localhost:7192"
MARKETPLACE_NAME="Архив"
TARGET_DIR_ON_SERVER="/opt/archiveweb"

print_usage() {
  cat <<'USAGE'
Usage:
  ./deploy/linux/create-offline-bundle.sh [options]

Options:
  --api-base-url <url>      API URL used at frontend build time (default: http://localhost:7192)
  --marketplace-name <name> Public marketplace name (default: Архив)
  --output <path>           Output archive path
  --images-output <path>    Output images archive path
  --target-dir <path>       Target directory for SSH deployment hint (default: /opt/archiveweb)
  --skip-build              Skip image build/pull and package existing local images
  --help                    Show this help
USAGE
}

log() {
  printf '[bundle] %s\n' "$1"
}

die() {
  printf '[bundle] error: %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

compose_exec() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if command_exists docker-compose; then
    docker-compose "$@"
    return
  fi

  die "Docker Compose is not installed."
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --api-base-url)
        API_BASE_URL="${2:-}"
        shift 2
        ;;
      --marketplace-name)
        MARKETPLACE_NAME="${2:-}"
        shift 2
        ;;
      --output)
        OUTPUT_FILE="${2:-}"
        shift 2
        ;;
      --target-dir)
        TARGET_DIR_ON_SERVER="${2:-}"
        shift 2
        ;;
      --images-output)
        IMAGES_ASSET_FILE="${2:-}"
        shift 2
        ;;
      --skip-build)
        SKIP_BUILD=1
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
  [[ -n "${API_BASE_URL}" ]] || die "--api-base-url cannot be empty"
  [[ -n "${MARKETPLACE_NAME}" ]] || die "--marketplace-name cannot be empty"
  [[ -n "${OUTPUT_FILE}" ]] || die "--output cannot be empty"
  [[ -n "${IMAGES_ASSET_FILE}" ]] || die "--images-output cannot be empty"
}

ensure_requirements() {
  command_exists docker || die "Docker is not installed."
  command_exists tar || die "tar is not installed."
  command_exists gzip || die "gzip is not installed."
  [[ -f "${REPO_ROOT}/docker-compose.yml" ]] || die "docker-compose.yml not found in ${REPO_ROOT}"
  [[ -f "${SCRIPT_DIR}/docker-compose.linux.yml" ]] || die "Missing ${SCRIPT_DIR}/docker-compose.linux.yml"
  [[ -f "${SCRIPT_DIR}/docker-compose.offline.yml" ]] || die "Missing ${SCRIPT_DIR}/docker-compose.offline.yml"
  [[ -f "${SCRIPT_DIR}/install.sh" ]] || die "Missing ${SCRIPT_DIR}/install.sh"
}

build_images_if_needed() {
  if [[ "${SKIP_BUILD}" -eq 1 ]]; then
    log "Skipping image build as requested."
    return
  fi

  log "Building project images (db, backend, frontend)..."
  local temp_env
  temp_env="$(mktemp)"
  cat > "${temp_env}" <<EOF
NEXT_PUBLIC_API_BASE_URL=${API_BASE_URL}
NEXT_PUBLIC_MARKETPLACE_NAME=${MARKETPLACE_NAME}
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_ROOT_PASSWORD=tempRoot
MYSQL_DATABASE=marketplaceDocker
MYSQL_USER=testUserDocker
MYSQL_PASSWORD=tempUserPass
FRONTEND_BASE_URL=http://localhost:3000
Rembg__TimeoutSeconds=120
MARKETPLACE_NAME=${MARKETPLACE_NAME}
EOF

  compose_exec \
    --env-file "${temp_env}" \
    -f "${REPO_ROOT}/docker-compose.yml" \
    -f "${SCRIPT_DIR}/docker-compose.linux.yml" \
    build db backend frontend

  rm -f "${temp_env}"

  log "Pulling third-party images (phpmyadmin, rembg)..."
  docker pull phpmyadmin/phpmyadmin:latest
  docker pull danielgatis/rembg:2.0.75
}

create_bundle() {
  local output_abs
  local output_dir
  local images_abs
  local images_dir

  output_dir="$(dirname "${OUTPUT_FILE}")"
  mkdir -p "${output_dir}"
  output_abs="$(cd "${output_dir}" && pwd)/$(basename "${OUTPUT_FILE}")"

  images_dir="$(dirname "${IMAGES_ASSET_FILE}")"
  mkdir -p "${images_dir}"
  images_abs="$(cd "${images_dir}" && pwd)/$(basename "${IMAGES_ASSET_FILE}")"

  log "Packing docker images into ${images_abs} ..."
  docker image save \
    marketplace-db:latest \
    marketplace-backend:latest \
    marketplace-frontend:latest \
    phpmyadmin/phpmyadmin:latest \
    danielgatis/rembg:2.0.75 | gzip > "${images_abs}"

  local temp_root
  temp_root="$(mktemp -d)"
  mkdir -p "${temp_root}/deploy/linux"

  cp "${SCRIPT_DIR}/install.sh" "${temp_root}/deploy/linux/install.sh"
  cp "${SCRIPT_DIR}/docker-compose.offline.yml" "${temp_root}/deploy/linux/docker-compose.offline.yml"
  cp "${SCRIPT_DIR}/README.md" "${temp_root}/deploy/linux/README.md"
  cp "${images_abs}" "${temp_root}/deploy/linux/images.tar.gz"

  log "Creating installer archive ${output_abs}"
  tar -czf "${output_abs}" -C "${temp_root}" .

  rm -rf "${temp_root}"

  log "Offline installer created: ${output_abs}"
  log "Images archive created: ${images_abs}"
  log "One-SSH deploy command:"
  printf "cat '%s' | ssh <user>@<server> 'mkdir -p %s && tar -xzf - -C %s && cd %s && bash deploy/linux/install.sh --offline --host <server-ip-or-domain>'\\n" \
    "${output_abs}" \
    "${TARGET_DIR_ON_SERVER}" \
    "${TARGET_DIR_ON_SERVER}" \
    "${TARGET_DIR_ON_SERVER}"
}

main() {
  parse_args "$@"
  validate_args
  ensure_requirements
  build_images_if_needed
  create_bundle
}

main "$@"
