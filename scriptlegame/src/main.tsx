import { Devvit, useState } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

const PACK_NAMES: Record<string, string> = {
  'star-wars': 'Star Wars',
  'harry-potter': 'Harry Potter',
  'the-lord-of-the-rings': 'The Lord of the Rings',
  'bttf-trilogy': 'Back to the Future',
  'marvel': 'Marvel',
  'pixar-classics': 'Pixar Classics',
  'shrek': 'Shrek',
  'disney-classics': 'Disney Classics',
  'disney-pixar': 'Disney Pixar',
};

const PACK_THEME: Record<string, { bg: string; primary: string; text: string }> = {
  'star-wars': { bg: '#000000', primary: '#FFE81F', text: '#000000' },
  'harry-potter': { bg: '#2a0000', primary: '#d4af37', text: '#ffffff' },
  'the-lord-of-the-rings': { bg: '#1a2412', primary: '#d4af37', text: '#ffffff' },
  'shrek': { bg: '#5d4037', primary: '#7cb342', text: '#ffffff' },
  'bttf-trilogy': { bg: '#1a1a2e', primary: '#00d4ff', text: '#ffffff' },
  'pixar-classics': { bg: '#1d3557', primary: '#e63946', text: '#ffffff' },
  'disney-classics': { bg: '#7d5a9b', primary: '#d4af37', text: '#ffffff' },
  'disney-pixar': { bg: '#2c3e50', primary: '#4a90e2', text: '#ffffff' },
  'marvel': { bg: '#1a1a1a', primary: '#c62828', text: '#ffffff' },
};

Devvit.addSettings([
  {
    type: 'select',
    name: 'packs',
    label: 'Movie Packs',
    helpText: 'Select which packs to create daily posts for',
    options: Object.entries(PACK_NAMES).map(([value, label]) => ({ label, value })),
    multiSelect: true,
    defaultValue: ['harry-potter'],
  },
  {
    type: 'string',
    name: 'post-time',
    label: 'Daily Post Time (UTC)',
    helpText: 'Hour in UTC to post daily puzzles (0-23). Default: 6',
    defaultValue: '6',
    onValidate: ({ value }) => {
      const n = parseInt(value ?? '', 10);
      if (isNaN(n) || n < 0 || n > 23) return 'Must be a number 0-23';
    },
  },
  {
    type: 'string',
    name: 'title-template',
    label: 'Post Title Template',
    helpText: 'Use {pack} for pack name, {date} for date. Default: Scriptle Daily — {pack} ({date})',
    defaultValue: 'Scriptle Daily — {pack} ({date})',
  },
]);

function formatLocalDate(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getTodayDate(): string {
  return formatLocalDate(new Date());
}

// Load all scriptle:* keys for a user from Redis (stored in a hash per user)
async function loadUserStorage(redis: any, userId: string): Promise<Record<string, string>> {
  const hashKey = `user:${userId}:storage`;
  return (await redis.hGetAll(hashKey)) ?? {};
}

// --- Community Stats Helpers ---

const BUCKET_ORDER = ['1', '2', '3', '4', '5', 'fail'];

async function recordGameCompletion(
  redis: any,
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
    const globalDist = `stats:global:${packId}:${date}:dist`;
    const globalTotal = `stats:global:${packId}:${date}:total`;
    const subDist = `stats:sub:${subredditName}:${packId}:${date}:dist`;
    const subTotal = `stats:sub:${subredditName}:${packId}:${date}:total`;

    // Increment distribution hash field and total counter for both scopes
    await Promise.all([
      redis.hIncrBy(globalDist, bucket, 1),
      redis.incrBy(globalTotal, 1),
      redis.hIncrBy(subDist, bucket, 1),
      redis.incrBy(subTotal, 1),
      redis.set(dedupKey, '1'),
    ]);
  }

  return bucket;
}

function computePercentile(distribution: Record<string, string>, playerBucket: string, total: number): number {
  if (total === 0) return 50;
  const playerIdx = BUCKET_ORDER.indexOf(playerBucket);
  let worse = 0;
  for (let i = playerIdx + 1; i < BUCKET_ORDER.length; i++) {
    worse += parseInt(distribution[BUCKET_ORDER[i]] || '0', 10);
  }
  const same = parseInt(distribution[playerBucket] || '0', 10);
  return Math.round((worse + same * 0.5) / total * 100);
}

async function readStats(
  redis: any,
  subredditName: string,
  packId: string,
  date: string,
  playerBucket: string
): Promise<any> {
  const globalDist = `stats:global:${packId}:${date}:dist`;
  const globalTotal = `stats:global:${packId}:${date}:total`;
  const subDist = `stats:sub:${subredditName}:${packId}:${date}:dist`;
  const subTotal = `stats:sub:${subredditName}:${packId}:${date}:total`;

  const [gDist, gTotal, sDist, sTotal] = await Promise.all([
    redis.hGetAll(globalDist),
    redis.get(globalTotal),
    redis.hGetAll(subDist),
    redis.get(subTotal),
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

function getPostTitle(template: string, packId: string, date: string): string {
  const packName = PACK_NAMES[packId] || packId;
  return template.replace('{pack}', packName).replace('{date}', date);
}

async function scheduleDaily(context: Pick<Devvit.Context, 'settings' | 'scheduler'>): Promise<void> {
  const jobs = await context.scheduler.listJobs();
  for (const job of jobs) {
    if (job.name === 'daily-puzzle') await context.scheduler.cancelJob(job.id);
  }
  const hourStr = (await context.settings.get<string>('post-time')) ?? '6';
  const hour = parseInt(hourStr, 10) || 6;
  await context.scheduler.runJob({
    name: 'daily-puzzle',
    cron: `0 ${hour} * * *`,
  });
}

const loadingPreview = (
  <vstack alignment="middle center" height="100%" width="100%">
    <text size="xlarge" weight="bold" color="white">
      Scriptle
    </text>
    <spacer size="medium" />
    <text size="large" color="white">
      Loading today's puzzle...
    </text>
  </vstack>
);

// Custom Post Type
Devvit.addCustomPostType({
  name: 'Scriptle Puzzle',
  height: 'tall',
  render: (context) => {
    const postId = context.postId;

    const [postConfig] = useState<{ date: string; packId: string } | null>(async () => {
      if (!postId) return null;
      const raw = await context.redis.get(`post:${postId}`);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        console.error(`Corrupted post config for ${postId}:`, raw);
        return null;
      }
    });

    // Use per-pack HTML files for themed loading screens (built by bundle-reddit-data.js)
    const packId = postConfig?.packId ?? null;
    const webviewUrl = packId ? `${packId}.html` : 'index.html';

    return (
      <vstack height="100%" width="100%">
        <webview
          id="scriptle-game"
          url={webviewUrl}
          width="100%"
          height="100%"
          onMessage={async (msg: any) => {
            if (msg.type === 'READY') {
              const config = postConfig ?? { date: getTodayDate(), packId: 'harry-potter' };

              // Load user's saved game state from Redis — if this fails, still send config with empty storage
              const userId = context.userId;
              let storageData: Record<string, string> = {};
              if (userId) {
                try {
                  storageData = await loadUserStorage(context.redis, userId);
                } catch (e) {
                  console.error('Failed to load user storage, continuing with empty state:', e);
                }
              }

              const packTheme = PACK_THEME[config.packId] || { bg: '#1a1a1a', primary: '#ffffff', text: '#ffffff' };
              const packName = PACK_NAMES[config.packId] || config.packId;
              context.ui.webView.postMessage('scriptle-game', {
                type: 'PUZZLE_CONFIG',
                data: { ...config, storageData, loadingTheme: { ...packTheme, name: packName } },
              });

              // If game is already complete, send stats immediately
              if (userId) {
                const { date, packId } = config;
                const gameStateKey = `scriptle:${packId}:${date}`;
                const gameStateStr = storageData[gameStateKey];
                if (gameStateStr) {
                  try {
                    const gameState = JSON.parse(gameStateStr);
                    if (gameState.gameOver) {
                      const bucket = gameState.success ? String(gameState.attempts) : 'fail';
                      const subreddit = await context.reddit.getCurrentSubreddit();
                      const stats = await readStats(context.redis, subreddit.name, packId, date, bucket);
                      context.ui.webView.postMessage('scriptle-game', {
                        type: 'STATS_UPDATE',
                        data: stats,
                      });
                    }
                  } catch (_e) { /* ignore parse errors */ }
                }
              }
            } else if (msg.type === 'GAME_COMPLETE') {
              const userId = context.userId;
              if (userId) {
                const { packId, date, won, attempts } = msg.data;
                const subreddit = await context.reddit.getCurrentSubreddit();
                const bucket = await recordGameCompletion(
                  context.redis, subreddit.name, packId, date, userId, won, attempts
                );
                const stats = await readStats(context.redis, subreddit.name, packId, date, bucket);
                context.ui.webView.postMessage('scriptle-game', {
                  type: 'STATS_UPDATE',
                  data: stats,
                });
              }
            } else if (msg.type === 'STORAGE_SET') {
              const userId = context.userId;
              if (userId) {
                const { key, value } = msg.data;
                const hashKey = `user:${userId}:storage`;
                await context.redis.hSet(hashKey, { [key]: value });
              }
            } else if (msg.type === 'STORAGE_CLEAR') {
              const userId = context.userId;
              if (userId) {
                const hashKey = `user:${userId}:storage`;
                await context.redis.del(hashKey);
              }
            } else if (msg.type === 'SHARE_RESULTS') {
              const { shareText } = msg.data;
              const currentUser = await context.reddit.getCurrentUser();
              if (currentUser && postId) {
                const username = currentUser.username;
                const commentText = `u/${username} shared their results:\n\n${shareText}`;
                try {
                  await context.reddit.submitComment({
                    id: postId,
                    text: commentText,
                  });
                } catch (e) {
                  console.error('Failed to submit comment:', e);
                }
              }
            }
          }}
        />
      </vstack>
    );
  },
});

// Start epoch for past puzzle dates (frozen constant)
const START_EPOCH = '2026-01-12';

function generateDateOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  const today = new Date();
  const startEpoch = new Date(START_EPOCH + 'T00:00:00');
  const current = new Date(today);

  const todayStr = formatLocalDate(today);
  while (current >= startEpoch) {
    const dateStr = formatLocalDate(current);
    const label = dateStr === todayStr ? `${dateStr} (today)` : dateStr;
    options.push({ label, value: dateStr });
    current.setDate(current.getDate() - 1);
  }

  return options;
}

// Form for manual post creation — pack picker + date selector
const packPickerForm = Devvit.createForm(
  (data) => ({
    title: 'Create Scriptle Puzzle',
    fields: [
      {
        type: 'select' as const,
        name: 'packId',
        label: 'Movie Pack',
        options: data.packOptions as { label: string; value: string }[],
      },
      {
        type: 'select' as const,
        name: 'date',
        label: 'Puzzle Date',
        options: data.dateOptions as { label: string; value: string }[],
      },
    ],
  }),
  async (event, context) => {
    const packId = event.values.packId[0];
    const date = event.values.date[0];
    const template = (await context.settings.get<string>('title-template')) ?? 'Scriptle Daily — {pack} ({date})';
    const title = getPostTitle(template, packId, date);
    const subreddit = await context.reddit.getCurrentSubreddit();
    const post = await context.reddit.submitPost({
      title,
      subredditName: subreddit.name,
      preview: loadingPreview,
    });
    await context.redis.set(`post:${post.id}`, JSON.stringify({ date, packId }));
    context.ui.showToast('Scriptle puzzle posted!');
    context.ui.navigateTo(post);
  }
);

// Menu action: Create a Scriptle Puzzle post
Devvit.addMenuItem({
  label: 'Create Scriptle Puzzle',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const packOptions = Object.entries(PACK_NAMES).map(([value, label]) => ({ label, value }));
    const dateOptions = generateDateOptions();
    context.ui.showForm(packPickerForm, { packOptions, dateOptions });
  },
});

// Menu action: Post all configured packs for today
Devvit.addMenuItem({
  label: 'Post All Daily Puzzles',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const date = getTodayDate();
    const packs = (await context.settings.get<string[]>('packs')) ?? ['harry-potter'];
    const template = (await context.settings.get<string>('title-template')) ?? 'Scriptle Daily — {pack} ({date})';
    const subreddit = await context.reddit.getCurrentSubreddit();

    for (const packId of packs) {
      const title = getPostTitle(template, packId, date);
      const post = await context.reddit.submitPost({
        title,
        subredditName: subreddit.name,
        preview: loadingPreview,
      });
      await context.redis.set(`post:${post.id}`, JSON.stringify({ date, packId }));
    }

    context.ui.showToast(`Posted ${packs.length} puzzle${packs.length !== 1 ? 's' : ''} for ${date}`);
  },
});

// Scheduled job: auto-post daily puzzle for each configured pack
Devvit.addSchedulerJob({
  name: 'daily-puzzle',
  onRun: async (_event, context) => {
    const date = getTodayDate();
    const packs = (await context.settings.get<string[]>('packs')) ?? ['harry-potter'];
    const template = (await context.settings.get<string>('title-template')) ?? 'Scriptle Daily — {pack} ({date})';
    const subreddit = await context.reddit.getCurrentSubreddit();

    for (const packId of packs) {
      const title = getPostTitle(template, packId, date);
      const post = await context.reddit.submitPost({
        title,
        subredditName: subreddit.name,
        preview: loadingPreview,
      });
      await context.redis.set(`post:${post.id}`, JSON.stringify({ date, packId }));
    }
  },
});

// On app install/upgrade: schedule the daily puzzle job
Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (_event, context) => { await scheduleDaily(context); },
});

Devvit.addTrigger({
  event: 'AppUpgrade',
  onEvent: async (_event, context) => { await scheduleDaily(context); },
});

export default Devvit;
