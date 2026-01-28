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
let isTileTracerModeActive = false;
let tileTracerRaster: paper.Raster | null = null;
let tileTracerButtons: HTMLDivElement | null = null;
let tileTracerImageIndex = 0;
let highlightRect: paper.Path.Rectangle | null = null;
let postfixDropdown: HTMLDivElement | null = null;

// List of tile images (excluding placeholders)
const tileImages: string[] = [
  'static/tiles/airport/34 - OmmYDBq.png',
  'static/tiles/airport/35 - bawoPn6.png',
  'static/tiles/bottom/29 - QJsmplp copy.png',
  'static/tiles/bottom/29 - QJsmplp.png',
  'static/tiles/bottom/30 - X7FbpvK.png',
  'static/tiles/bottom/31 - LRICn1q.png',
  'static/tiles/bottom/32 - BJ16eY9.png',
  'static/tiles/bottom_left/48 - iLjCW2O.png',
  'static/tiles/bottom_left/49 - epj7EMt.png',
  'static/tiles/bottom_left/50 - keMBShp.png',
  'static/tiles/bottom_left/51 - rjaAFsj.png',
  'static/tiles/bottom_left_dock/52 - bvT1yJ7.png',
  'static/tiles/bottom_left_dock/53 - W1DZoXV.png',
  'static/tiles/bottom_right/39 - AjicFEz.png',
  'static/tiles/bottom_right/40 - BsmCSdo.png',
  'static/tiles/bottom_right/41 - Ubewm2Y.png',
  'static/tiles/bottom_right/42 - 3TX1fOO.png',
  'static/tiles/bottom_right_dock/43 - lRh7pLD.png',
  'static/tiles/bottom_right_dock/44 - Kkxl2RH.png',
  'static/tiles/bottom_river/45 - iaL3IcU.png',
  'static/tiles/bottom_river/46 - TIj5eT1.png',
  'static/tiles/bottom_river/47 - szIJe08.png',
  'static/tiles/left/54 - qCe5VxM.png',
  'static/tiles/left/55 - MJwO2PW.png',
  'static/tiles/left/56 - G7cJXjm.png',
  'static/tiles/left/57 - pJU2kTE.png',
  'static/tiles/left/58 - r720Voz.png',
  'static/tiles/left_peninsula/59 - Dy1isCL.png',
  'static/tiles/left_peninsula/60 - oTGqpUF.png',
  'static/tiles/left_peninsula/61 - 4w4i9nr.png',
  'static/tiles/left_river/62 - 3EvOplj.png',
  'static/tiles/left_river/63 - EX7BYGw.png',
  'static/tiles/left_rock/64 - xifLxPa.png',
  'static/tiles/left_rock/65 - pFh72wi.png',
  'static/tiles/left_rock/66 - TnsI1wo.png',
  'static/tiles/left_rock/67 - mQNwwge.png',
  'static/tiles/right/1 - ISdNX8N.png',
  'static/tiles/right/2 - 0Nl1fz8.png',
  'static/tiles/right/3 - 8lHF1d5.png',
  'static/tiles/right/68 - KBHEtY0.png',
  'static/tiles/right/69 - BCpO1K5.png',
  'static/tiles/right_peninsula/4 - ZLMp5LA.png',
  'static/tiles/right_peninsula/5 - gZVRJnv.png',
  'static/tiles/right_peninsula/6 - ydnTxJO.png',
  'static/tiles/right_river/7 - OZtIhTC.png',
  'static/tiles/right_river/8 - hWGQub0.png',
  'static/tiles/right_rock/10 - ByrJZyo.png',
  'static/tiles/right_rock/11 - Ar9LNtJ.png',
  'static/tiles/right_rock/12 - UgoRJy3.png',
  'static/tiles/right_rock/9 - YSjtaWO.png',
  'static/tiles/top/19 - ZN9h9K4.png',
  'static/tiles/top/20 - hTYvr5L.png',
  'static/tiles/top/21 - 2lzjMi4.png',
  'static/tiles/top/22 - 1w29p5L.png',
  'static/tiles/top/23 - 5JzK0IN.png',
  'static/tiles/top/24 - qtgHzOc.png',
  'static/tiles/top/25 - pN01yZH.png',
  'static/tiles/top_left/26 - 3sy5W7R.png',
  'static/tiles/top_left/27 - mKkuBGS.png',
  'static/tiles/top_left/28 - Wsc0wcG.png',
  'static/tiles/top_right/13 - PCgPfdN.png',
  'static/tiles/top_right/14 - f8zzseF.png',
  'static/tiles/top_right/15 - IXhHmuY.png',
  'static/tiles/top_secret_beach/16 - J9KTWix.png',
  'static/tiles/top_secret_beach/17 - TJTblBV.png',
  'static/tiles/top_secret_beach/18 - 4F6lHPo.png',
];

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
  if ((pathItem as paper.CompoundPath).children) {
    return (pathItem as paper.CompoundPath).children.map((path) => {
      return encodePath(path as paper.Path);
    });
  } else {
    return encodePath(pathItem as paper.Path);
  }
}

function extractTileData(blockX: number, blockY: number): object {
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

  // Iterate through state.drawing (all terrain/path layers)
  Object.entries(state.drawing).forEach(([colorKey, pathItem]) => {
    if (pathItem) {
      try {
        // Intersect with tile boundary
        const clipped = pathItem.intersect(clipPath, { insert: false });
        if (clipped && !clipped.isEmpty()) {
          // Translate to origin (0,0) so data is position-independent
          clipped.translate(new paper.Point(-offsetX, -offsetY));
          // Encode the clipped path using color name for compatibility
          const colorName = colors[colorKey]?.name || colorKey;
          extractedPaths[colorName] = encodePathItem(clipped);
          clipped.remove();
        }
      } catch (e) {
        console.warn(`Failed to clip path for ${colorKey}:`, e);
      }
    }
  });

  return { version: 1, drawing: extractedPaths };
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
function prepTileDataForExport(data: { version: number; drawing: Record<string, number[] | number[][]> }): { version: number; drawing: Record<string, number[] | number[][]> } {
  const grassColorNames = ['level1', 'level2', 'level3'];
  const result: Record<string, number[] | number[][]> = {};

  // Step 1: Collect and unite all grass paths using Paper.js unite()
  let unitedGrass: paper.PathItem | null = null;

  for (const [colorName, pathData] of Object.entries(data.drawing)) {
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
  for (const [colorName, pathData] of Object.entries(data.drawing)) {
    if (grassColorNames.includes(colorName)) {
      continue; // Skip grass layers (already merged into level1)
    }

    if (!pathData || pathData.length === 0) {
      continue;
    }

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

  // Clean up united grass path
  if (unitedGrass) {
    unitedGrass.remove();
  }

  return { version: data.version, drawing: result };
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
  hidePostfixDropdown();

  const positionName = getTilePositionName(blockX, blockY);
  const options = postfixOptions[positionName] || [];

  postfixDropdown = document.createElement('div');
  postfixDropdown.style.cssText = `
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

  const title = document.createElement('div');
  title.textContent = `Export: ${positionName}`;
  title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #726a5a;';
  postfixDropdown.appendChild(title);

  // Base option (no postfix)
  const baseButton = createDropdownButton(positionName, () => {
    exportTile(blockX, blockY, positionName);
  });
  postfixDropdown.appendChild(baseButton);

  // Postfix options
  options.forEach((postfix) => {
    const fullName = `${positionName}_${postfix}`;
    const button = createDropdownButton(fullName, () => {
      exportTile(blockX, blockY, fullName);
    });
    postfixDropdown!.appendChild(button);
  });

  // Cancel button
  const cancelButton = createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    // Fully deactivate extract mode
    if (isExtractModeActive) {
      toggleExtractMode();
    }
  }, true);
  postfixDropdown.appendChild(cancelButton);

  document.body.appendChild(postfixDropdown);
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
  hidePostfixDropdown();

  postfixDropdown = document.createElement('div');
  postfixDropdown.style.cssText = `
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

  const title = document.createElement('div');
  title.textContent = `Load into tile (${blockX}, ${blockY})`;
  title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #726a5a;';
  postfixDropdown.appendChild(title);

  const loadButton = createDropdownButton('Load File...', () => {
    openFileDialog(blockX, blockY);
  });
  postfixDropdown.appendChild(loadButton);

  const cancelButton = createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isLoadModeActive) {
      toggleLoadMode();
    }
  }, true);
  postfixDropdown.appendChild(cancelButton);

  document.body.appendChild(postfixDropdown);
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
  hidePostfixDropdown();

  const positionName = getTilePositionName(blockX, blockY);
  const options = postfixOptions[positionName] || [];

  postfixDropdown = document.createElement('div');
  postfixDropdown.style.cssText = `
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

  const title = document.createElement('div');
  title.textContent = `Export SVG: ${positionName}`;
  title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #726a5a;';
  postfixDropdown.appendChild(title);

  // Base option
  const baseButton = createDropdownButton(positionName, () => {
    exportTileSvg(blockX, blockY, positionName);
  });
  postfixDropdown.appendChild(baseButton);

  // Postfix options
  options.forEach((postfix) => {
    const fullName = `${positionName}_${postfix}`;
    const button = createDropdownButton(fullName, () => {
      exportTileSvg(blockX, blockY, fullName);
    });
    postfixDropdown!.appendChild(button);
  });

  // Cancel button
  const cancelButton = createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isSvgExportModeActive) {
      toggleSvgExportMode();
    }
  }, true);
  postfixDropdown.appendChild(cancelButton);

  document.body.appendChild(postfixDropdown);
}

function exportTileSvg(blockX: number, blockY: number, filename: string): void {
  const data = extractTileData(blockX, blockY) as { version: number; drawing: Record<string, number[] | number[][]> };
  const preppedData = prepTileDataForExport(data);
  const svg = tileDataToSvg(preppedData);
  downloadSvg(svg, `${filename}.svg`);
  hidePostfixDropdown();
  clearHighlight();
  if (isSvgExportModeActive) {
    toggleSvgExportMode();
  }
}

function tileDataToSvg(data: { version: number; drawing: Record<string, number[] | number[][]> }): string {
  // Data is already prepped by prepTileDataForExport: grass merged, water added, subtractions done
  const paths: string[] = [];

  Object.entries(data.drawing).forEach(([colorName, pathData]) => {
    const colorKey = Object.keys(colors).find(k => colors[k].name === colorName) || colorName;
    const color = colors[colorKey]?.cssColor || '#808080';

    // Skip grass terrain - don't include in output
    if (colorKey == 'level1') {
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
  hidePostfixDropdown();

  postfixDropdown = document.createElement('div');
  postfixDropdown.style.cssText = `
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

  const title = document.createElement('div');
  title.textContent = `Import SVG at (${blockX}, ${blockY})`;
  title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #726a5a;';
  postfixDropdown.appendChild(title);

  const loadButton = createDropdownButton('Select SVG File...', () => {
    openSvgFileDialog(blockX, blockY);
  });
  postfixDropdown.appendChild(loadButton);

  const cancelButton = createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isSvgImportModeActive) toggleSvgImportMode();
  }, true);
  postfixDropdown.appendChild(cancelButton);

  document.body.appendChild(postfixDropdown);
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
  hidePostfixDropdown();

  postfixDropdown = document.createElement('div');
  postfixDropdown.style.cssText = `
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

  const title = document.createElement('div');
  title.textContent = `Import SVG to terrain at (${blockX}, ${blockY})`;
  title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #726a5a;';
  postfixDropdown.appendChild(title);

  const loadButton = createDropdownButton('Select SVG File...', () => {
    openSvgForTerrain(blockX, blockY);
  });
  postfixDropdown.appendChild(loadButton);

  const cancelButton = createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isSvgToTerrainModeActive) toggleSvgToTerrainMode();
  }, true);
  postfixDropdown.appendChild(cancelButton);

  document.body.appendChild(postfixDropdown);
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
  hidePostfixDropdown();

  postfixDropdown = document.createElement('div');
  postfixDropdown.style.cssText = `
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

  const title = document.createElement('div');
  title.textContent = `Export SVG from tile (${blockX}, ${blockY})`;
  title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #726a5a;';
  postfixDropdown.appendChild(title);

  const selectButton = createDropdownButton('Select Reference File...', () => {
    openReferenceFileDialog(blockX, blockY);
  });
  postfixDropdown.appendChild(selectButton);

  const cancelButton = createDropdownButton('Cancel', () => {
    hidePostfixDropdown();
    clearHighlight();
    if (isSvgExportFromFileModeActive) toggleSvgExportFromFileMode();
  }, true);
  postfixDropdown.appendChild(cancelButton);

  document.body.appendChild(postfixDropdown);
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

  if (index < 0 || index >= tileImages.length) return;

  layers.mapOverlayLayer.activate();

  const imagePath = tileImages[index];
  tileTracerRaster = new paper.Raster(imagePath);

  // Position at center of top-left block (0,0)
  const x = blockWidth / 2;
  const y = blockHeight / 2;

  tileTracerRaster.onLoad = () => {
    if (tileTracerRaster) {
      // Scale to 18x18 (source images have 1 tile buffer around edge)
      const targetSize = 18;
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
    tileTracerImageIndex = (tileTracerImageIndex - 1 + tileImages.length) % tileImages.length;
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
    tileTracerImageIndex = (tileTracerImageIndex + 1) % tileImages.length;
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
    title.textContent = `${tileTracerImageIndex + 1}/${tileImages.length}: ${getImageDisplayName(tileTracerImageIndex)}`;
  }
}

function getImageDisplayName(index: number): string {
  const path = tileImages[index];
  // Extract filename without extension
  const filename = path.split('/').pop() || path;
  return filename.replace(/\.[^/.]+$/, '');
}

function saveTileTracerSvg(): void {
  const filename = getImageDisplayName(tileTracerImageIndex);
  // Export tile at (0, 0) - top-left
  exportTileSvg(0, 0, filename);
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
    { label: 'Tile Tracer', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      toggleTileTracerMode();
    }},
    { label: 'Auto Island Flow', action: () => {
      hideDevMenu();
      isMenuOpen = false;
      autoCompleteToGrid();
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
  devMenuGroup.position = new paper.Point(
    buttonPos.x - 30,
    buttonPos.y - 60
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
