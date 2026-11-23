# Aktiv modernization - change log

This file explains every change made on the `modernize` branch, item by item, in the
same numbering as `MODERNIZATION_PLAN.md`. Each section says what was wrong, what
changed, which files were touched, how to check it yourself, and what to keep an eye on.

**Batch 1 (security & bug fixes): A1 - A15.** These keep the current stack
(Flask 2.0 / SQLAlchemy 1.4 / Create React App). Stack upgrades are Batch 2.

## Deviations from plan

- **A4 (sign-up picture):** the plan adds `@login_required` to `/api/img/upload`, but the sign-up page uploaded the profile picture *before* the account existed, so that would have broken sign-up pictures. Minimal fix: the sign-up page now uploads the picture right after the account is created and saves it via a new `PUT /api/auth/profile-picture` endpoint (accepts only URLs from your bucket's `uploads/` prefix).
- **Pipfile.lock not regenerated:** new Python packages (Pillow in A4, email-validator in A9) were added to both `requirements.txt` and `Pipfile`, but `Pipfile.lock` could not be re-locked here (no pipenv/Python 3.9). `pipenv install` will re-lock automatically, or run `pipenv lock`. A16 (later) removes the Pipfile entirely.
- **A9 rate limiting skipped:** optional in the plan; it adds Flask-Limiter and needs shared storage across workers, so it is better done with the EC2/Caddy setup (later batch).

## Open questions for Tyler

- **S3 (A5):** Is there a live deployment still using `S3_KEY`/`S3_SECRET`? Those env vars are no longer read; set `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or an IAM role) and add the `uploads/*` bucket policy described in A5, or uploads will fail / be private.
- **Workout comments GET (found during A8):** the frontend calls `GET /api/workouts/<id>/comments` but the backend only has POST on that URL (405). Add the GET endpoint, or remove the unused frontend call? (Not changed - outside A1-A15.)
- **APP_ENV (A11):** where is the app currently deployed (Render?) and does it set `FLASK_ENV=production`? It keeps working via the fallback, but please add `APP_ENV=production` there.

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

## A5 — Modern S3 access: IAM role, no ACLs
- **Problem:** The app created its boto3 client at import time with long-lived access keys from `S3_KEY`/`S3_SECRET` in `.env`. Long-lived keys sitting in a file on a server are the most common way AWS accounts get compromised. Every upload also sent `ACL: public-read`; S3 buckets created since April 2023 have ACLs disabled ("Bucket owner enforced"), and uploads that send an ACL **fail** on them.
- **What changed:**
  - `app/s3_helpers.py` now builds the client lazily in `get_s3_client()` on first upload, with **no explicit keys**. boto3 then uses its default credential chain: the EC2 instance's IAM role in production; locally your `~/.aws` profile (`aws configure` or `aws sso login`) or the standard `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_PROFILE` env vars. `AWS_REGION` sets the region.
  - The `ACL` argument is gone. Public read access for `uploads/*` must come from a bucket policy (below) or CloudFront.
  - Optional `S3_PUBLIC_URL` env var overrides the public base URL (for a CloudFront domain later); default stays `https://<bucket>.s3.amazonaws.com/`.
  - `.env.example`: `S3_KEY`/`S3_SECRET` removed, `AWS_REGION` and commented `S3_PUBLIC_URL` added.
- **Files:** `app/s3_helpers.py`, `.env.example`
- **How to verify:**
  1. Locally: `aws configure` (or `aws sso login --profile <p>` and `export AWS_PROFILE=<p>`), set `S3_BUCKET` and `AWS_REGION` in `.env`, start the app, upload an image while logged in -> URL works.
  2. In code/tests: the client is `None` until the first upload, and the upload call contains no `ACL` (verified with a fake client in the Flask test client).
  3. On the bucket (if it has ACLs disabled), add this bucket policy so uploaded images are viewable but nothing else is public:
     ```json
     {"Version":"2012-10-17","Statement":[{"Sid":"PublicReadUploads","Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::<bucket>/uploads/*"}]}
     ```
     (The bucket's "Block public access" setting for *bucket policies* must allow this; or use CloudFront + OAC instead - A42/A44.)
- **Things to watch / follow-ups:**
  - **Action needed on any existing deployment:** rename `S3_KEY`/`S3_SECRET` to `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (temporary, until it runs on EC2 with an IAM role), or uploads will fail with "Unable to locate credentials". Better: delete those keys in IAM once the role is in place.
  - Without the bucket policy, new uploads are **private** (the URL returns 403), because they no longer carry `public-read`.
  - The IAM role / instance profile and bucket are created by Terraform in A43/A44 (later batch). Minimal IAM permission for the app: `s3:PutObject` on `arn:aws:s3:::<bucket>/uploads/*`.
  - The seed data's old images point at the `capstone-strava-clone-aktiv` bucket (open question 4 in the plan).

## A6 — Make CSRF protection real
- **Problem:** CSRF = another website making your logged-in browser send a request to Aktiv (e.g. a hidden form that deletes your route). Every form handler did `form['csrf_token'].data = request.cookies['csrf_token']`, i.e. it took the token **from the cookie** and then compared it with... the same cookie's token. A forged cross-site request carries the cookie automatically, so the check always passed and protected nothing (only `SameSite=Strict` in production helped). The image upload had no check at all. And if the cookie was missing (first visit, cleared cookies) `request.cookies['csrf_token']` raised `KeyError` -> HTTP 500.
- **What changed:**
  - `CSRFProtect(app)` is enabled globally in `app/__init__.py`: every POST/PUT/PATCH/DELETE must send a valid `X-CSRFToken` header, which Flask-WTF checks against the token stored in the signed session. FlaskForms automatically accept a request that already passed this check.
  - The `csrf_token` cookie is now **not** `httponly`, so JavaScript can read it (the session cookie that proves who you are is still httponly).
  - Removed all 8 copies of `form['csrf_token'].data = request.cookies['csrf_token']` (fixes the `KeyError` 500).
  - CSRF failures return JSON **400** `{"errors": ["CSRF token missing or invalid. Refresh the page and try again."]}` instead of an HTML page.
  - `WTF_CSRF_TIME_LIMIT = None`: the token is valid for the life of the session (the default 1-hour expiry would make a tab left open for an hour fail its next save).
  - Frontend: new `react-app/src/store/csrf.js` with `csrfFetch()` - same as `fetch()` but adds `X-CSRFToken` (read from the cookie) on write requests. All store files that send POST/PUT/DELETE (`session`, `routes`, `workouts`, `comments`, `friends`, `currentRoute`, `uploads`) use it.
- **Files:** `app/__init__.py`, `app/config.py`, `app/api/auth_routes.py`, `app/api/route_routes.py`, `app/api/workout_routes.py`, `app/api/comments_routes.py`, `react-app/src/store/csrf.js` (new), `react-app/src/store/{session,routes,workouts,comments,friends,currentRoute,uploads}.js`
- **How to verify:**
  1. `curl -c jar -b jar http://localhost:5000/api/auth/` (gets the cookies), then `curl -b jar -X POST -H 'Content-Type: application/json' -d '{"email":"demo@aa.io","password":"password"}' http://localhost:5000/api/auth/login` -> **400** CSRF error (no header).
  2. Same request with `-H "X-CSRFToken: <value of csrf_token from the jar file>"` -> **200**.
  3. In the browser: demo login, create/edit/delete a route, workout and comment, add/remove a friend, upload an image - all still work (DevTools > Network shows the `X-CSRFToken` request header).
  Verified with the Flask test client: 12 checks (no header / wrong header / no cookie -> 400, with header -> 200 for login, comments, routes, workouts, delete).
- **Things to watch / follow-ups:**
  - Any **new** write request in the frontend must use `csrfFetch` (or set the header itself), otherwise it gets a 400.
  - `GET /api/auth/logout` is still a GET, so a cross-site page could log you out (annoying, not dangerous). Changing it to POST is a small later fix.
  - If you call the API from Postman/curl, first `GET /api/auth/` to get the cookie, then copy it into the header.
  - A50 (later) will add automated tests for this.

## A7 — Fix add/remove friend logic
- **Problem:** In `add_user_friends` the "already friends?" check **and** the code that adds the friend were both *inside* the `for friend in friends` loop. A user with zero friends never entered the loop, so the view returned `None` and Flask raised a 500 - i.e. the Friends feature crashed for every brand-new user. For other users it only compared against the *first* friend and then added the new one, so adding someone already in your list (but not first) hit the database unique constraint -> 500. You could also friend yourself. `unfriend_user` called `to_dict()` before checking the user existed (500 for a bad id) and returned 200 with an error body when the user was not a friend. The seed data had `jimmy` and `tammie` following themselves.
- **What changed:**
  - Rewrote both views. A helper `_is_follower(user, other)` asks the database directly whether the relationship exists.
  - Add friend: missing user -> **404**, yourself -> **400**, already friends -> **409**, otherwise add both directions (only the ones that are missing, so half-existing friendships from old data don't crash) -> 200 with the same response shape as before.
  - Unfriend: missing user -> **404**, not a friend -> **404**, otherwise remove both directions -> 200 (same shape as before).
  - Errors use the `{"errors": [...]}` shape like the rest of the API.
  - Seeds: removed the self-follows for `jimmy` and `tammie`.
- **Files:** `app/api/user_routes.py`, `app/seeds/users.py`
- **How to verify:**
  1. `flask seed undo && flask seed all` (or recreate the DB).
  2. Sign up a new user, go to Users and add the demo user as a friend -> works (used to be a 500). Adding again -> 409.
  3. `POST /api/users/<your own id>/friends` -> 400; `POST /api/users/9999/friends` -> 404.
  4. Remove the friend -> 200; remove again -> 404; demo's friend list no longer shows the new user.
  Verified with the Flask test client (16 checks).
- **Things to watch / follow-ups:**
  - Friendships are still stored as two `follows` rows ("mutual follow"). The table gets a proper composite primary key in A15.
  - The responses still embed full `to_dict()` users (slow); A24/A25 slim them down.

## A8 — Consistent 404s, status codes, and the "newest row" race
- **Problem:**
  - Asking for a record that does not exist (`GET /api/routes/9999`, comment on a deleted workout, edit a deleted comment, ...) crashed with `AttributeError: 'NoneType' object has no attribute ...` -> HTTP 500.
  - Validation errors returned **401** ("not logged in"), which is the wrong meaning and could make a frontend think the session expired.
  - "Not yours" on delete returned **200** with an error body, so the frontend treated it as success and removed the item from the screen.
  - `add_route`/`add_workout` committed the new row and then returned `Route.query.order_by(created_at.desc()).first()` - "the newest row in the whole table". If two users posted at the same moment, you could get back someone else's route.
  - `add_comment_to_workout` returned `form.errors` (a dict) while everything else returned a list of strings, and the users endpoints returned 200 with a string error for unknown ids.
  - Frontend: `updateRoute`, `addRoute` and `updateWorkout` did `const data = response.json()` without `await`, so `data.errors` was always undefined and server errors were silently ignored.
- **What changed:**
  - Every "by id" endpoint (routes, workouts, comments, route comments, users and their sub-lists, friends) checks for `None` and returns **404** `{"errors": ["... not found"]}`.
  - Update/delete of someone else's route/workout/comment -> **403**.
  - Form validation errors -> **400** with a list of strings. Login failures stay **401** (that is an auth failure; see A9).
  - `add_route`/`add_workout` return the object they just created.
  - All error bodies use the same shape: `{"errors": ["message", ...]}` (except the upload endpoint, which keeps its existing string message that the upload UI displays).
  - Frontend stores: added the missing `await`s and an "An error occurred. Please try again." fallback for 5xx in routes, workouts and comments.
- **Files:** `app/api/route_routes.py`, `app/api/workout_routes.py`, `app/api/comments_routes.py`, `app/api/user_routes.py`, `app/api/auth_routes.py`, `react-app/src/store/routes.js`, `react-app/src/store/workouts.js`, `react-app/src/store/comments.js`
- **How to verify:**
  1. Logged in: `GET /api/routes/9999` -> 404 JSON (was 500). Same for `/api/workouts/9999`, `/api/comments/9999`, `/api/users/9999`.
  2. `DELETE` another user's route/workout/comment -> 403 (was 200), and nothing is deleted.
  3. `POST /api/routes/` with `{"title": ""}` -> 400 with a list of messages; in the UI, the New Route form shows the messages.
  4. Create a route -> the response is exactly the route you created.
  Verified with the Flask test client (25 checks, including a simulated "newer row by another user" for the race).
- **Things to watch / follow-ups:**
  - Pre-existing bug, not changed (outside A8): `store/comments.js` calls `GET /api/workouts/<id>/comments`, which has no backend route (only POST exists) -> 405. Workout comments still display because they are embedded in the workout itself. Worth a small follow-up.
  - Flask-Login still answers unauthenticated API calls with a 302 redirect to `/api/auth/unauthorized` (which then returns 401). `fetch` follows the redirect, so the frontend sees 401 as before.
  - A50 (later) will cover these with automated tests.

## A9 — Auth hardening
- **Problem:**
  - Login said "Email provided not found." for unknown emails and "Password was incorrect." for wrong passwords, so anyone could test which emails have accounts ("user enumeration").
  - Forms had no length limits, but the DB columns do (route/workout `title` is `String(30)`, comment `body` is `String(255)`, ...). SQLite ignores that, but on Postgres a 31-character title is a database error -> HTTP 500.
  - Sign-up accepted any string as an email and any password (even 1 character).
  - Session cookie settings were left to defaults (no `SameSite`, not `Secure` in production).
- **What changed:**
  - **Login:** the email/password check moved from form validators into the view. Unknown email and wrong password both return **401** `{"errors": ["Invalid email or password"]}`. For an unknown email the server still runs one password-hash check so the response time does not give it away either. Password field is now a `PasswordField`.
  - **Sign-up:** `Email()` validator (needs the `email-validator` package, now in `requirements.txt` and `Pipfile`), password at least **8** characters, `Length(max=...)` on every field matching `app/models/user.py`. The sign-up page shows the 8-character hint (`minLength`), and shows "Passwords do not match." instead of silently doing nothing.
  - **Routes/workouts/comments forms:** `Length(max=...)` matching the columns (title 30, description 1000, travel mode/type 50, distance 500, image URL 255, comment 255) -> clean 400 with a message instead of a 500.
  - **Cookies** (`app/config.py`): session cookie `HttpOnly`, `SameSite=Lax`, `Secure` in production; same settings for Flask-Login's remember-me cookie. The `csrf_token` cookie now uses `SameSite=Lax` and `Secure` in production too (it used to be `Strict` in prod and unset in dev).
  - The demo account is unchanged (`demo@aa.io` / `password` - exactly 8 characters, so it still meets the new rule, which only applies to new sign-ups anyway).
- **Files:** `app/forms/login_form.py`, `app/forms/signup_form.py`, `app/forms/route_form.py`, `app/forms/workout_form.py`, `app/forms/comment_form.py`, `app/api/auth_routes.py`, `app/config.py`, `app/__init__.py`, `requirements.txt`, `Pipfile`, `react-app/src/components/auth/SignUpForm.js`
- **How to verify:**
  1. Log in with `nobody@aa.io` / anything and with `demo@aa.io` / `wrong` -> both show "Invalid email or password".
  2. Click **Demo** login -> works.
  3. Sign up with email `not-an-email` or password `short` -> 400 with a field message.
  4. Create a route with a 31-character title -> "title : Field cannot be longer than 30 characters."
  5. DevTools > Application > Cookies: `session` is HttpOnly + SameSite=Lax (and Secure on the HTTPS site).
  Verified with the Flask test client (12 checks) plus `FLASK_ENV=production` config check (`Secure` = True).
- **Things to watch / follow-ups:**
  - **Rate limiting not added** (the plan marks it optional; it needs a new dependency, Flask-Limiter, and a shared store like Redis for multiple workers). Recommended once the app is on EC2 behind Caddy/CloudFront.
  - `REMEMBER_COOKIE_SAMESITE` only takes effect with Flask-Login 0.6+ (Batch 2, A17). The app doesn't use "remember me" today anyway.
  - New dependencies: `email-validator==2.2.0`, `dnspython==2.7.0`, `idna==3.10` (versions chosen to still support Python 3.9).
  - Demo account read-only / nightly reset is still an open question (plan question 10).
  - `SESSION_COOKIE_SECURE` is driven by `FLASK_ENV=production` for now; A11 switches it to `APP_ENV`.

## A10 — Remove CORS
- **Problem:** `CORS(app)` with no options sent `Access-Control-Allow-Origin: *` on every response, i.e. "any website may read Aktiv's API responses". Cookies are not sent with a wildcard, so it was not directly exploitable, but it was unnecessary, broadens what other sites can do, and becomes dangerous if someone later "fixes" a cookie problem by adding `supports_credentials=True`.
- **What changed:** Deleted `CORS(app)` and the `flask-cors` dependency. The app never needs CORS today: in production Flask serves the React build from the same origin, and in development the CRA dev server proxies `/api/*` to Flask (`"proxy": "http://localhost:5000"` in `react-app/package.json`), so the browser only ever talks to one origin.
- **Files:** `app/__init__.py`, `requirements.txt`, `Pipfile`
- **How to verify:**
  1. `pip uninstall flask-cors` (or reinstall from `requirements.txt` in a fresh venv) and start the app -> it starts.
  2. `curl -i -H 'Origin: https://evil.example' http://localhost:5000/api/auth/` -> no `Access-Control-Allow-Origin` header.
  3. `npm start` in `react-app` and use the app at `http://localhost:3000` -> API calls work through the proxy.
  Verified: smoke tests pass and no CORS header is returned for a foreign `Origin`.
- **Things to watch / follow-ups:**
  - The planned AWS setup (A42) puts CloudFront in front of both the frontend and `/api/*` on one domain, so CORS stays unnecessary. If you ever host the frontend on a different domain than the API, re-add Flask-Cors restricted to that exact origin with `supports_credentials=True` (and `SameSite=None; Secure` cookies).

## A11 — Configuration cleanup
- **Problem:**
  - `SQLALCHEMY_ECHO = True` was on **everywhere**, including production: every SQL statement was written to the logs (slow, noisy, and it can log user data).
  - `os.environ.get('DATABASE_URL').replace(...)` crashed with a confusing `AttributeError: 'NoneType' object has no attribute 'replace'` when `DATABASE_URL` was missing.
  - The app used `FLASK_ENV` to decide "am I in production?". Flask 2.3 removed `FLASK_ENV`, so that would break in the Batch 2 upgrade.
  - A Heroku-era `https_redirect` hook trusted the `X-Forwarded-Proto` header; HTTPS redirects belong to the proxy in front of the app.
  - `/api/docs` (a list of every API route) was public in production.
  - No protection against dropped database connections (after a Postgres restart the first requests failed).
- **What changed:**
  - New `APP_ENV` variable (`development` | `testing` | `production`), read by `get_app_env()` in `app/config.py`. `FLASK_ENV` is still accepted as a **fallback** so an existing deployment that sets `FLASK_ENV=production` keeps working. Everything that used `FLASK_ENV` now uses it: models/seeds (Postgres schema), migrations, secret-key check, cookie `Secure` flag.
  - `Config` is split into `DevelopmentConfig` (SQL echo on by default, turn off with `SQLALCHEMY_ECHO=0`), `TestingConfig` (`TESTING=True`, in-memory SQLite unless `DATABASE_URL` is set) and `ProductionConfig` (echo off, `Secure` cookies, `/api/docs` off). `get_config()` picks one; an unknown `APP_ENV` fails fast with a clear message.
  - Missing `DATABASE_URL` -> `RuntimeError: DATABASE_URL is not set. Add it to .env, e.g. ...`. The `postgres://` -> `postgresql://` rewrite is kept (only the prefix).
  - `SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}`.
  - Removed `https_redirect`.
  - `/api/docs` returns 404 in production unless `ENABLE_API_DOCS=1`.
  - `.flaskenv`: `FLASK_ENV=development` -> `FLASK_DEBUG=1` (debugger/reloader for `flask run`). `.env.example`: `APP_ENV=development` and a commented `SQLALCHEMY_ECHO=0`.
- **Files:** `app/config.py`, `app/__init__.py`, `app/models/db.py`, `migrations/env.py`, `migrations/versions/0a0f8863271d_.py` (env lookup only), `.flaskenv`, `.env.example`
- **How to verify:**
  1. In your `.env`, replace `FLASK_ENV=development` with `APP_ENV=development`; `flask run` works and prints SQL (set `SQLALCHEMY_ECHO=0` to silence it).
  2. Remove `DATABASE_URL` from `.env` -> startup fails with the clear `DATABASE_URL is not set` message.
  3. `APP_ENV=production` (with a real `SECRET_KEY`): `GET /api/docs` -> 404, no SQL in logs, session cookie has `Secure`.
  4. `APP_ENV=bogus flask run` -> "Unknown APP_ENV 'bogus'".
  Verified: all earlier test scripts still pass under the new config; the production, testing, fallback, missing-URL and unknown-env cases were checked with Python one-liners.
- **Things to watch / follow-ups:**
  - **On any live deployment, set `APP_ENV=production`** (FLASK_ENV still works for now, but the fallback can be removed after Batch 2).
  - `.flaskenv` has `FLASK_DEBUG=1`: never use `flask run` in production (use gunicorn, which ignores `.flaskenv`).
  - A16 (later) turns this into an app factory `create_app(config_name)` that uses these config classes directly.
  - The `react_root` favicon branch calls `app.send_from_directory`, which doesn't exist; left for A17 as planned.

## A12 — Google Maps API key handling
- **Problem:** Flask read the Maps key from `REACT_APP_NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and handed it out at runtime in every `/api/auth/` and `/api/auth/login` response (`mapKey`) plus a dedicated `/api/map/key` endpoint. A browser key is public by nature (it ends up in the page either way), so the real protection is **restricting** the key in Google Cloud - but the setup encouraged one unrestricted key in the server `.env`, which could then be reused for any Google API on your bill. It also made every component wait for the user object before maps could load. (The key is not committed anywhere in the current tree or history - keep it that way.)
- **What changed:**
  - The browser key is now injected **at build time**: new `react-app/src/config.js` exports `GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY`, and the 5 map components (`Map`, `NewMap`, `RouteDisplay`, `MapAdjustment/EditMapForm`, `ActivityFeed`) use it instead of `currUser.mapKey`. In development a console warning appears if it's missing.
  - Removed `mapKey` from the auth responses, deleted `app/api/map_routes.py` (`/api/map/key`) and the unused `store/map.js` reducer.
  - `react-app/.env.example` documents `REACT_APP_GOOGLE_MAPS_API_KEY`; the root `.env.example` no longer has a Maps key and explains where it went.
  - The CRA naming (`REACT_APP_`) is used for now; A19 (Vite) renames it to `VITE_GOOGLE_MAPS_API_KEY`.
- **Files:** `app/api/auth_routes.py`, `app/api/map_routes.py` (deleted), `app/__init__.py`, `react-app/src/config.js` (new), `react-app/src/store/map.js` (deleted), `react-app/src/store/index.js`, `react-app/src/components/{Map/MapComponent,NewMap/NewRoute,RouteDisplay/RouteDisplay,MapAdjustment/EditMapForm,ActivityFeed/ActivityFeed}.js`, `.env.example`, `react-app/.env.example`
- **How to create and restrict the keys (you need to do this - no key was available here):**
  1. Google Cloud Console -> create (or pick) a project -> **Billing**: attach billing and create a **budget alert** (e.g. $5/month, email at 50/90/100%).
  2. **APIs & Services -> Library**: enable *Maps JavaScript API*, *Maps Static API* and (for the current feed/route pages) *Directions API*.
  3. **APIs & Services -> Credentials -> Create credentials -> API key** -> name it "Aktiv browser".
     - *Application restrictions*: **Websites (HTTP referrers)**: `http://localhost:3000/*`, `http://localhost:5000/*`, and your production URL, e.g. `https://aktiv.example.com/*`.
     - *API restrictions*: **Restrict key** -> Maps JavaScript API, Maps Static API (add Directions API only while the browser still calls it - see below).
  4. Put it in `react-app/.env.local` (git-ignored): `REACT_APP_GOOGLE_MAPS_API_KEY=AIza...`, then restart `npm start`. For a production build, set the same variable in the build environment (CI secret or `react-app/.env.production.local`) before `npm run build`.
  5. Later (A28): a second key "Aktiv server" restricted by **IP address** (the EC2 Elastic IP) and to the Directions API only, used by Flask as `GOOGLE_MAPS_SERVER_KEY`.
- **How to verify:**
  1. `GET /api/auth/` -> response has no `mapKey`; `GET /api/map/key` -> 404.
  2. With the key in `react-app/.env.local`, `npm start` -> maps load on New Route / route pages. Without it -> console warning "REACT_APP_GOOGLE_MAPS_API_KEY is not set".
  Verified: backend checks with the test client; `npm run build` compiles (see A14). Maps rendering itself was **not** verified (no key available).
- **Things to watch / follow-ups:**
  - `ActivityFeed.js` still calls the Directions **web service** from the browser with this key. Google generally blocks that (CORS) and a referrer-restricted key is rejected by web-service APIs, so feed thumbnails may not load - that is the existing behaviour, fixed properly by A28 (server computes polylines with the server key).
  - Changing the key requires a rebuild of the frontend (it's baked in).

## A13 — Remove dead code and unused packages
- **Problem:** Leftovers from development made the code harder to read and the install heavier: backend test components that were never routed, commented-out routes and `print`/`console.log` lines, a `store/currentRoute.js` file that was *entirely* commented out (so its reducer was `undefined`), raw `<script src="https://maps.googleapis.com/...&callback=initMap">` tags inside JSX in 4 map components (React does not execute script tags rendered this way, `useLoadScript` already loads Maps, and they risked double-loading), `require('dotenv').config()` in the browser entry point (dotenv is Node-only and does nothing in a browser), 7 npm packages nothing imports, and Python packages that are not used at runtime.
- **What changed:**
  - Deleted `react-app/src/components/BackendTestComponents/` (4 files) and `react-app/src/store/currentRoute.js` (and its entry in `store/index.js`).
  - Removed the 4 raw Maps `<script>` tags, `require('dotenv').config()`, commented-out routes/imports in `App.js`, commented `console.log` lines in `NewRoute.js`, commented `print(...)` lines in Python, and the commented duplicate of `/api/docs` in `app/__init__.py`.
  - npm: removed `google-maps`, `google-map-react`, `@googlemaps/react-wrapper`, `static-google-map`, `dotenv`, `dotenv-webpack`, `http-proxy-middleware` (each grep-checked: no imports in `src/`; no `setupProxy.js` exists). `package-lock.json` updated with `npm uninstall --package-lock-only` (still lockfile v2).
  - Python: removed `GeoAlchemy2` (never imported) and its only dependents `packaging`/`pyparsing`; moved `autopep8`, `pycodestyle`, `tomli` to a new `requirements-dev.txt` (Pipfile: geoalchemy2 removed, autopep8 under `[dev-packages]`).
- **Files:** `react-app/src/components/BackendTestComponents/*` (deleted), `react-app/src/store/currentRoute.js` (deleted), `react-app/src/store/index.js`, `react-app/src/App.js`, `react-app/src/index.js`, `react-app/src/components/{Map/MapComponent,NewMap/NewRoute,RouteDisplay/RouteDisplay,MapAdjustment/EditMapForm}.js`, `react-app/package.json`, `react-app/package-lock.json`, `app/__init__.py`, `app/api/auth_routes.py`, `app/api/me_routes.py`, `requirements.txt`, `requirements-dev.txt` (new), `Pipfile`
- **How to verify:**
  1. `cd react-app && npm ci && npm run build` -> "Compiled with warnings" (the warnings are pre-existing hook-dependency lint warnings) and a `build/` folder. On Node 17+ CRA 4 needs `NODE_OPTIONS=--openssl-legacy-provider` (pre-existing; fixed by Vite in A19).
  2. `pip install -r requirements.txt` in a fresh venv, then `flask db upgrade && flask seed all && flask run` -> app works without GeoAlchemy2.
  3. `grep -rn "<script" react-app/src` -> nothing.
  Verified: `npm ci` + `npm run build` succeeded in a copy of `react-app` (Node 22, with the OpenSSL flag); backend test scripts still pass.
- **Things to watch / follow-ups:**
  - Other dependencies that look unused but were **not** in the plan's list, so left alone: `react-icons` and `@types/google.maps` (no imports in `src/`). Safe to remove later.
  - `redux-logger` is still used in development (`store/index.js`).
  - `npm install` prints peer-dependency warnings from react-router 5 / CRA 4; these go away with the Batch 2 upgrades.
