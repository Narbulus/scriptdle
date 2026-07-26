export const PACK_NAMES: Record<string, string> = {
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

export const PACK_THEME: Record<string, { bg: string; primary: string; text: string }> = {
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

/** Start epoch for past puzzle dates (frozen constant). */
export const START_EPOCH = '2026-01-12';

export const DEFAULT_TITLE_TEMPLATE = 'Scriptle Daily — {pack} ({date})';

export function formatLocalDate(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export function getTodayDate(): string {
  return formatLocalDate(new Date());
}

export function getPostTitle(template: string, packId: string, date: string): string {
  const packName = PACK_NAMES[packId] || packId;
  return template.replace('{pack}', packName).replace('{date}', date);
}

export function generateDateOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  const today = new Date();
  const startEpoch = new Date(START_EPOCH + 'T00:00:00');
  const current = new Date(today);
  const todayStr = formatLocalDate(today);

  while (current >= startEpoch) {
    const dateStr = formatLocalDate(current);
    options.push({ label: dateStr === todayStr ? `${dateStr} (today)` : dateStr, value: dateStr });
    current.setDate(current.getDate() - 1);
  }

  return options;
}
