.PHONY: dev dev-down infra-up infra-down migrate backend-test test-integration smoke-test backend-run-api backend-run-auth backend-run-gitlab backend-run-analysis backend-run-question backend-run-exam backend-run-scheduler backend-run-worker frontend-install frontend-dev frontend-build docker-build

dev:
	./scripts/dev-up.sh

dev-down:
	./scripts/dev-down.sh

infra-up:
	docker compose up -d postgres redis

infra-down:
	docker compose down -v

migrate:
	./scripts/run-migrations.sh

backend-test:
	cd backend && go test ./...

test-integration:
	./scripts/run-backend-integration-tests.sh

smoke-test:
	./scripts/run-smoke-tests.sh

backend-run-api:
	./scripts/run-backend.sh api-gateway

backend-run-auth:
	./scripts/run-backend.sh auth-service

backend-run-gitlab:
	./scripts/run-backend.sh gitlab-reader-service

backend-run-analysis:
	./scripts/run-backend.sh ai-analysis-service

backend-run-question:
	./scripts/run-backend.sh question-service

backend-run-exam:
	./scripts/run-backend.sh exam-service

backend-run-scheduler:
	./scripts/run-backend.sh scheduler-service

backend-run-worker:
	./scripts/run-worker.sh

frontend-install:
	cd frontend && npm install

frontend-dev:
	./scripts/run-frontend.sh

frontend-build:
	cd frontend && npm run build

docker-build:
	docker build -t anti-vibe-backend:local ./backend
	docker build -t anti-vibe-frontend:local ./frontend
