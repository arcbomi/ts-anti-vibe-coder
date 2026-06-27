export type EventBusMessage = {
  topic: string;
  key: string;
  value: unknown;
};

export type EventBus = {
  publish(event: EventBusMessage): Promise<void>;
};
