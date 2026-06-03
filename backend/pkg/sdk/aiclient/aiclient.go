package aiclient

import (
  "context"
  "time"

  "backend/pkg/sdk/httpclient"
)

type Client struct {
  baseURL string
  apiKey  string
  model   string
  http    *httpclient.Client
}

type Options struct {
  BaseURL string
  APIKey  string
  Model   string
  Timeout time.Duration
}

func New(opts Options) *Client {
  if opts.Timeout <= 0 {
    opts.Timeout = 60 * time.Second
  }
  return &Client{
    baseURL: opts.BaseURL,
    apiKey:  opts.APIKey,
    model:   opts.Model,
    http:    httpclient.New(opts.Timeout),
  }
}

// MVP placeholder: question generation will live in ai-analysis-service and be called by worker-service.
// This client is the shared SDK wrapper for an OpenAI-compatible HTTP API.
func (c *Client) Ping(ctx context.Context) error {
  _ = ctx
  return nil
}
