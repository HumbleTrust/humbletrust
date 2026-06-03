# /super-audit — HumbleTrust Security & Quality Super-Agent

Запускает полный цикл аудита + исправления кодовой базы HumbleTrust до идеального состояния.

## Что делает

1. **7 параллельных аудит-агентов** — каждый проверяет свой слой:
   - Angle A: Безопасность API (auth, SQL injection, secrets, rate limits)
   - Angle B: Frontend security (hardcoded keys, XSS, auth race conditions)
   - Angle C: Контракт API↔Frontend (несоответствие типов, недостающие поля)
   - Angle D: Solana/blockchain корректность (lamports, slippage, Token-2022)
   - Angle E: Auth, API keys, trust score логика
   - Angle F: DB schema vs code (неверные имена колонок, отсутствующие таблицы)
   - Angle G: Silent errors, removed guards, dead code

2. **Супер-агент-синтезатор** — верифицирует все находки, убирает дубли, ранжирует

3. **Агент-исправитель** — применяет все фиксы, делает syntax check, пушит

## Как запускать

```
/super-audit
```

Или с конкретным фокусом:
```
/super-audit security    # только безопасность
/super-audit schema      # только схема БД vs код
/super-audit frontend    # только фронтенд
/super-audit solana      # только Solana/blockchain
```

## Инструкция для агента

При вызове этого скилла:

### Шаг 1 — Запусти 7 агентов параллельно (все в фоне)

Каждый агент читает свой набор файлов и возвращает JSON: `[{file, line, summary, failure_scenario}]`

**Angle A (API security):**
Файлы: `api/_lib/`, `api/tokens/[...path].js`, `api/stripe/[action].js`, `api/badges/[action].js`, `api/keys/index.js`
Проверяет: auth bypass, injection, secrets, race conditions, CORS

**Angle B (Frontend security):**
Файлы: `web/src/lib/supabase.ts`, `web/src/lib/useAuth.ts`, `web/src/lib/solana/program.ts`, `web/src/lib/solana/rpc.ts`, `web/src/app/pages/TradePage.tsx`, `web/src/app/pages/LaunchPage.tsx`
Проверяет: hardcoded secrets, XSS, wallet tx без подтверждения, NaN в суммах

**Angle C (API↔Frontend contract):**
Файлы: `web/src/lib/solana/api.ts` + все API routes
Проверяет: поля которые фронт ожидает но API не отдаёт, неверные типы

**Angle D (Solana/blockchain):**
Файлы: `web/src/lib/solana/`, `web/src/app/pages/TradePage.tsx`, `web/src/app/pages/LaunchPage.tsx`
Проверяет: lamports vs SOL, slippage, Token-2022, confirmTransaction, PDA

**Angle E (Auth & keys):**
Файлы: `api/_lib/apiKey.js`, `api/_lib/trust.js`, `api/_lib/validate.js`, `api/keys/index.js`
Проверяет: rate limit atomicity, key hash storage, plan enforcement

**Angle F (DB schema vs code):**
Файлы: `supabase/migrations/` (все), `api/score/[mint].js`, `api/tokens/[...path].js`
Проверяет: имена колонок в INSERT/SELECT/UPDATE совпадают со схемой

**Angle G (Silent errors):**
Файлы: `web/src/app/pages/`, `api/tokens/[...path].js`, `api/badges/[action].js`
Проверяет: `.catch(() => {})`, проглоченные ошибки, удалённые guards

### Шаг 2 — Синтез (синхронно, после получения всех результатов)

- Дедупликация (одна проблема = одна запись)
- Ранжирование: CRITICAL > HIGH > MEDIUM > LOW
- Верификация: CONFIRMED / PLAUSIBLE / REFUTED

### Шаг 3 — Исправление

Для каждой CRITICAL и HIGH находки:
1. Прочитай точный код вокруг проблемы
2. Примени минимальный точный фикс
3. Проверь синтаксис: `node --check <file>`

### Шаг 4 — Коммит и пуш

```bash
cd /home/user/humbletrust
git add -A
git commit -m "fix(audit): [краткое описание что исправлено]

https://claude.ai/code/session_01PQNfLMrMKaAqUwRrzeYCiY"
git push -u origin main
```

### Шаг 5 — Финальная проверка

После пуша запусти CI check и убедись что:
- `api/` syntax check проходит
- Нет новых регрессий

## Известные постоянные правила (никогда не нарушать)

- SUPABASE_KEY (service role) — только в env, никогда в коде
- VITE_SUPABASE_ANON — только через Vite env, не hardcode
- Все сравнения секретов — через `crypto.timingSafeEqual`
- Rate limit fail-closed: при ошибке БД → blocked, не allowed
- POST эндпоинты с записью в БД — всегда требуют auth
- `token_health_events` колонка: `details` (не `data`)
- `api_usage` колонка: `created_at` (не `ts`)
- `score_history` колонки: `mint, score, trust_level, recorded_at`
- `token_score_cache` колонка: `components` (не `score_components`)
