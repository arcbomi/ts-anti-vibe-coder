// Package aiclient provides a reusable OpenAI-compatible JSON generation client.
package aiclient

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"backend/pkg/sdk/httpclient"
)

// Client sends prompts to a configured AI model provider.
type Client struct {
	baseURL string
	apiKey  string
	model   string
	http    *httpclient.Client
	retries int
}

// Option customizes the client without adding business logic.
type Option func(*Client)

func WithTimeout(timeout time.Duration) Option {
	return func(c *Client) { c.http = httpclient.New(timeout) }
}

func WithRetries(retries int) Option {
	return func(c *Client) {
		if retries >= 0 {
			c.retries = retries
		}
	}
}

// New creates an OpenAI-compatible AI client.
func New(baseURL string, apiKey string, model string, opts ...Option) *Client {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.openai.com"
	}
	client := &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		model:   model,
		http:    httpclient.New(60 * time.Second),
		retries: 2,
	}
	for _, opt := range opts {
		opt(client)
	}
	return client
}

// GenerateJSON sends a prompt and returns the model response content as parsed JSON.
func (c *Client) GenerateJSON(ctx context.Context, prompt string) (json.RawMessage, error) {
	if strings.TrimSpace(c.model) == "" {
		return nil, fmt.Errorf("ai model is required")
	}
	request := chatCompletionRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: "Return only valid JSON. Do not include markdown fences or explanatory prose."},
			{Role: "user", Content: prompt},
		},
		ResponseFormat: responseFormat{Type: "json_object"},
	}

	var response chatCompletionResponse
	var err error
	for attempt := 0; attempt <= c.retries; attempt++ {
		response = chatCompletionResponse{}
		err = c.http.PostJSON(ctx, c.baseURL+"/v1/chat/completions", c.apiKey, request, &response)
		if err == nil {
			break
		}
		if attempt < c.retries {
			time.Sleep(time.Duration(attempt+1) * 250 * time.Millisecond)
		}
	}
	if err != nil {
		return nil, err
	}
	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("ai response did not include choices")
	}
	content := strings.TrimSpace(response.Choices[0].Message.Content)
	var raw json.RawMessage
	if err := json.Unmarshal([]byte(content), &raw); err != nil {
		return nil, fmt.Errorf("ai response was not valid JSON: %w", err)
	}
	return raw, nil
}

func (c *Client) Ping(ctx context.Context) error {
	_, err := c.GenerateJSON(ctx, `{"ok": true}`)
	return err
}

type chatCompletionRequest struct {
	Model          string         `json:"model"`
	Messages       []chatMessage  `json:"messages"`
	ResponseFormat responseFormat `json:"response_format"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}
