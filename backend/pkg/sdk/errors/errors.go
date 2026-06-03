// Package errors defines the shared JSON API response envelope for services.
package errors

import (
	"encoding/json"
	"net/http"
)

// APIResponse is the common HTTP response shape returned by all services.
type APIResponse struct {
	Success bool      `json:"success"`
	Data    any       `json:"data"`
	Error   *APIError `json:"error"`
}

// APIError is the common machine-readable API error body.
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// WriteError writes the shared unsuccessful response shape.
func WriteError(w http.ResponseWriter, status int, code string, message string) {
	writeJSON(w, status, APIResponse{Success: false, Data: nil, Error: &APIError{Code: code, Message: message}})
}

// WriteSuccess writes the shared successful response shape.
func WriteSuccess(w http.ResponseWriter, data any) {
	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: data, Error: nil})
}

func writeJSON(w http.ResponseWriter, status int, payload APIResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// AppError is retained as a lightweight reusable application error value.
type AppError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// APIErrorResponse is retained for compatibility with early service code.
type APIErrorResponse struct {
	Error AppError `json:"error"`
}

// WriteJSONError writes the legacy error body used by older handlers.
func WriteJSONError(w http.ResponseWriter, status int, appErr AppError) {
	WriteError(w, status, appErr.Code, appErr.Message)
}

func BadRequest(message string, details interface{}) AppError {
	return AppError{Code: "BAD_REQUEST", Message: message, Details: details}
}

func Unauthorized(message string) AppError {
	return AppError{Code: "UNAUTHORIZED", Message: message}
}

func NotFound(message string) AppError {
	return AppError{Code: "NOT_FOUND", Message: message}
}

func Upstream(message string, details interface{}) AppError {
	return AppError{Code: "UPSTREAM_ERROR", Message: message, Details: details}
}
