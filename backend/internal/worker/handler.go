package worker

import (
	"context"
	"encoding/json"
	"log/slog"
)

type HandlerResult struct {
	Message AnalysisJobMessage
	Err     error
}

type Handler struct {
	runner *JobRunner
	store  AnalysisStore
	log    *slog.Logger
}

func NewHandler(runner *JobRunner, store AnalysisStore, log *slog.Logger) *Handler {
	return &Handler{runner: runner, store: store, log: log}
}

func (h *Handler) Handle(ctx context.Context, payload []byte) HandlerResult {
	var msg AnalysisJobMessage
	if err := json.Unmarshal(payload, &msg); err != nil {
		return HandlerResult{Err: NewPermanentError(ErrCodeQueue, "analysis job message must be valid JSON", err)}
	}
	if err := msg.Validate(); err != nil {
		_ = h.store.FailAnalysisJob(ctx, msg.JobID, ErrorCode(err), ErrorMessage(err))
		return HandlerResult{Message: msg, Err: err}
	}
	if err := h.runner.Run(ctx, msg); err != nil {
		if !IsRetryable(err) {
			_ = h.store.FailAnalysisJob(ctx, msg.JobID, ErrorCode(err), ErrorMessage(err))
		}
		return HandlerResult{Message: msg, Err: err}
	}
	return HandlerResult{Message: msg}
}
