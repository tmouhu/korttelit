/** Minimal i18n (US-30): Finnish and English. Language is stored in localStorage; switching reloads the page (state is autosaved). */
export type Lang = 'fi' | 'en';

const fi = {
  'app.title': 'Korttelit – korttelisuunnistus', 'brand.tagline': 'korttelisuunnistus', 'lang.label': 'Kieli', 'help.open': 'Ohje',
  'tab.map': 'Kartta', 'tab.course': 'Rata', 'tab.generate': 'Luo rata', 'tab.desc': 'Määrite', 'tab.export': 'Vie',
  'scale.custom': 'Oma…', 'scale.customLabel': 'Oma mittakaava 1:', 'scale.hint': 'Jaollinen 100:lla, enintään 1:50000 (ei pienempää).', 'scale.adjusted': 'Mittakaava muutettu arvoon 1:{v} (jaollinen 100:lla, 100–50000).', 'gen.areaTooLarge': 'Alue on liian suuri automaattiselle radalle ({km} km², enintään {max} km²). Valitse pienempi kehys tai suurempi mittakaava.',
  'search.placeholder': 'Hae paikkaa tai osoitetta', 'search.go': 'Hae', 'search.searching': 'Haetaan…', 'search.none': 'Ei tuloksia haulle "{q}".',
  'search.err.network': 'Haku epäonnistui. Tarkista verkkoyhteys ja yritä uudelleen.', 'search.err.rate-limited': 'Hakuja tehtiin liian tiheään. Yritä minuutin kuluttua uudelleen.', 'search.err.too-short': 'Kirjoita vähintään kaksi merkkiä.',
  'search.moved': 'Kehys siirretty: {name}', 'search.outside': 'Paikka on MapAnt-kartan peittoalueen ulkopuolella.',
  'course.name': 'Radan nimi', 'list.code': 'Koodi {code}', 'north.lines': 'Pohjoisviivat', 'north.spacing': 'Viivaväli',
  'paper': 'Paperi', 'orientation': 'Suunta', 'portrait': 'Pysty', 'landscape': 'Vaaka', 'scale': 'Mittakaava',
  'autoRot': 'Kääntö automaattisesti (magneettinen pohjoinen ylös)', 'rotation': 'Kääntö (°)',
  'centreFrame': 'Keskitä kehys näkymään', 'fitFrame': 'Zoomaa kehykseen',
  'info.area': 'Alue maastossa', 'info.centreE': 'Keskipiste E', 'info.centreN': 'Keskipiste N', 'info.decl': 'Deklinaatio',
  'info.conv': 'Meridiaanikonvergenssi', 'info.rot': 'Kartan kierto', 'info.margin': 'Marginaali',
  'course': 'Rata', 'tool.select': 'Valitse', 'tool.start': 'Lähtö', 'tool.control': 'Rasti', 'tool.finish': 'Maali',
  'undo': 'Kumoa', 'redo': 'Tee uudelleen', 'firstNumber': 'Ensimmäinen rastikoodi', 'clear': 'Tyhjennä rata',
  'clear.confirm': 'Tyhjennetäänkö rata?', 'list.start': 'Lähtö', 'list.finish': 'Maali', 'up': 'Ylös', 'down': 'Alas', 'delete': 'Poista',
  'lock': 'Lukitse', 'unlock': 'Vapauta',
  'stats': '{n} rastia · {len} m linnuntietä', 'course.default': 'Rata 1',
  'auto': 'Automaattinen rata', 'auto.hint': 'Aseta lähtö ja maali (maali puuttuessa rata on kierros). Rastit valitaan OSM-datasta.',
  'gen.dist': 'Haluttu pituus (m, linnuntietä)', 'gen.tol': 'Tarkkuus', 'gen.forest': 'Salli metsä- ja reunarastit',
  'gen.adv': 'Lisäasetukset', 'gen.min': 'Väli min (m)', 'gen.max': 'Väli max (m)', 'gen.ratio': 'Reitti / linnuntie max',
  'gen.fixSeed': 'Käytä annettua siementä', 'gen.seed': 'Siemen', 'gen.cands': 'Näytä ehdokaspisteet', 'gen.go': 'Luo rata', 'gen.cancel': 'Peruuta',
  'gen.lockHint': 'Lukitse rasti listasta (🔒), niin se säilyy uudelleenluonnissa.',
  'gen.needStart': 'Aseta ensin lähtö kartalle (työkalu "Lähtö").',
  'gen.done': 'Rata luotu: {n} rastia, {len} m linnuntietä ({dev} %), siemen {seed}.', 'gen.notWithin': ' Tavoitetta ei saavutettu toleranssin sisällä.',
  'gen.failed': 'Radan luonti epäonnistui: {msg}',
  'err.osm-unavailable': 'OSM-dataa ei saatu ladattua (Overpass-palvelimet eivät vastanneet). Yritä hetken päästä uudelleen.',
  'err.start-or-finish-not-near-network': 'Lähtö tai maali on liian kaukana kulkukelpoisesta tiestä tai polusta.',
  'err.no-course-found': 'Sopivaa rataa ei löytynyt. Kokeile lyhyempää matkaa, suurempaa aluetta tai salli metsärastit.', 'err.aborted': 'Peruttu.',
  'status.processing': 'Käsitellään kartta-aineistoa…', 'status.generating': 'Luodaan rataa…', 'status.osmCache': 'OSM-data välimuistista', 'status.osmLoading': 'Ladataan OSM-dataa ({host})…',
  'desc': 'Rastimääritteet', 'desc.include': 'Näytä kartalla (vedä paikalleen)', 'desc.cell': 'Ruudun koko', 'desc.page': 'Lisää määritteet omalle PDF-sivulle',
  'desc.edit': 'Muokkaa määritteitä…', 'desc.noSymbol': 'Ei symbolia (täytä käsin): {kinds}', 'desc.overlap': 'Huom: määritteet peittävät rastin tai radan osan.',
  'desc.col.c': 'C – Mikä', 'desc.col.d': 'D – Kohde', 'desc.col.e': 'E – Ulkonäkö', 'desc.col.f': 'F – Mitat / yhdistelmä', 'desc.col.g': 'G – Sijainti', 'desc.col.h': 'H – Muu',
  'desc.code': 'Koodi', 'desc.auto': 'Automaattinen', 'desc.blank': 'Tyhjä', 'desc.done': 'Valmis', 'desc.pick': 'Rasti {i}, sarake {col}',
  'export': 'Tulosta ja vie', 'dpi': 'Tarkkuus', 'pdf': 'Lataa PDF', 'xmlExport': 'Vie IOF XML', 'xmlImport': 'Tuo IOF XML…',
  'pdf.done': 'PDF ladattu.', 'pdf.outside': 'PDF ladattu. Huom: osa radasta on tulostusalueen ulkopuolella.', 'pdf.failed': 'PDF:n luonti epäonnistui: {msg}', 'pdf.mapFailed': 'taustakartan lataus epäonnistui',
  'pdf.loadingMap': 'Ladataan karttaa {i}/{n}…', 'pdf.building': 'Muodostetaan PDF…', 'pdf.info': '{n} rastia', 'pdf.north': 'Magneettinen pohjoinen ylös',
  'pdf.attribution': 'Taustakartta: MapAnt.fi / Maanmittauslaitos (CC BY 4.0)',
  'xml.saved': 'IOF XML tallennettu.', 'xml.replace': 'Korvataanko nykyinen rata tuodulla radalla?', 'xml.imported': 'Rata tuotu.', 'xml.importedWarn': 'Tuotu varoituksin: {w}', 'xml.failed': 'Tuonti epäonnistui: {msg}',
  'xml.err.invalid-xml': 'Tiedosto ei ole kelvollista XML:ää.', 'xml.err.not-coursedata': 'Tiedosto ei ole IOF XML -ratatiedosto (CourseData).', 'xml.err.no-course': 'Tiedostossa ei ole rataa.',
  'xml.err.no-race-course-data': 'Tiedostossa ei ole rata-aineistoa.', 'xml.err.no-geographic-positions': 'Rastien maantieteellisiä koordinaatteja (Position) ei löytynyt, joten rastien paikkaa kartalla ei voi päätellä.',
  'attr': 'Taustakartta: MapAnt.fi (CC BY 4.0, Maanmittauslaitos). Karttadata ja paikkahaku (Nominatim): © OpenStreetMapin tekijät (ODbL).',
  'warn.outside': 'Tulostuskehys ylittää MapAnt-kartan peittoalueen (Suomi). Alueen kartta puuttuu.',
  'warn.large': 'Suuri kuva ({mp} Mpx): PDF voi epäonnistua selaimessa. Valitse pienempi tarkkuus.',
  'disclaimer': 'Turvallisuus: Tarkista rata paikan päällä ennen käyttöä. Rastit ja reitit perustuvat karttadataan, joka voi olla vanhentunutta tai virheellistä. Varmista, ettei rata johda yksityisille alueille, vaarallisten teiden yli tai talviolosuhteissa vaarallisiin paikkoihin. Käytät työkalua omalla vastuullasi.\n\nJatketaanko?',
  'help.title': 'Ohje',
  'help.body': '<ol><li>Valitse paperi, mittakaava ja suunta. Raahaa punaista kehystä reunasta tai paina "Keskitä kehys näkymään".</li><li>Aseta <b>Lähtö</b>, rastit ja <b>Maali</b> klikkaamalla karttaa. Raahaa rasteja ja numeroita liikuttaaksesi niitä; lisää rasti klikkaamalla väliosaa.</li><li>Tai syötä pituus ja paina <b>Luo rata</b>: rastit valitaan OpenStreetMap-datasta ja tarkistetaan reitittämällä.</li><li>Rastimääritteet luodaan automaattisesti; raahaa taulukko haluamaasi paikkaan kartalla.</li><li><b>Lataa PDF</b> tulostaa kartan oikeassa mittakaavassa (tulosta 100 %). <b>Vie IOF XML</b> tallentaa radan muille ohjelmille.</li></ol><p>Kartta kierretään niin, että magneettinen pohjoinen on ylhäällä (deklinaatio miinus meridiaanikonvergenssi). Kaikki laskenta tapahtuu selaimessasi.</p>',
  'help.close': 'Sulje',
  'about': 'Tietoja', 'about.body': 'Taustakartta: MapAnt.fi / Maanmittauslaitos (CC BY 4.0). OSM-data © OpenStreetMapin tekijät (ODbL). Rastimääritteiden symbolit: svg-control-descriptions (Purple Pen). Paikkahaku: Nominatim (nominatim.openstreetmap.org); hakusana lähetetään sille vasta kun painat Hae. Työkalu on harjoituskäyttöön; ei takuita.',
  'offline.ready': 'Sovellus toimii nyt myös ilman verkkoa (kartta-aineisto vain jo ladatulta alueelta).',
  'offline': 'Offline-käyttö', 'offline.prefetch': 'Tallenna alue offline-käyttöön', 'offline.prefetching': 'Tallennetaan aluetta {i}/{n}…',
  'offline.done': 'Alue tallennettu: kartta ja OSM-data ovat käytettävissä ilman verkkoa.', 'offline.failed': 'Tallennus epäonnistui: {msg}',
  'offline.usage': 'Tallennustila: {mb} Mt', 'offline.clear': 'Tyhjennä välimuisti', 'offline.cleared': 'Välimuisti tyhjennetty.',
} as const;

type Key = keyof typeof fi;
const en: Record<Key, string> = {
  'app.title': 'Korttelit – urban orienteering planner', 'brand.tagline': 'urban orienteering', 'lang.label': 'Language', 'help.open': 'Help',
  'tab.map': 'Map', 'tab.course': 'Course', 'tab.generate': 'Generate', 'tab.desc': 'Descriptions', 'tab.export': 'Export',
  'scale.custom': 'Custom…', 'scale.customLabel': 'Custom scale 1:', 'scale.hint': 'Multiple of 100, at most 1:50000 (nothing smaller).', 'scale.adjusted': 'Scale changed to 1:{v} (multiple of 100, 100–50000).', 'gen.areaTooLarge': 'The area is too large for automatic generation ({km} km², max {max} km²). Choose a smaller frame or a larger scale.',
  'search.placeholder': 'Search place or address', 'search.go': 'Search', 'search.searching': 'Searching…', 'search.none': 'No results for "{q}".',
  'search.err.network': 'Search failed. Check your connection and try again.', 'search.err.rate-limited': 'Too many searches. Try again in a minute.', 'search.err.too-short': 'Type at least two characters.',
  'search.moved': 'Frame moved: {name}', 'search.outside': 'This place is outside the MapAnt coverage.',
  'course.name': 'Course name', 'list.code': 'Code {code}', 'north.lines': 'North lines', 'north.spacing': 'Line spacing',
  'paper': 'Paper', 'orientation': 'Orientation', 'portrait': 'Portrait', 'landscape': 'Landscape', 'scale': 'Scale',
  'autoRot': 'Rotate automatically (magnetic north up)', 'rotation': 'Rotation (°)',
  'centreFrame': 'Centre frame in view', 'fitFrame': 'Zoom to frame',
  'info.area': 'Ground area', 'info.centreE': 'Centre E', 'info.centreN': 'Centre N', 'info.decl': 'Declination',
  'info.conv': 'Meridian convergence', 'info.rot': 'Map rotation', 'info.margin': 'Margin',
  'course': 'Course', 'tool.select': 'Select', 'tool.start': 'Start', 'tool.control': 'Control', 'tool.finish': 'Finish',
  'undo': 'Undo', 'redo': 'Redo', 'firstNumber': 'First control code', 'clear': 'Clear course',
  'clear.confirm': 'Clear the course?', 'list.start': 'Start', 'list.finish': 'Finish', 'up': 'Up', 'down': 'Down', 'delete': 'Delete',
  'lock': 'Lock', 'unlock': 'Unlock',
  'stats': '{n} controls · {len} m as the crow flies', 'course.default': 'Course 1',
  'auto': 'Automatic course', 'auto.hint': 'Place a start and finish (without a finish the course is a loop). Controls are chosen from OSM data.',
  'gen.dist': 'Target length (m, crow-fly)', 'gen.tol': 'Tolerance', 'gen.forest': 'Allow forest and edge controls',
  'gen.adv': 'Advanced', 'gen.min': 'Leg min (m)', 'gen.max': 'Leg max (m)', 'gen.ratio': 'Route / crow-fly max',
  'gen.fixSeed': 'Use the given seed', 'gen.seed': 'Seed', 'gen.cands': 'Show candidate points', 'gen.go': 'Generate course', 'gen.cancel': 'Cancel',
  'gen.lockHint': 'Lock a control in the list (🔒) to keep it when regenerating.',
  'gen.needStart': 'Place a start on the map first (tool "Start").',
  'gen.done': 'Course generated: {n} controls, {len} m crow-fly ({dev} %), seed {seed}.', 'gen.notWithin': ' The target was not reached within the tolerance.',
  'gen.failed': 'Course generation failed: {msg}',
  'err.osm-unavailable': 'Could not load OSM data (the Overpass servers did not respond). Try again in a moment.',
  'err.start-or-finish-not-near-network': 'The start or finish is too far from a walkable road or path.',
  'err.no-course-found': 'No suitable course found. Try a shorter distance, a larger area, or allow forest controls.', 'err.aborted': 'Cancelled.',
  'status.processing': 'Processing map data…', 'status.generating': 'Generating course…', 'status.osmCache': 'OSM data from cache', 'status.osmLoading': 'Loading OSM data ({host})…',
  'desc': 'Control descriptions', 'desc.include': 'Show on map (drag into place)', 'desc.cell': 'Cell size', 'desc.page': 'Add descriptions on a separate PDF page',
  'desc.edit': 'Edit descriptions…', 'desc.noSymbol': 'No symbol (fill in manually): {kinds}', 'desc.overlap': 'Note: the descriptions cover a control or part of the course.',
  'desc.col.c': 'C – Which', 'desc.col.d': 'D – Feature', 'desc.col.e': 'E – Appearance', 'desc.col.f': 'F – Dimensions / combination', 'desc.col.g': 'G – Location', 'desc.col.h': 'H – Other',
  'desc.code': 'Code', 'desc.auto': 'Automatic', 'desc.blank': 'Blank', 'desc.done': 'Done', 'desc.pick': 'Control {i}, column {col}',
  'export': 'Print and export', 'dpi': 'Resolution', 'pdf': 'Download PDF', 'xmlExport': 'Export IOF XML', 'xmlImport': 'Import IOF XML…',
  'pdf.done': 'PDF downloaded.', 'pdf.outside': 'PDF downloaded. Note: part of the course is outside the print area.', 'pdf.failed': 'PDF creation failed: {msg}', 'pdf.mapFailed': 'could not load the background map',
  'pdf.loadingMap': 'Loading map {i}/{n}…', 'pdf.building': 'Building PDF…', 'pdf.info': '{n} controls', 'pdf.north': 'Magnetic north up',
  'pdf.attribution': 'Background map: MapAnt.fi / National Land Survey of Finland (CC BY 4.0)',
  'xml.saved': 'IOF XML saved.', 'xml.replace': 'Replace the current course with the imported one?', 'xml.imported': 'Course imported.', 'xml.importedWarn': 'Imported with warnings: {w}', 'xml.failed': 'Import failed: {msg}',
  'xml.err.invalid-xml': 'The file is not valid XML.', 'xml.err.not-coursedata': 'The file is not an IOF XML course file (CourseData).', 'xml.err.no-course': 'The file contains no course.',
  'xml.err.no-race-course-data': 'The file contains no course data.', 'xml.err.no-geographic-positions': 'No geographic control positions (Position) found, so control locations on the map cannot be determined.',
  'attr': 'Background map: MapAnt.fi (CC BY 4.0, National Land Survey of Finland). Map data and place search (Nominatim): © OpenStreetMap contributors (ODbL).',
  'warn.outside': 'The print frame extends beyond the MapAnt coverage (Finland). Map is missing there.',
  'warn.large': 'Large image ({mp} Mpx): the PDF may fail in the browser. Choose a lower resolution.',
  'disclaimer': 'Safety: check the course on site before use. Controls and routes are based on map data that may be outdated or wrong. Make sure the course does not lead onto private land, across dangerous roads, or into hazards in winter conditions. You use this tool at your own risk.\n\nContinue?',
  'help.title': 'Help',
  'help.body': '<ol><li>Choose paper, scale and orientation. Drag the red frame by its outline or press "Centre frame in view".</li><li>Place the <b>Start</b>, controls and <b>Finish</b> by clicking the map. Drag controls and numbers to move them; click on a leg to insert a control.</li><li>Or enter a length and press <b>Generate course</b>: controls are chosen from OpenStreetMap data and checked by routing.</li><li>Control descriptions are generated automatically; drag the table where you want it on the map.</li><li><b>Download PDF</b> prints the map at the true scale (print at 100 %). <b>Export IOF XML</b> saves the course for other software.</li></ol><p>The map is rotated so magnetic north is up (declination minus meridian convergence). All computation happens in your browser.</p>',
  'help.close': 'Close',
  'about': 'About', 'about.body': 'Background map: MapAnt.fi / National Land Survey of Finland (CC BY 4.0). OSM data © OpenStreetMap contributors (ODbL). Description symbols: svg-control-descriptions (Purple Pen). Place search: Nominatim (nominatim.openstreetmap.org); your search text is sent to it only when you press Search. For training use; no warranty.',
  'offline.ready': 'The app now also works offline (map data only for areas already loaded).',
  'offline': 'Offline use', 'offline.prefetch': 'Save area for offline use', 'offline.prefetching': 'Saving area {i}/{n}…',
  'offline.done': 'Area saved: the map and OSM data are available without a network.', 'offline.failed': 'Saving failed: {msg}',
  'offline.usage': 'Storage used: {mb} MB', 'offline.clear': 'Clear cache', 'offline.cleared': 'Cache cleared.',
};

const dicts: Record<Lang, Record<Key, string>> = { fi, en };

function detect(): Lang {
  try { const s = localStorage.getItem('osm-korttelit:lang'); if (s === 'fi' || s === 'en') return s; } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fi') ? 'fi' : 'en';
}

let lang: Lang = typeof localStorage === 'undefined' ? 'fi' : detect();
export const getLang = (): Lang => lang;
export function setLang(l: Lang): void { lang = l; try { localStorage.setItem('osm-korttelit:lang', l); } catch { /* ignore */ } }

export function t(key: Key, params: Record<string, string | number> = {}): string {
  const s = dicts[lang][key] ?? dicts.fi[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}
export type { Key as MessageKey };
export const hasKey = (k: string): boolean => k in dicts.fi;

export const numberFormat = (digits = 0): Intl.NumberFormat => new Intl.NumberFormat(lang === 'fi' ? 'fi-FI' : 'en-GB', { maximumFractionDigits: digits });

/** Fill elements marked with data-i18n / data-i18n-title in the document. */
export function applyStatic(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n as Key); });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml as Key); });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh as Key); });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => { const s = t(el.dataset.i18nTitle as Key); el.title = s; if (!el.textContent?.trim()) el.setAttribute('aria-label', s); });
  document.documentElement.lang = lang;
  document.title = t('app.title');
}
