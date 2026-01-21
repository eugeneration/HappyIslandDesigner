import paper from 'paper';
import { layers } from '../layers';
import { horizontalBlocks, verticalBlocks, horizontalDivisions, verticalDivisions } from '../constants';

let tilesGroup: paper.Group | null = null;

const blockWidth = horizontalDivisions; // 16
const blockHeight = verticalDivisions; // 16
const tilesPath = 'static/tiles/';
const tilesDataPath = 'static/tiles_data/';

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
    const scaleX = blockWidth / raster.width;
    const scaleY = blockHeight / raster.height;
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
        // Scale to fit the tile
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

// Block state tracking - tracks what type of content occupies each edge block
export type BlockState = 'placeholder' | 'airport' | 'river' | 'peninsula' | 'dock' | 'secretBeach' | 'rock' | 'filled';
export type BlockPosition = { x: number; y: number };

// Placeholder type based on position
export type PlaceholderType = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'left' | 'right' | 'top' | 'bottom';

export type PlaceholderInfo = {
  x: number;
  y: number;
  type: PlaceholderType;
};

// Track state and raster reference for each edge block
const blockStates: Map<string, BlockState> = new Map();
const blockRasters: Map<string, paper.Raster> = new Map();
const originalPlaceholders: Map<string, string> = new Map(); // Store original placeholder image paths

function getBlockKey(x: number, y: number): string {
  return `${x},${y}`;
}

type PlaceholderConfig = {
  imageSrc: string;
  blockX: number;
  blockY: number;
};

function getEdgePlaceholders(): PlaceholderConfig[] {
  const placeholders: PlaceholderConfig[] = [];

  // Corners
  placeholders.push({ imageSrc: `${tilesPath}placeholder_top_left.png`, blockX: 0, blockY: 0 });
  placeholders.push({ imageSrc: `${tilesPath}placeholder_top_right.png`, blockX: horizontalBlocks - 1, blockY: 0 });
  placeholders.push({ imageSrc: `${tilesPath}placeholder_bottom_left.png`, blockX: 0, blockY: verticalBlocks - 1 });
  placeholders.push({ imageSrc: `${tilesPath}placeholder_bottom_right.png`, blockX: horizontalBlocks - 1, blockY: verticalBlocks - 1 });

  // Left edge (excluding corners)
  for (let y = 1; y < verticalBlocks - 1; y++) {
    placeholders.push({ imageSrc: `${tilesPath}placeholder_left.png`, blockX: 0, blockY: y });
  }

  // Right edge (excluding corners)
  for (let y = 1; y < verticalBlocks - 1; y++) {
    placeholders.push({ imageSrc: `${tilesPath}placeholder_right.png`, blockX: horizontalBlocks - 1, blockY: y });
  }

  // Top edge (excluding corners)
  for (let x = 1; x < horizontalBlocks - 1; x++) {
    placeholders.push({ imageSrc: `${tilesPath}placeholder_top.png`, blockX: x, blockY: 0 });
  }

  // Bottom edge (excluding corners)
  for (let x = 1; x < horizontalBlocks - 1; x++) {
    placeholders.push({ imageSrc: `${tilesPath}placeholder_bottom.png`, blockX: x, blockY: verticalBlocks - 1 });
  }

  return placeholders;
}

function createPlaceholderImage(config: PlaceholderConfig, callback: (item: paper.Item) => void): void {
  createTileImage(config.imageSrc, config.blockX, config.blockY, callback);
}

export function showEdgeTiles(): void {
  hideEdgeTiles();

  layers.mapOverlayLayer.activate();

  tilesGroup = new paper.Group();
  tilesGroup.applyMatrix = false;

  const placeholders = getEdgePlaceholders();

  placeholders.forEach((config) => {
    createPlaceholderImage(config, (item) => {
      tilesGroup!.addChild(item);

      // Track the block state and raster
      const key = getBlockKey(config.blockX, config.blockY);
      blockStates.set(key, 'placeholder');
      blockRasters.set(key, item as paper.Raster);
      originalPlaceholders.set(key, config.imageSrc);
    });
  });

  // Send to back of overlay layer so UI elements appear on top
  tilesGroup.sendToBack();
}

export function hideEdgeTiles(): void {
  if (tilesGroup) {
    tilesGroup.remove();
    tilesGroup = null;
  }
  // Clear tracking maps
  blockStates.clear();
  blockRasters.clear();
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
      replaceBlocks(
        [{ x: 4, y: bottomRow }],
        [`${tilesPath}placeholder_bottom_river.png`],
        'river'
      );
      replaceBlocks(
        [{ x: 0, y: 2 }],
        [`${tilesPath}placeholder_left_river.png`],
        'river'
      );
      break;
    case 'east':
      // East: south river entrance at bottom row, column 2 (0-indexed)
      // Right river entrance at last column, row 2 (0-indexed)
      replaceBlocks(
        [{ x: 2, y: bottomRow }],
        [`${tilesPath}placeholder_bottom_river.png`],
        'river'
      );
      replaceBlocks(
        [{ x: horizontalBlocks - 1, y: 2 }],
        [`${tilesPath}placeholder_right_river.png`],
        'river'
      );
      break;
    case 'south':
      // South: two river entrances at bottom row, columns 2 and 6 (0-indexed)
      replaceBlocks(
        [{ x: 1, y: bottomRow }],
        [`${tilesPath}placeholder_bottom_river.png`],
        'river'
      );
      replaceBlocks(
        [{ x: 5, y: bottomRow }],
        [`${tilesPath}placeholder_bottom_river.png`],
        'river'
      );
      break;
  }
}

// Get the state of a specific block
export function getBlockState(x: number, y: number): BlockState | undefined {
  return blockStates.get(getBlockKey(x, y));
}

// Replace blocks with new images
export function replaceBlocks(
  positions: BlockPosition[],
  imageSrcs: string[],
  newState: BlockState
): void {
  if (!tilesGroup) return;

  positions.forEach((pos, index) => {
    const key = getBlockKey(pos.x, pos.y);
    const existingRaster = blockRasters.get(key);

    if (existingRaster) {
      // Remove the existing raster
      existingRaster.remove();
    }

    // Create new tile with the new image (SVG preferred, PNG fallback)
    const imageSrc = imageSrcs[index] || imageSrcs[0];
    createTileImage(imageSrc, pos.x, pos.y, (item) => {
      tilesGroup!.addChild(item);

      // Update tracking
      blockStates.set(key, newState);
      blockRasters.set(key, item as paper.Raster);
    });
  });

  // Send group to back to keep UI elements on top
  tilesGroup.sendToBack();
}

// Restore blocks to their original placeholder state
export function restoreBlocks(positions: BlockPosition[]): void {
  if (!tilesGroup) return;

  positions.forEach((pos) => {
    const key = getBlockKey(pos.x, pos.y);
    const existingRaster = blockRasters.get(key);
    const originalSrc = originalPlaceholders.get(key);

    if (existingRaster && originalSrc) {
      // Remove the existing raster
      existingRaster.remove();

      // Create new tile with original placeholder image (SVG preferred, PNG fallback)
      createTileImage(originalSrc, pos.x, pos.y, (item) => {
        tilesGroup!.addChild(item);

        // Update tracking
        blockStates.set(key, 'placeholder');
        blockRasters.set(key, item as paper.Raster);
      });
    }
  });

  tilesGroup.sendToBack();
}

// Reset all blocks to placeholder state
export function resetAllBlocks(): void {
  if (!tilesGroup) return;

  const positionsToRestore: BlockPosition[] = [];

  blockStates.forEach((state, key) => {
    if (state !== 'placeholder') {
      const [x, y] = key.split(',').map(Number);
      positionsToRestore.push({ x, y });
    }
  });

  restoreBlocks(positionsToRestore);
}

// Determine placeholder type based on position
function getPlaceholderType(x: number, y: number): PlaceholderType {
  const maxX = horizontalBlocks - 1; // 6
  const maxY = verticalBlocks - 1; // 5

  // Corners
  if (x === 0 && y === 0) return 'top_left';
  if (x === maxX && y === 0) return 'top_right';
  if (x === 0 && y === maxY) return 'bottom_left';
  if (x === maxX && y === maxY) return 'bottom_right';

  // Edges
  if (x === 0) return 'left';
  if (x === maxX) return 'right';
  if (y === 0) return 'top';
  if (y === maxY) return 'bottom';

  // Should not happen for edge tiles, but provide fallback
  return 'top';
}

// Get counter-clockwise order index for sorting
// Order: left edge (top to bottom, excluding top-left corner) -> bottom-left corner ->
// bottom edge (left to right) -> bottom-right corner -> right edge (bottom to top) ->
// top-right corner -> top edge (right to left) -> top-left corner
function getCounterClockwiseOrder(x: number, y: number): number {
  const maxX = horizontalBlocks - 1; // 6
  const maxY = verticalBlocks - 1; // 5

  // Left edge (excluding top-left corner): y=1 to y=4 at x=0
  if (x === 0 && y > 0 && y < maxY) {
    return y - 1; // 0, 1, 2, 3
  }
  // Bottom-left corner
  if (x === 0 && y === maxY) {
    return 4;
  }
  // Bottom edge (excluding corners): x=1 to x=5 at y=maxY
  if (y === maxY && x > 0 && x < maxX) {
    return 4 + x; // 5, 6, 7, 8, 9
  }
  // Bottom-right corner
  if (x === maxX && y === maxY) {
    return 10;
  }
  // Right edge (bottom to top, excluding corners): y=4 to y=1 at x=maxX
  if (x === maxX && y > 0 && y < maxY) {
    return 10 + (maxY - y); // 11, 12, 13, 14
  }
  // Top-right corner
  if (x === maxX && y === 0) {
    return 15;
  }
  // Top edge (right to left, excluding corners): x=5 to x=1 at y=0
  if (y === 0 && x > 0 && x < maxX) {
    return 15 + (maxX - x); // 16, 17, 18, 19, 20
  }
  // Top-left corner (last)
  if (x === 0 && y === 0) {
    return 21;
  }

  return 999; // Should not happen
}

// Get all remaining placeholder tiles with their types
export function getRemainingPlaceholders(): PlaceholderInfo[] {
  const placeholders: PlaceholderInfo[] = [];

  blockStates.forEach((state, key) => {
    if (state === 'placeholder') {
      const [x, y] = key.split(',').map(Number);
      placeholders.push({
        x,
        y,
        type: getPlaceholderType(x, y),
      });
    }
  });

  // Sort in counter-clockwise order starting from left edge (below top-left),
  // ending at top-left corner
  placeholders.sort((a, b) => {
    return getCounterClockwiseOrder(a.x, a.y) - getCounterClockwiseOrder(b.x, b.y);
  });

  return placeholders;
}

// Get all edge block positions (for tracking filled placeholders)
export function getAllEdgeBlockPositions(): BlockPosition[] {
  const positions: BlockPosition[] = [];

  // Left edge (excluding corners, top to bottom)
  for (let y = 1; y < verticalBlocks - 1; y++) {
    positions.push({ x: 0, y });
  }

  // Bottom-left corner
  positions.push({ x: 0, y: verticalBlocks - 1 });

  // Bottom edge (excluding corners, left to right)
  for (let x = 1; x < horizontalBlocks - 1; x++) {
    positions.push({ x, y: verticalBlocks - 1 });
  }

  // Bottom-right corner
  positions.push({ x: horizontalBlocks - 1, y: verticalBlocks - 1 });

  // Right edge (excluding corners, bottom to top)
  for (let y = verticalBlocks - 2; y >= 1; y--) {
    positions.push({ x: horizontalBlocks - 1, y });
  }

  // Top-right corner
  positions.push({ x: horizontalBlocks - 1, y: 0 });

  // Top edge (excluding corners, right to left)
  for (let x = horizontalBlocks - 2; x >= 1; x--) {
    positions.push({ x, y: 0 });
  }

  // Top-left corner (last)
  positions.push({ x: 0, y: 0 });

  return positions;
}
