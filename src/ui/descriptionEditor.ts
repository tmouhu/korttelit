import { type CourseStore, type DescColumn } from '../core/course';
import { buildDescriptions, COLUMNS } from '../core/descriptions';
import { getLang, t } from '../i18n';
import { ensureSymbols, SYMBOL_INFO, symbolsForColumn, symbolUrl } from '../render/symbols';

const colName = (c: DescColumn): string => t(`desc.col.${c}` as never);
const symName = (id: string): string => SYMBOL_INFO[id]?.[getLang()] ?? id;

/** Modal editor for control descriptions (US-28): click a cell, pick a symbol, reset to automatic, or blank it. */
export function openDescriptionEditor(store: CourseStore, getNorth: () => number, onChange: () => void): void {
  const dlg = document.createElement('dialog');
  dlg.className = 'desc-editor';
  document.body.appendChild(dlg);
  let picking: { index: number; col: DescColumn } | null = null;

  const cellHtml = (id: string | undefined, overridden: boolean): string =>
    `<span class="cell${overridden ? ' ov' : ''}">${id ? (symbolUrl(id) ? `<img src="${symbolUrl(id)}" alt="${id}" title="${symName(id)}">` : id) : ''}</span>`;

  async function render(): Promise<void> {
    const d = buildDescriptions(store.course, getNorth());
    const ids = d.lines.flatMap((l) => COLUMNS.map((c) => l.row[c]).filter((x): x is string => !!x));
    if (picking) ids.push(...symbolsForColumn(picking.col));
    await ensureSymbols(ids);
    let html = `<h3>${t('desc')}</h3><table><thead><tr><th>#</th><th>${t('desc.code')}</th>` + COLUMNS.map((c) => `<th>${colName(c)}</th>`).join('') + '</tr></thead><tbody>';
    d.lines.forEach((l) => {
      const ctl = store.course.controls[l.index]!;
      html += `<tr><td>${l.number}</td><td>${l.code}</td>` + COLUMNS.map((c) => `<td><button data-i="${l.index}" data-c="${c}">${cellHtml(l.row[c], ctl.desc?.[c] !== undefined)}</button></td>`).join('') + '</tr>';
    });
    html += '</tbody></table>';
    if (picking) {
      const { index, col } = picking;
      html += `<div class="palette"><b>${t('desc.pick', { i: index + 1, col: colName(col) })}</b><div class="grid">` +
        `<button data-act="auto">${t('desc.auto')}</button><button data-act="blank">${t('desc.blank')}</button>` +
        symbolsForColumn(col).map((id) => `<button data-pick="${id}" title="${symName(id)}"><img src="${symbolUrl(id) ?? ''}" alt="${id}"></button>`).join('') + '</div></div>';
    }
    html += `<p><button data-act="close">${t('desc.done')}</button></p>`;
    dlg.innerHTML = html;
  }

  const setOverride = (index: number, col: DescColumn, value: string | undefined): void => {
    const controls = store.course.controls.map((k, i) => {
      if (i !== index) return k;
      const desc = { ...(k.desc ?? {}) };
      if (value === undefined) delete desc[col]; else desc[col] = value;
      return { ...k, desc: Object.keys(desc).length ? desc : undefined };
    });
    store.commit({ ...store.course, controls });
    onChange();
  };

  dlg.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('button'); if (!t) return;
    if (t.dataset.act === 'close') { dlg.close(); dlg.remove(); return; }
    if (picking && t.dataset.act === 'auto') { setOverride(picking.index, picking.col, undefined); picking = null; }
    else if (picking && t.dataset.act === 'blank') { setOverride(picking.index, picking.col, ''); picking = null; }
    else if (picking && t.dataset.pick) { setOverride(picking.index, picking.col, t.dataset.pick); picking = null; }
    else if (t.dataset.i !== undefined && t.dataset.c) picking = { index: Number(t.dataset.i), col: t.dataset.c as DescColumn };
    void render();
  });
  dlg.addEventListener('close', () => dlg.remove());
  void render().then(() => dlg.showModal());
}
