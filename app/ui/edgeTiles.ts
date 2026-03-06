import paper from 'paper';
import { colors } from '../colors';
import { layers } from '../layers';
import { horizontalBlocks, verticalBlocks, horizontalDivisions, verticalDivisions } from '../constants';
import {
  type BlockState,
  type TileDirection,
  assetIndexToData,
  placeholderAssetIndexToData,
  getImageSrcForAsset,
  getPlaceholderIndexForPosition,
  getTileDirection,
  isPlaceholderIndex,
} from './edgeTileAssets';
import { getCachedSvgContent } from '../lazyTilesCache';
import { tilesPathsCache, airportOverlaySvg } from '../generatedTilesPathsCache';

let tilesGroup: paper.Group | null = null;
let edgeBg: paper.PathItem | null = null;
let baseScale: number | null = null; // assumes that all tiles are the same size
let edgeGeometryGroup: paper.Group | null = null;
let airportOverlayGroup: paper.Group | null = null;

const blockWidth = horizontalDivisions; // 16
const blockHeight = verticalDivisions; // 16

// Inner drawable area bounds (extends one block into edge tiles)
// Edge tiles occupy: x=0 and x=6, y=0 and y=5
// Drawable area: full map (drawing can overlap with edge tiles)
const innerBoundsRect = {
  x: 0,
  y: 0,
  width: horizontalBlocks * blockWidth,             // 7 * 16 = 112
  height: verticalBlocks * blockHeight,             // 6 * 16 = 96
};

// Get the inner drawable bounds as a paper.Rectangle (for V2 maps)
export function getInnerDrawableBounds(): paper.Rectangle {
  return new paper.Rectangle(
    innerBoundsRect.x,
    innerBoundsRect.y,
    innerBoundsRect.width,
    innerBoundsRect.height
  );
}

// Create tile image from asset index - uses cached SVG first, then fetches
function createTileImage(
  assetIndex: number,
  blockX: number,
  blockY: number,
  callback: (item: paper.Item) => void
): void {
  // Helper to position and scale SVG item
  const positionItem = (item: paper.Item) => {
    // const scaleX = blockWidth / item.bounds.width;
    // const scaleY = blockHeight / item.bounds.height;
    // item.scale(scaleX, scaleY, item.bounds.topLeft);
    if (!baseScale) {
      baseScale = blockWidth / item.bounds.width;
    }
    item.scale(baseScale, item.bounds.topLeft);
    item.bounds.topLeft = new paper.Point(
      blockX * blockWidth,
      blockY * blockHeight
    );
  };

  // Try cached SVG content first
  const cachedSvg = getCachedSvgContent(assetIndex);
  if (cachedSvg) {
    const item = paper.project.importSVG(cachedSvg, { insert: false });
    if (item) {
      positionItem(item);
      callback(item);
      return;
    }
  }
  console.warn("Tile cache does not contain ", assetIndex);
  // Fall back to fetching SVG
  const imageSrc = getImageSrcForAsset(assetIndex);
  if (!imageSrc) {
    console.error(`No imageSrc for asset index: ${assetIndex}`);
    return;
  }
  paper.project.importSVG(imageSrc, {
    onLoad: (item: paper.Item) => {
      positionItem(item);
      callback(item);
    },
    onError: () => {
      console.error(`Failed to load SVG for asset ${assetIndex}: ${imageSrc}`);
    }
  });
}

export type BlockPosition = { x: number; y: number };

export type PlaceholderInfo = {
  x: number;
  y: number;
  type: TileDirection;
};

export type BlockData = {
  x: number;
  y: number;
  assetIndex: number;
}

// Track state and raster reference for each edge block
const blockData: Map<string, BlockData> = new Map();
const blockItems: Map<string, paper.Item> = new Map();
const originalPlaceholderIndices: Map<string, number> = new Map(); // Store original placeholder asset indices

function getBlockKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function createEdgeBg(): paper.PathItem {
  // cover up the grass bleeding through the edge of the svg
  const bleedSize = 0.2;
  const outerRect = new paper.Path.Rectangle(new paper.Rectangle(
    innerBoundsRect.x - bleedSize,
    innerBoundsRect.y - bleedSize,
    innerBoundsRect.width + bleedSize * 2,
    innerBoundsRect.height + bleedSize * 2
  ));
  const innerRect = new paper.Path.Rectangle(new paper.Rectangle(
    innerBoundsRect.x + bleedSize,
    innerBoundsRect.y + bleedSize,
    innerBoundsRect.width - bleedSize * 2,
    innerBoundsRect.height - bleedSize * 2
  ));
  const edgeBg = outerRect.subtract(innerRect);
  edgeBg.fillColor = colors.water.color;

  return edgeBg;
}

export function initializeEdgeTiles(): void {
  deleteEdgeTiles();

  layers.mapEdgeLayer.activate();

  edgeBg = createEdgeBg();

  if (tilesGroup) {
    console.error("Edge Tiles initialized twice!");
  }
  tilesGroup = new paper.Group();
  tilesGroup.applyMatrix = false;

  for (const [x, y] of ccwPositions) {
    const key = getBlockKey(x, y);
    blockData.set(key, {x, y, assetIndex: getPlaceholderIndexForPosition(x, y)});
  }
}

// we only need to actually show the placeholders for the creation flow
export function fillEdgeTilesWithPlaceholders(): void {
  for (const [x, y] of ccwPositions) {
    const key = getBlockKey(x, y);
    const assetIndex = getPlaceholderIndexForPosition(x, y);
    originalPlaceholderIndices.set(key, assetIndex);
    createTileImage(assetIndex, x, y, (item) => {
      tilesGroup!.addChild(item);
      blockItems.set(key, item);
      blockData.set(key, {x, y, assetIndex});
    });
  }
  // Send to back of overlay layer so UI elements appear on top
  tilesGroup!.sendToBack();
  updateAirportOverlay();
}

export function deleteEdgeTiles(): void {
  if (tilesGroup) {
    tilesGroup.remove();
    tilesGroup = null;
  }
  if (edgeBg) {
    edgeBg.remove();
    edgeBg = null;
  }
  if (edgeGeometryGroup) {
    edgeGeometryGroup.remove();
    edgeGeometryGroup = null;
  }
  if (airportOverlayGroup) {
    airportOverlayGroup.remove();
    airportOverlayGroup = null;
  }

  // Clear tracking maps
  blockData.clear();
  blockItems.clear();
  originalPlaceholderIndices.clear();
}

export function isEdgeTilesVisible(): boolean {
  return tilesGroup !== null && tilesGroup.visible;
}

// Replace placeholder tiles with river tiles based on river direction
export function setRiverTiles(riverDirection: 'west' | 'south' | 'east'): void {
  if (!tilesGroup) return;

  const bottomRow = verticalBlocks - 1; // y = 5

  switch (riverDirection) {
    case 'west':
      // West: south river entrance at bottom row, column 4 (0-indexed)
      // Left river entrance at first column, row 2 (0-indexed)
      replaceBlocks({ x: 4, y: bottomRow, assetIndex: 908 });
      replaceBlocks({ x: 0, y: 2, assetIndex: 909 });
      break;
    case 'east':
      // East: south river entrance at bottom row, column 2 (0-indexed)
      // Right river entrance at last column, row 2 (0-indexed)
      replaceBlocks({ x: 2, y: bottomRow, assetIndex: 908 });
      replaceBlocks({ x: horizontalBlocks - 1, y: 2, assetIndex: 910 });
      break;
    case 'south':
      // South: two river entrances at bottom row, columns 2 and 6 (0-indexed)
      replaceBlocks({ x: 1, y: bottomRow, assetIndex: 908 });
      replaceBlocks({ x: 5, y: bottomRow, assetIndex: 908 });
      break;
  }
}

// Get the state of a specific block
export function getBlockState(x: number, y: number): BlockState | undefined {
  const index = blockData.get(getBlockKey(x, y))?.assetIndex;
  if (index == null) return undefined;
  return assetIndexToData.get(index)?.state
    ?? placeholderAssetIndexToData.get(index)?.state;
}

// Replace block with new image
export function replaceBlocks(
  newBlockData: BlockData
): void {
  if (!tilesGroup) return;
  const {x, y, assetIndex} = newBlockData;

  createTileImage(assetIndex, x, y, (item) => {
    const key = getBlockKey(x, y);

    // Remove the existing item
    blockItems.get(key)?.remove();

    tilesGroup!.addChild(item);

    // Update tracking
    blockData.set(key, {x, y, assetIndex});
    blockItems.set(key, item);
  });

  // Send group to back to keep UI elements on top
  tilesGroup.sendToBack();
  updateAirportOverlay();
}

// Restore blocks to their original placeholder state
export function restoreBlocks(positions: BlockPosition[]): void {
  if (!tilesGroup) return;

  positions.forEach((pos) => {
    const key = getBlockKey(pos.x, pos.y);
    const existingItem = blockItems.get(key);
    const originalAssetIndex = originalPlaceholderIndices.get(key);

    if (existingItem && originalAssetIndex !== undefined) {
      existingItem.remove();

      createTileImage(originalAssetIndex, pos.x, pos.y, (item) => {
        tilesGroup!.addChild(item);

        blockItems.set(key, item);
        blockData.set(key, { x: pos.x, y: pos.y, assetIndex: originalAssetIndex });
      });
    }
  });

  tilesGroup.sendToBack();
  updateAirportOverlay();
}

// Reset all blocks to placeholder state
export function resetAllBlocks(): void {
  if (!tilesGroup) return;

  const positionsToRestore: BlockPosition[] = [];

  blockData.forEach((data, key) => {
    if (!isPlaceholderIndex(data.assetIndex)) {
      positionsToRestore.push({ x: data.x, y: data.y });
    }
  });

  restoreBlocks(positionsToRestore);
}

// CCW positions: left edge (0,1)→(0,4), bottom-left, bottom edge, bottom-right,
// right edge (6,4)→(6,1), top-right, top edge, top-left
// 24 tiles total
const ccwPositions: [number, number][] = [
  // Left edge (excluding top-left corner, top to bottom)
  [0, 1], [0, 2], [0, 3], [0, 4],
  // Bottom-left corner
  [0, 5],
  // Bottom edge (excluding corners, left to right)
  [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],
  // Bottom-right corner
  [6, 5],
  // Right edge (excluding corners, bottom to top)
  [6, 4], [6, 3], [6, 2], [6, 1],
  // Top-right corner
  [6, 0],
  // Top edge (excluding corners, right to left)
  [5, 0], [4, 0], [3, 0], [2, 0], [1, 0],
  // Top-left corner (last)
  [0, 0],
];

// Get all remaining placeholder tiles with their types, in CCW order
export function getRemainingPlaceholders(): PlaceholderInfo[] {
  const placeholders: PlaceholderInfo[] = [];

  for (const [x, y] of ccwPositions) {
    const key = getBlockKey(x, y);
    const data = blockData.get(key);
    if (data && isPlaceholderIndex(data.assetIndex)) {
      placeholders.push({
        x,
        y,
        type: getTileDirection(x, y),
      });
    }
  }

  return placeholders;
}

// Get all edge block positions in CCW order
export function getAllEdgeBlockPositions(): BlockPosition[] {
  return ccwPositions.map(([x, y]) => ({ x, y }));
}

// ============================================================================
// V2 Save/Load Functions - CCW Order Edge Tile Export/Import
// ============================================================================


// Get edge tile asset indices in CCW order (900s for placeholders)
// Returns null if edge tiles are not initialized
export function getEdgeAssetIndices(): number[] | null {
  if (blockData.size === 0) return null;

  const numbers: number[] = [];

  for (const [x, y] of ccwPositions) {
    const key = getBlockKey(x, y);
    const data = blockData.get(key);
    if (!data) throw new Error(`blockData is null at ${key}`);
    numbers.push(data.assetIndex);
  }

  return numbers;
}

// Load edge tiles from number array
export function setEdgeTilesFromAssetIndices(numbers: number[]): void {
  // Initialize edge tiles (sets up data structures)
  initializeEdgeTiles();

  // Store asset indices in blockData (without creating SVG tiles)
  for (let i = 0; i < Math.min(numbers.length, ccwPositions.length); i++) {
    const num = numbers[i];
    const [x, y] = ccwPositions[i];
    const key = getBlockKey(x, y);
    blockData.set(key, { x, y, assetIndex: num });
  }

  // Load as geometry paths
  loadEdgeTilesAsGeometry();
}

// ============================================================================
// Edge Geometry Functions - Render edge tiles as Paper.js paths
// ============================================================================

// Convert flat coordinate array to paper.Point array
function parsePathPoints(coords: number[]): paper.Point[] {
  const points: paper.Point[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    points.push(new paper.Point(coords[i], coords[i + 1]));
  }
  return points;
}

// Load edge tiles as geometry paths from cached path data
export function loadEdgeTilesAsGeometry(): void {
  // Remove existing geometry
  if (edgeGeometryGroup) {
    edgeGeometryGroup.remove();
    edgeGeometryGroup = null;
  }

  layers.mapEdgeLayer.activate();
  edgeGeometryGroup = new paper.Group();
  edgeGeometryGroup.applyMatrix = false;

  // Collect all paths by terrain type
  const allPaths: Record<string, paper.Path[]> = { rock: [], sand: [], water: [] };

  for (const [x, y] of ccwPositions) {
    const key = getBlockKey(x, y);
    const data = blockData.get(key);
    if (!data) continue;

    const tileData = tilesPathsCache[data.assetIndex];
    if (!tileData?.pathData) continue;

    const offsetX = x * blockWidth;
    const offsetY = y * blockHeight;

    for (const [terrainType, polygons] of Object.entries(tileData.pathData)) {
      for (const coords of polygons as number[][]) {
        const points = parsePathPoints(coords);
        if (points.length < 3) continue;

        const path = new paper.Path({
          segments: points.map(p => new paper.Point(p.x + offsetX, p.y + offsetY)),
          closed: true,
          insert: false,
        });
        allPaths[terrainType as keyof typeof allPaths].push(path);
      }
    }
  }

  // Union paths of same terrain type and add to group
  // Order matters: water (bottom), sand, rock (top)
  const colorMap: Record<string, paper.Color> = {
    rock: colors.rock.color,
    sand: colors.sand.color,
    water: colors.water.color,
  };

  const renderOrder = ['water', 'sand', 'rock']; // bottom to top
  for (const terrainType of renderOrder) {
    const paths = allPaths[terrainType];
    if (!paths || paths.length === 0) continue;

    let combined: paper.PathItem = paths[0];
    for (let i = 1; i < paths.length; i++) {
      const newCombined = combined.unite(paths[i]);
      combined.remove();
      paths[i].remove();
      combined = newCombined;
    }

    combined.fillColor = colorMap[terrainType];
    edgeGeometryGroup.addChild(combined);
  }

  edgeGeometryGroup.locked = true;

  updateAirportOverlay();
}

// Toggle whether edge tile geometry intercepts mouse events
export function setEdgeTilesInteractive(interactive: boolean): void {
  if (edgeGeometryGroup) {
    edgeGeometryGroup.locked = !interactive;
  }
}

// Update airport SVG overlay — shown when tiles 34+35 are adjacent on bottom row
function updateAirportOverlay(): void {
  // Remove existing overlay
  if (airportOverlayGroup) {
    airportOverlayGroup.remove();
    airportOverlayGroup = null;
  }

  // Scan bottom row (y=5) for sequential airport tiles: 34 then 35
  const bottomY = verticalBlocks - 1;
  let airportX: number | null = null;

  for (let x = 0; x < horizontalBlocks - 1; x++) {
    const left = blockData.get(getBlockKey(x, bottomY));
    const right = blockData.get(getBlockKey(x + 1, bottomY));
    if (left?.assetIndex === 34 && right?.assetIndex === 35) {
      airportX = x;
      break;
    }
  }

  if (airportX === null) return;

  // Center between the two airport blocks
  const centerX = (airportX + 1) * blockWidth;
  const centerY = bottomY * blockHeight + blockHeight / 2;

  layers.mapEdgeLayer.activate();
  airportOverlayGroup = new paper.Group();
  airportOverlayGroup.applyMatrix = false;

  // Use cached SVG string for synchronous import (no network fetch)
  const airportSvg = airportOverlaySvg;
  if (airportSvg) {
    const svgItem = paper.project.importSVG(airportSvg, { insert: false });
    if (svgItem) {
      const targetSize = 8;
      svgItem.scale(targetSize / svgItem.bounds.height);
      svgItem.position = new paper.Point(centerX, centerY);
      airportOverlayGroup.addChild(svgItem);
    }
  } else {
    // Fallback: fetch from file (cache not loaded yet)
    paper.project.importSVG('static/svg/amenity-airport.svg', {
      onLoad: (svgItem: paper.Item) => {
        if (!airportOverlayGroup) return;
        const targetSize = 8;
        svgItem.scale(targetSize / svgItem.bounds.height);
        svgItem.position = new paper.Point(centerX, centerY);
        airportOverlayGroup.addChild(svgItem);
      },
      insert: false,
    });
  }
}

// Capture a low-res raster of the current edge tiles (SVG) with transparent center
export function captureEdgeTileRaster(width: number): string | null {
  if (!tilesGroup) return null;

  // Clone tiles group (and edgeBg for water frame) into a temporary group for rasterization
  layers.uiLayer.activate();
  const group = new paper.Group();
  if (edgeBg) group.addChild(edgeBg.clone());
  group.addChild(tilesGroup.clone());

  // Resolution = desired pixel width / island unit width (112)
  const resolution = (width / 112) * 72;
  const raster = group.rasterize(resolution);
  const dataUrl = raster.toDataURL();

  // Cleanup
  raster.remove();
  group.remove();
  layers.mapEdgeLayer.activate();

  return dataUrl;
}

// Show the geometry group
export function showEdgeGeometry(): void {
  if (edgeGeometryGroup) edgeGeometryGroup.visible = true;
}

// Hide the geometry group
export function hideEdgeGeometry(): void {
  if (edgeGeometryGroup) edgeGeometryGroup.visible = false;
}

// Show the SVG tiles group
export function showSvgTiles(): void {
  if (tilesGroup) tilesGroup.visible = true;
}

// Hide the SVG tiles group
export function hideSvgTiles(): void {
  if (tilesGroup) tilesGroup.visible = false;
}

// Hide/show individual edge tile by block coordinates
export function hideEdgeTileAtBlock(x: number, y: number): void {
  const key = getBlockKey(x, y);
  const item = blockItems.get(key);
  if (item) item.visible = false;
}

export function showEdgeTileAtBlock(x: number, y: number): void {
  const key = getBlockKey(x, y);
  const item = blockItems.get(key);
  if (item) item.visible = true;
}

// Fill SVG tiles from current blockData (used when entering edit mode)
export function fillSvgTilesFromBlockData(): void {
  if (!tilesGroup) return;

  // Clear existing SVG tiles
  tilesGroup.removeChildren();
  blockItems.clear();

  for (const [x, y] of ccwPositions) {
    const key = getBlockKey(x, y);
    const data = blockData.get(key);
    if (!data) continue;

    createTileImage(data.assetIndex, x, y, (item) => {
      tilesGroup!.addChild(item);
      blockItems.set(key, item);
    });
  }

  tilesGroup.sendToBack();
  updateAirportOverlay();
}
