import paper from 'paper';
import { layers } from '../layers';
import { horizontalBlocks, verticalBlocks, horizontalDivisions, verticalDivisions } from '../constants';
import {
  type BlockState,
  type TileDirection,
  assetIndexToData,
  placeholderAssetIndexToData,
  getPlaceholderIndexForPosition,
  getTileDirection,
  isPlaceholderIndex,
} from './edgeTileAssets';

let tilesGroup: paper.Group | null = null;

const blockWidth = horizontalDivisions; // 16
const blockHeight = verticalDivisions; // 16
const tileImageSize = 18; // Source images have 1 tile buffer around edge, scale to 18 units
const tilesPath = 'static/tiles/';
const tilesDataPath = 'static/tiles_data/';

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

// Convert PNG path to potential SVG path in tiles_data folder
function getSvgPath(pngPath: string): string | null {
  // e.g., "static/tiles/placeholder_top_left.png" -> "static/tiles_data/placeholder_top_left.svg"
  const filename = pngPath.split('/').pop()?.replace('.png', '.svg');
  if (!filename) return null;
  return `${tilesDataPath}${filename}`;
}

// Load PNG tile as fallback
function loadPngTile(
  imageSrc: string,
  blockX: number,
  blockY: number,
  callback: (item: paper.Item) => void
): void {
  const raster = new paper.Raster(imageSrc);
  const x = blockX * blockWidth + blockWidth / 2;
  const y = blockY * blockHeight + blockHeight / 2;

  raster.onLoad = () => {
    // Scale to 18x18 (source images have 1 tile buffer around edge)
    const scaleX = tileImageSize / raster.width;
    const scaleY = tileImageSize / raster.height;
    raster.scaling = new paper.Point(scaleX, scaleY);
    callback(raster);
  };

  raster.position = new paper.Point(x, y);
}

// Create tile image - tries SVG first, falls back to PNG
function createTileImage(
  imageSrc: string,
  blockX: number,
  blockY: number,
  callback: (item: paper.Item) => void
): void {
  const svgPath = getSvgPath(imageSrc);

  if (svgPath) {
    // Try to load SVG first
    paper.project.importSVG(svgPath, {
      onLoad: (item: paper.Item) => {
        // Scale SVG to fit block size (16x16) - SVGs are designed without buffer
        const scaleX = blockWidth / item.bounds.width;
        const scaleY = blockHeight / item.bounds.height;
        item.scale(scaleX, scaleY, item.bounds.topLeft);
        item.bounds.topLeft = new paper.Point(
          blockX * blockWidth,
          blockY * blockHeight
        );
        callback(item);
      },
      onError: () => {
        // Fall back to PNG
        loadPngTile(imageSrc, blockX, blockY, callback);
      }
    });
  } else {
    loadPngTile(imageSrc, blockX, blockY, callback);
  }
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
const originalPlaceholders: Map<string, string> = new Map(); // Store original placeholder image paths

function getBlockKey(x: number, y: number): string {
  return `${x},${y}`;
}

type PlaceholderConfig = {
  x: number;
  y: number;
  imageSrc: string;
};

function getEdgePlaceholders(): PlaceholderConfig[] {
  const placeholders: PlaceholderConfig[] = [];

  // Corners
  placeholders.push({ imageSrc: `${tilesPath}placeholder_top_left.png`, x: 0, y: 0 });
  placeholders.push({ imageSrc: `${tilesPath}placeholder_top_right.png`, x: horizontalBlocks - 1, y: 0 });
  placeholders.push({ imageSrc: `${tilesPath}placeholder_bottom_left.png`, x: 0, y: verticalBlocks - 1 });
  placeholders.push({ imageSrc: `${tilesPath}placeholder_bottom_right.png`, x: horizontalBlocks - 1, y: verticalBlocks - 1 });

  // Left edge (excluding corners)
  for (let y = 1; y < verticalBlocks - 1; y++) {
    placeholders.push({ imageSrc: `${tilesPath}placeholder_left.png`, x: 0, y: y });
  }

  // Right edge (excluding corners)
  for (let y = 1; y < verticalBlocks - 1; y++) {
    placeholders.push({ imageSrc: `${tilesPath}placeholder_right.png`, x: horizontalBlocks - 1, y: y });
  }

  // Top edge (excluding corners)
  for (let x = 1; x < horizontalBlocks - 1; x++) {
    placeholders.push({ imageSrc: `${tilesPath}placeholder_top.png`, x: x, y: 0 });
  }

  // Bottom edge (excluding corners)
  for (let x = 1; x < horizontalBlocks - 1; x++) {
    placeholders.push({ imageSrc: `${tilesPath}placeholder_bottom.png`, x: x, y: verticalBlocks - 1 });
  }

  return placeholders;
}

export function initializeEdgeTiles(): void {
  deleteEdgeTiles();

  layers.mapEdgeLayer.activate();

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
  const placeholders = getEdgePlaceholders();

  for (const {x, y, imageSrc} of placeholders) {
    const key = getBlockKey(x, y);
    originalPlaceholders.set(key, imageSrc);
    createTileImage(imageSrc, x, y, (item) => {
      tilesGroup!.addChild(item);
      blockItems.set(key, item);
      blockData.set(key, {x, y, assetIndex: getPlaceholderIndexForPosition(x, y)})
    });
  }
  // Send to back of overlay layer so UI elements appear on top
  tilesGroup!.sendToBack();
}

export function deleteEdgeTiles(): void {
  if (tilesGroup) {
    tilesGroup.remove();
    tilesGroup = null;
  }
  // Clear tracking maps
  blockData.clear();
  blockItems.clear();
  originalPlaceholders.clear();
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

  // Create new tile with the new image (SVG preferred, PNG fallback)
  const imageSrc = assetIndexToData.get(assetIndex)?.imageSrc
    ?? placeholderAssetIndexToData.get(assetIndex)?.imageSrc;
  if (!imageSrc) {
    console.error("Invalid block assetID", assetIndex);
    return;
  }

  createTileImage(imageSrc, x, y, (item) => {
    const key = getBlockKey(x, y);

    // Remove the existing raster
    blockItems.get(key)?.remove();

    tilesGroup!.addChild(item);

    // Update tracking
    blockData.set(key, {x, y, assetIndex});
    blockItems.set(key, item);
  });

  // Send group to back to keep UI elements on top
  tilesGroup.sendToBack();
}

// Restore blocks to their original placeholder state
export function restoreBlocks(positions: BlockPosition[]): void {
  if (!tilesGroup) return;

  positions.forEach((pos) => {
    const key = getBlockKey(pos.x, pos.y);
    const existingRaster = blockItems.get(key);
    const originalSrc = originalPlaceholders.get(key);

    if (existingRaster && originalSrc) {
      existingRaster.remove();

      createTileImage(originalSrc, pos.x, pos.y, (item) => {
        tilesGroup!.addChild(item);

        blockItems.set(key, item);
        blockData.set(key, { x: pos.x, y: pos.y, assetIndex: getPlaceholderIndexForPosition(pos.x, pos.y) });
      });
    }
  });

  tilesGroup.sendToBack();
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
// Returns null if edge tiles are not visible
export function getEdgeAssetIndices(): number[] | null {
  if (!tilesGroup) return null;

  const numbers: number[] = [];

  for (const [x, y] of ccwPositions) {
    const key = getBlockKey(x, y);
    const data = blockData.get(key);
    if (!data) throw new Error(`blockData is null at ${key}`);
    numbers.push(data?.assetIndex);
  }

  return numbers;
}

// Load edge tiles from number array
export function setEdgeTilesFromAssetIndices(numbers: number[]): void {
  // Show edge tiles first (sets up placeholders)
  initializeEdgeTiles();

  for (let i = 0; i < Math.min(numbers.length, ccwPositions.length); i++) {
    const num = numbers[i];
    const [x, y] = ccwPositions[i];
    replaceBlocks({ x, y, assetIndex: num });
  }
}
