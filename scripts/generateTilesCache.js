const fs = require('fs');
const path = require('path');

const tilesDir = path.join(__dirname, '../static/tiles_data');
const outputFile = path.join(__dirname, '../app/generatedTilesCache.ts');

// Common SVG header and footer that all tiles share
const SVG_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="160" height="160">';
const SVG_FOOTER = '</svg>';

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
const cache = {};

for (const file of files) {
  const content = fs.readFileSync(path.join(tilesDir, file), 'utf-8');
  cache[`static/tiles_data/${file}`] = {
    svg: stripSvgWrapper(content),
  };
}

// Generate TypeScript output
const output = `// Auto-generated file - do not edit manually
// Run: node scripts/generateTilesCache.js

// Common SVG wrapper added back when retrieving cached content
const SVG_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="160" height="160">';
const SVG_FOOTER = '</svg>';

export type CachedTileData = {
  svg: string;
};

export const tilesDataCache: Record<string, CachedTileData> = ${JSON.stringify(cache)};

export function getCachedTileData(path: string): CachedTileData | undefined {
  return tilesDataCache[path];
}

export function getCachedSvgContent(path: string): string | undefined {
  const cached = tilesDataCache[path]?.svg;
  if (!cached) return undefined;
  return SVG_HEADER + cached + SVG_FOOTER;
}
`;

fs.writeFileSync(outputFile, output);
console.log(`Generated cache with ${Object.keys(cache).length} tiles`);
