import paper from 'paper';
import { layers } from '../layers';
import { colors } from '../colors';
import { emitter } from '../emitter';
import { horizontalBlocks, verticalBlocks, horizontalDivisions, verticalDivisions } from '../constants';
import { showOptionSelector, hideOptionSelector } from './mapOptionSelector';
import {
  getAllEdgeBlockPositions,
  replaceBlocks,
  hideEdgeGeometry,
  showEdgeGeometry,
  showSvgTiles,
  hideSvgTiles,
  fillSvgTilesFromBlockData,
  loadEdgeTilesAsGeometry,
} from './edgeTiles';
import {
  getTileDirection,
  getCategoriesForDirection,
  getCategoryIcon,
  getTileOptionsForCategory,
  MAX_CATEGORY_ITEMS,
  type TileCategory,
} from './edgeTileAssets';
import { toolState } from '../tools/state';

const blockWidth = horizontalDivisions; // 16
const blockHeight = verticalDivisions; // 16

let overlayRect: paper.Path.Rectangle | null = null;
let outlineGroup: paper.Group | null = null;
let isEditModeActive = false;
let currentClickHandler: ((event: paper.MouseEvent) => void) | null = null;

export function enterEdgeEditMode(): void {
  if (isEditModeActive) return;

  isEditModeActive = true;
  showEdgeEditOverlay();
  showEdgeTileOutlines();
  toolState.focusOnCanvas(false);

  // Hide geometry and show SVG tiles for editing
  hideEdgeGeometry();
  fillSvgTilesFromBlockData();
  showSvgTiles();

  // Set up click handler
  currentClickHandler = (event: paper.MouseEvent) => {
    if (!isEditModeActive) return;

    const mapPoint = layers.mapLayer.globalToLocal(event.point);
    const blockX = Math.floor(mapPoint.x / blockWidth);
    const blockY = Math.floor(mapPoint.y / blockHeight);

    if (isEdgeTile(blockX, blockY)) {
      handleEdgeTileClick(blockX, blockY);
    }
  };

  paper.view.onClick = currentClickHandler;
}

export function exitEdgeEditMode(): void {
  if (!isEditModeActive) return;

  isEditModeActive = false;
  hideEdgeEditOverlay();
  hideEdgeTileOutlines();
  hideOptionSelector();
  toolState.focusOnCanvas(true);

  if (currentClickHandler) {
    paper.view.onClick = null;
    currentClickHandler = null;
  }

  // Hide SVG tiles and rebuild geometry
  hideSvgTiles();
  loadEdgeTilesAsGeometry();
  showEdgeGeometry();
}

export function isEdgeEditModeActive(): boolean {
  return isEditModeActive;
}

function isEdgeTile(blockX: number, blockY: number): boolean {
  const maxX = horizontalBlocks - 1;
  const maxY = verticalBlocks - 1;
  return blockX === 0 || blockX === maxX || blockY === 0 || blockY === maxY;
}

function showEdgeEditOverlay(): void {
  hideEdgeEditOverlay();
  layers.mapOverlayLayer.activate();

  const mapWidth = horizontalBlocks * blockWidth;
  const mapHeight = verticalBlocks * blockHeight;

  overlayRect = new paper.Path.Rectangle({
    rectangle: new paper.Rectangle(0, 0, mapWidth, mapHeight),
    fillColor: new paper.Color(0, 0, 0, 0.25),
  });
}

function hideEdgeEditOverlay(): void {
  if (overlayRect) {
    overlayRect.remove();
    overlayRect = null;
  }
}

function showEdgeTileOutlines(): void {
  hideEdgeTileOutlines();
  layers.mapOverlayLayer.activate();

  outlineGroup = new paper.Group();
  outlineGroup.applyMatrix = false;

  const positions = getAllEdgeBlockPositions();

  for (const { x, y } of positions) {
    const rect = new paper.Path.Rectangle({
      rectangle: new paper.Rectangle(x * blockWidth, y * blockHeight, blockWidth, blockHeight),
      strokeColor: colors.selected.color.clone(),
      strokeWidth: 0.5,
      fillColor: null,
    });
    rect.strokeColor!.alpha = 0.5;
    outlineGroup.addChild(rect);
  }
}

function hideEdgeTileOutlines(): void {
  if (outlineGroup) {
    outlineGroup.remove();
    outlineGroup = null;
  }
}

function getOptionDirection(blockX: number, blockY: number): 'left' | 'right' | 'bottom' {
  const maxX = horizontalBlocks - 1;

  // Left edge tiles - show options to the right
  if (blockX === 0) return 'right';
  // Right edge tiles - show options to the left
  if (blockX === maxX) return 'left';
  // Top/bottom edge tiles - show options below
  return 'bottom';
}

// ============================================================================
// Two-Step Category Selection
// ============================================================================

let currentEdgeTileBlock: { x: number; y: number } | null = null;
let currentCategories: TileCategory[] | null = null;
let lastOptionClickTime = 0;

function handleEdgeTileClick(blockX: number, blockY: number): void {
  // Ignore clicks immediately after option selection to prevent click-through
  if (Date.now() - lastOptionClickTime < 100) return;

  const direction = getTileDirection(blockX, blockY);
  const categories = getCategoriesForDirection(direction);

  if (categories.length === 0) {
    console.warn(`No categories available for direction: ${direction}`);
    return;
  }

  // Store current block position for event handlers
  currentEdgeTileBlock = { x: blockX, y: blockY };

  if (categories.length === 1) {
    // Skip category selection, go straight to tile options
    showTileOptionsForCategory(blockX, blockY, categories[0]);
  } else {
    // Show category selector first
    showCategorySelector(blockX, blockY, categories);
  }
}

function showCategorySelector(blockX: number, blockY: number, categories: TileCategory[]): void {
  currentCategories = categories;  // Store for event listener
  const options = categories.map((cat, i) => ({
    label: String(i + 1),
    value: i, // category index, event listener uses currentCategories to get actual category
    imageSrc: getCategoryIcon(cat),
  }));

  showOptionSelector({
    anchorPoint: new paper.Point(blockX * blockWidth + blockWidth / 2, blockY * blockHeight + blockHeight / 2),
    options: options,
    direction: getOptionDirection(blockX, blockY),
    eventName: 'edgeCategorySelected',
    title: 'Select category',
    spacing: 14,
    buttonSize: 12,
    fixedItemCount: MAX_CATEGORY_ITEMS,
  });
}

function showTileOptionsForCategory(blockX: number, blockY: number, category: TileCategory): void {
  const options = getTileOptionsForCategory(category);

  if (options.length === 0) {
    console.warn(`No tile options available for category: ${category}`);
    return;
  }

  showOptionSelector({
    anchorPoint: new paper.Point(blockX * blockWidth + blockWidth / 2, blockY * blockHeight + blockHeight / 2),
    options: options,
    direction: getOptionDirection(blockX, blockY),
    eventName: 'edgeTileSelected',
    title: 'Select tile',
    spacing: 14,
    buttonSize: 12,
    fixedItemCount: MAX_CATEGORY_ITEMS,
  });
}

// Handle category selection - transition to step 2
// Use setTimeout to defer showing tile options until after the click handler's hideOptionSelector() completes
emitter.on('edgeCategorySelected', ({ value: categoryIndex }: { value: number }) => {
  lastOptionClickTime = Date.now();
  if (currentEdgeTileBlock && currentCategories) {
    const category = currentCategories[categoryIndex];
    const { x, y } = currentEdgeTileBlock;
    setTimeout(() => {
      showTileOptionsForCategory(x, y, category);
    }, 0);
  }
});

// Handle tile selection - update edge tile
emitter.on('edgeTileSelected', ({ value }: { value: number }) => {
  lastOptionClickTime = Date.now();
  if (currentEdgeTileBlock) {
    replaceBlocks({ x: currentEdgeTileBlock.x, y: currentEdgeTileBlock.y, assetIndex: value });
    currentEdgeTileBlock = null;
    currentCategories = null;
  }
});
