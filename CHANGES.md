# Aktiv modernization - change log

This file explains every change made on the `modernize` branch, item by item, in the
same numbering as `MODERNIZATION_PLAN.md`. Each section says what was wrong, what
changed, which files were touched, how to check it yourself, and what to keep an eye on.

**Batch 1 (security & bug fixes): A1 - A15.** These keep the current stack
(Flask 2.0 / SQLAlchemy 1.4 / Create React App).

**Batch 2 (modern stack): A0, A16 - A23.** A0 (safe seeding) was added before the
upgrades; then the app factory / Python 3.12, Flask 3, SQLAlchemy 2.0, Vite, React 19,
Redux Toolkit, React Router v7 and the Google Maps library update. See the Batch 2 part
at the end of this file.

**Batch 3 (performance + UI/UX): A24 - A36 and add-ons Y1 - Y5.** Slimmer API responses,
fewer queries, indexes, pagination, numeric distance/time, server-side route polylines,
lazy-loaded pages, then a full visual redesign (own design system, responsive, accessible,
loading/empty/error states, owned images). Y1 workout comments, Y2 `/routes` + `/users`
pages, Y3 friends slice, Y4 logout as POST, Y5 AdvancedMarkerElement. See the Batch 3 part
at the end of this file.

## Deviations from plan

- **A4 (sign-up picture):** the plan adds `@login_required` to `/api/img/upload`, but the sign-up page uploaded the profile picture *before* the account existed, so that would have broken sign-up pictures. Minimal fix: the sign-up page now uploads the picture right after the account is created and saves it via a new `PUT /api/auth/profile-picture` endpoint (accepts only URLs from your bucket's `uploads/` prefix).
- **Pipfile.lock not regenerated:** new Python packages (Pillow in A4, email-validator in A9) were added to both `requirements.txt` and `Pipfile`, but `Pipfile.lock` could not be re-locked here (no pipenv/Python 3.9). `pipenv install` will re-lock automatically, or run `pipenv lock`. A16 (later) removes the Pipfile entirely.
- **A9 rate limiting skipped:** optional in the plan; it adds Flask-Limiter and needs shared storage across workers, so it is better done with the EC2/Caddy setup (later batch).
- **A15 done before A18/A47:** the plan suggested doing the migration cleanup after the SQLAlchemy 2.0 upgrade and the Render-schema decision. It was done now on SQLAlchemy 1.4 / Alembic 1.6 using only basic operations (rebuild `follows`, drop `workouts.route_id`, set column defaults) and keeps supporting the production `SCHEMA`, so it does not block either later item. Decision taken: **drop** `workouts.route_id` rather than add it to the model.
- **A0 (new item, Batch 2):** not in the original plan; added at Tyler's request before the upgrades. Beyond the brief, `flask seed undo` is also refused in production (it deletes everything just like `--reset`).
- **A16 pins:** the plan leaves all version upgrades to A17, but the old pins cannot be installed or run on Python 3.12, so A16 bumps only what 3.12 strictly needs (greenlet 3.5.6, SQLAlchemy 1.4.54, six 1.17.0) and temporarily pins setuptools 80.10.2 (pkg_resources for Flask 2.0's CLI). `requirements.txt` was kept (no pyproject/uv lock) to stay closest to the existing setup.
- **A17 extra packages:** besides the packages the plan lists, A17 also upgrades Flask-SQLAlchemy to 3.0.5 (2.5.1 cannot run on Flask 3; SQLAlchemy stays 1.4 until A18) and Pillow 11.3 -> 13.0 plus all transitive pins (urllib3, idna, dnspython, Mako, ...), because they carried most of the pip-audit findings. Alembic is 1.19.2, not 1.20.x: 1.20 needs SQLAlchemy 2.0, so it moves to the latest in A18.
- **A18 timestamps / typed models:** the plan suggests timezone-aware timestamps. Values are now UTC (`datetime.now(timezone.utc)`), but stored without tzinfo because the columns are `DateTime` without time zone; switching them to `DateTime(timezone=True)` (Postgres `timestamptz`) needs a migration that rewrites 8 columns and is best tested on real Postgres (A38), so it was left out. The optional typed `Mapped[]` columns were also skipped (no behaviour change, larger diff, more migration-drift risk).
- **A20 version bumps of A22/A23 packages:** React 19 is outside the declared peer range of `@react-google-maps/api` 2.17 and of react-router 5.2's `mini-create-react-context`, so A20 bumps them to 2.20.8 and 5.3.4 (versions only, no code changes). A22 (router v7) and A23 (single Maps loader) still do the actual migrations.
- **A21 scope:** done as `configureStore` + one `createSlice` per reducer file, keeping the existing thunks (no `createAsyncThunk`, no RTK Query) so components and return values stay the same. `ActivityFeed` had to stop writing map URLs onto store objects (Toolkit freezes state). Done last (after A22/A23), as in the plan's phase order.

## Open questions for Tyler

- **S3 (A5):** Is there a live deployment still using `S3_KEY`/`S3_SECRET`? Those env vars are no longer read; set `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or an IAM role) and add the `uploads/*` bucket policy described in A5, or uploads will fail / be private.
- **Workout comments GET (found during A8):** the frontend calls `GET /api/workouts/<id>/comments` but the backend only has POST on that URL (405). Add the GET endpoint, or remove the unused frontend call? (Not changed - outside A1-A15.)
- **APP_ENV (A11):** where is the app currently deployed (Render?) and does it set `FLASK_ENV=production`? It keeps working via the fallback, but please add `APP_ENV=production` there.
- **Postgres check for A15:** the new migration was verified on SQLite and its Postgres SQL was reviewed offline, but not run on a real Postgres. Before running it on a production database, take a `pg_dump` and try it on a copy (or wait for the Docker Postgres in A38).

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

## A14 — Fix App.js routing and preload bugs
- **Problem:**
  - The startup `useEffect` in `App.js` ran `authenticate()` and then checked `if (user)` - but `user` there is the value from the **first render**, which is always `null` (React gives each render its own copy of the variables). So the "preload routes and workouts" code never ran.
  - Routes were wrapped in `<>...</>` fragments inside `<Switch>`. `<Switch>` only looks at its *direct* children to pick the first match, so with fragments it couldn't do its job, and a catch-all 404 page was impossible (unknown URLs showed an empty page between the navbar and footer).
  - `ProtectedRoute` redirected logged-out users to `/login`, a page that does not exist.
- **What changed:**
  - `authenticate()` (in `store/session.js`) now returns the user (or `null`). `App` awaits it, and if there is a session, preloads routes + workouts **before** rendering the pages (so a page like `/routes/5` opened directly doesn't race with the preload). Logging in later (form, demo button, sign-up) triggers the same preload once per user; logging out resets it.
  - One flat `<Switch>`: `/` shows the home page when logged in and the login form when logged out (same as before), `/sign-up` redirects home if already logged in, `/login` redirects to `/` (for old links), all app pages use `ProtectedRoute`, and a final catch-all route shows the new **NotFound** page.
  - `ProtectedRoute` uses the `render` prop and redirects to `/` (the real login page), passing the original location in `state.from` for a future "return to where you were" feature.
  - New `components/NotFound.js` + `NotFound.css` ("Page not found" + link home).
  - Stayed on react-router v5 syntax; A22 (Batch 2) converts this to v7 `<Routes>`.
- **Files:** `react-app/src/App.js`, `react-app/src/components/auth/ProtectedRoute.js`, `react-app/src/components/NotFound.js` (new), `react-app/src/components/NotFound.css` (new), `react-app/src/store/session.js`
- **How to verify:**
  1. `npm start`, logged out, open `http://localhost:3000/activity` -> you land on the login page at `/`.
  2. Open `http://localhost:3000/nope` -> "Page not found" with a link home.
  3. Log in with Demo, reload the page with DevTools > Network open -> `/api/auth/`, then `/api/routes/` and `/api/workouts/` are requested once at startup.
  4. All existing pages (`/activity`, `/routes`, `/routes/<id>`, `/workouts/<id>`, `/newRoute`, `/newWorkout`, `/users/<id>`) still open.
  Verified: `npm run build` compiles (the old App.js hook-dependency warning is gone); Flask serves `index.html` for `/`, `/routes/5`, `/sign-up` and unknown paths; and a throw-away Jest test (React Testing Library, fetch mocked) confirmed the three behaviours above - it **fails on the old App.js** and passes on the new one. The test file was not added to the repo (frontend tests are A51); it is a good first candidate for A51 (it renders `<App />` with a real store and a mocked `fetch`, then checks `/this-page-does-not-exist` shows "Page not found", `/activity` while logged out lands on the login page, and that `/api/routes/` + `/api/workouts/` are fetched when a session exists). Clicking through the UI in a real browser was **not** done here.
- **Things to watch / follow-ups:**
  - Pages still fetch their own data too (e.g. `RouteDisplay` calls `getAllRoutes()` again); A21/A27 reduce that duplicate fetching.
  - `GET_ROUTES` in `store/routes.js` resets `currentRoute` to `null`; if you ever start a background refetch of all routes while a route page is open, it can blank that page - worth changing when the store is refactored (A21).

## A15 — Reconcile database migrations with models
- **Problem:** The database built by the migrations did not match the models:
  - The only migration created `workouts.route_id` (with a foreign key to `routes`), but the `Workout` model has no such column - so `flask db migrate` always wanted to drop it, and the column silently sat there unused.
  - `follows` (the friendship table) had **no primary key**: both columns were nullable, so `NULL` rows were possible, and there was no `ON DELETE CASCADE`, so deleting a user directly in Postgres would fail on (or orphan) their friendship rows. The seed data also contained two self-follows.
  - Timestamps only got values from Python (`default=datetime.now`), so rows inserted with raw SQL had `NULL` `created_at`/`updated_at`.
  - The first migration's `upgrade()` still had commented-out `op.drop_table(...)` lines from earlier hacks.
- **What changed:**
  - New migration `migrations/versions/b7c1e9a4d2f3_reconcile_models.py` (revises `0a0f8863271d`):
    1. drops `workouts.route_id` (decision: workouts are not linked to routes anywhere in the app, so removing the column matches the model; linking them could be a future feature),
    2. rebuilds `follows` as `follows_new` with `PRIMARY KEY (follower_id, followed_id)`, `NOT NULL`, `ON DELETE CASCADE` foreign keys, copies the rows over (skipping `NULL` rows, duplicates and self-follows), drops the old table and renames the new one. Rebuilding works identically on SQLite and Postgres and avoids guessing the old auto-generated constraint names,
    3. adds a database default `CURRENT_TIMESTAMP`/`now()` to `created_at` and `updated_at` on `users`, `routes`, `workouts`, `comments`.
    It honours the production `SCHEMA` (Render-style) like the first migration, and has a working `downgrade()`.
  - Models: `follows` columns are `primary_key=True` with `ondelete='CASCADE'` (the redundant unique constraint is gone - the primary key already guarantees uniqueness); every `created_at`/`updated_at` has `server_default=db.func.now()` (the Python default is kept).
  - Removed the commented `drop_table` lines from the first migration.
- **Files:** `migrations/versions/b7c1e9a4d2f3_reconcile_models.py` (new), `migrations/versions/0a0f8863271d_.py`, `app/models/user.py`, `app/models/route.py`, `app/models/workout.py`, `app/models/comment.py`
- **How to verify:**
  1. **Back up first:** `cp app/dev.db app/dev.db.bak` (for Postgres: `pg_dump`).
  2. `flask db upgrade` -> "Running upgrade 0a0f8863271d -> b7c1e9a4d2f3".
  3. `flask db migrate -m check` -> "No changes in schema detected." (no file created) = models and DB agree.
  4. `flask db downgrade` then `flask db upgrade` -> both run cleanly.
  5. Demo login, friends list, routes and workouts all still work.
  Verified on SQLite: fresh DB (upgrade, seed, downgrade, upgrade, `flask seed undo/all`), a **copy of your `app/dev.db`** (5 users / 20 routes / 10 workouts / 60 comments kept; follows 15 -> 13 because the two self-follows were dropped; `flask db migrate` empty), and all earlier test scripts pass on the migrated schema. For Postgres, the upgrade and downgrade SQL were generated offline with `APP_ENV=production SCHEMA=flask_schema flask db upgrade 0a0f8863271d:b7c1e9a4d2f3 --sql` and reviewed (correct schema-qualified `ALTER`/`CREATE`); it was **not run against a live Postgres** (none available here).
- **Things to watch / follow-ups:**
  - The plan recommended doing this after the SQLAlchemy 2.0 upgrade (A18) and the Render-schema decision (A47). It was done now on SQLAlchemy 1.4 (see Deviations); the migration uses only basic Alembic operations that work the same on Alembic 1.6 and newer.
  - The migration permanently deletes `follows` rows that were `NULL` or self-follows, and the `workouts.route_id` values (all `NULL` in the seed data). Take a backup of any real database first.
  - On SQLite, `ON DELETE CASCADE` only takes effect if `PRAGMA foreign_keys=ON` (SQLAlchemy leaves it off); the ORM already removes friendship rows when a user is deleted, so behaviour is the same. On Postgres the cascade is enforced by the database.
  - Server defaults use database time (UTC on most servers) while Python defaults use the app server's local time; A18 moves everything to timezone-aware UTC.
  - Indexes on foreign keys come next in A26 (later batch).

---

# Batch 2 (modern stack): A0, A16 - A23

## A0 — Safe seeding
- **Problem:** `flask seed all` started (in production) by running `TRUNCATE ... RESTART IDENTITY CASCADE` on `users`, `routes`, `workouts` and `comments`, then re-seeding the 5 demo users. The old Render deploy ran `flask seed all` on **every deploy**, so each deploy wiped every real sign-up, route, workout and comment. The seed files also hard-coded `user_id=3`, `route_id=20`, etc., which only works if the ids happen to start at 1 (true after `RESTART IDENTITY`, not after a plain `DELETE` on Postgres). The raw `db.session.execute("TRUNCATE ...")` strings would also break on SQLAlchemy 2.0.
- **What changed:**
  - `flask seed all` now only seeds an **empty** database: if there is at least one user it prints `Database already has data. Skipping seed.` and exits without touching anything. That makes it safe to run on every deploy.
  - New `flask seed all --reset`: deletes all data first, then seeds. The delete runs **children before parents** (`comments`, `workouts`, `routes`, `follows`, `users`) with SQLAlchemy `delete()` (works on SQLite and Postgres, no raw SQL). In production (`APP_ENV=production`) it refuses with a `click.ClickException` (exit code 1).
  - `flask seed undo` uses the same delete and is also refused in production (it would wipe real data just the same).
  - The whole TRUNCATE block and every per-file `undo_*()` function (all raw SQL) are gone.
  - No more hard-coded ids: `seed_users()` returns the users as a list, `seed_routes(users)` / `seed_workouts(users)` return theirs, and `seed_comments(users, routes, workouts)` uses `users[2].id`, `routes[19].id`, ... The users are inserted in an explicit order (demo, marnie, tammie, bobbie, jimmy) and flushed before the friendships are set, so a fresh database gets **exactly the same ids and ownership as before** (demo is still id 1, route 1 still belongs to tammie, etc.).
- **The rule from now on (deploys and local work):**
  - **Deploy** runs `flask db upgrade && flask seed all`. This is safe every time: migrations only move the schema forward, and the seed only fills an empty database.
  - **Reset only locally:** `flask seed all --reset` (or `flask seed undo`). Both refuse to run with `APP_ENV=production`.
  - **Never run `docker compose down -v`** against a stack that holds data you care about (`-v` deletes the Postgres volume = the database). Plain `docker compose down` is fine. (Relevant once Docker Compose arrives in A38.)
  - **Back up before every production migration:** `pg_dump` first (A46 automates backups later).
- **Files:** `app/seeds/__init__.py`, `app/seeds/users.py`, `app/seeds/routes.py`, `app/seeds/workouts.py`, `app/seeds/comments.py`
- **How to verify:**
  1. `flask seed all` on a database that already has data -> `Database already has data. Skipping seed.`
  2. `flask seed all --reset` -> `Deleted existing data.` then `Seeded demo data.`; demo login (`demo@aa.io` / `password`) works.
  3. `APP_ENV=production flask seed all --reset` -> `Error: flask seed all --reset deletes all data and is disabled in production ...`, exit code 1, nothing deleted. Same for `flask seed undo`.
  4. Fresh database: `rm app/dev.db; flask db upgrade; flask seed all` -> seeds normally.
  Verified: a dump of every table (ids, owners, follows, all columns except timestamps/hashes) after seeding a fresh SQLite DB is **identical** to the old seed's output; an 87-request API snapshot (every endpoint, logged in/out, create/edit/delete, friends, sign-up) is identical before and after; all Batch 1 test scripts pass; seeding into a DB whose ids do not start at 1 (an existing user with id 10) still links every route/workout/comment to the right seeded user.
- **Things to watch:**
  - If a deploy script or Render "build command" somewhere still runs `flask seed undo`, remove it (it now fails in production anyway).
  - With plain `DELETE`, Postgres ids keep counting up after a local `--reset` (e.g. demo becomes id 6). Nothing in the app or seeds depends on specific ids any more; the frontend only uses ids it gets from the API.
  - The production check reads `APP_ENV` (or the old `FLASK_ENV` fallback). Make sure production really sets `APP_ENV=production`.

## A16 — App factory + single dependency file + Python 3.12
- **Problem:** `app/__init__.py` built the Flask app at import time (`app = Flask(...)` at module level, plus `LoginManager(app)`, `Migrate(app, db)`, `CSRFProtect(app)` next to it). Importing *anything* from the `app` package created the one and only app with whatever environment variables happened to be set, so tests could not build an app with a test database, and every extension was glued to that single object. Dependencies were listed twice and disagreed: `Pipfile` said Python 3.9 and had unpinned `boto3`/`psycopg2`, `Pipfile.lock` was stale (see Batch 1 deviations), and `requirements.txt` had the real pins. The pinned versions also could not be installed on a current Python: `greenlet 1.1.0` does not compile on 3.12, `six 1.15.0` breaks `python-dateutil` (and therefore Alembic) on 3.12, and Python 3.12 venvs no longer ship `setuptools`, which Flask 2.0's CLI needs to find the `flask db` command.
- **What changed:**
  - `create_app(config_name=None)` in `app/__init__.py` builds and returns a new app. `config_name` is `development` / `testing` / `production` and defaults to `APP_ENV`, using the A11 config classes. The startup checks (SECRET_KEY guard, clear `DATABASE_URL` error) run inside it. The routes that lived in `__init__.py` (`/api/docs`, the React catch-all, the CSRF cookie hook, the 404/413/CSRF error handlers) are registered by small `register_*` helpers called from the factory. Behaviour is unchanged.
  - New `app/extensions.py` creates `login`, `migrate` and `csrf` **without** an app; the factory calls `init_app(app)` on each. `db` stays in `app/models/db.py` (the models import it) and is re-exported from `extensions.py`.
  - `FLASK_APP=app` still works: Flask finds `create_app()` automatically, so `flask run`, `flask db upgrade` and `flask seed all` are unchanged. **gunicorn now needs `gunicorn "app:create_app()"`** (there is no module-level `app` object any more).
  - One dependency file: `Pipfile` and `Pipfile.lock` are deleted; `requirements.txt` (runtime) + `requirements-dev.txt` (tools) are the only lists. New `.python-version` (`3.12`) for pyenv/uv.
  - Python 3.12 is the target. Only the pins Python 3.12 strictly needs were changed: `greenlet 1.1.0 -> 3.5.6`, `SQLAlchemy 1.4.19 -> 1.4.54` (last 1.4 release, first with 3.12 support), `six 1.15.0 -> 1.17.0`, and `setuptools==80.10.2` added (Flask 2.0 loads the `flask db` command through `pkg_resources`, which setuptools 81+ removed; A17 drops this pin). Everything else stays for A17.
  - `README.md` "How to get started" uses a venv + `pip install -r ...` instead of pipenv, drops `flask db migrate` (only for creating new migrations), and mentions the gunicorn command. `.flaskenv` has a comment about the factory.
- **Files:** `app/__init__.py`, `app/extensions.py` (new), `requirements.txt`, `Pipfile` (deleted), `Pipfile.lock` (deleted), `.python-version` (new), `.flaskenv`, `README.md`
- **How to verify:**
  1. `python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt -r requirements-dev.txt` (see "Things to watch" for `psycopg2`).
  2. `flask db upgrade && flask seed all && flask run` -> app works as before; demo login works.
  3. `python -c "from app import create_app; print(create_app('testing').config['TESTING'])"` -> `True`.
  4. `gunicorn "app:create_app()"` -> serves `/api/auth/` (401-style `{"errors": ["Unauthorized"]}` when logged out).
  Verified on Python 3.12.16: fresh DB upgrade + seed; the 87-request API snapshot is identical to the pre-Batch-2 baseline (only the indentation of two `/api/docs` docstrings differs); all Batch 1 test scripts pass; `flask db` schema check finds 0 differences; gunicorn boots the factory; `create_app('production')` with a placeholder SECRET_KEY still refuses to start.
- **Things to watch:**
  - **Breaking for deployments:** any start command `gunicorn app:app` must become `gunicorn "app:create_app()"`.
  - `psycopg2==2.9.5` still builds from source and needs `pg_config` (Postgres client headers). It was skipped in the local test venv (SQLite); A17 switches to the prebuilt `psycopg2-binary`.
  - The config classes still read environment variables when `app/config.py` is first imported (class attributes). Set env vars *before* importing `app` in tests, or pass values through `app.config` after `create_app('testing')`. A49 (tests) can refine this.
  - You will see a `pkg_resources is deprecated` warning on every `flask` command until A17.

## A17 — Flask 3.x stack upgrade
- **Problem:** The web stack was from early 2021: Flask 2.0.1, Werkzeug 2.0.1 and gunicorn 20.1.0 all have published security advisories, and `pip-audit` reported **142 known vulnerabilities in 10 packages** for `requirements.txt` (Werkzeug, Jinja2, Flask, gunicorn, urllib3, Pillow, Mako, python-dotenv, idna, dnspython). `psycopg2` had to be compiled from source (needs Postgres headers and a C compiler). The favicon branch of the React catch-all called `app.send_from_directory`, which has never existed on the app object (it would crash with `AttributeError` if reached).
- **What changed:**
  - Upgraded (all pinned in `requirements.txt`, including what they pull in): Flask 2.0.1 -> **3.1.3**, Werkzeug 2.0.1 -> **3.1.9**, Flask-Login 0.5.0 -> **0.6.3**, Flask-WTF 0.15.1 -> **1.3.0**, WTForms 2.3.3 -> **3.3.2**, Flask-Migrate 3.0.1 -> **4.1.0**, Alembic 1.6.5 -> **1.19.2**, gunicorn 20.1.0 -> **27.0.1**, python-dotenv 0.14.0 -> **1.2.4**, boto3/botocore 1.26/1.29 -> **1.44.10**, click 7 -> 8.5.1, Jinja2 3.1.6, itsdangerous 2.2.0, MarkupSafe 3.0.4, urllib3 2.8.0, email-validator 2.4.0, Pillow 11.3.0 -> **13.0.0**.
  - **Flask-SQLAlchemy 2.5.1 -> 3.0.5**: 2.5.1 does not work with Flask 3 (it imports `_app_ctx_stack`, removed in Flask 3.0). 3.0.5 is the last release that still supports SQLAlchemy 1.4, so SQLAlchemy stays at 1.4.54 here and moves to 2.0 (with Flask-SQLAlchemy 3.1) in A18.
  - `psycopg2` -> **`psycopg2-binary` 2.9.13** (prebuilt wheels, no compiler needed; same import name `psycopg2`, so `postgresql://` URLs work unchanged).
  - Removed the temporary `setuptools` pin from A16 (Flask 3 finds `flask db` without `pkg_resources`) and `python-editor` (no longer used by Alembic).
  - Favicon bug: `react_root` now uses `flask.send_from_directory(app.static_folder, 'favicon.ico')`.
  - Flask-SQLAlchemy 3 resolves a relative SQLite URL (`sqlite:///dev.db`) against the `instance/` folder instead of the `app/` package. `create_app()` turns a relative SQLite path into `app/<path>`, so your existing `app/dev.db` is still the database that `DATABASE_URL=sqlite:///dev.db` points to (no surprise empty database).
  - Checked for the other Flask 3 breaking changes: `FLASK_ENV` is no longer used (A11), no `before_first_request`, no `_app_ctx_stack`/`_request_ctx_stack`, no `json_encoder`, forms have no custom `Meta`. Nothing else needed changing.
- **Files:** `requirements.txt`, `app/__init__.py`, `app/config.py` (comment only)
- **How to verify:**
  1. `pip install -r requirements.txt -r requirements-dev.txt` in a fresh Python 3.12 venv (no compiler or `pg_config` needed any more), then `pip check` -> "No broken requirements".
  2. `flask db upgrade && flask seed all && flask run` -> app works; demo login works.
  3. `pip-audit -r requirements.txt` -> "No known vulnerabilities found".
  4. Existing users can still log in (Werkzeug 3 hashes *new* passwords with scrypt but still verifies the old pbkdf2 hashes).
  Verified on Python 3.12: fresh DB upgrade + seed; 87-request API snapshot identical to baseline; all Batch 1 test scripts pass; schema check 0 differences; **a copy of your `app/dev.db`** upgraded from `0a0f8863271d` to `b7c1e9a4d2f3`, `flask seed all` skipped it, demo login worked with the old password hash; gunicorn and `flask run` both serve the app; `/favicon.ico`, `/`, `/routes/5` and unknown paths served correctly from a stand-in build folder; `pip-audit`: 142 -> **0** known vulnerabilities.
- **Things to watch:**
  - Your real `app/dev.db` is still at migration `0a0f8863271d` (Batch 1 only tested the A15 migration on a copy). Run `cp app/dev.db app/dev.db.bak && flask db upgrade` once.
  - In debug mode (`flask run` with `FLASK_DEBUG=1`) JSON responses are pretty-printed; that is a Flask 2.2+ default and does not change the data.
  - The SQLAlchemy "2.0 deprecated API" warning shown on startup is expected until A18.
  - Pillow jumped two major versions (11 -> 13); the upload code only uses `Image.open`, `verify()` and `format`, which are unchanged, and the upload tests pass.

## A18 — SQLAlchemy 2.0 + Flask-SQLAlchemy 3.1
- **Problem:** The code used the SQLAlchemy 1.x "legacy" query API everywhere: `Model.query.get(id)` (deprecated in 2.0), `Model.query.filter(...).first()/.all()`, `notin_`. Raw SQL strings passed to `execute()` (the migration env's `CREATE SCHEMA`; the seed TRUNCATEs were already removed in A0) **raise an error** in 2.0. In 2.0 `str(engine.url)` also hides the password as `***`, so `migrations/env.py` would have handed Alembic a broken Postgres URL. Timestamps defaulted to `datetime.now` = the app server's **local** time, but the API sends them as `... GMT`, so on a server not set to UTC every `createdAt` was off by the UTC offset (and disagreed with the database's own `CURRENT_TIMESTAMP` default, which is UTC).
- **What changed:**
  - SQLAlchemy 1.4.54 -> **2.0.58**, Flask-SQLAlchemy 3.0.5 -> **3.1.1**, Alembic 1.19.2 -> **1.20.1**. (SQLAlchemy 2.1 exists, but Flask-SQLAlchemy 3.1 and the plan target 2.0; 2.0 is still maintained.)
  - Every query uses the 2.0 style:
    - `Model.query.get(id)` -> `db.session.get(Model, id)` (routes, workouts, comments, users, friends, `load_user`).
    - `Model.query.all()` -> `db.session.scalars(db.select(Model)).all()`.
    - `Model.query.filter(...).first()` -> `db.session.scalar(db.select(Model).where(...))` (login, sign-up uniqueness checks).
    - Friend-activity feed: `db.session.scalars(db.select(Route).where(...).order_by(...)).all()`; `notin_` -> `not_in`.
    - The seeds (A0) already use `select()` / `delete()`.
  - `migrations/env.py`: `CREATE SCHEMA` wrapped in `text()` and followed by `connection.commit()` (2.0 auto-begins a transaction on the first `execute()`; without the commit Alembic would join that transaction and the migration would be rolled back when the connection closes). The URL is rendered with `url.render_as_string(hide_password=False)`.
  - New `utcnow()` helper in `app/models/db.py` (`datetime.now(timezone.utc)`), used as the Python default/onupdate for every `created_at`/`updated_at`, so all timestamps are UTC.
  - `lazy='dynamic'` relationships (friends) and `backref` still work in 2.0 and were left as they are (behaviour unchanged).
- **Files:** `requirements.txt`, `app/__init__.py`, `app/api/auth_routes.py`, `app/api/comments_routes.py`, `app/api/me_routes.py`, `app/api/route_routes.py`, `app/api/user_routes.py`, `app/api/workout_routes.py`, `app/forms/signup_form.py`, `app/models/db.py`, `app/models/user.py`, `app/models/route.py`, `app/models/workout.py`, `app/models/comment.py`, `migrations/env.py`
- **How to verify:**
  1. `pip install -r requirements.txt` -> SQLAlchemy 2.0.58; `flask db upgrade && flask seed all && flask run` works; demo login works.
  2. `python -W default -c "from app import create_app; create_app()"` and click around: no `LegacyAPIWarning` / "2.0 deprecated" warnings.
  3. `flask db downgrade base && flask db upgrade` -> both migrations (`0a0f8863271d`, `b7c1e9a4d2f3`) apply cleanly; `flask db check` -> "No new upgrade operations detected." (models and DB agree).
  4. Create a workout; its `createdAt` matches the current **UTC** time.
  Verified on Python 3.12 / SQLite: 87-request API snapshot identical to baseline; all Batch 1 test scripts pass; no SQLAlchemy warnings from app code; fresh `upgrade` / `downgrade` to base / `upgrade` all clean; `flask db check` clean; **a copy of your `app/dev.db`** upgraded `0a0f8863271d -> b7c1e9a4d2f3`, seed skipped, `flask db check` clean; the production (Postgres, `SCHEMA=flask_schema`) upgrade SQL was generated offline with `APP_ENV=production flask db upgrade --sql` and has the same schema-qualified statements as in Batch 1. With `TZ=America/Denver`, a new workout's `createdAt` is the UTC time (it used to be Denver time labelled GMT).
- **Things to watch:**
  - **Not run against a live Postgres** (none can be installed here). The online migration path with `SCHEMA` (`CREATE SCHEMA` + `commit()`) is the one piece only reviewed, not executed. Test on a Postgres copy first (or with Docker Postgres in A38).
  - Columns are still `DateTime` *without* time zone: values are UTC but stored "naive" (see Deviations). Rows created before this change hold server-local times.
  - During `flask db upgrade` on SQLite, Alembic 1.20 now *warns* "Unnamed CHECK constraint on reflected table 'routes' is being omitted". Alembic 1.6 silently did the same thing (verified: the resulting `routes` table is identical with both versions). Harmless.
  - Typed `Mapped[...]` models (optional in the plan) were not done; the classic `db.Column` style is fully supported in 2.0.

## A19 — Create React App -> Vite
- **Problem:** The frontend was built with Create React App (`react-scripts` 4.0.3), which is deprecated and unmaintained. It pulled in webpack 4, Babel 7.14, Jest 26, workbox, etc.: `npm audit` reported **201 known vulnerabilities (19 critical, 63 high)**, almost all in that build tooling. On Node 17+ it needed `NODE_OPTIONS=--openssl-legacy-provider` to build at all, `npm install` printed pages of peer-dependency warnings, and builds/dev-server start were slow.
- **What changed:**
  - `react-scripts` removed; **Vite 8.3.8** + **@vitejs/plugin-react 6.3.0** added as `devDependencies`. New `react-app/vite.config.js`:
    - dev server on **port 3000** (same as before, so a Maps key restricted to `http://localhost:3000/*` keeps working),
    - **proxy `/api` -> `http://localhost:5000`** (replaces CRA's `"proxy"` field; cookies stay same-origin, no CORS needed),
    - build output **`react-app/dist/`**.
  - Flask now serves the build from `react-app/dist` (`static_folder` in `app/__init__.py`, was `react-app/build`). Later, the same `dist/` folder can be uploaded to S3/CloudFront (A42).
  - `public/index.html` moved to `react-app/index.html` (Vite's entry point) with `<script type="module" src="/src/main.jsx">`; the stray second `</head>` was removed and a `<link rel="icon">` added. `public/` (favicon, images) is still copied as-is into the build.
  - `src/index.js` -> `src/main.jsx`, and every file that contains JSX was renamed `.js` -> `.jsx` (36 components + `App.jsx`, with `git mv` so history follows). Vite only parses JSX in `.jsx` files. Files without JSX (store, `config.js`, the `index.js` re-exports) keep `.js`. Imports did not change (they have no extensions).
  - **Env var rename:** `REACT_APP_GOOGLE_MAPS_API_KEY` -> **`VITE_GOOGLE_MAPS_API_KEY`** (Vite only exposes `VITE_*` variables, via `import.meta.env`). `src/config.js` and both `.env.example` files updated; the unused `REACT_APP_BASE_URL` was dropped from `react-app/.env.example`.
  - `process.env.NODE_ENV` -> `import.meta.env.PROD` / `DEV`; the browser-side `require('redux-logger')` (CommonJS, not available in Vite) became a normal `import` (still only applied in development).
  - `package.json`: `"type": "module"`, scripts `dev` / `start` (both `vite`), `build` (`vite build`), `preview`; removed `eslintConfig` (CRA's lint preset; linting is A52), `browserslist` and `proxy`; added `"engines": {"node": "^20.19.0 || >=22.12.0"}` (Vite 8's requirement). The `test` script is gone with Jest; frontend tests come back with Vitest in A51.
  - `package-lock.json` regenerated (lockfile v3). All app dependencies are kept at **exactly** the versions the old lock had (React 17.0.2, react-redux 7.2.4, react-router-dom 5.2.0, @react-google-maps/api 2.17.0, ...); they are upgraded in A20-A23.
  - `react-app/.gitignore` ignores `/dist`. Root `README.md` mentions `npm run dev`.
- **Files:** `react-app/package.json`, `react-app/package-lock.json`, `react-app/vite.config.js` (new), `react-app/index.html` (moved from `public/`), `react-app/src/main.jsx` (was `index.js`), `react-app/src/**/*.jsx` (renamed), `react-app/src/config.js`, `react-app/src/store/index.js`, `react-app/.env.example`, `react-app/.gitignore`, `.env.example`, `app/__init__.py`, `README.md`
- **How to verify:**
  1. Rename your key: in `react-app/.env.local` change `REACT_APP_GOOGLE_MAPS_API_KEY=` to `VITE_GOOGLE_MAPS_API_KEY=`.
  2. `cd react-app && rm -rf node_modules && npm ci && npm run dev` -> Vite starts on http://localhost:3000 in about a second; with `flask run` in another terminal, log in with the demo button.
  3. `npm run build` -> creates `react-app/dist/` in well under a second; then `flask run` alone serves the built app at http://localhost:5000.
  4. `npm audit` -> 4 high (was 201), all from the old `@testing-library/jest-dom` (updated in A20).
  Verified: `npm ci` + `npm run build` (Node 22): 142 modules, built in ~0.1 s; Flask serves `dist/index.html` for `/`, `/routes/5` and unknown paths, plus `/favicon.ico`, `/images/*` and the hashed JS asset; the Vite dev server on :3000 proxied `/api/auth/`, a CSRF-protected demo login and `/api/routes/` to Flask. A throw-away jsdom smoke test (not committed) rendered the real `<App/>` with API fixtures on 19 page/login-state combinations plus the demo-login click; its output is the baseline the later frontend items are compared against. Backend API snapshot unchanged.
- **Things to watch:**
  - **Breaking:** the env var rename (step 1), the build folder (`dist/` instead of `build/`; delete an old `react-app/build/` folder if you have one), and `npm start` now runs Vite (same port).
  - Vite needs Node 20.19+ or 22.12+.
  - Two pages crash on existing bugs that are **not** caused by this change (they behave the same before and after): `/routes` (`components/UserRoutes/Routes.jsx` maps over `state.routes`, which is an object with `null` values) and `/users` (`UsersList.jsx` does the same with `state.users`). Neither page is linked from the navbar. Not fixed here (outside A19-A23).
  - Maps rendering was not checked in a real browser (no API key here).

## A20 — React 17 -> 19 and react-redux 9
- **Problem:** React 17 (2020) is out of support; its `ReactDOM.render` entry point was removed in React 19. react-redux 7, redux 4 and redux-thunk 2 are two majors behind, and the testing libraries (`@testing-library/react` 11, `jest-dom` 5) only work with React 17 and carried the last 4 `npm audit` findings.
- **What changed:**
  - `react` / `react-dom` 17.0.2 -> **19.3.1**, `react-redux` 7.2.4 -> **9.3.1**, `redux` 4.1.0 -> **5.0.1**, `redux-thunk` 2.3.0 -> **3.1.0**.
  - `src/main.jsx`: `ReactDOM.render(...)` -> `createRoot(document.getElementById('root')).render(...)` (still wrapped in `<React.StrictMode>`).
  - `src/store/index.js`: redux-thunk 3 has a named export (`import { thunk } from 'redux-thunk'`); Redux 5 marks `createStore` as legacy, so it is imported as `legacy_createStore` (same function, no warning; A21 replaces it with Redux Toolkit's `configureStore`).
  - StrictMode double effects: since React 18, development mode mounts every component twice, so `App`'s startup effect ran twice. The second run found the preload "already started" and showed the pages *before* routes/workouts had arrived. `preload()` now keeps the in-flight promise and both runs wait for the same one. (Production is not affected; StrictMode only runs in development.)
  - Testing libraries moved to `devDependencies` and updated for React 19: `@testing-library/react` 16.3.3 (+ its new peer `@testing-library/dom` 10.4.2), `@testing-library/jest-dom` 8.0.0, `@testing-library/user-event` 14.6.13. (No tests use them yet; A51.)
  - Two version bumps needed only for React 19 compatibility (no code changes): `@react-google-maps/api` 2.17.0 -> **2.20.8** (2.17 declares React <= 18) and `react-router-dom` 5.2.0 -> **5.3.4** (5.2 pulls in `mini-create-react-context`, which declares React <= 17). See Deviations.
  - Checked for other React 19 removals: no `propTypes`/`defaultProps`, string refs, legacy context, `findDOMNode` or `unmountComponentAtNode` in the code; `ReactDOM.createPortal` (Modal) is unchanged in 19.
- **Files:** `react-app/package.json`, `react-app/package-lock.json`, `react-app/src/main.jsx`, `react-app/src/store/index.js`, `react-app/src/App.jsx`
- **How to verify:**
  1. `cd react-app && npm ci && npm run build` -> builds; `npm audit` -> **0 vulnerabilities**.
  2. `npm run dev` with Flask running: log in with Demo, open a route, a workout, a user page, add a comment, add/remove a friend.
  3. With React DevTools / the console open: no "ReactDOM.render is no longer supported" error.
  Verified: build OK (~0.13 s); `npm audit` 4 -> 0; the jsdom smoke test (real `<App/>`, API fixtures, 19 page/login-state combinations + demo-login click) renders **the same text, URLs and API calls** as on the A19 baseline. The two pre-existing crashes (`/routes`, `/users`, see A19) are unchanged.
- **Things to watch:**
  - In development you will see each startup request (e.g. `/api/auth/`) twice in the Network tab: that is StrictMode's double mount, by design, and does not happen in the production build.
  - react-router stays on v5 until A22; it runs on React 19 but is no longer developed.

## A22 — react-router v5 -> v7
- **Problem:** react-router 5 is no longer developed; its API (`<Switch>`, `<Redirect>`, `useHistory`, `render` props) was replaced in v6/v7, and v5 relies on React internals that newer React versions keep deprecating. `ProtectedRoute` had to wrap `<Route render={...}>` by hand.
- **What changed:**
  - `react-router-dom` 5.3.4 removed; **`react-router` 7.18.6** added (in v7 everything, including `BrowserRouter`, is exported from `react-router`; `react-router-dom` is only a compatibility re-export).
  - `App.jsx`: `<Switch>` -> `<Routes>` (imported as `RouterRoutes`, because the app already has a page component named `Routes`), every route uses `element={...}`, `exact` is gone (v7 paths match exactly by default), the catch-all is `path='*'` -> `NotFound`. Redirects (`/login`, `/sign-up` when logged in) use `<Navigate to='/' replace />` (v5's `<Redirect>` also replaced the history entry).
  - `ProtectedRoute` is now a **layout route**: `<Route element={<ProtectedRoute />}>` wraps the 8 protected pages; it renders `<Outlet />` for a logged-in user and `<Navigate to='/' replace state={{ from: location }} />` otherwise (same behaviour and `state.from` as in A14).
  - `useHistory()` / `history.push(x)` -> `useNavigate()` / `navigate(x)` in `LogoutButton`, `SignUpForm`, `NewRoute`, `NewWorkout`, `DeleteMapForm`, `DeleteWorkoutForm`. `<Redirect to='/' />` -> `<Navigate to='/' replace />` in `LoginForm` and `SignUpForm`.
  - `NavBar`: `<NavLink exact>` -> `<NavLink end>`. All other `NavLink`/`Link`/`useParams` uses only changed their import to `react-router`.
- **Files:** `react-app/package.json`, `react-app/package-lock.json`, `react-app/src/App.jsx`, `react-app/src/components/auth/ProtectedRoute.jsx`, `react-app/src/components/auth/LoginForm.jsx`, `react-app/src/components/auth/SignUpForm.jsx`, `react-app/src/components/auth/LogoutButton.jsx`, `react-app/src/components/NavBar.jsx`, `react-app/src/components/NewMap/NewRoute.jsx`, `react-app/src/components/NewWorkout/NewWorkout.jsx`, `react-app/src/components/MapAdjustment/DeleteMapForm.jsx`, `react-app/src/components/WorkoutDisplay/{WorkoutDisplay,DeleteWorkoutForm}.jsx`, `react-app/src/components/{ActivityFeed/ActivityFeed,Footer,Map/MapComponent,NotFound,RouteDisplay/RouteDisplay,User,UserRoutes/Routes,UsersList}.jsx` (import only)
- **How to verify:**
  1. `npm ci && npm run build` -> builds.
  2. `npm run dev`: logged out, open `/activity` -> login page at `/`; `/nope` -> "Page not found"; log in with Demo -> home; navbar links; Logout -> back to `/`; `/sign-up` while logged in -> `/`; create a workout -> lands on `/activity`; delete a route -> lands on `/`.
  Verified: build OK; the jsdom smoke test now also clicks a navbar link and Logout, and gives **identical** results (text, final URL, API calls) for all 21 scenarios on the A20 code (router v5) and on this commit (router v7), including the redirects (`/activity` logged out -> `/`, `/sign-up` and `/login` logged in -> `/`) and the catch-all.
- **Things to watch:**
  - v7 `NavLink` marks `to='/'` as active only on `/` itself (v5 marked the logo link active everywhere when `exact` was missing). There is no `.active` CSS in the app, so nothing looks different.
  - The pre-existing `/routes` and `/users` page crashes (A19) are unchanged.
  - The app uses v7 in "declarative mode" (`<BrowserRouter>` + `<Routes>`), the smallest change. v7's data/framework modes (loaders, actions) are optional and would be a separate refactor.

## A23 — Google Maps library update
- **Problem:** Four components (`Map/MapComponent`, `NewMap/NewRoute`, `RouteDisplay/RouteDisplay`, `MapAdjustment/EditMapForm`) each called `useLoadScript(...)` themselves. Every one of them created its own loader for the same script: the Google Maps loader only allows **one** configuration per page (a second, different call throws "Loader must not be called again with different options"), so adding e.g. a `libraries` option to just one component would have broken the others, and each page start had to wait for its own loader state. `@react-google-maps/api` was on 2.17.0, which does not support React 19.
- **What changed:**
  - `@react-google-maps/api` is on **2.20.8** (latest; the version bump itself already happened in A20 because React 19 required it - see Deviations).
  - New `src/context/GoogleMaps.jsx`: a `GoogleMapsProvider` calls **`useJsApiLoader` once** for the whole app with a constant `LIBRARIES = ['maps']` array defined outside any component (a new array per render makes the library reload the script and log a "Performance warning"), and a `useGoogleMaps()` hook returns `{ isLoaded, loadError }`. A load error is logged to the console in development.
  - `main.jsx` wraps `<App />` in `<GoogleMapsProvider>`. The 4 map components replace their `useLoadScript({...})` with `const { isLoaded } = useGoogleMaps();` and no longer import the key. Nothing else in them changed.
  - Kept `@react-google-maps/api` instead of moving to `@vis.gl/react-google-maps` (the plan allowed either): the app uses `DirectionsService`, `DirectionsRenderer` and `DistanceMatrixService` components, which `@vis.gl` does not provide, so a move would mean rewriting all map code.
- **Files:** `react-app/src/context/GoogleMaps.jsx` (new), `react-app/src/main.jsx`, `react-app/src/components/Map/MapComponent.jsx`, `react-app/src/components/NewMap/NewRoute.jsx`, `react-app/src/components/RouteDisplay/RouteDisplay.jsx`, `react-app/src/components/MapAdjustment/EditMapForm.jsx`
- **How to verify:**
  1. Put your key in `react-app/.env.local` as `VITE_GOOGLE_MAPS_API_KEY=...`, `npm run dev`, log in.
  2. Home (all routes on one map), a route page (directions), "+ Route" (place start/end markers, distance appears), Edit on your own route: all maps load. DevTools > Network: `maps.googleapis.com/maps/api/js` is requested **once** per page load, not once per map page.
  3. No "LoadScript has been reloaded unintentionally" or "Loader must not be called again" warnings in the console.
  Verified: build OK; the jsdom smoke test gives identical results to A22 (21 scenarios); a second throw-away test that fakes `@react-google-maps/api` as "loaded" rendered the real map components on home (map + 20 route markers), "+ Route" (map + 2 markers) and a route page (map + directions) while navigating between them, and showed the loader was called once with one stable `libraries` array and no component-level `useLoadScript` left. Real map rendering with a real key was **not** checked (no key available here).
- **Things to watch:**
  - The Maps script now loads on every page, including the login page (before, only when a map page opened). Loading the script is free; Google bills per map shown, which did not change.
  - Google deprecated `google.maps.Marker` (used via `<Marker>`) in favour of `AdvancedMarkerElement` (needs a Map ID). It still works and is not scheduled for removal yet; switching is a possible follow-up.
  - `ActivityFeed` still calls the Directions web service directly from the browser (see A12); that is A28, not part of this item.

## A21 — Redux Toolkit (optional item, approved)
- **Problem:** The 7 reducer files were hand-written `switch` statements with string constants and one action-creator function per action (~40% of each file was boilerplate). Several reducers changed the existing state in place (`newState = {...state}; newState.routes[id] = ...` changes the *old* `routes` object too, and `UPDATE_COMMENT` edited a comment object directly), which can make React skip re-renders and is easy to get wrong. `ActivityFeed` went further and wrote `directionsFetch` / `routeMapSrc` onto route objects that live in the Redux store. The store setup used Redux 5's legacy `createStore` with hand-wired thunk/logger/devtools.
- **What changed:**
  - Added **`@reduxjs/toolkit` 2.15.0**; removed `redux` and `redux-thunk` (Toolkit includes and configures both).
  - `store/index.js`: `configureStore({ reducer, preloadedState, middleware, devTools })`. Default middleware = thunk + (development only) the immutability and serializability checks; `redux-logger` is still added in development; Redux DevTools is enabled in development. The exported `configureStore(preloadedState)` function and the state shape (`session`, `users`, `comments`, `friends`, `workouts`, `routes`, `friendsActivity`) are unchanged, so no component changed for the store.
  - Each reducer file (`session`, `routes`, `workouts`, `comments`, `friends`, `users`, `friendsActivity`) now uses **`createSlice`**: the action constants and action-creator functions are generated, the reducers are written as simple "mutations" that Immer turns into proper immutable updates. Every case keeps its old result, including quirks (loading all routes/workouts still clears `currentRoute`/`currentWorkout`; adding a workout still works before the list is loaded; the `friends` slice still stores what `addFriend` dispatches, see Things to watch). The unused `CLEAR_COMMENTS` case was dropped (its action creator was commented out).
  - The **thunks were kept as they are** (same names, arguments and return values that the components rely on, e.g. `login()` returns an error list or `null`). They now dispatch the slice's action creators. `createAsyncThunk` / RTK Query were not used: they change return values and loading-state handling in every component, which is a bigger, separate refactor (the plan lists RTK Query as an alternative).
  - `ActivityFeed.jsx`: the static map URL for each route is kept in component state (`mapSrcs`, keyed by route id) instead of being written onto the store's route objects. Required because Redux Toolkit freezes the state (writing to it would throw); the cards render the same images.
- **Store map (state shape, unchanged):**
  - `session`: `{ user }` - logged-in user from `/api/auth/` (with `friends`, `nonFriends`, routes, workouts, comments). Thunks: `authenticate`, `login`, `logout`, `signUp`.
  - `routes`: `{ routes: {id: route} | null, currentRoute }` - `getAllRoutes`, `getCurrentRoute`, `addRoute`, `updateRoute`, `deleteRoute`.
  - `workouts`: `{ workouts: {id: workout} | null, currentWorkout }` - `getAllWorkouts`, `getCurrentWorkout`, `addWorkout`, `updateWorkout`, `deleteWorkout`.
  - `comments`: `{ id: comment }` for the page being viewed - `getRouteComments`, `getWorkoutComments`, `newRouteComment`, `newWorkoutComment`, `updateComment`, `deleteComment`.
  - `users`: `{ users: {id: user} | null, currentUser }` - `getAllUsers`, `getOneUser`.
  - `friends`: `{ id: friend }` - `getAllFriends`, `addFriend`, `deleteFriend` (the latter two also refresh `session` and `users.currentUser`).
  - `friendsActivity`: `{ routes, workouts }` from `/api/me/friends/activity` - `getAllFriendsActivity`.
- **Files:** `react-app/package.json`, `react-app/package-lock.json`, `react-app/src/store/index.js`, `react-app/src/store/{session,routes,workouts,comments,friends,users,friendsActivity}.js`, `react-app/src/components/ActivityFeed/ActivityFeed.jsx`
- **How to verify:**
  1. `npm ci && npm run build` -> builds; `npm audit` -> 0 vulnerabilities.
  2. `npm run dev`, open the Redux DevTools extension (or the console, where redux-logger prints each action): actions are now named like `routes/getRoutes`, `session/setUser`.
  3. Click through: login, home, a route (add/edit/delete a comment), edit your route, create/delete a workout, add/remove a friend, the activity feed. No "A state mutation was detected" or "non-serializable value" errors in the console.
  Verified: build OK; `npm audit` 0. A throw-away store test ran **every thunk** (27 steps: auth, login error/success, all loads, comment create/edit/delete, route and workout create/update/delete, add/remove friend, logout, sign-up) against a mocked API on both the old reducers (A23) and the new slices: the full Redux state and the thunk return value are **identical after every step**. The activity feed with a working Directions response renders the same 12 static map images on both. The page smoke test (21 scenarios) and the maps test are identical to A23. These tests ran with Toolkit's development checks switched on.
- **Things to watch:**
  - Pre-existing bug kept on purpose: `addFriend()` dispatches the friend's id, and the reducer stores it under the key `"undefined"` in `state.friends`. Nothing reads `state.friends` (pages use `session.user.friends`), so it is harmless; a cleanup could remove the `friends` slice or fix the payload.
  - Toolkit's dev checks will now *tell you* (console error) if new code mutates Redux state outside a reducer. That is intended.
  - Action type strings changed (e.g. `workouts/GET_ROUTES` -> `routes/getRoutes`); only visible in DevTools/logger.

## A26 — Database indexes
- **Problem:** Postgres does not create an index for a foreign key by itself, and SQLite does not either. Every profile page, comment list and feed query filters on `user_id` / `route_id` / `workout_id` or sorts by `created_at`, so each one scanned the whole table, and the cost grows with every row added.
- **What changed:** The model columns got `index=True` (`routes.user_id`, `routes.created_at`, `workouts.user_id`, `workouts.created_at`, `comments.user_id`, `comments.route_id`, `comments.workout_id`, `follows.followed_id`) and a **new** migration `c4a1f7e2b9d8_add_indexes.py` creates the 8 indexes (`ix_<table>_<column>`, the names SQLAlchemy generates) and drops them again on downgrade. `follows.follower_id` needs no extra index: it is the first column of the composite primary key from A15. The migration honours the production `SCHEMA` like the earlier ones. No existing migration was edited.
- **Files:** `app/models/{route,workout,comment,user}.py`, `migrations/versions/c4a1f7e2b9d8_add_indexes.py`
- **How to verify:**
  1. `flask db upgrade` then `sqlite3 app/dev.db ".indexes routes"` shows `ix_routes_user_id` and `ix_routes_created_at`.
  2. `flask db downgrade` removes them; `flask db upgrade` brings them back (all three ran clean on SQLite).
  3. The model/database comparison (`compare_metadata`) reports **0 differences** after the upgrade.
- **Things to watch:** Nothing changes for users; queries just stay fast as data grows. Not run on real Postgres (same caveat as A15); `CREATE INDEX` on these small tables is instant, but on a big production table it briefly locks writes.

## A24 — Slim, purpose-built serializers
- **Problem:** `User.to_dict()` embedded the user's routes (each with all its comments, each comment with its user), all workouts, all comments and all friends. `/api/auth/` (called on every page load) and `/login` ran that for **every non-friend user in the database**; `/api/users/` did it for every user. Routes and workouts also embedded all their comments, a Google-style `requestData` blob that repeated the coordinates, a `staticMap` URL with no key, and every owner's **email address**. Response size and query count grew with the whole dataset (on the 5-user demo database: `/api/auth/` was 27 KB / 34 queries, `/api/users/` 68 KB / 65 queries).
- **What changed:**
  - `User.to_summary()` = `id, username, firstName, lastName, profilePicture`. `User.to_dict(private=False, include_activity=False)` is the profile view: summary + `createdAt` + `friends` (each friend is a summary plus the old `userId` key, so friend lists keep working). Email is only added with `private=True` (your own data); routes and workouts only with `include_activity=True` (the profile page, `/api/users/<id>`). Comments are never embedded in a user any more.
  - `/api/auth/`, `/login` and `/signup` all return one **session payload** (`session_payload()`): your profile + email + friends + `routeCount` / `workoutCount` + `nonFriends` as summaries. `nonFriends` is now one SQL query (`id NOT IN friends + me`, sorted by username) instead of loading and serializing every user and filtering in Python.
  - `/api/users/` returns summaries only. `/api/users/<id>/routes|workouts|comments|friends` query directly instead of building the whole user first. Add/remove friend return a summary of the other user (`friend` / `unFriended`).
  - `Route.to_dict()` / `Workout.to_dict()` are now one small shape everywhere (list, detail, create, update): no `comments` array (use `/api/routes/<id>/comments`), a **`commentCount`**, no `requestData` / `staticMap`, and `ownerInfo` is the public summary **without email**. `commentCount` is a SQL subquery column (`Route.comment_count`, `Workout.comment_count`, defined in `app/models/__init__.py`) loaded in the same SELECT as the row.
  - `Comment.to_dict()` uses its own `route_id` / `workout_id` columns instead of loading the route or workout just to read its id (that was one extra query per comment).
  - All timestamps in the API are now ISO 8601 UTC (`2026-11-24T09:30:00Z`) via `iso()` in `app/models/db.py` (before: RFC 822 text that could not be sorted, and a pre-formatted "November 2026" for users). The frontend formats them with the new `src/utils/format.js`.
  - Frontend adjustments: `ActivityFeed` uses `routeCount + workoutCount`, `commentCount` and formatted dates; `RouteDisplay` builds its Directions request from `startingPoint` / `endingPoint` / `travelMode` (it used `requestData`); the owner e-mail line was removed from the route and workout pages.
- **Files:** `app/models/{db,user,route,workout,comment,__init__}.py`, `app/api/{auth_routes,user_routes,me_routes}.py`, `react-app/src/utils/format.js` (new), `react-app/src/components/ActivityFeed/ActivityFeed.jsx`, `react-app/src/components/RouteDisplay/RouteDisplay.jsx`, `react-app/src/components/WorkoutDisplay/WorkoutDisplay.jsx`
- **How to verify:**
  1. Log in as the demo user, open DevTools > Network: `/api/auth/` is about 1 KB (was 27 KB); `/api/users/` about 1 KB (was 68 KB); the feed still shows comment counts, dates and distances.
  2. `curl`-style check (after login): `/api/routes/3` has `commentCount` and no `comments`; `ownerInfo` has no `email`.
  3. Friend / unfriend a user on their profile page: lists refresh as before.
  Verified with a test-client script (28 checks: shapes, counts, ISO dates, create/update/delete with comments, friend add/remove, signup payload) plus all Batch 1-2 test scripts (85 checks, all still pass). Measured on the seeded database, queries / bytes before -> after: `/api/auth/` 34 / 27 KB -> 5 / 1.1 KB; `/api/users/` 65 / 68 KB -> 2 / 0.9 KB; `/api/routes/` 26 / 35 KB -> 6 / 13 KB; `/api/workouts/` 16 / 12 KB -> 6 / 5.9 KB; `/api/me/friends/activity` 46 / 28 KB -> 11 / 11 KB (A25 removes the remaining per-row queries). The jsdom page smoke test renders every page as before (the two known `/routes` and `/users` crashes are fixed later in Y2).
- **Things to watch:**
  - API consumers (only the React app here) must use `commentCount` instead of `comments`, and read dates as ISO strings. A page that needs the comments of a route calls `/api/routes/<id>/comments`.
  - The e-mail address of other users is no longer sent to the browser at all. That is a privacy improvement; only `/api/auth/` returns your own.
  - `friends[].userId` is kept next to `id` for now; new code should use `id`.

## A25 — Fix N+1 queries with eager loading
- **Problem:** "N+1" means one query to get a list plus one more query for every row in it. The list endpoints loaded each route's/workout's/comment's owner lazily (one query per distinct owner), and `/api/me/friends/activity` ran **two queries per friend** inside a Python loop. Query count grew with the data, which is slow on Postgres where every query is a network round trip.
- **What changed:**
  - `/api/routes/`, `/api/workouts/`, `/api/comments/`, `/api/routes/<id>`, `/api/workouts/<id>` use `joinedload(...users)` so the owner comes back in the same SELECT. Lists are explicitly ordered by id (before: whatever order the database returned).
  - `/api/routes/<id>/comments` is now a single query for the comments with their authors (`joinedload(Comment.users)`), ordered by id, instead of walking `route.comments` and loading each author separately.
  - `/api/me/friends/activity`: one query for the friend ids, then one query for all their routes and one for all their workouts (`user_id IN (...)`, newest first, ties broken by id). It returns the same `{routes, workouts}` shape.
  - The "suggested friends" filter by id in SQL was already done in A24; `commentCount` is a subquery column (A24), so counting comments needs no extra query.
- **Files:** `app/api/{route_routes,workout_routes,comments_routes,me_routes}.py`
- **How to verify:** with SQL echo on (`SQLALCHEMY_ECHO=1` in `.env`, or `flask shell` and an engine event) open the feed: the number of queries is the same whether the database has 20 routes or 80. Verified by a test that counts the queries of 10 endpoints, adds 30 routes + 30 workouts + 60 comments across all users, and asserts the counts did not change: `/api/routes/` 2, `/api/workouts/` 2, `/api/comments/` 2, feed 4 (was 46 on the seeded data and growing), `/api/auth/` 5, `/api/users/2` 5, route comments 3 (14 checks). All earlier test scripts still pass.
- **Things to watch:** The feed endpoint is only friends' activity, as before (not your own posts). Pagination of these lists comes in A27.

## A27 — Pagination
- **Problem:** Every list endpoint returned every row. The feed, the routes list, the workouts list and the comments list all grow without limit, and the feed rendered every friend's activity in one go.
- **What changed:**
  - New `app/api/pagination.py` with **cursor (keyset) pagination**: `?limit=N&cursor=...`. A cursor remembers the last row seen (its `created_at` and `id`) and asks for "rows older than that", which uses the A26 `created_at` index, stays fast on deep pages and does not repeat or skip rows when new posts arrive while someone is scrolling (offset paging does). `limit` must be 1..100 (feed: 1..50), otherwise `400 {"errors": [...]}`; a malformed `cursor` is also a 400.
  - `/api/routes/`, `/api/workouts/`, `/api/comments/`: **without** `limit` they still return every row (ordered by id) because the home map needs every route marker; with `limit` they return one page, newest first. Every answer now includes `nextCursor` (`null` when there is no next page or no paging was asked for).
  - `/api/me/friends/activity` is now the real feed: routes and workouts **mixed and sorted newest first**, answer `{items: [{kind: 'route'|'workout', ...}], nextCursor}`. `?scope=friends` (default, friends only) or `?scope=all` (everyone, what the old "All Activity" dropdown showed), default `limit` 20, max 50. Ties in `created_at` are broken the same way on every page (route before workout, then id), and that rank is part of the cursor, so no item is shown twice or lost. Per page it is still 3 queries (friend ids, routes, workouts).
  - Frontend: the `friendsActivity` slice now holds `{items, nextCursor, scope, loadingMore}` with `getFeed(scope)` (first page, replaces) and `getMoreFeed()` (next page, appends). `ActivityFeed` shows 10 items and a **Load more** button; the Following / All Activity dropdown just loads the right scope from the server (before it merged the routes/workouts of the whole store in the browser), and the card type comes from `kind` instead of guessing from `startingPoint`. A route whose map thumbnail is not available now still renders as a route card (before it fell into the workout layout and linked to `/workouts/<route id>`). The thumbnail loop only fetches routes it has not fetched yet (A28 removes it completely).
- **Files:** `app/api/pagination.py` (new), `app/api/{route_routes,workout_routes,comments_routes,me_routes}.py`, `react-app/src/store/friendsActivity.js`, `react-app/src/components/ActivityFeed/ActivityFeed.jsx`
- **How to verify:**
  1. Open `/activity`: 10 cards and a "Load more" button (it disappears when there is nothing left). Switch the dropdown to "All Activity": the list reloads from the server.
  2. In DevTools > Network, `/api/me/friends/activity?scope=friends&limit=10` and, after clicking Load more, `...&cursor=<opaque string>`.
  3. `GET /api/routes/?limit=3` gives 3 routes and a `nextCursor`; pass it back as `&cursor=` until it is `null`.
  Verified by a test-client script (49 checks): walking every list with limit 1, 3, 7, 10 and 100 returns each row exactly once, newest first, **including rows with identical timestamps** (deliberately created); the feed in both scopes is identical whether read in one page or in many; own posts are excluded from `friends` and included in `all`; bad `limit` / `cursor` / `scope` give 400. jsdom smoke test renders the feed from a paged response.
- **Things to watch:**
  - The home map still downloads all routes (unpaginated) because it shows all markers. If the number of routes ever gets large, give that endpoint a bounding-box filter instead of paging.
  - The feed's `routes` / `workouts` keys are gone (replaced by `items`); only the React app consumed them.
  - Cursors are opaque base64 text; do not build them by hand.

## A31 — Store numbers as numbers
- **Problem:** `distance` ("16.2 km", "12 miles", sometimes just "28.8") and `total_time` ("1 hr 20 min") were free text. You could not sort or add them, compute pace or weekly totals, or switch km/miles, and any garbage was accepted. The seed data also contained impossible workouts (23 miles in 56 minutes) and routes with the travel mode `BIKING`, which Google does not know (it is `BICYCLING`).
- **What changed:**
  - **Database:** new migration `d5e8b3a6c1f2_numeric_distance_duration.py`. `routes` get `distance_m` (float, metres, NOT NULL) and `duration_s` (integer seconds, nullable until A28 fills it); `workouts` get `distance_m` and `duration_s` (both NOT NULL). The migration **parses the existing text** ("16.2 km", "12 miles", "1 hr 20 min", "40 min", "1:20", a bare "28.8" = km, a bare "45" = minutes; anything unreadable becomes 0) and then drops `routes.distance`, `workouts.distance` and `workouts.total_time`. `downgrade()` writes the numbers back as text ("16.2 km", "1 hr 20 min") and drops the numeric columns. It uses batch mode and honours the production `SCHEMA`.
  - **API:** routes and workouts send/receive `distance_m` / `duration_s` (request) and `distanceM` / `durationS` (response). Forms validate: distance 1 m .. 40,000 km, duration 1 s .. 30 days (route duration is optional; editing a route without sending it keeps the stored one). New `app/forms/fields.py`: a JSON `null` / list in a number field is now a normal 400 error instead of a 500.
  - **Seeds:** numeric, with realistic workout paces and `BICYCLING` instead of `BIKING`.
  - **Frontend:** `utils/format.js` formats metres/seconds (`formatDistance`, `formatDuration`, `formatPace`, `formatSpeed`) and converts form values. New `context/Units.jsx` keeps the **km / mi** preference in `localStorage` (first visit: miles for an `en-US` browser, kilometres otherwise) and the navbar got a small `km`/`mi` toggle button. Pages show distances in the chosen unit; the workout page also shows duration and pace. New-route and edit-route read Google's Distance Matrix **number** (`distance.value` metres, `duration.value` seconds) instead of the text, and ignore a failed lookup instead of crashing; new/edit workout turn hours + minutes and distance + unit into seconds/metres (edit starts in your preferred unit and converts if you change the unit box).
- **Files:** `migrations/versions/d5e8b3a6c1f2_numeric_distance_duration.py` (new), `app/models/{route,workout}.py`, `app/forms/{fields,route_form,workout_form}.py`, `app/api/{route_routes,workout_routes}.py`, `app/seeds/{routes,workouts}.py`, `react-app/src/utils/format.js`, `react-app/src/context/Units.jsx` (new), `react-app/src/main.jsx`, `react-app/src/components/{NavBar,User,ActivityFeed/ActivityFeed,RouteDisplay/RouteDisplay,WorkoutDisplay/WorkoutDisplay,WorkoutDisplay/EditWorkoutForm,Map/MapComponent,NewMap/NewRoute,NewWorkout/NewWorkout,MapAdjustment/EditMapForm}.jsx`, `react-app/src/store/routes.js`
- **How to verify:**
  1. **Back up your local database first** (`cp app/dev.db app/dev.db.bak`), then `flask db upgrade`. Open a route and a workout you created earlier: the distance shows in km/mi and matches what you typed. `flask db downgrade` and `upgrade` again both work.
  2. Click the `km`/`mi` button in the navbar: every distance changes; reload and it is remembered.
  3. Create a workout (e.g. 1 h 5 min, 10 km): the workout page shows `1 h 5 min (6:30 /km)`. Edit it, switch the unit to miles: the number converts.
  4. New route with a Maps key: distance is recorded as a number (the form shows an error if Google could not calculate it).
  Verified: migration test on an old-shaped SQLite database (3 routes, 3 workouts with messy text: converted values, NOT NULL, text columns gone, downgrade restores text, re-upgrade; 36 checks incl. the parsers); API test (22 checks: numeric shapes, rejects 0 / negative / text / null / huge, duration optional on routes, owner cannot be changed); all earlier scripts updated to the new payloads and passing; node check of the formatters (14 assertions); jsdom smoke test renders every page.
- **Things to watch:**
  - The migration rewrites data. Back up production first (`pg_dump`) and try it on a copy; it was run on SQLite only.
  - Text such as "about 5" without a unit is read as kilometres; unreadable values become 0 (they show as "0.0 km"). Look at rows with distance 0 after upgrading: `SELECT id, title FROM routes WHERE distance_m = 0;`.
  - Route `duration_s` stays empty for older routes until A28 computes it (the route page then simply omits "about ...").

## A28 — Compute route polylines once, on the server
- **Problem:** `ActivityFeed` fetched the Google Directions **web service** from the browser, one request after another, for every route on screen, every time the list changed. That costs money per call, is slow (serial), is normally blocked by browser CORS rules and needs an unrestricted key, so the thumbnails mostly never appeared (and a route without a thumbnail was drawn as a workout card).
- **What changed:**
  - **Server:** new `app/services/directions.py`. When a route is created, or edited so that its start, end or travel mode changed, Flask calls Directions **once** with `GOOGLE_MAPS_SERVER_KEY` and stores the result on the route: `encoded_polyline` (new text column, migration `e6f9c4b7d2a3_route_polyline.py`), plus the real `distance_m` and `duration_s` (sums of the legs; these replace the client's Distance Matrix numbers). A rename or description edit does **not** call Google. Without a key, or if Google or the network fails, the route is still saved (no polyline, client numbers kept, and a stale old polyline is cleared); the API key is never logged or returned. Only `WALKING` and `BICYCLING` are supported.
  - **API:** a route has a `polyline` field in the detail, create/update, feed and profile answers; the home-map list (`/api/routes/`) leaves it out to stay small.
  - **Backfill:** `flask directions backfill [--all]` computes the polyline for existing routes (needs the key).
  - **Frontend:** new `utils/polyline.js` (decoder + projection) and a `RouteSketch` component: an SVG drawing of the stored line on a soft grid with a start dot and a finish ring (a dashed straight line when a route has no polyline). The feed now draws these instead of loading Static Maps images, so it makes **no Google requests at all** and thumbnails appear instantly.
- **Files:** `app/services/{__init__,directions}.py` (new), `app/models/route.py`, `app/api/route_routes.py`, `app/config.py`, `app/__init__.py`, `.env.example`, `migrations/versions/e6f9c4b7d2a3_route_polyline.py` (new), `react-app/src/utils/polyline.js` (new), `react-app/src/components/RouteSketch/*` (new), `react-app/src/components/ActivityFeed/ActivityFeed.jsx`
- **How to verify:**
  1. Create a server key in Google Cloud (Directions API only, restricted by IP), put `GOOGLE_MAPS_SERVER_KEY=...` in `.env`, `flask db upgrade`, then `flask directions backfill`.
  2. Open `/activity`: route cards show a line sketch; DevTools > Network shows no `maps.googleapis.com` requests from that page.
  3. Create a new route: `GET /api/routes/<id>` has a `polyline`; editing only the title does not trigger a Directions call.
  Verified without a real key (none available): a test replaces the HTTP function with a fake Google answer and checks 17 things: no key = no call and the client distance is kept; with a key exactly one call with the right origin/destination/mode; polyline and summed distance/duration are stored; the key never appears in a response; rename = no call; moving a point or changing the mode = a new call; `ZERO_RESULTS`, a network error and a malformed answer all still save the route; the backfill command fills every route and complains without a key. Migration upgrade/downgrade tested on SQLite. The decoder passes Google's documented example (`_p~iF~ps|U_ulLnnqC`); the jsdom smoke test shows the feed with no Google requests. A real Directions call was **not** made.
- **Things to watch:**
  - Create/edit now wait for Google (5 second timeout) before answering. That is fine for a few users; a background job would be the next step if it ever matters.
  - Billing: one Directions request per route save (not per page view), which is the whole point.
  - Old routes have no polyline until you run the backfill; they show the dashed straight-line sketch.

## A29 — Stop the `RouteDisplay` re-request loop
- **Problem:** `<DirectionsService options={{...}} callback={setResponse}>` got a new options object on every render, and the page's `useEffect` depended on `response`, so each Directions answer re-fetched **all routes** and could trigger the next request. Worse, the `<DirectionsService>` and `<DistanceMatrixService>` components from `@react-google-maps/api` are class components whose `componentDidUpdate` calls Google **on every re-render** (checked in the library source), so the edit-route form sent a billable Distance Matrix request for every keystroke in the title box.
- **What changed:**
  - New `src/hooks/useDirections.js` with two hooks that call Google's services imperatively **only when the places or travel mode really change**: `useDistanceMatrix(start, end, mode)` (new route + edit route) and `useFallbackDirections(...)` (one Directions request for old routes that have no stored path).
  - `RouteDisplay` no longer uses `DirectionsService` or reloads all routes: it loads **just the current route**, decodes the stored polyline (A28) and draws it with `<Polyline>` plus start/finish markers, then zooms the map to the route (`fitBounds`). Routes without a stored polyline use the fallback hook once and show the result with `DirectionsRenderer`. It also no longer shows the previously opened route while the next one loads.
  - `NewRoute` and `EditMapForm` use the Distance Matrix hook (distance/duration are derived values now, not state set from a callback). The `setResponse` / `setLoaded` props that existed only to restart the old loop were removed from `MapAdjustment`, `EditMapModal` and `EditMapForm`. New `src/theme.js` holds the few colours JavaScript needs for map lines.
- **Files:** `react-app/src/hooks/useDirections.js` (new), `react-app/src/theme.js` (new), `react-app/src/components/RouteDisplay/RouteDisplay.jsx`, `react-app/src/components/NewMap/NewRoute.jsx`, `react-app/src/components/MapAdjustment/{EditMapForm,EditMapModal,MapAdjustment}.jsx`
- **How to verify:** with a Maps key, open a route page and watch DevTools > Network: at most **one** `directions` request for an old route (none for a route with a stored polyline) and no repeated `/api/routes/` calls; open Edit on your route and type in the title box: no Distance Matrix requests while typing, one when you drag a marker.
  Verified: build OK; jsdom page smoke test (route page requests only `/api/routes/1` and its comments, not the whole route list); a fake-Maps render test shows the home map markers and the new-route map still render. Real Google responses were **not** exercised (no key here).
- **Things to watch:** The route page's map uses the polyline from the server, so it only matches Google's current roads at the time the route was saved. Re-saving a route (or `flask directions backfill --all`) refreshes it.

## A30 — Frontend bundle and loading
- **Problem:** One 500 KB JavaScript file (138 KB gzipped) contained every page and the whole Google Maps library, and the Maps script was downloaded even on the login page. After login the app also fetched **every route and workout** before showing anything (nothing needed them any more after A24-A27). Uploaded photos were stored at their full camera size, and nothing told the browser how long it may keep the built files.
- **What changed:**
  - **Lazy pages:** every page except login is loaded with `React.lazy` (one small JavaScript file each, with a "Loading..." fallback), so the first visit downloads only what it shows.
  - **Maps on demand:** `context/GoogleMaps.jsx` no longer imports the Maps library. The first component that calls `useGoogleMaps()` (a map page) triggers a lazy `MapsLoader` (`context/MapsLoader.jsx`), which is the only place that runs `useJsApiLoader` (still exactly one loader, one stable `libraries` array). The Maps library and the Google script are therefore not downloaded on the login page, feed, profiles or workout pages. Main bundle: **500 KB -> 284 KB (138 -> 90 KB gzipped)**.
  - **No preload:** `App.jsx` only restores the session before rendering; the "fetch all workouts and routes first" step was removed (pages load their own data), so the first screen appears one request earlier.
  - **Lazy images:** `loading="lazy"` and `decoding="async"` on feed and profile images.
  - **Smaller uploads:** `shrink_image()` in `app/s3_helpers.py` scales photos whose longer side is over 1600 px down to 1600 px (same format, JPEG quality 85, EXIF rotation applied first); smaller images and animated GIFs are stored untouched; any error keeps the original. A 4000 px phone photo goes from several MB to a few hundred KB.
  - **Browser caching:** when Flask serves the React build, files under `/assets/` (their names contain a content hash) get `Cache-Control: public, max-age=31536000, immutable`, and HTML (`index.html` and deep links like `/routes/3`) gets `no-cache`. API responses are untouched. (The same rule is needed in CloudFront once A42 exists.)
- **Files:** `react-app/src/App.jsx`, `react-app/src/context/{GoogleMaps,MapsLoader}.jsx`, `react-app/src/components/{ActivityFeed/ActivityFeed,User}.jsx`, `app/s3_helpers.py`, `app/api/img_routes.py`, `app/__init__.py`
- **How to verify:**
  1. `npm run build`: the output lists a dozen small page files next to a main `index-*.js` of about 284 KB.
  2. Open the login page with DevTools > Network: no `maps.googleapis.com` request and no `MapsLoader` file; open `/` after logging in: the Maps script appears once.
  3. Upload a large photo on "+ Workout": the stored image is at most 1600 px wide.
  Verified: build sizes as above; jsdom smoke test (all pages render through the lazy boundary, route list is requested by the home page only) and the fake-Maps test (still one loader call per page, one `libraries` array); upload test (JPEG/PNG/WebP 3200x2000 -> 1600x1000 same format, 800x600 untouched, EXIF-rotated phone photo comes out upright, animated GIF byte-identical); cache-header test with a temporary `dist/` (assets immutable, index.html and a deep link `no-cache`, API not marked).
- **Things to watch:**
  - In `npm run dev` each page is its own module anyway; the savings are visible in the production build.
  - Existing images already in S3 are not shrunk (only new uploads).
  - The seeded demo images still point at the old third-party bucket until A36.

## Y4 — Logout is a POST (CSRF-protected)
- **Problem:** `GET /api/auth/logout` changed state. Any web page can make your browser send a GET (`<img src="https://aktiv.example/api/auth/logout">`), so another site could log you out at will ("logout CSRF"), and GET requests are also prefetched, cached and logged by proxies. Every other write in the app already needed the CSRF token (A6).
- **What changed:** the route accepts **POST only** and, like every POST/PUT/DELETE, requires the `X-CSRFToken` header (global CSRF protection from A6), so a forged request from another site gets 400. The frontend `logout` thunk now sends `method: 'POST'` through `csrfFetch`, which adds the header.
- **Files:** `app/api/auth_routes.py`, `react-app/src/store/session.js`
- **How to verify:** click Logout in the app: you land on the login page. In DevTools > Network the request is `POST /api/auth/logout` with an `X-CSRFToken` header. Opening `/api/auth/logout` in the address bar no longer logs you out.
  Verified with a test-client script (8 checks): GET does not log out; POST without a token and with a wrong token give 400 and the session survives; POST with the token gives 200 and the session is gone; logging out twice is harmless. The jsdom smoke test clicks Logout and lands on the login page.
- **Things to watch:** anything else that called `GET /api/auth/logout` (bookmarks, scripts) must switch to POST. In production a GET to that URL now falls into the "serve the React app" catch-all and shows the app, which is harmless.

## Y3 — Remove the broken `friends` slice
- **Problem:** `addFriend()` dispatched the friend's *id* to a reducer that expected a friend object, so the id was stored under the key `"undefined"` in `state.friends` (found in A21). Nothing ever read that slice: pages use `session.user.friends` (and `users.currentUser`). It was dead, misleading state. While in there: the friend/unfriend confirmation checked `res.error`, which no response ever has, so a failed request (for example "already your friend", or the server being down) was treated as success and the dialog just closed.
- **What changed:** I chose **removing** the slice rather than fixing it, because it would only duplicate `session.user.friends`. `store/friends.js` now only holds the two thunks `addFriend` / `deleteFriend`; after a successful change they refresh the session user and the profile being viewed (awaited, so the page is current when the dialog closes). On failure they return `{ errors: [...] }` (from the server's JSON error list, or a generic message) and `AdjustFriendStatusAlert` shows those errors instead of closing. `friends` was removed from the store's reducer map.
- **Files:** `react-app/src/store/friends.js`, `react-app/src/store/index.js`, `react-app/src/components/AdjustFriendStatus/AdjustFriendStatusAlert.jsx`
- **How to verify:** open another user's profile, click "Friend User" then "Are you sure?": the button flips to "Unfriend User" and they appear in your friends list. With Redux DevTools the state has no `friends` key. Adding the same friend twice in two tabs shows the server's error in the dialog.
  Verified with a store test (mocked API): the state keys are exactly `session, users, comments, workouts, routes, friendsActivity`; add, duplicate add (error returned), remove and duplicate remove (error returned) behave as described and the serialized state never contains `"undefined"`.
- **Things to watch:** nothing else depended on the slice. The dialog styling is redone in the design pass (A34).

## Y1 — Workout comments (made real end to end)
- **Problem:** The workout page reused the *route* comment components, which always called `GET /api/routes/<id>/comments`, so `/workouts/3` showed the comments of **route** 3 (ids overlap). Adding a comment on a workout posted to the right endpoint but then the list showed the wrong thing. The frontend also had a `getWorkoutComments` thunk calling `GET /api/workouts/<id>/comments`, which did not exist (405). The "Workout comments GET" open question from A8.
- **Decision and why:** I made workout comments real instead of removing them. The data model already supports them (`comments.workout_id`, the `Workout.comments` relationship, `commentCount` on workouts, `POST /api/workouts/<id>/comments`, editing/deleting through `/api/comments/<id>`, workout comments in the seed data and in the feed's comment counts), so the only missing pieces were the GET endpoint and the UI wiring. Removing them would have meant deleting working features and seed data.
- **What changed:**
  - **Backend:** `GET /api/workouts/<id>/comments` (oldest first, authors joined in one query, 404 JSON for a missing workout), next to the existing route one.
  - **Frontend:** `Comments`, `AddCommentModal` and `AddCommentForm` take a `kind` (`'route'` default, or `'workout'`) and use the matching thunk (`getWorkoutComments` / `newWorkoutComment`, `getRouteComments` / `newRouteComment`). `WorkoutDisplay` passes `kind='workout'`. `newWorkoutComment` used to return the new comment on success, which the form treated as an error list; both create thunks now return `null` on success and an error list on failure (and a generic message on a server error).
- **Files:** `app/api/workout_routes.py`, `react-app/src/store/comments.js`, `react-app/src/components/{Comments/Comments,AddCommentModal/AddCommentModal,AddCommentForm/AddCommentForm,WorkoutDisplay/WorkoutDisplay}.jsx`
- **How to verify:** open a workout (e.g. `/workouts/3`) and compare with `/routes/3`: the comment lists are different. Add a comment on the workout: it appears there and not on the route; edit and delete it with the pencil icon.
  Verified: a test-client script (16 checks) with route 3 and workout 3 sharing the id 3: comments never mix (`workoutId` vs `routeId`), POST/edit/delete work, other users get 403 when editing yours, an empty body is a 400, `commentCount` matches, and deleting a workout removes its comments. The jsdom smoke test shows workout 1's comment (and not route 1's) on `/workouts/1`.
- **Things to watch:** `comments` has no database rule forcing exactly one of `route_id` / `workout_id` to be set; the API only ever sets one. A `CHECK` constraint could be added in a later migration.
