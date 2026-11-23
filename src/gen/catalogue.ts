import type { Tags } from './osm';

/**
 * Control suitability catalogue (EN-11 / US-14): which OSM features may carry a control.
 * `weight` = how attractive (clearly identifiable, unambiguous) the feature is; `forest` = only used when forest controls are allowed.
 * `icon` is the key later used by control descriptions (US-26).
 */
export interface KindInfo { label: { fi: string; en: string }; weight: number; forest?: boolean }

export const CATALOGUE: Record<string, KindInfo> = {
  building_corner: { label: { fi: 'rakennuksen kulma', en: 'building corner' }, weight: 2.2 },
  path_junction: { label: { fi: 'polkujen risteys', en: 'path junction' }, weight: 2 },
  bridge: { label: { fi: 'silta', en: 'bridge' }, weight: 2.5 },
  steps: { label: { fi: 'portaat', en: 'steps' }, weight: 1.3 },
  fence_corner: { label: { fi: 'aidan kulma', en: 'fence corner' }, weight: 1.6 },
  wall_corner: { label: { fi: 'muurin kulma', en: 'wall corner' }, weight: 1.6 },
  statue: { label: { fi: 'patsas / muistomerkki', en: 'statue / memorial' }, weight: 3.5 },
  fountain: { label: { fi: 'suihkulähde', en: 'fountain' }, weight: 3 },
  well: { label: { fi: 'kaivo', en: 'well' }, weight: 3 },
  bench: { label: { fi: 'penkki', en: 'bench' }, weight: 1.2 },
  picnic_table: { label: { fi: 'pöytä', en: 'picnic table' }, weight: 2 },
  shelter: { label: { fi: 'katos', en: 'shelter' }, weight: 2.5 },
  flagpole: { label: { fi: 'lipputanko', en: 'flagpole' }, weight: 1.5 },
  tower: { label: { fi: 'torni / masto', en: 'tower' }, weight: 2.5 },
  cross: { label: { fi: 'risti / obeliski', en: 'cross / obelisk' }, weight: 3 },
  boulder: { label: { fi: 'kivi', en: 'boulder' }, weight: 3 },
  landmark_tree: { label: { fi: 'merkkipuu', en: 'landmark tree' }, weight: 2 },
  bus_stop: { label: { fi: 'pysäkki', en: 'bus stop' }, weight: 1.2 },
  viewpoint: { label: { fi: 'näköalapaikka', en: 'viewpoint' }, weight: 2.5 },
  clock: { label: { fi: 'kello', en: 'clock' }, weight: 2 },
  toilets: { label: { fi: 'wc', en: 'toilets' }, weight: 1.5 },
  park_corner: { label: { fi: 'puiston kulma', en: 'park corner' }, weight: 1 },
  wood_corner: { label: { fi: 'metsän reuna', en: 'forest edge' }, weight: 1, forest: true },
  locked: { label: { fi: 'oma rasti', en: 'manual control' }, weight: 1 },
};

/** Map a tagged OSM node to a catalogue kind (undefined = not a control feature). */
export function poiKind(t: Tags): string | undefined {
  if (t.tourism === 'artwork' || t.historic === 'statue' || t.historic === 'memorial' || t.historic === 'monument' || t.historic === 'wayside_shrine' || t.historic === 'boundary_stone' || t.historic === 'ruins' || t.historic === 'fort') return 'statue';
  if (t.historic === 'wayside_cross' || t.man_made === 'cross' || t.man_made === 'obelisk') return 'cross';
  if (t.amenity === 'fountain') return 'fountain';
  if (t.man_made === 'water_well' || t.amenity === 'drinking_water') return 'well';
  if (t.amenity === 'bench') return 'bench';
  if (t.leisure === 'picnic_table' || t.tourism === 'picnic_site' || t.leisure === 'firepit') return 'picnic_table';
  if (t.amenity === 'shelter') return 'shelter';
  if (t.man_made === 'flagpole') return 'flagpole';
  if (t.man_made === 'tower') return 'tower';
  if (t.natural === 'stone' || t.natural === 'rock') return 'boulder';
  if (t.natural === 'tree') return 'landmark_tree';
  if (t.highway === 'bus_stop') return 'bus_stop';
  if (t.tourism === 'viewpoint') return 'viewpoint';
  if (t.amenity === 'clock') return 'clock';
  if (t.amenity === 'toilets') return 'toilets';
  return undefined;
}
