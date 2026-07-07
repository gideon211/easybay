.PHONY: help dev test lint install clean

help:
	@echo "Available commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Run CLI tool"
	@echo "  make test       - Run tests"
	@echo "  make lint       - Run linter"
	@echo "  make clean      - Clean build artifacts"

install:
	cd backend && pip install -e ".[dev]"
	cd frontend && npm install

dev:
	cd backend && python -m src.cli.main

test:
	cd backend && pytest

lint:
	cd backend && ruff check src/ tests/
	cd backend && mypy src/

clean:
	cd backend && rm -rf build dist *.egg-info .pytest_cache .mypy_cache .ruff_cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
