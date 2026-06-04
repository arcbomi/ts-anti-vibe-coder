# Backend Shared SDK

This SDK is shared by all backend Go microservices in the project. It centralizes reusable infrastructure code so services such as `api-gateway`, `auth-service`, `gitea-reader-service`, `ai-analysis-service`, `question-service`, `exam-service`, and `worker-service` do not duplicate common plumbing.

The SDK should stay focused on reusable infrastructure concerns and must not contain service-specific business logic.

## Packages

- `config`: loads typed configuration from environment variables.
- `logger`: creates structured JSON `slog` loggers with service and request ID support.
- `errors`: writes the common API success/error response envelope.
- `database`: opens, pings, closes, and runs transactions against PostgreSQL.
- `queue`: publishes and consumes Redis-backed long-running analysis jobs, including retries and a dead-letter queue.
- `middleware`: provides request ID, request logging, panic recovery, CORS, and bearer-token placeholder middleware.
- `httpclient`: sends JSON HTTP requests with timeouts, bearer tokens, and response decoding.
- `giteaclient`: checks bot repository access and reads safe repository metadata, tree entries, and file contents using the server Gitea bot token.
- `aiclient`: sends prompts to an OpenAI-compatible AI model API and parses JSON responses.

Services should import SDK packages directly, for example:

```go
import "backend/pkg/sdk/config"
import "backend/pkg/sdk/logger"
import "backend/pkg/sdk/queue"
import "backend/pkg/sdk/database"
```
