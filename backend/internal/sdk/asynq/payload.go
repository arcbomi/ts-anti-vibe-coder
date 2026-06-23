package asynqsdk

import (
	"encoding/json"
	"fmt"

	"github.com/hibiken/asynq"
)

func MarshalPayload(payload any) ([]byte, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal task payload: %w", err)
	}
	return data, nil
}

func UnmarshalPayload(data []byte, dest any) error {
	if err := json.Unmarshal(data, dest); err != nil {
		return fmt.Errorf("unmarshal task payload: %w", err)
	}
	return nil
}

func NewTask(taskName string, payload any) (*asynq.Task, error) {
	data, err := MarshalPayload(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(taskName, data), nil
}

func DecodeTaskPayload(task *asynq.Task, dest any) error {
	if task == nil {
		return fmt.Errorf("task is required")
	}
	return UnmarshalPayload(task.Payload(), dest)
}
