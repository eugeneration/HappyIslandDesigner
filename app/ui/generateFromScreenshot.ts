// generateFromScreenshot.ts
// Analyzes an ACNH map screenshot to detect island boundaries and generate a v2 map.
// Step 1: Island extent detection via color-based boundary scanning.

import {
  getTileDirection, getPlaceholderIndexForPosition,
  assetIndexToData, type TileDirection,
} from './edgeTileAssets';
import { tilesDataCache } from '../generatedTilesCache';

// ============ Types ============

type RGB = { r: number; g: number; b: number };

type ScanRow = {
  y: number;
  rockPct: number;
  sandPct: number;
};

type BoundaryResult = {
  boundaryY: number | null;
  scanData: ScanRow[];
};

type ScanColumn = {
  x: number;
  sandPct: number;
};

type VerticalBoundaryResult = {
  boundaryX: number | null;
  scanData: ScanColumn[];
};

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type IslandExtents = {
  pixelsPerCoord: number;
  full: Rect;
  inner: Rect;
};

// Terrain type enum for screenshot classification
const TERRAIN = {
  UNKNOWN: 0,
  WATER: 1,
  SAND: 2,
  ROCK: 3,
  LEVEL1: 4,
  LEVEL2: 5,
  LEVEL3: 6,
  PATH: 7,
  GRASS: 8,  // Undifferentiated grass — resolved to L1/L2/L3 per-cell
} as const;
type TerrainType = typeof TERRAIN[keyof typeof TERRAIN];

// Diagonal orientation of a cell's terrain split
const DIAGONAL = {
  NONE: 0,       // Solid — entire cell is one terrain
  BACKSLASH: 1,  // '\' — top-left triangle = primary, bottom-right = secondary
  SLASH: 2,      // '/' — top-right triangle = primary, bottom-left = secondary
} as const;
type DiagonalType = typeof DIAGONAL[keyof typeof DIAGONAL];

// The full pixelized terrain grid result
type PixelGrid = {
  // Primary terrain type for each cell (or first terrain in a diagonal split)
  primary: Uint8Array;    // 112×96, TerrainType values
  // Diagonal orientation: NONE for solid, BACKSLASH or SLASH for diagonals
  diagonal: Uint8Array;   // 112×96, DiagonalType values
  // Secondary terrain for diagonal cells (UNKNOWN if solid)
  secondary: Uint8Array;  // 112×96, TerrainType values
  // Classification confidence 0–255 (for debug/tuning)
  confidence: Uint8Array; // 112×96
};

// Classified sample point within a cell
type ClassifiedSample = {
  relX: number;  // 0..1 normalized x position within cell
  relY: number;  // 0..1 normalized y position within cell
  terrain: TerrainType;
  rgb: RGB;  // Raw pixel color for per-cell grass level resolution
};

// Result of per-cell diagonal detection
type CellResult = {
  primary: TerrainType;
  secondary: TerrainType;
  diagonal: DiagonalType;
  confidence: number; // 0–255
};

// ============ Icon Detection Types ============

// Orientation variant for multi-orientation icons (bridges, stairs)
type OrientationVariant = {
  rotation: 0 | 45 | 90 | 135 | 180 | 270;
  objectType: string;
  objectCategory: string;
  objectSize: [number, number];
};

// Configuration for a detectable map icon type
type IconTemplate = {
  name: string;                        // Human-readable name
  category: string;                    // v2 object category (e.g., 'structures')
  type: string;                        // v2 object type (e.g., 'houseSprite')
  imagePath: string;                   // Path to icon PNG in static/dev/ (for template matching)
  colors: RGB[];                       // Pre-extracted primary colors (constants)
  colorTolerance: number;              // Euclidean RGB distance threshold
  sizeInCoords: [number, number];      // Pre-computed minimap icon size: image px ÷ 5.33
  objectSizeInCoords: [number, number]; // In-game footprint for v2 placement
  aspectRatioRange: [number, number];  // Acceptable width/height ratio range
  minFillRatio: number;                // Min filled pixels / bounding box area
  opaqueArea: number;                  // Pre-extracted opaque pixel count (alpha>128) from template PNG
  fillBehavior?: 'grass' | 'water' | 'terrain-foot';  // How to fill region (default: 'grass')
  maxCount?: number;                   // Max instances allowed in uniqueness constraint (default: 1)
  emitsObject?: boolean;               // Whether to include in v2 object output (default: true)
  orientations?: OrientationVariant[]; // For multi-orientation icons (bridges, stairs)
  requiresWaterAdjacency?: boolean;    // Bridges must have water on perpendicular sides
  maskDilationRadius?: number;         // Dilate color mask N px before BFS (bridges gaps in fragmented icons)
};

type ColorBlob = {
  pixels: Set<number>;     // Set of linear indices (y * imageWidth + x)
  minX: number; minY: number; maxX: number; maxY: number;
  area: number;
};

type DetectedIcon = {
  template: IconTemplate;
  centerCoordX: number;            // Center X in island coordinates
  centerCoordY: number;            // Center Y in island coordinates
  blobCenterPx: [number, number];  // Center in screen pixels (for debug)
  blobBBoxPx: [number, number, number, number]; // [minX, minY, maxX, maxY] screen pixels
  confidence: number;              // 0–1
  orientation?: OrientationVariant;      // Resolved orientation (bridges/stairs)
  resolvedType?: string;                 // Overrides template.type when set
  resolvedCategory?: string;             // Overrides template.category when set
  resolvedObjectSize?: [number, number]; // Overrides template.objectSizeInCoords when set
};

// ============ Constants ============

// Screenshot-sampled colors (from actual ACNH map screenshots).
// These are DIFFERENT from the app's internal colors in colors.ts,
// which are used for rendering the map editor UI.
const SCREENSHOT_COLORS = {
  SAND: [
    { r: 0xEC, g: 0xE5, b: 0xA1 },  // #ECE5A1
    { r: 0xEE, g: 0xE6, b: 0xA5 },  // #EEE6A5
    { r: 0xEB, g: 0xE3, b: 0xA2 },  // #EBE3A2
    { r: 0xE9, g: 0xE1, b: 0xA0 },  // #E9E1A0
  ],
  ROCK: [
    { r: 0x7C, g: 0x86, b: 0x92 },  // #7C8692
    { r: 0x7D, g: 0x7C, b: 0x8C },  // #7D7C8C
    { r: 0x69, g: 0x80, b: 0x88 },  // #698088
    { r: 0x6D, g: 0x74, b: 0x87 },  // #6D7487
  ],
  WATER: [
    { r: 0x75, g: 0xD3, b: 0xC1 },  // #75D3C1
    { r: 0x7B, g: 0xD8, b: 0xC6 },  // #7BD8C6
    { r: 0x7B, g: 0xDA, b: 0xC4 },  // #7BDAC4
    { r: 0x7C, g: 0xD7, b: 0xC5 },  // #7CD7C5
  ],
  LEVEL1_GRASS: [
    { r: 0x3F, g: 0x7C, b: 0x41 },  // #3F7C41
    { r: 0x45, g: 0x7A, b: 0x42 },  // #457A42
    { r: 0x43, g: 0x7E, b: 0x46 },  // #437E46
    { r: 0x3C, g: 0x74, b: 0x3A },  // #3C743A
  ],
  LEVEL2_GRASS: [
    { r: 0x46, g: 0xA5, b: 0x44 },  // #46A544
    { r: 0x44, g: 0xA8, b: 0x45 },  // #44A845
    { r: 0x57, g: 0xA6, b: 0x4B },  // #57A64B
    { r: 0x3D, g: 0x9D, b: 0x3B },  // #3D9D3B
  ],
  LEVEL3_GRASS: [
    { r: 0x65, g: 0xCA, b: 0x44 },  // #65CA44
    { r: 0x5F, g: 0xC9, b: 0x4D },  // #5FC94D
    { r: 0x62, g: 0xCA, b: 0x4B },  // #62CA4B
    { r: 0x67, g: 0xCE, b: 0x4A },  // #67CE4A
  ],
  PATH: [
    { r: 0xB8, g: 0xAA, b: 0x6D },  // #B8AA6D
    { r: 0xB6, g: 0xA7, b: 0x6C },  // #B6A76C
    { r: 0xBA, g: 0xAA, b: 0x6E },  // #BAAA6E
    { r: 0xB8, g: 0xA7, b: 0x6F },  // #B8A76F
  ],
};

// Template image scale: px per island coord in static/dev/ icon images.
const ICON_TEMPLATE_SCALE = 5.33;

// Map icon templates for detection.
// Colors, sizes, and opaqueArea are pre-extracted from static/dev/ images.
// sizeInCoords = minimap visual size (image px ÷ 5.33).
// objectSizeInCoords = in-game footprint for v2 placement.
// opaqueArea = actual opaque pixel count (excludes transparent corners/edges).
// Color groups: unique (#FFC322 gold, #F16323 orange, #F5DE99 yellow),
// pink (#FD83A8 house/tent), dark amenity (#534D41), tan (#AFA17C),
// olive (#7F8267 bridges). Same-color groups use template matching to differentiate.
const ICON_TEMPLATES: IconTemplate[] = [
  // === Unique-color icons (blob color alone suffices) ===
  {
    name: 'House',
    category: 'structures',
    type: 'houseSprite',
    imagePath: 'static/dev/icon-house.png',
    colors: [{ r: 0xFF, g: 0xC3, b: 0x22 }],  // #FFC322 gold (81% of opaque pixels)
    colorTolerance: 35,
    sizeInCoords: [4.5, 4.1],         // 24/5.33, 22/5.33
    objectSizeInCoords: [4, 4],
    aspectRatioRange: [0.7, 1.5],
    minFillRatio: 0.4,
    opaqueArea: 294,                  // 56% of 528 total px
    maxCount: 10,
  },
  {
    name: 'Player House',
    category: 'structures',
    type: 'playerhouseSprite',
    imagePath: 'static/dev/icon-player-house.png',
    colors: [{ r: 0xFD, g: 0x83, b: 0xA8 }],  // #FD83A8 pink (69%)
    colorTolerance: 35,
    sizeInCoords: [6.2, 3.9],         // 33/5.33, 21/5.33
    objectSizeInCoords: [5, 4],
    aspectRatioRange: [1.0, 2.2],
    minFillRatio: 0.4,
    opaqueArea: 544,                  // 78% of 693 total px
    maxCount: 10,
  },
  {
    name: 'Player Tent',
    category: 'structures',
    type: 'playerhouseSprite',
    imagePath: 'static/dev/icon-player-tent.png',
    colors: [{ r: 0xFD, g: 0x83, b: 0xA8 }],  // #FD83A8 pink (72%)
    colorTolerance: 35,
    sizeInCoords: [4.9, 3.6],         // 26/5.33, 19/5.33
    objectSizeInCoords: [5, 4],
    aspectRatioRange: [0.9, 2.0],
    minFillRatio: 0.35,
    opaqueArea: 262,
    maxCount: 10,
  },
  // === Dark amenity group (#534D41) — differentiated by template matching ===
  {
    name: 'Able Sisters',
    category: 'amenities',
    type: 'ableSprite',
    imagePath: 'static/dev/icon-abel.png',
    colors: [{ r: 0x53, g: 0x4D, b: 0x41 }],  // #534D41 (50%)
    colorTolerance: 35,
    sizeInCoords: [7.3, 7.3],         // 39/5.33
    objectSizeInCoords: [5, 4],
    aspectRatioRange: [0.7, 1.4],
    minFillRatio: 0.3,
    opaqueArea: 1150,                 // 76% of 1521 total px
  },
  {
    name: 'Museum',
    category: 'amenities',
    type: 'museumSprite',
    imagePath: 'static/dev/icon-museum.png',
    colors: [{ r: 0x53, g: 0x4D, b: 0x41 }],  // #534D41 (51%)
    colorTolerance: 35,
    sizeInCoords: [7.3, 7.3],
    objectSizeInCoords: [7, 4],
    aspectRatioRange: [0.7, 1.4],
    minFillRatio: 0.3,
    opaqueArea: 1150,                 // 76% of 1521 total px
  },
  {
    name: "Nook's Cranny",
    category: 'amenities',
    type: 'nookSprite',
    imagePath: 'static/dev/icon-nooks-cranny.png',
    colors: [{ r: 0x53, g: 0x4D, b: 0x41 }],  // #534D41 (57%)
    colorTolerance: 35,
    sizeInCoords: [7.3, 7.3],
    objectSizeInCoords: [7, 4],
    aspectRatioRange: [0.7, 1.4],
    minFillRatio: 0.3,
    opaqueArea: 1150,                 // 76% of 1521 total px
  },
  {
    name: 'Tent',
    category: 'structures',
    type: 'tentSprite',
    imagePath: 'static/dev/icon-tent.png',
    colors: [{ r: 0x53, g: 0x4D, b: 0x41 }],  // #534D41 (65%)
    colorTolerance: 35,
    sizeInCoords: [7.3, 7.3],
    objectSizeInCoords: [5, 4],
    aspectRatioRange: [0.7, 1.4],
    minFillRatio: 0.3,
    opaqueArea: 1150,                 // 76% of 1521 total px
  },
  {
    name: 'Airport',
    category: 'amenities',
    type: 'airportBlue',
    imagePath: 'static/dev/icon-amenity-airport.png',
    colors: [{ r: 0x53, g: 0x4D, b: 0x41 }],  // #534D41 (71%)
    colorTolerance: 35,
    sizeInCoords: [7.3, 7.3],
    objectSizeInCoords: [10, 6],
    aspectRatioRange: [0.7, 1.4],
    minFillRatio: 0.3,
    opaqueArea: 1201,                 // 79% of 1521 total px
  },
  {
    name: 'Antiques',
    category: 'amenities',
    type: 'campsiteSprite',
    imagePath: 'static/dev/icon-antiques.png',
    colors: [{ r: 0x53, g: 0x4D, b: 0x41 }],
    colorTolerance: 35,
    sizeInCoords: [7.3, 7.3],
    objectSizeInCoords: [4, 4],
    aspectRatioRange: [0.7, 1.4],
    minFillRatio: 0.3,
    opaqueArea: 1150,                 // 76% of 1521 total px
  },

  // === Tan group (#AFA17C) — differentiated by template matching ===
  {
    name: 'Resident Services',
    category: 'amenities',
    type: 'center',
    imagePath: 'static/dev/icon-amenity-center.png',
    colors: [{ r: 0xAF, g: 0xA1, b: 0x7C }],  // #AFA17C tan (61%)
    colorTolerance: 35,
    sizeInCoords: [12.2, 10.1],        // 65/5.33, 54/5.33
    objectSizeInCoords: [12, 10],
    aspectRatioRange: [0.8, 1.6],
    minFillRatio: 0.3,
    opaqueArea: 3413,                 // 97% of 3510 total px
  },
  {
    name: 'Town Hall',
    category: 'amenities',
    type: 'townhallSprite',
    imagePath: 'static/dev/icon-townhall.png',
    colors: [{ r: 0xAF, g: 0xA1, b: 0x7C }],  // #AFA17C tan (63%)
    colorTolerance: 35,
    sizeInCoords: [12.2, 10.1],
    objectSizeInCoords: [6, 4],
    aspectRatioRange: [0.8, 1.6],
    minFillRatio: 0.3,
    opaqueArea: 3413,                 // 97% of 3510 total px
  },

  // === Orange marker (unique color, no v2 object) ===
  {
    name: 'You Are Here',
    category: 'marker',
    type: 'youAreHereMarker',
    imagePath: 'static/dev/icon-youarehere.png',
    colors: [{ r: 0xF1, g: 0x63, b: 0x23 }],  // #F16323 orange (60%)
    colorTolerance: 35,
    sizeInCoords: [5.4, 7.5],         // 29/5.33, 40/5.33
    objectSizeInCoords: [5, 7],
    aspectRatioRange: [0.5, 1.0],
    minFillRatio: 0.3,
    opaqueArea: 768,
    maxCount: 1,
    emitsObject: false,
  },

  // === Olive bridge group (#7F8267) — 3 sizes, orientation-aware ===
  {
    name: 'Bridge (3-wide)',
    category: 'construction',
    type: 'bridgeStoneVertical',
    imagePath: 'static/dev/icon-bridge-3.png',
    colors: [{ r: 0x7F, g: 0x82, b: 0x67 }],  // #7F8267 olive
    colorTolerance: 35,
    sizeInCoords: [2.1, 3.4],         // 11/5.33, 18/5.33
    objectSizeInCoords: [4, 6],
    aspectRatioRange: [0.2, 5.0],
    minFillRatio: 0.3,
    opaqueArea: 187,
    fillBehavior: 'water' as const,
    maxCount: 8,
    requiresWaterAdjacency: true,
    orientations: [
      { rotation: 0 as const,   objectType: 'bridgeStoneVertical',   objectCategory: 'construction', objectSize: [4, 6] as [number, number] },
      { rotation: 90 as const,  objectType: 'bridgeStoneHorizontal', objectCategory: 'construction', objectSize: [6, 4] as [number, number] },
      { rotation: 45 as const,  objectType: 'bridgeStoneTLBR',       objectCategory: 'construction', objectSize: [6, 6] as [number, number] },
      { rotation: 135 as const, objectType: 'bridgeStoneTRBL',       objectCategory: 'construction', objectSize: [6, 6] as [number, number] },
    ],
  },
  {
    name: 'Bridge (4-wide)',
    category: 'construction',
    type: 'bridgeStoneVertical',
    imagePath: 'static/dev/icon-bridge-4.png',
    colors: [{ r: 0x7F, g: 0x82, b: 0x67 }],
    colorTolerance: 35,
    sizeInCoords: [2.1, 4.5],         // 11/5.33, 24/5.33
    objectSizeInCoords: [4, 6],
    aspectRatioRange: [0.2, 5.0],
    minFillRatio: 0.3,
    opaqueArea: 253,
    fillBehavior: 'water' as const,
    maxCount: 8,
    requiresWaterAdjacency: true,
    orientations: [
      { rotation: 0 as const,   objectType: 'bridgeStoneVertical',   objectCategory: 'construction', objectSize: [4, 6] as [number, number] },
      { rotation: 90 as const,  objectType: 'bridgeStoneHorizontal', objectCategory: 'construction', objectSize: [6, 4] as [number, number] },
      { rotation: 45 as const,  objectType: 'bridgeStoneTLBR',       objectCategory: 'construction', objectSize: [6, 6] as [number, number] },
      { rotation: 135 as const, objectType: 'bridgeStoneTRBL',       objectCategory: 'construction', objectSize: [6, 6] as [number, number] },
    ],
  },
  {
    name: 'Bridge (5-wide)',
    category: 'construction',
    type: 'bridgeStoneVertical',
    imagePath: 'static/dev/icon-bridge-5.png',
    colors: [{ r: 0x7F, g: 0x82, b: 0x67 }],
    colorTolerance: 35,
    sizeInCoords: [2.1, 5.6],         // 11/5.33, 30/5.33
    objectSizeInCoords: [4, 6],
    aspectRatioRange: [0.2, 5.0],
    minFillRatio: 0.3,
    opaqueArea: 319,
    fillBehavior: 'water' as const,
    maxCount: 8,
    requiresWaterAdjacency: true,
    orientations: [
      { rotation: 0 as const,   objectType: 'bridgeStoneVertical',   objectCategory: 'construction', objectSize: [4, 6] as [number, number] },
      { rotation: 90 as const,  objectType: 'bridgeStoneHorizontal', objectCategory: 'construction', objectSize: [6, 4] as [number, number] },
      { rotation: 45 as const,  objectType: 'bridgeStoneTLBR',       objectCategory: 'construction', objectSize: [6, 6] as [number, number] },
      { rotation: 135 as const, objectType: 'bridgeStoneTRBL',       objectCategory: 'construction', objectSize: [6, 6] as [number, number] },
    ],
  },

  // === Yellow stairs (#F5DE99) — orientation-aware ===
  {
    name: 'Stairs',
    category: 'construction',
    type: 'stairsStoneUp',
    imagePath: 'static/dev/icon-stairs.png',
    colors: [{ r: 0xF5, g: 0xDE, b: 0x99 }],  // #F5DE99 tan-yellow
    colorTolerance: 35,
    sizeInCoords: [2.3, 4.3],         // 12/5.33, 23/5.33
    objectSizeInCoords: [2, 4],
    aspectRatioRange: [0.2, 5.0],
    minFillRatio: 0.3,
    opaqueArea: 264,
    fillBehavior: 'terrain-foot' as const,
    maxCount: 8,
    maskDilationRadius: 2,
    orientations: [
      { rotation: 0 as const,   objectType: 'stairsStoneUp',    objectCategory: 'construction', objectSize: [2, 4] as [number, number] },
      { rotation: 90 as const,  objectType: 'stairsStoneRight',  objectCategory: 'construction', objectSize: [4, 2] as [number, number] },
      { rotation: 180 as const, objectType: 'stairsStoneDown',   objectCategory: 'construction', objectSize: [2, 4] as [number, number] },
      { rotation: 270 as const, objectType: 'stairsStoneLeft',   objectCategory: 'construction', objectSize: [4, 2] as [number, number] },
    ],
  },
];

const COLOR_TOLERANCE = 40; // Euclidean RGB distance

// Island grid dimensions (matches app/constants.ts)
const ISLAND_COORD_WIDTH = 112;   // 7 blocks * 16 divisions
const ISLAND_COORD_HEIGHT = 96;   // 6 blocks * 16 divisions

// Interactive inner boundary in island coordinates.
// This rectangle marks the maximum inner extents of sand and rock layers.
const INNER_BOUNDARY = {
  left: 13,
  top: 13,
  right: 99,
  bottom: 83,
};

// Block size for gridline detection (each block is 16×16 island coordinates)
const BLOCK_SIZE = 16;

// Whether a cell's left/right/top/bottom edge borders a block-boundary gridline.
// ACNH map screenshots have semi-transparent white dotted gridlines at these boundaries.
function isBlockBoundaryLeft(cx: number): boolean {
  return cx > 0 && cx % BLOCK_SIZE === 0;
}
function isBlockBoundaryRight(cx: number): boolean {
  return (cx + 1) % BLOCK_SIZE === 0 && cx + 1 < ISLAND_COORD_WIDTH;
}
function isBlockBoundaryTop(cy: number): boolean {
  return cy > 0 && cy % BLOCK_SIZE === 0;
}
function isBlockBoundaryBottom(cy: number): boolean {
  return (cy + 1) % BLOCK_SIZE === 0 && cy + 1 < ISLAND_COORD_HEIGHT;
}

// ============ Color Utility Functions ============
// (Mirroring devTools.ts:2650-2666)

function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    (c1.r - c2.r) ** 2 +
    (c1.g - c2.g) ** 2 +
    (c1.b - c2.b) ** 2
  );
}

function matchesAnyColor(pixel: RGB, colorSamples: RGB[], tolerance = COLOR_TOLERANCE): boolean {
  return colorSamples.some(sample => colorDistance(pixel, sample) <= tolerance);
}

// Broad grass detection: catches all three levels including texture-shifted variants.
// Instead of classifying per-pixel as L1/L2/L3 (which the triangle overlay texture
// makes unreliable), we detect grass broadly and resolve the level per-cell later.
function isScreenshotGrass(pixel: RGB): boolean {
  return pixel.g > pixel.r && pixel.g > pixel.b
    && pixel.r < 0x70 && pixel.b < 0x60
    && pixel.g >= 0x55 && pixel.g <= 0xE0;
}

// Green channel thresholds for per-cell grass level resolution.
// These split the averaged green channel into L1/L2/L3 ranges.
// L1 samples: ~0x74-0x7E, L2: ~0x9D-0xA8, L3: ~0xC9-0xCE
const GRASS_LEVEL_THRESHOLDS = {
  L1_L2: 0x90,  // 144 — below = L1, above = L2
  L2_L3: 0xB8,  // 184 — below = L2, above = L3
};

// Resolve undifferentiated GRASS to a specific level by averaging the green channel
// across all grass samples in a cell. Averaging cancels out the ±15-25 texture noise.
function resolveGrassLevel(grassSamples: RGB[]): TerrainType {
  if (grassSamples.length === 0) return TERRAIN.LEVEL1;
  let totalG = 0;
  for (const s of grassSamples) totalG += s.g;
  const avgG = totalG / grassSamples.length;
  if (avgG >= GRASS_LEVEL_THRESHOLDS.L2_L3) return TERRAIN.LEVEL3;
  if (avgG >= GRASS_LEVEL_THRESHOLDS.L1_L2) return TERRAIN.LEVEL2;
  return TERRAIN.LEVEL1;
}

// Read pixel from RGBA ImageData (4 bytes per pixel)
function getPixelAt(data: Uint8ClampedArray, width: number, x: number, y: number): RGB {
  const idx = (y * width + x) * 4;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

// ============ Row Scanning ============

function scanRowColorPresence(
  data: Uint8ClampedArray,
  width: number,
  y: number,
  xStart: number,
  xEnd: number,
): { rockPct: number; sandPct: number } {
  let rockCount = 0;
  let sandCount = 0;
  const total = xEnd - xStart;

  for (let x = xStart; x < xEnd; x++) {
    const pixel = getPixelAt(data, width, x, y);
    if (matchesAnyColor(pixel, SCREENSHOT_COLORS.ROCK)) {
      rockCount++;
    } else if (matchesAnyColor(pixel, SCREENSHOT_COLORS.SAND)) {
      // TODO: Sand detection may be confused with paths (#B8AA6D vs #ECE5A1).
      // Both are yellowish. Consider using a tighter tolerance for sand,
      // checking contiguity with water (beach), or adding a disambiguation step.
      // Stairs (#F5D896) also have a similar warm tone — use structural
      // constraints (4x2 grid) to disambiguate in later detection phases.
      sandCount++;
    }
  }

  return {
    rockPct: rockCount / total,
    sandPct: sandCount / total,
  };
}

// ============ Column Scanning ============

function scanColumnColorPresence(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  yStart: number,
  yEnd: number,
): { sandPct: number } {
  let sandCount = 0;
  const total = yEnd - yStart;

  for (let y = yStart; y < yEnd; y++) {
    const pixel = getPixelAt(data, width, x, y);
    if (matchesAnyColor(pixel, SCREENSHOT_COLORS.SAND)) {
      sandCount++;
    }
  }

  return {
    sandPct: sandCount / total,
  };
}

// ============ Boundary Detection ============

function detectTopBoundary(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): BoundaryResult {
  const xStart = Math.floor(width / 3);
  const xEnd = Math.floor(2 * width / 3);
  const scanData: ScanRow[] = [];
  let foundRockRegion = false;
  let boundaryY: number | null = null;

  // Scan down from top of image looking for the cliff edge.
  // The northern edge of the island is always a rock cliff.
  // Pattern: ocean → rock cliff (high rock%) → island interior (low rock%).
  // The boundary is where rock% drops from >30% to <20%.
  for (let y = 0; y < Math.floor(height / 2); y++) {
    const { rockPct, sandPct } = scanRowColorPresence(data, width, y, xStart, xEnd);
    scanData.push({ y, rockPct, sandPct });

    if (!foundRockRegion && rockPct > 0.30) {
      foundRockRegion = true;
    }
    if (foundRockRegion && rockPct < 0.20) {
      boundaryY = y;
      break;
    }
  }

  return { boundaryY, scanData };
}

function detectBottomBoundary(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): BoundaryResult {
  const xStart = Math.floor(width / 3);
  const xEnd = Math.floor(2 * width / 3);
  const scanData: ScanRow[] = [];
  let foundBeachRegion = false;
  let boundaryY: number | null = null;

  // Scan up from bottom of image looking for the beach edge.
  // The southern edge of the island has a sand beach with some rock.
  // Pattern: ocean → beach (high sand%, some rock%) → island interior.
  // The boundary is where sand% drops below 20% AND rock% drops below 5%.
  for (let y = height - 1; y > Math.floor(height / 2); y--) {
    const { rockPct, sandPct } = scanRowColorPresence(data, width, y, xStart, xEnd);
    scanData.push({ y, rockPct, sandPct });

    if (!foundBeachRegion && sandPct > 0.30 && rockPct > 0.05) {
      foundBeachRegion = true;
    }
    if (foundBeachRegion && sandPct < 0.20) {
      boundaryY = y;
      break;
    }
  }

  return { boundaryY, scanData };
}

function detectLeftBoundary(
  data: Uint8ClampedArray,
  width: number,
  _height: number,
  topY: number,
  bottomY: number,
): VerticalBoundaryResult {
  const scanData: ScanColumn[] = [];
  let foundSandRegion = false;
  let boundaryX: number | null = null;

  // Scan right from left edge looking for the sand beach edge.
  // The western edge of the island has a sand beach.
  // Pattern: ocean → beach (very high sand%) → island interior (low sand%).
  // Scan vertically between the already-detected top and bottom boundaries.
  for (let x = 0; x < Math.floor(width / 2); x++) {
    const { sandPct } = scanColumnColorPresence(data, width, x, topY, bottomY);
    scanData.push({ x, sandPct });

    if (!foundSandRegion && sandPct > 0.60) {
      foundSandRegion = true;
    }
    if (foundSandRegion && sandPct < 0.10) {
      boundaryX = x;
      break;
    }
  }

  return { boundaryX, scanData };
}

function detectRightBoundary(
  data: Uint8ClampedArray,
  width: number,
  _height: number,
  topY: number,
  bottomY: number,
): VerticalBoundaryResult {
  const scanData: ScanColumn[] = [];
  let foundSandRegion = false;
  let boundaryX: number | null = null;

  // Scan left from right edge looking for the sand beach edge.
  // The eastern edge of the island has a sand beach.
  // Pattern: ocean → beach (very high sand%) → island interior (low sand%).
  for (let x = width - 1; x > Math.floor(width / 2); x--) {
    const { sandPct } = scanColumnColorPresence(data, width, x, topY, bottomY);
    scanData.push({ x, sandPct });

    if (!foundSandRegion && sandPct > 0.60) {
      foundSandRegion = true;
    }
    if (foundSandRegion && sandPct < 0.10) {
      boundaryX = x;
      break;
    }
  }

  return { boundaryX, scanData };
}

// ============ Extent Derivation ============

function deriveFullExtents(
  topY: number,
  bottomY: number,
  leftX: number | null,
  rightX: number | null,
  imageWidth: number,
): IslandExtents {
  // The detected top/bottom correspond to the inner boundary edges:
  //   topY    → INNER_BOUNDARY.top  (island coord 13)
  //   bottomY → INNER_BOUNDARY.bottom (island coord 83)
  // The detected left/right correspond to:
  //   leftX   → INNER_BOUNDARY.left  (island coord 13)
  //   rightX  → INNER_BOUNDARY.right (island coord 99)

  const innerHeightCoords = INNER_BOUNDARY.bottom - INNER_BOUNDARY.top; // 70
  const innerWidthCoords = INNER_BOUNDARY.right - INNER_BOUNDARY.left;  // 86

  // Primary scale from top/bottom (most accurate — top is always accurate)
  const verticalPixelsPerCoord = (bottomY - topY) / innerHeightCoords;

  // Determine final pixelsPerCoord and horizontal center
  let pixelsPerCoord: number;
  let centerX: number;

  if (leftX !== null && rightX !== null) {
    // Both left and right detected — blend with vertical scale.
    // Top/bottom weight = 0.7, left/right weight = 0.3 (left/right are least accurate).
    const horizontalPixelsPerCoord = (rightX - leftX) / innerWidthCoords;
    pixelsPerCoord = verticalPixelsPerCoord * 0.7 + horizontalPixelsPerCoord * 0.3;

    // Center of left/right corresponds to center of inner boundary coords ((13+99)/2 = 56),
    // which is also the center of the full island (112/2 = 56). So the center is simply (leftX+rightX)/2.
    centerX = (leftX + rightX) / 2;

    console.log('Generate from Screenshot: using weighted scale — ' +
      `vertical: ${verticalPixelsPerCoord.toFixed(3)}, ` +
      `horizontal: ${horizontalPixelsPerCoord.toFixed(3)}, ` +
      `blended: ${pixelsPerCoord.toFixed(3)}`);
  } else if (leftX !== null) {
    // Only left detected — use vertical scale, derive center from left boundary
    pixelsPerCoord = verticalPixelsPerCoord;
    // leftX corresponds to island coord INNER_BOUNDARY.left (13)
    // So full island left = leftX - 13 * pixelsPerCoord
    // And center = fullLeft + (ISLAND_COORD_WIDTH / 2) * pixelsPerCoord
    const fullLeft = leftX - INNER_BOUNDARY.left * pixelsPerCoord;
    centerX = fullLeft + (ISLAND_COORD_WIDTH / 2) * pixelsPerCoord;

    console.log('Generate from Screenshot: using vertical scale with left boundary for horizontal positioning');
  } else if (rightX !== null) {
    // Only right detected — use vertical scale, derive center from right boundary
    pixelsPerCoord = verticalPixelsPerCoord;
    // rightX corresponds to island coord INNER_BOUNDARY.right (99)
    // So full island left = rightX - 99 * pixelsPerCoord
    const fullLeft = rightX - INNER_BOUNDARY.right * pixelsPerCoord;
    centerX = fullLeft + (ISLAND_COORD_WIDTH / 2) * pixelsPerCoord;

    console.log('Generate from Screenshot: using vertical scale with right boundary for horizontal positioning');
  } else {
    // No left/right — use vertical scale, assume centered in image
    pixelsPerCoord = verticalPixelsPerCoord;
    centerX = imageWidth / 2;

    console.log('Generate from Screenshot: using vertical scale only, assuming centered horizontally');
  }

  // Compute full island extent from final scale and center
  const halfWidth = (ISLAND_COORD_WIDTH / 2) * pixelsPerCoord;
  const fullLeft = centerX - halfWidth;
  const fullRight = centerX + halfWidth;
  const fullTop = topY - INNER_BOUNDARY.top * pixelsPerCoord;
  const fullBottom = fullTop + ISLAND_COORD_HEIGHT * pixelsPerCoord;

  // Inner boundary pixel positions
  const innerLeft = fullLeft + INNER_BOUNDARY.left * pixelsPerCoord;
  const innerRight = fullLeft + INNER_BOUNDARY.right * pixelsPerCoord;

  return {
    pixelsPerCoord,
    full: {
      left: Math.round(fullLeft),
      top: Math.round(fullTop),
      right: Math.round(fullRight),
      bottom: Math.round(fullBottom),
    },
    inner: {
      left: Math.round(innerLeft),
      top: topY,
      right: Math.round(innerRight),
      bottom: bottomY,
    },
  };
}

// ============ Step 10: Pixelization ============

// Map an RGB pixel to a terrain type using the screenshot color samples.
// Check order: most distinctive colors first.
function classifyPixelTerrain(pixel: RGB): TerrainType {
  if (matchesAnyColor(pixel, SCREENSHOT_COLORS.WATER)) return TERRAIN.WATER;
  if (matchesAnyColor(pixel, SCREENSHOT_COLORS.ROCK))  return TERRAIN.ROCK;
  if (matchesAnyColor(pixel, SCREENSHOT_COLORS.SAND))  return TERRAIN.SAND;
  if (matchesAnyColor(pixel, SCREENSHOT_COLORS.PATH))  return TERRAIN.PATH;

  // All grass levels → undifferentiated GRASS (resolved to L1/L2/L3 per-cell later).
  // Per-pixel level detection is unreliable due to the decorative triangle tiling
  // overlay texture that shifts green channel values by ±15-25 units.
  if (isScreenshotGrass(pixel)) return TERRAIN.GRASS;

  return TERRAIN.UNKNOWN;
}

// Score how well samples separate into two triangles for a given diagonal orientation.
// Returns 0–1 where 1 = perfect separation.
function scoreDiagonal(
  samples: ClassifiedSample[],
  terrain1: TerrainType,
  terrain2: TerrainType,
  diag: DiagonalType,
): number {
  let correctCount = 0;
  let totalRelevant = 0;

  for (const s of samples) {
    // Only consider samples matching one of the two terrains
    if (s.terrain !== terrain1 && s.terrain !== terrain2) continue;
    totalRelevant++;

    // Determine which triangle this sample falls in
    let inFirstTriangle: boolean;
    if (diag === DIAGONAL.BACKSLASH) {
      // '\' split: first triangle is top-left (relX + relY < 1)
      inFirstTriangle = s.relX + s.relY < 1.0;
    } else {
      // '/' split: first triangle is top-right ((1-relX) + relY < 1)
      inFirstTriangle = (1.0 - s.relX) + s.relY < 1.0;
    }

    // Check if terrain1 is in first triangle
    const expected = inFirstTriangle ? terrain1 : terrain2;
    if (s.terrain === expected) {
      correctCount++;
    }
  }

  if (totalRelevant === 0) return 0;

  // Also try the swapped assignment (terrain2 in first triangle)
  const swappedCorrect = totalRelevant - correctCount;
  return Math.max(correctCount, swappedCorrect) / totalRelevant;
}

// Determine which terrain goes in which triangle for a given diagonal orientation.
// Returns [firstTriangleTerrain, secondTriangleTerrain].
function getTriangleTerrains(
  samples: ClassifiedSample[],
  terrain1: TerrainType,
  terrain2: TerrainType,
  diag: DiagonalType,
): [TerrainType, TerrainType] {
  let firstT1 = 0;
  let firstT2 = 0;

  for (const s of samples) {
    let inFirstTriangle: boolean;
    if (diag === DIAGONAL.BACKSLASH) {
      inFirstTriangle = s.relX + s.relY < 1.0;
    } else {
      inFirstTriangle = (1.0 - s.relX) + s.relY < 1.0;
    }

    if (inFirstTriangle) {
      if (s.terrain === terrain1) firstT1++;
      else if (s.terrain === terrain2) firstT2++;
    }
  }

  return firstT1 >= firstT2 ? [terrain1, terrain2] : [terrain2, terrain1];
}

// Pass 1: Classify a cell as solid terrain (no diagonal detection).
// Finds the dominant terrain type and resolves GRASS to L1/L2/L3.
function detectCellSolid(samples: ClassifiedSample[]): CellResult {
  // Count terrain types across all samples
  const counts = new Map<TerrainType, number>();
  for (const s of samples) {
    counts.set(s.terrain, (counts.get(s.terrain) || 0) + 1);
  }

  // Find dominant terrain
  let dominantTerrain: TerrainType = TERRAIN.UNKNOWN;
  let dominantCount = 0;
  for (const [terrain, count] of counts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantTerrain = terrain;
    }
  }

  const result: CellResult = {
    primary: dominantTerrain,
    secondary: TERRAIN.UNKNOWN,
    diagonal: DIAGONAL.NONE,
    confidence: Math.round(255 * dominantCount / samples.length),
  };

  // Resolve undifferentiated GRASS to specific level
  if (result.primary === TERRAIN.GRASS) {
    const grassRGBs = samples.filter(s => s.terrain === TERRAIN.GRASS).map(s => s.rgb);
    result.primary = resolveGrassLevel(grassRGBs);
  }

  return result;
}

// Check if a cell is at a terrain boundary (any cardinal neighbor has a different
// primary terrain type). Only boundary cells are candidates for diagonal detection.
function isBoundaryCell(grid: PixelGrid, cx: number, cy: number): boolean {
  const idx = cy * ISLAND_COORD_WIDTH + cx;
  const myTerrain = grid.primary[idx];
  const neighbors: [number, number][] = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];

  for (const [nx, ny] of neighbors) {
    if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
    if (grid.primary[ny * ISLAND_COORD_WIDTH + nx] !== myTerrain) return true;
  }
  return false;
}

// Detect if a solid boundary cell is at a terrain corner where converting
// to a diagonal would smooth the contour. A corner is when two adjacent
// cardinal neighbors (sharing a corner of the cell) have the same different terrain.
type CornerInfo = {
  diagType: DiagonalType;
  primary: TerrainType;
  secondary: TerrainType;
};

function detectCornerCell(grid: PixelGrid, cx: number, cy: number): CornerInfo | null {
  const idx = cy * ISLAND_COORD_WIDTH + cx;
  const A = grid.primary[idx] as TerrainType;

  // Read cardinal neighbors (null if off-map)
  const up    = cy > 0 ? grid.primary[(cy - 1) * ISLAND_COORD_WIDTH + cx] as TerrainType : null;
  const down  = cy < ISLAND_COORD_HEIGHT - 1 ? grid.primary[(cy + 1) * ISLAND_COORD_WIDTH + cx] as TerrainType : null;
  const left  = cx > 0 ? grid.primary[cy * ISLAND_COORD_WIDTH + (cx - 1)] as TerrainType : null;
  const right = cx < ISLAND_COORD_WIDTH - 1 ? grid.primary[cy * ISLAND_COORD_WIDTH + (cx + 1)] as TerrainType : null;

  // Check 4 adjacent corner pairs.
  // Each entry: [neighbor1, neighbor2, diagType, bIsPrimary]
  // bIsPrimary: whether terrain B goes into the primary triangle
  //
  // Corner mapping:
  //   UP+RIGHT are B → SLASH /, B in top-right (primary)
  //   RIGHT+DOWN are B → BACKSLASH \, B in bottom-right (secondary)
  //   DOWN+LEFT are B → SLASH /, B in bottom-left (secondary)
  //   LEFT+UP are B → BACKSLASH \, B in top-left (primary)
  const corners: [TerrainType | null, TerrainType | null, DiagonalType, boolean][] = [
    [up,    right, DIAGONAL.SLASH,     true],
    [right, down,  DIAGONAL.BACKSLASH, false],
    [down,  left,  DIAGONAL.SLASH,     false],
    [left,  up,    DIAGONAL.BACKSLASH, true],
  ];

  for (const [n1, n2, diagType, bIsPrimary] of corners) {
    if (n1 === null || n2 === null) continue;
    if (n1 === n2 && n1 !== A) {
      const B = n1;
      return {
        diagType,
        primary: bIsPrimary ? B : A,
        secondary: bIsPrimary ? A : B,
      };
    }
  }
  return null;
}

// Get the terrain type on a specific edge of a cell.
// For solid cells, all edges have the primary terrain.
// For diagonal cells, edges are split between primary and secondary:
//   BACKSLASH \: primary = top + left edges, secondary = right + bottom edges
//   SLASH /:     primary = top + right edges, secondary = left + bottom edges
type Edge = 'top' | 'right' | 'bottom' | 'left';

function getTerrainOnEdge(grid: PixelGrid, cx: number, cy: number, edge: Edge): TerrainType | null {
  if (cx < 0 || cx >= ISLAND_COORD_WIDTH || cy < 0 || cy >= ISLAND_COORD_HEIGHT) return null;
  const idx = cy * ISLAND_COORD_WIDTH + cx;
  const diag = grid.diagonal[idx];

  if (diag === DIAGONAL.NONE) return grid.primary[idx] as TerrainType;

  if (diag === DIAGONAL.BACKSLASH) {
    return (edge === 'top' || edge === 'left')
      ? grid.primary[idx] as TerrainType
      : grid.secondary[idx] as TerrainType;
  }
  // SLASH: primary = top + right, secondary = left + bottom
  return (edge === 'top' || edge === 'right')
    ? grid.primary[idx] as TerrainType
    : grid.secondary[idx] as TerrainType;
}

// Pre-check whether a proposed diagonal would satisfy the 2-neighbor smooth
// contour rule. Used as a guard to only lower the corner detection threshold
// when the result would actually create a smoother contour (not a sharp edge).
function wouldDiagonalBeSmooth(
  grid: PixelGrid, cx: number, cy: number,
  diagType: DiagonalType, primary: TerrainType, secondary: TerrainType,
): boolean {
  let priEdges: [number, number, Edge][];
  let secEdges: [number, number, Edge][];

  if (diagType === DIAGONAL.BACKSLASH) {
    priEdges = [[cx, cy - 1, 'bottom'], [cx - 1, cy, 'right']];
    secEdges = [[cx + 1, cy, 'left'], [cx, cy + 1, 'top']];
  } else {
    priEdges = [[cx, cy - 1, 'bottom'], [cx + 1, cy, 'left']];
    secEdges = [[cx, cy + 1, 'top'], [cx - 1, cy, 'right']];
  }

  let priMatch = 0;
  for (const [nx, ny, edge] of priEdges) {
    const t = getTerrainOnEdge(grid, nx, ny, edge);
    if (t === null || t === primary) priMatch++;
  }

  let secMatch = 0;
  for (const [nx, ny, edge] of secEdges) {
    const t = getTerrainOnEdge(grid, nx, ny, edge);
    if (t === null || t === secondary) secMatch++;
  }

  return priMatch === 2 && secMatch === 2;
}

// Validate that both triangles of a diagonal cell are in geometric contact
// with matching terrain in adjacent cells. Smooth contour rule: each triangle
// should normally contact 2 matching neighbors. High-confidence diagonals
// (score ≥ 0.85) can get by with just 1.
function isDiagonalValid(grid: PixelGrid, cx: number, cy: number): boolean {
  const idx = cy * ISLAND_COORD_WIDTH + cx;
  const pri = grid.primary[idx] as TerrainType;
  const sec = grid.secondary[idx] as TerrainType;
  const diag = grid.diagonal[idx];
  const conf = grid.confidence[idx];

  // Determine which neighbors to check for each triangle.
  // Each entry is [neighborX, neighborY, edgeOnNeighborToCheck].
  let priEdges: [number, number, Edge][];
  let secEdges: [number, number, Edge][];

  if (diag === DIAGONAL.BACKSLASH) {
    // Primary (top-left) occupies TOP and LEFT edges
    priEdges = [[cx, cy - 1, 'bottom'], [cx - 1, cy, 'right']];
    // Secondary (bottom-right) occupies RIGHT and BOTTOM edges
    secEdges = [[cx + 1, cy, 'left'], [cx, cy + 1, 'top']];
  } else {
    // Primary (top-right) occupies TOP and RIGHT edges
    priEdges = [[cx, cy - 1, 'bottom'], [cx + 1, cy, 'left']];
    // Secondary (bottom-left) occupies BOTTOM and LEFT edges
    secEdges = [[cx, cy + 1, 'top'], [cx - 1, cy, 'right']];
  }

  // Count matching edges per triangle (not just "any")
  let priMatchCount = 0;
  for (const [nx, ny, edge] of priEdges) {
    const t = getTerrainOnEdge(grid, nx, ny, edge);
    if (t === null || t === pri) priMatchCount++; // null = off-map = ok
  }

  let secMatchCount = 0;
  for (const [nx, ny, edge] of secEdges) {
    const t = getTerrainOnEdge(grid, nx, ny, edge);
    if (t === null || t === sec) secMatchCount++;
  }

  // Smooth contour: both triangles touch 2 matching neighbors
  if (priMatchCount === 2 && secMatchCount === 2) return true;

  // High confidence exception (score ≥ 0.85): allow 1+ match per triangle
  const HIGH_CONFIDENCE = 217; // Math.round(0.85 * 255)
  if (conf >= HIGH_CONFIDENCE && priMatchCount >= 1 && secMatchCount >= 1) return true;

  return false;
}

// Pass 2: Attempt diagonal detection for a boundary cell.
// Only called on cells where isBoundaryCell() returned true.
// Uses higher thresholds than the old single-pass approach since spatial
// filtering already limits candidates to plausible locations.
function detectCellDiagonal(
  samples: ClassifiedSample[],
  currentPrimary: TerrainType,
  minScore = 0.70,  // default threshold, lowered for corner cells
): CellResult {
  // Count terrain types in samples
  const counts = new Map<TerrainType, number>();
  for (const s of samples) {
    counts.set(s.terrain, (counts.get(s.terrain) || 0) + 1);
  }
  const total = samples.length;

  // Find dominant terrain
  let dominantTerrain: TerrainType = TERRAIN.UNKNOWN;
  let dominantCount = 0;
  for (const [terrain, count] of counts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantTerrain = terrain;
    }
  }

  // If ≥90% is one terrain, it's definitely solid (higher bar than pass 1)
  if (dominantCount / total >= 0.90) {
    return {
      primary: currentPrimary,
      secondary: TERRAIN.UNKNOWN,
      diagonal: DIAGONAL.NONE,
      confidence: Math.round(255 * dominantCount / total),
    };
  }

  // Find second most common terrain
  let secondTerrain: TerrainType = TERRAIN.UNKNOWN;
  let secondCount = 0;
  for (const [terrain, count] of counts) {
    if (terrain !== dominantTerrain && count > secondCount) {
      secondCount = count;
      secondTerrain = terrain;
    }
  }

  // If second terrain < 15% of samples → noise, keep solid
  if (secondCount / total < 0.15) {
    return {
      primary: currentPrimary,
      secondary: TERRAIN.UNKNOWN,
      diagonal: DIAGONAL.NONE,
      confidence: Math.round(255 * dominantCount / total),
    };
  }

  // Score both diagonal orientations (reuse existing scoring functions)
  const backslashScore = scoreDiagonal(samples, dominantTerrain, secondTerrain, DIAGONAL.BACKSLASH);
  const slashScore = scoreDiagonal(samples, dominantTerrain, secondTerrain, DIAGONAL.SLASH);

  let result: CellResult;

  if (backslashScore >= slashScore && backslashScore >= minScore) {
    const [primary, secondary] = getTriangleTerrains(
      samples, dominantTerrain, secondTerrain, DIAGONAL.BACKSLASH,
    );
    result = {
      primary, secondary,
      diagonal: DIAGONAL.BACKSLASH,
      confidence: Math.round(255 * backslashScore),
    };
  } else if (slashScore >= minScore) {
    const [primary, secondary] = getTriangleTerrains(
      samples, dominantTerrain, secondTerrain, DIAGONAL.SLASH,
    );
    result = {
      primary, secondary,
      diagonal: DIAGONAL.SLASH,
      confidence: Math.round(255 * slashScore),
    };
  } else {
    // Neither diagonal fits — keep solid from pass 1
    return {
      primary: currentPrimary,
      secondary: TERRAIN.UNKNOWN,
      diagonal: DIAGONAL.NONE,
      confidence: Math.round(255 * dominantCount / total),
    };
  }

  // Resolve GRASS in diagonal results
  if (result.primary === TERRAIN.GRASS || result.secondary === TERRAIN.GRASS) {
    const grassRGBs = samples.filter(s => s.terrain === TERRAIN.GRASS).map(s => s.rgb);
    const resolvedLevel = resolveGrassLevel(grassRGBs);
    if (result.primary === TERRAIN.GRASS) result.primary = resolvedLevel;
    if (result.secondary === TERRAIN.GRASS) result.secondary = resolvedLevel;
  }

  return result;
}

// ============ Edge Tile Matching ============
// After solid terrain classification, match each of the 24 edge tile block regions
// against the reference tile library. Edge tiles only contain water, sand, and rock.

// 24 edge tile positions in counter-clockwise order (block coordinates)
const EDGE_CCW_POSITIONS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4],  // Left edge
  [0, 5],                            // Bottom-left corner
  [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],  // Bottom edge
  [6, 5],                            // Bottom-right corner
  [6, 4], [6, 3], [6, 2], [6, 1],  // Right edge
  [6, 0],                            // Top-right corner
  [5, 0], [4, 0], [3, 0], [2, 0], [1, 0],  // Top edge
  [0, 0],                            // Top-left corner
];

const EDGE_TILE_MIN_SCORE = 0.60;

// SVG edge tile colors → terrain mapping
const SVG_EDGE_COLORS: Array<{ r: number; g: number; b: number; terrain: TerrainType }> = [
  { r: 0x83, g: 0xe1, b: 0xc3, terrain: TERRAIN.WATER },  // #83e1c3
  { r: 0xee, g: 0xe9, b: 0xa9, terrain: TERRAIN.SAND },   // #eee9a9
  { r: 0x73, g: 0x7a, b: 0x89, terrain: TERRAIN.ROCK },   // #737a89
];

// Parse SVG path elements from cached inner content
function parseSvgPaths(svgInnerContent: string): Array<{ d: string; fill: string }> {
  const paths: Array<{ d: string; fill: string }> = [];
  const regex = /<path\s+d="([^"]+)"\s+fill="([^"]+)"\s*\/>/g;
  let match;
  while ((match = regex.exec(svgInnerContent)) !== null) {
    paths.push({ d: match[1], fill: match[2] });
  }
  return paths;
}

// Render SVG paths to 16×16 canvas and classify each pixel as terrain
function rasterizeSvgToTerrainGrid(
  svgInnerContent: string, ctx: CanvasRenderingContext2D,
): Uint8Array {
  ctx.clearRect(0, 0, 16, 16);
  for (const { d, fill } of parseSvgPaths(svgInnerContent)) {
    ctx.fillStyle = fill;
    ctx.fill(new Path2D(d));
  }
  const imageData = ctx.getImageData(0, 0, 16, 16);
  const grid = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const r = imageData.data[i * 4];
    const g = imageData.data[i * 4 + 1];
    const b = imageData.data[i * 4 + 2];
    // Nearest SVG color by Euclidean distance (tolerance for antialiasing)
    let bestTerrain: TerrainType = TERRAIN.UNKNOWN;
    let bestDist = 30; // max tolerance
    for (const c of SVG_EDGE_COLORS) {
      const dist = Math.sqrt((r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2);
      if (dist < bestDist) { bestDist = dist; bestTerrain = c.terrain; }
    }
    grid[i] = bestTerrain;
  }
  return grid;
}

type EdgeTileRef = { direction: TileDirection; terrainGrid: Uint8Array };

type EdgeTileMatch = {
  blockX: number;
  blockY: number;
  assetIndex: number;
  score: number;
  refTerrain: Uint8Array | null;  // 16×16 terrain grid, null if no match
};

type EdgeTileMatchResult = {
  assetIndices: number[];
  matches: EdgeTileMatch[];
};

// Build reference library: rasterize all 83 edge tile SVGs into 16×16 terrain grids
function buildEdgeTileReferenceLibrary(): Map<number, EdgeTileRef> {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const library = new Map<number, EdgeTileRef>();

  for (const [index, data] of assetIndexToData) {
    const cached = tilesDataCache[data.imageSrc];
    if (!cached) continue;
    const terrainGrid = rasterizeSvgToTerrainGrid(cached.svg, ctx);
    library.set(index, { direction: data.direction, terrainGrid });
  }

  console.log(`Edge tile reference library: ${library.size} tiles`);
  return library;
}

// Extract 16×16 terrain from PixelGrid for a block, keeping only water/sand/rock
function extractBlockTerrain(grid: PixelGrid, blockX: number, blockY: number): Uint8Array {
  const terrain = new Uint8Array(256);
  const startX = blockX * 16;
  const startY = blockY * 16;
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const t = grid.primary[(startY + ly) * ISLAND_COORD_WIDTH + (startX + lx)];
      if (t === TERRAIN.WATER || t === TERRAIN.SAND || t === TERRAIN.ROCK) {
        terrain[ly * 16 + lx] = t;
      } else {
        terrain[ly * 16 + lx] = TERRAIN.UNKNOWN;
      }
    }
  }
  return terrain;
}

// Jaccard similarity between two 16×16 terrain grids across water/sand/rock
function compareTerrainGrids(screenshot: Uint8Array, reference: Uint8Array): number {
  const types = [TERRAIN.WATER, TERRAIN.SAND, TERRAIN.ROCK];
  let totalIntersection = 0;
  let totalUnion = 0;
  for (const t of types) {
    for (let i = 0; i < 256; i++) {
      const inS = screenshot[i] === t;
      const inR = reference[i] === t;
      if (inS && inR) { totalIntersection++; totalUnion++; }
      else if (inS || inR) { totalUnion++; }
    }
  }
  return totalUnion > 0 ? totalIntersection / totalUnion : 0;
}

// Write matched reference tile terrain back into the PixelGrid
function writeReferenceTerrainToGrid(
  grid: PixelGrid, blockX: number, blockY: number,
  refTerrain: Uint8Array, score: number,
): void {
  const startX = blockX * 16;
  const startY = blockY * 16;
  const conf = Math.round(score * 255);
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const idx = (startY + ly) * ISLAND_COORD_WIDTH + (startX + lx);
      const refT = refTerrain[ly * 16 + lx];
      if (refT !== TERRAIN.UNKNOWN) {
        grid.primary[idx] = refT;
        grid.confidence[idx] = conf;
      }
      // Reset diagonals (not applicable to edge tiles)
      grid.diagonal[idx] = DIAGONAL.NONE;
      grid.secondary[idx] = TERRAIN.UNKNOWN;
    }
  }
}

// Match each of the 24 edge tile regions against the reference library.
// Returns CCW array of 24 asset indices plus per-position match details for debug.
function matchEdgeTiles(grid: PixelGrid): EdgeTileMatchResult {
  const library = buildEdgeTileReferenceLibrary();
  const assetIndices: number[] = [];
  const matches: EdgeTileMatch[] = [];
  let matchCount = 0;

  for (const [blockX, blockY] of EDGE_CCW_POSITIONS) {
    const screenshotTerrain = extractBlockTerrain(grid, blockX, blockY);
    const direction = getTileDirection(blockX, blockY);

    let bestIndex = -1;
    let bestScore = 0;

    for (const [assetIndex, ref] of library) {
      if (ref.direction !== direction) continue;
      const score = compareTerrainGrids(screenshotTerrain, ref.terrainGrid);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = assetIndex;
      }
    }

    if (bestScore >= EDGE_TILE_MIN_SCORE && bestIndex >= 0) {
      writeReferenceTerrainToGrid(
        grid, blockX, blockY, library.get(bestIndex)!.terrainGrid, bestScore,
      );
      assetIndices.push(bestIndex);
      matches.push({
        blockX, blockY,
        assetIndex: bestIndex,
        score: bestScore,
        refTerrain: library.get(bestIndex)!.terrainGrid,
      });
      matchCount++;
      console.log(`Edge tile (${blockX},${blockY}) [${direction}]: ` +
        `asset ${bestIndex} (${(bestScore * 100).toFixed(0)}%)`);
    } else {
      const placeholder = getPlaceholderIndexForPosition(blockX, blockY);
      assetIndices.push(placeholder);
      matches.push({
        blockX, blockY,
        assetIndex: placeholder,
        score: bestScore,
        refTerrain: null,
      });
      console.warn(`Edge tile (${blockX},${blockY}) [${direction}]: ` +
        `no match (best: ${bestIndex} at ${(bestScore * 100).toFixed(0)}%)`);
    }
  }

  console.log(`Generate from Screenshot: edge tiles — ${matchCount}/24 matched`);
  return { assetIndices, matches };
}

// After edge tile matching, convert sand/rock/water in edge blocks to level1.
// Edge tiles define the visual coastline; the terrain grid should be all level1.
function fillEdgeRegionsWithLevel1(grid: PixelGrid): void {
  for (const [blockX, blockY] of EDGE_CCW_POSITIONS) {
    const startX = blockX * 16;
    const startY = blockY * 16;
    for (let ly = 0; ly < 16; ly++) {
      for (let lx = 0; lx < 16; lx++) {
        const idx = (startY + ly) * ISLAND_COORD_WIDTH + (startX + lx);
        const t = grid.primary[idx];
        if (t === TERRAIN.SAND || t === TERRAIN.ROCK || t === TERRAIN.WATER) {
          grid.primary[idx] = TERRAIN.LEVEL1;
        }
      }
    }
  }
  console.log('Generate from Screenshot: edge regions filled with level1');
}

// Fill detected icon regions at pixel level in the raw screenshot data.
// Samples grass-colored pixels immediately surrounding each icon's opaque shape,
// then paints over the icon pixels with the appropriate grass color.
// Exception types (airport, town hall, center, antiques) always get LEVEL1.
const LEVEL1_ALWAYS_TYPES = new Set(['airportBlue', 'townhallSprite', 'center', 'campsiteSprite']);

// Convert terrain level to a representative screenshot color
function terrainLevelToColor(t: TerrainType): RGB {
  if (t === TERRAIN.WATER) return SCREENSHOT_COLORS.WATER[0];
  if (t === TERRAIN.LEVEL3) return SCREENSHOT_COLORS.LEVEL3_GRASS[0];
  if (t === TERRAIN.LEVEL2) return SCREENSHOT_COLORS.LEVEL2_GRASS[0];
  return SCREENSHOT_COLORS.LEVEL1_GRASS[0];
}

// For stairs: sample the terrain at the foot end to determine fill level.
// The foot direction depends on the stairs orientation.
function sampleTerrainAtStairsFoot(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  icon: DetectedIcon,
): TerrainType {
  const [bMinX, bMinY, bMaxX, bMaxY] = icon.blobBBoxPx;
  const sampleDepth = 5;
  const rotation = icon.orientation?.rotation ?? 0;

  const samples: RGB[] = [];

  if (rotation === 0) {
    // StairsUp: foot = bottom edge → sample below
    for (let x = Math.round(bMinX); x <= Math.round(bMaxX); x++) {
      for (let d = 1; d <= sampleDepth; d++) {
        const sy = Math.round(bMaxY) + d;
        if (sy >= imageHeight) continue;
        const pixel = getPixelAt(data, imageWidth, x, sy);
        if (isScreenshotGrass(pixel)) samples.push(pixel);
      }
    }
  } else if (rotation === 180) {
    // StairsDown: foot = top edge → sample above
    for (let x = Math.round(bMinX); x <= Math.round(bMaxX); x++) {
      for (let d = 1; d <= sampleDepth; d++) {
        const sy = Math.round(bMinY) - d;
        if (sy < 0) continue;
        const pixel = getPixelAt(data, imageWidth, x, sy);
        if (isScreenshotGrass(pixel)) samples.push(pixel);
      }
    }
  } else if (rotation === 90) {
    // StairsRight: foot = left edge → sample left
    for (let y = Math.round(bMinY); y <= Math.round(bMaxY); y++) {
      for (let d = 1; d <= sampleDepth; d++) {
        const sx = Math.round(bMinX) - d;
        if (sx < 0) continue;
        const pixel = getPixelAt(data, imageWidth, sx, y);
        if (isScreenshotGrass(pixel)) samples.push(pixel);
      }
    }
  } else if (rotation === 270) {
    // StairsLeft: foot = right edge → sample right
    for (let y = Math.round(bMinY); y <= Math.round(bMaxY); y++) {
      for (let d = 1; d <= sampleDepth; d++) {
        const sx = Math.round(bMaxX) + d;
        if (sx >= imageWidth) continue;
        const pixel = getPixelAt(data, imageWidth, sx, y);
        if (isScreenshotGrass(pixel)) samples.push(pixel);
      }
    }
  }

  if (samples.length === 0) return TERRAIN.LEVEL1;
  return resolveGrassLevel(samples);
}

// Check if a pixel looks like a background color (grass, water, sand, rock, path)
function isBackgroundPixel(pixel: RGB): boolean {
  return isScreenshotGrass(pixel)
    || matchesAnyColor(pixel, SCREENSHOT_COLORS.WATER, 30)
    || matchesAnyColor(pixel, SCREENSHOT_COLORS.SAND, 30)
    || matchesAnyColor(pixel, SCREENSHOT_COLORS.ROCK, 30)
    || matchesAnyColor(pixel, SCREENSHOT_COLORS.PATH, 30);
}

async function fillIconRegionsWithTerrain(
  data: Uint8ClampedArray,
  imageWidth: number,
  extents: IslandExtents,
  grid: PixelGrid,
  detectedIcons: DetectedIcon[],
): Promise<void> {
  const imageHeight = Math.floor(data.length / 4 / imageWidth);

  for (const icon of detectedIcons) {
    // 1. Load and scale the template to match the blob's screen-pixel size
    // Use rotated template if orientation was resolved
    let tmpl: { data: Uint8ClampedArray; width: number; height: number };
    if (icon.orientation) {
      tmpl = await rotateTemplateImage(icon.template.imagePath, icon.orientation.rotation);
    } else {
      tmpl = await loadTemplateImage(icon.template.imagePath);
    }

    const [bMinX, bMinY, bMaxX, bMaxY] = icon.blobBBoxPx;
    const blobW = Math.round(bMaxX - bMinX + 1);
    const blobH = Math.round(bMaxY - bMinY + 1);

    // Scale template to blob bbox (same pattern as matchBlobToTemplate)
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = tmpl.width;
    tmpCanvas.height = tmpl.height;
    const tmpCtx = tmpCanvas.getContext('2d')!;
    const tmpImageData = tmpCtx.createImageData(tmpl.width, tmpl.height);
    tmpImageData.data.set(tmpl.data);
    tmpCtx.putImageData(tmpImageData, 0, 0);

    const scaleCanvas = document.createElement('canvas');
    scaleCanvas.width = blobW;
    scaleCanvas.height = blobH;
    const scaleCtx = scaleCanvas.getContext('2d')!;
    scaleCtx.drawImage(tmpCanvas, 0, 0, tmpl.width, tmpl.height, 0, 0, blobW, blobH);
    const scaledData = scaleCtx.getImageData(0, 0, blobW, blobH).data;

    // 2. Build set of opaque icon pixels in screen coordinates (linear indices)
    const opaquePixels = new Set<number>();
    const blobOriginX = Math.round(bMinX);
    const blobOriginY = Math.round(bMinY);
    for (let ly = 0; ly < blobH; ly++) {
      for (let lx = 0; lx < blobW; lx++) {
        const alpha = scaledData[(ly * blobW + lx) * 4 + 3];
        if (alpha < 128) continue;
        const sx = blobOriginX + lx;
        const sy = blobOriginY + ly;
        if (sx >= 0 && sx < imageWidth && sy >= 0 && sy < imageHeight) {
          opaquePixels.add(sy * imageWidth + sx);
        }
      }
    }

    // 2b. Dilate the fill region by 2-3px beyond the opaque boundary.
    // BFS outward from boundary pixels, stopping at background-colored pixels.
    const DILATION_DEPTH = 3;
    const dilatedPixels = new Set<number>(opaquePixels);
    const dilationQueue: Array<{ idx: number; depth: number }> = [];
    const dx4 = [0, 0, -1, 1];
    const dy4 = [-1, 1, 0, 0];

    // Seed BFS with boundary pixels of the opaque set
    for (const linearIdx of opaquePixels) {
      const px = linearIdx % imageWidth;
      const py = Math.floor(linearIdx / imageWidth);
      let isBoundary = false;
      for (let d = 0; d < 4; d++) {
        const nx = px + dx4[d];
        const ny = py + dy4[d];
        if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) { isBoundary = true; continue; }
        if (!opaquePixels.has(ny * imageWidth + nx)) { isBoundary = true; }
      }
      if (isBoundary) {
        for (let d = 0; d < 4; d++) {
          const nx = px + dx4[d];
          const ny = py + dy4[d];
          if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
          const neighborIdx = ny * imageWidth + nx;
          if (dilatedPixels.has(neighborIdx)) continue;
          dilationQueue.push({ idx: neighborIdx, depth: 1 });
        }
      }
    }

    // BFS dilation: expand outward up to DILATION_DEPTH, stopping at background pixels
    for (let qi = 0; qi < dilationQueue.length; qi++) {
      const { idx, depth } = dilationQueue[qi];
      if (dilatedPixels.has(idx)) continue;
      if (depth > DILATION_DEPTH) continue;

      const px = idx % imageWidth;
      const py = Math.floor(idx / imageWidth);
      const pixel = getPixelAt(data, imageWidth, px, py);

      // Stop if pixel is already a background color (grass, water, sand, etc.)
      if (isBackgroundPixel(pixel)) continue;

      dilatedPixels.add(idx);

      // Continue BFS to neighbors
      if (depth < DILATION_DEPTH) {
        for (let d = 0; d < 4; d++) {
          const nx = px + dx4[d];
          const ny = py + dy4[d];
          if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
          const neighborIdx = ny * imageWidth + nx;
          if (dilatedPixels.has(neighborIdx)) continue;
          dilationQueue.push({ idx: neighborIdx, depth: depth + 1 });
        }
      }
    }

    // 3. Determine fill color based on fillBehavior
    const fillBehavior = icon.template.fillBehavior ?? 'grass';
    let paintColor: RGB;
    let gridFillTerrain: TerrainType;

    if (fillBehavior === 'water') {
      paintColor = SCREENSHOT_COLORS.WATER[0];
      gridFillTerrain = TERRAIN.WATER;
    } else if (fillBehavior === 'terrain-foot') {
      const footLevel = sampleTerrainAtStairsFoot(data, imageWidth, imageHeight, icon);
      paintColor = terrainLevelToColor(footLevel);
      gridFillTerrain = footLevel;
    } else {
      // Grass fill — determine level from surrounding pixels
      let fillLevel: TerrainType = TERRAIN.LEVEL1;

      if (!LEVEL1_ALWAYS_TYPES.has(icon.template.type)) {
        // Sample border pixels adjacent to the opaque shape
        const grassSamples: RGB[] = [];
        const visited = new Set<number>();

        for (const linearIdx of opaquePixels) {
          const px = linearIdx % imageWidth;
          const py = Math.floor(linearIdx / imageWidth);
          for (let d = 0; d < 4; d++) {
            const nx = px + dx4[d];
            const ny = py + dy4[d];
            if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
            const neighborIdx = ny * imageWidth + nx;
            if (opaquePixels.has(neighborIdx)) continue; // inside the icon
            if (visited.has(neighborIdx)) continue;
            visited.add(neighborIdx);

            const pixel = getPixelAt(data, imageWidth, nx, ny);
            // Skip pixels matching the icon's own colors (anti-aliased bleed)
            let isIconColor = false;
            for (const ic of icon.template.colors) {
              if (colorDistance(pixel, ic) <= icon.template.colorTolerance) {
                isIconColor = true;
                break;
              }
            }
            if (isIconColor) continue;

            if (isScreenshotGrass(pixel)) {
              grassSamples.push(pixel);
            }
          }
        }

        fillLevel = resolveGrassLevel(grassSamples);
      }

      paintColor = terrainLevelToColor(fillLevel);
      gridFillTerrain = fillLevel;
    }

    // 4. Paint over every pixel in the dilated fill region
    for (const linearIdx of dilatedPixels) {
      const dataIdx = linearIdx * 4;
      data[dataIdx] = paintColor.r;
      data[dataIdx + 1] = paintColor.g;
      data[dataIdx + 2] = paintColor.b;
    }

    // 5. Also update pixelGrid (needed for downstream fillEdgeRegionsWithLevel1 and debug)
    const [objW, objH] = icon.resolvedObjectSize ?? icon.template.objectSizeInCoords;
    const gx0 = Math.max(0, Math.round(icon.centerCoordX - objW / 2));
    const gy0 = Math.max(0, Math.round(icon.centerCoordY - objH / 2));
    const gx1 = Math.min(ISLAND_COORD_WIDTH, Math.round(icon.centerCoordX + objW / 2));
    const gy1 = Math.min(ISLAND_COORD_HEIGHT, Math.round(icon.centerCoordY + objH / 2));
    for (let y = gy0; y < gy1; y++) {
      for (let x = gx0; x < gx1; x++) {
        const idx = y * ISLAND_COORD_WIDTH + x;
        grid.primary[idx] = gridFillTerrain;
        grid.diagonal[idx] = DIAGONAL.NONE;
        grid.secondary[idx] = TERRAIN.UNKNOWN;
      }
    }

    const fillLabel = fillBehavior === 'water' ? 'WATER'
      : fillBehavior === 'terrain-foot' ? `FOOT(${gridFillTerrain === TERRAIN.LEVEL1 ? 'L1' : gridFillTerrain === TERRAIN.LEVEL2 ? 'L2' : 'L3'})`
      : gridFillTerrain === TERRAIN.LEVEL1 ? 'L1' : gridFillTerrain === TERRAIN.LEVEL2 ? 'L2' : 'L3';
    console.log(`  Fill icon region: ${icon.template.name} → ${fillLabel} (${dilatedPixels.size} px painted, ${dilatedPixels.size - opaquePixels.size} dilated)`);
  }
  console.log(`Generate from Screenshot: ${detectedIcons.length} icon regions filled with terrain`);
}

// ============ Icon Detection Functions ============

// Convert pixel coordinates to island coordinates
function pixelToIslandCoord(
  px: number, py: number, extents: IslandExtents,
): { cx: number; cy: number } {
  const cx = (px - extents.full.left) / extents.pixelsPerCoord;
  const cy = (py - extents.full.top) / extents.pixelsPerCoord;
  return { cx, cy };
}

// Clear a rectangular region in the grid to UNKNOWN terrain
function clearGridRegion(
  grid: PixelGrid,
  topLeftX: number, topLeftY: number,
  width: number, height: number,
): void {
  const x0 = Math.max(0, Math.round(topLeftX));
  const y0 = Math.max(0, Math.round(topLeftY));
  const x1 = Math.min(ISLAND_COORD_WIDTH, Math.round(topLeftX + width));
  const y1 = Math.min(ISLAND_COORD_HEIGHT, Math.round(topLeftY + height));

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = y * ISLAND_COORD_WIDTH + x;
      grid.primary[idx] = TERRAIN.UNKNOWN;
      grid.diagonal[idx] = DIAGONAL.NONE;
      grid.secondary[idx] = TERRAIN.UNKNOWN;
    }
  }
}

// Phase 1: Find connected regions of pixels matching any of the target colors.
// Uses BFS with 8-connectivity to handle anti-aliased edges.
// Only scans within the island extents.
function findColorBlobs(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
  targetColors: RGB[],
  tolerance: number,
  maskDilationRadius = 0,
): ColorBlob[] {
  const { left, top, right, bottom } = extents.full;
  const scanWidth = right - left;
  const scanHeight = bottom - top;
  const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy8 = [-1, -1, -1, 0, 0, 1, 1, 1];

  // Build boolean mask: true where pixel matches ANY target color
  const mask = new Uint8Array(scanWidth * scanHeight);
  for (let sy = 0; sy < scanHeight; sy++) {
    const imgY = top + sy;
    if (imgY < 0 || imgY >= imageHeight) continue;
    for (let sx = 0; sx < scanWidth; sx++) {
      const imgX = left + sx;
      if (imgX < 0 || imgX >= imageWidth) continue;
      const pi = (imgY * imageWidth + imgX) * 4;
      const pixel: RGB = { r: data[pi], g: data[pi + 1], b: data[pi + 2] };
      for (const tc of targetColors) {
        if (colorDistance(pixel, tc) <= tolerance) {
          mask[sy * scanWidth + sx] = 1;
          break;
        }
      }
    }
  }

  // Optional mask dilation: bridge narrow gaps in fragmented icons (e.g., stairs steps)
  if (maskDilationRadius > 0) {
    for (let round = 0; round < maskDilationRadius; round++) {
      const prev = new Uint8Array(mask);
      for (let sy = 0; sy < scanHeight; sy++) {
        for (let sx = 0; sx < scanWidth; sx++) {
          if (prev[sy * scanWidth + sx]) continue; // already set
          for (let d = 0; d < 8; d++) {
            const nx = sx + dx8[d];
            const ny = sy + dy8[d];
            if (nx >= 0 && nx < scanWidth && ny >= 0 && ny < scanHeight
                && prev[ny * scanWidth + nx]) {
              mask[sy * scanWidth + sx] = 1;
              break;
            }
          }
        }
      }
    }
  }

  // BFS connected components with 8-connectivity
  const visited = new Uint8Array(scanWidth * scanHeight);
  const blobs: ColorBlob[] = [];

  for (let sy = 0; sy < scanHeight; sy++) {
    for (let sx = 0; sx < scanWidth; sx++) {
      const mi = sy * scanWidth + sx;
      if (!mask[mi] || visited[mi]) continue;

      // Start new blob via BFS
      const pixels = new Set<number>();
      let minX = sx, maxX = sx, minY = sy, maxY = sy;
      const queue: number[] = [mi];
      visited[mi] = 1;

      while (queue.length > 0) {
        const ci = queue.pop()!;
        pixels.add(ci);
        const cy = Math.floor(ci / scanWidth);
        const cx = ci % scanWidth;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (let d = 0; d < 8; d++) {
          const nx = cx + dx8[d];
          const ny = cy + dy8[d];
          if (nx < 0 || nx >= scanWidth || ny < 0 || ny >= scanHeight) continue;
          const ni = ny * scanWidth + nx;
          if (!mask[ni] || visited[ni]) continue;
          visited[ni] = 1;
          queue.push(ni);
        }
      }

      blobs.push({
        pixels,
        minX: left + minX,
        minY: top + minY,
        maxX: left + maxX,
        maxY: top + maxY,
        area: pixels.size,
      });
    }
  }

  return blobs;
}

// Phase 2: Validate whether a color blob matches the expected icon shape.
// Returns confidence 0–1 (0 = reject).
function validateBlob(
  blob: ColorBlob,
  template: IconTemplate,
  pixelsPerCoord: number,
): number {
  // Scale the template's opaque pixel count to screenshot resolution.
  // Template images are at ICON_TEMPLATE_SCALE px/coord; screenshot is at pixelsPerCoord.
  // Area scales as the square of the linear scale ratio.
  const scaleRatio = pixelsPerCoord / ICON_TEMPLATE_SCALE;
  const expectedAreaPx = template.opaqueArea * scaleRatio * scaleRatio;
  const [expectedW, expectedH] = template.sizeInCoords;

  // Check area range: 30% to 200% of expected
  if (blob.area < expectedAreaPx * 0.3 || blob.area > expectedAreaPx * 2.0) {
    return 0;
  }

  // Check aspect ratio
  const bboxW = blob.maxX - blob.minX + 1;
  const bboxH = blob.maxY - blob.minY + 1;
  const aspect = bboxW / bboxH;
  if (aspect < template.aspectRatioRange[0] || aspect > template.aspectRatioRange[1]) {
    return 0;
  }

  // Check fill ratio
  const bboxArea = bboxW * bboxH;
  const fillRatio = blob.area / bboxArea;
  if (fillRatio < template.minFillRatio) {
    return 0;
  }

  // Confidence = weighted combination
  // Size match (50%): how close the area is to expected
  const sizeRatio = blob.area / expectedAreaPx;
  const sizeFit = 1 - Math.min(1, Math.abs(sizeRatio - 1));

  // Aspect match (30%): how close to expected aspect
  const expectedAspect = expectedW / expectedH;
  const aspectFit = 1 - Math.min(1, Math.abs(aspect / expectedAspect - 1));

  // Fill ratio (20%): higher is better
  const fillFit = Math.min(1, fillRatio / 0.8);

  return sizeFit * 0.5 + aspectFit * 0.3 + fillFit * 0.2;
}

// Cache for loaded template images (imagePath → ImageData + dimensions)
const templateImageCache = new Map<string, { data: Uint8ClampedArray; width: number; height: number }>();

// Load a template image and cache its pixel data
async function loadTemplateImage(
  imagePath: string,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const cached = templateImageCache.get(imagePath);
  if (cached) return cached;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load template: ${imagePath}`));
    el.src = imagePath;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  const entry = { data: imageData.data, width: img.width, height: img.height };
  templateImageCache.set(imagePath, entry);
  return entry;
}

// Cache for rotated template images (key: "imagePath_degrees")
const rotatedTemplateCache = new Map<string, { data: Uint8ClampedArray; width: number; height: number }>();

// Rotate template image data by the given degrees.
// Supports 0, 45, 90, 135, 180, 270.
// Returns rotated pixel data and new dimensions.
async function rotateTemplateImage(
  imagePath: string,
  degrees: number,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  if (degrees === 0) return loadTemplateImage(imagePath);

  const cacheKey = `${imagePath}_${degrees}`;
  const cached = rotatedTemplateCache.get(cacheKey);
  if (cached) return cached;

  const src = await loadTemplateImage(imagePath);

  // Put source data onto a canvas
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = src.width;
  srcCanvas.height = src.height;
  const srcCtx = srcCanvas.getContext('2d')!;
  const srcImageData = srcCtx.createImageData(src.width, src.height);
  srcImageData.data.set(src.data);
  srcCtx.putImageData(srcImageData, 0, 0);

  const radians = (degrees * Math.PI) / 180;

  let outW: number;
  let outH: number;

  if (degrees === 90 || degrees === 270) {
    outW = src.height;
    outH = src.width;
  } else if (degrees === 180) {
    outW = src.width;
    outH = src.height;
  } else {
    // 45 or 135: diagonal rotation — output must be large enough to contain rotated image
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    outW = Math.ceil(src.width * cos + src.height * sin);
    outH = Math.ceil(src.width * sin + src.height * cos);
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d')!;

  // Translate to center, rotate, draw centered
  outCtx.translate(outW / 2, outH / 2);
  outCtx.rotate(radians);
  outCtx.drawImage(srcCanvas, -src.width / 2, -src.height / 2);

  const result = outCtx.getImageData(0, 0, outW, outH);
  const entry = { data: result.data, width: outW, height: outH };
  rotatedTemplateCache.set(cacheKey, entry);
  return entry;
}

// Template match a screenshot blob region against candidate templates.
// Scales each template to the blob's bounding box size and compares pixel-by-pixel.
// Returns the best-matching template, its score, and optionally the resolved orientation.
async function matchBlobToTemplate(
  screenshotData: Uint8ClampedArray,
  imageWidth: number,
  blob: ColorBlob,
  candidates: IconTemplate[],
): Promise<{ template: IconTemplate; score: number; orientation?: OrientationVariant }> {
  const blobW = blob.maxX - blob.minX + 1;
  const blobH = blob.maxY - blob.minY + 1;

  let bestTemplate = candidates[0];
  let bestScore = -1;
  let bestOrientation: OrientationVariant | undefined;

  // Helper: score a template image (already loaded) against the blob region
  function scoreTemplateAgainstBlob(
    tmplData: Uint8ClampedArray, tmplW: number, tmplH: number,
  ): number {
    // Scale template to blob bbox size via an offscreen canvas
    const scaleCanvas = document.createElement('canvas');
    scaleCanvas.width = blobW;
    scaleCanvas.height = blobH;
    const scaleCtx = scaleCanvas.getContext('2d')!;

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = tmplW;
    tmpCanvas.height = tmplH;
    const tmpCtx = tmpCanvas.getContext('2d')!;
    const tmpImageData = tmpCtx.createImageData(tmplW, tmplH);
    tmpImageData.data.set(tmplData);
    tmpCtx.putImageData(tmpImageData, 0, 0);

    scaleCtx.drawImage(tmpCanvas, 0, 0, tmplW, tmplH, 0, 0, blobW, blobH);
    const scaledData = scaleCtx.getImageData(0, 0, blobW, blobH).data;

    let totalSimilarity = 0;
    let opaqueCount = 0;

    for (let y = 0; y < blobH; y++) {
      for (let x = 0; x < blobW; x++) {
        const ti = (y * blobW + x) * 4;
        const alpha = scaledData[ti + 3];
        if (alpha < 128) continue;

        const screenX = blob.minX + x;
        const screenY = blob.minY + y;
        const si = (screenY * imageWidth + screenX) * 4;

        const dr = screenshotData[si] - scaledData[ti];
        const dg = screenshotData[si + 1] - scaledData[ti + 1];
        const db = screenshotData[si + 2] - scaledData[ti + 2];
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);

        totalSimilarity += 1 - dist / 441;
        opaqueCount++;
      }
    }

    return opaqueCount > 0 ? totalSimilarity / opaqueCount : 0;
  }

  for (const candidate of candidates) {
    if (candidate.orientations && candidate.orientations.length > 0) {
      // Orientation-aware: try each rotation and pick the best
      for (const orient of candidate.orientations) {
        const rotated = await rotateTemplateImage(candidate.imagePath, orient.rotation);
        const score = scoreTemplateAgainstBlob(rotated.data, rotated.width, rotated.height);
        if (score > bestScore) {
          bestScore = score;
          bestTemplate = candidate;
          bestOrientation = orient;
        }
      }
    } else {
      // Standard: no rotations, just match as-is
      const tmpl = await loadTemplateImage(candidate.imagePath);
      const score = scoreTemplateAgainstBlob(tmpl.data, tmpl.width, tmpl.height);
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = candidate;
        bestOrientation = undefined;
      }
    }
  }

  return { template: bestTemplate, score: bestScore, orientation: bestOrientation };
}

// Group templates by their primary detection color (for shared blob detection).
// Returns a key string for each color group.
function colorKey(c: RGB): string {
  return `${c.r},${c.g},${c.b}`;
}

// Main icon detection orchestrator.
// Groups templates by primary color, runs blob detection once per group,
// uses template matching to differentiate same-color icons,
// then applies placement constraints (row, uniqueness, non-overlap).
async function detectMapIcons(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
  grid: PixelGrid,
): Promise<DetectedIcon[]> {
  let allCandidates: DetectedIcon[] = [];
  const ppc = extents.pixelsPerCoord;

  // Group templates by primary color
  const colorGroups = new Map<string, IconTemplate[]>();
  for (const tmpl of ICON_TEMPLATES) {
    const key = colorKey(tmpl.colors[0]);
    const group = colorGroups.get(key) || [];
    group.push(tmpl);
    colorGroups.set(key, group);
  }

  // Phase 1: Collect all candidate detections (no grid clearing yet)
  for (const [key, group] of colorGroups) {
    const groupName = group.length === 1
      ? group[0].name
      : group.map(t => t.name).join('/');
    console.log(`Generate from Screenshot: detecting ${groupName} (color ${key})...`);

    const refTemplate = group[0];
    const groupDilationRadius = Math.max(...group.map(t => t.maskDilationRadius ?? 0));
    const blobs = findColorBlobs(
      data, imageWidth, imageHeight, extents,
      refTemplate.colors, refTemplate.colorTolerance,
      groupDilationRadius,
    );
    console.log(`  Found ${blobs.length} blobs for color group`);

    for (const blob of blobs) {
      if (group.length === 1 && !refTemplate.orientations) {
        // Single template, no orientation variants — simple path
        const confidence = validateBlob(blob, refTemplate, ppc);
        if (confidence < 0.4) continue;

        const blobCenterPxX = (blob.minX + blob.maxX) / 2;
        const blobCenterPxY = (blob.minY + blob.maxY) / 2;
        const { cx, cy } = pixelToIslandCoord(blobCenterPxX, blobCenterPxY, extents);

        allCandidates.push({
          template: refTemplate,
          centerCoordX: cx,
          centerCoordY: cy,
          blobCenterPx: [blobCenterPxX, blobCenterPxY],
          blobBBoxPx: [blob.minX, blob.minY, blob.maxX, blob.maxY],
          confidence,
        });

        console.log(
          `  ${refTemplate.name} at (${cx.toFixed(1)}, ${cy.toFixed(1)}) ` +
          `conf=${(confidence * 100).toFixed(0)}% blob=${blob.area}px`,
        );
        continue;
      }

      // Multi-template group OR single template with orientations: use template matching
      let bestShapeConfidence = 0;
      for (const tmpl of group) {
        const c = validateBlob(blob, tmpl, ppc);
        if (c > bestShapeConfidence) bestShapeConfidence = c;
      }
      if (bestShapeConfidence < 0.3) continue;

      const { template: matchedTemplate, score: matchScore, orientation: matchedOrientation } =
        await matchBlobToTemplate(data, imageWidth, blob, group);

      const confidence = bestShapeConfidence * 0.4 + matchScore * 0.6;
      if (confidence < 0.4) continue;

      const blobCenterPxX = (blob.minX + blob.maxX) / 2;
      const blobCenterPxY = (blob.minY + blob.maxY) / 2;
      const { cx, cy } = pixelToIslandCoord(blobCenterPxX, blobCenterPxY, extents);

      const detected: DetectedIcon = {
        template: matchedTemplate,
        centerCoordX: cx,
        centerCoordY: cy,
        blobCenterPx: [blobCenterPxX, blobCenterPxY],
        blobBBoxPx: [blob.minX, blob.minY, blob.maxX, blob.maxY],
        confidence,
      };

      // Populate resolved fields from orientation match
      if (matchedOrientation) {
        detected.orientation = matchedOrientation;
        detected.resolvedType = matchedOrientation.objectType;
        detected.resolvedCategory = matchedOrientation.objectCategory;
        detected.resolvedObjectSize = matchedOrientation.objectSize;
      }

      allCandidates.push(detected);

      const orientLabel = matchedOrientation ? ` orient=${matchedOrientation.rotation}°` : '';
      console.log(
        `  ${matchedTemplate.name} at (${cx.toFixed(1)}, ${cy.toFixed(1)}) ` +
        `conf=${(confidence * 100).toFixed(0)}% match=${(matchScore * 100).toFixed(0)}%${orientLabel} blob=${blob.area}px`,
      );
    }
  }

  console.log(`Generate from Screenshot: ${allCandidates.length} candidates before constraints`);

  // Phase 2: Apply placement constraints

  // 2a. Row constraints
  const AMENITY_ROW_TYPES = new Set([
    'townhallSprite', 'center', 'ableSprite', 'museumSprite', 'nookSprite', 'tentSprite',
  ]);
  allCandidates = allCandidates.filter(icon => {
    const blockRow = Math.floor(icon.centerCoordY / BLOCK_SIZE);
    const type = icon.template.type;

    if (type === 'campsiteSprite' && blockRow !== 0) {
      console.log(`  Constraint: rejected ${icon.template.name} at row ${blockRow} (must be row 0)`);
      return false;
    }
    if (type === 'airportBlue' && blockRow !== 5) {
      console.log(`  Constraint: rejected ${icon.template.name} at row ${blockRow} (must be row 5)`);
      return false;
    }
    if (AMENITY_ROW_TYPES.has(type) && (blockRow < 2 || blockRow > 4)) {
      console.log(`  Constraint: rejected ${icon.template.name} at row ${blockRow} (must be rows 2-4)`);
      return false;
    }
    return true;
  });

  // 2a2. Bridge water-adjacency constraint
  allCandidates = allCandidates.filter(icon => {
    if (!icon.template.requiresWaterAdjacency || !icon.orientation) return true;

    const [bMinX, bMinY, bMaxX, bMaxY] = icon.blobBBoxPx;
    const sampleDepth = 3; // pixels beyond blob edge to sample
    const rotation = icon.orientation.rotation;

    // Determine which sides to check for water based on orientation
    // Bridges span along their orientation — water should be on perpendicular sides
    const sideA: Array<[number, number]> = [];
    const sideB: Array<[number, number]> = [];

    if (rotation === 0 || rotation === 180) {
      // Vertical bridge: check left and right sides
      for (let y = bMinY; y <= bMaxY; y++) {
        for (let d = 1; d <= sampleDepth; d++) {
          sideA.push([bMinX - d, y]); // left
          sideB.push([bMaxX + d, y]); // right
        }
      }
    } else if (rotation === 90 || rotation === 270) {
      // Horizontal bridge: check top and bottom sides
      for (let x = bMinX; x <= bMaxX; x++) {
        for (let d = 1; d <= sampleDepth; d++) {
          sideA.push([x, bMinY - d]); // top
          sideB.push([x, bMaxY + d]); // bottom
        }
      }
    } else if (rotation === 45) {
      // TLBR diagonal: check top-right and bottom-left corners
      for (let i = 0; i < Math.min(bMaxX - bMinX, bMaxY - bMinY); i++) {
        for (let d = 1; d <= sampleDepth; d++) {
          sideA.push([bMaxX - i + d, bMinY + i - d]); // top-right
          sideB.push([bMinX + i - d, bMaxY - i + d]); // bottom-left
        }
      }
    } else if (rotation === 135) {
      // TRBL diagonal: check top-left and bottom-right corners
      for (let i = 0; i < Math.min(bMaxX - bMinX, bMaxY - bMinY); i++) {
        for (let d = 1; d <= sampleDepth; d++) {
          sideA.push([bMinX + i - d, bMinY + i - d]); // top-left
          sideB.push([bMaxX - i + d, bMaxY - i + d]); // bottom-right
        }
      }
    }

    // Count water pixels on each side
    function countWaterPixels(samples: Array<[number, number]>): number {
      let count = 0;
      for (const [px, py] of samples) {
        if (px < 0 || py < 0 || px >= imageWidth || py >= imageHeight) continue;
        const idx = (py * imageWidth + px) * 4;
        const pixel = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
        if (matchesAnyColor(pixel, SCREENSHOT_COLORS.WATER, 40)) count++;
      }
      return count;
    }

    const waterA = countWaterPixels(sideA);
    const waterB = countWaterPixels(sideB);
    const ratioA = sideA.length > 0 ? waterA / sideA.length : 0;
    const ratioB = sideB.length > 0 ? waterB / sideB.length : 0;

    // Require at least 30% water on both perpendicular sides
    if (ratioA < 0.3 || ratioB < 0.3) {
      console.log(
        `  Constraint: rejected ${icon.template.name} at ` +
        `(${icon.centerCoordX.toFixed(1)}, ${icon.centerCoordY.toFixed(1)}) ` +
        `(water adjacency: ${(ratioA * 100).toFixed(0)}%/${(ratioB * 100).toFixed(0)}%)`,
      );
      return false;
    }
    return true;
  });

  // 2b. Uniqueness: keep highest-confidence per type, respecting maxCount from templates
  const typeMaxCounts = new Map<string, number>();
  for (const tmpl of ICON_TEMPLATES) {
    const mc = tmpl.maxCount ?? 1;
    typeMaxCounts.set(tmpl.type, Math.max(typeMaxCounts.get(tmpl.type) ?? 1, mc));
  }
  const typeGroups = new Map<string, DetectedIcon[]>();
  for (const icon of allCandidates) {
    const key = icon.template.type;
    if (!typeGroups.has(key)) typeGroups.set(key, []);
    typeGroups.get(key)!.push(icon);
  }
  const filtered: DetectedIcon[] = [];
  for (const [type, icons] of typeGroups) {
    icons.sort((a, b) => b.confidence - a.confidence);
    const maxCount = typeMaxCounts.get(type) ?? 1;
    const kept = icons.slice(0, maxCount);
    if (icons.length > maxCount) {
      console.log(`  Constraint: kept ${maxCount}/${icons.length} ${type} (uniqueness)`);
    }
    filtered.push(...kept);
  }

  // 2c. Non-overlapping: greedily accept by confidence, reject overlaps
  filtered.sort((a, b) => b.confidence - a.confidence);

  function getFootprint(icon: DetectedIcon) {
    const [w, h] = icon.resolvedObjectSize ?? icon.template.objectSizeInCoords;
    const x0 = Math.round(icon.centerCoordX - w / 2);
    const y0 = Math.round(icon.centerCoordY - h / 2);
    return { x0, y0, x1: x0 + w, y1: y0 + h };
  }

  const accepted: DetectedIcon[] = [];
  for (const icon of filtered) {
    const fp = getFootprint(icon);
    const overlaps = accepted.some(a => {
      const afp = getFootprint(a);
      return fp.x0 < afp.x1 && fp.x1 > afp.x0 && fp.y0 < afp.y1 && fp.y1 > afp.y0;
    });
    if (overlaps) {
      console.log(`  Constraint: rejected ${icon.template.name} at (${icon.centerCoordX.toFixed(1)}, ${icon.centerCoordY.toFixed(1)}) (overlap)`);
      continue;
    }
    accepted.push(icon);
  }

  // Phase 3: Clear grid regions for accepted icons only
  for (const icon of accepted) {
    const [objW, objH] = icon.resolvedObjectSize ?? icon.template.objectSizeInCoords;
    const topLeftX = Math.round(icon.centerCoordX - objW / 2);
    const topLeftY = Math.round(icon.centerCoordY - objH / 2);
    clearGridRegion(grid, topLeftX, topLeftY, objW, objH);
  }

  console.log(`Generate from Screenshot: ${accepted.length} icons after constraints`);
  return accepted;
}

// Convert detected icons to the v2 object groups format:
// { 'category_type': [x1, y1, x2, y2, ...] }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function detectedIconsToObjectGroups(
  icons: DetectedIcon[],
): Record<string, number[]> {
  const groups: Record<string, number[]> = {};
  for (const icon of icons) {
    if (icon.template.emitsObject === false) continue;
    const category = icon.resolvedCategory ?? icon.template.category;
    const type = icon.resolvedType ?? icon.template.type;
    const key = `${category}_${type}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    // Round to 2 decimal places to match save-legacy.ts encoding
    const x = Math.round((icon.centerCoordX + Number.EPSILON) * 100) / 100;
    const y = Math.round((icon.centerCoordY + Number.EPSILON) * 100) / 100;
    groups[key].push(x, y);
  }
  return groups;
}

// Debug output: draw detected icons on the screenshot
function saveIconDetectionDebug(
  image: HTMLImageElement,
  extents: IslandExtents,
  detectedIcons: DetectedIcon[],
): void {
  const { canvas, ctx } = createDebugCanvas(image);
  const ppc = extents.pixelsPerCoord;

  for (const icon of detectedIcons) {
    const [blobCx, blobCy] = icon.blobCenterPx;
    const [objW, objH] = icon.template.objectSizeInCoords;

    // Draw cyan bounding box at detected blob extent
    const [bMinX, bMinY, bMaxX, bMaxY] = icon.blobBBoxPx;
    ctx.strokeStyle = '#00CED1';
    ctx.lineWidth = 2;
    ctx.strokeRect(bMinX, bMinY, bMaxX - bMinX, bMaxY - bMinY);

    // Draw magenta bounding box at object footprint size
    const footprintLeft = blobCx - (objW / 2) * ppc;
    const footprintTop = blobCy - (objH / 2) * ppc;
    const footprintW = objW * ppc;
    const footprintH = objH * ppc;

    ctx.strokeStyle = '#FF00FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(footprintLeft, footprintTop, footprintW, footprintH);

    // Draw yellow crosshair at blob center
    const crossSize = 6;
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(blobCx - crossSize, blobCy);
    ctx.lineTo(blobCx + crossSize, blobCy);
    ctx.moveTo(blobCx, blobCy - crossSize);
    ctx.lineTo(blobCx, blobCy + crossSize);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#FF00FF';
    ctx.font = '12px monospace';
    ctx.fillText(
      `${icon.template.name} (${(icon.confidence * 100).toFixed(0)}%)`,
      footprintLeft,
      footprintTop - 4,
    );
  }

  downloadCanvas(canvas, 'debug_07_icon_detection.png');
}

function saveEdgeTileDebug(
  image: HTMLImageElement,
  extents: IslandExtents,
  edgeResult: EdgeTileMatchResult,
): void {
  const { canvas, ctx } = createDebugCanvas(image);
  const ppc = extents.pixelsPerCoord;

  for (const match of edgeResult.matches) {
    const screenX = extents.full.left + match.blockX * 16 * ppc;
    const screenY = extents.full.top + match.blockY * 16 * ppc;
    const blockSizePx = 16 * ppc;

    if (match.refTerrain) {
      // Draw semi-transparent terrain overlay for matched tiles
      ctx.globalAlpha = 0.5;
      for (let ly = 0; ly < 16; ly++) {
        for (let lx = 0; lx < 16; lx++) {
          const terrain = match.refTerrain[ly * 16 + lx];
          const [r, g, b] = TERRAIN_DEBUG_COLORS[terrain] || [128, 128, 128];
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(screenX + lx * ppc, screenY + ly * ppc, ppc, ppc);
        }
      }
      ctx.globalAlpha = 1.0;

      // Green border for matched blocks
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX, screenY, blockSizePx, blockSizePx);
    } else {
      // Red border for unmatched blocks
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX, screenY, blockSizePx, blockSizePx);
    }

    // Label with asset index and score
    ctx.fillStyle = match.refTerrain ? '#00FF00' : '#FF0000';
    ctx.font = '10px monospace';
    ctx.fillText(
      `#${match.assetIndex} ${(match.score * 100).toFixed(0)}%`,
      screenX + 2,
      screenY + 12,
    );
  }

  downloadCanvas(canvas, 'debug_08_edge_tiles.png');
}

function savePostIconFillDebug(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
): void {
  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(imageWidth, imageHeight);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);
  downloadCanvas(canvas, 'debug_09_icon_fill.png');
}

// Main pixelization function: sample the screenshot at each of the 112×96 island coordinates.
// Uses a two-pass approach:
//   Pass 1: Classify all cells as solid terrain (no diagonal detection)
//   Pass 2: Refine boundary cells (where neighbors differ) with diagonal detection
function pixelateScreenshot(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
): PixelGrid {
  const ppc = extents.pixelsPerCoord;
  const fullLeft = extents.full.left;
  const fullTop = extents.full.top;

  const grid: PixelGrid = {
    primary: new Uint8Array(ISLAND_COORD_WIDTH * ISLAND_COORD_HEIGHT),
    diagonal: new Uint8Array(ISLAND_COORD_WIDTH * ISLAND_COORD_HEIGHT),
    secondary: new Uint8Array(ISLAND_COORD_WIDTH * ISLAND_COORD_HEIGHT),
    confidence: new Uint8Array(ISLAND_COORD_WIDTH * ISLAND_COORD_HEIGHT),
  };

  // Sampling parameters
  const SAMPLE_GRID = 5;    // 5×5 = 25 sample points per cell
  const INSET_FRAC = 0.15;  // Skip outermost 15% on each side to avoid bleed
  const GRIDLINE_INSET_FRAC = 0.30;  // Larger inset for edges facing block-boundary gridlines

  // Cache samples for reuse in pass 2
  const allSamples: ClassifiedSample[][] = new Array(ISLAND_COORD_WIDTH * ISLAND_COORD_HEIGHT);

  // === PASS 1: Solid classification ===
  for (let cy = 0; cy < ISLAND_COORD_HEIGHT; cy++) {
    for (let cx = 0; cx < ISLAND_COORD_WIDTH; cx++) {
      // Pixel bounds of this coordinate cell
      const cellLeft = fullLeft + cx * ppc;
      const cellTop = fullTop + cy * ppc;

      // Per-edge inset: larger on edges adjacent to block-boundary gridlines
      const insetLeft   = ppc * (isBlockBoundaryLeft(cx)   ? GRIDLINE_INSET_FRAC : INSET_FRAC);
      const insetRight  = ppc * (isBlockBoundaryRight(cx)  ? GRIDLINE_INSET_FRAC : INSET_FRAC);
      const insetTop    = ppc * (isBlockBoundaryTop(cy)    ? GRIDLINE_INSET_FRAC : INSET_FRAC);
      const insetBottom = ppc * (isBlockBoundaryBottom(cy) ? GRIDLINE_INSET_FRAC : INSET_FRAC);

      const sampleLeft   = cellLeft + insetLeft;
      const sampleTop    = cellTop  + insetTop;
      const sampleWidth  = ppc - insetLeft - insetRight;
      const sampleHeight = ppc - insetTop  - insetBottom;

      // Sample 5×5 grid within the inset area
      const samples: ClassifiedSample[] = [];
      for (let sy = 0; sy < SAMPLE_GRID; sy++) {
        for (let sx = 0; sx < SAMPLE_GRID; sx++) {
          const px = Math.round(sampleLeft + (sx + 0.5) * sampleWidth / SAMPLE_GRID);
          const py = Math.round(sampleTop + (sy + 0.5) * sampleHeight / SAMPLE_GRID);

          // Bounds check
          if (px >= 0 && px < imageWidth && py >= 0 && py < imageHeight) {
            const rgb = getPixelAt(data, imageWidth, px, py);
            samples.push({
              relX: (sx + 0.5) / SAMPLE_GRID,
              relY: (sy + 0.5) / SAMPLE_GRID,
              terrain: classifyPixelTerrain(rgb),
              rgb,  // Keep raw color for grass level resolution
            });
          }
        }
      }

      const idx = cy * ISLAND_COORD_WIDTH + cx;
      allSamples[idx] = samples;

      // Pass 1: solid classification only
      const result = samples.length > 0
        ? detectCellSolid(samples)
        : { primary: TERRAIN.UNKNOWN, secondary: TERRAIN.UNKNOWN, diagonal: DIAGONAL.NONE, confidence: 0 };

      grid.primary[idx] = result.primary;
      grid.diagonal[idx] = result.diagonal;
      grid.secondary[idx] = result.secondary;
      grid.confidence[idx] = result.confidence;
    }
  }

  console.log('Generate from Screenshot: pass 1 (solid classification) complete');

  // === PASS 2: Diagonal refinement at terrain boundaries ===
  let diagonalCount = 0;
  let boundaryCount = 0;
  let cornerCount = 0;

  for (let cy = 0; cy < ISLAND_COORD_HEIGHT; cy++) {
    for (let cx = 0; cx < ISLAND_COORD_WIDTH; cx++) {
      if (!isBoundaryCell(grid, cx, cy)) continue;
      boundaryCount++;

      const idx = cy * ISLAND_COORD_WIDTH + cx;
      const samples = allSamples[idx];
      if (!samples || samples.length === 0) continue;

      // Step A: standard diagonal detection (0.70 threshold)
      let result = detectCellDiagonal(samples, grid.primary[idx] as TerrainType);

      // Step B: if no diagonal found, try corner detection with lower threshold.
      // A "corner" is where two adjacent neighbors share a different terrain,
      // creating an L-shaped step that could be smoothed to a diagonal.
      // Only lower the threshold if the result would create a smooth contour
      // (both triangles touching 2 matching neighbors), not a sharp edge.
      if (result.diagonal === DIAGONAL.NONE) {
        const corner = detectCornerCell(grid, cx, cy);
        if (corner !== null) {
          if (wouldDiagonalBeSmooth(grid, cx, cy, corner.diagType, corner.primary, corner.secondary)) {
            result = detectCellDiagonal(samples, grid.primary[idx] as TerrainType, 0.55);
            if (result.diagonal !== DIAGONAL.NONE) cornerCount++;
          }
        }
      }

      if (result.diagonal !== DIAGONAL.NONE) {
        grid.primary[idx] = result.primary;
        grid.diagonal[idx] = result.diagonal;
        grid.secondary[idx] = result.secondary;
        grid.confidence[idx] = result.confidence;
        diagonalCount++;
      }
    }
  }

  console.log(`Generate from Screenshot: pass 2 — ` +
    `${boundaryCount} boundary cells, ${diagonalCount} diagonals ` +
    `(${cornerCount} from corner smoothing)`);

  // === PASS 3: Diagonal connectivity validation ===
  // Each triangle of a diagonal cell must be in geometric contact with a
  // neighbor that has the same terrain on the shared edge. Diagonals that
  // fail this check ("floating" diagonals) are reverted to solid.
  let invalidatedCount = 0;

  for (let cy = 0; cy < ISLAND_COORD_HEIGHT; cy++) {
    for (let cx = 0; cx < ISLAND_COORD_WIDTH; cx++) {
      const idx = cy * ISLAND_COORD_WIDTH + cx;
      if (grid.diagonal[idx] === DIAGONAL.NONE) continue;

      if (!isDiagonalValid(grid, cx, cy)) {
        // Revert to solid — re-derive from cached samples
        const samples = allSamples[idx];
        if (samples && samples.length > 0) {
          const solidResult = detectCellSolid(samples);
          grid.primary[idx] = solidResult.primary;
          grid.confidence[idx] = solidResult.confidence;
        }
        grid.diagonal[idx] = DIAGONAL.NONE;
        grid.secondary[idx] = TERRAIN.UNKNOWN;
        invalidatedCount++;
        diagonalCount--;
      }
    }
  }

  if (invalidatedCount > 0) {
    console.log(`Generate from Screenshot: pass 3 — ${invalidatedCount} floating diagonals reverted`);
  }

  const solidCount = ISLAND_COORD_WIDTH * ISLAND_COORD_HEIGHT - diagonalCount;
  console.log(`Generate from Screenshot: pixelization — ${solidCount} solid, ${diagonalCount} diagonal cells`);

  return grid;
}

// ============ Debug Image Output ============
// Pattern from devTools.ts:3756-3760 (canvas → toDataURL → <a> download)

function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function createDebugCanvas(image: HTMLImageElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  return { canvas, ctx };
}

function saveTopBoundaryDebug(
  image: HTMLImageElement,
  result: BoundaryResult,
  width: number,
): void {
  const { canvas, ctx } = createDebugCanvas(image);
  const xStart = Math.floor(width / 3);
  const xEnd = Math.floor(2 * width / 3);
  const scanWidth = xEnd - xStart;

  // Tint the scan region
  ctx.fillStyle = 'rgba(0, 0, 255, 0.1)';
  ctx.fillRect(xStart, 0, scanWidth, image.height);

  // Draw rock presence per row as grey bars
  for (const row of result.scanData) {
    const barWidth = row.rockPct * scanWidth;
    ctx.fillStyle = `rgba(124, 134, 146, ${Math.min(row.rockPct * 3, 0.8)})`;
    ctx.fillRect(xStart, row.y, barWidth, 1);
  }

  // Draw boundary line
  if (result.boundaryY !== null) {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, result.boundaryY);
    ctx.lineTo(width, result.boundaryY);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'red';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Top boundary: y=${result.boundaryY}`, 5, result.boundaryY - 5);
  }

  downloadCanvas(canvas, 'debug_01_top_boundary.png');
}

function saveBottomBoundaryDebug(
  image: HTMLImageElement,
  result: BoundaryResult,
  width: number,
): void {
  const { canvas, ctx } = createDebugCanvas(image);
  const xStart = Math.floor(width / 3);
  const xEnd = Math.floor(2 * width / 3);
  const scanWidth = xEnd - xStart;

  // Tint the scan region
  ctx.fillStyle = 'rgba(0, 0, 255, 0.1)';
  ctx.fillRect(xStart, 0, scanWidth, image.height);

  // Draw sand presence per row as yellow bars, rock as grey
  for (const row of result.scanData) {
    // Sand bar (left half of scan region)
    const sandBarWidth = row.sandPct * (scanWidth / 2);
    ctx.fillStyle = `rgba(236, 229, 161, ${Math.min(row.sandPct * 3, 0.8)})`;
    ctx.fillRect(xStart, row.y, sandBarWidth, 1);

    // Rock bar (right half of scan region)
    const rockBarWidth = row.rockPct * (scanWidth / 2);
    ctx.fillStyle = `rgba(124, 134, 146, ${Math.min(row.rockPct * 3, 0.8)})`;
    ctx.fillRect(xStart + scanWidth / 2, row.y, rockBarWidth, 1);
  }

  // Draw boundary line
  if (result.boundaryY !== null) {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, result.boundaryY);
    ctx.lineTo(width, result.boundaryY);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'red';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Bottom boundary: y=${result.boundaryY}`, 5, result.boundaryY + 16);
  }

  downloadCanvas(canvas, 'debug_02_bottom_boundary.png');
}

function saveLeftBoundaryDebug(
  image: HTMLImageElement,
  result: VerticalBoundaryResult,
  topY: number,
  bottomY: number,
): void {
  const { canvas, ctx } = createDebugCanvas(image);
  const scanHeight = bottomY - topY;

  // Tint the scan region (left half, between top and bottom boundaries)
  ctx.fillStyle = 'rgba(0, 0, 255, 0.1)';
  ctx.fillRect(0, topY, Math.floor(image.width / 2), scanHeight);

  // Draw sand presence per column as yellow bars
  for (const col of result.scanData) {
    const barHeight = col.sandPct * scanHeight;
    ctx.fillStyle = `rgba(236, 229, 161, ${Math.min(col.sandPct * 2, 0.8)})`;
    ctx.fillRect(col.x, topY, 1, barHeight);
  }

  // Draw boundary line
  if (result.boundaryX !== null) {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(result.boundaryX, 0);
    ctx.lineTo(result.boundaryX, image.height);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'red';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Left boundary: x=${result.boundaryX}`, result.boundaryX + 5, topY + 20);
  }

  downloadCanvas(canvas, 'debug_03_left_boundary.png');
}

function saveRightBoundaryDebug(
  image: HTMLImageElement,
  result: VerticalBoundaryResult,
  topY: number,
  bottomY: number,
): void {
  const { canvas, ctx } = createDebugCanvas(image);
  const scanHeight = bottomY - topY;

  // Tint the scan region (right half, between top and bottom boundaries)
  ctx.fillStyle = 'rgba(0, 0, 255, 0.1)';
  ctx.fillRect(Math.floor(image.width / 2), topY, Math.floor(image.width / 2), scanHeight);

  // Draw sand presence per column as yellow bars
  for (const col of result.scanData) {
    const barHeight = col.sandPct * scanHeight;
    ctx.fillStyle = `rgba(236, 229, 161, ${Math.min(col.sandPct * 2, 0.8)})`;
    ctx.fillRect(col.x, topY, 1, barHeight);
  }

  // Draw boundary line
  if (result.boundaryX !== null) {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(result.boundaryX, 0);
    ctx.lineTo(result.boundaryX, image.height);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'red';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Right boundary: x=${result.boundaryX}`, result.boundaryX - 160, topY + 20);
  }

  downloadCanvas(canvas, 'debug_04_right_boundary.png');
}

function saveExtentsDebug(
  image: HTMLImageElement,
  extents: IslandExtents,
): void {
  const { canvas, ctx } = createDebugCanvas(image);

  // Full island extent — green dashed rectangle
  const f = extents.full;
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(f.left, f.top, f.right - f.left, f.bottom - f.top);

  // Inner playable boundary — yellow solid rectangle
  const i = extents.inner;
  ctx.strokeStyle = 'yellow';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(i.left, i.top, i.right - i.left, i.bottom - i.top);

  // Labels
  ctx.fillStyle = 'lime';
  ctx.font = '12px sans-serif';
  ctx.fillText('Full island (112x96)', f.left + 5, f.top - 5);

  ctx.fillStyle = 'yellow';
  ctx.fillText('Inner boundary (13,13)-(99,83)', i.left + 5, i.top + 15);

  // Scale info
  ctx.fillStyle = 'white';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Scale: ${extents.pixelsPerCoord.toFixed(2)} px/coord`, 5, image.height - 10);

  downloadCanvas(canvas, 'debug_05_island_extents.png');
}

// Debug color mapping: terrain type → RGB for visualization
const TERRAIN_DEBUG_COLORS: Record<number, [number, number, number]> = {
  [TERRAIN.UNKNOWN]: [128, 128, 128],
  [TERRAIN.WATER]:   [0x75, 0xD3, 0xC1],
  [TERRAIN.SAND]:    [0xEC, 0xE5, 0xA1],
  [TERRAIN.ROCK]:    [0x7C, 0x86, 0x92],
  [TERRAIN.LEVEL1]:  [0x3F, 0x7C, 0x41],
  [TERRAIN.LEVEL2]:  [0x46, 0xA5, 0x44],
  [TERRAIN.LEVEL3]:  [0x65, 0xCA, 0x44],
  [TERRAIN.PATH]:    [0xB8, 0xAA, 0x6D],
  [TERRAIN.GRASS]:   [0x50, 0x90, 0x42],  // Generic mid-green (should not appear in final output)
};

function savePixelGridDebug(grid: PixelGrid): void {
  // === A: 112×96 terrain grid (one pixel per coordinate) ===
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = ISLAND_COORD_WIDTH;
  gridCanvas.height = ISLAND_COORD_HEIGHT;
  const gridCtx = gridCanvas.getContext('2d')!;
  const gridImageData = gridCtx.createImageData(ISLAND_COORD_WIDTH, ISLAND_COORD_HEIGHT);

  for (let y = 0; y < ISLAND_COORD_HEIGHT; y++) {
    for (let x = 0; x < ISLAND_COORD_WIDTH; x++) {
      const idx = y * ISLAND_COORD_WIDTH + x;
      const outIdx = idx * 4;

      if (grid.diagonal[idx] === DIAGONAL.NONE) {
        const [r, g, b] = TERRAIN_DEBUG_COLORS[grid.primary[idx]] || [128, 128, 128];
        gridImageData.data[outIdx] = r;
        gridImageData.data[outIdx + 1] = g;
        gridImageData.data[outIdx + 2] = b;
      } else {
        // Diagonal: blend the two colors 50/50 at this resolution
        const [r1, g1, b1] = TERRAIN_DEBUG_COLORS[grid.primary[idx]] || [128, 128, 128];
        const [r2, g2, b2] = TERRAIN_DEBUG_COLORS[grid.secondary[idx]] || [128, 128, 128];
        gridImageData.data[outIdx] = (r1 + r2) >> 1;
        gridImageData.data[outIdx + 1] = (g1 + g2) >> 1;
        gridImageData.data[outIdx + 2] = (b1 + b2) >> 1;
      }
      gridImageData.data[outIdx + 3] = 255;
    }
  }

  gridCtx.putImageData(gridImageData, 0, 0);
  downloadCanvas(gridCanvas, 'debug_06a_pixel_grid.png');

  // === B: 4× scaled overlay with visible diagonal triangles ===
  const scale = 4;
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = ISLAND_COORD_WIDTH * scale;
  overlayCanvas.height = ISLAND_COORD_HEIGHT * scale;
  const overlayCtx = overlayCanvas.getContext('2d')!;

  for (let y = 0; y < ISLAND_COORD_HEIGHT; y++) {
    for (let x = 0; x < ISLAND_COORD_WIDTH; x++) {
      const idx = y * ISLAND_COORD_WIDTH + x;
      const x0 = x * scale;
      const y0 = y * scale;

      const [r1, g1, b1] = TERRAIN_DEBUG_COLORS[grid.primary[idx]] || [128, 128, 128];

      if (grid.diagonal[idx] === DIAGONAL.NONE) {
        // Solid cell
        overlayCtx.fillStyle = `rgb(${r1},${g1},${b1})`;
        overlayCtx.fillRect(x0, y0, scale, scale);
      } else {
        const [r2, g2, b2] = TERRAIN_DEBUG_COLORS[grid.secondary[idx]] || [128, 128, 128];

        if (grid.diagonal[idx] === DIAGONAL.BACKSLASH) {
          // '\' — top-left triangle = primary
          overlayCtx.fillStyle = `rgb(${r1},${g1},${b1})`;
          overlayCtx.beginPath();
          overlayCtx.moveTo(x0, y0);
          overlayCtx.lineTo(x0 + scale, y0);
          overlayCtx.lineTo(x0, y0 + scale);
          overlayCtx.closePath();
          overlayCtx.fill();

          // bottom-right triangle = secondary
          overlayCtx.fillStyle = `rgb(${r2},${g2},${b2})`;
          overlayCtx.beginPath();
          overlayCtx.moveTo(x0 + scale, y0);
          overlayCtx.lineTo(x0 + scale, y0 + scale);
          overlayCtx.lineTo(x0, y0 + scale);
          overlayCtx.closePath();
          overlayCtx.fill();
        } else {
          // '/' — top-right triangle = primary
          overlayCtx.fillStyle = `rgb(${r1},${g1},${b1})`;
          overlayCtx.beginPath();
          overlayCtx.moveTo(x0, y0);
          overlayCtx.lineTo(x0 + scale, y0);
          overlayCtx.lineTo(x0 + scale, y0 + scale);
          overlayCtx.closePath();
          overlayCtx.fill();

          // bottom-left triangle = secondary
          overlayCtx.fillStyle = `rgb(${r2},${g2},${b2})`;
          overlayCtx.beginPath();
          overlayCtx.moveTo(x0, y0);
          overlayCtx.lineTo(x0 + scale, y0 + scale);
          overlayCtx.lineTo(x0, y0 + scale);
          overlayCtx.closePath();
          overlayCtx.fill();
        }
      }

      // Outline low-confidence cells in red
      if (grid.confidence[idx] < 128) {
        overlayCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        overlayCtx.lineWidth = 1;
        overlayCtx.strokeRect(x0, y0, scale, scale);
      }
    }
  }

  downloadCanvas(overlayCanvas, 'debug_06b_pixel_overlay.png');
}

// ============ Image Loading ============

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function openImageFileDialog(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('No file selected'));
      }
    };
    input.click();
  });
}

// ============ Main Entry Point ============

export async function generateFromScreenshot(): Promise<void> {
  console.log('Generate from Screenshot: starting...');

  // 1. Open file dialog
  let file: File;
  try {
    file = await openImageFileDialog();
  } catch {
    console.log('Generate from Screenshot: cancelled');
    return;
  }

  console.log(`Generate from Screenshot: loading ${file.name} (${file.size} bytes)`);

  // 2. Load image
  const image = await loadImageFromFile(file);
  const { width, height } = image;
  console.log(`Generate from Screenshot: image size ${width}x${height}`);

  // 3. Get raw pixel data
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 4. Detect top boundary (rock cliff edge)
  console.log('Generate from Screenshot: detecting top boundary...');
  const topResult = detectTopBoundary(data, width, height);
  if (topResult.boundaryY !== null) {
    console.log(`Generate from Screenshot: top boundary at y=${topResult.boundaryY}`);
  } else {
    console.warn('Generate from Screenshot: could not detect top boundary');
  }
  saveTopBoundaryDebug(image, topResult, width);

  // 5. Detect bottom boundary (beach edge)
  console.log('Generate from Screenshot: detecting bottom boundary...');
  const bottomResult = detectBottomBoundary(data, width, height);
  if (bottomResult.boundaryY !== null) {
    console.log(`Generate from Screenshot: bottom boundary at y=${bottomResult.boundaryY}`);
  } else {
    console.warn('Generate from Screenshot: could not detect bottom boundary');
  }
  saveBottomBoundaryDebug(image, bottomResult, width);

  // 6-7. Detect left/right boundaries (sand edges)
  // These require top/bottom for the vertical scan range
  let leftResult: VerticalBoundaryResult | null = null;
  let rightResult: VerticalBoundaryResult | null = null;

  if (topResult.boundaryY !== null && bottomResult.boundaryY !== null) {
    console.log('Generate from Screenshot: detecting left boundary...');
    leftResult = detectLeftBoundary(data, width, height, topResult.boundaryY, bottomResult.boundaryY);
    if (leftResult.boundaryX !== null) {
      console.log(`Generate from Screenshot: left boundary at x=${leftResult.boundaryX}`);
    } else {
      console.warn('Generate from Screenshot: could not detect left boundary');
    }
    saveLeftBoundaryDebug(image, leftResult, topResult.boundaryY, bottomResult.boundaryY);

    console.log('Generate from Screenshot: detecting right boundary...');
    rightResult = detectRightBoundary(data, width, height, topResult.boundaryY, bottomResult.boundaryY);
    if (rightResult.boundaryX !== null) {
      console.log(`Generate from Screenshot: right boundary at x=${rightResult.boundaryX}`);
    } else {
      console.warn('Generate from Screenshot: could not detect right boundary');
    }
    saveRightBoundaryDebug(image, rightResult, topResult.boundaryY, bottomResult.boundaryY);
  } else {
    console.warn('Generate from Screenshot: skipping left/right detection — top/bottom boundaries required');
  }

  // 8. Derive full island extents from all 4 boundaries
  if (topResult.boundaryY === null || bottomResult.boundaryY === null) {
    console.warn('Generate from Screenshot: cannot derive extents — top/bottom boundary detection failed');
    console.log('Generate from Screenshot: done (early exit)');
    return;
  }

  const extents = deriveFullExtents(
    topResult.boundaryY,
    bottomResult.boundaryY,
    leftResult?.boundaryX ?? null,
    rightResult?.boundaryX ?? null,
    width,
  );
  console.log('Generate from Screenshot: island extents:', {
    pixelsPerCoord: extents.pixelsPerCoord.toFixed(2),
    full: extents.full,
    inner: extents.inner,
  });
  saveExtentsDebug(image, extents);

  // 9. detect objects and fill them with a placeholder color or specific color
  // objects include location marker, player house, house, residence services, museum, shop, tailor, stairs

  // 10. Pixelize screenshot into terrain grid with diagonal detection
  console.log('Generate from Screenshot: pixelizing to terrain grid...');
  const pixelGrid = pixelateScreenshot(data, width, height, extents);

  // 10.5 Match edge tiles against reference library
  console.log('Generate from Screenshot: matching edge tiles...');
  const edgeResult = matchEdgeTiles(pixelGrid);
  const edgeAssetIndices = edgeResult.assetIndices; // eslint-disable-line @typescript-eslint/no-unused-vars
  // edgeAssetIndices will be used when building the final v2 map output
  saveEdgeTileDebug(image, extents, edgeResult);

  // 10.5b Detect map icons (houses, player houses, etc.)
  console.log('Generate from Screenshot: detecting map icons...');
  const detectedIcons = await detectMapIcons(data, width, height, extents, pixelGrid); // eslint-disable-line @typescript-eslint/no-unused-vars
  saveIconDetectionDebug(image, extents, detectedIcons);
  // detectedIcons (and detectedIconsToObjectGroups()) will be used when building the final v2 map output

  // 10.5c Fill icon regions at pixel level with surrounding grass color
  await fillIconRegionsWithTerrain(data, width, extents, pixelGrid, detectedIcons);
  savePostIconFillDebug(data, width, height);

  // 10.6 Fill edge regions: sand/rock/water → level1
  fillEdgeRegionsWithLevel1(pixelGrid);

  savePixelGridDebug(pixelGrid);

  // 11. detect water pixels and fill them with their surrounding level
  // determine level of terrain under water by looking at pixels adjacent to terrain, layer must cut a straight line under the water

  // 12. detect paths and fill them with their surrounding level
  // try to detect curved corners, but don't try so hard
  // note: path editing will have to include a 'repaint' tool, as well as a curving tool
  // paths should also be inset

  console.log('Generate from Screenshot: done');
}
