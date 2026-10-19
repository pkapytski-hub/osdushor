# Публикация на Cloudflare: чек-лист

Все команды выполняются из корня проекта. Пункты помечаются `[x]` по мере
выполнения. Порядок важен: `APP_ORIGIN` должен быть задан до первого деплоя —
он входит в список разрешённых `Origin` для мутаций, определяет secure-флаг
кук и документируемые в README ссылки. Сайт всегда открывается через реальный
хост, поэтому публичный адрес и `APP_ORIGIN` обязаны совпадать.

## 0. Подготовка

- [ ] Node не старше требуемого: `node -v` (нужен `>=22.12.0`).
- [ ] Вход в Cloudflare: `npx wrangler login`.
- [ ] Узнать поддомен аккаунта: `npx wrangler whoami` — в выводе будет строка
      вида `osdushor.<subdomain>.workers.dev`.
- [ ] Включить `workers.dev` для аккаунта (Cloudflare Dashboard → Workers & Pages
      → Settings → Workers & Pages → включить), иначе деплой не публикует URL.
- [ ] Прописать `APP_ORIGIN` в `wrangler.toml` `[vars]` — сейчас там заглушка
      `https://osdushor.<subdomain>.workers.dev`. Замените `<subdomain>` на
      реальный поддомен либо на свой домен (см. раздел 5). Значение — без слэша.
- [ ] Локальная сборка зелёная: `npm ci && npm run typecheck && npm run build`.

## 1. Ресурсы: D1 и R2

- [ ] `npx wrangler d1 create osdushor-db` — выведет `database_id`;
      вставьте его в `wrangler.toml` вместо заглушечного UUID в блоке
      `[[d1_databases]]`.
- [ ] `npx wrangler r2 bucket create osdushor-files`.
- [ ] Проверить, что в `wrangler.toml` блоки совпадают с созданным:
      биндинги `DB` и `FILES`, имена `osdushor-db` / `osdushor-files`.
- [ ] Применить схему: `npm run db:init:remote`.
- [ ] Проверка: `npx wrangler d1 execute osdushor-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"` —
      должны быть таблицы `news`, `staff`, `sessions`, `site_settings` и остальные.

## 2. Переменные и секреты

- [ ] `[vars]` в `wrangler.toml`: `APP_ORIGIN` — реальный origin без слэша,
      `ENVIRONMENT = "production"`.
- [ ] `DEMO_DATA` на проде **не задавать** (демо-данные и предупреждения
      выключены по умолчанию).
- [ ] Создать одноразовый код первого администратора:

      ```sh
      node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
      npx wrangler secret put SETUP_TOKEN     # вставить код из предыдущей команды
      ```

- [ ] Убедиться, что `.dev.vars` не копируется на прод — он в `.gitignore` и
      на Cloudflare не загружается.

## 3. Деплой

- [ ] Пробная сборка без публикации: `npm run deploy:dry` — проверяет конфиг
      wrangler и собирает бандл, ничего не выкладывает.
- [ ] Публикация: `npm run deploy`.
- [ ] Записать фактический URL из вывода деплоя
      (`https://osdushor.<subdomain>.workers.dev`).

## 4. Проверки после деплоя

Замените `$ORIGIN` на реальный origin.

- [ ] `curl $ORIGIN/healthz` → `{"status":"ok"}`.
- [ ] Заголовки кеша:

      ```sh
      curl -sI "$ORIGIN/assets/"$(ls dist/assets | grep '^vendor-react' | head -1) | grep -i cache-control
      # → cache-control: public, max-age=31536000, immutable
      curl -sI "$ORIGIN/trenery" | grep -i cache-control
      # → cache-control: no-cache
      ```

- [ ] Canonical и Open Graph выстроены по тому хосту, с которого открыли сайт:
      убедитесь, что сайт открывается по публичному адресу из `APP_ORIGIN`,
      а не по `*.workers.dev`, если домен уже подключён.
- [ ] `/robots.txt` и `/sitemap.xml` отдаются и содержат `$ORIGIN`.
- [ ] Без куки `/api/auth/me` → 200 с `user: null`; `/api/admin/settings` → 401.
- [ ] Мутации с чужим `Origin` отклоняются: `POST $ORIGIN/api/auth/login` с
      `Origin: https://evil.example` и заголовком `x-csrf: 1` → 403 `origin_rejected`.
      (Форма обратной связи Origin не проверяет — она защищена honeypot-полем
      и ограничением частоты, см. `submitFeedback`.)
- [ ] `/admin/setup` — создать первого администратора кодом из `SETUP_TOKEN`.
- [ ] После успешной настройки удалить секрет: `npx wrangler secret delete SETUP_TOKEN`.
- [ ] Вход на `/admin/login` с новыми учетными данными работает.
- [ ] Демо-данные отсутствуют (записи с `is_demo` не показываются); если накатывались
      локально — кнопка удаления демо есть на дашборде.
- [ ] Дашборд: заполнить обязательные поля настроек (адреса, телефоны, режим
      работы, реквизиты).
- [ ] Отправить тестовое обращение через форму обратной связи, проверить его
      в `/admin/messages`.
- [ ] `/admin` и `/api` закрыты в `robots.txt`, страницы админки с `noindex`.
- [ ] Кеширование ассетов в браузере: после первого визита повторное открытие
      страницы берёт `vendor-react` из кеша (`transferSize: 0` в
      DevTools → Network → transferSize).

## 5. Свой домен (когда зона будет привязана)

- [ ] Привязать зону к аккаунту Cloudflare (DNS уже на Cloudflare — упрощает).
- [ ] В `wrangler.toml` раскомментировать блок `[[routes]]` и подставить домен:

      ```toml
      [[routes]]
      pattern = "osdushor.by"
      custom_domain = true
      ```

- [ ] **Одновременно** заменить `APP_ORIGIN` на `https://osdushor.by` — оба
      значения обязаны совпадать, иначе проверка Origin начнёт отклонять
      собственные запросы, а canonical укажет на workers.dev.
- [ ] `npm run deploy` и повторить проверки раздела 4 на новом origin.
- [ ] Решить судьбу временного адреса: закрыть `workers_dev` (в `wrangler.toml`
      `workers_dev = false`) либо оставить как резервный.

## Типовые проблемы

| Симптом | Причина |
| --- | --- |
| Deploy падает с ошибкой по D1 | `database_id` не заменён после `wrangler d1 create` |
| `setup_unavailable` (503) на `/admin/setup` | секрет `SETUP_TOKEN` не задан |
| Обычные POST получают 403 `origin_rejected` | запрос пришёл на один хост, а заголовок `Origin` — другой (прокси, зеркало, неверный `APP_ORIGIN` в такой цепочке) |
| Secure-куки не ставятся, сессия «слетает» | `ENVIRONMENT` не `production` и `APP_ORIGIN` без `https://` |
| Canonical и sitemap ведут на другой хост | сайт открыт по другому адресу (например, по workers.dev вместо основного домена) |
| На проде видны демо-записи и предупреждение | задан `DEMO_DATA=true` — удалите переменную |
| URL деплоя недоступен | `workers.dev` выключен для аккаунта |
