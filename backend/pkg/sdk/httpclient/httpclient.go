// Package httpclient provides shared JSON HTTP helpers for internal and external APIs.
package httpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client wraps net/http with JSON request and response helpers.
type Client struct {
	httpClient *http.Client
}

func New(timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &Client{httpClient: &http.Client{Timeout: timeout}}
}

func (c *Client) GetJSON(ctx context.Context, url string, bearerToken string, respBody any) error {
	_, err := c.DoJSON(ctx, http.MethodGet, url, nil, respBody, authHeaders(bearerToken))
	return err
}

func (c *Client) PostJSON(ctx context.Context, url string, bearerToken string, reqBody any, respBody any) error {
	_, err := c.DoJSON(ctx, http.MethodPost, url, reqBody, respBody, authHeaders(bearerToken))
	return err
}

func (c *Client) DoJSON(ctx context.Context, method string, url string, reqBody any, respBody any, headers map[string]string) (*http.Response, error) {
	var body io.Reader
	if reqBody != nil {
		b, err := json.Marshal(reqBody)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		if v != "" {
			req.Header.Set(k, v)
		}
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
		return resp, fmt.Errorf("http status %d: %s", resp.StatusCode, string(raw))
	}

	if respBody != nil {
		if err := json.NewDecoder(resp.Body).Decode(respBody); err != nil && err != io.EOF {
			return resp, err
		}
	}
	return resp, nil
}

func authHeaders(token string) map[string]string {
	if token == "" {
		return nil
	}
	return map[string]string{"Authorization": "Bearer " + token}
}
