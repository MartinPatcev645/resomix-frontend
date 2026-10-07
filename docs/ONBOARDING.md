# Backend onboarding (Alwyzon)

This repo is Alwyzon, the main Resomix API. It handles auth, playlists, library, plans and billing,
search and admin, and it is the only server the browser talks to for data. The frontend guide is
`resomix-web/ONBOARDING.md`.

The stack is Python 3.12, FastAPI, async SQLAlchemy 2, MariaDB with Alembic migrations, Redis,
Celery and Stripe. Commands below are for **Windows PowerShell**.

> Production currently runs Python **3.10**, not 3.12. Develop on 3.12 as described here, since
> that is what the Dockerfile and this guide target, but do not assume a 3.11 or 3.12 language
> feature will run in production until that is reconciled. It is tracked in `OPEN_TODOS.md`.

## How we work with git

- `demo` is staging and `main` is production.
- You push **only to your own branch, `martin`**. Never push to `demo` or `main`.
- Every change reaches `demo` through a pull request from `martin`, and Usman reviews it.
- Keep each pull request to one change, small enough to review in one sitting.

```powershell
git checkout demo
git pull
git checkout -b martin          # first time only; later: git checkout martin
git merge demo                  # bring martin up to date before you start
# ...work, commit...
git push -u origin martin
```

Then open a pull request on GitHub with base `demo` and compare `martin`.

## 1. Install the tools

```powershell
winget install -e --id Python.Python.3.12
winget install -e --id Git.Git
winget install -e --id Gyan.FFmpeg
winget install -e --id Docker.DockerDesktop
git config --global core.autocrlf input
```

- Start Docker Desktop once and let it finish its WSL 2 setup.
- Install **MariaDB Connector/C** for Windows (the MSI from mariadb.com) **before** `pip install`.
  The database driver will not build without it. Open a new PowerShell afterwards.
- If PowerShell refuses to run the venv activation script, run
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## 2. Set up the project

```powershell
git clone git@github.com:Resomix/basic_fastapi_server_resomix.git
cd basic_fastapi_server_resomix
git checkout demo
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install pytest pytest-asyncio black isort ruff
Copy-Item .env.example .env
```

## 3. Start MariaDB and Redis, then build the database

Pick a local root password and use the same one in both places below.

```powershell
docker run --name resomix-test-db -e MYSQL_ROOT_PASSWORD=<your-local-password> -p 3307:3306 -d mariadb:10.5
docker run --name resomix-redis -p 6379:6379 -d redis:7.2-alpine
docker exec -i resomix-test-db mariadb -uroot -p<your-local-password> -e "CREATE DATABASE IF NOT EXISTS resomix_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

In `.env`, set `MARIA_DB_USER=root`, `MARIA_DB_PASS=<your-local-password>`, `MARIA_DB_HOST=127.0.0.1`
and `MARIA_DB_PORT=3307`. Do not use `docker compose up` for the database with this `.env`. Compose
reads the same file, and the MariaDB image refuses a regular user called `root`.

```powershell
alembic upgrade head
python scripts/seed_data.py seed-all
python -m scripts.seed_entitlements
```

The last line seeds plans and entitlements. **Do not skip it.** Without it, every plan or
permission check returns a 500.

## 4. Run the API

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

The API docs are at http://localhost:8001/docs. On staging the API runs through
`run_alwyzon.py`, which also supervises a Celery worker. You do not need the worker locally. It only
serves uploads and similarity, and those need the staging media server anyway.

`make` is not available on Windows. These are the equivalents of the Makefile targets you will see
mentioned.

| Makefile | PowerShell |
|---|---|
| `make migrate` | `alembic upgrade head` |
| `make seed-plans` | `python -m scripts.seed_entitlements` |
| `make api` / `make api-only` | `uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload` |
| `make test` | `pytest -q` (see section 6 first) |
| `make fmt` | `black . ; isort .` |
| `make lint` | `ruff check .` |

## 5. Coding practices

**Where code goes.** Every feature follows the same layers, in this order.

| Layer | Folder | Does |
|---|---|---|
| Router | `app/api/routers/` | Declares the endpoint and its dependencies (auth, DB session). Nothing else |
| Controller | `app/controllers/` | Thin HTTP handling. Validates, calls the service, formats the response |
| Service | `app/services/` | All business logic. Knows nothing about HTTP |
| Repository | `app/repositories/` | Database queries only |
| Model / schema | `app/models/`, `app/schemas/` | SQLAlchemy tables and Pydantic request/response shapes |

The rules that go with it.

- Business logic lives only in services. A router or controller that makes decisions is a bug.
- Every response uses `format_response` (`app/utils/response_utils.py`), so all endpoints share
  one shape.
- Raise the custom exceptions in `app/core/exceptions.py` and let the handlers turn them into
  responses. Do not build error JSON by hand in a service.
- Log with `logging.getLogger(__name__)`, never `print`.
- Type hints on every function, and a docstring on every public method.
- Comments explain **why** the code is the way it is. The code already says what it does.
- Reuse an existing service or helper before writing a new one. Search first.

**Database changes.** Every model change ships with an Alembic migration in the same pull request.

```powershell
alembic revision --autogenerate -m "add x to y"
alembic upgrade head
```

Read the generated file before committing, because autogenerate misses things (renames, server
defaults, data changes). Never edit a migration that has already been merged. Write a new one. Say
in the pull request that it contains a migration, so it is run on the next staging deploy.

**Configuration.** `app/core/config.py` is not a Pydantic `BaseSettings`. A new setting reads from
the environment only after its variable is added to the mapping table in that file. Add every new
variable to `.env.example` too, with a placeholder value, never a real secret.

**What leaves the API.** Responses pass through a filter that keeps internal names out of them
(`app/utils/public_names.py`, `app/api/middlewares/public_names.py`). Do not remove it, and do not
add endpoints that hand out the raw output of the media or analysis services.

## 6. Tests

- **Unit tests** need no database. Run them freely.

  ```powershell
  pytest tests/unit -q
  ```

- **API tests** (`tests/api/`) use a real database, and the test session **deletes every row it
  created** when it ends. Never run them against the database you develop on. Use a separate one.

  ```powershell
  docker exec -i resomix-test-db mariadb -uroot -p<your-local-password> -e "CREATE DATABASE IF NOT EXISTS resomix_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  $env:MARIA_DB_NAME = "resomix_test"
  alembic upgrade head
  python scripts/seed_data.py seed-all
  python -m scripts.seed_entitlements
  pytest tests/api -q
  Remove-Item Env:MARIA_DB_NAME
  ```

- Add or update tests with every change. A new endpoint gets at least one test for its success case
  and one for its main refusal (not found, not allowed).
- Prefer running the test files you touched over the whole suite.

## 7. Before you open a pull request

- [ ] `black . ; isort .` and `ruff check .` are clean
- [ ] The tests for what you changed pass
- [ ] Any model change has its migration, and the pull request says so
- [ ] New settings are in `config.py` and `.env.example`
- [ ] No secrets, tokens or real user data in the diff
- [ ] The pull request says what changed and why, and how you tested it

## Reference

- `../README.md` covers what the service provides and how it is built, in more depth.
- `QUICK_START.md`, beside this file, is the original local setup guide and covers macOS.
- `reference/frontend_api_integration_guide.md` is the endpoint reference.
- `RUNBOOK.md`, beside this file, is day-to-day operations.
- `outdated/` holds superseded documents. Useful for why a thing was done, never for how it
  works now.
