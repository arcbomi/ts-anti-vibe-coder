package errors

import (
  "encoding/json"
  "net/http"
)

type AppError struct {
  Code    string      `json:"code"`
  Message string      `json:"message"`
  Details interface{} `json:"details,omitempty"`
}

type APIErrorResponse struct {
  Error AppError `json:"error"`
}

func WriteJSONError(w http.ResponseWriter, status int, appErr AppError) {
  w.Header().Set("Content-Type", "application/json")
  w.WriteHeader(status)
  _ = json.NewEncoder(w).Encode(APIErrorResponse{Error: appErr})
}

func BadRequest(message string, details interface{}) AppError {
  return AppError{Code: "bad_request", Message: message, Details: details}
}

func Unauthorized(message string) AppError {
  return AppError{Code: "unauthorized", Message: message}
}

func NotFound(message string) AppError {
  return AppError{Code: "not_found", Message: message}
}

func Upstream(message string, details interface{}) AppError {
  return AppError{Code: "upstream_error", Message: message, Details: details}
}
