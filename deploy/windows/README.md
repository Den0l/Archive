# Windows Deployment

Папка `deploy/windows/` содержит установщик и сценарий развертывания для Windows.

## Что делает установщик

- Проверяет наличие Docker Desktop и Docker Compose v2.
- Создаёт/обновляет:
  - `.env.server`
  - `Backend/WebApi/.env.server`
- Настраивает URL, домен/хост, порты, имя приложения и базовые `env`.
- Поднимает контейнеры через `docker compose` в режиме `Production` для backend.

## Быстрый запуск

Из корня репозитория:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows\install.ps1
```

## Пример с доменом/URL

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows\install.ps1 `
  -HostName archive.example.com `
  -ApiScheme https `
  -FrontendScheme https `
  -ApiPort 443 `
  -FrontendPort 443 `
  -MarketplaceName "Архив"
```

## Полезные параметры

- `-HostName` — домен или IP для публичных URL.
- `-ApiScheme` / `-FrontendScheme` — `http` или `https`.
- `-ApiPort` / `-FrontendPort` — внешние порты.
- `-MarketplaceName` — название приложения.
- `-MySqlDatabase` / `-MySqlUser` — настройки БД.
- `-ForceRecreateEnv` — пересоздать env-файлы.
- `-SkipBuild` — не пересобирать образы.

## После первого запуска

1. Открой `Backend/WebApi/.env.server` и заполни SMTP и Yandex AI значения.
2. Перезапусти сервисы:

```powershell
docker compose --env-file .\.env.server -f .\docker-compose.yml -f .\deploy\windows\docker-compose.windows.yml up -d
```
