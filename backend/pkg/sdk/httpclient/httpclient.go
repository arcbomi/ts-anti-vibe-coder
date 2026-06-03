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

type Client struct {
  httpClient *http.Client
}

func New(timeout time.Duration) *Client {
  return &Client{httpClient: &http.Client{Timeout: timeout}}
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
    req.Header.Set(k, v)
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
    dec := json.NewDecoder(resp.Body)
    dec.DisallowUnknownFields()
    if err := dec.Decode(respBody); err != nil {
      return resp, err
    }
  }

  return resp, nil
}
