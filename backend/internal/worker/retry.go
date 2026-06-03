package worker

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	ErrCodeBotAccessDenied      = "BOT_ACCESS_DENIED"
	ErrCodeInvalidRepositoryURL = "INVALID_REPOSITORY_URL"
	ErrCodeRepositoryNotFound   = "REPOSITORY_NOT_FOUND"
	ErrCodeGitLabTemporary      = "GITLAB_TEMPORARY_ERROR"
	ErrCodeAITimeout            = "AI_TIMEOUT"
	ErrCodeAIOutputInvalid      = "AI_OUTPUT_INVALID"
	ErrCodeDatabase             = "DATABASE_ERROR"
	ErrCodeQueue                = "QUEUE_ERROR"
	ErrCodeUnknown              = "UNKNOWN_ERROR"
)

type RetryConfig struct {
	MaxAttempts int
	Delay       time.Duration
}

func (c RetryConfig) normalized() RetryConfig {
	if c.MaxAttempts <= 0 {
		c.MaxAttempts = 3
	}
	if c.Delay <= 0 {
		c.Delay = 30 * time.Second
	}
	return c
}

type JobError struct {
	Code      string
	Message   string
	Retryable bool
	Cause     error
}

func (e *JobError) Error() string {
	if e == nil {
		return ""
	}
	if e.Message != "" {
		return e.Message
	}
	return e.Code
}

func (e *JobError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Cause
}

func NewRetryableError(code string, message string, cause error) *JobError {
	return &JobError{Code: code, Message: message, Retryable: true, Cause: cause}
}

func NewPermanentError(code string, message string, cause error) *JobError {
	return &JobError{Code: code, Message: message, Retryable: false, Cause: cause}
}

func IsRetryable(err error) bool {
	var jobErr *JobError
	if errors.As(err, &jobErr) {
		return jobErr.Retryable
	}
	return false
}

func ErrorCode(err error) string {
	var jobErr *JobError
	if errors.As(err, &jobErr) && jobErr.Code != "" {
		return jobErr.Code
	}
	return ErrCodeUnknown
}

func ErrorMessage(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func ClassifyExternalError(defaultCode string, err error) error {
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "timeout") || strings.Contains(msg, "deadline exceeded") {
		if defaultCode == ErrCodeAITimeout {
			return NewRetryableError(ErrCodeAITimeout, "AI request timed out", err)
		}
		return NewRetryableError(defaultCode, fmt.Sprintf("temporary failure: %v", err), err)
	}
	if strings.Contains(msg, "connection") || strings.Contains(msg, "temporary") || strings.Contains(msg, "eof") {
		return NewRetryableError(defaultCode, fmt.Sprintf("temporary failure: %v", err), err)
	}
	return NewRetryableError(defaultCode, err.Error(), err)
}
