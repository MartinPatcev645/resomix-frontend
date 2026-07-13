.PHONY: up down logs db migrate seed clear-db api api-only worker run test fmt lint help seed-plans

up:
	docker compose up -d mariadb redis

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

db:
	mysql -h 127.0.0.1 -P 3307 -u resomix -psecret resomix_db

migrate:
	alembic upgrade head

seed:
	python -m database.manage setup --with-data

seed-plans:
	python -m scripts.seed_entitlements

clear-db:
	python -m scripts.seed_data clear-all

# Local dev: API (hot-reload) + supervised Celery worker in ONE command — the worker starts with
# the API and stops with it (same supervision as run_alwyzon.py). Without the worker, upload
# siblings (similarity playlist / analysis persistence) never run. Reload is forced on for dev;
# note the worker itself doesn't hot-reload, so restart `make api` after editing task code.
# Set ALWYZON_EMBED_WORKER=0 to run the worker separately (`make worker`).
api:
	ALWYZON_RELOAD=1 python run_alwyzon.py

# Standalone Celery worker (only needed if you run the API without the embedded worker).
worker:
	celery -A app.tasks.celery_app worker --loglevel=info

# API + supervised Celery worker, env-driven reload (use for staging/production-like runs).
run:
	python run_alwyzon.py

# Plain API only, no worker (rarely needed — siblings won't process).
api-only:
	uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

test:
	pytest -q

fmt:
	black . && isort .

lint:
	ruff check .

help:
	@echo "Resomix Development Commands:"
	@echo "Resomix Development Commands:"
	@echo "  make up       - Start MariaDB + Redis in Docker"
	@echo "  make down     - Stop all Docker services"
	@echo "  make logs     - View Docker logs"
	@echo "  make db       - Connect to MariaDB CLI"
	@echo "  make migrate  - Run database migrations"
	@echo "  make seed     - Run migrations + seed sample data"
	@echo "  make clear-db - Clear all data from database (WARNING: destructive)"
	@echo "  make api      - Start API (hot-reload) + supervised Celery worker (local, no Docker)"
	@echo "  make api-only - Start API only, no worker (siblings won't process)"
	@echo "  make run      - API + worker, env-driven reload (staging/prod-like)"
	@echo "  make worker   - Start Celery worker standalone (local, no Docker)"
	@echo "  make test     - Run test suite"
	@echo "  make fmt      - Format code (black + isort)"
	@echo "  make lint     - Lint code (ruff)"
	@echo ""
	@echo "Docker Celery worker (alternative to 'make worker'):"
	@echo "  docker compose --profile worker up -d celery_worker"
