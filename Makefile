.PHONY: up down logs db migrate seed api test fmt lint help

up:
	docker compose up -d mariadb

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

db:
	mysql -h 127.0.0.1 -P 3307 -u resomix -psecret resomix_db

migrate:
	python -m database.manage setup

seed:
	python -m database.manage setup --with-data

api:
	uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload

test:
	pytest -q

fmt:
	black . && isort .

lint:
	ruff check .

help:
	@echo "Resomix Development Commands:"
	@echo "  make up       - Start MariaDB in Docker"
	@echo "  make down     - Stop all Docker services"
	@echo "  make logs     - View Docker logs"
	@echo "  make db       - Connect to MariaDB CLI"
	@echo "  make migrate  - Run database migrations"
	@echo "  make seed     - Run migrations + seed sample data"
	@echo "  make api      - Start API server with hot-reload"
	@echo "  make test     - Run test suite"
	@echo "  make fmt      - Format code (black + isort)"
	@echo "  make lint     - Lint code (ruff)"
