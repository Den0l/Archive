# Linux Deployment

Директория `deploy/linux/` содержит:
- `install.sh` — основной установщик, работает даже как одиночный файл
- `create-offline-bundle.sh` — сборка офлайн-набора с Docker-образами
- `docker-compose.linux.yml` — repo-override (сборка из исходников)
- `docker-compose.offline.yml` — запуск только из готовых образов

## Одиночный install.sh + GitHub fallback

Можно запускать только `install.sh` на пустом сервере.

Пример:

```bash
bash install.sh \
  --offline \
  --github-repo <owner>/<repo> \
  --host <server-ip-or-domain>
```

Что будет делать скрипт:
- если рядом нет compose-файлов, скачает их из GitHub (`raw`)
- если нет архива образов, попробует скачать релиз-ассеты:
  - `archiveweb-images.tar.gz`
  - или `archiveweb-offline-installer.tar.gz` (и извлечёт из него `images.tar.gz`)
- если GitHub недоступен, сгенерирует встроенный `offline compose` из самого скрипта

## Пустой сервер + один SSH (рекомендуется)

1. Локально собери офлайн-артефакты (без копирования всего репозитория):

```bash
chmod +x deploy/linux/create-offline-bundle.sh deploy/linux/install.sh
./deploy/linux/create-offline-bundle.sh \
  --api-base-url http://<server-ip-or-domain>:7192 \
  --marketplace-name "Архив"
```

Итоговый файл:
- `deploy/linux/dist/archiveweb-offline-installer.tar.gz`
- `deploy/linux/dist/archiveweb-images.tar.gz`

2. Отправь и разверни одним SSH:

```bash
cat deploy/linux/dist/archiveweb-offline-installer.tar.gz | ssh <user>@<server> \
  'mkdir -p /opt/archiveweb && tar -xzf - -C /opt/archiveweb && cd /opt/archiveweb && bash deploy/linux/install.sh --offline --host <server-ip-or-domain>'
```

Этот сценарий не требует переносить исходники проекта (включая тяжёлые папки).

## Режим из репозитория (build from source)

Если репозиторий уже на сервере:

```bash
bash deploy/linux/install.sh --host <server-ip-or-domain>
```

## Что создаёт install.sh

- `.env.server`
- `Backend/WebApi/.env.server` (repo mode) или `backend.env.server` (offline mode)

После первого запуска обнови SMTP/Yandex AI значения в сгенерированном backend env-файле.
