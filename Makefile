.PHONY: infra-up infra-down backend-test smoke-test backend-run-api backend-run-auth backend-run-worker frontend-install frontend-dev frontend-build

infra-up:
	docker compose up -d

infra-down:
	docker compose down -v

backend-test:
	cd backend && go test ./...

smoke-test:
	./scripts/run-smoke-tests.sh

backend-run-api:
	cd backend && go run ./cmd/api-gateway

backend-run-auth:
	cd backend && go run ./cmd/auth-service

backend-run-worker:
	cd backend && go run ./cmd/worker-service

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build
