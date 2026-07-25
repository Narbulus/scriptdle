import express from 'express';
import { context, createServer, getServerPort } from '@devvit/server';
import { redis } from '@devvit/redis';
import { reddit } from '@devvit/reddit';
import { settings } from '@devvit/settings';
import type { UiResponse } from '@devvit/shared';

import {
  DEFAULT_TITLE_TEMPLATE,
  PACK_NAMES,
  PACK_THEME,
  generateDateOptions,
  getPostTitle,
  getTodayDate,
} from './packs.js';
import { loadUserStorage, readStats, recordGameCompletion } from './stats.js';

type PostConfig = { date: string; packId: string };

const app = express();
app.use(express.json());

// --- Helpers ---

/**
 * Post config rides on the post itself (`postData`) so the webview can read it
 * without a round trip. Legacy Blocks-era posts only have the Redis key, so
 * fall back to that.
 */
async function getPostConfig(postId: string | undefined): Promise<PostConfig | null> {
  const fromPostData = context.postData as Partial<PostConfig> | undefined;
  if (fromPostData?.date && fromPostData?.packId) {
    return { date: fromPostData.date, packId: fromPostData.packId };
  }

  if (!postId) return null;
  const raw = await redis.get(`post:${postId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PostConfig;
  } catch {
    console.error(`Corrupted post config for ${postId}:`, raw);
    return null;
  }
}

async function getSettings(): Promise<{ packs: string[]; postTime: number; template: string }> {
  const [packs, postTime, template] = await Promise.all([
    settings.get<string[]>('packs'),
    settings.get<string>('post-time'),
    settings.get<string>('title-template'),
  ]);
  const hour = parseInt(postTime ?? '6', 10);
  return {
    packs: packs?.length ? packs : ['harry-potter'],
    postTime: isNaN(hour) || hour < 0 || hour > 23 ? 6 : hour,
    template: template || DEFAULT_TITLE_TEMPLATE,
  };
}

/** Entrypoints are declared per pack in devvit.json; unknown packs use the default. */
function entryFor(packId: string): string {
  return PACK_NAMES[packId] ? packId : 'default';
}

async function createPuzzlePost(
  subredditName: string,
  packId: string,
  date: string,
  template: string
) {
  const post = await reddit.submitCustomPost({
    title: getPostTitle(template, packId, date),
    subredditName,
    entry: entryFor(packId),
    postData: { date, packId },
  });
  // Mirror to Redis so older clients and any postData-less path still resolve.
  await redis.set(`post:${post.id}`, JSON.stringify({ date, packId }));
  return post;
}

// --- Client API ---

/**
 * Everything the webview needs to boot: which puzzle, the user's saved state,
 * and stats if they already finished. Replaces the old READY/PUZZLE_CONFIG
 * postMessage handshake.
 */
app.get('/api/init', async (_req, res) => {
  try {
    const { postId, userId, subredditName } = context;
    const config = (await getPostConfig(postId)) ?? {
      date: getTodayDate(),
      packId: 'harry-potter',
    };

    let storageData: Record<string, string> = {};
    if (userId) {
      try {
        storageData = await loadUserStorage(userId);
      } catch (e) {
        console.error('Failed to load user storage, continuing with empty state:', e);
      }
    }

    // If this game is already complete, hand back stats in the same response.
    let stats = null;
    const gameStateStr = storageData[`scriptle:${config.packId}:${config.date}`];
    if (userId && gameStateStr) {
      try {
        const gameState = JSON.parse(gameStateStr);
        if (gameState.gameOver) {
          const bucket = gameState.success ? String(gameState.attempts) : 'fail';
          stats = await readStats(subredditName, config.packId, config.date, bucket);
        }
      } catch {
        /* ignore parse errors */
      }
    }

    const packTheme = PACK_THEME[config.packId] ?? {
      bg: '#1a1a1a',
      primary: '#ffffff',
      text: '#ffffff',
    };

    res.json({
      ...config,
      storageData,
      stats,
      loadingTheme: { ...packTheme, name: PACK_NAMES[config.packId] || config.packId },
    });
  } catch (e) {
    console.error('/api/init failed:', e);
    res.status(500).json({ error: 'Failed to load puzzle config' });
  }
});

app.post('/api/storage', async (req, res) => {
  const { userId } = context;
  if (!userId) return res.json({ ok: false });

  const { key, value } = req.body ?? {};
  if (typeof key !== 'string' || typeof value !== 'string') {
    return res.status(400).json({ error: 'key and value must be strings' });
  }

  await redis.hSet(`user:${userId}:storage`, { [key]: value });
  res.json({ ok: true });
});

app.post('/api/storage/clear', async (_req, res) => {
  const { userId } = context;
  if (!userId) return res.json({ ok: false });

  await redis.del(`user:${userId}:storage`);
  res.json({ ok: true });
});

app.post('/api/game-complete', async (req, res) => {
  try {
    const { userId, subredditName } = context;
    if (!userId) return res.json({ stats: null });

    const { packId, date, won, attempts } = req.body ?? {};
    const bucket = await recordGameCompletion(
      subredditName,
      packId,
      date,
      userId,
      won,
      attempts
    );
    res.json({ stats: await readStats(subredditName, packId, date, bucket) });
  } catch (e) {
    console.error('/api/game-complete failed:', e);
    res.status(500).json({ error: 'Failed to record completion' });
  }
});

app.post('/api/share', async (req, res) => {
  try {
    const { postId, username } = context;
    const { shareText } = req.body ?? {};
    if (!postId || !username) return res.json({ ok: false });

    await reddit.submitComment({
      id: postId,
      text: `u/${username} shared their results:\n\n${shareText}`,
      runAs: 'USER',
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to submit comment:', e);
    res.status(500).json({ error: 'Failed to submit comment' });
  }
});

// --- Scheduler ---

/**
 * Runs hourly; devvit.json crons are static, so the configurable post hour is
 * enforced here rather than by rescheduling the job.
 */
app.post('/internal/cron/daily-puzzle', async (_req, res) => {
  try {
    const { subredditName } = context;
    const { packs, postTime, template } = await getSettings();

    if (new Date().getUTCHours() !== postTime) return res.json({ skipped: true });

    const date = getTodayDate();
    for (const packId of packs) {
      await createPuzzlePost(subredditName, packId, date, template);
    }
    res.json({ posted: packs.length });
  } catch (e) {
    console.error('Daily puzzle job failed:', e);
    res.status(500).json({ error: 'Daily puzzle job failed' });
  }
});

// --- Menu actions & forms ---

app.post('/internal/menu/create-puzzle', async (_req, res) => {
  const response: UiResponse = {
    showForm: {
      name: 'create-puzzle',
      form: {
        title: 'Create Scriptle Puzzle',
        fields: [
          {
            type: 'select',
            name: 'packId',
            label: 'Movie Pack',
            options: Object.entries(PACK_NAMES).map(([value, label]) => ({ label, value })),
          },
          {
            type: 'select',
            name: 'date',
            label: 'Puzzle Date',
            options: generateDateOptions(),
          },
        ],
      },
    },
  };
  res.json(response);
});

app.post('/internal/forms/create-puzzle', async (req, res) => {
  try {
    const { subredditName } = context;
    const values = req.body?.values ?? req.body ?? {};
    const packId = Array.isArray(values.packId) ? values.packId[0] : values.packId;
    const date = Array.isArray(values.date) ? values.date[0] : values.date;

    if (!packId || !date) {
      return res.json({ showToast: 'Pick a pack and a date.' } satisfies UiResponse);
    }

    const { template } = await getSettings();
    const post = await createPuzzlePost(subredditName, packId, date, template);

    res.json({
      showToast: 'Scriptle puzzle posted!',
      navigateTo: post.url,
    } satisfies UiResponse);
  } catch (e) {
    console.error('Failed to create puzzle post:', e);
    res.json({ showToast: 'Failed to create puzzle post.' } satisfies UiResponse);
  }
});

app.post('/internal/menu/post-all', async (_req, res) => {
  try {
    const { subredditName } = context;
    const { packs, template } = await getSettings();
    const date = getTodayDate();

    for (const packId of packs) {
      await createPuzzlePost(subredditName, packId, date, template);
    }

    res.json({
      showToast: `Posted ${packs.length} puzzle${packs.length !== 1 ? 's' : ''} for ${date}`,
    } satisfies UiResponse);
  } catch (e) {
    console.error('Failed to post daily puzzles:', e);
    res.json({ showToast: 'Failed to post daily puzzles.' } satisfies UiResponse);
  }
});

const port = getServerPort();
createServer(app).listen(port, () => console.log(`Scriptle server listening on ${port}`));
