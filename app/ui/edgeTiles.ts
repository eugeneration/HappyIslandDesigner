import paper from 'paper';
import { layers } from '../layers';
import { horizontalBlocks, verticalBlocks, horizontalDivisions, verticalDivisions } from '../constants';

let tilesGroup: paper.Group | null = null;

const blockWidth = horizontalDivisions; // 16
const blockHeight = verticalDivisions; // 16
const tilesPath = 'static/tiles/';

// Block state tracking
export type BlockState = 'placeholder' | 'airport' | 'filled';
export type BlockPosition = { x: number; y: number };

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

function createPlaceholderImage(config: PlaceholderConfig): paper.Raster {
  const raster = new paper.Raster(config.imageSrc);

  // Position at center of the block
  const x = config.blockX * blockWidth + blockWidth / 2;
  const y = config.blockY * blockHeight + blockHeight / 2;

  raster.onLoad = () => {
    // Scale image to fit exactly one block (16x16)
    const scaleX = blockWidth / raster.width;
    const scaleY = blockHeight / raster.height;
    raster.scaling = new paper.Point(scaleX, scaleY);
  };

  raster.position = new paper.Point(x, y);

  return raster;
}

export function showEdgeTiles(): void {
  hideEdgeTiles();

  layers.mapOverlayLayer.activate();

  tilesGroup = new paper.Group();
  tilesGroup.applyMatrix = false;

  const placeholders = getEdgePlaceholders();

  placeholders.forEach((config) => {
    const raster = createPlaceholderImage(config);
    tilesGroup!.addChild(raster);

    // Track the block state and raster
    const key = getBlockKey(config.blockX, config.blockY);
    blockStates.set(key, 'placeholder');
    blockRasters.set(key, raster);
    originalPlaceholders.set(key, config.imageSrc);
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
        'filled'
      );
      replaceBlocks(
        [{ x: 0, y: 2 }],
        [`${tilesPath}placeholder_left_river.png`],
        'filled'
      );
      break;
    case 'east':
      // East: south river entrance at bottom row, column 2 (0-indexed)
      // Right river entrance at last column, row 2 (0-indexed)
      replaceBlocks(
        [{ x: 2, y: bottomRow }],
        [`${tilesPath}placeholder_bottom_river.png`],
        'filled'
      );
      replaceBlocks(
        [{ x: horizontalBlocks - 1, y: 2 }],
        [`${tilesPath}placeholder_right_river.png`],
        'filled'
      );
      break;
    case 'south':
      // South: two river entrances at bottom row, columns 2 and 6 (0-indexed)
      replaceBlocks(
        [{ x: 1, y: bottomRow }],
        [`${tilesPath}placeholder_bottom_river.png`],
        'filled'
      );
      replaceBlocks(
        [{ x: 5, y: bottomRow }],
        [`${tilesPath}placeholder_bottom_river.png`],
        'filled'
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

    // Create new raster with the new image
    const imageSrc = imageSrcs[index] || imageSrcs[0];
    const newRaster = new paper.Raster(imageSrc);

    // Position at center of the block
    const x = pos.x * blockWidth + blockWidth / 2;
    const y = pos.y * blockHeight + blockHeight / 2;

    newRaster.onLoad = () => {
      // Scale image to fit exactly one block (16x16)
      const scaleX = blockWidth / newRaster.width;
      const scaleY = blockHeight / newRaster.height;
      newRaster.scaling = new paper.Point(scaleX, scaleY);
    };

    newRaster.position = new paper.Point(x, y);
    tilesGroup!.addChild(newRaster);

    // Update tracking
    blockStates.set(key, newState);
    blockRasters.set(key, newRaster);
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

      // Create new raster with original placeholder image
      const newRaster = new paper.Raster(originalSrc);

      // Position at center of the block
      const x = pos.x * blockWidth + blockWidth / 2;
      const y = pos.y * blockHeight + blockHeight / 2;

      newRaster.onLoad = () => {
        const scaleX = blockWidth / newRaster.width;
        const scaleY = blockHeight / newRaster.height;
        newRaster.scaling = new paper.Point(scaleX, scaleY);
      };

      newRaster.position = new paper.Point(x, y);
      tilesGroup!.addChild(newRaster);

      // Update tracking
      blockStates.set(key, 'placeholder');
      blockRasters.set(key, newRaster);
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
