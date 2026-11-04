---
name: sites-deploy
description: Чеклист выкатки сайта ОСДЮШОР. Проект живёт на своём Cloudflare-аккаунте через wrangler, поэтому фиксирует порядок проверок до и после деплоя, где лежат секреты и что считается «готово». Использовать при любой публикации.
---

# Выкатка сайта

Сайт развёрнут в личном Cloudflare-аккаунте: воркер `osdushor`, D1 `osdushor-db`,
R2 `osdushor-files`, конфиг в `wrangler.toml`. Freebuff Sites здесь не используется;
порядок ниже — про `npm run deploy`. Если проект когда-нибудь переедет на Sites,
в конце есть отдельный блок.

## Перед деплоем

1. `npm run typecheck` — фронтенд и воркер (`tsc --noEmit` дважды).
2. `npm run build` — Vite-статика и esbuild-бандл воркера; падает раньше деплоя.
3. Проверить в workerd, а не только в Vite: `npm run dev:api` и `http://127.0.0.1:8787`
   (API, `/admin`, статика из `dist/`). Vite-прокси скрывает различия окружений.
4. Схему применить до кода: `npm run db:init:remote` — идемпотентный `worker/schema.sql`.
5. Секреты — только на сервере: `SETUP_TOKEN`, `NOTION_TOKEN`, `TURNSTILE_SECRET`
   через `wrangler secret put`. Локально — `.dev.vars`, файл в `.gitignore`,
   в бандл и в git не попадает.

## Деплой

`npm run deploy` = сборка + `wrangler deploy`. Сохранить Version ID из вывода:
по нему потом сверять, что именно работает.

## После деплоя — проверить, иначе «готово» не считается

- Главная отдаёт HTML с мета-тегами (признак, что `dist/` не пустой).
- `GET /api/archive`, `/api/competitions/<slug>`, `/api/athletes/<id>`,
  `/api/birthdays` — 200 и ожидаемая форма ответа.
- Страницы с данными: `/rezultaty`, `/kalendar/<slug>`, `/sportsmeny/<id>` —
  строки видны, нет заглушек «Результаты готовятся к публикации» там, где данные есть.
- `/admin/login` открывается, вход работает; мутация с чужим `Origin` → 403.
- `/sitemap.xml`, `/robots.txt` отдают свежие записи.
- `wrangler tail` при проверке — без ошибок в логах воркера.

## Если проект переедет на Freebuff Sites

`npm run build:worker` даёт готовый ES-модуль, но манифесту нужен путь и ассеты:
`{entrypoint, compatibilityDate, modules:[{name,type:"esm",path}], assetsDirectory}`.
Перед первым деплоем — прогон в локальном workerd, проверка D1/R2 биндингов,
секретов и авторизации, затем `sites_deploy` и отдельная проверка `published`:
успешный деплой сам по себе публикацией не является. Пока сайт на своём аккаунте,
этот блок не применять.
