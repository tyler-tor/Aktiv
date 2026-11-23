# Aktiv modernization - change log

This file explains every change made on the `modernize` branch, item by item, in the
same numbering as `MODERNIZATION_PLAN.md`. Each section says what was wrong, what
changed, which files were touched, how to check it yourself, and what to keep an eye on.

**Batch 1 (security & bug fixes): A1 - A15.** These keep the current stack
(Flask 2.0 / SQLAlchemy 1.4 / Create React App). Stack upgrades are Batch 2.

## Deviations from plan

_None yet._

## Open questions for Tyler

_None yet._

---

## A1 — Rotate and remove the committed `SECRET_KEY`
- **Problem:** `.env.example` contained a real-looking 68-character `SECRET_KEY`. Flask uses this key to sign the session cookie (the cookie that says "this browser is logged in as user 3") and the CSRF token. Anyone who copied the example file to `.env` (or deployed with it) was using a key that is public on GitHub, so an attacker could forge a session cookie and log in as any user, including you. The value is also in git history, so it must be treated as burned forever.
- **What changed:**
  - `.env.example` now says `SECRET_KEY=change-me` with a comment showing how to generate a real key.
  - `app/config.py` has a new `check_secret_key()` function. `app/__init__.py` calls it right after loading the config. In production (`FLASK_ENV=production`) the app **refuses to start** (raises `RuntimeError`) if `SECRET_KEY` is missing or is a known placeholder (`change-me`, `secret`, ...). In development it only prints a warning so local work is not blocked.
  - `.gitignore` now ignores every `.env.*` file (e.g. `.env.production`, `.env.local`) except `.env.example`, so a filled-in env file cannot be committed by accident. (`*.db` is added in A2.)
  - Git history was **not** rewritten (as instructed). The old key is simply never used again.
- **Files:** `.env.example`, `app/config.py`, `app/__init__.py`, `.gitignore`
- **How to verify:**
  1. Generate your own key and put it in your local `.env` (never commit it):
     `python -c "import secrets; print(secrets.token_hex(32))"` and paste the output after `SECRET_KEY=` in `.env`. Use a **different** key for each environment (local, production).
  2. `SECRET_KEY=change-me FLASK_ENV=production python -c "import app"` -> fails with `RuntimeError: SECRET_KEY is missing or is a placeholder...`.
  3. `SECRET_KEY=<your key> FLASK_ENV=development flask run` -> starts normally.
  4. `git check-ignore -v .env.production` -> shows it is ignored; `git check-ignore .env.example` -> prints nothing (still tracked).
- **Things to watch / follow-ups:**
  - Rotating the key logs out every existing session (old cookies no longer verify). That is expected.
  - If the old key was ever used on a live deployment (Render/Heroku), set a new one there too.
  - A11 later renames `FLASK_ENV` to `APP_ENV`; the production check follows that change. A45 (later batch) moves production secrets into AWS SSM Parameter Store.
