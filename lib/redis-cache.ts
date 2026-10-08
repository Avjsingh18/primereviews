import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connection: Promise<RedisClient> | null = null;

function redisUrl() {
  const configured = process.env.REDIS_URL;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "redis://127.0.0.1:6379";
  throw new Error("REDIS_URL is required in production.");
}

export async function redis() {
  if (client?.isReady) return client;
  if (!connection) {
    const next = createClient({ url: redisUrl() });
    next.on("error", (error) => console.error("Redis cache error", error));
    client = next;
    connection = next.connect().then(() => next).catch((error) => {
      client = null;
      connection = null;
      throw error;
    });
  }
  return connection;
}

export async function getCachedJson<T>(key: string) {
  const client = await redis();
  const value = await client.get(key);
  return value ? JSON.parse(value) as T : null;
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number) {
  const client = await redis();
  await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
}
