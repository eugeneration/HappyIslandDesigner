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
import { getCachedSvgContent } from '../generatedTilesCache';

let tilesGroup: paper.Group | null = null;

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

// Get imageSrc for an asset index from either regular or placeholder assets
function getImageSrcForAsset(assetIndex: number): string | undefined {
  return assetIndexToData.get(assetIndex)?.imageSrc
    ?? placeholderAssetIndexToData.get(assetIndex)?.imageSrc;
}

// Create tile image from asset index - uses cached SVG first, then fetches
function createTileImage(
  assetIndex: number,
  blockX: number,
  blockY: number,
  callback: (item: paper.Item) => void
): void {
  const imageSrc = getImageSrcForAsset(assetIndex);
  if (!imageSrc) {
    console.error(`No imageSrc for asset index: ${assetIndex}`);
    return;
  }

  // Helper to position and scale SVG item
  const positionItem = (item: paper.Item) => {
    const scaleX = blockWidth / item.bounds.width;
    const scaleY = blockHeight / item.bounds.height;
    item.scale(scaleX, scaleY, item.bounds.topLeft);
    item.bounds.topLeft = new paper.Point(
      blockX * blockWidth,
      blockY * blockHeight
    );
    callback(item);
  };

  // Try cached SVG content first
  const cachedSvg = getCachedSvgContent(imageSrc);
  if (cachedSvg) {
    const item = paper.project.importSVG(cachedSvg, { insert: false });
    if (item) {
      positionItem(item);
      return;
    }
  }

  // Fall back to fetching SVG
  paper.project.importSVG(imageSrc, {
    onLoad: (item: paper.Item) => {
      positionItem(item);
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
}

export function deleteEdgeTiles(): void {
  if (tilesGroup) {
    tilesGroup.remove();
    tilesGroup = null;
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
