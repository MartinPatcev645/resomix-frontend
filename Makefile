.PHONY: up down logs db migrate seed clear-db api worker run test fmt lint help seed-plans

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

api:
	uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

worker:
	celery -A app.tasks.celery_app worker --loglevel=info

# API + supervised Celery worker in one command (worker stops with the API). Prefer this over
# running `api` and `worker` separately. Set ALWYZON_EMBED_WORKER=0 to run the worker elsewhere.
run:
	python run_alwyzon.py

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
	@echo "  make api      - Start API server with hot-reload (local, no Docker)"
	@echo "  make worker   - Start Celery webhook worker (local, no Docker)"
	@echo "  make test     - Run test suite"
	@echo "  make fmt      - Format code (black + isort)"
	@echo "  make lint     - Lint code (ruff)"
	@echo ""
	@echo "Docker Celery worker (alternative to 'make worker'):"
	@echo "  docker compose --profile worker up -d celery_worker"
