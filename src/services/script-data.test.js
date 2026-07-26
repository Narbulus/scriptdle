import { readFileSync } from 'fs';
import { describe, expect, test } from 'vitest';

const orderOfThePhoenix = JSON.parse(
  readFileSync('public/data/scripts/hp-order-of-phoenix.json', 'utf-8')
);

describe('script data attribution', () => {
  test('attributes the Inner Eye quote to Sybill Trelawney', () => {
    const line = orderOfThePhoenix.lines.find(
      ({ text }) => text === 'The Inner Eye does not See upon command!'
    );

    expect(line).toEqual({
      character: 'SYBILL TRELAWNEY',
      text: 'The Inner Eye does not See upon command!',
    });
  });
});
