import { EventEmitter } from 'events';
import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { createBullMqRedisOptions, isRedisConfigured } from '../config/redis.js';

const defaultJobOptions = {
  attempts: 1,
  removeOnComplete: {
    age: 60 * 60,
    count: 1000,
  },
  removeOnFail: {
    age: 24 * 60 * 60,
    count: 1000,
  },
};

let bullMqDisabled = false;
let bullMqRetryAfter = 0;
let bullMqUnavailableLogged = false;
const shouldLogBullMqWarnings = process.env.NODE_ENV === 'production';

function createBullMqConnection() {
  const options = createBullMqRedisOptions();
  if (!options) {
    throw new Error('Redis is not configured for BullMQ queues');
  }

  const { url, ...redisOptions } = options;
  return url ? new IORedis(url, redisOptions) : new IORedis(redisOptions);
}

async function canConnectToBullMq() {
  const options = createBullMqRedisOptions();
  if (!options) return false;

  const { url, ...redisOptions } = options;
  const probe = url ? new IORedis(url, redisOptions) : new IORedis(redisOptions);
  const swallowError = () => {};

  probe.on('error', swallowError);

  try {
    await probe.connect();
    await probe.ping();
    return true;
  } finally {
    probe.off('error', swallowError);
    probe.disconnect();
  }
}

function emitIfHandled(emitter, eventName, ...args) {
  if (emitter.listenerCount(eventName) > 0) {
    emitter.emit(eventName, ...args);
  }
}

export class BullQueueFacade extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.queue = null;
    this.worker = null;
    this.queueConnection = null;
    this.workerConnection = null;
    this.workerStarted = false;
  }

  ensureQueue() {
    if (this.queue) return this.queue;

    this.queueConnection = createBullMqConnection();
    this.queue = new Queue(this.name, {
      connection: this.queueConnection,
      defaultJobOptions,
    });

    this.queue.on('error', (error) => {
      if (shouldLogBullMqWarnings) {
        console.error(`BullMQ queue ${this.name} error:`, error.message);
      }
      emitIfHandled(this, 'error', error);
    });

    return this.queue;
  }

  async add(data = {}, options = {}) {
    if (!isRedisConfigured()) {
      if (shouldLogBullMqWarnings) {
        console.warn(`BullMQ queue ${this.name} skipped: Redis is not configured`);
      }
      return null;
    }

    if (bullMqDisabled && Date.now() < bullMqRetryAfter) {
      if (!bullMqUnavailableLogged) {
        bullMqUnavailableLogged = true;
        if (shouldLogBullMqWarnings) {
          console.warn(
            `BullMQ queue ${this.name} skipped: Redis is unavailable locally. Set REDIS_URL or start Redis to enable queues.`,
          );
        }
      }
      return null;
    }

    try {
      const queue = this.ensureQueue();
      return await queue.add(this.name, data, {
        ...defaultJobOptions,
        ...options,
      });
    } catch (error) {
      bullMqDisabled = true;
      bullMqRetryAfter = Date.now() + 30000;
      if (!bullMqUnavailableLogged) {
        bullMqUnavailableLogged = true;
        if (shouldLogBullMqWarnings) {
          console.warn(
            `BullMQ queue ${this.name} unavailable: Redis is not reachable right now. Queue jobs will be skipped until Redis is available.`,
          );
        }
      }
      return null;
    }
  }

  process(handler) {
    if (this.workerStarted) return this;
    this.workerStarted = true;

    if (!isRedisConfigured()) {
      if (shouldLogBullMqWarnings) {
        console.warn(`BullMQ worker ${this.name} skipped: Redis is not configured`);
      }
      return this;
    }

    void (async () => {
      if (bullMqDisabled && Date.now() < bullMqRetryAfter) {
        if (!bullMqUnavailableLogged) {
          bullMqUnavailableLogged = true;
          if (shouldLogBullMqWarnings) {
            console.warn(
              `BullMQ worker ${this.name} skipped: Redis is unavailable locally. Set REDIS_URL or start Redis to enable queues.`,
            );
          }
        }
        this.workerStarted = false;
        return;
      }

      try {
        await canConnectToBullMq();
        bullMqDisabled = false;
        bullMqUnavailableLogged = false;

        this.workerConnection = createBullMqConnection();
        this.worker = new Worker(this.name, handler, {
          connection: this.workerConnection,
          concurrency: 1,
        });

        this.worker.on('completed', (job, result) => {
          this.emit('completed', job, result);
        });

        this.worker.on('failed', (job, error) => {
          this.emit('failed', job, error);
        });

        this.worker.on('error', (error) => {
          if (shouldLogBullMqWarnings) {
            console.error(`BullMQ worker ${this.name} error:`, error);
          }
          emitIfHandled(this, 'error', error);
        });

        console.log(`BullMQ worker ready: ${this.name}`);
      } catch (error) {
        bullMqDisabled = true;
        bullMqRetryAfter = Date.now() + 30000;
        this.workerStarted = false;
        if (!bullMqUnavailableLogged) {
          bullMqUnavailableLogged = true;
          if (shouldLogBullMqWarnings) {
            console.warn(
              `BullMQ worker ${this.name} unavailable: Redis is not reachable right now. Queue workers will stay disabled until Redis is available.`,
            );
          }
        }
      }
    })();

    return this;
  }

  async close() {
    const closeTasks = [];

    if (this.worker) closeTasks.push(this.worker.close());
    if (this.queue) closeTasks.push(this.queue.close());

    await Promise.allSettled(closeTasks);

    const quitTasks = [];
    if (this.workerConnection) quitTasks.push(this.workerConnection.quit());
    if (this.queueConnection) quitTasks.push(this.queueConnection.quit());

    await Promise.allSettled(quitTasks);

    this.worker = null;
    this.queue = null;
    this.workerConnection = null;
    this.queueConnection = null;
    this.workerStarted = false;
  }
}

export const emailQueue = new BullQueueFacade('email');
export const reminderQueue = new BullQueueFacade('reminder');
export const smsQueue = new BullQueueFacade('sms');
export const refundQueue = new BullQueueFacade('refund');

const queues = [emailQueue, reminderQueue, smsQueue, refundQueue];

export async function closeQueues() {
  await Promise.all(queues.map((queue) => queue.close()));
}
