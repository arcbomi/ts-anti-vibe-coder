import type { AppConfig } from "../config/AppConfig.js";
import { AppError } from "../errors/AppError.js";
import type { EventBus } from "./EventBus.js";

type KafkaProducer = {
  connect(): Promise<void>;
  send(input: {
    topic: string;
    messages: Array<{
      key: string;
      value: string;
    }>;
  }): Promise<void>;
};

type CreateEventBusOptions = {
  producerFactory?: () => Promise<KafkaProducer>;
};

export function createEventBus(config: Pick<AppConfig, "serviceName" | "kafkaBrokers">, options: CreateEventBusOptions = {}): EventBus {
  let producerPromise: Promise<KafkaProducer> | null = null;
  let isConnected = false;

  async function getProducer() {
    producerPromise ??= options.producerFactory ? options.producerFactory() : createKafkaProducer(config);
    const producer = await producerPromise;
    if (!isConnected) {
      await producer.connect();
      isConnected = true;
    }

    return producer;
  }

  return {
    async publish(event) {
      const producer = await getProducer();
      await producer.send({
        topic: event.topic,
        messages: [
          {
            key: event.key,
            value: JSON.stringify(event.value ?? null)
          }
        ]
      });
    }
  };
}

async function createKafkaProducer(config: Pick<AppConfig, "serviceName" | "kafkaBrokers">) {
  try {
    const moduleName = "kafkajs";
    const imported = (await import(moduleName)) as {
      Kafka: new (input: {
        clientId: string;
        brokers: string[];
      }) => {
        producer(): KafkaProducer;
      };
    };

    const kafka = new imported.Kafka({
      clientId: config.serviceName,
      brokers: config.kafkaBrokers
    });

    return kafka.producer();
  } catch (error) {
    throw new AppError("Kafka event bus is unavailable.", {
      statusCode: 500,
      code: "KAFKA_UNAVAILABLE",
      cause: error
    });
  }
}
