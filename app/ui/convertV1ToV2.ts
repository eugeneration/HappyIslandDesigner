// @ts-nocheck
import paper from 'paper';
import { layers } from '../layers';
import { colors } from '../colors';
import { state } from '../state';
import { horizontalDivisions, verticalDivisions } from '../constants';
import {
  assetIndexToData,
  getTileDirection,
  getPlaceholderIndexForPosition,
  type TileDirection,
} from './edgeTileAssets';
import { setEdgeTilesFromAssetIndices } from './edgeTiles';
import { setMapVersion } from '../mapState';
import { getCachedSvgContent, preloadTilesCache } from '../lazyTilesCache';
import { safeCompoundIntersection } from '../helpers/safeCompoundIntersection';

const blockWidth = horizontalDivisions; // 16
const blockHeight = verticalDivisions; // 16

// ============ Types ============

export type VisiblePortions = {
  rock: paper.PathItem | null;
  sand: paper.PathItem | null;
  water: paper.PathItem | null;
};

type SvgAssetData = {
  assetIndex: number;
  direction: TileDirection;
  svgContent: string;
  visiblePortions: VisiblePortions;
};

type EdgeTileDiagnostic = { ccwIndex: number; assetIndex: number; score: number };
export type ConversionDiagnostic = {
  riverDirection: string;
  riverScore: number;
  edgeTiles: EdgeTileDiagnostic[];
  isValid: boolean;
  hasLowConfidence: boolean;
};

// ============ Tile Data Extraction Helpers ============

function removeFloatingPointError(f: number): number {
  return Math.round((f + Number.EPSILON) * 100) / 100;
}

function encodePoint(p: paper.Point): [number, number] {
  return [removeFloatingPointError(p.x), removeFloatingPointError(p.y)];
}

function encodePath(p: paper.Path): number[] {
  const positions: number[] = [];
  p.segments.forEach((s) => {
    const encodedPoint = encodePoint(s.point);
    positions.push(encodedPoint[0], encodedPoint[1]);
  });
  return positions;
}

function encodePathItem(pathItem: paper.PathItem): number[] | number[][] {
  const children = (pathItem as paper.CompoundPath).children;
  if (children && children.length > 0) {
    return children.map((path) => {
      return encodePath(path as paper.Path);
    });
  } else {
    return encodePath(pathItem as paper.Path);
  }
}

function decodePathPoints(coords: number[]): paper.Point[] {
  const points: paper.Point[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    points.push(new paper.Point(coords[i], coords[i + 1]));
  }
  return points;
}

function decodeToPathItem(pathData: number[] | number[][]): paper.PathItem {
  if (typeof pathData[0] === 'number') {
    const path = new paper.Path(decodePathPoints(pathData as number[]));
    path.closed = true;
    return path;
  } else {
    return new paper.CompoundPath({
      children: (pathData as number[][]).map(pd => {
        const path = new paper.Path(decodePathPoints(pd));
        path.closed = true;
        return path;
      }),
    });
  }
}

function getExclusionPath(direction: TileDirection): paper.PathItem | null {
  const size = blockWidth;

  switch (direction) {
    case 'left':
      return new paper.Path.Rectangle(new paper.Rectangle(13, 0, 3, size));
    case 'right':
      return new paper.Path.Rectangle(new paper.Rectangle(0, 0, 3, size));
    case 'top':
      return new paper.Path.Rectangle(new paper.Rectangle(0, 13, size, 3));
    case 'bottom':
      return new paper.Path.Rectangle(new paper.Rectangle(0, 0, size, 3));
    case 'top_left':
      return new paper.Path({ segments: [[13, 16], [16, 13], [16, 16]], closed: true });
    case 'top_right':
      return new paper.Path({ segments: [[3, 16], [0, 13], [0, 16]], closed: true });
    case 'bottom_left':
      return new paper.Path({ segments: [[13, 0], [16, 3], [16, 0]], closed: true });
    case 'bottom_right':
      return new paper.Path({ segments: [[3, 0], [0, 3], [0, 0]], closed: true });
    default:
      return null;
  }
}

function extractTileData(blockX: number, blockY: number): Record<string, number[] | number[][]> {
  const offsetX = blockX * blockWidth;
  const offsetY = blockY * blockHeight;
  const tileRect = new paper.Rectangle(
    offsetX,
    offsetY,
    blockWidth,
    blockHeight
  );
  const clipPath = new paper.Path.Rectangle(tileRect);
  clipPath.remove();

  const extractedPaths: Record<string, number[] | number[][]> = {};

  const largeSize = 10000;
  const subtractRects = [
    new paper.Path.Rectangle(new paper.Rectangle(-largeSize, -largeSize, largeSize + offsetX, largeSize * 2 + blockHeight)),
    new paper.Path.Rectangle(new paper.Rectangle(offsetX + blockWidth, -largeSize, largeSize, largeSize * 2 + blockHeight)),
    new paper.Path.Rectangle(new paper.Rectangle(-largeSize, -largeSize, largeSize * 2 + blockWidth, largeSize + offsetY)),
    new paper.Path.Rectangle(new paper.Rectangle(-largeSize, offsetY + blockHeight, largeSize * 2 + blockWidth, largeSize)),
  ];

  Object.entries(state.drawing).forEach(([colorKey, pathItem]) => {
    if (pathItem) {
      const isCompound = !!(pathItem as paper.CompoundPath).children?.length;
      const pathBounds = pathItem.bounds;
      const intersectsTile = pathBounds.intersects(tileRect);

      try {
        let clipped = safeCompoundIntersection(pathItem, clipPath);
        let clippedIsEmpty = clipped.isEmpty();

        if (clippedIsEmpty && isCompound && intersectsTile) {
          clipped.remove();
          clipped = pathItem.clone() as paper.PathItem;
          for (const rect of subtractRects) {
            const subtracted = clipped.subtract(rect, { insert: false });
            clipped.remove();
            clipped = subtracted;
          }
          clippedIsEmpty = clipped.isEmpty();
        }

        if (!clipped.isEmpty()) {
          clipped.translate(new paper.Point(-offsetX, -offsetY));
          const colorName = colors[colorKey]?.name || colorKey;
          const encoded = encodePathItem(clipped);
          extractedPaths[colorName] = encoded;
          clipped.remove();
        } else {
          clipped.remove();
        }
      } catch (e) {
        // Skip if clipping fails
      }
    }
  });

  subtractRects.forEach(r => r.remove());
  return extractedPaths;
}

function prepTileDataForExport(drawing: Record<string, number[] | number[][]>, direction: TileDirection): Record<string, number[] | number[][]> {
  const grassColorNames = ['level1', 'level2', 'level3'];
  const result: Record<string, number[] | number[][]> = {};

  let unitedGrass: paper.PathItem | null = null;

  for (const [colorName, pathData] of Object.entries(drawing)) {
    if (grassColorNames.includes(colorName) && pathData && pathData.length > 0) {
      const grassPath = decodeToPathItem(pathData);
      if (unitedGrass === null) {
        unitedGrass = grassPath;
      } else {
        const newUnited = unitedGrass.unite(grassPath, { insert: false });
        unitedGrass.remove();
        grassPath.remove();
        unitedGrass = newUnited;
      }
    }
  }

  const exclusionPath = getExclusionPath(direction);
  if (exclusionPath) {
    if (unitedGrass === null) {
      unitedGrass = exclusionPath;
    } else {
      const newUnited = unitedGrass.unite(exclusionPath, { insert: false });
      unitedGrass.remove();
      exclusionPath.remove();
      unitedGrass = newUnited;
    }
  }

  const waterRect = new paper.Path.Rectangle(
    new paper.Rectangle(0, 0, blockWidth, blockHeight)
  );

  if (unitedGrass) {
    const waterMinusGrass = waterRect.subtract(unitedGrass, { insert: false });
    result['water'] = encodePathItem(waterMinusGrass);
    waterMinusGrass.remove();
  } else {
    result['water'] = encodePathItem(waterRect);
  }
  waterRect.remove();

  if (unitedGrass) {
    result['level1'] = encodePathItem(unitedGrass);
  }

  for (const [colorName, pathData] of Object.entries(drawing)) {
    if (grassColorNames.includes(colorName)) continue;
    if (!pathData || pathData.length === 0) continue;

    const layerPath = decodeToPathItem(pathData);

    if (unitedGrass) {
      const subtracted = layerPath.subtract(unitedGrass, { insert: false });
      result[colorName] = encodePathItem(subtracted);
      subtracted.remove();
    } else {
      result[colorName] = pathData;
    }
    layerPath.remove();
  }

  if (unitedGrass) {
    unitedGrass.remove();
  }

  return result;
}

function coordsToSvgPath(coords: number[]): string {
  if (coords.length < 4) return '';

  let d = `M ${coords[0]} ${coords[1]}`;
  for (let i = 2; i < coords.length; i += 2) {
    d += ` L ${coords[i]} ${coords[i + 1]}`;
  }
  d += ' Z';
  return d;
}

function tileDataToSvg(drawing: Record<string, number[] | number[][]>): string {
  const paths: string[] = [];

  Object.entries(drawing).forEach(([colorName, pathData]) => {
    const colorKey = Object.keys(colors).find(k => colors[k].name === colorName) || colorName;
    const color = colors[colorKey]?.cssColor || '#808080';

    // Skip grass terrain
    if (colorKey == 'level1' || colorKey == 'level2' || colorKey == 'level3') {
      return;
    }

    if (!pathData || (Array.isArray(pathData) && pathData.length === 0)) {
      return;
    }

    if (typeof pathData[0] === 'number') {
      const d = coordsToSvgPath(pathData as number[]);
      paths.push(`  <path d="${d}" fill="${color}" />`);
    } else {
      const subPaths = (pathData as number[][]).map(pd => coordsToSvgPath(pd)).join(' ');
      paths.push(`  <path d="${subPaths}" fill="${color}" />`);
    }
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${blockWidth} ${blockHeight}" width="${blockWidth * 10}" height="${blockHeight * 10}">
${paths.join('\n')}
</svg>`;
}

function tileToSvg(blockX: number, blockY: number): string {
  const data = extractTileData(blockX, blockY);
  const direction = getTileDirection(blockX, blockY);
  const preppedData = prepTileDataForExport(data, direction);
  return tileDataToSvg(preppedData);
}

// ============ Conversion Helpers ============

export function computeVisiblePortions(svgContent: string): VisiblePortions {
  const layerOrder = ['rock', 'sand', 'water'];
  const item = paper.project.importSVG(svgContent, { insert: false });

  if (!item) return { rock: null, sand: null, water: null };

  const paths = item.getItems({ class: paper.Path }) as paper.Path[];
  const compoundPaths = item.getItems({ class: paper.CompoundPath }) as paper.CompoundPath[];
  const result: VisiblePortions = { rock: null, sand: null, water: null };

  const findPathByColorKey = (colorKey: string): paper.PathItem | null => {
    const cssColor = colors[colorKey]?.cssColor;
    if (!cssColor) return null;
    const targetColor = cssColor.toLowerCase();

    const simplePath = paths.find(p => p.fillColor?.toCSS(true).toLowerCase() === targetColor);
    if (simplePath) return simplePath;

    const compoundPath = compoundPaths.find(cp => cp.fillColor?.toCSS(true).toLowerCase() === targetColor);
    if (compoundPath) return compoundPath;

    return null;
  };

  for (let i = 0; i < layerOrder.length; i++) {
    const colorKey = layerOrder[i];
    const path = findPathByColorKey(colorKey);
    if (!path) continue;

    let visible: paper.PathItem = path.clone() as paper.PathItem;

    for (let j = 0; j < i; j++) {
      const abovePath = findPathByColorKey(layerOrder[j]);
      if (abovePath) {
        const subtracted = visible.subtract(abovePath, { insert: false });
        visible.remove();
        visible = subtracted;
      }
    }

    result[colorKey as keyof VisiblePortions] = visible;
  }

  item.remove();
  return result;
}

async function buildSvgReferenceLibrary(): Promise<Map<number, SvgAssetData>> {
  const library = new Map<number, SvgAssetData>();

  // Ensure the generated tiles cache is loaded before looking up SVG content
  await preloadTilesCache();

  for (const [index, data] of assetIndexToData) {
    const cachedSvg = getCachedSvgContent(index);
    if (!cachedSvg) {
      continue;
    }

    const visiblePortions = computeVisiblePortions(cachedSvg);
    library.set(index, {
      assetIndex: index,
      direction: data.direction,
      svgContent: cachedSvg,
      visiblePortions,
    });
  }

  return library;
}

function compareVisiblePortions(
  extractedPortions: VisiblePortions,
  referencePortions: VisiblePortions,
  debug: boolean,
  debugCcwIndex?: number
): number {
  const layerOrder: (keyof VisiblePortions)[] = ['rock', 'sand', 'water'];

  let totalArea = 0;
  let matchingArea = 0;

  const extractedColors = new Set<string>();
  const referenceColors = new Set<string>();
  for (const colorKey of layerOrder) {
    if (extractedPortions[colorKey] && !extractedPortions[colorKey]!.isEmpty()) {
      extractedColors.add(colorKey);
    }
    if (referencePortions[colorKey] && !referencePortions[colorKey]!.isEmpty()) {
      referenceColors.add(colorKey);
    }
  }

  const colorSetsMatch = extractedColors.size === referenceColors.size &&
    [...extractedColors].every(c => referenceColors.has(c));

  for (const colorKey of layerOrder) {
    const extVisible = extractedPortions[colorKey];
    const refVisible = referencePortions[colorKey];

    if (debug && debugCcwIndex === 0) {
      const extArea = extVisible ? Math.abs((extVisible as paper.Path).area || 0) : 0;
      const refArea = refVisible ? Math.abs((refVisible as paper.Path).area || 0) : 0;
      console.log(`  [CCW 0 DEBUG] ${colorKey}: extracted area=${extArea.toFixed(2)}, ref area=${refArea.toFixed(2)}`);
    }

    if (extVisible && refVisible && !extVisible.isEmpty() && !refVisible.isEmpty()) {
      try {
        const intersection = extVisible.intersect(refVisible, { insert: false }) as paper.Path;
        const union = extVisible.unite(refVisible, { insert: false }) as paper.Path;

        if (intersection && intersection.area !== undefined) {
          matchingArea += Math.abs(intersection.area);
        }
        if (union && union.area !== undefined) {
          totalArea += Math.abs(union.area);
        }

        intersection.remove();
        union.remove();
      } catch (e) {
        // Skip if boolean operation fails
      }
    } else if (extVisible && !refVisible) {
      totalArea += Math.abs((extVisible as paper.Path).area || 0);
    } else if (!extVisible && refVisible) {
      totalArea += Math.abs((refVisible as paper.Path).area || 0);
    }
  }

  let score = totalArea > 0 ? matchingArea / totalArea : 0;

  if (colorSetsMatch && score > 0) {
    score = Math.min(1.0, score * 1.05);
  }

  return score;
}

function mergeSandRockIntoLevel1(): void {
  layers.mapLayer.activate();

  const sandPath = state.drawing['sand'];
  const rockPath = state.drawing['rock'];
  const level1Path = state.drawing['level1'];

  if (!sandPath && !rockPath) return;

  let mergedPath: paper.PathItem = level1Path ? level1Path.clone() as paper.PathItem : new paper.Path();

  if (sandPath && !sandPath.isEmpty()) {
    const newMerged = mergedPath.unite(sandPath, { insert: false });
    mergedPath.remove();
    mergedPath = newMerged;
  }

  if (rockPath && !rockPath.isEmpty()) {
    const newMerged = mergedPath.unite(rockPath, { insert: false });
    mergedPath.remove();
    mergedPath = newMerged;
  }

  mergedPath.locked = true;
  mergedPath.fillColor = colors.level1.color;

  if (level1Path) {
    mergedPath.insertAbove(level1Path);
    level1Path.remove();
  }
  state.drawing['level1'] = mergedPath;

  if (sandPath) {
    sandPath.remove();
    delete state.drawing['sand'];
  }
  if (rockPath) {
    rockPath.remove();
    delete state.drawing['rock'];
  }
}

function unionEdgeTilesToLevel1(
  edgeTiles: number[],
  ccwPositions: [number, number][],
  svgLibrary: Map<number, SvgAssetData>
): void {
  layers.mapLayer.activate();

  let level1Path = state.drawing['level1']
    ? state.drawing['level1'].clone() as paper.PathItem
    : new paper.Path();

  const colorsToExtract = ['water', 'sand', 'rock'];

  for (let i = 0; i < edgeTiles.length; i++) {
    const assetIndex = edgeTiles[i];
    const [blockX, blockY] = ccwPositions[i];

    const assetData = svgLibrary.get(assetIndex);
    if (!assetData) continue;

    const item = paper.project.importSVG(assetData.svgContent, { insert: false });
    if (!item) continue;

    const paths = item.getItems({ class: paper.Path }) as paper.Path[];
    const compoundPaths = item.getItems({ class: paper.CompoundPath }) as paper.CompoundPath[];

    for (const colorKey of colorsToExtract) {
      const targetColor = colors[colorKey]?.cssColor?.toLowerCase();
      if (!targetColor) continue;

      const allPaths = [...paths, ...compoundPaths];
      for (const p of allPaths) {
        if (p.fillColor?.toCSS(true).toLowerCase() === targetColor) {
          const cloned = p.clone() as paper.PathItem;
          cloned.scale(1/10, new paper.Point(0, 0));
          cloned.translate(new paper.Point(blockX * blockWidth, blockY * blockHeight));
          const newLevel1 = level1Path.unite(cloned, { insert: false });
          level1Path.remove();
          cloned.remove();
          level1Path = newLevel1;
        }
      }
    }

    item.remove();
  }

  level1Path.locked = true;
  level1Path.fillColor = colors.level1.color;

  if (state.drawing['level1']) {
    level1Path.insertAbove(state.drawing['level1']);
    state.drawing['level1'].remove();
  }
  state.drawing['level1'] = level1Path;
}

function findAirportObjectPosition(): { blockX: number; blockY: number; posX: number; posY: number } | null {
  for (const object of Object.values(state.objects)) {
    if (object.data?.category === 'amenities' &&
        (object.data.type === 'airport' || object.data.type?.startsWith('airport'))) {
      return {
        blockX: Math.floor(object.position.x / blockWidth),
        blockY: Math.floor(object.position.y / blockHeight),
        posX: object.position.x,
        posY: object.position.y,
      };
    }
  }
  return null;
}

function findDockObjectPosition(): { blockX: number; blockY: number } | null {
  for (const object of Object.values(state.objects)) {
    if (object.data?.category === 'amenities' && object.data.type === 'dock') {
      return {
        blockX: Math.floor(object.position.x / blockWidth),
        blockY: Math.floor(object.position.y / blockHeight),
      };
    }
  }
  return null;
}

function blockToCcwIndex(blockX: number, blockY: number): number | null {
  if (blockY === 5) {
    if (blockX === 0) return 4;
    if (blockX === 6) return 10;
    if (blockX >= 1 && blockX <= 5) return blockX + 4;
  }
  return null;
}

// ============ Main Conversion Function ============

export async function convertV1ToV2(options?: { debug?: boolean; onProgress?: (completed: number, total: number) => void }): Promise<ConversionDiagnostic> {
  const debug = options?.debug ?? false;
  const onProgress = options?.onProgress;
  // 1 (library) + 22 (tiles) + 1 (finalize) = 24 steps
  const totalSteps = 24;
  let completedSteps = 0;

  function reportProgress() {
    completedSteps++;
    onProgress?.(completedSteps, totalSteps);
  }

  if (debug) console.log('Starting V1 to V2 conversion...');

  const diagnosticTiles: EdgeTileDiagnostic[] = [];

  const svgLibrary = await buildSvgReferenceLibrary();
  if (debug) console.log(`Loaded ${svgLibrary.size} SVG references`);
  reportProgress(); // step 1: library built

  const ccwPositions: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [0, 4],
    [0, 5],
    [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],
    [6, 5],
    [6, 4], [6, 3], [6, 2], [6, 1],
    [6, 0],
    [5, 0], [4, 0], [3, 0], [2, 0], [1, 0],
    [0, 0],
  ];

  // Step 1: Score all positions against all asset types
  type PositionScore = {
    x: number;
    y: number;
    ccwIndex: number;
    direction: TileDirection;
    scores: Map<number, number>;
  };

  const positionScores: PositionScore[] = [];

  for (let i = 0; i < ccwPositions.length; i++) {
    const [x, y] = ccwPositions[i];
    const direction = getTileDirection(x, y);
    const extractedSvg = tileToSvg(x, y);

    const extractedPortions = computeVisiblePortions(extractedSvg);

    if (debug && i === 0) {
      console.log(`=== DEBUG CCW 0 Tile (${x},${y}) ===`);
      console.log(`Extracted SVG:`, extractedSvg.substring(0, 200) + '...');
      const layerOrder: (keyof VisiblePortions)[] = ['rock', 'sand', 'water'];
      for (const colorKey of layerOrder) {
        const portion = extractedPortions[colorKey];
        const area = portion ? Math.abs((portion as paper.Path).area || 0) : 0;
        console.log(`  ${colorKey} visible area: ${area.toFixed(2)}`);
      }
    }

    const scores = new Map<number, number>();
    for (const [assetIndex, assetData] of svgLibrary) {
      if (assetData.direction === direction) {
        const debugIndex = (debug && i === 0) ? 0 : undefined;
        scores.set(assetIndex, compareVisiblePortions(extractedPortions, assetData.visiblePortions, debug, debugIndex));
      }
    }

    Object.values(extractedPortions).forEach(p => p?.remove());

    if (debug) {
      const scoreEntries = Array.from(scores.entries())
        .map(([assetIndex, score]) => `${assetIndex}: ${(score * 100).toFixed(0)}%`)
        .join(', ');
      const verboseScoreLog = `{ ${scoreEntries} }`;
      const maxScore = Math.max(...Array.from(scores.values()));
      if (maxScore < 0.7) {
        console.warn(`Tile (${x},${y}) CCW ${i} [${direction}] scores: ${verboseScoreLog} (max score below 70%)`);
      } else {
        console.log(`Tile (${x},${y}) CCW ${i} [${direction}] scores: ${verboseScoreLog}`);
      }
    }

    positionScores.push({ x, y, ccwIndex: i, direction, scores });
    reportProgress(); // steps 2-23: each tile scored

    // Yield to event loop so UI can update progress
    if (onProgress) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Step 2: Detect river direction
  const riverConfigs = {
    west: { river1Idx: 8, river2Idx: 1, river1Assets: [45, 46, 47], river2Assets: [62, 63] },
    east: { river1Idx: 6, river2Idx: 13, river1Assets: [45, 46, 47], river2Assets: [7, 8] },
    south: { river1Idx: 5, river2Idx: 9, river1Assets: [45, 46, 47], river2Assets: [45, 46, 47] },
  };

  function getBestScoreForAssets(pos: PositionScore, assets: number[]): number {
    return Math.max(...assets.map(a => pos.scores.get(a) ?? 0));
  }

  let detectedDirection: 'west' | 'east' | 'south' | null = null;
  let bestDirectionScore = 0;

  for (const [dir, config] of Object.entries(riverConfigs)) {
    const score1 = getBestScoreForAssets(positionScores[config.river1Idx], config.river1Assets);
    const score2 = getBestScoreForAssets(positionScores[config.river2Idx], config.river2Assets);
    const avgScore = (score1 + score2) / 2;

    if (avgScore > bestDirectionScore) {
      bestDirectionScore = avgScore;
      detectedDirection = dir as 'west' | 'east' | 'south';
    }
  }

  let isValid = true;
  const diagnosticRiverDirection = detectedDirection ?? 'west';
  const diagnosticRiverScore = bestDirectionScore;

  if (!detectedDirection || bestDirectionScore < 0.7) {
    if (debug) console.warn('Could not detect river direction - island may be invalid');
    isValid = false;
    detectedDirection = 'west';
  } else {
    if (debug) console.log(`Detected river direction: ${detectedDirection} (score: ${(bestDirectionScore * 100).toFixed(1)}%)`);
  }

  // Step 3: Apply constrained tile selection
  const assignedTiles: Map<number, number> = new Map();
  const usedPositions = new Set<number>();

  function getBestAsset(ccwIdx: number, candidateAssetIndices: number[]): { asset: number; score: number } | null {
    const pos = positionScores[ccwIdx];
    let best: { asset: number; score: number } | null = null;
    let tieCount = 0;

    for (const asset of candidateAssetIndices) {
      const score = pos.scores.get(asset) ?? 0;
      if (!best || score > best.score) {
        best = { asset, score };
        tieCount = 1;
      } else if (best && score === best.score && score > 0) {
        tieCount++;
      }
    }

    if (debug && tieCount > 1 && best) {
      console.log(`Tie at position (${pos.x},${pos.y}) for ${tieCount} assets with score ${(best.score * 100).toFixed(1)}%, choosing first`);
    }

    return best;
  }

  // 1. RIVER MOUTHS
  const riverConfig = riverConfigs[detectedDirection];
  const river1 = getBestAsset(riverConfig.river1Idx, riverConfig.river1Assets);
  const river2 = getBestAsset(riverConfig.river2Idx, riverConfig.river2Assets);

  if (river1 && river1.score >= 0.7) {
    assignedTiles.set(riverConfig.river1Idx, river1.asset);
    usedPositions.add(riverConfig.river1Idx);
    if (debug) console.log(`River 1 at CCW ${riverConfig.river1Idx}: asset ${river1.asset} (score: ${(river1.score * 100).toFixed(1)}%)`);
  }
  if (river2 && river2.score >= 0.7) {
    assignedTiles.set(riverConfig.river2Idx, river2.asset);
    usedPositions.add(riverConfig.river2Idx);
    if (debug) console.log(`River 2 at CCW ${riverConfig.river2Idx}: asset ${river2.asset} (score: ${(river2.score * 100).toFixed(1)}%)`);
  }

  // 2. AIRPORT
  const airportObjectPos = findAirportObjectPosition();
  let airportFromObject = false;

  if (airportObjectPos && airportObjectPos.blockY === 5) {
    const nearestBoundaryBlock = Math.round(airportObjectPos.posX / blockWidth);
    let startBlockX = nearestBoundaryBlock - 1;
    startBlockX = Math.max(1, Math.min(startBlockX, 4));
    const startIdx = startBlockX + 4;

    if (!usedPositions.has(startIdx) && !usedPositions.has(startIdx + 1)) {
      assignedTiles.set(startIdx, 34);
      assignedTiles.set(startIdx + 1, 35);
      usedPositions.add(startIdx);
      usedPositions.add(startIdx + 1);
      if (debug) console.log(`Airport from object at CCW ${startIdx}-${startIdx + 1}: assets 34, 35`);
      airportFromObject = true;
    }
  }

  if (!airportFromObject) {
    const airportOptions: { blocks: number[] }[] =
      detectedDirection === 'west' ? [{ blocks: [5, 6] }, { blocks: [6, 7] }] :
      detectedDirection === 'east' ? [{ blocks: [7, 8] }, { blocks: [8, 9] }] :
      [{ blocks: [6, 7] }, { blocks: [7, 8] }];

    let bestAirport: { startIdx: number; score: number } | null = null;
    for (const opt of airportOptions) {
      if (usedPositions.has(opt.blocks[0]) || usedPositions.has(opt.blocks[1])) continue;
      const s1 = positionScores[opt.blocks[0]].scores.get(34) ?? 0;
      const s2 = positionScores[opt.blocks[1]].scores.get(35) ?? 0;
      const avg = (s1 + s2) / 2;
      if (!bestAirport || avg > bestAirport.score) {
        bestAirport = { startIdx: opt.blocks[0], score: avg };
      }
    }

    if (bestAirport && bestAirport.score >= 0.7) {
      assignedTiles.set(bestAirport.startIdx, 34);
      assignedTiles.set(bestAirport.startIdx + 1, 35);
      usedPositions.add(bestAirport.startIdx);
      usedPositions.add(bestAirport.startIdx + 1);
      if (debug) console.log(`Airport at CCW ${bestAirport.startIdx}-${bestAirport.startIdx + 1}: assets 34, 35 (score: ${(bestAirport.score * 100).toFixed(1)}%)`);
    } else {
      if (debug) console.log('Airport detection failed');
      isValid = false;
    }
  }

  // 3. DOCK
  const dockObjectPos = findDockObjectPosition();
  let dockFromObject = false;

  if (dockObjectPos) {
    const ccwIdx = blockToCcwIndex(dockObjectPos.blockX, dockObjectPos.blockY);
    if (ccwIdx === 4 && !usedPositions.has(4)) {
      const dock = getBestAsset(4, [52, 53]);
      const asset = dock?.asset ?? 52;
      assignedTiles.set(4, asset);
      usedPositions.add(4);
      if (debug) console.log(`Dock from object at CCW 4 (left): asset ${asset}`);
      dockFromObject = true;
    } else if (ccwIdx === 10 && !usedPositions.has(10)) {
      const dock = getBestAsset(10, [43, 44]);
      const asset = dock?.asset ?? 43;
      assignedTiles.set(10, asset);
      usedPositions.add(10);
      if (debug) console.log(`Dock from object at CCW 10 (right): asset ${asset}`);
      dockFromObject = true;
    }
  }

  if (!dockFromObject) {
    const dockConfig =
      detectedDirection === 'west' ? { ccwIdx: 10, assets: [43, 44] } :
      detectedDirection === 'east' ? { ccwIdx: 4, assets: [52, 53] } :
      null;

    if (dockConfig) {
      const dock = getBestAsset(dockConfig.ccwIdx, dockConfig.assets);
      if (dock && dock.score >= 0.7) {
        assignedTiles.set(dockConfig.ccwIdx, dock.asset);
        usedPositions.add(dockConfig.ccwIdx);
        if (debug) console.log(`Dock at CCW ${dockConfig.ccwIdx}: asset ${dock.asset} (score: ${(dock.score * 100).toFixed(1)}%)`);
      } else {
        if (debug) console.warn('Dock detection failed');
        isValid = false;
      }
    } else {
      const leftDock = getBestAsset(4, [52, 53]);
      const rightDock = getBestAsset(10, [43, 44]);
      const leftScore = leftDock?.score ?? 0;
      const rightScore = rightDock?.score ?? 0;

      if (leftScore >= rightScore && leftDock && leftScore >= 0.7) {
        assignedTiles.set(4, leftDock.asset);
        usedPositions.add(4);
        if (debug) console.log(`Dock at CCW 4 (left): asset ${leftDock.asset} (score: ${(leftScore * 100).toFixed(1)}%)`);
      } else if (rightDock && rightScore >= 0.7) {
        assignedTiles.set(10, rightDock.asset);
        usedPositions.add(10);
        if (debug) console.log(`Dock at CCW 10 (right): asset ${rightDock.asset} (score: ${(rightScore * 100).toFixed(1)}%)`);
      } else {
        if (debug) console.warn('Dock detection failed');
        isValid = false;
      }
    }
  }

  // 4. PENINSULA
  const peninsulaLeftAssets = [59, 60, 61];
  const peninsulaRightAssets = [4, 5, 6];

  let bestPeninsula: { ccwIdx: number; asset: number; score: number } | null = null;
  for (const ccwIdx of [0, 1, 2, 3]) {
    if (usedPositions.has(ccwIdx)) continue;
    const result = getBestAsset(ccwIdx, peninsulaLeftAssets);
    if (result && (!bestPeninsula || result.score > bestPeninsula.score)) {
      bestPeninsula = { ccwIdx, ...result };
    }
  }
  for (const ccwIdx of [11, 12, 13, 14]) {
    if (usedPositions.has(ccwIdx)) continue;
    const result = getBestAsset(ccwIdx, peninsulaRightAssets);
    if (result && (!bestPeninsula || result.score > bestPeninsula.score)) {
      bestPeninsula = { ccwIdx, ...result };
    }
  }

  if (bestPeninsula && bestPeninsula.score >= 0.7) {
    assignedTiles.set(bestPeninsula.ccwIdx, bestPeninsula.asset);
    usedPositions.add(bestPeninsula.ccwIdx);
    if (debug) console.log(`Peninsula at CCW ${bestPeninsula.ccwIdx}: asset ${bestPeninsula.asset} (score: ${(bestPeninsula.score * 100).toFixed(1)}%)`);
  } else {
    if (debug) console.warn('Peninsula detection failed');
    isValid = false;
  }

  // 5. SECRET BEACH
  const secretBeachAssets = [16, 17, 18];
  const secretBeachCols =
    detectedDirection === 'west' ? [18, 17, 16] :
    detectedDirection === 'east' ? [20, 19, 18] :
    [19, 18, 17];

  let bestSecretBeach: { ccwIdx: number; asset: number; score: number } | null = null;
  for (const ccwIdx of secretBeachCols) {
    if (usedPositions.has(ccwIdx)) continue;
    const result = getBestAsset(ccwIdx, secretBeachAssets);
    if (result && (!bestSecretBeach || result.score > bestSecretBeach.score)) {
      bestSecretBeach = { ccwIdx, ...result };
    }
  }

  if (bestSecretBeach && bestSecretBeach.score >= 0.7) {
    assignedTiles.set(bestSecretBeach.ccwIdx, bestSecretBeach.asset);
    usedPositions.add(bestSecretBeach.ccwIdx);
    if (debug) console.log(`Secret beach at CCW ${bestSecretBeach.ccwIdx}: asset ${bestSecretBeach.asset} (score: ${(bestSecretBeach.score * 100).toFixed(1)}%)`);
  }

  // 6. ROCKS
  const leftRockAssets = [64, 65, 66, 67];
  const rightRockAssets = [9, 10, 11, 12];

  let bestLeftRock: { ccwIdx: number; asset: number; score: number } | null = null;
  for (const ccwIdx of [0, 1, 2, 3]) {
    if (usedPositions.has(ccwIdx)) continue;
    const result = getBestAsset(ccwIdx, leftRockAssets);
    if (result && (!bestLeftRock || result.score > bestLeftRock.score)) {
      bestLeftRock = { ccwIdx, ...result };
    }
  }
  if (bestLeftRock && bestLeftRock.score >= 0.7) {
    assignedTiles.set(bestLeftRock.ccwIdx, bestLeftRock.asset);
    usedPositions.add(bestLeftRock.ccwIdx);
    if (debug) console.log(`Left rock at CCW ${bestLeftRock.ccwIdx}: asset ${bestLeftRock.asset} (score: ${(bestLeftRock.score * 100).toFixed(1)}%)`);
  } else {
    if (debug) console.warn('Left rock detection failed');
  }

  let bestRightRock: { ccwIdx: number; asset: number; score: number } | null = null;
  for (const ccwIdx of [11, 12, 13, 14]) {
    if (usedPositions.has(ccwIdx)) continue;
    const result = getBestAsset(ccwIdx, rightRockAssets);
    if (result && (!bestRightRock || result.score > bestRightRock.score)) {
      bestRightRock = { ccwIdx, ...result };
    }
  }
  if (bestRightRock && bestRightRock.score >= 0.7) {
    assignedTiles.set(bestRightRock.ccwIdx, bestRightRock.asset);
    usedPositions.add(bestRightRock.ccwIdx);
    if (debug) console.log(`Right rock at CCW ${bestRightRock.ccwIdx}: asset ${bestRightRock.asset} (score: ${(bestRightRock.score * 100).toFixed(1)}%)`);
  } else {
    if (debug) console.warn('Right rock detection failed');
  }

  // Step 4: Fill remaining positions
  const edgeTiles: number[] = [];
  const assignedScores: Map<number, number> = new Map();

  for (let i = 0; i < ccwPositions.length; i++) {
    if (assignedTiles.has(i)) {
      const assignedAsset = assignedTiles.get(i)!;
      edgeTiles.push(assignedAsset);
      const score = positionScores[i].scores.get(assignedAsset) ?? 0;
      assignedScores.set(i, score);
      diagnosticTiles.push({ ccwIndex: i, assetIndex: assignedAsset, score });
    } else {
      const pos = positionScores[i];
      let bestIndex: number | null = null;
      let bestScore = 0;

      for (const [assetIndex, score] of pos.scores) {
        const assetData = assetIndexToData.get(assetIndex);
        if (assetData?.state === 'filled' && score > bestScore) {
          bestScore = score;
          bestIndex = assetIndex;
        }
      }

      if (bestIndex !== null && bestScore >= 0.7) {
        edgeTiles.push(bestIndex);
        diagnosticTiles.push({ ccwIndex: i, assetIndex: bestIndex, score: bestScore });
        if (debug) console.log(`Filled at CCW ${i}: asset ${bestIndex} (score: ${(bestScore * 100).toFixed(1)}%)`);
      } else {
        const placeholder = getPlaceholderIndexForPosition(pos.x, pos.y);
        edgeTiles.push(placeholder);
        diagnosticTiles.push({ ccwIndex: i, assetIndex: placeholder, score: bestScore });
        if (debug) console.warn(`Placeholder at CCW ${i}: ${placeholder} - asset ${bestIndex} (score: ${(bestScore * 100).toFixed(1)}%) below threshold.`);
      }
    }
  }

  // Merge sand/rock into level1
  mergeSandRockIntoLevel1();

  // Apply edge tiles
  setEdgeTilesFromAssetIndices(edgeTiles);

  // Union edge tile terrain to level1
  unionEdgeTilesToLevel1(edgeTiles, ccwPositions, svgLibrary);

  // Update version
  setMapVersion(2);

  // Log final result
  if (isValid) {
    console.log('V1 to V2 conversion complete - island is VALID');
  } else {
    console.log('V1 to V2 conversion complete - island is INVALID (missing required features)');
  }

  if (debug) console.log('Edge tiles:', edgeTiles);
  reportProgress(); // step 24: finalize

  const hasLowConfidence = diagnosticTiles.some(t => t.score < 0.7);

  return {
    riverDirection: diagnosticRiverDirection,
    riverScore: diagnosticRiverScore,
    edgeTiles: diagnosticTiles,
    isValid,
    hasLowConfidence,
  };
}
