const fs = require('fs');
const path = require('path');

const baseMapDir = path.join(__dirname, '../static/base_map');
const outputFile = path.join(__dirname, '../app/generatedBaseMapCache.ts');

// Color to layer mapping
const LAYER_COLORS = {
  '#35a043': 'level2',
  '#4ac34e': 'level3',
  '#83e1c3': 'river',
};

// Parse SVG path d attribute to flat coordinate arrays
function parsePathData(d) {
  const polygons = [];
  // Split by M to get individual polygons (skip empty first element)
  const parts = d.split(/M/).filter(p => p.trim());

  for (const part of parts) {
    const coords = [];
    // Match all coordinate pairs (handles both M and L commands)
    const matches = part.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g);
    for (const match of matches) {
      // Push x and y as separate elements (flat array)
      coords.push(parseFloat(match[1]), parseFloat(match[2]));
    }
    if (coords.length > 0) {
      polygons.push(coords);
    }
  }
  return polygons;
}

// Extract layer data from SVG content
function extractLayers(svgContent) {
  const layers = { level2: [], level3: [], river: [] };

  // Match path elements - extract full path tag then parse attributes
  const pathRegex = /<path([^>]*)\/>/g;
  let match;
  while ((match = pathRegex.exec(svgContent)) !== null) {
    const attrs = match[1];

    // Extract fill and d attributes
    const fillMatch = attrs.match(/fill="([^"]+)"/);
    const dMatch = attrs.match(/d="([^"]+)"/);

    if (fillMatch && dMatch) {
      const fill = fillMatch[1];
      const d = dMatch[1];
      const layer = LAYER_COLORS[fill];
      if (layer) {
        const polygons = parsePathData(d);
        layers[layer].push(...polygons);
      }
    }
  }

  return layers;
}

// Process all SVG files
const files = fs.readdirSync(baseMapDir).filter(f => f.endsWith('.svg'));
const cache = {};
const dataCache = {};

for (const file of files) {
  // Extract map number from filename (e.g., "1 - SDfVaDl.svg" -> 1)
  const match = file.match(/^!?(\d+)\s*-/);
  if (!match) continue;

  const mapNumber = parseInt(match[1], 10);
  cache[mapNumber] = file;

  // Extract layer data from SVG
  const content = fs.readFileSync(path.join(baseMapDir, file), 'utf-8');
  const layers = extractLayers(content);
  dataCache[mapNumber] = layers;
}

// Generate TypeScript output
const output = `// Auto-generated file - do not edit manually
// Run: node scripts/generateBaseMapCache.js

export const baseMapCache: Record<number, string> = ${JSON.stringify(cache, null, 2)};

export function getBaseMapSrc(mapNumber: number): string | null {
  const path = baseMapCache[mapNumber];
  return path ? 'static/base_map/' + path : null;
}

export type BaseMapData = {
  level2: number[][];
  level3: number[][];
  river: number[][];
};

export const baseMapDataCache: Record<number, BaseMapData> = ${JSON.stringify(dataCache, null, 2)};

export function getBaseMapData(mapNumber: number): { imagesrc: string; data: BaseMapData } | null {
  const filename = baseMapCache[mapNumber];
  const data = baseMapDataCache[mapNumber];
  if (!filename || !data) return null;
  return {
    imagesrc: 'static/base_map/' + filename,
    data: data,
  };
}
`;

fs.writeFileSync(outputFile, output);
console.log(`Generated cache with ${Object.keys(cache).length} base maps`);
