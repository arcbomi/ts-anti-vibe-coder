.PHONY: dev dev-auth dev-tomorrow dev-user dev-core dev-api dev-frontend dev-down infra-up infra-down migrate backend-test test-integration smoke-test backend-run-api backend-run-auth backend-run-gitea backend-run-analysis backend-run-exam backend-run-scheduler backend-run-worker frontend-install frontend-dev frontend-build docker-build

dev:
	./scripts/dev-up.sh

dev-auth:
	./scripts/dev-up.sh auth-service

dev-tomorrow:
	./scripts/dev-up.sh tomorrow-service

dev-user:
	./scripts/dev-up.sh user-service

dev-core:
	./scripts/dev-up.sh auth-service tomorrow-service user-service

dev-api:
	./scripts/dev-up.sh api-gateway auth-service tomorrow-service user-service

dev-frontend:
	./scripts/dev-up.sh frontend api-gateway auth-service tomorrow-service user-service

dev-down:
	docker compose down

infra-up:
	docker compose -f docker-compose.infra.yml up -d

infra-down:
	docker compose -f docker-compose.infra.yml down -v

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

backend-run-gitea:
	./scripts/run-backend.sh gitea-service

backend-run-analysis:
	./scripts/run-backend.sh ai-analysis-service

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
