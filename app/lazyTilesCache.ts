// Lazy wrapper for generatedTilesCache (SVG content, lazy-loaded for wizard/editor).

import type { CachedTileData } from './generatedTilesCache';

let tilesDataCache: Record<string, CachedTileData> | null = null;
let svgLoadPromise: Promise<void> | null = null;

const SVG_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="160" height="160">';
const SVG_FOOTER = '</svg>';

export function preloadTilesCache(): Promise<void> {
  if (!svgLoadPromise) {
    svgLoadPromise = import(/* webpackChunkName: "tilesCache" */ './generatedTilesCache')
      .then((tilesModule) => {
        tilesDataCache = tilesModule.tilesDataCache;
      });
  }
  return svgLoadPromise;
}

export function getCachedSvgContent(assetId: number): string | undefined {
  const cached = tilesDataCache?.[assetId]?.svg;
  if (!cached) return undefined;
  return SVG_HEADER + cached + SVG_FOOTER;
}