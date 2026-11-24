import { describe, expect, it } from 'vitest';
import { getLang, setLang, t } from './i18n';
import { readFileSync } from 'node:fs';

describe('i18n', () => {
  it('has the same keys in both languages and interpolates', () => {
    setLang('en'); expect(getLang()).toBe('en');
    expect(t('stats', { n: 3, len: '1 200' })).toBe('3 controls · 1 200 m as the crow flies');
    setLang('fi'); expect(t('stats', { n: 3, len: '1 200' })).toBe('3 rastia · 1 200 m linnuntietä');
  });
  it('every data-i18n key used in index.html exists', () => {
    const html = readFileSync('index.html', 'utf8');
    const keys = [...html.matchAll(/data-i18n(?:-title|-html|-ph)?="([^"]+)"/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(30);
    setLang('en');
    for (const k of keys) expect(t(k as never)).not.toBe(k);
  });
});

import { formatLength } from './i18n';
describe('formatLength', () => {
  it('uses metres below 1 km and kilometres otherwise', () => {
    setLang('fi');
    expect(formatLength(0)).toBe('0 m');
    expect(formatLength(850.4)).toBe('850 m');
    expect(formatLength(999.4)).toBe('999 m');
    expect(formatLength(999.6)).toBe('1,0 km'); // rounds to 1000 m → kilometres
    expect(formatLength(1000)).toBe('1,0 km');
    expect(formatLength(1513)).toBe('1,5 km');
    expect(formatLength(12345)).toBe('12,3 km');
    setLang('en');
    expect(formatLength(1513)).toBe('1.5 km');
    expect(formatLength(640)).toBe('640 m');
    setLang('fi');
  });
});

import { formatScale } from './i18n';
describe('formatScale', () => {
  it('shows the full scale, or thousands when compact', () => {
    setLang('fi');
    expect(formatScale(4000)).toBe('1:4000');
    expect(formatScale(4000, true)).toBe('1:4 k');
    expect(formatScale(10000, true)).toBe('1:10 k');
    expect(formatScale(15000, true)).toBe('1:15 k');
    expect(formatScale(7500, true)).toBe('1:7,5 k');
    expect(formatScale(7300, true)).toBe('1:7,3 k');
    expect(formatScale(50000, true)).toBe('1:50 k');
    expect(formatScale(500, true)).toBe('1:500'); // below 1000: unchanged
    setLang('en');
    expect(formatScale(7500, true)).toBe('1:7.5 k');
    setLang('fi');
  });
});
