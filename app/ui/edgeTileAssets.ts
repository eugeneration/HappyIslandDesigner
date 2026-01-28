import { horizontalBlocks, verticalBlocks } from '../constants';

export type BlockState = 'placeholder' | 'airport' | 'river' | 'peninsula' | 'dock' | 'secretBeach' | 'rock' | 'filled';
export type TileDirection = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'left' | 'right' | 'top' | 'bottom';
export type AssetData = { state: BlockState; imageSrc: string; direction: TileDirection };

const tilesPath = 'static/tiles/';

// Placeholder asset indices start at 900
export const placeholderAssetIndexToData: Map<number, AssetData> = new Map([
  [900, { state: 'placeholder', direction: 'top_left', imageSrc: `${tilesPath}placeholder_top_left.png` }],
  [901, { state: 'placeholder', direction: 'top_right', imageSrc: `${tilesPath}placeholder_top_right.png` }],
  [902, { state: 'placeholder', direction: 'bottom_left', imageSrc: `${tilesPath}placeholder_bottom_left.png` }],
  [903, { state: 'placeholder', direction: 'bottom_right', imageSrc: `${tilesPath}placeholder_bottom_right.png` }],
  [904, { state: 'placeholder', direction: 'left', imageSrc: `${tilesPath}placeholder_left.png` }],
  [905, { state: 'placeholder', direction: 'right', imageSrc: `${tilesPath}placeholder_right.png` }],
  [906, { state: 'placeholder', direction: 'top', imageSrc: `${tilesPath}placeholder_top.png` }],
  [907, { state: 'placeholder', direction: 'bottom', imageSrc: `${tilesPath}placeholder_bottom.png` }],
  [908, { state: 'placeholder', direction: 'bottom', imageSrc: `${tilesPath}placeholder_bottom_river.png` }],
  [909, { state: 'placeholder', direction: 'left', imageSrc: `${tilesPath}placeholder_left_river.png` }],
  [910, { state: 'placeholder', direction: 'right', imageSrc: `${tilesPath}placeholder_right_river.png` }],
  [911, { state: 'placeholder', direction: 'top', imageSrc: `${tilesPath}placeholder_top_secret_beach.png` }],
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
  [1, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}right/1 - ISdNX8N.png` }],
  [2, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}right/2 - 0Nl1fz8.png` }],
  [3, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}right/3 - 8lHF1d5.png` }],
  // Right peninsula
  [4, { state: 'peninsula', direction: 'right', imageSrc: `${tilesPath}right_peninsula/4 - ZLMp5LA.png` }],
  [5, { state: 'peninsula', direction: 'right', imageSrc: `${tilesPath}right_peninsula/5 - gZVRJnv.png` }],
  [6, { state: 'peninsula', direction: 'right', imageSrc: `${tilesPath}right_peninsula/6 - ydnTxJO.png` }],
  // Right river
  [7, { state: 'river', direction: 'right', imageSrc: `${tilesPath}right_river/7 - OZtIhTC.png` }],
  [8, { state: 'river', direction: 'right', imageSrc: `${tilesPath}right_river/8 - hWGQub0.png` }],
  // Right rock
  [9, { state: 'rock', direction: 'right', imageSrc: `${tilesPath}right_rock/9 - YSjtaWO.png` }],
  [10, { state: 'rock', direction: 'right', imageSrc: `${tilesPath}right_rock/10 - ByrJZyo.png` }],
  [11, { state: 'rock', direction: 'right', imageSrc: `${tilesPath}right_rock/11 - Ar9LNtJ.png` }],
  [12, { state: 'rock', direction: 'right', imageSrc: `${tilesPath}right_rock/12 - UgoRJy3.png` }],
  // Top right corner
  [13, { state: 'filled', direction: 'top_right', imageSrc: `${tilesPath}top_right/13 - PCgPfdN.png` }],
  [14, { state: 'filled', direction: 'top_right', imageSrc: `${tilesPath}top_right/14 - f8zzseF.png` }],
  [15, { state: 'filled', direction: 'top_right', imageSrc: `${tilesPath}top_right/15 - IXhHmuY.png` }],
  // Top secret beach
  [16, { state: 'secretBeach', direction: 'top', imageSrc: `${tilesPath}top_secret_beach/16 - J9KTWix.png` }],
  [17, { state: 'secretBeach', direction: 'top', imageSrc: `${tilesPath}top_secret_beach/17 - TJTblBV.png` }],
  [18, { state: 'secretBeach', direction: 'top', imageSrc: `${tilesPath}top_secret_beach/18 - 4F6lHPo.png` }],
  // Top edge tiles
  [19, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}top/19 - ZN9h9K4.png` }],
  [20, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}top/20 - hTYvr5L.png` }],
  [21, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}top/21 - 2lzjMi4.png` }],
  [22, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}top/22 - 1w29p5L.png` }],
  [23, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}top/23 - 5JzK0IN.png` }],
  [24, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}top/24 - qtgHzOc.png` }],
  [25, { state: 'filled', direction: 'top', imageSrc: `${tilesPath}top/25 - pN01yZH.png` }],
  // Top left corner
  [26, { state: 'filled', direction: 'top_left', imageSrc: `${tilesPath}top_left/26 - 3sy5W7R.png` }],
  [27, { state: 'filled', direction: 'top_left', imageSrc: `${tilesPath}top_left/27 - mKkuBGS.png` }],
  [28, { state: 'filled', direction: 'top_left', imageSrc: `${tilesPath}top_left/28 - Wsc0wcG.png` }],
  // Bottom edge tiles
  [29, { state: 'filled', direction: 'bottom', imageSrc: `${tilesPath}bottom/29 - QJsmplp.png` }],
  [30, { state: 'filled', direction: 'bottom', imageSrc: `${tilesPath}bottom/30 - X7FbpvK.png` }],
  [31, { state: 'filled', direction: 'bottom', imageSrc: `${tilesPath}bottom/31 - LRICn1q.png` }],
  [32, { state: 'filled', direction: 'bottom', imageSrc: `${tilesPath}bottom/32 - BJ16eY9.png` }],
  // Airport
  [34, { state: 'airport', direction: 'bottom', imageSrc: `${tilesPath}airport/34 - OmmYDBq.png` }],
  [35, { state: 'airport', direction: 'bottom', imageSrc: `${tilesPath}airport/35 - bawoPn6.png` }],
  // Bottom right corner
  [39, { state: 'filled', direction: 'bottom_right', imageSrc: `${tilesPath}bottom_right/39 - AjicFEz.png` }],
  [40, { state: 'filled', direction: 'bottom_right', imageSrc: `${tilesPath}bottom_right/40 - BsmCSdo.png` }],
  [41, { state: 'filled', direction: 'bottom_right', imageSrc: `${tilesPath}bottom_right/41 - Ubewm2Y.png` }],
  [42, { state: 'filled', direction: 'bottom_right', imageSrc: `${tilesPath}bottom_right/42 - 3TX1fOO.png` }],
  // Bottom right dock
  [43, { state: 'dock', direction: 'bottom_right', imageSrc: `${tilesPath}bottom_right_dock/43 - lRh7pLD.png` }],
  [44, { state: 'dock', direction: 'bottom_right', imageSrc: `${tilesPath}bottom_right_dock/44 - Kkxl2RH.png` }],
  // Bottom river
  [45, { state: 'river', direction: 'bottom', imageSrc: `${tilesPath}bottom_river/45 - iaL3IcU.png` }],
  [46, { state: 'river', direction: 'bottom', imageSrc: `${tilesPath}bottom_river/46 - TIj5eT1.png` }],
  [47, { state: 'river', direction: 'bottom', imageSrc: `${tilesPath}bottom_river/47 - szIJe08.png` }],
  // Bottom left corner
  [48, { state: 'filled', direction: 'bottom_left', imageSrc: `${tilesPath}bottom_left/48 - iLjCW2O.png` }],
  [49, { state: 'filled', direction: 'bottom_left', imageSrc: `${tilesPath}bottom_left/49 - epj7EMt.png` }],
  [50, { state: 'filled', direction: 'bottom_left', imageSrc: `${tilesPath}bottom_left/50 - keMBShp.png` }],
  [51, { state: 'filled', direction: 'bottom_left', imageSrc: `${tilesPath}bottom_left/51 - rjaAFsj.png` }],
  // Bottom left dock
  [52, { state: 'dock', direction: 'bottom_left', imageSrc: `${tilesPath}bottom_left_dock/52 - bvT1yJ7.png` }],
  [53, { state: 'dock', direction: 'bottom_left', imageSrc: `${tilesPath}bottom_left_dock/53 - W1DZoXV.png` }],
  // Left edge tiles
  [54, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}left/54 - qCe5VxM.png` }],
  [55, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}left/55 - MJwO2PW.png` }],
  [56, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}left/56 - G7cJXjm.png` }],
  [57, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}left/57 - pJU2kTE.png` }],
  [58, { state: 'filled', direction: 'left', imageSrc: `${tilesPath}left/58 - r720Voz.png` }],
  // Left peninsula
  [59, { state: 'peninsula', direction: 'left', imageSrc: `${tilesPath}left_peninsula/59 - Dy1isCL.png` }],
  [60, { state: 'peninsula', direction: 'left', imageSrc: `${tilesPath}left_peninsula/60 - oTGqpUF.png` }],
  [61, { state: 'peninsula', direction: 'left', imageSrc: `${tilesPath}left_peninsula/61 - 4w4i9nr.png` }],
  // Left river
  [62, { state: 'river', direction: 'left', imageSrc: `${tilesPath}left_river/62 - 3EvOplj.png` }],
  [63, { state: 'river', direction: 'left', imageSrc: `${tilesPath}left_river/63 - EX7BYGw.png` }],
  // Left rock
  [64, { state: 'rock', direction: 'left', imageSrc: `${tilesPath}left_rock/64 - xifLxPa.png` }],
  [65, { state: 'rock', direction: 'left', imageSrc: `${tilesPath}left_rock/65 - pFh72wi.png` }],
  [66, { state: 'rock', direction: 'left', imageSrc: `${tilesPath}left_rock/66 - TnsI1wo.png` }],
  [67, { state: 'rock', direction: 'left', imageSrc: `${tilesPath}left_rock/67 - mQNwwge.png` }],
  // More right edge tiles
  [68, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}right/68 - KBHEtY0.png` }],
  [69, { state: 'filled', direction: 'right', imageSrc: `${tilesPath}right/69 - BCpO1K5.png` }],
]);

export function getAssetByIndex(num: number): AssetData | undefined {
  return assetIndexToData.get(num);
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
