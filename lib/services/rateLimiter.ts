type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

function pruneOld(timestamps: number[], windowMs: number, now: number) {
  while (timestamps.length > 0 && now - timestamps[0] >= windowMs) {
    timestamps.shift();
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };

  pruneOld(bucket.timestamps, windowMs, now);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const resetAt = oldest + windowMs;
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  const remaining = Math.max(0, limit - bucket.timestamps.length);
  return {
    allowed: true,
    remaining,
    resetAt: now + windowMs,
  };
}

