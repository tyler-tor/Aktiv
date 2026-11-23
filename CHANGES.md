# Aktiv modernization - change log

This file explains every change made on the `modernize` branch, item by item, in the
same numbering as `MODERNIZATION_PLAN.md`. Each section says what was wrong, what
changed, which files were touched, how to check it yourself, and what to keep an eye on.

**Batch 1 (security & bug fixes): A1 - A15.** These keep the current stack
(Flask 2.0 / SQLAlchemy 1.4 / Create React App). Stack upgrades are Batch 2.

## Deviations from plan

- **A4 (sign-up picture):** the plan adds `@login_required` to `/api/img/upload`, but the sign-up page uploaded the profile picture *before* the account existed, so that would have broken sign-up pictures. Minimal fix: the sign-up page now uploads the picture right after the account is created and saves it via a new `PUT /api/auth/profile-picture` endpoint (accepts only URLs from your bucket's `uploads/` prefix).
- **Pipfile.lock not regenerated:** new Python packages (Pillow in A4, email-validator in A9) were added to both `requirements.txt` and `Pipfile`, but `Pipfile.lock` could not be re-locked here (no pipenv/Python 3.9). `pipenv install` will re-lock automatically, or run `pipenv lock`. A16 (later) removes the Pipfile entirely.

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

## A2 — Stop tracking `app/dev.db`
- **Problem:** The SQLite development database `app/dev.db` was committed. It contains the seeded users and their password hashes, causes merge conflicts whenever two people (or two branches) touch data, and hides "migration drift" (the committed DB can disagree with what the migrations would build).
- **What changed:** `git rm --cached app/dev.db` removes the file from git's index **only** - your local copy is still on disk and keeps working. `.gitignore` now ignores `*.db` and `*.sqlite3` so it cannot be re-added.
- **Files:** `app/dev.db` (untracked, not deleted), `.gitignore`
- **How to verify:**
  1. `ls app/dev.db` -> file still exists locally.
  2. `git ls-files app/dev.db` -> prints nothing (no longer tracked).
  3. `git check-ignore -v app/dev.db` -> shows the `*.db` rule.
  4. Fresh database from scratch: `rm app/dev.db; flask db upgrade; flask seed all`.
- **Things to watch / follow-ups:**
  - The file still exists in old commits (history not rewritten). It only holds seed data with the well-known demo password, so that is low risk.
  - Anyone who pulls this branch will see `app/dev.db` **deleted** from their working copy when git applies the removal. They just recreate it with `flask db upgrade && flask seed all`.
  - A38 (later batch) moves local development to Postgres in Docker.

## A3 — Ownership checks on update endpoints
- **Problem:** `PUT /api/routes/<id>` and `PUT /api/workouts/<id>` only checked that *someone* was logged in, never that the record belonged to them. Because the demo login is public, anyone on the internet could log in as the demo user and run e.g. `fetch('/api/routes/7', {method:'PUT', body: ...})` to rewrite another user's route. The handlers also did `route.set_kwargs(**form.data)`, which blindly copied **every** form field onto the model (including `csrf_token`), so any field added to the form later (say `user_id`) could have been used to re-assign records. A missing id crashed with a 500 (`NoneType has no attribute set_kwargs`).
- **What changed:**
  - Both update endpoints now load the record first: missing -> **404** `{"errors": ["Route not found"]}`; owned by someone else -> **403** `{"errors": ["You can only edit your own routes"]}`; only then is the form validated.
  - `Route` and `Workout` have an `EDITABLE_FIELDS` tuple (the columns a user may edit). `set_kwargs()` now ignores any key not in that list, and the endpoints only pass those fields. `user_id`, `id`, timestamps and `csrf_token` can never be changed through the API.
- **Files:** `app/api/route_routes.py`, `app/api/workout_routes.py`, `app/models/route.py`, `app/models/workout.py`
- **How to verify:** (log in as the demo user in the browser, then in the dev tools console - after A6 you also need the `X-CSRFToken` header)
  1. Find a route owned by another user (e.g. `GET /api/routes/` and pick one whose `userId` is not yours).
  2. `PUT /api/routes/<that id>` with a full JSON body -> **403**, and the route is unchanged.
  3. `PUT /api/routes/99999` -> **404**.
  4. `PUT` on your own route with `"user_id": 2` in the body -> **200**, the title changes but `userId` stays yours.
  5. Same three checks for `/api/workouts/<id>`.
  Verified with Flask's test client against a freshly seeded SQLite DB (all 8 checks passed).
- **Things to watch / follow-ups:**
  - Delete endpoints already checked ownership, but returned 200 with an error body when it failed; A8 fixes their status codes.
  - The frontend did not show these errors (missing `await` on `response.json()`); fixed in A8.
  - A50 (later batch) will turn these manual checks into automated tests.

## A4 — Secure the image upload endpoint
- **Problem:** `POST /api/img/upload` had no `@login_required`, no size limit and accepted PDFs. Anyone on the internet could script uploads of unlimited, arbitrarily large files into your S3 bucket at your cost. The type check only looked at the filename extension (`evil.html` renamed to `evil.jpg` passed) and stored the browser-supplied `Content-Type`, so a file could be served from your bucket as HTML. `get_unique_filename()` built `"<uuid>,<ext>"` with a **comma**, so files were stored as `abc123,jpg` (no real extension). URLs were returned as `http://`. Upload failures were silent in the UI.
- **What changed:**
  - `@login_required` on the endpoint (anonymous requests get the usual redirect to `/api/auth/unauthorized` -> 401).
  - `MAX_CONTENT_LENGTH = 5 MB` in `app/config.py`; bigger requests get a JSON **413** `{"errors": "File is too large (max 5 MB)"}` (new error handler in `app/__init__.py`).
  - Allowed types are png, jpg/jpeg, gif, webp (pdf removed). The bytes are opened with **Pillow** and `Image.verify()`; the S3 object's extension and `Content-Type` come from what Pillow detected, not from the user.
  - Files are stored as `uploads/<uuid>.<ext>` (dot fixed, `uploads/` prefix) and the API returns an `https://` URL.
  - Frontend: new `react-app/src/store/uploads.js` (`uploadImage`, `checkImageFile`, `setProfilePicture`) checks type/size before uploading and turns server errors into a readable message; `ImageUploadComponent` now shows that message.
  - **Sign-up picture** (see Deviations): because uploads now need a login, the sign-up page only *selects* the picture; right after the account is created (user is now logged in) it uploads it and calls a new small endpoint `PUT /api/auth/profile-picture`, which only accepts URLs from your bucket's `uploads/` prefix. Also fixed: signing up without a picture stored an empty string instead of the default avatar.
- **Files:** `app/api/img_routes.py`, `app/s3_helpers.py`, `app/config.py`, `app/__init__.py`, `app/api/auth_routes.py`, `requirements.txt`, `Pipfile` (Pillow), `react-app/src/store/uploads.js` (new), `react-app/src/components/ImageUploadComponenet/ImageUploadComponent.js`, `react-app/src/components/auth/SignUpForm.js`
- **How to verify:** (S3 was mocked in tests; with real credentials try it in the browser)
  1. Logged out: `curl -i -F image=@photo.png http://localhost:5000/api/img/upload` -> 302 to `/api/auth/unauthorized` (401).
  2. Logged in, upload a `.pdf` -> 400; upload a text file renamed to `.jpg` -> 400 "file is not a valid image"; upload a >5 MB file -> 413 and the UI shows "Image is too large".
  3. Upload a real image -> 200 with a URL like `https://<bucket>.s3.amazonaws.com/uploads/3f2a....png`.
  4. Sign up with a picture -> after redirect your avatar is the uploaded image; sign up without one -> default avatar.
  Verified with the Flask test client (11 checks, S3 call mocked).
- **Things to watch / follow-ups:**
  - Uploads still use `ACL: public-read` and access keys; **A5** (not in this batch) moves to an IAM role, no ACLs, and lazy boto3 client. A fresh S3 bucket with ACLs disabled will reject these uploads until A5.
  - Pillow pinned to 11.3.0 because it still supports Python 3.9 (the Pipfile's version). `Pipfile.lock` was not regenerated - run `pipenv lock` (or rely on `requirements.txt`; A16 removes the Pipfile).
  - Werkzeug's dev server sometimes resets the connection instead of sending the 413 for very large bodies; the frontend checks size first so users still see a clear message.
  - Optional later: resize images on upload (A30).
