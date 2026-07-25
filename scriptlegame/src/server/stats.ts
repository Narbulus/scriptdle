import { redis } from '@devvit/redis';

const BUCKET_ORDER = ['1', '2', '3', '4', '5', 'fail'];

export type Stats = {
  subreddit: { name: string; distribution: Record<string, string>; totalPlayers: number };
  global: { distribution: Record<string, string>; totalPlayers: number };
  playerResult: { bucket: string; percentile: number };
};

/** Load all scriptle:* keys for a user (stored in a hash per user). */
export async function loadUserStorage(userId: string): Promise<Record<string, string>> {
  return (await redis.hGetAll(`user:${userId}:storage`)) ?? {};
}

export async function recordGameCompletion(
  subredditName: string,
  packId: string,
  date: string,
  userId: string,
  won: boolean,
  attempts: number
): Promise<string> {
  const dedupKey = `user:${userId}:submitted:${packId}:${date}`;
  const already = await redis.get(dedupKey);
  const bucket = won ? String(attempts) : 'fail';

  if (!already) {
    await Promise.all([
      redis.hIncrBy(`stats:global:${packId}:${date}:dist`, bucket, 1),
      redis.incrBy(`stats:global:${packId}:${date}:total`, 1),
      redis.hIncrBy(`stats:sub:${subredditName}:${packId}:${date}:dist`, bucket, 1),
      redis.incrBy(`stats:sub:${subredditName}:${packId}:${date}:total`, 1),
      redis.set(dedupKey, '1'),
    ]);
  }

  return bucket;
}

function computePercentile(
  distribution: Record<string, string>,
  playerBucket: string,
  total: number
): number {
  if (total === 0) return 50;
  const playerIdx = BUCKET_ORDER.indexOf(playerBucket);
  let worse = 0;
  for (let i = playerIdx + 1; i < BUCKET_ORDER.length; i++) {
    worse += parseInt(distribution[BUCKET_ORDER[i]] || '0', 10);
  }
  const same = parseInt(distribution[playerBucket] || '0', 10);
  return Math.round(((worse + same * 0.5) / total) * 100);
}

export async function readStats(
  subredditName: string,
  packId: string,
  date: string,
  playerBucket: string
): Promise<Stats> {
  const [gDist, gTotal, sDist, sTotal] = await Promise.all([
    redis.hGetAll(`stats:global:${packId}:${date}:dist`),
    redis.get(`stats:global:${packId}:${date}:total`),
    redis.hGetAll(`stats:sub:${subredditName}:${packId}:${date}:dist`),
    redis.get(`stats:sub:${subredditName}:${packId}:${date}:total`),
  ]);

  const globalTotalNum = parseInt(gTotal || '0', 10);
  const subTotalNum = parseInt(sTotal || '0', 10);

  return {
    subreddit: {
      name: subredditName,
      distribution: sDist || {},
      totalPlayers: subTotalNum,
    },
    global: {
      distribution: gDist || {},
      totalPlayers: globalTotalNum,
    },
    playerResult: {
      bucket: playerBucket,
      percentile: computePercentile(sDist || {}, playerBucket, subTotalNum),
    },
  };
}
