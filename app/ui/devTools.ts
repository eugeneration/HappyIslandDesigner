import paper from 'paper';
import { layers } from '../layers';
import { colors } from '../colors';
import { state, addToHistory } from '../state';
import { addPath } from '../paint';
import { emitter } from '../emitter';
import { horizontalBlocks, verticalBlocks, horizontalDivisions, verticalDivisions } from '../constants';
import { createButton } from './createButton';
import { toolState } from '../tools/state';
import { autoCompleteToGrid } from './mapSelectionWizard';
import {
  assetIndexToData,
  getTileDirection,
  getPlaceholderIndexForPosition,
  type TileDirection,
} from './edgeTileAssets';
import { setEdgeTilesFromAssetIndices } from './edgeTiles';
import { setMapVersion } from '../mapState';
import Layouts, { Layout } from '../components/islandLayouts';
import { loadMapFromJSONString } from '../load';
import { safeCompoundIntersection } from '../helpers/safeCompoundIntersection';
import { getCachedSvgContent } from '../generatedTilesCache';
import { encodeMap } from '../save';

// Only initialize in dev builds
declare const __DEV__: boolean;

const blockWidth = horizontalDivisions; // 16
const blockHeight = verticalDivisions; // 16

// State
let devToolsGroup: paper.Group | null = null;
let devMenuGroup: paper.Group | null = null;
let isMenuOpen = false;
let isExtractModeActive = false;
let isLoadModeActive = false;
let isSvgExportModeActive = false;
let isSvgImportModeActive = false;
let isSvgExportFromFileModeActive = false;
let isSvgToTerrainModeActive = false;
let isVisiblePortionsExportModeActive = false;
let isTileTracerModeActive = false;
let tileTracerRaster: paper.Raster | null = null;
let tileTracerButtons: HTMLDivElement | null = null;
let tileTracerImageIndex = 0;
let highlightRect: paper.Path.Rectangle | null = null;
let postfixDropdown: HTMLDivElement | null = null;
let isLayoutNavigatorActive = false;
let layoutNavigatorButtons: HTMLDivElement | null = null;
let layoutNavigatorIndex = 0;

// Sorted list of asset indices for tile tracer navigation
const assetIndices: number[] = Array.from(assetIndexToData.keys()).sort((a, b) => a - b);

// Position-filtered postfix options
const postfixOptions: Record<string, string[]> = {
  top: ['secret_beach'],
  bottom: ['river'],
  left: ['river', 'peninsula', 'rock'],
  right: ['river', 'peninsula', 'rock'],
  top_left: [],
  top_right: [],
  bottom_left: ['dock'],
  bottom_right: ['dock'],
};

function isEdgeTile(blockX: number, blockY: number): boolean {
  const maxX = horizontalBlocks - 1;
  const maxY = verticalBlocks - 1;
  return blockX === 0 || blockX === maxX || blockY === 0 || blockY === maxY;
}

function getTilePositionName(x: number, y: number): string {
  const maxX = horizontalBlocks - 1;
  const maxY = verticalBlocks - 1;

  if (x === 0 && y === 0) return 'top_left';
  if (x === maxX && y === 0) return 'top_right';
  if (x === 0 && y === maxY) return 'bottom_left';
  if (x === maxX && y === maxY) return 'bottom_right';
  if (x === 0) return 'left';
  if (x === maxX) return 'right';
  if (y === 0) return 'top';
  if (y === maxY) return 'bottom';
  return 'unknown';
}

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
    console.log(`[encodePathItem] Encoding CompoundPath with ${children.length} children`);
    return children.map((path) => {
      return encodePath(path as paper.Path);
    });
  } else {
    return encodePath(pathItem as paper.Path);
  }
}

function decodeToPathItem(pathData: number[] | number[][]): paper.PathItem {
  if (typeof pathData[0] === 'number') {
    // Single path
    const path = new paper.Path(decodePathPoints(pathData as number[]));
    path.closed = true;
    return path;
  } else {
    // Compound path
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
  const size = blockWidth; // 16

  switch (direction) {
    case 'left':
      // Exclude right 3 columns (x 13-15)
      return new paper.Path.Rectangle(new paper.Rectangle(13, 0, 3, size));
    case 'right':
      // Exclude left 3 columns (x 0-2)
      return new paper.Path.Rectangle(new paper.Rectangle(0, 0, 3, size));
    case 'top':
      // Exclude bottom 3 rows (y 13-15)
      return new paper.Path.Rectangle(new paper.Rectangle(0, 13, size, 3));
    case 'bottom':
      // Exclude top 3 rows (y 0-2)
      return new paper.Path.Rectangle(new paper.Rectangle(0, 0, size, 3));
    case 'top_left':
      // Exclude bottom-right triangle
      return new paper.Path({ segments: [[13, 16], [16, 13], [16, 16]], closed: true });
    case 'top_right':
      // Exclude bottom-left triangle
      return new paper.Path({ segments: [[3, 16], [0, 13], [0, 16]], closed: true });
    case 'bottom_left':
      // Exclude top-right triangle
      return new paper.Path({ segments: [[13, 0], [16, 3], [16, 0]], closed: true });
    case 'bottom_right':
      // Exclude top-left triangle
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
  clipPath.remove(); // Don't add to layer

  const extractedPaths: Record<string, number[] | number[][]> = {};

  // Debug: log state.drawing keys
  console.log(`[extractTileData] state.drawing keys:`, Object.keys(state.drawing));

  // Create 4 large rectangles around the tile for fallback subtraction clipping
  const largeSize = 10000;
  const subtractRects = [
    new paper.Path.Rectangle(new paper.Rectangle(-largeSize, -largeSize, largeSize + offsetX, largeSize * 2 + blockHeight)), // Left
    new paper.Path.Rectangle(new paper.Rectangle(offsetX + blockWidth, -largeSize, largeSize, largeSize * 2 + blockHeight)), // Right
    new paper.Path.Rectangle(new paper.Rectangle(-largeSize, -largeSize, largeSize * 2 + blockWidth, largeSize + offsetY)), // Top
    new paper.Path.Rectangle(new paper.Rectangle(-largeSize, offsetY + blockHeight, largeSize * 2 + blockWidth, largeSize)), // Bottom
  ];

  // Iterate through state.drawing (all terrain/path layers)
  Object.entries(state.drawing).forEach(([colorKey, pathItem]) => {
    if (pathItem) {
      const isCompound = !!(pathItem as paper.CompoundPath).children?.length;
      const pathArea = Math.abs((pathItem as paper.Path).area || 0);
      const pathBounds = pathItem.bounds;
      const intersectsTile = pathBounds.intersects(tileRect);
      console.log(`[extractTileData] Processing ${colorKey}: isCompound: ${isCompound}, area: ${pathArea.toFixed(2)}, bounds: [${pathBounds.x.toFixed(1)},${pathBounds.y.toFixed(1)},${pathBounds.width.toFixed(1)},${pathBounds.height.toFixed(1)}], intersectsTile: ${intersectsTile}`);

      try {
        // Use safe intersection that handles compound paths
        let clipped = safeCompoundIntersection(pathItem, clipPath);
        let clippedIsEmpty = clipped.isEmpty();
        let clippedArea = Math.abs((clipped as paper.Path).area || 0);
        const clippedIsCompound = !!(clipped as paper.CompoundPath)?.children?.length;

        console.log(`[extractTileData] ${colorKey} intersect result: isEmpty: ${clippedIsEmpty}, area: ${clippedArea.toFixed(2)}, isCompound: ${clippedIsCompound}`);

        // Fallback: use subtraction with surrounding rectangles if intersection still fails
        if (clippedIsEmpty && isCompound && intersectsTile) {
          console.warn(`[extractTileData] ${colorKey} using subtraction fallback for compound path`);
          clipped.remove();
          clipped = pathItem.clone() as paper.PathItem;
          for (const rect of subtractRects) {
            const subtracted = clipped.subtract(rect, { insert: false });
            clipped.remove();
            clipped = subtracted;
          }
          clippedIsEmpty = clipped.isEmpty();
          clippedArea = Math.abs((clipped as paper.Path).area || 0);
          console.log(`[extractTileData] ${colorKey} fallback result: isEmpty: ${clippedIsEmpty}, area: ${clippedArea.toFixed(2)}`);
        }

        if (!clipped.isEmpty()) {
          // Translate to origin (0,0) so data is position-independent
          clipped.translate(new paper.Point(-offsetX, -offsetY));
          // Encode the clipped path using color name for compatibility
          const colorName = colors[colorKey]?.name || colorKey;
          const encoded = encodePathItem(clipped);
          console.log(`[extractTileData] ${colorKey} encoded as '${colorName}', encodedLength: ${encoded.length}, isEncodedCompound: ${Array.isArray(encoded[0])}`);
          extractedPaths[colorName] = encoded;
          clipped.remove();
        } else {
          console.log(`[extractTileData] ${colorKey} skipped - clipped is empty`);
          clipped.remove();
        }
      } catch (e) {
        console.warn(`[extractTileData] Failed to clip path for ${colorKey}:`, e);
      }
    }
  });

  // Cleanup subtraction rectangles
  subtractRects.forEach(r => r.remove());

  console.log(`[extractTileData] Final extracted keys:`, Object.keys(extractedPaths));
  return extractedPaths;
}

function prepTileDataForExport(drawing: Record<string, number[] | number[][]>, direction: TileDirection) : Record<string, number[] | number[][]> {
  const grassColorNames = ['level1', 'level2', 'level3'];
  const result: Record<string, number[] | number[][]> = {};

  // Step 1: Collect and unite all grass paths using Paper.js unite()
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

  // Step 1.5: Unite exclusion zone with grass (so it gets subtracted from other layers)
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

  // Step 2: Create water layer (full tile rectangle)
  const waterRect = new paper.Path.Rectangle(
    new paper.Rectangle(0, 0, blockWidth, blockHeight)
  );

  // Step 3: Process layers
  // Water layer: subtract grass from water
  if (unitedGrass) {
    const waterMinusGrass = waterRect.subtract(unitedGrass, { insert: false });
    result['water'] = encodePathItem(waterMinusGrass);
    waterMinusGrass.remove();
  } else {
    result['water'] = encodePathItem(waterRect);
  }
  waterRect.remove();

  // Add merged grass as level1
  if (unitedGrass) {
    result['level1'] = encodePathItem(unitedGrass);
  }

  // Process non-grass layers: subtract grass from each
  console.log(`[prepTileDataForExport] Input keys:`, Object.keys(drawing));
  for (const [colorName, pathData] of Object.entries(drawing)) {
    if (grassColorNames.includes(colorName)) {
      continue; // Skip grass layers (already merged into level1)
    }

    if (!pathData || pathData.length === 0) {
      continue;
    }

    const isCompoundData = Array.isArray(pathData[0]);
    console.log(`[prepTileDataForExport] Processing ${colorName}, isCompoundData: ${isCompoundData}, pathData length: ${pathData.length}`);
    const layerPath = decodeToPathItem(pathData);
    const decodedIsCompound = !!(layerPath as paper.CompoundPath).children?.length;
    console.log(`[prepTileDataForExport] ${colorName} decoded, isCompound: ${decodedIsCompound}`);

    if (unitedGrass) {
      const subtracted = layerPath.subtract(unitedGrass, { insert: false });
      const subtractedIsCompound = !!(subtracted as paper.CompoundPath).children?.length;
      const subtractedIsEmpty = subtracted.isEmpty();
      console.log(`[prepTileDataForExport] ${colorName} after subtract: isCompound: ${subtractedIsCompound}, isEmpty: ${subtractedIsEmpty}`);
      result[colorName] = encodePathItem(subtracted);
      const resultIsCompound = Array.isArray(result[colorName][0]);
      console.log(`[prepTileDataForExport] ${colorName} encoded, resultIsCompound: ${resultIsCompound}, length: ${result[colorName]?.length || 0}`);
      subtracted.remove();
    } else {
      result[colorName] = pathData;
    }
    layerPath.remove();
  }
  console.log(`[prepTileDataForExport] Final result keys:`, Object.keys(result));

  // Clean up united grass path
  if (unitedGrass) {
    unitedGrass.remove();
  }

  return result;
}

function downloadTileData(data: object, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showPostfixDropdown(blockX: number, blockY: number, screenX: number, screenY: number): void {
  const positionName = getTilePositionName(blockX, blockY);
  const options = postfixOptions[positionName] || [];
  const dropdown = createDropdownContainer(screenX, screenY, `Export: ${positionName}`);

  // Base option (no postfix)
  dropdown.appendChild(createDropdownButton(positionName, () => {
    exportTile(blockX, blockY, positionName);
  }));

  // Postfix options
  options.forEach((postfix) => {
    const fullName = `${positionName}_${postfix}`;
    dropdown.appendChild(createDropdownButton(fullName, () => {
      exportTile(blockX, blockY, fullName);
    }));
  });

  // Cancel button
  dropdown.appendChild(createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isExtractModeActive) toggleExtractMode();
  }, true));

  showDropdown(dropdown);
}

function createDropdownButton(label: string, onClick: () => void, isCancel = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.cssText = `
    display: block;
    width: 100%;
    padding: 8px 16px;
    margin: 4px 0;
    background: ${isCancel ? '#e0ddd0' : '#83e1c3'};
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: TTNorms, sans-serif;
    font-size: 14px;
    color: #726a5a;
    transition: background 0.2s;
  `;
  button.onmouseenter = () => {
    button.style.background = isCancel ? '#d0cdc0' : '#70cfb6';
  };
  button.onmouseleave = () => {
    button.style.background = isCancel ? '#e0ddd0' : '#83e1c3';
  };
  button.onclick = onClick;
  return button;
}

function createDropdownContainer(screenX: number, screenY: number, title: string): HTMLDivElement {
  hidePostfixDropdown();

  const dropdown = document.createElement('div');
  dropdown.style.cssText = `
    position: fixed;
    left: ${screenX}px;
    top: ${screenY}px;
    background: #f5f3e5;
    border: 2px solid #726a5a;
    border-radius: 8px;
    padding: 8px;
    z-index: 10000;
    font-family: TTNorms, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;

  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  titleEl.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #726a5a;';
  dropdown.appendChild(titleEl);

  postfixDropdown = dropdown;
  return dropdown;
}

function showDropdown(dropdown: HTMLDivElement): void {
  document.body.appendChild(dropdown);
}

function hidePostfixDropdown(): void {
  if (postfixDropdown) {
    postfixDropdown.remove();
    postfixDropdown = null;
  }
}


function exportTile(blockX: number, blockY: number, filename: string): void {
  const data = extractTileData(blockX, blockY);
  downloadTileData(data, `${filename}.json`);
  hidePostfixDropdown();
  clearHighlight();
}

function highlightTile(blockX: number, blockY: number): void {
  clearHighlight();

  layers.mapOverlayLayer.activate();

  highlightRect = new paper.Path.Rectangle(
    new paper.Rectangle(
      blockX * blockWidth,
      blockY * blockHeight,
      blockWidth,
      blockHeight
    )
  );
  highlightRect.strokeColor = colors.selected.color;
  highlightRect.strokeWidth = 1;
  highlightRect.fillColor = colors.selected.color.clone();
  highlightRect.fillColor.alpha = 0.3;
}

function clearHighlight(): void {
  if (highlightRect) {
    highlightRect.remove();
    highlightRect = null;
  }
}

function handleMapClick(event: paper.MouseEvent): void {
  if (!isExtractModeActive) return;

  // Convert to map coordinates
  const mapPoint = layers.mapLayer.globalToLocal(event.point);

  // Calculate block coordinates
  const blockX = Math.floor(mapPoint.x / blockWidth);
  const blockY = Math.floor(mapPoint.y / blockHeight);

  // Check if it's an edge tile
  if (!isEdgeTile(blockX, blockY)) {
    console.log('Not an edge tile');
    return;
  }

  // Highlight the tile
  highlightTile(blockX, blockY);

  // Get screen coordinates for dropdown
  const viewPoint = paper.view.projectToView(event.point);
  const screenX = viewPoint.x + 20;
  const screenY = viewPoint.y;

  // Show postfix dropdown
  showPostfixDropdown(blockX, blockY, screenX, screenY);
}

function toggleExtractMode(): void {
  isExtractModeActive = !isExtractModeActive;
  toolState.isDevModeActive = isExtractModeActive;

  if (isExtractModeActive) {
    console.log('Tile extraction mode activated. Click an edge tile to export.');
    // Disable painting tools
    toolState.focusOnCanvas(false);
    // Add click handler
    paper.view.onClick = handleMapClick;
  } else {
    console.log('Tile extraction mode deactivated.');
    paper.view.onClick = null;
    hidePostfixDropdown();
    clearHighlight();
    // Re-enable painting tools
    toolState.focusOnCanvas(true);
  }

  // Update button appearance
  if (devToolsGroup) {
    const button = devToolsGroup.children[0] as paper.Group;
    if (button && button.data) {
      button.data.select(isExtractModeActive);
    }
  }
}

// ============ Load Mode Functions ============

function toggleLoadMode(): void {
  isLoadModeActive = !isLoadModeActive;
  toolState.isDevModeActive = isLoadModeActive;

  if (isLoadModeActive) {
    console.log('Tile load mode activated. Click a tile to load data into.');
    toolState.focusOnCanvas(false);
    paper.view.onClick = handleLoadModeClick;
  } else {
    console.log('Tile load mode deactivated.');
    paper.view.onClick = null;
    hidePostfixDropdown();
    clearHighlight();
    toolState.focusOnCanvas(true);
  }
}

function handleLoadModeClick(event: paper.MouseEvent): void {
  if (!isLoadModeActive) return;

  const mapPoint = layers.mapLayer.globalToLocal(event.point);
  const blockX = Math.floor(mapPoint.x / blockWidth);
  const blockY = Math.floor(mapPoint.y / blockHeight);

  // Allow any tile, not just edge tiles
  highlightTile(blockX, blockY);

  const viewPoint = paper.view.projectToView(event.point);
  showLoadDropdown(blockX, blockY, viewPoint.x + 20, viewPoint.y);
}

function showLoadDropdown(blockX: number, blockY: number, screenX: number, screenY: number): void {
  const dropdown = createDropdownContainer(screenX, screenY, `Load into tile (${blockX}, ${blockY})`);

  dropdown.appendChild(createDropdownButton('Load File...', () => {
    openFileDialog(blockX, blockY);
  }));

  dropdown.appendChild(createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isLoadModeActive) toggleLoadMode();
  }, true));

  showDropdown(dropdown);
}

function openFileDialog(blockX: number, blockY: number): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          loadTileData(blockX, blockY, json);
        } catch (err) {
          console.error('Failed to parse JSON:', err);
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();

  hidePostfixDropdown();
  clearHighlight();
  if (isLoadModeActive) {
    toggleLoadMode();
  }
}

function decodePathPoints(positionArray: number[]): paper.Point[] {
  const points: paper.Point[] = [];
  for (let i = 0; i < positionArray.length; i += 2) {
    points.push(new paper.Point(positionArray[i], positionArray[i + 1]));
  }
  return points;
}

function loadTileData(blockX: number, blockY: number, data: { version: number; drawing: Record<string, number[] | number[][]> }): void {
  const offsetX = blockX * blockWidth;
  const offsetY = blockY * blockHeight;

  layers.mapLayer.activate();

  const diff: Record<string, { isAdd: boolean; path: paper.PathItem }> = {};

  Object.entries(data.drawing).forEach(([colorName, pathData]) => {
    // Find the color key from the name
    const colorKey = Object.keys(colors).find(k => colors[k].name === colorName) || colorName;

    if (!pathData || (Array.isArray(pathData) && pathData.length === 0)) {
      return;
    }

    // Create path from data
    let loadedPath: paper.PathItem;
    if (typeof pathData[0] === 'number') {
      // Single path
      loadedPath = new paper.Path(decodePathPoints(pathData as number[]));
    } else {
      // Compound path
      loadedPath = new paper.CompoundPath({
        children: (pathData as number[][]).map(pd => new paper.Path(decodePathPoints(pd))),
      });
    }

    // Offset to tile position
    loadedPath.translate(new paper.Point(offsetX, offsetY));

    // Store in diff for undo (path geometry is preserved even after remove)
    diff[colorKey] = {
      isAdd: true,
      path: loadedPath,
    };

    // Apply the change using addPath (handles unite and layer order)
    addPath(true, loadedPath, colorKey);
  });

  // Add to history for undo support
  if (Object.keys(diff).length > 0) {
    addToHistory({ type: 'draw', data: diff });
  }

  console.log(`Loaded tile data at (${blockX}, ${blockY})`);
}

// ============ SVG Export Mode Functions ============

function toggleSvgExportMode(): void {
  isSvgExportModeActive = !isSvgExportModeActive;
  toolState.isDevModeActive = isSvgExportModeActive;

  if (isSvgExportModeActive) {
    console.log('SVG export mode activated. Click an edge tile to export.');
    toolState.focusOnCanvas(false);
    paper.view.onClick = handleSvgExportClick;
  } else {
    console.log('SVG export mode deactivated.');
    paper.view.onClick = null;
    hidePostfixDropdown();
    clearHighlight();
    toolState.focusOnCanvas(true);
  }
}

function handleSvgExportClick(event: paper.MouseEvent): void {
  if (!isSvgExportModeActive) return;

  const mapPoint = layers.mapLayer.globalToLocal(event.point);
  const blockX = Math.floor(mapPoint.x / blockWidth);
  const blockY = Math.floor(mapPoint.y / blockHeight);

  if (!isEdgeTile(blockX, blockY)) {
    console.log('Not an edge tile');
    return;
  }

  highlightTile(blockX, blockY);

  const viewPoint = paper.view.projectToView(event.point);
  showSvgExportDropdown(blockX, blockY, viewPoint.x + 20, viewPoint.y);
}

function showSvgExportDropdown(blockX: number, blockY: number, screenX: number, screenY: number): void {
  const positionName = getTilePositionName(blockX, blockY);
  const options = postfixOptions[positionName] || [];
  const dropdown = createDropdownContainer(screenX, screenY, `Export SVG: ${positionName}`);

  // Base option
  dropdown.appendChild(createDropdownButton(positionName, () => {
    exportTileSvg(blockX, blockY, positionName);
  }));

  // Postfix options
  options.forEach((postfix) => {
    const fullName = `${positionName}_${postfix}`;
    dropdown.appendChild(createDropdownButton(fullName, () => {
      exportTileSvg(blockX, blockY, fullName);
    }));
  });

  // Cancel button
  dropdown.appendChild(createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isSvgExportModeActive) toggleSvgExportMode();
  }, true));

  showDropdown(dropdown);
}

function tileToSvg(blockX: number, blockY: number): string {
  const data = extractTileData(blockX, blockY);
  const direction = getTileDirection(blockX, blockY);
  const preppedData = prepTileDataForExport(data, direction);
  return tileDataToSvg(preppedData);
}

function exportTileSvg(blockX: number, blockY: number, filename: string): void {
  const svg = tileToSvg(blockX, blockY);
  downloadSvg(svg, `${filename}.svg`);
  hidePostfixDropdown();
  clearHighlight();
  if (isSvgExportModeActive) {
    toggleSvgExportMode();
  }
}

function tileDataToSvg(drawing: Record<string, number[] | number[][]> ): string {
  // Data is already prepped by prepTileDataForExport: grass merged, water added, subtractions done
  console.log(`[tileDataToSvg] Input keys:`, Object.keys(drawing));
  const paths: string[] = [];

  Object.entries(drawing).forEach(([colorName, pathData]) => {
    const colorKey = Object.keys(colors).find(k => colors[k].name === colorName) || colorName;
    const color = colors[colorKey]?.cssColor || '#808080';
    const isCompound = Array.isArray(pathData[0]);
    console.log(`[tileDataToSvg] Processing ${colorName} -> colorKey: ${colorKey}, color: ${color}, isCompound: ${isCompound}, dataLength: ${pathData?.length}`);

    // Skip grass terrain - don't include in output
    if (colorKey == 'level1' || colorKey == 'level2' || colorKey == 'level3') {
      console.log(`[tileDataToSvg] Skipping grass layer: ${colorKey}`);
      return;
    }

    if (!pathData || (Array.isArray(pathData) && pathData.length === 0)) {
      console.log(`[tileDataToSvg] Skipping empty pathData for ${colorName}`);
      return;
    }

    if (typeof pathData[0] === 'number') {
      const d = coordsToSvgPath(pathData as number[]);
      console.log(`[tileDataToSvg] Added simple path for ${colorName} with color ${color}`);
      paths.push(`  <path d="${d}" fill="${color}" />`);
    } else {
      const subPaths = (pathData as number[][]).map(pd => coordsToSvgPath(pd)).join(' ');
      console.log(`[tileDataToSvg] Added compound path for ${colorName} with ${(pathData as number[][]).length} subpaths, color ${color}`);
      paths.push(`  <path d="${subPaths}" fill="${color}" />`);
    }
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${blockWidth} ${blockHeight}" width="${blockWidth * 10}" height="${blockHeight * 10}">
${paths.join('\n')}
</svg>`;
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

function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============ SVG Import Mode Functions ============

function toggleSvgImportMode(): void {
  isSvgImportModeActive = !isSvgImportModeActive;
  toolState.isDevModeActive = isSvgImportModeActive;

  if (isSvgImportModeActive) {
    console.log('SVG import mode activated. Click a tile to import SVG.');
    toolState.focusOnCanvas(false);
    paper.view.onClick = handleSvgImportClick;
  } else {
    console.log('SVG import mode deactivated.');
    paper.view.onClick = null;
    hidePostfixDropdown();
    clearHighlight();
    toolState.focusOnCanvas(true);
  }
}

function handleSvgImportClick(event: paper.MouseEvent): void {
  if (!isSvgImportModeActive) return;

  const mapPoint = layers.mapLayer.globalToLocal(event.point);
  const blockX = Math.floor(mapPoint.x / blockWidth);
  const blockY = Math.floor(mapPoint.y / blockHeight);

  highlightTile(blockX, blockY);

  const viewPoint = paper.view.projectToView(event.point);
  showSvgImportDropdown(blockX, blockY, viewPoint.x + 20, viewPoint.y);
}

function showSvgImportDropdown(blockX: number, blockY: number, screenX: number, screenY: number): void {
  const dropdown = createDropdownContainer(screenX, screenY, `Import SVG at (${blockX}, ${blockY})`);

  dropdown.appendChild(createDropdownButton('Select SVG File...', () => {
    openSvgFileDialog(blockX, blockY);
  }));

  dropdown.appendChild(createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isSvgImportModeActive) toggleSvgImportMode();
  }, true));

  showDropdown(dropdown);
}

function openSvgFileDialog(blockX: number, blockY: number): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.svg';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const svgContent = event.target?.result as string;
        importSvgAtTile(blockX, blockY, svgContent);
      };
      reader.readAsText(file);
    }
  };
  input.click();

  hidePostfixDropdown();
  clearHighlight();
  if (isSvgImportModeActive) toggleSvgImportMode();
}

function importSvgAtTile(blockX: number, blockY: number, svgContent: string): void {
  const offsetX = blockX * blockWidth;
  const offsetY = blockY * blockHeight;

  // Import SVG into the map overlay layer (not the drawing layer)
  layers.mapOverlayLayer.activate();

  // Use paper.project.importSVG to load the SVG
  paper.project.importSVG(svgContent, {
    onLoad: (item: paper.Item) => {
      // Scale to fit the tile size (exported SVG is 10x larger for display)
      const scaleX = blockWidth / item.bounds.width;
      const scaleY = blockHeight / item.bounds.height;
      item.scale(scaleX, scaleY, item.bounds.topLeft);

      // Position the top-left of the SVG at the tile location
      item.bounds.topLeft = new paper.Point(offsetX, offsetY);

      console.log(`Imported SVG at tile (${blockX}, ${blockY})`);
    },
    onError: (message: string) => {
      console.error('Failed to import SVG:', message);
    }
  });
}

// ============ SVG to Terrain Mode Functions ============

function toggleSvgToTerrainMode(): void {
  isSvgToTerrainModeActive = !isSvgToTerrainModeActive;
  toolState.isDevModeActive = isSvgToTerrainModeActive;

  if (isSvgToTerrainModeActive) {
    console.log('SVG to terrain mode activated. Click a tile to import.');
    toolState.focusOnCanvas(false);
    paper.view.onClick = handleSvgToTerrainClick;
  } else {
    console.log('SVG to terrain mode deactivated.');
    paper.view.onClick = null;
    hidePostfixDropdown();
    clearHighlight();
    toolState.focusOnCanvas(true);
  }
}

function handleSvgToTerrainClick(event: paper.MouseEvent): void {
  if (!isSvgToTerrainModeActive) return;

  const mapPoint = layers.mapLayer.globalToLocal(event.point);
  const blockX = Math.floor(mapPoint.x / blockWidth);
  const blockY = Math.floor(mapPoint.y / blockHeight);

  highlightTile(blockX, blockY);

  const viewPoint = paper.view.projectToView(event.point);
  showSvgToTerrainDropdown(blockX, blockY, viewPoint.x + 20, viewPoint.y);
}

function showSvgToTerrainDropdown(blockX: number, blockY: number, screenX: number, screenY: number): void {
  const dropdown = createDropdownContainer(screenX, screenY, `Import SVG to terrain at (${blockX}, ${blockY})`);

  dropdown.appendChild(createDropdownButton('Select SVG File...', () => {
    openSvgForTerrain(blockX, blockY);
  }));

  dropdown.appendChild(createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isSvgToTerrainModeActive) toggleSvgToTerrainMode();
  }, true));

  showDropdown(dropdown);
}

function openSvgForTerrain(blockX: number, blockY: number): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.svg';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const svgContent = event.target?.result as string;
        importSvgToTerrain(blockX, blockY, svgContent);
      };
      reader.readAsText(file);
    }
  };
  input.click();

  hidePostfixDropdown();
  clearHighlight();
  if (isSvgToTerrainModeActive) toggleSvgToTerrainMode();
}

function importSvgToTerrain(blockX: number, blockY: number, svgContent: string): void {
  const offsetX = blockX * blockWidth;
  const offsetY = blockY * blockHeight;

  // Water color to skip
  const waterColor = colors.water.cssColor.toLowerCase();

  // Parse SVG using Paper.js
  paper.project.importSVG(svgContent, {
    insert: false,
    onLoad: (item: paper.Item) => {
      layers.mapLayer.activate();

      const diff: Record<string, { isAdd: boolean; path: paper.PathItem }> = {};

      // First, clear existing terrain in this tile
      const tileRect = new paper.Path.Rectangle(
        new paper.Rectangle(offsetX, offsetY, blockWidth, blockHeight)
      );

      // Subtract tile area from all existing terrain layers
      Object.keys(state.drawing).forEach((colorKey) => {
        const clearPath = tileRect.clone() as paper.Path;
        addPath(false, clearPath, colorKey);
      });

      tileRect.remove();

      // Scale factor (exported SVGs are 10x larger)
      const scaleX = blockWidth / item.bounds.width;
      const scaleY = blockHeight / item.bounds.height;

      // Find all paths in the SVG
      const paths = item.getItems({ class: paper.Path }) as paper.Path[];
      const compoundPaths = item.getItems({ class: paper.CompoundPath }) as paper.CompoundPath[];

      const allPathItems: paper.PathItem[] = [...paths, ...compoundPaths];

      allPathItems.forEach((pathItem) => {
        // Get fill color
        const fillColor = pathItem.fillColor;
        if (!fillColor) return;

        const colorHex = fillColor.toCSS(true).toLowerCase();

        // Skip water color
        if (colorHex === waterColor) return;

        // Find matching terrain color key
        const colorKey = Object.keys(colors).find(k =>
          colors[k].cssColor.toLowerCase() === colorHex
        );

        if (!colorKey) {
          console.warn(`Unknown color in SVG: ${colorHex}`);
          return;
        }

        // Clone and transform the path
        const clonedPath = pathItem.clone() as paper.PathItem;
        clonedPath.scale(scaleX, scaleY, item.bounds.topLeft);
        clonedPath.translate(new paper.Point(offsetX, offsetY));

        // Track for undo
        diff[colorKey] = {
          isAdd: true,
          path: clonedPath,
        };

        // Add to terrain
        addPath(true, clonedPath, colorKey);
      });

      // Add to history for undo
      if (Object.keys(diff).length > 0) {
        addToHistory({ type: 'draw', data: diff });
      }

      // Clean up imported SVG item
      item.remove();

      console.log(`Imported SVG to terrain at (${blockX}, ${blockY})`);
    },
    onError: (message: string) => {
      console.error('Failed to import SVG:', message);
    }
  });
}

// ============ SVG Export From File Mode Functions ============

function toggleSvgExportFromFileMode(): void {
  isSvgExportFromFileModeActive = !isSvgExportFromFileModeActive;
  toolState.isDevModeActive = isSvgExportFromFileModeActive;

  if (isSvgExportFromFileModeActive) {
    console.log('SVG export (from file) mode activated. Click an edge tile.');
    toolState.focusOnCanvas(false);
    paper.view.onClick = handleSvgExportFromFileClick;
  } else {
    console.log('SVG export (from file) mode deactivated.');
    paper.view.onClick = null;
    hidePostfixDropdown();
    clearHighlight();
    toolState.focusOnCanvas(true);
  }
}

function handleSvgExportFromFileClick(event: paper.MouseEvent): void {
  if (!isSvgExportFromFileModeActive) return;

  const mapPoint = layers.mapLayer.globalToLocal(event.point);
  const blockX = Math.floor(mapPoint.x / blockWidth);
  const blockY = Math.floor(mapPoint.y / blockHeight);

  if (!isEdgeTile(blockX, blockY)) {
    console.log('Not an edge tile');
    return;
  }

  highlightTile(blockX, blockY);

  const viewPoint = paper.view.projectToView(event.point);
  showSvgExportFromFileDropdown(blockX, blockY, viewPoint.x + 20, viewPoint.y);
}

function showSvgExportFromFileDropdown(blockX: number, blockY: number, screenX: number, screenY: number): void {
  const dropdown = createDropdownContainer(screenX, screenY, `Export SVG from tile (${blockX}, ${blockY})`);

  dropdown.appendChild(createDropdownButton('Select Reference File...', () => {
    openReferenceFileDialog(blockX, blockY);
  }));

  dropdown.appendChild(createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isSvgExportFromFileModeActive) toggleSvgExportFromFileMode();
  }, true));

  showDropdown(dropdown);
}

function openReferenceFileDialog(blockX: number, blockY: number): void {
  const input = document.createElement('input');
  input.type = 'file';
  // Accept any file type
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      // Get filename without extension
      const filename = file.name.replace(/\.[^/.]+$/, '');
      // Export the tile SVG with this filename
      exportTileSvg(blockX, blockY, filename);
    }
  };
  input.click();

  hidePostfixDropdown();
  clearHighlight();
  if (isSvgExportFromFileModeActive) toggleSvgExportFromFileMode();
}

// ============ Visible Portions Export Mode Functions ============

function visiblePortionsToDrawingData(portions: VisiblePortions): Record<string, number[] | number[][]> {
  const result: Record<string, number[] | number[][]> = {};
  const layerOrder: (keyof VisiblePortions)[] = ['rock', 'sand', 'water'];

  // Paper.js importSVG scales paths by width/height vs viewBox ratio (160/16 = 10x)
  // Scale down to get back to original 16x16 coordinate system
  const scaleFactor = 1 / 10;

  for (const colorKey of layerOrder) {
    const portion = portions[colorKey];
    if (!portion || portion.isEmpty()) continue;

    // Clone and scale down before encoding
    const scaled = portion.clone() as paper.PathItem;
    scaled.scale(scaleFactor, new paper.Point(0, 0));

    // Use the color name that tileDataToSvg expects
    const colorName = colors[colorKey]?.name || colorKey;
    result[colorName] = encodePathItem(scaled);

    scaled.remove();
  }

  return result;
}

function toggleVisiblePortionsExportMode(): void {
  isVisiblePortionsExportModeActive = !isVisiblePortionsExportModeActive;
  toolState.isDevModeActive = isVisiblePortionsExportModeActive;

  if (isVisiblePortionsExportModeActive) {
    console.log('Visible portions export mode activated. Click an edge tile.');
    toolState.focusOnCanvas(false);
    paper.view.onClick = handleVisiblePortionsExportClick;
  } else {
    console.log('Visible portions export mode deactivated.');
    paper.view.onClick = null;
    hidePostfixDropdown();
    clearHighlight();
    toolState.focusOnCanvas(true);
  }
}

function handleVisiblePortionsExportClick(event: paper.MouseEvent): void {
  if (!isVisiblePortionsExportModeActive) return;

  const mapPoint = layers.mapLayer.globalToLocal(event.point);
  const blockX = Math.floor(mapPoint.x / blockWidth);
  const blockY = Math.floor(mapPoint.y / blockHeight);

  if (!isEdgeTile(blockX, blockY)) {
    console.log('Not an edge tile');
    return;
  }

  highlightTile(blockX, blockY);

  const viewPoint = paper.view.projectToView(event.point);
  showVisiblePortionsExportDropdown(blockX, blockY, viewPoint.x + 20, viewPoint.y);
}

function showVisiblePortionsExportDropdown(blockX: number, blockY: number, screenX: number, screenY: number): void {
  const positionName = getTilePositionName(blockX, blockY);
  const options = postfixOptions[positionName] || [];
  const dropdown = createDropdownContainer(screenX, screenY, `Export Visible Portions: ${positionName}`);

  // Base option
  dropdown.appendChild(createDropdownButton(positionName, () => {
    exportVisiblePortionsSvg(blockX, blockY, positionName);
  }));

  // Postfix options
  options.forEach((postfix) => {
    const fullName = `${positionName}_${postfix}`;
    dropdown.appendChild(createDropdownButton(fullName, () => {
      exportVisiblePortionsSvg(blockX, blockY, fullName);
    }));
  });

  // Cancel button
  dropdown.appendChild(createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isVisiblePortionsExportModeActive) toggleVisiblePortionsExportMode();
  }, true));

  showDropdown(dropdown);
}

function exportVisiblePortionsSvg(blockX: number, blockY: number, filename: string): void {
  // Extract tile data and convert to SVG string first
  const extractedSvg = tileToSvg(blockX, blockY);

  // Compute visible portions from the SVG
  const portions = computeVisiblePortions(extractedSvg);

  // Convert to drawing data format and then to SVG using shared function
  const drawingData = visiblePortionsToDrawingData(portions);
  const svg = tileDataToSvg(drawingData);

  // Cleanup portions
  Object.values(portions).forEach(p => p?.remove());

  // Download
  downloadSvg(svg, `${filename}.svg`);
  hidePostfixDropdown();
  clearHighlight();
  if (isVisiblePortionsExportModeActive) toggleVisiblePortionsExportMode();
}

// ============ Tile Tracer Mode Functions ============

function toggleTileTracerMode(): void {
  isTileTracerModeActive = !isTileTracerModeActive;
  // Note: Don't set toolState.isDevModeActive - allow drawing!

  if (isTileTracerModeActive) {
    console.log('Tile tracer mode activated.');
    loadTileTracerImage(tileTracerImageIndex);
    showTileTracerButtons();
  } else {
    console.log('Tile tracer mode deactivated.');
    hideTileTracerImage();
    hideTileTracerButtons();
  }
}

function loadTileTracerImage(index: number): void {
  hideTileTracerImage();

  if (index < 0 || index >= assetIndices.length) return;

  layers.mapOverlayLayer.activate();

  const assetIndex = assetIndices[index];
  const assetData = assetIndexToData.get(assetIndex);
  if (!assetData) return;

  tileTracerRaster = new paper.Raster(assetData.imageSrc);

  // Position at center of top-left block (0,0)
  const x = blockWidth / 2;
  const y = blockHeight / 2;

  tileTracerRaster.onLoad = () => {
    if (tileTracerRaster) {
      const targetSize = 16;
      const scaleX = targetSize / tileTracerRaster.width;
      const scaleY = targetSize / tileTracerRaster.height;
      tileTracerRaster.scaling = new paper.Point(scaleX, scaleY);
    }
  };

  tileTracerRaster.position = new paper.Point(x, y);
  tileTracerRaster.opacity = 0.5;  // 50% opacity
  tileTracerRaster.locked = true;  // Make untargetable
  tileTracerRaster.sendToBack();

  updateTileTracerTitle();
}

function hideTileTracerImage(): void {
  if (tileTracerRaster) {
    tileTracerRaster.remove();
    tileTracerRaster = null;
  }
}

function showTileTracerButtons(): void {
  hideTileTracerButtons();

  tileTracerButtons = document.createElement('div');
  tileTracerButtons.style.cssText = `
    position: fixed;
    left: 20px;
    bottom: 20px;
    background: #f5f3e5;
    border: 2px solid #726a5a;
    border-radius: 8px;
    padding: 8px;
    z-index: 10000;
    font-family: TTNorms, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;

  // Title showing current image
  const title = document.createElement('div');
  title.id = 'tile-tracer-title';
  title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #726a5a; font-size: 12px;';
  title.textContent = getImageDisplayName(tileTracerImageIndex);
  tileTracerButtons.appendChild(title);

  // Button container
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display: flex; gap: 4px;';

  // Left button
  const leftBtn = createDropdownButton('←', () => {
    tileTracerImageIndex = (tileTracerImageIndex - 1 + assetIndices.length) % assetIndices.length;
    loadTileTracerImage(tileTracerImageIndex);
  });
  leftBtn.style.width = '40px';
  buttonRow.appendChild(leftBtn);

  // Save button
  const saveBtn = createDropdownButton('Save', () => {
    saveTileTracerSvg();
  });
  buttonRow.appendChild(saveBtn);

  // Right button
  const rightBtn = createDropdownButton('→', () => {
    tileTracerImageIndex = (tileTracerImageIndex + 1) % assetIndices.length;
    loadTileTracerImage(tileTracerImageIndex);
  });
  rightBtn.style.width = '40px';
  buttonRow.appendChild(rightBtn);

  tileTracerButtons.appendChild(buttonRow);

  // Close button
  const closeBtn = createDropdownButton('Close', () => {
    toggleTileTracerMode();
  }, true);
  closeBtn.style.marginTop = '4px';
  tileTracerButtons.appendChild(closeBtn);

  document.body.appendChild(tileTracerButtons);
}

function hideTileTracerButtons(): void {
  if (tileTracerButtons) {
    tileTracerButtons.remove();
    tileTracerButtons = null;
  }
}

function updateTileTracerTitle(): void {
  const title = document.getElementById('tile-tracer-title');
  if (title) {
    title.textContent = `${tileTracerImageIndex + 1}/${assetIndices.length}: ${getImageDisplayName(tileTracerImageIndex)}`;
  }
}

function getImageDisplayName(index: number): string {
  const assetIndex = assetIndices[index];
  const assetData = assetIndexToData.get(assetIndex);
  if (!assetData) return `[${assetIndex}] unknown`;
  // Extract filename without extension from SVG path
  const filename = assetData.imageSrc.split('/').pop() || assetData.imageSrc;
  return `[${assetIndex}] ${filename.replace(/\.[^/.]+$/, '')}`;
}

function saveTileTracerSvg(): void {
  const filename = getImageDisplayName(tileTracerImageIndex);
  // Export tile at (0, 0) - top-left
  exportTileSvg(0, 0, filename);
}

// ============ Layout Navigator Functions ============

// Flatten all layouts into a single array for navigation
function getAllLayouts(): { category: string; layout: Layout; index: number }[] {
  const all: { category: string; layout: Layout; index: number }[] = [];

  // Layouts.blank.forEach((l, i) => all.push({ category: 'blank', layout: l, index: i }));
  Layouts.west.forEach((l, i) => all.push({ category: 'west', layout: l, index: i }));
  Layouts.south.forEach((l, i) => all.push({ category: 'south', layout: l, index: i }));
  Layouts.east.forEach((l, i) => all.push({ category: 'east', layout: l, index: i }));

  return all;
}

function toggleLayoutNavigator(): void {
  isLayoutNavigatorActive = !isLayoutNavigatorActive;

  if (isLayoutNavigatorActive) {
    showLayoutNavigatorButtons();
    loadLayoutAtIndex(layoutNavigatorIndex);
  } else {
    hideLayoutNavigatorButtons();
  }
}

function showLayoutNavigatorButtons(): void {
  if (layoutNavigatorButtons) return;

  layoutNavigatorButtons = document.createElement('div');
  layoutNavigatorButtons.style.cssText = `
    position: fixed;
    left: 20px;
    bottom: 20px;
    background: #f5f3e5;
    border: 2px solid #726a5a;
    border-radius: 8px;
    padding: 8px;
    z-index: 10000;
    font-family: TTNorms, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;

  // Title showing current layout
  const title = document.createElement('div');
  title.id = 'layout-navigator-title';
  title.style.cssText = 'text-align: center; margin-bottom: 8px; font-size: 12px; color: #726a5a;';
  layoutNavigatorButtons.appendChild(title);

  // Button row
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display: flex; gap: 4px;';

  const allLayouts = getAllLayouts();

  // Left arrow
  const leftBtn = createDropdownButton('←', () => {
    layoutNavigatorIndex = (layoutNavigatorIndex - 1 + allLayouts.length) % allLayouts.length;
    loadLayoutAtIndex(layoutNavigatorIndex);
    updateLayoutNavigatorTitle();
  });
  leftBtn.style.width = '40px';
  buttonRow.appendChild(leftBtn);

  // Right arrow
  const rightBtn = createDropdownButton('→', () => {
    layoutNavigatorIndex = (layoutNavigatorIndex + 1) % allLayouts.length;
    loadLayoutAtIndex(layoutNavigatorIndex);
    updateLayoutNavigatorTitle();
  });
  rightBtn.style.width = '40px';
  buttonRow.appendChild(rightBtn);

  layoutNavigatorButtons.appendChild(buttonRow);

  // Close button
  const closeBtn = createDropdownButton('Close', () => {
    toggleLayoutNavigator();
  }, true);  // true = cancel style
  closeBtn.style.marginTop = '4px';
  closeBtn.style.width = '100%';
  layoutNavigatorButtons.appendChild(closeBtn);

  document.body.appendChild(layoutNavigatorButtons);
  updateLayoutNavigatorTitle();
}

function hideLayoutNavigatorButtons(): void {
  if (layoutNavigatorButtons) {
    layoutNavigatorButtons.remove();
    layoutNavigatorButtons = null;
  }
}

function updateLayoutNavigatorTitle(): void {
  const title = document.getElementById('layout-navigator-title');
  if (!title) return;

  const allLayouts = getAllLayouts();
  const current = allLayouts[layoutNavigatorIndex];
  title.textContent = `${layoutNavigatorIndex + 1}/${allLayouts.length}: ${current.category}/${current.layout.name}`;
}

function loadLayoutAtIndex(index: number): void {
  const allLayouts = getAllLayouts();
  if (index < 0 || index >= allLayouts.length) return;

  const { layout } = allLayouts[index];
  loadMapFromJSONString(layout.data);
}

function toggleEdgeTileLayerVisibility(): void {
  layers.mapEdgeLayer.visible = !layers.mapEdgeLayer.visible;
  console.log(`Edge tile layer visibility: ${layers.mapEdgeLayer.visible}`);
}

function toggleMenu(): void {
  isMenuOpen = !isMenuOpen;

  if (isMenuOpen) {
    showDevMenu();
  } else {
    hideDevMenu();
  }

  // Update main button appearance
  if (devToolsGroup) {
    const button = devToolsGroup.children[0] as paper.Group;
    if (button && button.data) {
      button.data.select(isMenuOpen);
    }
  }
}

// ============ V1 to V2 Conversion Functions ============

type VisiblePortions = {
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

function computeVisiblePortions(svgContent: string): VisiblePortions {
  const layerOrder = ['rock', 'sand', 'water'];
  const item = paper.project.importSVG(svgContent, { insert: false });

  if (!item) return { rock: null, sand: null, water: null };

  const paths = item.getItems({ class: paper.Path }) as paper.Path[];
  const compoundPaths = item.getItems({ class: paper.CompoundPath }) as paper.CompoundPath[];
  const result: VisiblePortions = { rock: null, sand: null, water: null };

  // // Debug logging
  // console.log(`[computeVisiblePortions] Found ${paths.length} paths, ${compoundPaths.length} compound paths`);
  // paths.forEach((p, i) => {
  //   console.log(`  Path ${i}: color=${p.fillColor?.toCSS(true)}, area=${Math.abs(p.area || 0).toFixed(2)}`);
  // });
  // compoundPaths.forEach((p, i) => {
  //   console.log(`  CompoundPath ${i}: color=${p.fillColor?.toCSS(true)}`);
  // });

  // Find path by color key helper - searches both paths and compound paths
  const findPathByColorKey = (colorKey: string): paper.PathItem | null => {
    const cssColor = colors[colorKey]?.cssColor;
    if (!cssColor) return null;
    const targetColor = cssColor.toLowerCase();

    // Check simple paths first
    const simplePath = paths.find(p => p.fillColor?.toCSS(true).toLowerCase() === targetColor);
    if (simplePath) return simplePath;

    // Check compound paths
    const compoundPath = compoundPaths.find(cp => cp.fillColor?.toCSS(true).toLowerCase() === targetColor);
    if (compoundPath) return compoundPath;

    return null;
  };

  // // Log what was found for each layer
  // for (const colorKey of layerOrder) {
  //   const expectedColor = colors[colorKey]?.cssColor;
  //   const found = findPathByColorKey(colorKey);
  //   console.log(`  Looking for ${colorKey} (${expectedColor}): ${found ? 'FOUND' : 'NOT FOUND'}`);
  // }

  // Compute visible portion for each layer
  for (let i = 0; i < layerOrder.length; i++) {
    const colorKey = layerOrder[i];
    const path = findPathByColorKey(colorKey);
    if (!path) continue;

    let visible: paper.PathItem = path.clone() as paper.PathItem;

    // Subtract all layers above
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

  // Iterate over all non-placeholder tiles (indices 1-83)
  for (const [index, data] of assetIndexToData) {
    // imageSrc is already an SVG path (e.g., 'static/tiles_data/1 - ISdNX8N.svg')
    const svgPath = data.imageSrc;

    // Try cached SVG content first
    const cachedSvg = getCachedSvgContent(svgPath);
    if (cachedSvg) {
      const visiblePortions = computeVisiblePortions(cachedSvg);
      library.set(index, {
        assetIndex: index,
        direction: data.direction,
        svgContent: cachedSvg,
        visiblePortions,
      });
      continue;
    }

    // Fall back to fetching if not cached
    try {
      const response = await fetch(svgPath);
      if (!response.ok) {
        console.warn(`Failed to load SVG for asset ${index}: ${svgPath}`);
        continue;
      }

      const svgContent = await response.text();
      const visiblePortions = computeVisiblePortions(svgContent);
      library.set(index, {
        assetIndex: index,
        direction: data.direction,
        svgContent,
        visiblePortions,
      });
    } catch (e) {
      console.warn(`Error loading SVG for asset ${index}:`, e);
    }
  }

  console.log(`Loaded ${library.size} of ${assetIndexToData.size} SVG references`);
  return library;
}

function compareVisiblePortions(
  extractedPortions: VisiblePortions,
  referencePortions: VisiblePortions,
  debugCcwIndex?: number
): number {
  const layerOrder: (keyof VisiblePortions)[] = ['rock', 'sand', 'water'];

  let totalArea = 0;
  let matchingArea = 0;

  // Check which colors are present in each
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

    // Debug logging for CCW index 0
    if (debugCcwIndex === 0) {
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

  // Base similarity score
  let score = totalArea > 0 ? matchingArea / totalArea : 0;

  // Apply slight boost (5%) when color sets match exactly
  if (colorSetsMatch && score > 0) {
    score = Math.min(1.0, score * 1.05);
  }

  return score;
}

// function findBestMatchingAsset(
//   extractedSvg: string,
//   direction: TileDirection,
//   svgLibrary: Map<number, SvgAssetData>
// ): { index: number; score: number } | null {
//   let bestIndex: number | null = null;
//   let bestScore = 0;

//   for (const [index, assetData] of svgLibrary) {
//     // Only compare tiles with matching direction
//     if (assetData.direction !== direction) continue;

//     const score = computeSvgSimilarity(extractedSvg, assetData.svgContent);

//     if (score > bestScore) {
//       bestScore = score;
//       bestIndex = index;
//     }
//   }

//   // Require minimum 70% match
//   if (bestIndex !== null && bestScore >= 0.7) {
//     return { index: bestIndex, score: bestScore };
//   }
//   return null;
// }

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

  console.log('Merged sand and rock into level1');
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

  // Colors to extract (non-grass, non-transparent)
  const colorsToExtract = ['water', 'sand', 'rock'];

  for (let i = 0; i < edgeTiles.length; i++) {
    const assetIndex = edgeTiles[i];
    const [blockX, blockY] = ccwPositions[i];

    // Get cached SVG data
    const assetData = svgLibrary.get(assetIndex);
    if (!assetData) continue;

    // Import SVG and extract paths
    const item = paper.project.importSVG(assetData.svgContent, { insert: false });
    if (!item) continue;

    const paths = item.getItems({ class: paper.Path }) as paper.Path[];
    const compoundPaths = item.getItems({ class: paper.CompoundPath }) as paper.CompoundPath[];

    // Find and union paths matching our target colors
    for (const colorKey of colorsToExtract) {
      const targetColor = colors[colorKey]?.cssColor?.toLowerCase();
      if (!targetColor) continue;

      const allPaths = [...paths, ...compoundPaths];
      for (const p of allPaths) {
        if (p.fillColor?.toCSS(true).toLowerCase() === targetColor) {
          const cloned = p.clone() as paper.PathItem;
          // Scale from SVG coords (160x160) to block coords (16x16)
          cloned.scale(1/10, new paper.Point(0, 0));
          // Translate to block position
          cloned.translate(new paper.Point(blockX * blockWidth, blockY * blockHeight));
          // Union to level1
          const newLevel1 = level1Path.unite(cloned, { insert: false });
          level1Path.remove();
          cloned.remove();
          level1Path = newLevel1;
        }
      }
    }

    item.remove();
  }

  // Update level1 in state
  level1Path.locked = true;
  level1Path.fillColor = colors.level1.color;

  if (state.drawing['level1']) {
    level1Path.insertAbove(state.drawing['level1']);
    state.drawing['level1'].remove();
  }
  state.drawing['level1'] = level1Path;

  console.log('Unioned edge tile terrain to level1');
}

// Find airport object position from state.objects
// Returns both block coordinates and raw position (for determining which block boundary)
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

// Find dock object position from state.objects
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

// Convert block position to CCW index (for bottom edge only, where airport/dock are)
function blockToCcwIndex(blockX: number, blockY: number): number | null {
  // CCW positions array for reference:
  // Bottom edge: [1,5]=5, [2,5]=6, [3,5]=7, [4,5]=8, [5,5]=9
  // Bottom-left corner: [0,5]=4
  // Bottom-right corner: [6,5]=10
  if (blockY === 5) {  // Bottom row
    if (blockX === 0) return 4;      // bottom-left corner
    if (blockX === 6) return 10;     // bottom-right corner
    if (blockX >= 1 && blockX <= 5) return blockX + 4;  // bottom edge
  }
  return null;
}

// Diagnostic data returned from conversion
type EdgeTileDiagnostic = { ccwIndex: number; assetIndex: number; score: number };
type ConversionDiagnostic = {
  riverDirection: string;
  riverScore: number;
  edgeTiles: EdgeTileDiagnostic[];
  isValid: boolean;
  hasLowConfidence: boolean;
};

async function convertV1ToV2(): Promise<ConversionDiagnostic> {
  console.log('Starting V1 to V2 conversion...');

  // Diagnostic data to collect
  const diagnosticTiles: EdgeTileDiagnostic[] = [];

  // Build SVG reference library
  const svgLibrary = await buildSvgReferenceLibrary();
  console.log(`Loaded ${svgLibrary.size} SVG references`);

  // CCW edge tile positions (24 total)
  const ccwPositions: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [0, 4],  // Left edge (indices 0-3)
    [0, 5],                          // Bottom-left corner (index 4)
    [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],  // Bottom edge (indices 5-9)
    [6, 5],                          // Bottom-right corner (index 10)
    [6, 4], [6, 3], [6, 2], [6, 1],  // Right edge (indices 11-14)
    [6, 0],                          // Top-right corner (index 15)
    [5, 0], [4, 0], [3, 0], [2, 0], [1, 0],  // Top edge (indices 16-20)
    [0, 0],                          // Top-left corner (index 21)
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

    // Pre-compute visible portions for this extracted tile (once per tile, not per comparison)
    const extractedPortions = computeVisiblePortions(extractedSvg);

    // Debug logging for CCW index 0
    if (i === 0) {
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
        const debugIndex = i === 0 ? 0 : undefined;
        scores.set(assetIndex, compareVisiblePortions(extractedPortions, assetData.visiblePortions, debugIndex));
      }
    }

    // Cleanup extracted portions
    Object.values(extractedPortions).forEach(p => p?.remove());

    // Verbose logging: format scores as { assetIndex: percentage, ... }
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

    positionScores.push({ x, y, ccwIndex: i, direction, scores });
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
    console.warn('Could not detect river direction - island may be invalid');
    isValid = false;
    detectedDirection = 'west'; // fallback
  } else {
    console.log(`Detected river direction: ${detectedDirection} (score: ${(bestDirectionScore * 100).toFixed(1)}%)`);
  }

  // Step 3: Apply constrained tile selection
  const assignedTiles: Map<number, number> = new Map();
  const usedPositions = new Set<number>();

  // Helper to find best asset for a position
  function getBestAsset(ccwIdx: number, assetIndices: number[]): { asset: number; score: number } | null {
    const pos = positionScores[ccwIdx];
    let best: { asset: number; score: number } | null = null;
    let tieCount = 0;

    for (const asset of assetIndices) {
      const score = pos.scores.get(asset) ?? 0;
      if (!best || score > best.score) {
        best = { asset, score };
        tieCount = 1;
      } else if (best && score === best.score && score > 0) {
        tieCount++;
      }
    }

    if (tieCount > 1 && best) {
      console.log(`Tie at position (${pos.x},${pos.y}) for ${tieCount} assets with score ${(best.score * 100).toFixed(1)}%, choosing first`);
    }

    return best;
  }

  // 1. RIVER MOUTHS (exactly 2, based on detected direction)
  const riverConfig = riverConfigs[detectedDirection];
  const river1 = getBestAsset(riverConfig.river1Idx, riverConfig.river1Assets);
  const river2 = getBestAsset(riverConfig.river2Idx, riverConfig.river2Assets);

  if (river1 && river1.score >= 0.7) {
    assignedTiles.set(riverConfig.river1Idx, river1.asset);
    usedPositions.add(riverConfig.river1Idx);
    console.log(`River 1 at CCW ${riverConfig.river1Idx}: asset ${river1.asset} (score: ${(river1.score * 100).toFixed(1)}%)`);
  }
  if (river2 && river2.score >= 0.7) {
    assignedTiles.set(riverConfig.river2Idx, river2.asset);
    usedPositions.add(riverConfig.river2Idx);
    console.log(`River 2 at CCW ${riverConfig.river2Idx}: asset ${river2.asset} (score: ${(river2.score * 100).toFixed(1)}%)`);
  }

  // 2. AIRPORT (exactly 2 adjacent, based on river direction)
  // First, check if airport object exists - use as strong signal
  const airportObjectPos = findAirportObjectPosition();
  let airportFromObject = false;

  if (airportObjectPos && airportObjectPos.blockY === 5) {
    // Airport object is placed BETWEEN the two blocks it spans
    // Determine which block boundary the airport straddles based on x position
    // The boundary between blocks N and N+1 is at x = (N+1) * blockWidth
    const nearestBoundaryBlock = Math.round(airportObjectPos.posX / blockWidth);
    // Airport spans blocks (nearestBoundaryBlock - 1) and nearestBoundaryBlock
    let startBlockX = nearestBoundaryBlock - 1;

    // Clamp to valid bottom edge range (blocks 1-4 can be start of airport)
    startBlockX = Math.max(1, Math.min(startBlockX, 4));
    const startIdx = startBlockX + 4;  // Convert to CCW index (block 1 = CCW 5, etc.)

    if (!usedPositions.has(startIdx) && !usedPositions.has(startIdx + 1)) {
      assignedTiles.set(startIdx, 34);
      assignedTiles.set(startIdx + 1, 35);
      usedPositions.add(startIdx);
      usedPositions.add(startIdx + 1);
      console.log(`Airport from object at CCW ${startIdx}-${startIdx + 1}: assets 34, 35`);
      airportFromObject = true;
    }
  }

  // Fall back to terrain matching if no object found
  if (!airportFromObject) {
    const airportOptions: { blocks: number[] }[] =
      detectedDirection === 'west' ? [{ blocks: [5, 6] }, { blocks: [6, 7] }] :
      detectedDirection === 'east' ? [{ blocks: [7, 8] }, { blocks: [8, 9] }] :
      [{ blocks: [6, 7] }, { blocks: [7, 8] }]; // south

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
      console.log(`Airport at CCW ${bestAirport.startIdx}-${bestAirport.startIdx + 1}: assets 34, 35 (score: ${(bestAirport.score * 100).toFixed(1)}%)`);
    } else {
      console.log('Airport detection failed');
      isValid = false;
    }
  }

  // 3. DOCK (exactly 1, based on river direction)
  // First, check if dock object exists - use as strong signal
  const dockObjectPos = findDockObjectPosition();
  let dockFromObject = false;

  if (dockObjectPos) {
    const ccwIdx = blockToCcwIndex(dockObjectPos.blockX, dockObjectPos.blockY);
    // Dock can be at CCW 4 (bottom-left) or CCW 10 (bottom-right)
    if (ccwIdx === 4 && !usedPositions.has(4)) {
      const dock = getBestAsset(4, [52, 53]);
      const asset = dock?.asset ?? 52;  // Default to first asset if scoring fails
      assignedTiles.set(4, asset);
      usedPositions.add(4);
      console.log(`Dock from object at CCW 4 (left): asset ${asset}`);
      dockFromObject = true;
    } else if (ccwIdx === 10 && !usedPositions.has(10)) {
      const dock = getBestAsset(10, [43, 44]);
      const asset = dock?.asset ?? 43;
      assignedTiles.set(10, asset);
      usedPositions.add(10);
      console.log(`Dock from object at CCW 10 (right): asset ${asset}`);
      dockFromObject = true;
    }
  }

  // Fall back to terrain/direction matching if no object found
  if (!dockFromObject) {
    const dockConfig =
      detectedDirection === 'west' ? { ccwIdx: 10, assets: [43, 44] } :  // right
      detectedDirection === 'east' ? { ccwIdx: 4, assets: [52, 53] } :   // left
      null;  // south: detect which side

    if (dockConfig) {
      const dock = getBestAsset(dockConfig.ccwIdx, dockConfig.assets);
      if (dock && dock.score >= 0.7) {
        assignedTiles.set(dockConfig.ccwIdx, dock.asset);
        usedPositions.add(dockConfig.ccwIdx);
        console.log(`Dock at CCW ${dockConfig.ccwIdx}: asset ${dock.asset} (score: ${(dock.score * 100).toFixed(1)}%)`);
      } else {
        console.warn('Dock detection failed');
        isValid = false;
      }
    } else {
      // South direction: try both sides, pick higher score
      const leftDock = getBestAsset(4, [52, 53]);
      const rightDock = getBestAsset(10, [43, 44]);
      const leftScore = leftDock?.score ?? 0;
      const rightScore = rightDock?.score ?? 0;

      if (leftScore >= rightScore && leftDock && leftScore >= 0.7) {
        assignedTiles.set(4, leftDock.asset);
        usedPositions.add(4);
        console.log(`Dock at CCW 4 (left): asset ${leftDock.asset} (score: ${(leftScore * 100).toFixed(1)}%)`);
      } else if (rightDock && rightScore >= 0.7) {
        assignedTiles.set(10, rightDock.asset);
        usedPositions.add(10);
        console.log(`Dock at CCW 10 (right): asset ${rightDock.asset} (score: ${(rightScore * 100).toFixed(1)}%)`);
      } else {
        console.warn('Dock detection failed');
        isValid = false;
      }
    }
  }

  // 4. PENINSULA (exactly 1, left or right edge rows 1-4)
  const peninsulaLeftAssets = [59, 60, 61];
  const peninsulaRightAssets = [4, 5, 6];

  let bestPeninsula: { ccwIdx: number; asset: number; score: number } | null = null;
  for (const ccwIdx of [0, 1, 2, 3]) {  // left edge
    if (usedPositions.has(ccwIdx)) continue;
    const result = getBestAsset(ccwIdx, peninsulaLeftAssets);
    if (result && (!bestPeninsula || result.score > bestPeninsula.score)) {
      bestPeninsula = { ccwIdx, ...result };
    }
  }
  for (const ccwIdx of [11, 12, 13, 14]) {  // right edge
    if (usedPositions.has(ccwIdx)) continue;
    const result = getBestAsset(ccwIdx, peninsulaRightAssets);
    if (result && (!bestPeninsula || result.score > bestPeninsula.score)) {
      bestPeninsula = { ccwIdx, ...result };
    }
  }

  if (bestPeninsula && bestPeninsula.score >= 0.7) {
    assignedTiles.set(bestPeninsula.ccwIdx, bestPeninsula.asset);
    usedPositions.add(bestPeninsula.ccwIdx);
    console.log(`Peninsula at CCW ${bestPeninsula.ccwIdx}: asset ${bestPeninsula.asset} (score: ${(bestPeninsula.score * 100).toFixed(1)}%)`);
  } else {
    console.warn('Peninsula detection failed');
    isValid = false;
  }

  // 5. SECRET BEACH (exactly 1, based on river direction)
  const secretBeachAssets = [16, 17, 18];
  const secretBeachCols =
    detectedDirection === 'west' ? [18, 17, 16] :   // columns 3,4,5 -> CCW 18,17,16
    detectedDirection === 'east' ? [20, 19, 18] :   // columns 1,2,3 -> CCW 20,19,18
    [19, 18, 17];                                    // south: columns 2,3,4 -> CCW 19,18,17

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
    console.log(`Secret beach at CCW ${bestSecretBeach.ccwIdx}: asset ${bestSecretBeach.asset} (score: ${(bestSecretBeach.score * 100).toFixed(1)}%)`);
  }
  // Note: Secret beach failure doesn't invalidate (optional feature)

  // 6. ROCKS (exactly 1 per side)
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
    console.log(`Left rock at CCW ${bestLeftRock.ccwIdx}: asset ${bestLeftRock.asset} (score: ${(bestLeftRock.score * 100).toFixed(1)}%)`);
  } else {
    console.warn('Left rock detection failed');
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
    console.log(`Right rock at CCW ${bestRightRock.ccwIdx}: asset ${bestRightRock.asset} (score: ${(bestRightRock.score * 100).toFixed(1)}%)`);
  } else {
    console.warn('Right rock detection failed');
  }

  // Step 4: Fill remaining positions with best 'filled' tile or placeholder
  const edgeTiles: number[] = [];
  // Track scores for assigned tiles (need to look them up from positionScores)
  const assignedScores: Map<number, number> = new Map();

  for (let i = 0; i < ccwPositions.length; i++) {
    if (assignedTiles.has(i)) {
      const assignedAsset = assignedTiles.get(i)!;
      edgeTiles.push(assignedAsset);
      // Get the score for the assigned asset
      const score = positionScores[i].scores.get(assignedAsset) ?? 0;
      assignedScores.set(i, score);
      diagnosticTiles.push({ ccwIndex: i, assetIndex: assignedAsset, score });
    } else {
      // Find best 'filled' type tile
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
        console.log(`Filled at CCW ${i}: asset ${bestIndex} (score: ${(bestScore * 100).toFixed(1)}%)`);
      } else {
        const placeholder = getPlaceholderIndexForPosition(pos.x, pos.y);
        edgeTiles.push(placeholder);
        diagnosticTiles.push({ ccwIndex: i, assetIndex: placeholder, score: bestScore });
        console.warn(`Placeholder at CCW ${i}: ${placeholder} - asset ${bestIndex} (score: ${(bestScore * 100).toFixed(1)}%) below threshold.`);
      }
    }
  }

  // Merge sand/rock into level1
  mergeSandRockIntoLevel1();

  // Apply edge tiles
  setEdgeTilesFromAssetIndices(edgeTiles);

  // Union edge tile terrain (water, sand, rock) to level1
  unionEdgeTilesToLevel1(edgeTiles, ccwPositions, svgLibrary);

  // Update version
  setMapVersion(2);

  // Log final validity status
  if (isValid) {
    console.log('V1 to V2 conversion complete - island is VALID');
  } else {
    console.log('V1 to V2 conversion complete - island is INVALID (missing required features)');
  }

  console.log('Edge tiles:', edgeTiles);

  // Check for low confidence tiles
  const hasLowConfidence = diagnosticTiles.some(t => t.score < 0.7);

  return {
    riverDirection: diagnosticRiverDirection,
    riverScore: diagnosticRiverScore,
    edgeTiles: diagnosticTiles,
    isValid,
    hasLowConfidence,
  };
}

// ============ Batch V1 to V2 Conversion ============

type ConversionResult = {
  category: string;
  layout: Layout;
  v2Data: string;
  diagnostic: ConversionDiagnostic;
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateIslandLayoutsV2File(results: ConversionResult[]): void {
  const grouped: Record<string, string[]> = {
    blank: [],
    west: [],
    south: [],
    east: [],
  };

  for (const { category, layout, v2Data } of results) {
    // Escape single quotes and backslashes in data
    const escapedData = v2Data.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const linkLine = layout.link ? `      link: '${layout.link}',\n` : '';
    const entry = `    {
      name: '${layout.name}',
      contributor: '${layout.contributor}',
${linkLine}      data: '${escapedData}',
      quality: ${layout.quality},
    }`;
    grouped[category].push(entry);
  }

  const fileContent = `// Auto-generated V2 layouts - do not edit manually
// Generated: ${new Date().toISOString()}
// Source: islandLayouts.ts converted via batchConvertV1ToV2()

export interface Layout {
  name: string;
  contributor: string;
  link?: string;
  data: string;
  quality: number;
}

export enum LayoutType {
  none = '',
  blank = 'blank',
  west = 'west',
  south = 'south',
  east = 'east',
}

export default {
  [LayoutType.blank]: [
${grouped.blank.join(',\n')}
  ],
  [LayoutType.west]: [
${grouped.west.join(',\n')}
  ],
  [LayoutType.south]: [
${grouped.south.join(',\n')}
  ],
  [LayoutType.east]: [
${grouped.east.join(',\n')}
  ],
};
`;

  downloadTextFile(fileContent, 'islandLayoutsV2.ts');
  console.log('Downloaded islandLayoutsV2.ts');
}

function generateDiagnosticsFile(results: ConversionResult[]): void {
  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push('BATCH V1 TO V2 CONVERSION DIAGNOSTICS');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('================================================================================');
  lines.push('');

  let validCount = 0;
  let invalidCount = 0;
  const lowConfidenceLayouts: { name: string; count: number }[] = [];

  for (let i = 0; i < results.length; i++) {
    const { category, layout, diagnostic } = results[i];
    const fullName = `${category}/${layout.name}`;

    lines.push(`[${i + 1}/${results.length}] ${fullName}`);
    lines.push(`  River direction: ${diagnostic.riverDirection} (score: ${(diagnostic.riverScore * 100).toFixed(1)}%)`);
    lines.push('  Edge tiles (CCW order):');

    let lowConfidenceCount = 0;
    for (const tile of diagnostic.edgeTiles) {
      const scoreStr = (tile.score * 100).toFixed(1);
      const warning = tile.score < 0.7 ? ' ⚠️ BELOW 70% THRESHOLD' : '';
      if (tile.score < 0.7) lowConfidenceCount++;
      lines.push(`    CCW ${tile.ccwIndex.toString().padStart(2)}: asset ${tile.assetIndex.toString().padStart(3)} (score: ${scoreStr.padStart(5)}%)${warning}`);
    }

    lines.push(`  Status: ${diagnostic.isValid ? 'VALID' : 'INVALID (missing required features)'}`);

    if (diagnostic.hasLowConfidence) {
      lines.push('  ⚠️ WARNING: This map has tiles below 70% confidence');
      lowConfidenceLayouts.push({ name: fullName, count: lowConfidenceCount });
    }

    if (diagnostic.isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    lines.push('');
    lines.push('--------------------------------------------------------------------------------');
    lines.push('');
  }

  lines.push('================================================================================');
  lines.push('SUMMARY');
  lines.push('================================================================================');
  lines.push(`Total layouts: ${results.length}`);
  lines.push(`Valid conversions: ${validCount}`);
  lines.push(`Invalid conversions: ${invalidCount}`);
  lines.push(`Layouts with low confidence tiles (<70%): ${lowConfidenceLayouts.length}`);
  lines.push('');

  if (lowConfidenceLayouts.length > 0) {
    lines.push('LOW CONFIDENCE LAYOUTS:');
    for (const { name, count } of lowConfidenceLayouts) {
      lines.push(`  - ${name}: ${count} tile(s) below threshold`);
    }
  }

  downloadTextFile(lines.join('\n'), 'islandLayoutsV2_diagnostics.txt');
  console.log('Downloaded islandLayoutsV2_diagnostics.txt');
}

async function batchConvertV1ToV2(): Promise<void> {
  const allLayouts = getAllLayouts();
  const results: ConversionResult[] = [];

  console.log(`Starting batch conversion of ${allLayouts.length} layouts...`);

  for (let i = 0; i < allLayouts.length; i++) {
    const { category, layout } = allLayouts[i];
    console.log(`[${i + 1}/${allLayouts.length}] Converting: ${category}/${layout.name}`);

    // Load the layout
    loadMapFromJSONString(layout.data);

    // Small delay for rendering
    await delay(100);

    // Run conversion and capture diagnostics
    const diagnostic = await convertV1ToV2();

    // Capture V2 output
    const v2Data = encodeMap();
    results.push({ category, layout, v2Data, diagnostic });

    // Small delay for UI responsiveness
    await delay(50);
  }

  console.log(`Batch conversion complete. Generating output files...`);

  // Generate and download both files
  generateIslandLayoutsV2File(results);
  generateDiagnosticsFile(results);

  console.log('Batch conversion finished!');
}

function showDevMenu(): void {
  hideDevMenu();

  layers.fixedLayer.activate();

  devMenuGroup = new paper.Group();
  devMenuGroup.applyMatrix = false;

  const menuWidth = 140;
  const menuItemHeight = 30;
  const menuPadding = 8;
  const menuItems = [
    { label: 'Extract Tile JSON', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleExtractMode();
    }},
    { label: 'Load Tile JSON', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleLoadMode();
    }},
    { label: 'Export Tile SVG', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleSvgExportMode();
    }},
    { label: 'Import Tile SVG', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleSvgImportMode();
    }},
    { label: 'Import SVG to terrain', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleSvgToTerrainMode();
    }},
    { label: 'Export SVG (from file)', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleSvgExportFromFileMode();
    }},
    { label: 'Export Visible Portions', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleVisiblePortionsExportMode();
    }},
    { label: 'Tile Tracer', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleTileTracerMode();
    }},
    { label: 'Layout Navigator', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleLayoutNavigator();
    }},
    { label: 'Auto Island Flow', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      autoCompleteToGrid();
    }},
    { label: 'Convert V1 to V2', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      convertV1ToV2();
    }},
    { label: 'Batch Convert to V2', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      batchConvertV1ToV2();
    }},
    { label: 'Toggle Edge Tiles', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleEdgeTileLayerVisibility();
    }},
  ];

  // Menu background
  const menuHeight = menuItems.length * menuItemHeight + menuPadding * 2;
  const menuBg = new paper.Path.Rectangle({
    rectangle: new paper.Rectangle(0, 0, menuWidth, menuHeight),
    radius: 8,
    fillColor: colors.offWhite.color,
    strokeColor: colors.text.color,
    strokeWidth: 2,
  });
  devMenuGroup.addChild(menuBg);

  // Menu items
  menuItems.forEach((item, index) => {
    const itemY = menuPadding + index * menuItemHeight;

    // Item background (for hover)
    const itemBg = new paper.Path.Rectangle({
      rectangle: new paper.Rectangle(4, itemY, menuWidth - 8, menuItemHeight - 4),
      radius: 4,
      fillColor: new paper.Color(0, 0, 0, 0),
    });

    // Item text
    const itemText = new paper.PointText({
      point: new paper.Point(menuPadding + 4, itemY + menuItemHeight / 2 + 4),
      content: item.label,
      fillColor: colors.text.color,
      fontFamily: 'TTNorms, sans-serif',
      fontSize: 12,
    });

    const itemGroup = new paper.Group([itemBg, itemText]);
    itemGroup.onMouseEnter = () => {
      itemBg.fillColor = colors.paperOverlay.color;
    };
    itemGroup.onMouseLeave = () => {
      itemBg.fillColor = new paper.Color(0, 0, 0, 0);
    };
    itemGroup.onClick = () => {
      item.action();
    };

    devMenuGroup!.addChild(itemGroup);
  });

  updateMenuPosition();
}

function hideDevMenu(): void {
  if (devMenuGroup) {
    devMenuGroup.remove();
    devMenuGroup = null;
  }
}

function updateMenuPosition(): void {
  if (!devMenuGroup || !devToolsGroup) return;

  // Position menu above the dev tools button
  const buttonPos = devToolsGroup.position;
  const menuHeight = devMenuGroup.bounds.height;
  devMenuGroup.position = new paper.Point(
    buttonPos.x - 30,
    buttonPos.y - menuHeight / 2 - 30
  );
}

function createDevToolsPalette(): void {
  layers.fixedLayer.activate();

  devToolsGroup = new paper.Group();
  devToolsGroup.applyMatrix = false;

  // Create extract tile button
  const iconSize = 20;

  // Create a simple grid icon to represent tile extraction
  const icon = new paper.Group();

  // Grid lines
  const gridPath = new paper.CompoundPath({
    children: [
      new paper.Path.Line(new paper.Point(-6, -6), new paper.Point(-6, 6)),
      new paper.Path.Line(new paper.Point(6, -6), new paper.Point(6, 6)),
      new paper.Path.Line(new paper.Point(-6, -6), new paper.Point(6, -6)),
      new paper.Path.Line(new paper.Point(-6, 6), new paper.Point(6, 6)),
      new paper.Path.Line(new paper.Point(0, -6), new paper.Point(0, 6)),
      new paper.Path.Line(new paper.Point(-6, 0), new paper.Point(6, 0)),
    ],
    strokeColor: colors.text.color,
    strokeWidth: 1.5,
  });
  icon.addChild(gridPath);

  // Highlight one cell
  const highlightCell = new paper.Path.Rectangle(
    new paper.Rectangle(-6, -6, 6, 6)
  );
  highlightCell.fillColor = colors.selected.color.clone();
  highlightCell.fillColor.alpha = 0.5;
  icon.addChild(highlightCell);

  const button = createButton(icon, iconSize, () => {
    toggleMenu();
  }, {
    highlightedColor: colors.paperOverlay.color,
    selectedColor: colors.selected.color,
  });

  devToolsGroup.addChild(button);

  // Position in bottom-right corner
  updatePosition();
}

function updatePosition(): void {
  if (!devToolsGroup) return;

  // Use the same positioning approach as other fixed UI elements
  devToolsGroup.position = new paper.Point(
    paper.view.bounds.width * paper.view.scaling.x - 50,
    paper.view.bounds.height * paper.view.scaling.y - 50
  );
}

export function initDevTools(): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('Initializing dev tools...');
    createDevToolsPalette();

    // Listen to resize events like other UI elements
    emitter.on('resize', () => {
      updatePosition();
      updateMenuPosition();
    });
  }
}
