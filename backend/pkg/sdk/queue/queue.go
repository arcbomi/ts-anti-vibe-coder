package queue

import (
  "encoding/json"
  "fmt"

  "github.com/hibiken/asynq"
)

type Client struct {
  c *asynq.Client
  namespace string
}

type RedisConfig struct {
  Addr     string
  Password string
}

func NewClient(rc RedisConfig, namespace string) *Client {
  return &Client{
    c:         asynq.NewClient(asynq.RedisClientOpt{Addr: rc.Addr, Password: rc.Password}),
    namespace: namespace,
  }
}

func (c *Client) Close() error {
  return c.c.Close()
}

type AnalysisJobMessage struct {
  JobID         string `json:"job_id"`
  UserID        string `json:"user_id"`
  RepositoryID  string `json:"repository_id"`
  GitLabRepoURL string `json:"gitlab_repo_url"`
  Branch        string `json:"branch"`
}

func (m AnalysisJobMessage) Validate() error {
  if m.JobID == "" || m.UserID == "" || m.RepositoryID == "" || m.GitLabRepoURL == "" {
    return fmt.Errorf("missing required fields")
  }
  if m.Branch == "" {
    m.Branch = "main"
  }
  return nil
}

const TaskAnalysisJob = "analysis:job"

func (c *Client) EnqueueAnalysisJob(msg AnalysisJobMessage) (*asynq.TaskInfo, error) {
  if err := msg.Validate(); err != nil {
    return nil, err
  }
  payload, err := json.Marshal(msg)
  if err != nil {
    return nil, err
  }
  task := asynq.NewTask(TaskAnalysisJob, payload)
  return c.c.Enqueue(task, asynq.Queue(c.namespace+":default"), asynq.MaxRetry(10))
}
