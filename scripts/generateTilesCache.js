const fs = require('fs');
const path = require('path');

const tilesDir = path.join(__dirname, '../static/tiles_data');
const svgOutputFile = path.join(__dirname, '../app/generatedTilesCache.ts');
const pathsOutputFile = path.join(__dirname, '../app/generatedTilesPathsCache.ts')

// Common SVG header and footer that all tiles share
const SVG_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="160" height="160">';
const SVG_FOOTER = '</svg>';

// Color to layer mapping
const LAYER_COLORS = {
  '#737a89': 'rock',
  '#eee9a9': 'sand',
  '#83e1c3': 'water',
};

// Parse SVG path d attribute to flat coordinate arrays
// Handles both comma-separated (M16,0) and space-separated (M 16 0) formats
function parsePathData(d) {
  const polygons = [];
  // Split by M to get individual polygons (skip empty first element)
  const parts = d.split(/M/).filter(p => p.trim());

  for (const part of parts) {
    const coords = [];
    // Match all numbers (handles both "16,0" and "16 0" formats)
    const matches = part.matchAll(/(-?\d+\.?\d*)/g);
    const numbers = [];
    for (const match of matches) {
      const num = parseFloat(match[1]);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
    // Pair up numbers as x,y coordinates
    for (let i = 0; i < numbers.length - 1; i += 2) {
      coords.push(numbers[i], numbers[i + 1]);
    }
    if (coords.length > 0) {
      polygons.push(coords);
    }
  }
  return polygons;
}

// Extract layer data from SVG content
function extractLayers(svgContent) {
  const layers = { rock: [], sand: [], water: [] };

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

// Strip the common header/footer from SVG content
function stripSvgWrapper(content) {
  let stripped = content.trim();

  // Remove XML declaration if present
  stripped = stripped.replace(/^<\?xml[^?]*\?>\s*/i, '');

  // Remove opening svg tag (with any attributes)
  stripped = stripped.replace(/^<svg[^>]*>\s*/i, '');

  // Remove closing svg tag
  stripped = stripped.replace(/\s*<\/svg>\s*$/i, '');

  return stripped.trim();
}

// Process all SVG files
const files = fs.readdirSync(tilesDir).filter(f => f.endsWith('.svg'));
const svgCache = {};
const pathsCache = {};

for (const file of files) {
  // Extract tile number from filename (e.g., "1 - SDfVaDl.svg" -> 1)
  const match = file.match(/^!?(\d+)\s*-/);
  if (!match) continue;
  const tileIndex = parseInt(match[1], 10);

  const content = fs.readFileSync(path.join(tilesDir, file), 'utf-8');
  svgCache[tileIndex] = {
    svg: stripSvgWrapper(content),
  };

  const layers = extractLayers(content);
  pathsCache[tileIndex] = {
    pathData: layers,
  };
}

// Generate TypeScript output
const output = `// Auto-generated file - do not edit manually
// Run: node scripts/generateTilesCache.js
//
// Stores raw SVG path content for each tile (no structured terrain data).
// The CachedTileData type is consumed via lazyTilesCache.ts, which wraps
// this module for lazy loading. For structured terrain path data (polygons
// split by terrain type), see generatedTilesPathsCache.ts instead.

export type CachedTileData = {
  svg: string;
};

export const tilesDataCache: Record<string, CachedTileData> = ${JSON.stringify(svgCache)};
`;

fs.writeFileSync(svgOutputFile, output);


// Read and embed the airport overlay SVG
const airportSvgPath = path.join(__dirname, '../static/svg/amenity-airport.svg');
const airportSvg = fs.existsSync(airportSvgPath)
  ? fs.readFileSync(airportSvgPath, 'utf-8').trim()
  : null;

// Generate TypeScript output
const pathsOutput = `// Auto-generated file - do not edit manually
// Run: node scripts/generateTilesCache.js

export type TilePathData = {
  pathData: {
    rock: number[][];
    sand: number[][];
    water: number[][];
  };
};

export const tilesPathsCache: Record<number, TilePathData> = ${JSON.stringify(pathsCache, null, 2)};

export const airportOverlaySvg: string | null = ${airportSvg ? JSON.stringify(airportSvg) : 'null'};
`;

fs.writeFileSync(pathsOutputFile, pathsOutput);
console.log(`Generated two caches with ${Object.keys(svgCache).length} tiles`);
