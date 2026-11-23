# Aktiv (Strava clone) - Modernization Plan

Audit date: 2026-11-23. Audited commit: `6e90f5f` on `main` (working tree clean). No code was changed during the audit; this file is the only new file.

**Total items: 58** (A1 - A58). Each item is meant to be one git commit and can be approved or rejected on its own (dependencies are listed where they exist).

## Top 5 recommendations

1. **A1 + A2 - Rotate the committed Flask `SECRET_KEY` and stop tracking `app/dev.db`.** A real-looking 68-character secret sits in `.env.example` and in git history; anyone who reuses it can forge session cookies.
2. **A3 - Add ownership checks to the edit endpoints.** Today any logged-in user (including the public demo account) can edit *anyone's* route or workout with a `PUT` request.
3. **A4 + A6 - Lock down uploads and make CSRF protection real.** The image upload endpoint needs no login and has no size limit; the CSRF check currently compares the cookie with itself, so it protects nothing.
4. **A24 + A25 - Slim the JSON the API sends.** Every page load calls `/api/auth/`, which serializes *every user with all their routes, workouts and comments*. That is effectively "dump the whole database" on each refresh and will get slower as data grows.
5. **A19 + A37/A38 - Move the frontend from Create React App to Vite and add Docker Compose.** CRA is abandoned (webpack 4, `npm audit` reports 201 known vulnerabilities in the lockfile: 19 critical, 63 high). Docker Compose gives you a one-command local stack that is the same shape as the EC2 deployment.

## Recommended order (phases)

| Phase | Items | Why this order |
|---|---|---|
| 1. Stop the bleeding | A1, A2, A3, A4, A6, A7, A8, A9 | Security and data bugs, small, low risk. |
| 2. Local Docker stack | A37, A38, A39, A11, A13 | Gives you a reproducible environment before bigger upgrades. |
| 3. Safety net | A16, A49, A50, A52, A53 | App factory + tests + CI so later upgrades are verified automatically. |
| 4. Backend upgrades | A17, A18, A47, A15, A26, A24, A25, A27, A31, A10, A12, A28 | Flask 3 / SQLAlchemy 2, DB cleanup, performance. |
| 5. Frontend upgrades | A14, A19, A20, A22, A23, A29, A30, A51, A21 (optional) | Vite, React 19, router v7, maps fixes. |
| 6. Look great | A32-A36 | Responsive, accessible, polished UI. |
| 7. AWS | A5, A40-A48 | Terraform, EC2, S3/CloudFront, backups, deploy pipeline. |
| 8. Docs | A54-A58 | README, env docs, screenshots, live link. |

---

## Quick glossary

- **Docker image / container**: an image is a packaged snapshot of your app plus its OS libraries; a container is a running copy of it. `Dockerfile` = recipe for the image.
- **Docker Compose**: a YAML file (`docker-compose.yml`) that starts several containers together (here: Flask API + Postgres) with one command.
- **EC2**: a rented Linux virtual machine on AWS. **Elastic IP (EIP)**: a fixed public IP for it. **EBS**: the VM's disk. **Security Group (SG)**: the VM's firewall.
- **IAM role**: AWS permissions attached to a machine instead of storing access keys in a file.
- **S3**: file storage ("buckets"). **CloudFront**: AWS's CDN (content delivery network) - caches files near users and gives you HTTPS.
- **OAC (Origin Access Control)**: lets CloudFront read a *private* S3 bucket so the bucket never has to be public.
- **ACM**: free TLS (HTTPS) certificates from AWS. CloudFront certificates must live in `us-east-1`.
- **SSM Parameter Store / Session Manager**: free-tier AWS services to store secrets and to get a shell on EC2 without opening SSH port 22.
- **Terraform**: code that describes your AWS resources; `terraform apply` creates/updates them so your infrastructure is versioned like your app.
- **CSRF**: a malicious site making your logged-in browser send a request to Aktiv. Defended by a secret token the attacker's site cannot read.
- **N+1 query**: loading a list (1 query) then running another query for each item (N queries).

---

## Critical fixes & security

### A1. Rotate and remove the committed `SECRET_KEY`
- **What**: Replace the real value in `.env.example` with a placeholder (`SECRET_KEY=change-me`), generate a new key for every environment (`python -c "import secrets; print(secrets.token_hex(32))"`), and make the app refuse to start in production if `SECRET_KEY` is missing or equals the placeholder. Add `.env.*` (except `.env.example`) and `*.db` to `.gitignore`.
- **Why**: Flask signs session cookies with this key. The committed value is a 68-char random-looking string (value not reproduced here) and it is in git history, so treat it as public forever. Do not reuse it anywhere.
- **Files**: `.env.example`, `app/config.py`, `.gitignore`
- **Risk**: low. **Effort**: S. **Depends on**: none.
- **Note**: Optional history rewrite (`git filter-repo`) is not required once the key is rotated; decide in Open Questions.

### A2. Stop tracking `app/dev.db`
- **What**: `git rm --cached app/dev.db`, add `*.db` to `.gitignore`. Local dev moves to Postgres in Docker (A38); SQLite stays possible but untracked.
- **Why**: Committed database files cause merge conflicts and leak data (it contains the 5 seeded users with password hashes). It also hides migration drift.
- **Files**: `app/dev.db`, `.gitignore`
- **Risk**: low. **Effort**: S. **Depends on**: none.

### A3. Ownership checks on update endpoints (confirmed bug)
- **What**: In `update_route` and `update_workout`, return 404 if the record does not exist and 403 if `record.user_id != current_user.id`. Replace `set_kwargs(**form.data)` with an explicit list of allowed fields (today `form.data` also contains `csrf_token`, and a future form field could overwrite `user_id`).
- **Why**: Currently any authenticated user can edit any other user's route/workout. Since the demo login is public, anyone on the internet can deface data.
- **Files**: `app/api/route_routes.py`, `app/api/workout_routes.py`, `app/models/route.py`, `app/models/workout.py`
- **Risk**: low. **Effort**: S. **Depends on**: none.

### A4. Secure the image upload endpoint
- **What**: Add `@login_required` to `/api/img/upload`; set `MAX_CONTENT_LENGTH` (e.g. 5 MB); allow only image types (drop `pdf`) and verify the bytes really are an image (Pillow `Image.verify()`); fix `get_unique_filename` which builds `"<uuid>,<ext>"` with a **comma** instead of a dot (confirmed bug: files are stored as `abc123,jpg`); return `https://` URLs instead of `http://`; store under an `uploads/` key prefix; show an error message in the UI when upload fails (currently silent).
- **Why**: Anyone can currently upload unlimited files of any size to your S3 bucket at your cost.
- **Files**: `app/api/img_routes.py`, `app/s3_helpers.py`, `app/config.py`, `react-app/src/components/ImageUploadComponenet/ImageUploadComponent.js`, `requirements.txt` (Pillow)
- **Risk**: low. **Effort**: S. **Depends on**: none.

### A5. Modern S3 access: IAM role, no ACLs
- **What**: Stop passing `S3_KEY`/`S3_SECRET`; let boto3 pick up credentials from the EC2 IAM role (and from `~/.aws` or env locally). Remove `ACL: public-read` (new S3 buckets have ACLs disabled and uploads with an ACL fail). Serve uploads through CloudFront (OAC) or a bucket policy that allows public read only on `uploads/*`. Create the boto3 client lazily instead of at import time.
- **Why**: Long-lived access keys in a `.env` on a server are the most common way AWS accounts get compromised. ACL uploads will simply error on a fresh bucket.
- **Files**: `app/s3_helpers.py`, `app/config.py`, `.env.example`, Terraform (A44)
- **Risk**: med (upload path changes). **Effort**: S. **Depends on**: A4; A44 for prod.

### A6. Make CSRF protection real
- **What**: Enable `CSRFProtect(app)` globally; set the `csrf_token` cookie as **not** `httponly` so the React app can read it and send it in an `X-CSRFToken` header on every POST/PUT/DELETE (one small `apiFetch` helper in `react-app/src/store/`). Remove the 8 copies of `form['csrf_token'].data = request.cookies['csrf_token']`.
- **Why**: The server currently takes the token from the cookie and compares it to... the same cookie. A forged cross-site request carries the cookie automatically, so the check always passes. Only SameSite=Strict (prod only) was protecting you. Also, `request.cookies['csrf_token']` raises `KeyError` -> HTTP 500 when the cookie is missing (first request, cleared cookies).
- **Files**: `app/__init__.py`, all `app/api/*_routes.py` with forms, `react-app/src/store/*.js`, `ImageUploadComponent.js`
- **Risk**: med (every write request touched; test demo login, create/edit/delete, comments, friends). **Effort**: M. **Depends on**: none (easier after A50 tests exist).

### A7. Fix add/remove friend logic (confirmed bug)
- **What**: In `add_user_friends`, the "already friends" check and the `append` both live *inside* the `for` loop: if you have zero friends the loop never runs and the view returns `None` (Flask raises a 500); otherwise it only compares against the first friend. Rewrite using `if user in curr_user.followers`. Prevent friending yourself. In `unfriend_user`, check for `None` before calling `to_dict()`. Return 404/409 status codes. Fix seeds where `jimmy` and `tammie` follow themselves.
- **Why**: Friends feature fails for new users (exactly who would try it).
- **Files**: `app/api/user_routes.py`, `app/seeds/users.py`
- **Risk**: low. **Effort**: S. **Depends on**: none.

### A8. Consistent 404s, status codes, and the "newest row" race
- **What**: Use `db.get_or_404()` / explicit checks in `one_route`, `one_workout`, `one_comment`, `add_comment_to_route`, `add_comment_to_workout`, `update_comment`, `get_comments_to_route` (all currently crash with `AttributeError` -> 500 for a missing id). Return 400/422 for validation errors (currently 401, which the frontend may treat as "logged out"), 403 for "not yours" (currently 200 with an error body). `add_route`/`add_workout` return "the newest row in the table" after insert - with two users posting at once you can get someone else's record; just return the object you created. Make `add_comment_to_workout` return the same error shape as the rest.
- **Files**: `app/api/route_routes.py`, `app/api/workout_routes.py`, `app/api/comments_routes.py`, `app/api/user_routes.py`, `react-app/src/store/*.js` (status handling)
- **Risk**: low-med. **Effort**: S. **Depends on**: none.

### A9. Auth hardening
- **What**: Login returns a single generic "Invalid email or password" (currently reveals which emails exist); use `PasswordField`, `Email()` and `Length()` validators that match column sizes (e.g. route/workout `title` is `String(30)` in the DB but unvalidated, so long titles 500 on Postgres); minimum password length on signup; set `SESSION_COOKIE_SECURE/HTTPONLY/SAMESITE=Lax` and the same for Flask-Login's remember cookie; optional rate limiting on `/api/auth/login` with Flask-Limiter. Keep the demo account working (demo password stays as seeded; consider making the demo account read-only or auto-reset nightly).
- **Files**: `app/forms/*.py`, `app/api/auth_routes.py`, `app/config.py`
- **Risk**: low. **Effort**: S. **Depends on**: none.

### A10. Remove or restrict CORS
- **What**: Delete `CORS(app)` (and `flask-cors`) if CloudFront serves the frontend and proxies `/api/*` to EC2 on the same domain (recommended, see A42). Otherwise restrict to your exact frontend origin with `supports_credentials=True`.
- **Why**: Same-origin is simpler and keeps cookies + CSRF working without cross-site cookie headaches.
- **Files**: `app/__init__.py`, `requirements.txt`
- **Risk**: low. **Effort**: S. **Depends on**: A42 decision.

### A11. Configuration cleanup
- **What**: `SQLALCHEMY_ECHO = True` is on in production (logs every SQL statement, slow and noisy) - only enable in dev. `os.environ.get('DATABASE_URL').replace(...)` crashes with `AttributeError` if unset - give a clear error. `FLASK_ENV` was removed in Flask 2.3; switch to an `APP_ENV` variable and `Config` classes (Dev/Test/Prod). Remove the Heroku-era `https_redirect` (CloudFront/Caddy handle HTTPS). Hide `/api/docs` in production or keep it intentionally. Add `SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True}` so dropped DB connections recover.
- **Files**: `app/config.py`, `app/__init__.py`, `app/models/db.py`, `.flaskenv`, `.env.example`
- **Risk**: low-med. **Effort**: S. **Depends on**: none (pairs with A16).

### A12. Google Maps API key handling
- **What**: Use two keys. (1) **Browser key** for Maps JavaScript + Static Maps, restricted in Google Cloud Console by HTTP referrer (your CloudFront domain + `localhost`) and by API. It is public by nature, so inject it at build time (`VITE_GOOGLE_MAPS_API_KEY` from CI secrets / local `.env.local`, never committed) instead of returning it in every `/api/auth` response and the `/api/map/key` endpoint. (2) **Server key** (IP-restricted to the EC2 Elastic IP, Directions API only) used by A28. Set a billing budget alert. The key is not committed anywhere today (checked current tree and full history), keep it that way.
- **Files**: `app/api/auth_routes.py`, `app/api/map_routes.py`, `react-app/src/store/map.js`, map components, `.env.example`, `react-app/.env.example`
- **Risk**: low. **Effort**: S. **Depends on**: A19 (Vite env naming) or do with `REACT_APP_` first.

### A13. Remove dead code and unused packages
- **What**: Delete `components/BackendTestComponents/`, commented-out routes and debug prints, the stub `store/currentRoute.js` code, the raw `<script src="maps.googleapis.com...callback=initMap">` tags rendered inside JSX in 4 map components (they do nothing - `useLoadScript` already loads Maps - and risk double-loading), `require('dotenv').config()` in `index.js` (Node-only, does nothing in a browser). Unused npm deps: `google-maps`, `google-map-react`, `@googlemaps/react-wrapper`, `static-google-map`, `dotenv`, `dotenv-webpack`, `http-proxy-middleware` (verify each with grep before removal). Unused Python deps: `GeoAlchemy2` (no import anywhere in `app/`), `autopep8`/`pycodestyle` (move to dev).
- **Why**: Smaller bundle, fewer vulnerabilities, less confusion.
- **Files**: `react-app/src/**`, `react-app/package.json`, `package-lock.json`, `requirements.txt`, `Pipfile`
- **Risk**: low. **Effort**: S. **Depends on**: none.

### A14. Fix App.js routing and preload bugs (confirmed)
- **What**: The `useEffect` in `App.js` checks `user` from the first render (always `null`), so routes/workouts are never preloaded there. `<>...</>` Fragments inside `<Switch>` defeat Switch matching (no single-match, no 404 page possible). Restructure into proper protected routes, add a NotFound page, redirect logged-out users to login.
- **Files**: `react-app/src/App.js`, `components/auth/ProtectedRoute.js`, new `components/NotFound.js`
- **Risk**: low-med. **Effort**: S. **Depends on**: none (redo in v7 syntax if done after A22).

### A15. Reconcile database migrations with models
- **What**: The single migration creates `workouts.route_id`, which the model does not have; `follows` has no primary key; `upgrade()` has commented `drop_table` lines from earlier hacks. Add a new migration that drops `route_id` (or adds it to the model if a workout should link to a route), makes `(follower_id, followed_id)` the composite primary key with `ON DELETE CASCADE`, and adds `server_default` timestamps. Verify `flask db migrate` produces an empty diff afterwards.
- **Files**: `migrations/versions/*`, `app/models/*.py`
- **Risk**: med (schema change; test on a copy first). **Effort**: M. **Depends on**: A18 recommended first; A47 Render schema removal decided.

---

## Dependency upgrades

Current backend pins (Feb 2023) vs latest seen on PyPI today: Flask 2.0.1 -> 3.1.3, Werkzeug 2.0.1 -> 3.1.9, SQLAlchemy 1.4.19 -> 2.0.58, Flask-SQLAlchemy 2.5.1 -> 3.1.1, Flask-Login 0.5.0 -> 0.6.3, Flask-WTF 0.15.1 -> 1.3.0, WTForms 2.3.3 -> 3.2.2, Flask-Migrate 3.0.1 -> 4.1.0, Alembic 1.6.5 -> 1.20.1, gunicorn 20.1.0 -> 27.0.1, boto3 1.26 -> 1.44. Flask 2.0.1, Werkzeug 2.0.1 and gunicorn 20.1.0 all have published security advisories. Frontend: React 17.0.2 -> 19.3.1, react-router-dom 5 -> 7.18.6, react-redux 7 -> 9.3.1, react-scripts 4.0.3 (deprecated) -> Vite 8.x, @react-google-maps/api 2.17 -> 2.20.8. `npm audit --package-lock-only`: 201 vulnerabilities (19 critical, 63 high, 110 moderate, 9 low), almost all from CRA/webpack 4 build tooling.

A throwaway Python venv / `npm install` was **not** run (time limits per shell call); versions come from `pip index versions`, `npm view` and the lockfile.

### A16. App factory + single dependency file + Python 3.12
- **What**: Turn the module-level `app = Flask(...)` into `create_app(config_name)`; move `login`/`migrate` extensions to `app/extensions.py`. Delete the `Pipfile`/`Pipfile.lock` (they disagree with `requirements.txt`: Pipfile says Python 3.9, has no boto3 pin, etc.) and keep one `requirements.txt` (or `pyproject.toml` + `uv`), plus `requirements-dev.txt`. Target Python 3.12 (Docker base image).
- **Why**: Tests need a factory to create an app with a test database; one dependency file avoids "works on my machine".
- **Files**: `app/__init__.py`, new `app/extensions.py`, `requirements*.txt`, `Pipfile*`, `.flaskenv`, `README.md`
- **Risk**: med. **Effort**: M. **Depends on**: A11.

### A17. Flask 3.x stack upgrade
- **What**: Upgrade Flask, Werkzeug, Flask-Login, Flask-WTF, WTForms, Flask-Migrate, Alembic, gunicorn, python-dotenv, boto3; switch `psycopg2` (needs compiler) to `psycopg2-binary` or `psycopg[binary]` 3. Fix breakages: `FlaskForm` meta changes, `app.send_from_directory` (does not exist on the app object in any Flask version - the favicon branch in `react_root` is a latent bug), removed `FLASK_ENV`.
- **Files**: `requirements.txt`, `app/__init__.py`, `app/forms/*.py`
- **Risk**: med. **Effort**: M. **Depends on**: A16, ideally A50 tests.

### A18. SQLAlchemy 2.0 + Flask-SQLAlchemy 3.1 migration
- **What**: Replace `Model.query.get(id)` (legacy, warns in 2.0) with `db.session.get(Model, id)`; move to `db.select()` style queries; wrap raw SQL strings in seeds with `text()` (`db.session.execute("TRUNCATE ...")` **raises an error** in SQLAlchemy 2.0); optional typed `Mapped[]` columns; timezone-aware timestamps (`datetime.now(timezone.utc)` instead of naive `datetime.now`).
- **Files**: `app/models/*.py`, `app/api/*.py`, `app/forms/*.py`, `app/seeds/*.py`, `app/__init__.py`
- **Risk**: med. **Effort**: M. **Depends on**: A16, A17.

### A19. Create React App -> Vite
- **What**: Replace `react-scripts` with Vite (`vite.config.js` with a dev proxy for `/api` -> `localhost:5000`), move `public/index.html` to the root, rename `REACT_APP_*` env vars to `VITE_*`, keep `npm run build` output in `react-app/dist`.
- **Why**: CRA is deprecated; Vite builds in seconds, dev server starts instantly, and it removes most of the 201 audit findings.
- **Files**: `react-app/package.json`, `package-lock.json`, new `vite.config.js`, `index.html`, `src/index.js` -> `src/main.jsx`, files using `process.env`
- **Risk**: med. **Effort**: M. **Depends on**: A13 (fewer deps to port).

### A20. React 17 -> 19 and react-redux 9
- **What**: `ReactDOM.render` -> `createRoot`; update react-redux, redux 5 and redux-thunk 3 (named export `thunk`); fix StrictMode double-effect issues; update `@testing-library/*`.
- **Files**: `react-app/src/index.js`, `src/store/index.js`, `package.json`
- **Risk**: med. **Effort**: M. **Depends on**: A19.

### A21. (Optional) Redux Toolkit / RTK Query
- **What**: Rewrite the 9 hand-written reducer files with `createSlice`, or replace data fetching with RTK Query (built-in caching, loading/error states, de-duplicated requests).
- **Why**: Less boilerplate and fixes the many "refetch everything on every render" patterns. Good learning, but not required.
- **Files**: `react-app/src/store/*`, components using `dispatch`
- **Risk**: med-high. **Effort**: L. **Depends on**: A20. Can be split per slice.

### A22. react-router v5 -> v7
- **What**: `Switch` -> `Routes`, `useHistory` -> `useNavigate`, `component/children` -> `element`, `ProtectedRoute` as a layout route.
- **Files**: `App.js`, `NavBar.js`, every component using `useHistory`/`NavLink`/`Redirect`
- **Risk**: med. **Effort**: M. **Depends on**: A20.

### A23. Google Maps library update
- **What**: Update `@react-google-maps/api` to 2.20.x (or move to Google-endorsed `@vis.gl/react-google-maps`), load Maps once at app level with one `useJsApiLoader` and a stable `libraries` array (currently each of 4 components calls `useLoadScript` separately).
- **Files**: `components/Map`, `NewMap`, `RouteDisplay`, `MapAdjustment`, `package.json`
- **Risk**: med. **Effort**: M. **Depends on**: A20, A12.

---

## Performance

### A24. Slim, purpose-built serializers
- **What**: `User.to_dict()` embeds all routes (each with all comments, each with its user), all workouts, all comments and all friends. `/api/auth/` (called on every page load) and `/login` then run that **for every non-friend user in the database**. Add `to_summary()` (id, username, name, picture) and use it for friends/non-friends/owner info; return lists of ids where the frontend only needs ids; `/api/users/` should not embed routes/workouts.
- **Why**: Response size and query count grow with the whole dataset; this is the single biggest speed win.
- **Files**: `app/models/*.py`, `app/api/auth_routes.py`, `app/api/user_routes.py`, frontend selectors using the nested data
- **Risk**: med (frontend relies on nested shapes - change endpoint by endpoint). **Effort**: M. **Depends on**: A50 tests helpful.

### A25. Fix N+1 queries with eager loading
- **What**: Use `selectinload(Route.comments).joinedload(Comment.users)`, `joinedload(Route.users)` on list endpoints; rewrite `/api/me/friends/activity` (2 queries per friend in a Python loop) as two queries with `Route.user_id.in_(friend_ids)` ordered by `created_at desc`; `non_friends` filter by id (not username) in SQL.
- **Files**: `app/api/me_routes.py`, `route_routes.py`, `workout_routes.py`, `auth_routes.py`, `user_routes.py`
- **Risk**: low-med. **Effort**: M. **Depends on**: A18, A24.

### A26. Add database indexes
- **What**: Alembic migration adding indexes on `routes.user_id`, `workouts.user_id`, `comments.user_id`, `comments.route_id`, `comments.workout_id`, `routes.created_at`, `workouts.created_at`, and the `follows` composite key (A15).
- **Why**: Postgres does not index foreign keys automatically; feed and profile queries filter/sort on these columns.
- **Files**: `app/models/*.py` (`index=True`), new migration
- **Risk**: low. **Effort**: S. **Depends on**: A15.

### A27. Pagination
- **What**: `?limit=&cursor=` (or `page`) on `/api/routes/`, `/api/workouts/`, `/api/comments/`, feed; "Load more" / infinite scroll in the feed.
- **Files**: route files, `store/routes.js`, `store/workouts.js`, `ActivityFeed.js`
- **Risk**: med. **Effort**: M. **Depends on**: A24.

### A28. Compute route polylines once, on the server
- **What**: When a route is created/edited, call the Google Directions API from Flask with the server key (A12), store `encoded_polyline` and numeric `distance_m`/`duration_s` on the route. The feed and static map thumbnails use the stored polyline. Remove the loop in `ActivityFeed.js` that, on every render dependency change, sequentially `fetch`es the Directions **web service** from the browser for every route.
- **Why**: That browser call is serial (one request after another), costs money per call, mutates Redux state objects in place, and the Directions web service is not designed for browser use (it is generally blocked by CORS and needs an unrestricted key), so thumbnails likely never load. Storing the polyline makes the feed one fast API call.
- **Files**: `app/models/route.py`, new migration, `app/api/route_routes.py`, new `app/services/directions.py`, `ActivityFeed.js`, `RouteDisplay.js`
- **Risk**: med. **Effort**: M. **Depends on**: A12, A15.

### A29. Stop the `RouteDisplay` re-request loop
- **What**: `<DirectionsService options={{...}} callback={setResponse}>` gets a new options object every render, and the page's `useEffect` depends on `response`, so each Directions result triggers a refetch of *all* routes and can re-request directions repeatedly (billable). Render the stored polyline (A28) with `<Polyline>` / `DirectionsRenderer` instead, or memoize options and only request once.
- **Files**: `react-app/src/components/RouteDisplay/RouteDisplay.js`, `MapAdjustment/EditMapForm.js`, `NewMap/NewRoute.js`
- **Risk**: low. **Effort**: S. **Depends on**: A28 (or standalone memo fix).

### A30. Frontend bundle and loading
- **What**: Lazy-load pages with `React.lazy` so the Maps code only loads on map pages; `loading="lazy"` on feed images; serve resized images (thumbnail size) - optionally resize on upload with Pillow; long-cache hashed assets in CloudFront, no-cache `index.html`.
- **Files**: `App.js`, image components, `app/s3_helpers.py`, Terraform CloudFront behavior (A42)
- **Risk**: low. **Effort**: S-M. **Depends on**: A19.

### A31. Store numbers as numbers
- **What**: `distance` ("16.2 km") and `total_time` are free-text strings. Migrate to numeric columns (`distance_m` float, `duration_s` int) with a data migration that parses existing values; format on the frontend with a km/mi toggle.
- **Why**: Enables sorting, totals, pace and weekly stats (very "Strava") and prevents garbage input.
- **Files**: `app/models/route.py`, `workout.py`, forms, migration, seeds, workout/route forms and displays
- **Risk**: med. **Effort**: M. **Depends on**: A15, A18.

---

## UI/UX & accessibility

### A32. Mobile-friendly layout
- **What**: Add `<meta name="viewport" content="width=device-width, initial-scale=1">` (missing from `public/index.html`), and responsive CSS: the whole app has only **one** `@media` query. Collapsible nav, single-column feed on phones, full-width maps.
- **Files**: `react-app/public/index.html`, `*.css`, `NavBar.js`
- **Risk**: low. **Effort**: M. **Depends on**: none.

### A33. Accessibility pass (WCAG 2.2 AA basics)
- **What**: Alt text for the 7 `<img>` tags without it; replace clickable `<div onClick>` (2 found) with `<button>`; modal (`context/Modal.js`) gets `role="dialog"`, `aria-modal`, focus trap, Esc to close and focus return; `aria-live` region for form errors; visible focus outlines; colour contrast check; page `<title>` per route; skip-to-content link. Run `eslint-plugin-jsx-a11y` and Lighthouse/axe.
- **Files**: components with images/modals/forms, `index.css`
- **Risk**: low. **Effort**: M. **Depends on**: none.

### A34. Visual refresh with a small design system
- **What**: CSS custom properties (colours, spacing, radius, font scale), one consistent button/input/card style, Strava-like orange accent with accessible contrast, dark mode via `prefers-color-scheme`. Consider CSS Modules or Tailwind (decide; see Open Questions).
- **Files**: `react-app/src/index.css`, component CSS files
- **Risk**: low. **Effort**: M-L (can be split per page). **Depends on**: A32.

### A35. Loading, empty and error states
- **What**: Skeleton loaders instead of `return null`, friendly empty states ("No activity yet - add a workout"), toast notifications for API errors (currently most failures are silent), disable submit buttons while saving.
- **Files**: page components, `store/*.js`
- **Risk**: low. **Effort**: M. **Depends on**: A8 (consistent errors).

### A36. Own the default/seed images
- **What**: The default profile picture is hot-linked from a third-party church website; seed images point at the old `capstone-strava-clone-aktiv` S3 bucket. Bundle a local default avatar (or initials avatar) and copy seed images into the new uploads bucket / `public/`.
- **Files**: `app/models/user.py`, `app/seeds/*.py`, `react-app/public/images/`
- **Risk**: low. **Effort**: S. **Depends on**: A44 (if copying to S3). See Open Questions.

---

## Docker & AWS deployment

Target architecture (cheap, single box):

```
Browser --HTTPS--> CloudFront (your domain, ACM cert)
                    |-- default  /*      --> S3 bucket "frontend" (private, OAC)  [React build]
                    |-- behavior /api/*  --> EC2 (Elastic IP) : Caddy :443 --> api container :8000 (gunicorn/Flask)
                                                                                 |--> postgres container (data on EBS)
Uploads: Flask --(IAM role)--> S3 bucket "uploads" --> served via CloudFront /uploads/* (OAC)
```
Same domain for frontend and API means cookies, CSRF and no CORS (A10). Rough monthly cost: a `t4g.small` (2 GB RAM, ARM) is roughly US$12/month on-demand (`t4g.micro` ~US$6 but tight with Postgres), plus ~US$3.60 for the public IPv4 address, ~US$1-2 for a 20 GB gp3 disk, pennies for S3/CloudFront at portfolio traffic. Check the AWS pricing calculator for your region.

### A37. Backend Dockerfile
- **What**: Multi-stage `Dockerfile` (`python:3.12-slim`), install deps in a cached layer, copy `app/` and `migrations/`, run as a non-root user, `CMD gunicorn "app:create_app()" -b 0.0.0.0:8000 -w 3`, `HEALTHCHECK` hitting a new `/api/health` endpoint. Add `.dockerignore` (excludes `react-app/node_modules`, `.git`, `.env`, `*.db`).
- **Files**: new `Dockerfile`, `.dockerignore`, `app/__init__.py` (health route)
- **Risk**: low. **Effort**: S. **Depends on**: A16 (works without it using `app:app`).

### A38. Docker Compose for local development
- **What**: `docker-compose.yml` with `api` (bind-mounted code, Flask debug reload) and `db` (`postgres:16-alpine`, named volume, healthcheck). An entrypoint script runs `flask db upgrade` and, when `SEED=true`, `flask seed all` so the demo user always exists. `docker compose up` = whole backend; frontend still runs with `npm run dev`.
- **Files**: new `docker-compose.yml`, `docker/entrypoint.sh`, `.env.example`
- **Risk**: low. **Effort**: S. **Depends on**: A37.

### A39. Decouple Flask from the React build
- **What**: Remove the SPA serving in Flask (`static_folder='../react-app/build'`, `react_root`, and the `404 -> index.html` handler). Today any unknown `/api/...` URL returns the HTML page with status 200 instead of a JSON 404, which hides frontend bugs. Return JSON errors for all API errors.
- **Files**: `app/__init__.py`
- **Risk**: low (CloudFront/Vite serve the frontend). **Effort**: S. **Depends on**: A38 (for local dev flow).

### A40. Production compose + reverse proxy
- **What**: `docker-compose.prod.yml`: `api` (image from registry, no bind mount, `restart: unless-stopped`), `db` (volume on EBS, not exposed publicly), `caddy` (automatic Let's Encrypt HTTPS for `api.yourdomain`, used as the CloudFront origin). Memory limits so Postgres and gunicorn fit on a small instance. Logs to `json-file` with rotation.
- **Files**: new `docker-compose.prod.yml`, `docker/Caddyfile`
- **Risk**: low. **Effort**: M. **Depends on**: A37; domain (Open Questions).

### A41. Terraform foundation
- **What**: `infra/` folder: AWS provider pinned, variables (`region`, `domain`, `project = "aktiv"`), remote state in an S3 bucket with lockfile (or local state to start - simpler for learning), tags on everything, budget alert (`aws_budgets_budget`, e.g. US$20/month email alert).
- **Files**: new `infra/main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `infra/README.md` section
- **Risk**: low. **Effort**: S. **Depends on**: AWS account/credentials.

### A42. Terraform: frontend bucket + CloudFront
- **What**: Private S3 bucket for the build, CloudFront distribution with OAC, ACM certificate in `us-east-1`, Route 53 (or external DNS) records, SPA fallback (403/404 -> `/index.html`), behaviors: `/api/*` -> EC2 origin (no caching, forward cookies + all query strings + `X-CSRFToken` header), `/uploads/*` -> uploads bucket, `/*` -> frontend bucket. Security headers response policy (HSTS, CSP allowing Google Maps).
- **Files**: `infra/cdn.tf`, `infra/frontend.tf`
- **Risk**: med (CloudFront config is fiddly; changes take ~5 min to deploy). **Effort**: M. **Depends on**: A41, domain.

### A43. Terraform: EC2 + networking + IAM
- **What**: Default VPC, one `t4g.small` Amazon Linux 2023 or Ubuntu ARM instance, gp3 root volume (encrypted), Elastic IP, Security Group allowing 80/443 only (optionally only from the CloudFront managed prefix list), **no port 22** - use SSM Session Manager for a shell. IAM instance role with: SSM core, read SSM parameters under `/aktiv/*`, `s3:PutObject/GetObject` on the uploads bucket, write to the backups bucket. `user_data` installs Docker + compose plugin.
- **Files**: `infra/ec2.tf`, `infra/iam.tf`, `infra/user_data.sh`
- **Risk**: med. **Effort**: M. **Depends on**: A41.

### A44. Terraform: uploads bucket
- **What**: Private uploads bucket (Block Public Access on, ACLs disabled), CloudFront OAC read access to `uploads/*`, CORS only if you later switch to browser direct uploads (presigned URLs - optional improvement that keeps big files off your EC2), lifecycle rule to abort incomplete multipart uploads.
- **Files**: `infra/uploads.tf`
- **Risk**: low. **Effort**: S. **Depends on**: A41; enables A5.

### A45. Secrets in SSM Parameter Store
- **What**: Store `SECRET_KEY`, `POSTGRES_PASSWORD`, Google server key as SecureString parameters (`/aktiv/prod/...`, standard tier is free). A small script on the instance renders them into a root-only `.env` used by compose. Nothing secret in git or Terraform state (create values by CLI, reference names in Terraform).
- **Files**: `infra/ssm.tf` (names only), `deploy/render-env.sh`
- **Risk**: low. **Effort**: S. **Depends on**: A43.

### A46. Postgres backups
- **What**: Nightly `pg_dump | gzip` from the db container to the backups S3 bucket via a systemd timer or cron, S3 lifecycle to keep 14-30 days; plus weekly EBS snapshots via Data Lifecycle Manager. Document a restore test.
- **Files**: `deploy/backup.sh`, `infra/backups.tf`
- **Risk**: low. **Effort**: S. **Depends on**: A43.

### A47. Remove Render-specific schema logic
- **What**: Drop `SCHEMA`, `add_prefix_for_prod`, the per-model `__table_args__ = {'schema': SCHEMA}` and the `ALTER TABLE ... SET SCHEMA` lines; with your own Postgres the default `public` schema is fine.
- **Why**: Simplifies every model and migration; that hack existed only because Render's free tier shared one database.
- **Files**: `app/models/*.py`, `app/seeds/*.py`, `migrations/env.py`, `migrations/versions/*`
- **Risk**: med (fresh prod DB, so no data to move; old DB is gone). **Effort**: S. **Depends on**: none; do before A15.

### A48. Deploy pipeline (GitHub Actions)
- **What**: On push to `main` (after CI passes): build the API image (ARM64 for t4g) and push to GHCR or ECR; build the frontend, `aws s3 sync dist/ s3://frontend --delete`, CloudFront invalidation of `/index.html`; deploy API via `aws ssm send-command` running `docker compose pull && docker compose up -d && docker compose exec api flask db upgrade`. Authenticate to AWS with GitHub OIDC (an IAM role GitHub can assume - no long-lived keys in GitHub secrets).
- **Files**: `.github/workflows/deploy.yml`, `infra/github_oidc.tf`
- **Risk**: med. **Effort**: M. **Depends on**: A37, A40-A45, A53.

---

## Testing & CI

### A49. Backend test setup
- **What**: `pytest`, `pytest-flask`-style fixtures using `create_app("testing")` against Postgres in Docker (or SQLite for speed), factory helpers for users/routes/workouts, CSRF disabled in testing config.
- **Files**: new `tests/conftest.py`, `requirements-dev.txt`, `pytest.ini`/`pyproject.toml`
- **Risk**: low. **Effort**: S. **Depends on**: A16.

### A50. Backend API tests
- **What**: Tests for: demo login works; signup validation; CRUD for routes/workouts/comments; **cannot edit/delete others' data** (A3); friend add/remove including zero-friends case (A7); upload requires login and rejects big/non-image files (A4, S3 mocked with `moto`); 404 for missing ids (A8).
- **Files**: `tests/test_*.py`
- **Risk**: low. **Effort**: M. **Depends on**: A49.

### A51. Frontend tests
- **What**: Vitest + React Testing Library: login form, demo button, protected route redirect, feed renders with mocked API (MSW). Optional Playwright end-to-end test "demo user logs in, creates a workout, comments, deletes it" run against Docker Compose.
- **Files**: `react-app/src/**/*.test.jsx`, `vitest.config` (in `vite.config.js`), optional `e2e/`
- **Risk**: low. **Effort**: M. **Depends on**: A19.

### A52. Linting and formatting
- **What**: `ruff` (lint + format) for Python, ESLint (flat config, `react-hooks`, `jsx-a11y`) + Prettier for JS, optional `pre-commit` hooks. Fix the `react-hooks/exhaustive-deps` warnings - several effects have missing/incorrect dependencies (e.g. `ActivityFeed.js`).
- **Files**: `pyproject.toml`/`ruff.toml`, `react-app/eslint.config.js`, `.prettierrc`, `.pre-commit-config.yaml`
- **Risk**: low (formatting commit touches many lines - do it as its own commit). **Effort**: S. **Depends on**: A19 for ESLint flat config.

### A53. CI workflow + dependency updates
- **What**: GitHub Actions on PRs: Python lint + tests (with a Postgres service container), frontend lint + tests + build, `docker build` check, `pip-audit` and `npm audit --audit-level=high`. Enable Dependabot (pip, npm, GitHub Actions, Docker) and GitHub secret scanning.
- **Files**: `.github/workflows/ci.yml`, `.github/dependabot.yml`
- **Risk**: low. **Effort**: S. **Depends on**: A49, A52.

---

## Docs/README

### A54. README rewrite
- **What**: What Aktiv is, live demo link + "Log in as Demo" note, screenshots/GIF, feature list, tech stack (accurate: remove "DockerFile" until A37 exists), architecture diagram (above), local setup with Docker Compose in ~5 commands, how to run tests, deployment summary linking to `infra/`.
- **Files**: `README.md`
- **Risk**: low. **Effort**: S. **Depends on**: A38 (setup steps).

### A55. Environment variable reference
- **What**: Rewrite `.env.example` and `react-app/.env.example` with obvious placeholders and a comment per variable (required? where used? dev vs prod), matching the new names (`APP_ENV`, `VITE_GOOGLE_MAPS_API_KEY`, no `S3_KEY/S3_SECRET`).
- **Files**: `.env.example`, `react-app/.env.example`
- **Risk**: low. **Effort**: S. **Depends on**: A1, A5, A11, A12.

### A56. Deployment guide
- **What**: Step-by-step `infra/README.md`: prerequisites (AWS CLI, Terraform, domain), `terraform init/plan/apply`, creating SSM secrets, first deploy, connecting with Session Manager, restoring a backup, tearing everything down (`terraform destroy`) to stop costs.
- **Files**: `infra/README.md`
- **Risk**: low. **Effort**: S. **Depends on**: A41-A48.

### A57. API documentation
- **What**: Replace the auto-generated `/api/docs` dump with a short endpoint table in the README (method, path, auth, request/response) or an OpenAPI spec.
- **Files**: `README.md` or `docs/api.md`, `app/__init__.py`
- **Risk**: low. **Effort**: S. **Depends on**: A24 (final response shapes).

### A58. Remove CRA boilerplate docs
- **What**: Replace `react-app/README.md` (Create React App template text) with 5 lines on running the frontend.
- **Files**: `react-app/README.md`
- **Risk**: low. **Effort**: S. **Depends on**: A19.

---

## Open questions for Tyler

1. **Secret rotation / history**: OK to just rotate the committed `SECRET_KEY` (recommended), or do you also want git history rewritten with `git filter-repo` (requires force-push; the repo is public on GitHub?)?
2. **AWS account & region**: Which AWS account and region (us-west-2 like the old bucket, or us-east-2/us-east-1)? Do you have AWS CLI credentials set up locally (ideally via IAM Identity Center/SSO, not root keys)?
3. **Domain**: Do you own a domain to use (e.g. `aktiv.<yourdomain>`)? CloudFront + HTTPS on the API origin is much simpler with one. Is DNS in Route 53, Cloudflare, or elsewhere?
4. **Bucket names**: Preferred names for the frontend, uploads and backups buckets (must be globally unique). Does the old `capstone-strava-clone-aktiv` bucket still exist, and do you still have its images (seed data points there)?
5. **Google Maps**: Is the old Google Cloud project/key still active? Create a new project with two restricted keys (browser + server) and a budget alert?
6. **Container registry**: GHCR (free, tied to GitHub) or Amazon ECR (stays in AWS, small storage cost)?
7. **Instance size**: `t4g.small` (recommended) vs `t4g.micro` (cheaper, tight on RAM)? Any AWS credits/free-tier eligibility?
8. **Styling direction**: Keep plain CSS with design tokens, or move to Tailwind/CSS Modules? Any visual reference (Strava-like vs your own brand)?
9. **Redux Toolkit (A21)**: Worth the rewrite for learning, or skip?
10. **Demo account**: Should demo users be able to create/delete data (reset nightly), or be read-only?
11. **Old branches**: 7 remote branches (`dev`, `CRUD-Route`, etc.) look stale - delete after the modernization, or keep?
