import type { EventBus, EventBusMessage } from "../eventBus/EventBus.js";

export type MockEventBus = EventBus & {
  publishedEvents: EventBusMessage[];
};

export function createMockEventBus(): MockEventBus {
  const publishedEvents: EventBusMessage[] = [];

  return {
    publishedEvents,
    async publish(event) {
      publishedEvents.push(structuredClone(event));
    }
  };
}
