---
name: db-migrations
description: Схема и миграции этого проекта на Cloudflare D1 (не Supabase): где правда о схеме, как накатывать изменения локально и на проде, как проверять и откатывать. Использовать при любом изменении таблиц или полей.
---

# Схема и миграции (D1)

База сайта — Cloudflare D1 `osdushor-db`. Supabase в аккаунте подключён, но этот
проект его не использует: RLS, политики и генерацию клиентских типов сюда не тащить.

## Где правда о схеме

- `worker/schema.sql` — DDL целиком, идемпотентный (`CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`).
- `worker/lib/bootstrap.ts` (`ensureSchema`) догоняет схему существующей базы при
  старте воркера: так добавлялись `athletes.sport_rank`, `athletes.notion_id`,
  таблица `competition_results`. Новую колонку в воркере без этого блока прод
  не увидит, пока не накатить SQL руками.
- Типы `worker/env.d.ts` пишутся руками; `@cloudflare/workers-types` только для API.

## Порядок изменения

1. Правите `worker/schema.sql` (для новых баз) и добавляете идемпотентную проверку
   в `bootstrap.ts` (для существующих): `PRAGMA table_info` → `ALTER TABLE ... ADD COLUMN`,
   если колонки нет. Пересоздание таблицы — крайняя мера.
2. Локально: `npm run db:init`, затем `npm run build:frontend` и `npm run dev:api`,
   проверить запросы вручную.
3. Прод: сначала `npm run db:init:remote`, потом `npm run deploy`. Обратный порядок
   даёт 500 на новом коде.
4. Проверка: `node node_modules/wrangler/bin/wrangler.js d1 execute osdushor-db --remote --json --command "SELECT ..."`.
5. Данные: `npm run results:import:remote` и `students:import:remote` идемпотентны,
   ключ — `notion_id` или ФИО+год. Перед первым прогоном — `--dry-run`.

## Правила безопасности данных

- Схема не содержит внешних ключей «каскадом» на удаление: `competition_results.athlete_id`
  ссылается на `athletes.id`, поэтому вставки спортсменов идут раньше результатов.
- Перед изменением, которое трогает существующие строки, сделать выгрузку:
  `wrangler d1 export osdushor-db --remote --output=backup.sql`.
- Down-миграций нет: откат = восстановление из `backup.sql` плюс деплой прежней версии.
- Персональные данные: полная дата рождения хранится только для блока «Сегодня день
  рождения» и никогда не попадает в публичное API. Новые поля проверять на это же.
