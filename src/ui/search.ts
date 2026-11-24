import { geocoder, GeocodeFailure, placeToTM35, type Place } from '../data/geocode';
import type { TM35 } from '../core/projection';
import { getLang, t, type MessageKey } from '../i18n';

/** Place search box on the map (Nominatim, search on submit only). */
export function setupSearch(onPick: (pos: TM35, place: Place) => void, onMessage: (msg: string) => void): void {
  const form = document.getElementById('search') as HTMLFormElement;
  const input = document.getElementById('q') as HTMLInputElement;
  const list = document.getElementById('results') as HTMLUListElement;
  let abort: AbortController | null = null;

  const close = (): void => { list.hidden = true; list.innerHTML = ''; };
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function show(places: Place[]): void {
    list.innerHTML = '';
    places.forEach((p) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<b>${esc(p.title)}</b>${p.detail ? `<small>${esc(p.detail)}</small>` : ''}`;
      b.addEventListener('click', () => { close(); input.value = p.title; onPick(placeToTM35(p), p); });
      li.appendChild(b); list.appendChild(li);
    });
    list.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value;
    if (q.trim().length < 2) return;
    abort?.abort(); abort = new AbortController();
    form.classList.add('busy'); onMessage(t('search.searching'));
    try {
      const places = await geocoder.search(q, getLang(), abort.signal);
      if (!places.length) { close(); onMessage(t('search.none', { q: q.trim() })); }
      else { onMessage(''); show(places); (list.querySelector('button') as HTMLButtonElement | null)?.focus(); }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      close();
      onMessage(err instanceof GeocodeFailure ? t(`search.err.${err.code.replace('search-', '')}` as MessageKey) : t('search.err.network'));
    } finally { form.classList.remove('busy'); }
  });

  // keyboard: arrows move through results, Escape closes
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); abort?.abort(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(list.querySelectorAll<HTMLButtonElement>('button'));
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
    items[next]!.focus();
  });
  document.addEventListener('pointerdown', (e) => { if (!form.contains(e.target as Node)) close(); });
}
