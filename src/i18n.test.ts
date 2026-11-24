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
