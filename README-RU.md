# Agent Dashboard для Claude Code

### Платформа мониторинга активности Claude Code агентов в режиме реального времени 🚀

Профессиональный дашборд для отслеживания и визуализации сессий Claude Code агентов, использования инструментов и оркестрации субагентов в реальном времени. Построен на Node.js, Express, React и SQLite, интегрируется напрямую с Claude Code через нативную систему хуков для бесшовного отслеживания сессий и аналитики.

![Claude Code](https://img.shields.io/badge/Claude_Code-orange?style=flat-square&logo=claude&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-RFC_6455-010101?style=flat-square&logo=socketdotio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-20.10-2496ED?style=flat-square&logo=docker&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

**Языки / Language Support**: [English](./README.md) · [中文](./README-CN.md) · [Tiếng Việt](./README-VN.md) · [한국어](./README-KO.md) · **Русский**

---

## Содержание

- [Обзор](#обзор)
- [Возможности](#возможности)
- [Быстрый старт](#быстрый-старт)
- [Как это работает](#как-это-работает)
- [Конфигурация](#конфигурация)
- [npm Скрипты](#npm-скрипты)
- [MCP Интеграция](#mcp-интеграция)
- [API](#api)
- [Хук-события](#хук-события)
- [Уведомления браузера](#уведомления-браузера)
- [VS Code Расширение](#vs-code-расширение)
- [Десктопное приложение](#десктопное-приложение-macos-и-windows)
- [Хранение данных](#хранение-данных)
- [Развёртывание](#развёртывание)
- [Структура проекта](#структура-проекта)
- [Устранение неполадок](#устранение-неполадок)
- [Участие в разработке](#участие-в-разработке)
- [Лицензия](#лицензия)

---

## Обзор

Отслеживайте сессии, мониторьте агентов в реальном времени, визуализируйте использование инструментов и наблюдайте за оркестрацией субагентов через профессиональный веб-интерфейс с тёмной темой. Интегрируется напрямую с Claude Code через нативную систему хуков.

---

## Возможности

- **Мониторинг сессий в реальном времени** — отслеживание активных, ожидающих, завершённых и заброшенных сессий
- **Аналитика агентов** — иерархия агентов, статусы, использование инструментов и затраты
- **Kanban-доска** — агенты и сессии, сгруппированные по статусу (работает / ожидает / завершён / ошибка)
- **Просмотр диалогов** — живой просмотр транскриптов с рендерингом Markdown и подсветкой кода
- **Временная шкала событий** — хронологическая лента событий с многомерной фильтрацией
- **Аналитика токенов** — статистика входных/выходных токенов, кэша и стоимости по моделям
- **WebSocket трансляции** — обновления UI в реальном времени без перезагрузки страницы
- **MCP Сервер** — каталог инструментов для интроспекции дашборда прямо из Claude Code
- **VS Code Расширение** — просмотр активных сессий прямо в редакторе
- **Десктопное приложение** — нативные приложения для macOS (Universal DMG) и Windows (NSIS)
- **Docker** — контейнерное развёртывание через docker-compose
- **OpenAPI / Swagger** — полная документация REST API
- **Фильтр директорий** — исключение приватных путей через `MONITOR_IGNORE_CWD`
- **Tabby** — симпатичный кот-компаньон в интерфейсе 🐱

---

## Быстрый старт

### Требования

- Node.js ≥ 18 (рекомендуется 22+ для нативного SQLite)
- npm ≥ 9
- Claude Code установлен и настроен

### Установка

```bash
git clone https://github.com/hoangsonww/Claude-Code-Agent-Monitor.git
cd Claude-Code-Agent-Monitor
npm install
npm run build
npm start
```

Дашборд доступен по адресу **http://localhost:4820**.

### Docker

```bash
docker-compose up -d
```

### Настройка хуков

Добавьте в `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse":   [{ "command": "node /path/to/Claude-Code-Agent-Monitor/bin/hook.js" }],
    "PostToolUse":  [{ "command": "node /path/to/Claude-Code-Agent-Monitor/bin/hook.js" }],
    "Stop":         [{ "command": "node /path/to/Claude-Code-Agent-Monitor/bin/hook.js" }],
    "SessionStart": [{ "command": "node /path/to/Claude-Code-Agent-Monitor/bin/hook.js" }],
    "SessionEnd":   [{ "command": "node /path/to/Claude-Code-Agent-Monitor/bin/hook.js" }],
    "Notification": [{ "command": "node /path/to/Claude-Code-Agent-Monitor/bin/hook.js" }]
  }
}
```

---

## Как это работает

1. **Claude Code** запускает хук при каждом событии (использование инструмента, остановка, начало сессии и т.д.)
2. **Скрипт хука** (`bin/hook.js`) отправляет HTTP POST на сервер дашборда
3. **Express сервер** сохраняет данные в SQLite и транслирует обновления через WebSocket
4. **React UI** обновляется мгновенно через WebSocket соединение

---

## Конфигурация

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

### Основные переменные

| Переменная | По умолчанию | Описание |
|---|---|---|
| `DASHBOARD_PORT` | `4820` | Порт HTTP сервера |
| `DASHBOARD_HOST` | `127.0.0.1` | Сетевой интерфейс |
| `DASHBOARD_TOKEN` | — | Bearer-токен для аутентификации API |
| `CLAUDE_HOME` | `~/.claude` | Путь к данным Claude Code |
| `DASHBOARD_STALE_MINUTES` | `180` | Порог заброшенности сессии (мин) |
| `MONITOR_IGNORE_CWD` | — | Паттерны директорий для исключения |

### Фильтрация директорий (MONITOR_IGNORE_CWD)

Если вы работаете в приватных директориях, укажите их в `MONITOR_IGNORE_CWD`:

```bash
# Точное совпадение
MONITOR_IGNORE_CWD=/home/user/private

# Прямые дочерние директории
MONITOR_IGNORE_CWD=/home/user/work/*

# Рекурсивно (все вложенные)
MONITOR_IGNORE_CWD=/home/user/scratch/**

# Несколько паттернов через запятую
MONITOR_IGNORE_CWD=/home/user/private,/home/user/scratch/**,/tmp/*
```

Хук-события из игнорируемых директорий отбрасываются **до записи в БД** — они никогда не появятся в интерфейсе или аналитике. Сервер отвечает `200 OK` с `{ "ok": true, "ignored": true }`, чтобы Claude Code не делал повторных попыток.

> **Важно:** по умолчанию сервер привязан к `127.0.0.1`. При открытии сетевого доступа обязательно установите `DASHBOARD_TOKEN`.

---

## npm Скрипты

| Скрипт | Описание |
|---|---|
| `npm start` | Запустить продакшн сервер |
| `npm run dev` | Dev режим с горячей перезагрузкой |
| `npm run build` | Собрать клиент |
| `npm test` | Запустить тесты (Vitest) |
| `npm run lint` | Проверить код ESLint |
| `npm run format` | Форматировать Prettier |

---

## MCP Интеграция

Дашборд включает MCP сервер в директории `mcp/`:

```json
{
  "mcpServers": {
    "agent-dashboard": {
      "command": "node",
      "args": ["/path/to/Claude-Code-Agent-Monitor/mcp/server.js"]
    }
  }
}
```

---

## API

Swagger UI: **http://localhost:4820/api-docs**

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/sessions` | Список сессий с пагинацией |
| `GET` | `/api/sessions/:id` | Детали сессии |
| `GET` | `/api/analytics` | Агрегированная статистика |
| `GET` | `/api/stats` | Сводная статистика |
| `POST` | `/api/hooks/event` | Приём хук-событий |
| `WebSocket` | `ws://localhost:4820` | Real-time трансляция |

---

## Хук-события

| Тип | Описание |
|---|---|
| `PreToolUse` | Начало использования инструмента |
| `PostToolUse` | Завершение вызова инструмента |
| `Stop` | Агент завершил ответ |
| `SubagentStop` | Субагент завершил работу |
| `SessionStart` | Начало сессии |
| `SessionEnd` | Завершение сессии |
| `Notification` | Системное уведомление |
| `UserPromptSubmit` | Пользователь отправил промпт |

---

## Уведомления браузера

Поддерживается Web Push API (VAPID):

```bash
npx web-push generate-vapid-keys
```

Добавьте ключи в `.env` и разрешите уведомления в браузере через кнопку в интерфейсе.

---

## VS Code Расширение

```bash
cd vscode-extension
npm install
npm run package
# Установить .vsix: Extensions → Install from VSIX
```

---

## Десктопное приложение (macOS и Windows)

```bash
cd desktop
npm install

npm run build:mac   # Universal DMG (arm64 + x64)
npm run build:win   # NSIS installer + portable
```

Готовые релизы: [GitHub Releases](https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases)

---

## Хранение данных

| | Описание |
|---|---|
| По умолчанию | `~/.claude-monitor/data/dashboard.db` |
| `DASHBOARD_DATA_DIR` | Переопределение директории |
| `DASHBOARD_DB_PATH` | Полный путь к файлу БД |

---

## Развёртывание

```bash
# Docker Compose
docker-compose up -d

# Helm
helm install agent-monitor deployments/helm/

# Kustomize
kubectl apply -k deployments/kustomize/
```

Подробнее: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Структура проекта

```
Claude-Code-Agent-Monitor/
├── bin/                # Скрипты хуков и CLI
├── client/             # React + TypeScript + Vite
│   └── src/
│       ├── components/ # React компоненты
│       ├── pages/      # Страницы
│       └── locales/    # Переводы (i18n)
├── server/             # Express + SQLite
│   ├── routes/         # REST API
│   └── lib/            # Вспомогательные модули
├── mcp/                # MCP сервер
├── desktop/            # Electron приложение
├── vscode-extension/   # VS Code расширение
├── scripts/            # Утилиты
├── deployments/        # Docker, Kubernetes, Helm
└── docs/               # Документация
```

---

## Устранение неполадок

### Хуки не отправляют данные

```bash
curl http://localhost:4820/api/health
```

Проверьте пути в `~/.claude/settings.json` и логи сервера.

### Ошибка SQLite при запуске

```
Error: better-sqlite3 could not be loaded
```

- **Вариант 1:** обновите Node.js до 22+
- **Вариант 2:** `npm rebuild better-sqlite3`

### Порт занят

```bash
lsof -i :4820                # macOS/Linux
DASHBOARD_PORT=5000 npm start
```

### Данные не появляются

Проверьте, не попадает ли рабочая директория под `MONITOR_IGNORE_CWD` в `.env`.

---

## Участие в разработке

```bash
gh repo fork hoangsonww/Claude-Code-Agent-Monitor
git checkout -b feat/ваша-фича
npm install && npm run dev
npm test && npm run lint
gh pr create
```

Хорошие задачи для начала:
- Переводы UI (`client/src/locales/`)
- Новые фильтры и параметры API
- Улучшение документации

[Открытые issues](https://github.com/hoangsonww/Claude-Code-Agent-Monitor/issues)

---

## Лицензия

[MIT License](./LICENSE)

---

<p align="center">
  Сделано с ❤️ сообществом Claude Code<br>
  <a href="./README.md">English</a> ·
  <a href="./README-CN.md">中文</a> ·
  <a href="./README-VN.md">Tiếng Việt</a> ·
  <a href="./README-KO.md">한국어</a> ·
  <strong>Русский</strong>
</p>
