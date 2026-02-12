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
import { loadMapFromJSONString, loadBaseMapFromSvg } from '../load';
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
    // Try cached SVG content first
    const cachedSvg = getCachedSvgContent(index);
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
      // imageSrc is already an SVG path (e.g., 'static/tiles_data/1 - ISdNX8N.svg')
      const svgPath = data.imageSrc;

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

// ============ Base Map Terrain Extraction ============

// Types
type RGB = { r: number; g: number; b: number };
type BridgeLine = { start: { x: number; y: number }; end: { x: number; y: number }; isHorizontal: boolean };

// All 96 base map files
const BASE_MAP_FILES = [
  '1 - SDfVaDl.jpg', '2 - yXDYVFD.jpg', '3 - PyzBUP1.jpg', '4 - OnqC1nC.jpg',
  '5 - WurSJKk.jpg', '6 - aVJGwvu.jpg', '7 - f6D7OlU.jpg', '8 - vgbGYKj.jpg',
  '9 - XQqxFI5.jpg', '10 - 8wJ2zkT.jpg', '11 - nxBjoME.jpg', '12 - vMq0I1Y.jpg',
  '13 - exafStG.jpg', '14 - 44Uvxyi.jpg', '15 - Gd13Uqa.jpg', '16 - jZ1HMbz.jpg',
  '17 - iulJBPa.jpg', '18 - KREU8f0.jpg', '19 - dLF3X3o.jpg', '20 - 9bipHlY.jpg',
  '21 - ZfTqMvU.jpg', '22 - KZQBwNT.jpg', '23 - rpjToFI.jpg', '24 - lD2Fa4n.jpg',
  '25 - rOAgb5r.jpg', '26 - xO4Y1P9.jpg', '27 - wnircua.jpg', '28 - FQo5X0l.jpg',
  '29 - Iwm65vI.jpg', '30 - o4EWiYM.jpg', '31 - H19jpgc.jpg', '32 - oNbwrz9.jpg',
  '33 - yW0MVKg.jpg', '34 - Em3vf6s.jpg', '35 - kblSc5O.jpg', '36 - yHzfMaY.jpg',
  '37 - ZbHBRAR.jpg', '38 - YQzYDaq.jpg', '39 - VqZqOls.jpg', '40 - XH7hFKo.jpg',
  '41 - 4CTq1Yz.jpg', '42 - PLjd4OF.jpg', '43 - f2mIPoL.jpg', '44 - dwanr7W.jpg',
  '45 - doFvLYG.jpg', '46 - y8lJMPb.jpg', '47 - PGpHfWf.jpg', '48 - 9Ay4nWC.jpg',
  '49 - r5hU5MC.jpg', '50 - TLh5By9.jpg', '51 - otoVlEA.jpg', '52 - QIng9V9.jpg',
  '53 - t5M7SiG.jpg', '54 - 2q0bQRY.jpg', '55 - hngZx2E.jpg', '56 - tPzg45P.jpg',
  '57 - yMCIWKN.jpg', '58 - 6umQpI4.jpg', '59 - mvupnpF.jpg', '60 - bVxC7iZ.jpg',
  '61 - DDScpXA.jpg', '62 - uqZvyEa.jpg', '63 - 1XAi2gj.jpg', '64 - kBrwfKa.jpg',
  '65 - QQmZpWF.jpg', '66 - YmzCqPd.jpg', '67 - sUoNw6e.jpg', '68 - eJM8rcO.jpg',
  '69 - WzNx0OM.jpg', '70 - FR99zC2.jpg', '71 - wD6qccC.jpg', '72 - Q8bRecT.jpg',
  '73 - dV7S7GM.jpg', '74 - ahfeEFT.jpg', '75 - usK7zRN.jpg', '76 - 9S6e5Ph.jpg',
  '77 - ZwPMkk6.jpg', '78 - SbHz9i5.jpg', '79 - zNg90t4.jpg', '80 - jly4r3F.jpg',
  '81 - LY0ARnv.jpg', '82 - lSWhCA9.jpg', '83 - AT8suxM.jpg', '84 - gXcNrPj.jpg',
  '85 - CB8fm1b.jpg', '86 - JjnvVvr.jpg', '87 - 2qVL5Y0.jpg', '88 - 8kk4LXN.jpg',
  '89 - ZlFObf5.jpg', '90 - NXJf8HC.jpg', '91 - VECjA4S.jpg', '92 - oTXYCIs.jpg',
  '93 - 5A40la1.jpg', '94 - nL0gcY9.jpg', '95 - bTUDhRf.jpg', '96 - q2q0K1u.jpg',
];

// Flag to disable debug image downloads during batch processing
let batchMode = false;

// Constants - Colors based on actual color-picked samples from source images
// Level detection is primarily based on green channel value:
//   Level1: G ≈ 120-130 (#097C00, #008001, #038102, #077A07)
//   Border: G ≈ 95-106  (#036603, #026A02, #046203, #065F0C, #03630A)
//   Level2: G ≈ 73-83   (#025100, #074907, #005301, #035102, #064B03)
//   Level3: G ≈ 22-28   (#0B1600, #011C00, #051709) - very dark green
const BASE_MAP_COLORS = {
  WATER_BLUE: { r: 0x00, g: 0x00, b: 0x8E },
  WATER_GREY: { r: 0x84, g: 0x84, b: 0x84 },
  WATER_BLACK: { r: 0x00, g: 0x02, b: 0x05 }, // #000203, #010307 - slight blue tint
  LEVEL1: { r: 0x05, g: 0x7D, b: 0x02 },      // G ≈ 125 (0x7A-0x81)
  LEVEL2: { r: 0x04, g: 0x50, b: 0x02 },      // G ≈ 80 (0x49-0x53)
  LEVEL3: { r: 0x06, g: 0x18, b: 0x03 },      // G ≈ 24 (0x16-0x1C) - dark green!
  BORDER: { r: 0x04, g: 0x64, b: 0x05 },      // G ≈ 100 (0x5F-0x6A)
  EDGE_BLUE: { r: 0x00, g: 0x00, b: 0xFE },
  RED_BRIGHT: { r: 0xF0, g: 0x06, b: 0x01 },  // On level1: #F20501, #EB0801
  RED_DULL: { r: 0xAE, g: 0x26, b: 0x30 },    // On level2/3: #AF2827, #AE2439
  ORANGE: { r: 0xFF, g: 0xC1, b: 0xA9 },
  YELLOW: { r: 0xFF, g: 0xFF, b: 0x00 },
};

// Green channel thresholds for level classification
const GREEN_THRESHOLDS = {
  LEVEL1_MIN: 110,  // Level1: G >= 110
  BORDER_MIN: 88,   // Border: 88 <= G < 110
  LEVEL2_MIN: 55,   // Level2: 55 <= G < 88
  LEVEL3_MIN: 0,    // Level3: G < 55 (very dark green)
};

const COORD_WIDTH = 112;  // 7 blocks × 16 units
const COORD_HEIGHT = 96;  // 6 blocks × 16 units
const PIXELS_PER_UNIT = 6;
const EDGE_BORDER_SIZE = 8; // coordinates
const COLOR_TOLERANCE = 40; // Euclidean RGB distance for JPEG artifacts

// Level enum for classification
const LEVEL = {
  UNKNOWN: 0,
  WATER: 1,
  LEVEL1: 2,
  LEVEL2: 3,
  LEVEL3: 4,
  BORDER: 5,
  SPECIAL: 6, // red, orange, yellow
};

// Color utility functions
function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    (c1.r - c2.r) ** 2 +
    (c1.g - c2.g) ** 2 +
    (c1.b - c2.b) ** 2
  );
}

function matchesColor(pixel: RGB, target: RGB, tolerance = COLOR_TOLERANCE): boolean {
  return colorDistance(pixel, target) <= tolerance;
}

function getPixelAt(colors: Uint8Array, x: number, y: number): RGB {
  const idx = (y * COORD_WIDTH + x) * 3;
  return { r: colors[idx], g: colors[idx + 1], b: colors[idx + 2] };
}

// Load image asynchronously
function loadImageAsync(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
    img.src = path;
  });
}

// Step 1: Pixelate image to coordinate grid
function pixelateImage(image: HTMLImageElement): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const data = imageData.data;

  // Output: RGB for each coordinate (112×96×3)
  const coordColors = new Uint8Array(COORD_WIDTH * COORD_HEIGHT * 3);

  for (let cy = 0; cy < COORD_HEIGHT; cy++) {
    for (let cx = 0; cx < COORD_WIDTH; cx++) {
      // Calculate pixel bounds for this coordinate
      const px = cx * PIXELS_PER_UNIT;
      const py = cy * PIXELS_PER_UNIT;

      // Sample center 4×4 pixels (offset 1 from edges)
      let rSum = 0, gSum = 0, bSum = 0;
      let count = 0;

      for (let dy = 1; dy < 5; dy++) {
        for (let dx = 1; dx < 5; dx++) {
          const pixelX = px + dx;
          const pixelY = py + dy;
          if (pixelX < image.width && pixelY < image.height) {
            const idx = (pixelY * image.width + pixelX) * 4;
            rSum += data[idx];
            gSum += data[idx + 1];
            bSum += data[idx + 2];
            count++;
          }
        }
      }

      const outIdx = (cy * COORD_WIDTH + cx) * 3;
      coordColors[outIdx] = Math.round(rSum / count);
      coordColors[outIdx + 1] = Math.round(gSum / count);
      coordColors[outIdx + 2] = Math.round(bSum / count);
    }
  }

  return coordColors;
}

// Step 2: Classify water
function classifyWater(colors: Uint8Array): { waterMask: boolean[]; bridgeLines: BridgeLine[] } {
  const waterMask = new Array(COORD_WIDTH * COORD_HEIGHT).fill(false);
  const blackPixels: { x: number; y: number }[] = [];

  // First pass: identify water and potential bridge pixels
  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      const pixel = getPixelAt(colors, x, y);

      // Skip edge border (8 units from edge)
      if (x < EDGE_BORDER_SIZE || x >= COORD_WIDTH - EDGE_BORDER_SIZE ||
          y < EDGE_BORDER_SIZE || y >= COORD_HEIGHT - EDGE_BORDER_SIZE) {
        continue;
      }

      // Check for water blue
      if (matchesColor(pixel, BASE_MAP_COLORS.WATER_BLUE)) {
        waterMask[y * COORD_WIDTH + x] = true;
      }
      // Check for water grey
      else if (matchesColor(pixel, BASE_MAP_COLORS.WATER_GREY)) {
        waterMask[y * COORD_WIDTH + x] = true;
      }
      // Track black pixels for bridge detection
      else if (matchesColor(pixel, BASE_MAP_COLORS.WATER_BLACK, 35)) {
        blackPixels.push({ x, y });
      }
    }
  }

  // Bridge detection: find horizontal/vertical black lines 3-5 units long
  const bridgeLines: BridgeLine[] = [];
  const usedInBridge = new Set<string>();

  for (const { x, y } of blackPixels) {
    if (usedInBridge.has(`${x},${y}`)) continue;

    // Try horizontal line
    let hLen = 1;
    while (x + hLen < COORD_WIDTH && blackPixels.some(p => p.x === x + hLen && p.y === y)) {
      hLen++;
    }

    if (hLen >= 3 && hLen <= 6) {
      // Horizontal bridge: check above/below each point
      // - Start/end points: grey above AND below
      // - Interior points: blue above OR below
      // - Left/right of bridge: NOT water
      const leftX = x - 1;
      const rightX = x + hLen;

      if (leftX >= 0 && rightX < COORD_WIDTH && y > 0 && y < COORD_HEIGHT - 1) {
        // Check left/right are NOT water (should be land)
        const leftPixel = getPixelAt(colors, leftX, y);
        const rightPixel = getPixelAt(colors, rightX, y);
        const leftIsNotWater = !matchesColor(leftPixel, BASE_MAP_COLORS.WATER_GREY) &&
                               !matchesColor(leftPixel, BASE_MAP_COLORS.WATER_BLUE);
        const rightIsNotWater = !matchesColor(rightPixel, BASE_MAP_COLORS.WATER_GREY) &&
                                !matchesColor(rightPixel, BASE_MAP_COLORS.WATER_BLUE);

        if (leftIsNotWater && rightIsNotWater) {
          let isValidBridge = true;
          for (let i = 0; i < hLen && isValidBridge; i++) {
            const bx = x + i;
            const abovePixel = getPixelAt(colors, bx, y - 1);
            const belowPixel = getPixelAt(colors, bx, y + 1);
            const isEndpoint = (i === 0 || i === hLen - 1);
            const isNearEndpoint = (i === 1 || i === hLen - 2);

            if (isEndpoint) {
              // First/last: grey on both sides
              isValidBridge = matchesColor(abovePixel, BASE_MAP_COLORS.WATER_GREY) &&
                              matchesColor(belowPixel, BASE_MAP_COLORS.WATER_GREY);
            } else if (isNearEndpoint) {
              // Second and second-from-last: water (blue or grey) on both sides
              const aboveIsWater = matchesColor(abovePixel, BASE_MAP_COLORS.WATER_BLUE) ||
                                   matchesColor(abovePixel, BASE_MAP_COLORS.WATER_GREY);
              const belowIsWater = matchesColor(belowPixel, BASE_MAP_COLORS.WATER_BLUE) ||
                                   matchesColor(belowPixel, BASE_MAP_COLORS.WATER_GREY);
              isValidBridge = aboveIsWater && belowIsWater;
            } else {
              // Middle: blue on both sides
              isValidBridge = matchesColor(abovePixel, BASE_MAP_COLORS.WATER_BLUE) &&
                              matchesColor(belowPixel, BASE_MAP_COLORS.WATER_BLUE);
            }
          }
          if (isValidBridge) {
            for (let i = 0; i < hLen; i++) {
              usedInBridge.add(`${x + i},${y}`);
              waterMask[y * COORD_WIDTH + x + i] = true;
            }
            bridgeLines.push({ start: { x, y }, end: { x: x + hLen - 1, y }, isHorizontal: true });
            continue;
          }
        }
      }
    }

    // Try vertical line
    let vLen = 1;
    while (y + vLen < COORD_HEIGHT && blackPixels.some(p => p.x === x && p.y === y + vLen)) {
      vLen++;
    }

    if (vLen >= 3 && vLen <= 6) {
      // Vertical bridge: check left/right of each point
      // - Start/end points: grey left AND right
      // - Interior points: blue left OR right
      // - Top/bottom of bridge: NOT water
      const topY = y - 1;
      const bottomY = y + vLen;

      if (topY >= 0 && bottomY < COORD_HEIGHT && x > 0 && x < COORD_WIDTH - 1) {
        // Check top/bottom are NOT water (should be land)
        const topPixel = getPixelAt(colors, x, topY);
        const bottomPixel = getPixelAt(colors, x, bottomY);
        const topIsNotWater = !matchesColor(topPixel, BASE_MAP_COLORS.WATER_GREY) &&
                              !matchesColor(topPixel, BASE_MAP_COLORS.WATER_BLUE);
        const bottomIsNotWater = !matchesColor(bottomPixel, BASE_MAP_COLORS.WATER_GREY) &&
                                 !matchesColor(bottomPixel, BASE_MAP_COLORS.WATER_BLUE);

        if (topIsNotWater && bottomIsNotWater) {
          let isValidBridge = true;
          for (let i = 0; i < vLen && isValidBridge; i++) {
            const by = y + i;
            const leftPixel = getPixelAt(colors, x - 1, by);
            const rightPixel = getPixelAt(colors, x + 1, by);
            const isEndpoint = (i === 0 || i === vLen - 1);
            const isNearEndpoint = (i === 1 || i === vLen - 2);

            if (isEndpoint) {
              // First/last: grey on both sides
              isValidBridge = matchesColor(leftPixel, BASE_MAP_COLORS.WATER_GREY) &&
                              matchesColor(rightPixel, BASE_MAP_COLORS.WATER_GREY);
            } else if (isNearEndpoint) {
              // Second and second-from-last: water (blue or grey) on both sides
              const leftIsWater = matchesColor(leftPixel, BASE_MAP_COLORS.WATER_BLUE) ||
                                  matchesColor(leftPixel, BASE_MAP_COLORS.WATER_GREY);
              const rightIsWater = matchesColor(rightPixel, BASE_MAP_COLORS.WATER_BLUE) ||
                                   matchesColor(rightPixel, BASE_MAP_COLORS.WATER_GREY);
              isValidBridge = leftIsWater && rightIsWater;
            } else {
              // Middle: blue on both sides
              isValidBridge = matchesColor(leftPixel, BASE_MAP_COLORS.WATER_BLUE) &&
                              matchesColor(rightPixel, BASE_MAP_COLORS.WATER_BLUE);
            }
          }
          if (isValidBridge) {
            for (let i = 0; i < vLen; i++) {
              usedInBridge.add(`${x},${y + i}`);
              waterMask[(y + i) * COORD_WIDTH + x] = true;
            }
            bridgeLines.push({ start: { x, y }, end: { x, y: y + vLen - 1 }, isHorizontal: false });
          }
        }
      }
    }
  }

  console.log(`Water classification: found ${bridgeLines.length} bridge lines`);
  return { waterMask, bridgeLines };
}

// Step 3: Cleanup water (remove isolated pixels)
function cleanupWater(waterMask: boolean[]): boolean[] {
  const cleaned = [...waterMask];
  const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      const idx = y * COORD_WIDTH + x;
      if (!cleaned[idx]) continue;

      // Check for at least one water neighbor
      let hasNeighbor = false;
      for (let d = 0; d < 8; d++) {
        const nx = x + dx[d];
        const ny = y + dy[d];
        if (nx >= 0 && nx < COORD_WIDTH && ny >= 0 && ny < COORD_HEIGHT) {
          if (waterMask[ny * COORD_WIDTH + nx]) {
            hasNeighbor = true;
            break;
          }
        }
      }

      if (!hasNeighbor) {
        cleaned[idx] = false;
      }
    }
  }

  return cleaned;
}

// Step 3b: Infer water levels using bridge topology
// Water regions separated by bridges are assigned levels based on distance from ocean
function inferWaterLevels(waterMask: boolean[], bridgeLines: BridgeLine[], colors: Uint8Array): Uint8Array {
  const waterLevels = new Uint8Array(COORD_WIDTH * COORD_HEIGHT);
  const visited = new Array(COORD_WIDTH * COORD_HEIGHT).fill(false);
  const cardinalDx = [0, 1, 0, -1];
  const cardinalDy = [-1, 0, 1, 0];

  // Helper to get land level using green channel thresholds
  // Returns 0 if not land, or LEVEL1/LEVEL2/LEVEL3
  function getLandLevel(x: number, y: number): number {
    if (x < 0 || x >= COORD_WIDTH || y < 0 || y >= COORD_HEIGHT) return 0;
    const idx = y * COORD_WIDTH + x;
    if (waterMask[idx]) return 0; // Not land
    const g = colors[idx * 3 + 1]; // Green channel
    if (g >= GREEN_THRESHOLDS.LEVEL1_MIN) return LEVEL.LEVEL1;
    if (g >= GREEN_THRESHOLDS.LEVEL2_MIN) return LEVEL.LEVEL2;
    return LEVEL.LEVEL3;
  }

  // Build set of bridge coordinates
  const bridgeCoords = new Set<string>();
  for (const bridge of bridgeLines) {
    if (bridge.isHorizontal) {
      for (let x = bridge.start.x; x <= bridge.end.x; x++) {
        bridgeCoords.add(`${x},${bridge.start.y}`);
      }
    } else {
      for (let y = bridge.start.y; y <= bridge.end.y; y++) {
        bridgeCoords.add(`${bridge.start.x},${y}`);
      }
    }
  }

  // Flood fill to find a water region, stopping at bridges
  // Returns: region coords, set of bridge coords, and counts of land neighbors by level
  function floodFillWaterRegion(startX: number, startY: number): {
    coords: { x: number; y: number }[];
    touchesEdge: boolean;
    adjacentBridges: Set<string>;
    neighborCounts: { level1: number; level2: number; level3: number };
  } {
    const coords: { x: number; y: number }[] = [];
    const adjacentBridges = new Set<string>();
    let touchesEdge = false;
    const neighborCounts = { level1: 0, level2: 0, level3: 0 };
    const countedNeighbors = new Set<string>(); // Avoid double-counting
    const stack = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * COORD_WIDTH + x;

      if (x < 0 || x >= COORD_WIDTH || y < 0 || y >= COORD_HEIGHT) continue;
      if (visited[idx]) continue;
      if (!waterMask[idx]) continue;

      // Check if this is a bridge pixel - record it but don't expand through it
      const coordKey = `${x},${y}`;
      if (bridgeCoords.has(coordKey)) {
        adjacentBridges.add(coordKey);
        continue; // Don't mark as visited, don't expand
      }

      visited[idx] = true;
      coords.push({ x, y });

      // Check if touches edge
      if (x === 0 || x === COORD_WIDTH - 1 || y === 0 || y === COORD_HEIGHT - 1) {
        touchesEdge = true;
      }

      // Count land neighbors by level (cardinal directions only)
      for (let d = 0; d < 4; d++) {
        const nx = x + cardinalDx[d];
        const ny = y + cardinalDy[d];
        const nKey = `${nx},${ny}`;
        if (!countedNeighbors.has(nKey)) {
          const landLevel = getLandLevel(nx, ny);
          if (landLevel === LEVEL.LEVEL1) neighborCounts.level1++;
          else if (landLevel === LEVEL.LEVEL2) neighborCounts.level2++;
          else if (landLevel === LEVEL.LEVEL3) neighborCounts.level3++;
          if (landLevel !== 0) countedNeighbors.add(nKey);
        }
      }

      for (let d = 0; d < 4; d++) {
        stack.push({ x: x + cardinalDx[d], y: y + cardinalDy[d] });
      }
    }

    return { coords, touchesEdge, adjacentBridges, neighborCounts };
  }

  // Find all water regions
  type WaterRegion = {
    id: number;
    coords: { x: number; y: number }[];
    touchesEdge: boolean;
    adjacentBridges: Set<string>;
    neighborCounts: { level1: number; level2: number; level3: number };
    level: number;
  };
  const regions: WaterRegion[] = [];

  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      const idx = y * COORD_WIDTH + x;
      if (!waterMask[idx] || visited[idx]) continue;
      if (bridgeCoords.has(`${x},${y}`)) continue; // Skip bridge pixels for region starts

      const { coords, touchesEdge, adjacentBridges, neighborCounts } = floodFillWaterRegion(x, y);
      if (coords.length > 0) {
        regions.push({
          id: regions.length,
          coords,
          touchesEdge,
          adjacentBridges,
          neighborCounts,
          level: 0, // Will be assigned later
        });
      }
    }
  }

  if (regions.length === 0) {
    return waterLevels;
  }

  // Build bridge-to-regions mapping
  // Each bridge connects to regions on both sides
  const bridgeToRegions = new Map<string, Set<number>>();
  for (const region of regions) {
    for (const bridgeKey of region.adjacentBridges) {
      if (!bridgeToRegions.has(bridgeKey)) {
        bridgeToRegions.set(bridgeKey, new Set());
      }
      bridgeToRegions.get(bridgeKey)!.add(region.id);
    }
  }

  // Build adjacency list for regions connected via bridges
  const regionAdjacency = new Map<number, Set<number>>();
  for (const region of regions) {
    regionAdjacency.set(region.id, new Set());
  }
  for (const [, regionIds] of bridgeToRegions) {
    const ids = Array.from(regionIds);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        regionAdjacency.get(ids[i])!.add(ids[j]);
        regionAdjacency.get(ids[j])!.add(ids[i]);
      }
    }
  }

  // Find connected components of regions (connected via bridges)
  const processedRegions = new Set<number>();
  const components: WaterRegion[][] = [];

  for (const region of regions) {
    if (processedRegions.has(region.id)) continue;
    if (region.adjacentBridges.size === 0) continue; // Skip regions without bridges

    // BFS to find all regions in this connected component
    const component: WaterRegion[] = [];
    const componentQueue = [region];
    processedRegions.add(region.id);

    while (componentQueue.length > 0) {
      const current = componentQueue.shift()!;
      component.push(current);

      for (const neighborId of regionAdjacency.get(current.id) || []) {
        if (processedRegions.has(neighborId)) continue;
        processedRegions.add(neighborId);
        componentQueue.push(regions[neighborId]);
      }
    }

    if (component.length > 0) {
      components.push(component);
    }
  }

  console.log(`Found ${components.length} connected water system(s) with bridges`);

  // Helper to get the dominant neighbor level for a region
  function getDominantLevel(region: WaterRegion): number | null {
    const { level1, level2, level3 } = region.neighborCounts;
    if (level1 > level2 && level1 > level3) return LEVEL.LEVEL1;
    if (level2 > level1 && level2 > level3) return LEVEL.LEVEL2;
    if (level3 > level1 && level3 > level2) return LEVEL.LEVEL3;
    return null; // No clear majority
  }

  // For each connected component, find root regions and BFS from them
  for (const component of components) {
    // Find root regions: try level1 first, then level2, then level3
    let rootRegions: WaterRegion[] = [];
    let startLevel = LEVEL.LEVEL1;

    // Try to find regions with majority level1 neighbors
    rootRegions = component.filter(r => getDominantLevel(r) === LEVEL.LEVEL1);

    // If none, try level2
    if (rootRegions.length === 0) {
      rootRegions = component.filter(r => getDominantLevel(r) === LEVEL.LEVEL2);
      startLevel = LEVEL.LEVEL2;
    }

    // If still none, try level3
    if (rootRegions.length === 0) {
      rootRegions = component.filter(r => getDominantLevel(r) === LEVEL.LEVEL3);
      startLevel = LEVEL.LEVEL3;
    }

    // Fallback: if no clear majority anywhere, use the one with most level1
    if (rootRegions.length === 0) {
      let bestRegion = component[0];
      for (const region of component) {
        if (region.neighborCounts.level1 > bestRegion.neighborCounts.level1) {
          bestRegion = region;
        }
      }
      rootRegions.push(bestRegion);
      startLevel = LEVEL.LEVEL1;
    }

    const levelName = startLevel === LEVEL.LEVEL1 ? 'level1' : startLevel === LEVEL.LEVEL2 ? 'level2' : 'level3';
    console.log(`Component has ${rootRegions.length} ${levelName} root region(s): ${rootRegions.map(r => r.id).join(', ')}`);

    // Start BFS from all root regions simultaneously
    const levelQueue: WaterRegion[] = [];
    const levelProcessed = new Set<number>();

    for (const region of rootRegions) {
      region.level = startLevel;
      levelQueue.push(region);
      levelProcessed.add(region.id);
    }

    while (levelQueue.length > 0) {
      const current = levelQueue.shift()!;
      const nextLevel = current.level === LEVEL.LEVEL1 ? LEVEL.LEVEL2 :
                        current.level === LEVEL.LEVEL2 ? LEVEL.LEVEL3 : LEVEL.LEVEL3;

      // Find connected regions through bridges
      for (const bridgeKey of current.adjacentBridges) {
        const connectedRegionIds = bridgeToRegions.get(bridgeKey);
        if (!connectedRegionIds) continue;

        for (const regionId of connectedRegionIds) {
          if (levelProcessed.has(regionId)) continue;

          const connectedRegion = regions[regionId];
          connectedRegion.level = nextLevel;
          levelProcessed.add(regionId);
          levelQueue.push(connectedRegion);
        }
      }
    }
  }

  // For unprocessed regions (disconnected from river system):
  // - Large regions (>= 64 pixels) or edge-touching: default to LEVEL1
  // - Small isolated lakes (< 64 pixels, no bridges): leave as 0 to fill later via neighbor sampling
  const SMALL_LAKE_THRESHOLD = 64;
  for (const region of regions) {
    if (region.level === 0) {
      const isSmallLake = region.coords.length < SMALL_LAKE_THRESHOLD &&
                          region.adjacentBridges.size === 0 &&
                          !region.touchesEdge;
      if (!isSmallLake) {
        region.level = LEVEL.LEVEL1;
      }
      // Small lakes stay at level 0 - will be filled after border inference
    }
  }

  // Fill water levels array
  for (const region of regions) {
    for (const { x, y } of region.coords) {
      waterLevels[y * COORD_WIDTH + x] = region.level;
    }
  }

  // Also assign levels to bridge pixels based on adjacent regions
  for (const [bridgeKey, regionIds] of bridgeToRegions) {
    const [bx, by] = bridgeKey.split(',').map(Number);
    // Use the highest level from adjacent regions
    let maxLevel = LEVEL.LEVEL1;
    for (const regionId of regionIds) {
      maxLevel = Math.max(maxLevel, regions[regionId].level);
    }
    waterLevels[by * COORD_WIDTH + bx] = maxLevel;
  }

  return waterLevels;
}

// Step 4: Classify levels using green channel thresholds
// Data model: levels contains LEVEL1/LEVEL2/LEVEL3 for EVERY coordinate (including water)
// Water mask is separate - each coordinate has both a level AND a water flag
// waterLevels: pre-computed levels for water pixels from inferWaterLevels()
function classifyLevels(colors: Uint8Array, waterMask: boolean[], waterLevels: Uint8Array): Uint8Array {
  const levels = new Uint8Array(COORD_WIDTH * COORD_HEIGHT);

  // Helper to check if pixel is "green-ish" (low red, low blue, varying green)
  function isGreenish(pixel: RGB): boolean {
    // Green terrain pixels have low R and B, with G being the dominant channel
    return pixel.r < 40 && pixel.b < 40 && pixel.g > pixel.r && pixel.g > pixel.b;
  }

  // Helper to check if pixel is red/orange/yellow (special markers)
  function isSpecialColor(pixel: RGB): boolean {
    // Bright red on level1: high R, low G, low B
    if (pixel.r > 150 && pixel.g < 50 && pixel.b < 50) return true;
    // Dull red on level2/3: medium-high R with slight G/B
    if (pixel.r > 100 && pixel.r > pixel.g * 2 && pixel.r > pixel.b * 2) return true;
    // Orange: high R, medium G, low B
    if (pixel.r > 200 && pixel.g > 100 && pixel.g < 220 && pixel.b < 180) return true;
    // Yellow: high R, high G, low B
    if (pixel.r > 200 && pixel.g > 200 && pixel.b < 100) return true;
    return false;
  }

  // First pass: classify land pixels, mark water as UNKNOWN temporarily
  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      const idx = y * COORD_WIDTH + x;
      const pixel = getPixelAt(colors, x, y);

      // Water pixels - use pre-computed water levels from topological inference
      // Level 0 means small lake - will be filled after border inference
      if (waterMask[idx]) {
        levels[idx] = waterLevels[idx]; // Keep 0 for small lakes
        continue;
      }

      // Edge border region → Level1 (8 units from edge)
      if (x < EDGE_BORDER_SIZE || x >= COORD_WIDTH - EDGE_BORDER_SIZE ||
          y < EDGE_BORDER_SIZE || y >= COORD_HEIGHT - EDGE_BORDER_SIZE) {
        levels[idx] = LEVEL.LEVEL1;
        continue;
      }

      // Special colors (red, orange, yellow markers)
      if (isSpecialColor(pixel)) {
        levels[idx] = LEVEL.SPECIAL;
        continue;
      }

      // For green-ish pixels, use green channel thresholds
      if (isGreenish(pixel)) {
        const g = pixel.g;
        if (g >= GREEN_THRESHOLDS.LEVEL1_MIN) {
          levels[idx] = LEVEL.LEVEL1;
        } else if (g >= GREEN_THRESHOLDS.BORDER_MIN) {
          levels[idx] = LEVEL.BORDER;
        } else if (g >= GREEN_THRESHOLDS.LEVEL2_MIN) {
          levels[idx] = LEVEL.LEVEL2;
        } else {
          levels[idx] = LEVEL.LEVEL3;
        }
        continue;
      }

      // For non-green pixels that aren't water or special, try to classify anyway
      // This handles JPEG artifacts that might blur colors
      const g = pixel.g;
      if (g >= GREEN_THRESHOLDS.LEVEL1_MIN) {
        levels[idx] = LEVEL.LEVEL1;
      } else if (g >= GREEN_THRESHOLDS.BORDER_MIN) {
        levels[idx] = LEVEL.BORDER;
      } else if (g >= GREEN_THRESHOLDS.LEVEL2_MIN) {
        levels[idx] = LEVEL.LEVEL2;
      } else if (g < 40 && pixel.r < 40 && pixel.b < 40) {
        // Very dark pixels (could be level3 or artifact)
        levels[idx] = LEVEL.LEVEL3;
      } else {
        // Default to level1 for unclear cases
        levels[idx] = LEVEL.LEVEL1;
      }
    }
  }

  // Debug: after initial color classification
  outputDebugImage('step3_initial_colors.png', levels, 'levels');

  // 8-connected neighbor offsets
  const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

  // Resolve special colors (red, orange, yellow markers) FIRST
  // This allows noise cleanup and border inference to treat them as proper levels
  // Special case: yellow pixels covering green borders should become BORDER tiles
  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      const idx = y * COORD_WIDTH + x;
      if (levels[idx] !== LEVEL.SPECIAL) continue;

      // Collect neighbor info
      const neighborCounts = { [LEVEL.LEVEL1]: 0, [LEVEL.LEVEL2]: 0, [LEVEL.LEVEL3]: 0 };
      const neighborLevels = new Set<number>();
      // Track border neighbors by position for contiguity check
      // Positions: 0=TL, 1=T, 2=TR, 3=L, 4=R, 5=BL, 6=B, 7=BR
      const borderPositions: boolean[] = [false, false, false, false, false, false, false, false];

      for (let d = 0; d < 8; d++) {
        const nx = x + dx[d], ny = y + dy[d];
        if (nx >= 0 && nx < COORD_WIDTH && ny >= 0 && ny < COORD_HEIGHT) {
          const nLevel = levels[ny * COORD_WIDTH + nx];
          if (nLevel === LEVEL.BORDER) {
            borderPositions[d] = true;
          } else if (nLevel === LEVEL.LEVEL1 || nLevel === LEVEL.LEVEL2 || nLevel === LEVEL.LEVEL3) {
            neighborCounts[nLevel]++;
            neighborLevels.add(nLevel);
          }
        }
      }

      // Check if this yellow pixel is actually covering a green border:
      // Case 1: Has at least 2 non-contiguous border neighbors AND 2+ different levels
      // Case 2: Has 5+ continuous border neighbors (surrounded by border)
      const borderCount = borderPositions.filter(b => b).length;
      const hasTopBorder = borderPositions[0] || borderPositions[1] || borderPositions[2];
      const hasBottomBorder = borderPositions[5] || borderPositions[6] || borderPositions[7];
      const hasLeftBorder = borderPositions[0] || borderPositions[3] || borderPositions[5];
      const hasRightBorder = borderPositions[2] || borderPositions[4] || borderPositions[7];
      const hasNonContiguousBorders = (hasTopBorder && hasBottomBorder) || (hasLeftBorder && hasRightBorder);

      // Check for 5+ continuous border neighbors in the ring
      // Ring order (clockwise): TL(0), T(1), TR(2), R(4), BR(7), B(6), BL(5), L(3)
      const ringOrder = [0, 1, 2, 4, 7, 6, 5, 3];
      let maxContinuous = 0;
      let currentRun = 0;
      // Check twice around to handle wrap-around
      for (let i = 0; i < 16; i++) {
        if (borderPositions[ringOrder[i % 8]]) {
          currentRun++;
          maxContinuous = Math.max(maxContinuous, currentRun);
        } else {
          currentRun = 0;
        }
      }
      const hasManyContiguousBorders = maxContinuous >= 5;

      if ((borderCount >= 2 && hasNonContiguousBorders && neighborLevels.size >= 2) || hasManyContiguousBorders) {
        // This yellow pixel is covering a border between levels
        levels[idx] = LEVEL.BORDER;
      } else if (neighborCounts[LEVEL.LEVEL3] >= neighborCounts[LEVEL.LEVEL2] &&
          neighborCounts[LEVEL.LEVEL3] >= neighborCounts[LEVEL.LEVEL1]) {
        levels[idx] = LEVEL.LEVEL3;
      } else if (neighborCounts[LEVEL.LEVEL2] >= neighborCounts[LEVEL.LEVEL1]) {
        levels[idx] = LEVEL.LEVEL2;
      } else {
        levels[idx] = LEVEL.LEVEL1;
      }
    }
  }

  // Debug: after special color resolution
  outputDebugImage('step4_special_colors.png', levels, 'levels');

  // Noise cleanup: remove isolated pixels (1 or fewer same-type neighbors)
  // Only clean if there's a different level1/2/3 neighbor - preserve pixels surrounded by borders
  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      const idx = y * COORD_WIDTH + x;
      const currentLevel = levels[idx];

      // Only clean level1/level2/level3 pixels (not borders)
      if (currentLevel !== LEVEL.LEVEL1 && currentLevel !== LEVEL.LEVEL2 &&
          currentLevel !== LEVEL.LEVEL3) continue;

      // Count same-type neighbors and check for different level neighbors
      let sameTypeCount = 0;
      let hasDifferentLevelNeighbor = false;
      const neighborCounts = new Map<number, number>();

      for (let d = 0; d < 8; d++) {
        const nx = x + dx[d], ny = y + dy[d];
        if (nx >= 0 && nx < COORD_WIDTH && ny >= 0 && ny < COORD_HEIGHT) {
          const nLevel = levels[ny * COORD_WIDTH + nx];
          neighborCounts.set(nLevel, (neighborCounts.get(nLevel) || 0) + 1);
          if (nLevel === currentLevel) {
            sameTypeCount++;
          } else if (nLevel === LEVEL.LEVEL1 || nLevel === LEVEL.LEVEL2 || nLevel === LEVEL.LEVEL3) {
            hasDifferentLevelNeighbor = true;
          }
        }
      }

      // Only replace if isolated AND has a different level neighbor
      // This preserves pixels surrounded only by borders (they'll be handled in border inference)
      if (sameTypeCount <= 1 && hasDifferentLevelNeighbor) {
        let maxCount = 0, majorityLevel = currentLevel;
        for (const [level, count] of neighborCounts) {
          if (count > maxCount) { maxCount = count; majorityLevel = level; }
        }
        levels[idx] = majorityLevel;
      }
    }
  }

  // Debug: after noise cleanup
  outputDebugImage('step5_noise_cleanup.png', levels, 'levels');

  // Border inference: continue until no borders remain
  // Uses double-buffering to avoid left-to-right bias within each iteration
  let bordersRemaining = true;
  let borderIteration = 0;
  while (bordersRemaining) {
    bordersRemaining = false;

    // Snapshot of levels from previous round - read from this
    const prevLevels = new Uint8Array(levels);

    for (let y = 0; y < COORD_HEIGHT; y++) {
      for (let x = 0; x < COORD_WIDTH; x++) {
        const idx = y * COORD_WIDTH + x;
        if (prevLevels[idx] !== LEVEL.BORDER) continue;  // Read from prevLevels

        // Count neighbor levels from PREVIOUS round (not border, not unknown)
        const neighborLevels = new Set<number>();
        let hasBorderNeighbor = false;

        for (let d = 0; d < 8; d++) {
          const nx = x + dx[d], ny = y + dy[d];
          if (nx >= 0 && nx < COORD_WIDTH && ny >= 0 && ny < COORD_HEIGHT) {
            const nLevel = prevLevels[ny * COORD_WIDTH + nx];  // Read from prevLevels
            if (nLevel === LEVEL.BORDER) {
              hasBorderNeighbor = true;
            } else if (nLevel === LEVEL.LEVEL1 || nLevel === LEVEL.LEVEL2 || nLevel === LEVEL.LEVEL3) {
              neighborLevels.add(nLevel);
            }
          }
        }

        // Write to levels (current array)
        if (neighborLevels.size >= 2) {
          // Multiple levels: choose highest (level3 > level2 > level1)
          if (neighborLevels.has(LEVEL.LEVEL3)) levels[idx] = LEVEL.LEVEL3;
          else if (neighborLevels.has(LEVEL.LEVEL2)) levels[idx] = LEVEL.LEVEL2;
          else levels[idx] = LEVEL.LEVEL1;
        } else if (neighborLevels.size === 1) {
          // Single level: go one level higher
          const theLevel = neighborLevels.values().next().value;
          if (theLevel === LEVEL.LEVEL1) levels[idx] = LEVEL.LEVEL2;
          else if (theLevel === LEVEL.LEVEL2) levels[idx] = LEVEL.LEVEL3;
          else levels[idx] = LEVEL.LEVEL3; // level3 stays level3
        } else if (hasBorderNeighbor) {
          // Only border neighbors: wait for next pass
          bordersRemaining = true;
        } else {
          // No valid neighbors: default to level1
          levels[idx] = LEVEL.LEVEL1;
        }
      }
    }

    // Debug: after each border inference iteration
    const iterLetter = String.fromCharCode(97 + borderIteration); // a, b, c, ...
    outputDebugImage(`step6${iterLetter}_border_inference.png`, levels, 'levels');
    borderIteration++;
  }

  // Fill small lakes using neighbor sampling
  // Small lakes were left with level 0 by inferWaterLevels() - now fill them based on surrounding land
  const lakeVisited = new Array(COORD_WIDTH * COORD_HEIGHT).fill(false);
  const cardinalDx = [0, 1, 0, -1];
  const cardinalDy = [-1, 0, 1, 0];

  function floodFillLake(startX: number, startY: number): {
    coords: { x: number; y: number }[];
    landNeighborLevels: Map<number, number>;
  } {
    const coords: { x: number; y: number }[] = [];
    const landNeighborLevels = new Map<number, number>();
    const stack = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * COORD_WIDTH + x;

      if (x < 0 || x >= COORD_WIDTH || y < 0 || y >= COORD_HEIGHT) continue;
      if (lakeVisited[idx]) continue;

      // Check if this is water with unassigned level (small lake)
      if (!waterMask?.[idx] || levels[idx] !== 0) {
        // This is land or already-assigned water - count its level
        const landLevel = levels[idx];
        if (landLevel === LEVEL.LEVEL1 || landLevel === LEVEL.LEVEL2 || landLevel === LEVEL.LEVEL3) {
          landNeighborLevels.set(landLevel, (landNeighborLevels.get(landLevel) || 0) + 1);
        }
        continue;
      }

      lakeVisited[idx] = true;
      coords.push({ x, y });

      // Expand in 4 cardinal directions
      for (let d = 0; d < 4; d++) {
        stack.push({ x: x + cardinalDx[d], y: y + cardinalDy[d] });
      }
    }

    return { coords, landNeighborLevels };
  }

  // Find and fill all small lakes
  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      const idx = y * COORD_WIDTH + x;
      // Look for unassigned water pixels (level 0 in water mask)
      if (!waterMask?.[idx] || lakeVisited[idx] || levels[idx] !== 0) continue;

      const { coords, landNeighborLevels } = floodFillLake(x, y);

      // Determine predominant surrounding level
      let maxCount = 0;
      let assignedLevel = LEVEL.LEVEL1; // Default
      for (const [level, count] of landNeighborLevels) {
        if (count > maxCount) {
          maxCount = count;
          assignedLevel = level;
        }
      }

      // Assign level to all coordinates in this lake
      for (const { x: lx, y: ly } of coords) {
        levels[ly * COORD_WIDTH + lx] = assignedLevel;
      }
    }
  }

  outputDebugImage('step7_lake_fill.png', levels, 'levels');

  // Final pass: convert any remaining non-level1/2/3 pixels to majority neighbor level
  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      const idx = y * COORD_WIDTH + x;
      const currentLevel = levels[idx];

      // Skip if already a valid level
      if (currentLevel === LEVEL.LEVEL1 || currentLevel === LEVEL.LEVEL2 || currentLevel === LEVEL.LEVEL3) {
        continue;
      }

      // Find majority level among neighbors
      const neighborCounts = { [LEVEL.LEVEL1]: 0, [LEVEL.LEVEL2]: 0, [LEVEL.LEVEL3]: 0 };
      for (let d = 0; d < 8; d++) {
        const nx = x + dx[d], ny = y + dy[d];
        if (nx >= 0 && nx < COORD_WIDTH && ny >= 0 && ny < COORD_HEIGHT) {
          const nLevel = levels[ny * COORD_WIDTH + nx];
          if (nLevel in neighborCounts) {
            neighborCounts[nLevel]++;
          }
        }
      }

      // Assign majority level (default to level1 if no valid neighbors)
      if (neighborCounts[LEVEL.LEVEL3] >= neighborCounts[LEVEL.LEVEL2] &&
          neighborCounts[LEVEL.LEVEL3] >= neighborCounts[LEVEL.LEVEL1] &&
          neighborCounts[LEVEL.LEVEL3] > 0) {
        levels[idx] = LEVEL.LEVEL3;
      } else if (neighborCounts[LEVEL.LEVEL2] >= neighborCounts[LEVEL.LEVEL1] &&
                 neighborCounts[LEVEL.LEVEL2] > 0) {
        levels[idx] = LEVEL.LEVEL2;
      } else {
        levels[idx] = LEVEL.LEVEL1;
      }
    }
  }

  outputDebugImage('step7a_fill_unknown.png', levels, 'levels');

  return levels;
}

// Step 5: Cleanup terrain (remove small regions)
function cleanupTerrain(levels: Uint8Array, waterMask: boolean[]): Uint8Array {
  const cleaned = new Uint8Array(levels);
  const visited = new Array(COORD_WIDTH * COORD_HEIGHT).fill(false);
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];

  // Flood fill to find regions - only collects coords, doesn't count neighbors
  function floodFill(startX: number, startY: number, targetLevel: number): { x: number; y: number }[] {
    const coords: { x: number; y: number }[] = [];
    const stack = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * COORD_WIDTH + x;

      if (x < 0 || x >= COORD_WIDTH || y < 0 || y >= COORD_HEIGHT) continue;
      if (visited[idx]) continue;
      if (cleaned[idx] !== targetLevel) continue;  // Not part of this region

      visited[idx] = true;
      coords.push({ x, y });

      for (let d = 0; d < 4; d++) {
        stack.push({ x: x + dx[d], y: y + dy[d] });
      }
    }

    return coords;
  }

  // Find and clean small regions
  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      const idx = y * COORD_WIDTH + x;
      if (visited[idx]) continue;

      const level = cleaned[idx];
      const coords = floodFill(x, y, level);

      if (coords.length < 10 && coords.length > 0) {
        // Count neighbors AFTER flood fill by checking all coords' neighbors
        const neighbors = new Map<number, number>();
        for (const { x: cx, y: cy } of coords) {
          for (let d = 0; d < 4; d++) {
            const nx = cx + dx[d], ny = cy + dy[d];
            if (nx >= 0 && nx < COORD_WIDTH && ny >= 0 && ny < COORD_HEIGHT) {
              const nLevel = cleaned[ny * COORD_WIDTH + nx];
              if (nLevel !== level) {  // Different level = neighbor
                neighbors.set(nLevel, (neighbors.get(nLevel) || 0) + 1);
              }
            }
          }
        }

        // Find predominant neighbor level
        let maxCount = 0;
        let replaceLevel = LEVEL.LEVEL1;
        for (const [nLevel, count] of neighbors) {
          if (count > maxCount) {
            maxCount = count;
            replaceLevel = nLevel;
          }
        }

        // Replace small region
        for (const { x: cx, y: cy } of coords) {
          cleaned[cy * COORD_WIDTH + cx] = replaceLevel;
        }
      }
    }
  }

  return cleaned;
}

// Step 6: Generate debug image
function outputDebugImage(filename: string, data: Uint8Array | boolean[], type: 'colors' | 'water' | 'levels', waterMask?: boolean[]): void {
  // Skip debug image downloads during batch processing
  if (batchMode) return;

  const canvas = document.createElement('canvas');
  canvas.width = COORD_WIDTH;
  canvas.height = COORD_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(COORD_WIDTH, COORD_HEIGHT);

  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      const idx = y * COORD_WIDTH + x;
      const outIdx = idx * 4;

      if (type === 'colors') {
        const colors = data as Uint8Array;
        imageData.data[outIdx] = colors[idx * 3];
        imageData.data[outIdx + 1] = colors[idx * 3 + 1];
        imageData.data[outIdx + 2] = colors[idx * 3 + 2];
      } else if (type === 'water') {
        // Use water color from colors.ts: #83e1c3
        const water = data as boolean[];
        if (water[idx]) {
          imageData.data[outIdx] = 0x83;     // #83e1c3
          imageData.data[outIdx + 1] = 0xe1;
          imageData.data[outIdx + 2] = 0xc3;
        } else {
          imageData.data[outIdx] = 0x34;     // #347941 (level1 as background)
          imageData.data[outIdx + 1] = 0x79;
          imageData.data[outIdx + 2] = 0x41;
        }
      } else if (type === 'levels') {
        // Use colors from colors.ts for consistency:
        // level1: #347941, level2: #35a043, level3: #4ac34e
        // Water pixels are transparent if waterMask is provided
        const levels = data as Uint8Array;

        if (waterMask?.[idx]) {
          // Transparent - don't show water pixels in level output
          imageData.data[outIdx] = 0;
          imageData.data[outIdx + 1] = 0;
          imageData.data[outIdx + 2] = 0;
          imageData.data[outIdx + 3] = 0;
          continue; // Skip setting alpha to 255 below
        }

        switch (levels[idx]) {
          case LEVEL.LEVEL1:
            imageData.data[outIdx] = 0x34;     // #347941
            imageData.data[outIdx + 1] = 0x79;
            imageData.data[outIdx + 2] = 0x41;
            break;
          case LEVEL.LEVEL2:
            imageData.data[outIdx] = 0x35;     // #35a043
            imageData.data[outIdx + 1] = 0xa0;
            imageData.data[outIdx + 2] = 0x43;
            break;
          case LEVEL.LEVEL3:
            imageData.data[outIdx] = 0x4a;     // #4ac34e
            imageData.data[outIdx + 1] = 0xc3;
            imageData.data[outIdx + 2] = 0x4e;
            break;
          default:
            imageData.data[outIdx] = 128;
            imageData.data[outIdx + 1] = 128;
            imageData.data[outIdx + 2] = 128;
        }
      }
      imageData.data[outIdx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Download as PNG
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Debug output: water mask with bridge lines highlighted
function outputWaterBridgesDebug(filename: string, waterMask: boolean[], bridgeLines: BridgeLine[]): void {
  if (batchMode) return;

  const canvas = document.createElement('canvas');
  canvas.width = COORD_WIDTH;
  canvas.height = COORD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Background (level1 green)
  ctx.fillStyle = '#347941';
  ctx.fillRect(0, 0, COORD_WIDTH, COORD_HEIGHT);

  // Draw water in cyan
  ctx.fillStyle = '#83e1c3';
  for (let y = 0; y < COORD_HEIGHT; y++) {
    for (let x = 0; x < COORD_WIDTH; x++) {
      if (waterMask[y * COORD_WIDTH + x]) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Draw bridge lines in magenta
  ctx.fillStyle = '#ff00ff';
  for (const bridge of bridgeLines) {
    if (bridge.isHorizontal) {
      for (let x = bridge.start.x; x <= bridge.end.x; x++) {
        ctx.fillRect(x, bridge.start.y, 1, 1);
      }
    } else {
      for (let y = bridge.start.y; y <= bridge.end.y; y++) {
        ctx.fillRect(bridge.start.x, y, 1, 1);
      }
    }
  }

  // Download as PNG
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Step 7: Vectorize terrain to SVG using marching squares for smooth diagonals
function vectorizeTerrain(levels: Uint8Array, waterMask: boolean[]): string {
  // Colors from colors.ts: water: #83e1c3, level1: #347941, level2: #35a043, level3: #4ac34e
  const COLORS = {
    WATER: '#83e1c3',
    LEVEL1: '#347941',
    LEVEL2: '#35a043',
    LEVEL3: '#4ac34e',
  };

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COORD_WIDTH} ${COORD_HEIGHT}" width="${COORD_WIDTH * 4}" height="${COORD_HEIGHT * 4}">\n`;

  // Level 1 background (full rectangle)
  svg += `  <rect x="0" y="0" width="${COORD_WIDTH}" height="${COORD_HEIGHT}" fill="${COLORS.LEVEL1}" />\n`;

  // Pixel boundary tracing with corner cutting
  // Traces boundaries at integer pixel coordinates creates 45° diagonal cuts where direction changes
  function buildPixelContourPath(checkFn: (x: number, y: number) => boolean, fill: string, opacity?: number): string {
    type Edge = { x1: number; y1: number; x2: number; y2: number };
    const edges: Edge[] = [];

    // Helper to check if a pixel is inside (with bounds checking)
    const isInside = (x: number, y: number): boolean => {
      if (x < 0 || x >= COORD_WIDTH || y < 0 || y >= COORD_HEIGHT) return false;
      return checkFn(x, y);
    };

    // Find all boundary edges at integer pixel coordinates
    // For each inside pixel, check each of its 4 sides for outside neighbors
    // Edges are ordered counterclockwise around the inside region
    for (let y = 0; y < COORD_HEIGHT; y++) {
      for (let x = 0; x < COORD_WIDTH; x++) {
        if (!isInside(x, y)) continue;

        // Top edge: if pixel above is outside, add edge from (x,y) to (x+1,y)
        if (!isInside(x, y - 1)) {
          edges.push({ x1: x, y1: y, x2: x + 1, y2: y });
        }
        // Right edge: if pixel to right is outside, add edge from (x+1,y) to (x+1,y+1)
        if (!isInside(x + 1, y)) {
          edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
        }
        // Bottom edge: if pixel below is outside, add edge from (x+1,y+1) to (x,y+1)
        if (!isInside(x, y + 1)) {
          edges.push({ x1: x + 1, y1: y + 1, x2: x, y2: y + 1 });
        }
        // Left edge: if pixel to left is outside, add edge from (x,y+1) to (x,y)
        if (!isInside(x - 1, y)) {
          edges.push({ x1: x, y1: y + 1, x2: x, y2: y });
        }
      }
    }

    if (edges.length === 0) return '';

    // Build adjacency map: for each endpoint, find edges starting there
    const edgesByStart = new Map<string, Edge[]>();
    for (const edge of edges) {
      const key = `${edge.x1},${edge.y1}`;
      if (!edgesByStart.has(key)) edgesByStart.set(key, []);
      edgesByStart.get(key)!.push(edge);
    }

    // Connect edges into closed paths
    const paths: string[] = [];
    const used = new Set<Edge>();

    for (const startEdge of edges) {
      if (used.has(startEdge)) continue;

      // Collect path vertices at integer coordinates
      const pathVertices: { x: number; y: number }[] = [];
      let currentEdge: Edge | undefined = startEdge;

      while (currentEdge && !used.has(currentEdge)) {
        used.add(currentEdge);
        pathVertices.push({ x: currentEdge.x1, y: currentEdge.y1 });

        // Find next edge starting at current edge's endpoint
        const nextKey = `${currentEdge.x2},${currentEdge.y2}`;
        const candidates = edgesByStart.get(nextKey);
        currentEdge = candidates?.find(e => !used.has(e));
      }

      if (pathVertices.length < 3) continue;

      // corner cut: skip vertices on outwards facing corners to effectively cut corners
      // this also has the effect of cutting outwards single pixels which is desireable.
      // makes the assumption that every edge is a horizontal/vertical 1 unit long edge
      const trimmedVertices: { x: number; y: number }[] = [];
      for (let i = 0; i < pathVertices.length; i++) {
        const prev = pathVertices[(i - 1 + pathVertices.length) % pathVertices.length];
        const curr = pathVertices[i];
        const next = pathVertices[(i + 1) % pathVertices.length];

        // don't cut corners specifically for the river exit vertices
        // extend river exits by one to avoid a seam
        if (curr.x === 12) { // east river exit
          if (curr.y >= 38 && curr.y <= 42) 
            curr.x -= 1;
            trimmedVertices.push(curr);
          continue;
        }
        if (curr.x === 100) {
          if (curr.y >= 38 && curr.y <= 42) {
            curr.x += 1;
            trimmedVertices.push(curr);
          }
          continue;
        }
        if (curr.y === 84) {
          if (curr.x >= 22 && curr.x <= 26 // south left
            || curr.x >= 86 && curr.x <= 90 // south right
            || curr.x >= 38 && curr.x <= 42 // east layout
            || curr.x >= 70 && curr.x <= 74 // west layout)
          ) {
            curr.y += 1;
            trimmedVertices.push(curr);
          }
          continue;
        }

        // Check if outwards corner (convex) using cross product
        // For CCW loop: cross > 0 means turning right = outward corner
        const inDx = curr.x - prev.x;
        const inDy = curr.y - prev.y;
        const outDx = next.x - curr.x;
        const outDy = next.y - curr.y;
        const cross = inDx * outDy - inDy * outDx;
        const isOutwardsCorner = cross > 0;

        if (!isOutwardsCorner) {
          trimmedVertices.push(curr);
        }
      }

      // Simplify: merge collinear segments (remove intermediate points on straight lines)
      const simplified: { x: number; y: number }[] = [];
      for (let i = 0; i < trimmedVertices.length; i++) {
        const prev = simplified.length > 0 ? simplified[simplified.length - 1] : trimmedVertices[(i - 1 + trimmedVertices.length) % trimmedVertices.length];
        const curr = trimmedVertices[i];
        const next = trimmedVertices[(i + 1) % trimmedVertices.length];

        // Check if prev->curr->next are collinear
        const dx1 = curr.x - prev.x;
        const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x;
        const dy2 = next.y - curr.y;

        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        if (len1 < 0.001 || len2 < 0.001) {
          continue; // Skip zero-length segment
        }

        const ndx1 = dx1 / len1, ndy1 = dy1 / len1;
        const ndx2 = dx2 / len2, ndy2 = dy2 / len2;

        // If direction changes, keep this point
        if (Math.abs(ndx1 - ndx2) > 0.001 || Math.abs(ndy1 - ndy2) > 0.001) {
          simplified.push(curr);
        }
      }

      if (simplified.length >= 3) {
        let pathStr = `M${simplified[0].x},${simplified[0].y}`;
        for (let j = 1; j < simplified.length; j++) {
          pathStr += `L${simplified[j].x},${simplified[j].y}`;
        }
        pathStr += 'Z';
        paths.push(pathStr);
      }
    }

    const opacityAttr = opacity !== undefined ? ` fill-opacity="${opacity}"` : '';
    return paths.length > 0 ? `  <path d="${paths.join(' ')}" fill="${fill}"${opacityAttr} fill-rule="evenodd" />\n` : '';
  }

  // Level2 layer: includes Level2 + Level3 regions
  svg += buildPixelContourPath(
    (x, y) => {
      const level = levels[y * COORD_WIDTH + x];
      return level === LEVEL.LEVEL2 || level === LEVEL.LEVEL3;
    },
    COLORS.LEVEL2
  );

  // Level3 layer: only Level3 regions
  svg += buildPixelContourPath(
    (x, y) => levels[y * COORD_WIDTH + x] === LEVEL.LEVEL3,
    COLORS.LEVEL3
  );

  // Water layer: from water mask (90% opacity)
  svg += buildPixelContourPath(
    (x, y) => waterMask[y * COORD_WIDTH + x],
    COLORS.WATER,
    0.5
  );

  svg += `</svg>`;
  return svg;
}

// Core extraction logic - returns SVG string
async function extractSingleMap(imagePath: string): Promise<string> {
  const image = await loadImageAsync(imagePath);
  const coordColors = pixelateImage(image);
  const { waterMask, bridgeLines } = classifyWater(coordColors);
  const cleanWaterMask = cleanupWater(waterMask);
  const waterLevels = inferWaterLevels(cleanWaterMask, bridgeLines, coordColors);
  const levelMap = classifyLevels(coordColors, cleanWaterMask, waterLevels);
  const cleanLevelMap = cleanupTerrain(levelMap, cleanWaterMask);
  const svg = vectorizeTerrain(cleanLevelMap, cleanWaterMask);
  return svg;
}

// Extract single map with debug output (for testing)
async function extractBaseMapTerrain(): Promise<void> {
  console.log('Starting base map terrain extraction...');

  try {
    const imagePath = 'static/base_maps/94 - nL0gcY9.jpg';
    console.log(`Loading image: ${imagePath}`);
    const image = await loadImageAsync(imagePath);
    console.log(`Image loaded: ${image.width}x${image.height}`);

    console.log('Step 1: Pixelating image...');
    const coordColors = pixelateImage(image);
    outputDebugImage('step1_pixelated.png', coordColors, 'colors');
    console.log('Step 1 complete');

    console.log('Step 2: Classifying water...');
    const { waterMask, bridgeLines } = classifyWater(coordColors);
    outputDebugImage('step2_water.png', waterMask, 'water');
    outputWaterBridgesDebug('step2a_water_bridges.png', waterMask, bridgeLines);
    console.log(`Step 2 complete: ${bridgeLines.length} bridges found`);

    const cleanWaterMask = cleanupWater(waterMask);

    console.log('Step 2b: Inferring water levels from bridge topology...');
    const waterLevels = inferWaterLevels(cleanWaterMask, bridgeLines, coordColors);
    outputDebugImage('step2b_water_levels.png', waterLevels, 'levels');
    console.log('Step 2b complete: water levels inferred');

    console.log('Step 3-7: Classifying levels...');
    const levelMap = classifyLevels(coordColors, cleanWaterMask, waterLevels);
    console.log('Level classification complete');

    console.log('Step 8: Cleaning up terrain...');
    const cleanLevelMap = cleanupTerrain(levelMap, cleanWaterMask);
    outputDebugImage('step8_terrain_clean.png', cleanLevelMap, 'levels');
    console.log('Step 8 complete');

    console.log('Step 9: Vectorizing terrain...');
    const svg = vectorizeTerrain(cleanLevelMap, cleanWaterMask);
    downloadTextFile(svg, 'step9_terrain.svg');
    console.log('Step 9 complete');

    console.log('Base map terrain extraction complete!');
  } catch (error) {
    console.error('Terrain extraction failed:', error);
  }
}

// Extract all base maps and package as ZIP
async function extractAllBaseMapTerrains(): Promise<void> {
  console.log('Starting batch base map extraction...');

  try {
    // Dynamic import - only loaded when this function runs (dev only)
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    batchMode = true;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < BASE_MAP_FILES.length; i++) {
      const filename = BASE_MAP_FILES[i];
      console.log(`Processing ${i + 1}/${BASE_MAP_FILES.length}: ${filename}`);

      try {
        const imagePath = `static/base_maps/${filename}`;
        const svg = await extractSingleMap(imagePath);

        // Add to ZIP with map number as filename
        const mapName = filename.replace('.jpg', '');
        zip.file(`${mapName}.svg`, svg);
        successCount++;
      } catch (error) {
        console.error(`Failed to process ${filename}:`, error);
        failCount++;
      }
    }

    batchMode = false;

    console.log(`Batch complete: ${successCount} succeeded, ${failCount} failed`);

    // Generate and download ZIP
    console.log('Generating ZIP file...');
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'base_map_terrains.zip';
    link.click();

    console.log('ZIP download started!');
  } catch (error) {
    batchMode = false;
    console.error('Batch extraction failed:', error);
  }
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
    { label: 'Extract Base Map', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      extractBaseMapTerrain();
    }},
    { label: 'Extract All Maps', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      extractAllBaseMapTerrains();
    }},
    { label: 'Toggle Edge Tiles', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleEdgeTileLayerVisibility();
    }},
    { label: 'Load Base Map 1', action: async () => {
      hideDevMenu();
      isMenuOpen = false;
      await loadBaseMapFromSvg(1);
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
