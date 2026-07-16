import { afterEach, describe, expect, test, vi } from 'vitest';
import { clearCache, loadGameDataForDate, loadPuzzleForDate } from './dataLoader.js';

const pack = {
  id: 'test-pack',
  theme: { primary: '#123456' },
  manifest: { packName: 'Test Pack' },
  gameMetadata: { movies: ['test-movie'] },
};

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) };
}

afterEach(() => {
  clearCache();
  vi.unstubAllGlobals();
});

describe('shared data loader', () => {
  test('loads date-specific data and attaches pack metadata', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ packs: [pack], categories: ['Test'] }))
      .mockResolvedValueOnce(response({
        puzzles: {
          'test-pack': { packId: 'test-pack', date: '2026-07-09', puzzle: { targetLine: {} } },
        },
      }));
    vi.stubGlobal('fetch', fetch);

    const data = await loadGameDataForDate('2026-07-09');

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/data/packs-full.json',
      '/data/daily-all/2026-07-09.json',
    ]);
    expect(data.puzzles['test-pack'].metadata).toEqual(pack.gameMetadata);
    expect(data.manifests['test-pack']).toEqual(pack.manifest);
  });

  test('supports relative bundled data paths for embedded builds', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ packs: [pack] }))
      .mockResolvedValueOnce(response({
        puzzles: {
          'test-pack': { packId: 'test-pack', date: '2026-07-09', puzzle: { targetLine: {} } },
        },
      }));
    vi.stubGlobal('fetch', fetch);

    const result = await loadPuzzleForDate('2026-07-09', 'test-pack', { basePath: 'data' });

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'data/packs-full.json',
      'data/daily-all/2026-07-09.json',
    ]);
    expect(result.manifest.packName).toBe('Test Pack');
    expect(result.puzzle.metadata).toEqual(pack.gameMetadata);
  });

  test('reports unavailable puzzles consistently', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ packs: [pack] }))
      .mockResolvedValueOnce(response({ puzzles: {} })));

    await expect(loadPuzzleForDate('2026-07-09', 'missing-pack'))
      .rejects.toThrow('No puzzle for "missing-pack" on 2026-07-09');
  });
});
