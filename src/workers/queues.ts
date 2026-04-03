import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Dedicated connection for BullMQ queues (maxRetriesPerRequest must be null)
const queueConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const BLIND_BOX_QUEUE_NAME = 'blind-box-assignment';

export interface AssignBlindBoxItemPayload {
  shoplineOrderId: string;
  shoplineCustomerId: string;
  blindBoxId: string;
  quantity: number;
}

export const blindBoxAssignmentQueue = new Queue<AssignBlindBoxItemPayload>(
  BLIND_BOX_QUEUE_NAME,
  {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s → 4s → 8s
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  }
);
