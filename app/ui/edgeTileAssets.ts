import { horizontalBlocks, verticalBlocks } from '../constants';
import { OptionConfig } from './mapOptionSelector';

export type BlockState = 'placeholder' | 'airport' | 'river' | 'peninsula' | 'dock' | 'secretBeach' | 'rock' | 'rock_small' | 'filled';
export type TileDirection = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'left' | 'right' | 'top' | 'bottom';
export type TileCategory =
  | 'left' | 'left_peninsula' | 'left_river' | 'left_rock'
  | 'right' | 'right_peninsula' | 'right_river' | 'right_rock'
  | 'top' | 'top_secret_beach' | 'top_left' | 'top_right'
  | 'bottom' | 'airport' | 'bottom_river' | 'bottom_left' | 'bottom_left_dock' | 'bottom_right' | 'bottom_right_dock';
export type AssetData = { state: BlockState; imageSrc: string; direction: TileDirection; category?: TileCategory };

const tilesPath = 'static/tiles_data/';

// Placeholder asset indices start at 900
export const placeholderAssetIndexToData: Map<number, AssetData> = new Map([
  [900, { state: 'placeholder', direction: 'top_left', imageSrc: `${tilesPath}placeholder_top_left.svg` }],
  [901, { state: 'placeholder', direction: 'top_right', imageSrc: `${tilesPath}placeholder_top_right.svg` }],
  [902, { state: 'placeholder', direction: 'bottom_left', imageSrc: `${tilesPath}placeholder_bottom_left.svg` }],
  [903, { state: 'placeholder', direction: 'bottom_right', imageSrc: `${tilesPath}placeholder_bottom_right.svg` }],
  [904, { state: 'placeholder', direction: 'left', imageSrc: `${tilesPath}placeholder_left.svg` }],
  [905, { state: 'placeholder', direction: 'right', imageSrc: `${tilesPath}placeholder_right.svg` }],
  [906, { state: 'placeholder', direction: 'top', imageSrc: `${tilesPath}placeholder_top.svg` }],
  [907, { state: 'placeholder', direction: 'bottom', imageSrc: `${tilesPath}placeholder_bottom.svg` }],
  [908, { state: 'placeholder', direction: 'bottom', imageSrc: `${tilesPath}placeholder_bottom_river.svg` }],
  [909, { state: 'placeholder', direction: 'left', imageSrc: `${tilesPath}placeholder_left_river.svg` }],
  [910, { state: 'placeholder', direction: 'right', imageSrc: `${tilesPath}placeholder_right_river.svg` }],
  [911, { state: 'placeholder', direction: 'top', imageSrc: `${tilesPath}placeholder_top_secret_beach.svg` }],
]);

export const placeholderIndexMin = 900;
export const placeholderIndexMax = 911;

export function isPlaceholderIndex(index: number): boolean {
  return index >= placeholderIndexMin && index <= placeholderIndexMax;
}

const directionToPlaceholderIndex: Record<TileDirection, number> = {
  top_left: 900,
  top_right: 901,
  bottom_left: 902,
  bottom_right: 903,
  left: 904,
  right: 905,
  top: 906,
  bottom: 907,
};

export function getTileDirection(x: number, y: number): TileDirection {
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

export function getPlaceholderIndexForPosition(x: number, y: number): number {
  const direction = getTileDirection(x, y);
  return directionToPlaceholderIndex[direction];
}

export const assetIndexToData: Map<number, AssetData> = new Map([
  // Right edge tiles
  [1, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}1 - ISdNX8N.svg` }],
  [2, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}2 - 0Nl1fz8.svg` }],
  [3, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}3 - 8lHF1d5.svg` }],
  // Right peninsula
  [4, { state: 'peninsula', direction: 'right', imageSrc: `${tilesPath}4 - ZLMp5LA.svg` }],
  [5, { state: 'peninsula', direction: 'right', imageSrc: `${tilesPath}5 - gZVRJnv.svg` }],
  [6, { state: 'peninsula', direction: 'right', imageSrc: `${tilesPath}6 - ydnTxJO.svg` }],
  // Right river
  [7, { state: 'river', direction: 'right', imageSrc: `${tilesPath}7 - OZtIhTC.svg` }],
  [8, { state: 'river', direction: 'right', imageSrc: `${tilesPath}8 - hWGQub0.svg` }],
  // Right rock
  [9, { state: 'rock', direction: 'right', imageSrc: `${tilesPath}9 - YSjtaWO.svg` }],
  [10, { state: 'rock', direction: 'right', imageSrc: `${tilesPath}10 - ByrJZyo.svg` }],
  [11, { state: 'rock', direction: 'right', imageSrc: `${tilesPath}11 - Ar9LNtJ.svg` }],
  [12, { state: 'rock', direction: 'right', imageSrc: `${tilesPath}12 - UgoRJy3.svg` }],
  // Top right corner
  [13, { state: 'filled', direction: 'top_right', imageSrc: `${tilesPath}13 - PCgPfdN.svg` }],
  [14, { state: 'filled', direction: 'top_right', imageSrc: `${tilesPath}14 - f8zzseF.svg` }],
  [15, { state: 'filled', direction: 'top_right', imageSrc: `${tilesPath}15 - IXhHmuY.svg` }],
  // Top secret beach
  [16, { state: 'secretBeach', direction: 'top', imageSrc: `${tilesPath}16 - J9KTWix.svg` }],
  [17, { state: 'secretBeach', direction: 'top', imageSrc: `${tilesPath}17 - TJTblBV.svg` }],
  [18, { state: 'secretBeach', direction: 'top', imageSrc: `${tilesPath}18 - 4F6lHPo.svg` }],
  // Top edge tiles
  [19, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}19 - ZN9h9K4.svg` }],
  [20, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}20 - hTYvr5L.svg` }],
  [21, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}21 - 2lzjMi4.svg` }],
  [22, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}22 - 1w29p5L.svg` }],
  [23, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}23 - 5JzK0IN.svg` }],
  [24, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}24 - qtgHzOc.svg` }],
  [25, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}25 - pN01yZH.svg` }],
  // Top left corner
  [26, { state: 'filled', direction: 'top_left', imageSrc: `${tilesPath}26 - 3sy5W7R.svg` }],
  [27, { state: 'filled', direction: 'top_left', imageSrc: `${tilesPath}27 - mKkuBGS.svg` }],
  [28, { state: 'filled', direction: 'top_left', imageSrc: `${tilesPath}28 - Wsc0wcG.svg` }],
  // Bottom edge tiles
  [29, { state: 'filled', direction: 'bottom', imageSrc: `${tilesPath}29 - QJsmplp.svg` }],
  [30, { state: 'filled', direction: 'bottom', imageSrc: `${tilesPath}30 - X7FbpvK.svg` }],
  [31, { state: 'filled', direction: 'bottom', imageSrc: `${tilesPath}31 - LRICn1q.svg` }],
  [32, { state: 'filled', direction: 'bottom', imageSrc: `${tilesPath}32 - BJ16eY9.svg` }],
  // Airport
  [34, { state: 'airport', direction: 'bottom', imageSrc: `${tilesPath}34 - OmmYDBq.svg` }],
  [35, { state: 'airport', direction: 'bottom', imageSrc: `${tilesPath}35 - bawoPn6.svg` }],
  // Bottom right corner
  [39, { state: 'filled', direction: 'bottom_right', imageSrc: `${tilesPath}39 - AjicFEz.svg` }],
  [40, { state: 'filled', direction: 'bottom_right', imageSrc: `${tilesPath}40 - BsmCSdo.svg` }],
  [41, { state: 'filled', direction: 'bottom_right', imageSrc: `${tilesPath}41 - Ubewm2Y.svg` }],
  [42, { state: 'filled', direction: 'bottom_right', imageSrc: `${tilesPath}42 - 3TX1fOO.svg` }],
  // Bottom right dock
  [43, { state: 'dock', direction: 'bottom_right', imageSrc: `${tilesPath}43 - lRh7pLD.svg` }],
  [44, { state: 'dock', direction: 'bottom_right', imageSrc: `${tilesPath}44 - Kkxl2RH.svg` }],
  // Bottom river
  [45, { state: 'river', direction: 'bottom', imageSrc: `${tilesPath}45 - iaL3IcU.svg` }],
  [46, { state: 'river', direction: 'bottom', imageSrc: `${tilesPath}46 - TIj5eT1.svg` }],
  [47, { state: 'river', direction: 'bottom', imageSrc: `${tilesPath}47 - szIJe08.svg` }],
  // Bottom left corner
  [48, { state: 'filled', direction: 'bottom_left', imageSrc: `${tilesPath}48 - iLjCW2O.svg` }],
  [49, { state: 'filled', direction: 'bottom_left', imageSrc: `${tilesPath}49 - epj7EMt.svg` }],
  [50, { state: 'filled', direction: 'bottom_left', imageSrc: `${tilesPath}50 - keMBShp.svg` }],
  [51, { state: 'filled', direction: 'bottom_left', imageSrc: `${tilesPath}51 - rjaAFsj.svg` }],
  // Bottom left dock
  [52, { state: 'dock', direction: 'bottom_left', imageSrc: `${tilesPath}52 - bvT1yJ7.svg` }],
  [53, { state: 'dock', direction: 'bottom_left', imageSrc: `${tilesPath}53 - W1DZoXV.svg` }],
  // Left edge tiles
  [54, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}54 - qCe5VxM.svg` }],
  [55, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}55 - MJwO2PW.svg` }],
  [56, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}56 - G7cJXjm.svg` }],
  [57, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}57 - pJU2kTE.svg` }],
  [58, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}58 - r720Voz.svg` }],
  // Left peninsula
  [59, { state: 'peninsula', direction: 'left', imageSrc: `${tilesPath}59 - Dy1isCL.svg` }],
  [60, { state: 'peninsula', direction: 'left', imageSrc: `${tilesPath}60 - oTGqpUF.svg` }],
  [61, { state: 'peninsula', direction: 'left', imageSrc: `${tilesPath}61 - 4w4i9nr.svg` }],
  // Left river
  [62, { state: 'river', direction: 'left', imageSrc: `${tilesPath}62 - 3EvOplj.svg` }],
  [63, { state: 'river', direction: 'left', imageSrc: `${tilesPath}63 - EX7BYGw.svg` }],
  // Left rock
  [64, { state: 'rock', direction: 'left', imageSrc: `${tilesPath}64 - xifLxPa.svg` }],
  [65, { state: 'rock', direction: 'left', imageSrc: `${tilesPath}65 - pFh72wi.svg` }],
  [66, { state: 'rock', direction: 'left', imageSrc: `${tilesPath}66 - TnsI1wo.svg` }],
  [67, { state: 'rock', direction: 'left', imageSrc: `${tilesPath}67 - mQNwwge.svg` }],
  // More right edge tiles
  [68, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}68 - KBHEtY0.svg` }],
  [69, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}69 - BCpO1K5.svg` }],
  // More bottom edge tiles
  [70, { state: 'filled', direction: 'bottom', imageSrc: `${tilesPath}70_bottom_0.svg` }],
  [71, { state: 'filled', direction: 'bottom', imageSrc: `${tilesPath}71_bottom_1.svg` }],
  // More left edge tiles
  [72, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}72_left_0.svg` }],
  [73, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}73_left_1.svg` }],
  // Left rock small
  [74, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}74_left_rock_small_0.svg` }],
  [75, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}75_left_rock_small_1.svg` }],
  [76, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}76_left_rock_small_2.svg` }],
  [77, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}77_left_rock_small_3.svg` }],
  // More right edge tiles
  [78, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}78_right_0.svg` }],
  [79, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}79_right_1.svg` }],
  // Right rock small
  [80, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}80_right_rock_small_0.svg` }],
  [81, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}81_right_rock_small_1.svg` }],
  [82, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}82_right_rock_small_2.svg` }],
  [83, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}83_right_rock_small_3.svg` }],
]);

export function getAssetByIndex(num: number): AssetData | undefined {
  return assetIndexToData.get(num);
}

// Get imageSrc for an asset index from either regular or placeholder assets
export function getImageSrcForAsset(assetIndex: number): string | undefined {
  return assetIndexToData.get(assetIndex)?.imageSrc
    ?? placeholderAssetIndexToData.get(assetIndex)?.imageSrc;
}

// Asset indices grouped by direction (filled tiles only, for tile selection UI)
export const tileAssetIndices: Record<TileDirection, number[]> = (() => {
  const result: Record<string, number[]> = {};
  for (const [index, data] of assetIndexToData) {
    if (data.state === 'filled') {
      if (!result[data.direction]) {
        result[data.direction] = [];
      }
      result[data.direction].push(index);
    }
  }
  return result as Record<TileDirection, number[]>;
})();

// ============================================================================
// Category System for Two-Step Selection
// ============================================================================

// Asset indices grouped by category
export const categoryAssetIndices: Record<TileCategory, number[]> = {
  // Left edge categories
  left: [54, 55, 56, 57, 58, 72, 73, /* small rocks */ 74, 75, 76, 77],
  left_peninsula: [59, 60, 61],
  left_river: [62, 63],
  left_rock: [64, 65, 66, 67],
  // Right edge categories
  right: [1, 2, 3, 68, 69, 78, 79, /* small rocks */ 80, 81, 82, 83],
  right_peninsula: [4, 5, 6],
  right_river: [7, 8],
  right_rock: [9, 10, 11, 12],
  // Top edge categories
  top: [19, 20, 21, 22, 23, 24, 25],
  top_secret_beach: [16, 17, 18],
  top_left: [26, 27, 28],
  top_right: [13, 14, 15],
  // Bottom edge categories
  bottom: [29, 30, 31, 32, 70, 71],
  airport: [34, 35],
  bottom_river: [45, 46, 47],
  bottom_left: [48, 49, 50, 51],
  bottom_left_dock: [52, 53],
  bottom_right: [39, 40, 41, 42],
  bottom_right_dock: [43, 44],
};

// Map direction to available categories
const directionToCategories: Record<TileDirection, TileCategory[]> = {
  left: ['left', 'left_peninsula', 'left_river', 'left_rock'],
  right: ['right', 'right_peninsula', 'right_river', 'right_rock'],
  top: ['top', 'top_secret_beach'],
  bottom: ['bottom', 'airport', 'bottom_river'],
  top_left: ['top_left'],
  top_right: ['top_right'],
  bottom_left: ['bottom_left', 'bottom_left_dock'],
  bottom_right: ['bottom_right', 'bottom_right_dock'],
};

// Categories that have placeholder images
const categoriesWithPlaceholders: TileCategory[] = [
  'left', 'left_river', 'right', 'right_river',
  'top', 'top_left', 'top_right',
  'bottom', 'bottom_left', 'bottom_right', 'bottom_river',
];

// Get categories available for a tile direction
export function getCategoriesForDirection(direction: TileDirection): TileCategory[] {
  return directionToCategories[direction] ?? [];
}

// Get category icon path (placeholder if exists, else first tile from category)
export function getCategoryIcon(category: TileCategory): string {
  if (categoriesWithPlaceholders.includes(category)) {
    return `${tilesPath}placeholder_${category}.svg`;
  }

  // Return first tile from category folder
  const firstTileIndex = categoryAssetIndices[category]?.[0];
  return assetIndexToData.get(firstTileIndex)?.imageSrc ?? `${tilesPath}placeholder_${category}.svg`;
}

// Get tile options for a specific category
export function getTileOptionsForCategory(category: TileCategory): OptionConfig[] {
  const indices = categoryAssetIndices[category] ?? [];
  return indices.map((index, i) => ({
    label: String(i + 1),
    value: index,
    imageSrc: assetIndexToData.get(index)?.imageSrc,
  }));
}

// Maximum items across all categories (for consistent zoom)
export const MAX_CATEGORY_ITEMS = 8; // "left_rock" and "right_rock" now have 8 options
