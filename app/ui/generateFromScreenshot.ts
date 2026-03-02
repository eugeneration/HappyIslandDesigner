// generateFromScreenshot.ts
// Analyzes an ACNH map screenshot to detect island boundaries and generate a v2 map.
// Step 1: Island extent detection via color-based boundary scanning.

import {
  getTileDirection, getPlaceholderIndexForPosition,
  assetIndexToData, type TileDirection,
} from './edgeTileAssets';
import { tilesDataCache } from '../generatedTilesCache';
import { loadMapFromJSONString } from '../load';

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
  fillExtraColors?: RGB[];             // Additional colors to include in fill dilation (not treated as background)
  fillExtraColorTolerance?: number;    // Tolerance for fillExtraColors matching (default: 25)
  extraFillBuffer?: number;            // Extra dilation rounds beyond the default 3 (default: 0)
  auxiliaryBlobColors?: RGB[];         // Extra seed colors for blob detection (e.g. white icon interior)
  auxiliaryBlobColorTolerance?: number; // Tolerance for auxiliaryBlobColors (default: 25)
  maxCount?: number;                   // Max instances allowed in uniqueness constraint (default: 1)
  emitsObject?: boolean;               // Whether to include in v2 object output (default: true)
  orientations?: OrientationVariant[]; // For multi-orientation icons (bridges, stairs)
  requiresWaterAdjacency?: boolean;    // Bridges must have water on perpendicular sides
  maskDilationRadius?: number;         // Dilate color mask N px before BFS (fixed pixel count)
  maskDilationRadiusCoords?: number;   // Dilate color mask N coords before BFS (scales with pixelsPerCoord)
  allowedOverlap?: number;             // Island-coord units of overlap permitted in non-overlap check (default: 0)
  blockBoundaryTolerance?: number;     // Elevated color tolerance near block-boundary gridlines (whitened by dotted overlay)
  maxSaturation?: number;              // If set, pixels with HSL saturation above this are excluded from blob detection
  tanRoundedRectFill?: {             // If set, also fill a rounded-rect region during fillIconRegionsWithTerrain
    widthCoords: number;             // Width of the rounded rect in island coords
    heightCoords: number;            // Height in island coords
    borderRadiusCoords: number;      // Corner radius in island coords
    // Position: top edge aligned with blobBBoxPx minY; horizontally centered on blob center X
  };
};

type ColorBlob = {
  pixels: Set<number>;     // Set of linear indices (y * imageWidth + x)
  minX: number; minY: number; maxX: number; maxY: number;
  area: number;
};

// Debug info for a blob found during stairs/bridge detection
type BlobDebugEntry = {
  colorGroup: 'stairs' | 'bridges';
  blob: ColorBlob;
  accepted: boolean;  // Whether blob passed validation and was added to allCandidates
  rejectReason?: string;  // Why the blob was rejected (for debug label)
};

type DetectMapIconsResult = {
  icons: DetectedIcon[];
  blobDebug: BlobDebugEntry[];
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
  fillOnly?: boolean;                    // If true: run fill step only, skip object generation and constraints
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
    extraFillBuffer: 2,
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
    extraFillBuffer: 2,
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
    extraFillBuffer: 2,
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
    allowedOverlap: 2,
    auxiliaryBlobColors: [{ r: 0xFD, g: 0xFC, b: 0xFA }],  // #FDFCFA white icon interior
    auxiliaryBlobColorTolerance: 25,
    extraFillBuffer: 2,
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
    allowedOverlap: 2,
    auxiliaryBlobColors: [{ r: 0xFD, g: 0xFC, b: 0xFA }],  // #FDFCFA white icon interior
    auxiliaryBlobColorTolerance: 25,
    extraFillBuffer: 2,
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
    allowedOverlap: 2,
    auxiliaryBlobColors: [{ r: 0xFD, g: 0xFC, b: 0xFA }],  // #FDFCFA white icon interior
    auxiliaryBlobColorTolerance: 25,
    extraFillBuffer: 2,
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
    allowedOverlap: 2,
    auxiliaryBlobColors: [{ r: 0xFD, g: 0xFC, b: 0xFA }],  // #FDFCFA white icon interior
    auxiliaryBlobColorTolerance: 25,
    extraFillBuffer: 2,
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
    auxiliaryBlobColors: [{ r: 0xFD, g: 0xFC, b: 0xFA }],  // #FDFCFA white icon interior
    auxiliaryBlobColorTolerance: 25,
    extraFillBuffer: 2,
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
    auxiliaryBlobColors: [{ r: 0xFD, g: 0xFC, b: 0xFA }],  // #FDFCFA white icon interior
    auxiliaryBlobColorTolerance: 25,
    extraFillBuffer: 2,
  },

  // === Large building group (dark circle #534D41, nosquare variant) ===
  // Detected via normal dark circle blob matching.
  // tan rounded-rect base (12x10 coords, border-radius 2) is filled during fillIconRegionsWithTerrain.
  {
    name: 'Resident Services',
    category: 'amenities',
    type: 'center',
    imagePath: 'static/dev/icon-amenity-center-nosquare.png',
    colors: [{ r: 0x53, g: 0x4D, b: 0x41 }],  // #534D41 dark circle (same as other buildings)
    colorTolerance: 35,
    sizeInCoords: [7.3, 7.3],          // 39x39 px ÷ 5.33
    objectSizeInCoords: [12, 10],
    aspectRatioRange: [0.7, 1.4],
    minFillRatio: 0.3,
    opaqueArea: 1201,                  // opaque pixels in icon-amenity-center-nosquare.png
    fillExtraColors: [
      { r: 0xB1, g: 0xA3, b: 0x7E },  // #B1A37E tan base (dilation passes through)
      { r: 0xB0, g: 0xA2, b: 0x7D },  // #B0A27D
      { r: 0xAD, g: 0x9F, b: 0x7C },  // #AD9F7C
    ],
    tanRoundedRectFill: { widthCoords: 12, heightCoords: 10, borderRadiusCoords: 2 },
    auxiliaryBlobColors: [{ r: 0xFD, g: 0xFC, b: 0xFA }],  // #FDFCFA white icon interior
    auxiliaryBlobColorTolerance: 25,
    extraFillBuffer: 2,
  },
  {
    name: 'Town Hall',
    category: 'amenities',
    type: 'townhallSprite',
    imagePath: 'static/dev/icon-townhall-nosquare.png',
    colors: [{ r: 0x53, g: 0x4D, b: 0x41 }],  // #534D41 dark circle
    colorTolerance: 35,
    sizeInCoords: [7.1, 7.1],          // 38x38 px ÷ 5.33 (bounds 0–37)
    objectSizeInCoords: [6, 4],
    aspectRatioRange: [0.7, 1.4],
    minFillRatio: 0.3,
    opaqueArea: 1156,                  // opaque pixels in icon-townhall-nosquare.png
    fillExtraColors: [
      { r: 0xB1, g: 0xA3, b: 0x7E },  // #B1A37E tan base (dilation passes through)
      { r: 0xB0, g: 0xA2, b: 0x7D },  // #B0A27D
      { r: 0xAD, g: 0x9F, b: 0x7C },  // #AD9F7C
    ],
    tanRoundedRectFill: { widthCoords: 12, heightCoords: 10, borderRadiusCoords: 2 },
    auxiliaryBlobColors: [{ r: 0xFD, g: 0xFC, b: 0xFA }],  // #FDFCFA white icon interior
    auxiliaryBlobColorTolerance: 25,
    extraFillBuffer: 2,
  },

  // === Orange marker (unique color, no v2 object) ===
  {
    name: 'You Are Here',
    category: 'marker',
    type: 'youAreHereMarker',
    imagePath: 'static/dev/icon-youarehere.png',
    colors: [{ r: 0xF1, g: 0x63, b: 0x23 }],  // #F16323 orange (60%)
    colorTolerance: 35,
    sizeInCoords: [5.82, 7.88],         // 31/5.33 = 5.82, 42/5.33 = 7.88
    objectSizeInCoords: [5, 7],
    aspectRatioRange: [0.5, 1.0],
    minFillRatio: 0.3,
    opaqueArea: 875,
    maxCount: 1,
    emitsObject: false,
    fillExtraColors: [{ r: 0xF4, g: 0xF6, b: 0xB7 }],  // #F4F6B7 outer white border (isBackgroundPixel treats it as sand)
    fillExtraColorTolerance: 50,                          // More permissive match for the white outline
    extraFillBuffer: 2,                                   // Extra 2px dilation to close 1–2px gaps around the border
  },

  // === Olive bridge group (#7F8267) — 3 sizes, orientation-aware ===
  {
    // Bridge opaqueArea values count only pixels within olive colorTolerance (40),
    // not all opaque pixels. The template image edges have greenish-teal pixels that
    // fall outside tolerance and are never captured by blob detection.
    name: 'Bridge (3-wide)',
    category: 'construction',
    type: 'bridgeStoneVertical',
    imagePath: 'static/dev/icon-bridge-3.png',
    colors: [{ r: 0x7F, g: 0x82, b: 0x67 }],  // #7F8267 olive
    colorTolerance: 40,
    blockBoundaryTolerance: 60,       // Gridlines lighten the color at block boundaries
    maxSaturation: 0.25,              // Bridge is desaturated (~12%); rejects path-like pixels (~34%)
    sizeInCoords: [2.1, 3.0],         // narrow × length (nominal 3-wide bridge)
    objectSizeInCoords: [4, 6],
    aspectRatioRange: [0.2, 5.0],
    minFillRatio: 0.3,
    opaqueArea: 154,
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
    colorTolerance: 40,
    blockBoundaryTolerance: 60,
    maxSaturation: 0.25,
    sizeInCoords: [2.1, 4.0],         // narrow × length (nominal 4-wide bridge)
    objectSizeInCoords: [4, 6],
    aspectRatioRange: [0.2, 5.0],
    minFillRatio: 0.3,
    opaqueArea: 212,
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
    colorTolerance: 40,
    blockBoundaryTolerance: 60,
    maxSaturation: 0.25,
    sizeInCoords: [2.1, 5.0],         // narrow × length (nominal 5-wide bridge)
    objectSizeInCoords: [4, 6],
    aspectRatioRange: [0.2, 5.0],
    minFillRatio: 0.3,
    opaqueArea: 266,
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
    blockBoundaryTolerance: 60,       // Gridlines lighten the color at block boundaries
    sizeInCoords: [2.3, 4.3],         // 12/5.33, 23/5.33
    objectSizeInCoords: [2, 4],
    aspectRatioRange: [0.2, 5.0],
    minFillRatio: 0.3,
    opaqueArea: 264,
    fillBehavior: 'terrain-foot' as const,
    maxCount: 8,
    orientations: [
      { rotation: 0 as const,   objectType: 'stairsStoneUp',    objectCategory: 'construction', objectSize: [2, 4] as [number, number] },
      { rotation: 90 as const,  objectType: 'stairsStoneRight',  objectCategory: 'construction', objectSize: [4, 2] as [number, number] },
      { rotation: 180 as const, objectType: 'stairsStoneDown',   objectCategory: 'construction', objectSize: [2, 4] as [number, number] },
      { rotation: 270 as const, objectType: 'stairsStoneLeft',   objectCategory: 'construction', objectSize: [4, 2] as [number, number] },
    ],
  },
];

const COLOR_TOLERANCE = 40; // Euclidean RGB distance

// Bridge structural detection: railing is slightly lighter than center walkway.
// Railing luma ≈ 139–147, center luma ≈ 124–133; minimum difference ≈ 6.
const BRIDGE_RAILING_LUMA_MIN_DIFF = 8;
const BRIDGE_RAILING_LUMA_MIN_DIFF_DIAG = 5;       // relaxed for diagonal (weaker contrast along 45° pixel lines)
const BRIDGE_STRUCTURE_PASS_THRESHOLD = 0.4; // min fraction of cross-sections showing railing pattern
const BRIDGE_STRUCTURE_PASS_THRESHOLD_DIAG = 0.25;  // relaxed for diagonal
const BRIDGE_LUMA_MIN = 90;           // min luma for bridge tile pixels
const BRIDGE_LUMA_MAX = 155;          // max luma for bridge tile pixels
const BRIDGE_SAT_MAX_DETECT = 0.25;   // saturation cap for bridge extent detection
const BRIDGE_EXTENT_THRESHOLD = 0.4;  // fraction of cross-section center pixels that must be bridge-like
const BRIDGE_LENGTHS = [3, 4, 5] as const;

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

function hslSaturation(pixel: RGB): number {
  const r = pixel.r / 255, g = pixel.g / 255, b = pixel.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
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

// Render SVG paths to 16×16 canvas and classify each pixel as terrain.
// Also returns opaqueMask: 1 where alpha >= 64 (any painted region, including antialiased edges).
function rasterizeSvgToTerrainGrid(
  svgInnerContent: string, ctx: CanvasRenderingContext2D,
): { terrainGrid: Uint8Array; opaqueMask: Uint8Array } {
  ctx.clearRect(0, 0, 16, 16);
  for (const { d, fill } of parseSvgPaths(svgInnerContent)) {
    ctx.fillStyle = fill;
    ctx.fill(new Path2D(d));
  }
  const imageData = ctx.getImageData(0, 0, 16, 16);
  const terrainGrid = new Uint8Array(256);
  const opaqueMask = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const r = imageData.data[i * 4];
    const g = imageData.data[i * 4 + 1];
    const b = imageData.data[i * 4 + 2];
    const a = imageData.data[i * 4 + 3];
    opaqueMask[i] = a >= 64 ? 1 : 0;
    // Nearest SVG color by Euclidean distance (tolerance for antialiasing)
    let bestTerrain: TerrainType = TERRAIN.UNKNOWN;
    let bestDist = 30; // max tolerance
    for (const c of SVG_EDGE_COLORS) {
      const dist = Math.sqrt((r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2);
      if (dist < bestDist) { bestDist = dist; bestTerrain = c.terrain; }
    }
    terrainGrid[i] = bestTerrain;
  }
  return { terrainGrid, opaqueMask };
}

type EdgeTileRef = { direction: TileDirection; terrainGrid: Uint8Array; opaqueMask: Uint8Array };

type EdgeTileMatch = {
  blockX: number;
  blockY: number;
  assetIndex: number;
  score: number;
  refTerrain: Uint8Array | null;     // 16×16 terrain grid, null if no match
  refOpaqueMask: Uint8Array | null;  // 16×16 opaque mask (alpha>=64), null if no match
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
    const { terrainGrid, opaqueMask } = rasterizeSvgToTerrainGrid(cached.svg, ctx);
    library.set(index, { direction: data.direction, terrainGrid, opaqueMask });
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
      const bestRef = library.get(bestIndex)!;
      writeReferenceTerrainToGrid(grid, blockX, blockY, bestRef.terrainGrid, bestScore);
      assetIndices.push(bestIndex);
      matches.push({
        blockX, blockY,
        assetIndex: bestIndex,
        score: bestScore,
        refTerrain: bestRef.terrainGrid,
        refOpaqueMask: bestRef.opaqueMask,
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
        refOpaqueMask: null,
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

// Paint sand and rock pixels in edge block regions with level1 grass color in the raw screenshot data.
// This must run BEFORE stairs/bridge blob detection to eliminate false positives caused by sand pixels
// (sand #ECE5A1 is very close to stair color #F5DE99, distance ~14) and edge rock pixels.
// Uses the matched refTerrain grid where available; falls back to pixel classification otherwise.
function fillEdgeRegionsInScreenshot(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
  edgeResult: EdgeTileMatchResult,
): void {
  const ppc = extents.pixelsPerCoord;
  const fullLeft = extents.full.left;
  const fullTop = extents.full.top;
  const paintColor = SCREENSHOT_COLORS.LEVEL1_GRASS[0];
  let pixelsPainted = 0;

  // Helper: paint a rectangular pixel region unconditionally
  function paintPixelRect(pxLeft: number, pxTop: number, pxRight: number, pxBottom: number): void {
    for (let py = pxTop; py < pxBottom; py++) {
      if (py < 0 || py >= imageHeight) continue;
      for (let px = pxLeft; px < pxRight; px++) {
        if (px < 0 || px >= imageWidth) continue;
        const pi = (py * imageWidth + px) * 4;
        data[pi]     = paintColor.r;
        data[pi + 1] = paintColor.g;
        data[pi + 2] = paintColor.b;
        pixelsPainted++;
      }
    }
  }

  // Helper: paint a full 16-coord block region (for outward expansion)
  function paintFullBlock(bx: number, by: number): void {
    const left   = Math.round(fullLeft + bx * 16 * ppc);
    const top    = Math.round(fullTop  + by * 16 * ppc);
    const right  = Math.round(fullLeft + (bx + 1) * 16 * ppc);
    const bottom = Math.round(fullTop  + (by + 1) * 16 * ppc);
    paintPixelRect(left, top, right, bottom);
  }

  // Island block dimensions: 112 coords / 16 = 7 cols, 96 coords / 16 = 6 rows
  const BLOCK_COLS = ISLAND_COORD_WIDTH  / 16;  // 7 — blockX range [0, 6]
  const BLOCK_ROWS = ISLAND_COORD_HEIGHT / 16;  // 6 — blockY range [0, 5]

  // Collect outward neighbor block positions to paint after the main loop.
  // "Outward" means one block further from the island interior than the edge block.
  const outwardBlocks = new Set<string>();

  for (const match of edgeResult.matches) {
    const { blockX, blockY, refOpaqueMask } = match;

    // Track pixels painted for this block so the extra fill can seed from their boundary
    const paintedInBlock = new Set<number>();

    if (refOpaqueMask !== null) {
      // Use matched SVG opaque mask: paint all cells where the asset has any coverage
      for (let ly = 0; ly < 16; ly++) {
        for (let lx = 0; lx < 16; lx++) {
          if (refOpaqueMask[ly * 16 + lx] === 0) continue;

          // Compute screen pixel region for this coord cell
          const cellLeft   = Math.round(fullLeft + (blockX * 16 + lx) * ppc);
          const cellTop    = Math.round(fullTop  + (blockY * 16 + ly) * ppc);
          const cellRight  = Math.round(fullLeft + (blockX * 16 + lx + 1) * ppc);
          const cellBottom = Math.round(fullTop  + (blockY * 16 + ly + 1) * ppc);
          for (let py = cellTop; py < cellBottom; py++) {
            if (py < 0 || py >= imageHeight) continue;
            for (let px = cellLeft; px < cellRight; px++) {
              if (px < 0 || px >= imageWidth) continue;
              paintedInBlock.add(py * imageWidth + px);
            }
          }
          paintPixelRect(cellLeft, cellTop, cellRight, cellBottom);
        }
      }
    } else {
      // No matched tile — fall back to classifying every pixel in the block region
      const blockLeft   = Math.round(fullLeft + blockX * 16 * ppc);
      const blockTop    = Math.round(fullTop  + blockY * 16 * ppc);
      const blockRight  = Math.round(fullLeft + (blockX + 1) * 16 * ppc);
      const blockBottom = Math.round(fullTop  + (blockY + 1) * 16 * ppc);

      for (let py = blockTop; py < blockBottom; py++) {
        if (py < 0 || py >= imageHeight) continue;
        for (let px = blockLeft; px < blockRight; px++) {
          if (px < 0 || px >= imageWidth) continue;
          const pixel = getPixelAt(data, imageWidth, px, py);
          const t = classifyPixelTerrain(pixel);
          if (t !== TERRAIN.SAND && t !== TERRAIN.ROCK && t !== TERRAIN.WATER) continue;
          const pi = (py * imageWidth + px) * 4;
          data[pi]     = paintColor.r;
          data[pi + 1] = paintColor.g;
          data[pi + 2] = paintColor.b;
          pixelsPainted++;
          paintedInBlock.add(py * imageWidth + px);
        }
      }
    }

    // Determine outward directions for this edge block and collect neighbor positions
    const isLeft   = blockX === 0;
    const isRight  = blockX === BLOCK_COLS - 1;
    const isTop    = blockY === 0;
    const isBottom = blockY === BLOCK_ROWS - 1;

    // BFS expansion from the boundary of the painted opaque mask region.
    // Extends outward from where the edge tile's land coverage ends, catching
    // sand/water transition pixels just beyond the opaque mask's reach.
    // Skip river mouth tiles to preserve river water for downstream water detection.
    const edgeAssetData = assetIndexToData.get(match.assetIndex);
    const isRiverMouth = edgeAssetData?.state === 'river';

    if (!isRiverMouth && paintedInBlock.size > 0) {
      const EDGE_EXPAND_DEPTH = 8;
      const EDGE_EXPAND_TOLERANCE = 80;  // Permissive: catches transition pixels between sand/water and grass
      const edgeExpandQueue: Array<{ idx: number; depth: number }> = [];
      const edgeExpandVisited = new Set<number>(paintedInBlock);

      const edgeDx4 = [0, 0, -1, 1];
      const edgeDy4 = [-1, 1, 0, 0];

      // Seed BFS from boundary pixels of the painted region
      for (const linearIdx of paintedInBlock) {
        const bpx = linearIdx % imageWidth;
        const bpy = Math.floor(linearIdx / imageWidth);
        for (let d = 0; d < 4; d++) {
          const nx = bpx + edgeDx4[d];
          const ny = bpy + edgeDy4[d];
          if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
          const nIdx = ny * imageWidth + nx;
          if (edgeExpandVisited.has(nIdx)) continue;
          edgeExpandVisited.add(nIdx);
          edgeExpandQueue.push({ idx: nIdx, depth: 1 });
        }
      }

      for (let qi = 0; qi < edgeExpandQueue.length; qi++) {
        const { idx, depth } = edgeExpandQueue[qi];
        if (depth > EDGE_EXPAND_DEPTH) continue;

        const px = idx % imageWidth;
        const py = Math.floor(idx / imageWidth);

        // Permissive color check: match sand or water with tolerance 80 to catch
        // transition/blended pixels at tile boundaries (default tolerance is 40).
        const pixel = getPixelAt(data, imageWidth, px, py);
        const isNearSandOrWater =
          matchesAnyColor(pixel, SCREENSHOT_COLORS.SAND, EDGE_EXPAND_TOLERANCE) ||
          matchesAnyColor(pixel, SCREENSHOT_COLORS.WATER, EDGE_EXPAND_TOLERANCE);
        if (!isNearSandOrWater) continue;

        // Paint this pixel with level1 grass
        const pi = idx * 4;
        data[pi]     = paintColor.r;
        data[pi + 1] = paintColor.g;
        data[pi + 2] = paintColor.b;
        pixelsPainted++;

        // Continue BFS to cardinal neighbors
        if (depth < EDGE_EXPAND_DEPTH) {
          for (let d = 0; d < 4; d++) {
            const nx = px + edgeDx4[d];
            const ny = py + edgeDy4[d];
            if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
            const neighborIdx = ny * imageWidth + nx;
            if (edgeExpandVisited.has(neighborIdx)) continue;
            edgeExpandVisited.add(neighborIdx);
            edgeExpandQueue.push({ idx: neighborIdx, depth: depth + 1 });
          }
        }
      }
    }

    const dxList: number[] = isLeft ? [-1] : isRight ? [1] : [];
    const dyList: number[] = isTop  ? [-1] : isBottom ? [1] : [];

    for (const dx of dxList) outwardBlocks.add(`${blockX + dx},${blockY}`);
    for (const dy of dyList) outwardBlocks.add(`${blockX},${blockY + dy}`);
    for (const dx of dxList) for (const dy of dyList) outwardBlocks.add(`${blockX + dx},${blockY + dy}`);
  }

  // Paint all outward neighbor blocks unconditionally (they are outside the island)
  for (const key of outwardBlocks) {
    const comma = key.indexOf(',');
    const bx = parseInt(key.slice(0, comma), 10);
    const by = parseInt(key.slice(comma + 1), 10);
    paintFullBlock(bx, by);
  }

  console.log(`Generate from Screenshot: edge regions painted in screenshot data (${pixelsPainted} px)`);
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

  for (let _ii = 0; _ii < detectedIcons.length; _ii++) {
    const icon = detectedIcons[_ii];
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
    // extraFillBuffer adds additional dilation rounds per-template (e.g. youarehere needs 5px total).
    const DILATION_DEPTH = 3 + (icon.template.extraFillBuffer ?? 0);
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
      // Exception: fillExtraColors (e.g. youarehere white border #F4F6B7) should not stop expansion.
      const extraColors = icon.template.fillExtraColors ?? [];
      const extraTol = icon.template.fillExtraColorTolerance ?? 25;
      const isExtraFillColor = extraColors.length > 0 && matchesAnyColor(pixel, extraColors, extraTol);
      if (isBackgroundPixel(pixel) && !isExtraFillColor) continue;

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

    // 2c. For diagonal bridges (45° or 135°), extend the fill diagonally by 2px.
    // Bridges cross water/terrain boundaries, so expand unconditionally in diagonal directions.
    if (icon.template.fillBehavior === 'water' && icon.orientation &&
        (icon.orientation.rotation === 45 || icon.orientation.rotation === 135)) {
      const DIAG_DEPTH = 2;
      const diagDx = [1, 1, -1, -1];
      const diagDy = [-1, 1, -1, 1];
      const diagQueue: Array<{ idx: number; depth: number }> = [];

      // Seed from boundary pixels of the current dilated set
      for (const linearIdx of dilatedPixels) {
        const px = linearIdx % imageWidth;
        const py = Math.floor(linearIdx / imageWidth);
        for (let d = 0; d < 4; d++) {
          const nx = px + diagDx[d];
          const ny = py + diagDy[d];
          if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
          const neighborIdx = ny * imageWidth + nx;
          if (dilatedPixels.has(neighborIdx)) continue;
          diagQueue.push({ idx: neighborIdx, depth: 1 });
        }
      }

      for (let qi = 0; qi < diagQueue.length; qi++) {
        const { idx, depth } = diagQueue[qi];
        if (dilatedPixels.has(idx)) continue;
        if (depth > DIAG_DEPTH) continue;
        dilatedPixels.add(idx);
        if (depth < DIAG_DEPTH) {
          const px = idx % imageWidth;
          const py = Math.floor(idx / imageWidth);
          for (let d = 0; d < 4; d++) {
            const nx = px + diagDx[d];
            const ny = py + diagDy[d];
            if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
            const neighborIdx = ny * imageWidth + nx;
            if (dilatedPixels.has(neighborIdx)) continue;
            diagQueue.push({ idx: neighborIdx, depth: depth + 1 });
          }
        }
      }
    }

    // 3. For buildings with a tan rounded-rect base, also fill that region.
    // The dark-circle nosquare blob gives the anchor; the tan box sits behind it.
    if (icon.template.tanRoundedRectFill) {
      const { widthCoords, heightCoords, borderRadiusCoords } = icon.template.tanRoundedRectFill;
      const ppc = extents.pixelsPerCoord;
      const circCenterX = (bMinX + bMaxX) / 2;
      const rectMinX = Math.round(circCenterX - widthCoords * ppc / 2);
      const rectMaxX = Math.round(circCenterX + widthCoords * ppc / 2);
      const rectMinY = Math.round(bMinY);
      const rectMaxY = Math.round(bMinY + heightCoords * ppc) + 3;
      const r = Math.round(borderRadiusCoords * ppc);

      for (let ry = rectMinY; ry <= rectMaxY; ry++) {
        for (let rx = rectMinX; rx <= rectMaxX; rx++) {
          if (rx < 0 || rx >= imageWidth || ry < 0 || ry >= imageHeight) continue;
          // Rounded corner check: reject pixels in corners outside the arc of radius r
          const inLeftEdge  = rx < rectMinX + r;
          const inRightEdge = rx > rectMaxX - r;
          const inTopEdge   = ry < rectMinY + r;
          const inBotEdge   = ry > rectMaxY - r;
          if ((inLeftEdge || inRightEdge) && (inTopEdge || inBotEdge)) {
            const cx = inLeftEdge ? rectMinX + r : rectMaxX - r;
            const cy = inTopEdge  ? rectMinY + r : rectMaxY - r;
            const dx = rx - cx, dy = ry - cy;
            if (dx * dx + dy * dy > r * r) continue;
          }
          dilatedPixels.add(ry * imageWidth + rx);
        }
      }
    }

    // 4. Determine fill color based on fillBehavior
    const fillBehavior = icon.template.fillBehavior ?? 'grass';
    let paintColor: RGB;
    let gridFillTerrain: TerrainType;

    // Per-cell level map for grass fill (nearest-level BFS); empty for water/foot/LEVEL1_ALWAYS
    const cellLevel = new Map<number, TerrainType>();
    let fallbackLevel: TerrainType = TERRAIN.LEVEL1;

    if (fillBehavior === 'water') {
      paintColor = SCREENSHOT_COLORS.WATER[0];
      gridFillTerrain = TERRAIN.WATER;
    } else if (fillBehavior === 'terrain-foot') {
      const footLevel = sampleTerrainAtStairsFoot(data, imageWidth, imageHeight, icon);
      paintColor = terrainLevelToColor(footLevel);
      gridFillTerrain = footLevel;
    } else {
      // Grass fill — nearest-level BFS from surrounding grid terrain
      if (!LEVEL1_ALWAYS_TYPES.has(icon.template.type)) {
        // Build the set of grid cells covered by the dilated pixel region
        const coveredCells = new Set<number>();
        for (const linearIdx of dilatedPixels) {
          const ipx = linearIdx % imageWidth, ipy = Math.floor(linearIdx / imageWidth);
          const { cx, cy } = pixelToIslandCoord(ipx, ipy, extents);
          const gcx = Math.floor(cx), gcy = Math.floor(cy);
          if (gcx < 0 || gcx >= ISLAND_COORD_WIDTH || gcy < 0 || gcy >= ISLAND_COORD_HEIGHT) continue;
          coveredCells.add(gcy * ISLAND_COORD_WIDTH + gcx);
        }

        // Multi-source BFS: seed covered cells that are adjacent to LEVEL1/2/3 outside the region
        const cellBfsQueue: Array<{ cellIdx: number; level: TerrainType }> = [];
        const cellBfsVisited = new Set<number>();

        for (const cellIdx of coveredCells) {
          const ccx = cellIdx % ISLAND_COORD_WIDTH, ccy = Math.floor(cellIdx / ISLAND_COORD_WIDTH);
          for (let d = 0; d < 4; d++) {
            const nx = ccx + dx4[d], ny = ccy + dy4[d];
            if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
            const nIdx = ny * ISLAND_COORD_WIDTH + nx;
            if (coveredCells.has(nIdx)) continue;
            const t = grid.primary[nIdx] as TerrainType;
            if (t !== TERRAIN.LEVEL1 && t !== TERRAIN.LEVEL2 && t !== TERRAIN.LEVEL3) continue;
            if (cellBfsVisited.has(cellIdx)) continue;
            cellBfsVisited.add(cellIdx);
            cellBfsQueue.push({ cellIdx, level: t });
          }
        }

        // BFS propagation: each covered cell gets the level of its nearest surrounding terrain
        for (let qi = 0; qi < cellBfsQueue.length; qi++) {
          const { cellIdx, level } = cellBfsQueue[qi];
          cellLevel.set(cellIdx, level);
          const ccx = cellIdx % ISLAND_COORD_WIDTH, ccy = Math.floor(cellIdx / ISLAND_COORD_WIDTH);
          for (let d = 0; d < 4; d++) {
            const nx = ccx + dx4[d], ny = ccy + dy4[d];
            if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
            const nIdx = ny * ISLAND_COORD_WIDTH + nx;
            if (!coveredCells.has(nIdx) || cellBfsVisited.has(nIdx)) continue;
            cellBfsVisited.add(nIdx);
            cellBfsQueue.push({ cellIdx: nIdx, level });
          }
        }

        // Fallback: most common BFS level (for cells unreachable by BFS), default LEVEL1
        if (cellLevel.size > 0) {
          const counts = new Map<TerrainType, number>();
          for (const lvl of cellLevel.values()) counts.set(lvl, (counts.get(lvl) ?? 0) + 1);
          let maxCount = 0;
          for (const [lvl, count] of counts) {
            if (count > maxCount) { maxCount = count; fallbackLevel = lvl; }
          }
        }
      }

      paintColor = terrainLevelToColor(fallbackLevel);
      gridFillTerrain = fallbackLevel;
    }

    // 4. Paint over every pixel in the dilated fill region.
    // For grass fill: use per-cell level from BFS (different parts of a large icon may differ).
    // For water/terrain-foot: uniform paintColor.
    for (const linearIdx of dilatedPixels) {
      let c: RGB = paintColor;
      if (fillBehavior === 'grass') {
        const ipx = linearIdx % imageWidth, ipy = Math.floor(linearIdx / imageWidth);
        const { cx, cy } = pixelToIslandCoord(ipx, ipy, extents);
        const gcx = Math.floor(cx), gcy = Math.floor(cy);
        if (gcx >= 0 && gcx < ISLAND_COORD_WIDTH && gcy >= 0 && gcy < ISLAND_COORD_HEIGHT) {
          c = terrainLevelToColor(cellLevel.get(gcy * ISLAND_COORD_WIDTH + gcx) ?? fallbackLevel);
        }
      }
      const dataIdx = linearIdx * 4;
      data[dataIdx]     = c.r;
      data[dataIdx + 1] = c.g;
      data[dataIdx + 2] = c.b;
    }

    // 5. Also update pixelGrid per-cell (needed for downstream fillEdgeRegionsWithLevel1 and debug)
    const [objW, objH] = icon.resolvedObjectSize ?? icon.template.objectSizeInCoords;
    const gx0 = Math.max(0, Math.round(icon.centerCoordX - objW / 2));
    const gy0 = Math.max(0, Math.round(icon.centerCoordY - objH / 2));
    const gx1 = Math.min(ISLAND_COORD_WIDTH, Math.round(icon.centerCoordX + objW / 2));
    const gy1 = Math.min(ISLAND_COORD_HEIGHT, Math.round(icon.centerCoordY + objH / 2));
    for (let y = gy0; y < gy1; y++) {
      for (let x = gx0; x < gx1; x++) {
        const idx = y * ISLAND_COORD_WIDTH + x;
        const lvl: TerrainType = fillBehavior === 'grass'
          ? (cellLevel.get(idx) ?? fallbackLevel)
          : gridFillTerrain;
        grid.primary[idx] = lvl;
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

// Snap a pixel coordinate to the nearest tile-grid boundary.
function snapToGrid(px: number, extents: IslandExtents): number {
  const ppc = extents.pixelsPerCoord;
  const gridCoord = Math.round((px - extents.full.left) / ppc);
  return Math.round(extents.full.left + gridCoord * ppc);
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
  blockBoundaryTolerance?: number,
  maxSaturation?: number,
): ColorBlob[] {
  const { left, top, right, bottom } = extents.full;
  const scanWidth = right - left;
  const scanHeight = bottom - top;
  const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy8 = [-1, -1, -1, 0, 0, 1, 1, 1];

  // Precompute block boundary pixel positions for gridline tolerance relaxation.
  // ACNH screenshots have semi-transparent white dotted lines at block boundaries,
  // which lighten the pixel color. Near these lines, use a higher tolerance.
  const hBoundaries: number[] = [];
  const vBoundaries: number[] = [];
  let bbZone = 0;
  if (blockBoundaryTolerance !== undefined) {
    const ppc = extents.pixelsPerCoord;
    bbZone = ppc * 0.6;  // ±0.6 coords around each boundary line
    for (let br = 1; br < 6; br++) hBoundaries.push(extents.full.top + br * 16 * ppc);
    for (let bc = 1; bc < 7; bc++) vBoundaries.push(extents.full.left + bc * 16 * ppc);
  }

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
      // Use elevated tolerance near block boundary gridlines
      let effectiveTolerance = tolerance;
      if (bbZone > 0) {
        const nearH = hBoundaries.some(by => Math.abs(imgY - by) <= bbZone);
        const nearV = vBoundaries.some(bx => Math.abs(imgX - bx) <= bbZone);
        if (nearH || nearV) effectiveTolerance = blockBoundaryTolerance!;
      }
      for (const tc of targetColors) {
        if (colorDistance(pixel, tc) <= effectiveTolerance) {
          if (maxSaturation !== undefined && hslSaturation(pixel) > maxSaturation) break;
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
// Structural bridge orientation detection.
// Instead of pixel-matching against template images, checks for the characteristic
// bridge pattern: a lighter railing (~20% width) on each side of a darker center walkway (~60%).
// For vertical bridges (rotation 0): scans horizontal cross-sections.
// For horizontal bridges (rotation 90): scans vertical cross-sections.
// For diagonal bridges (45/135): sweeps anti-diagonal (TLBR) or diagonal (TRBL) cross-sections.
function structurallyScanBridgeOrientation(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  blob: ColorBlob,
  orientations: readonly OrientationVariant[],
  extents: IslandExtents,
): { orientation: OrientationVariant; score: number; trimmedBboxPx: [number, number, number, number] } | null {
  const rawW = blob.maxX - blob.minX + 1;
  const rawH = blob.maxY - blob.minY + 1;
  const blobAspect = rawW / rawH;
  const fillRatio = blob.area / (rawW * rawH);
  const isDiagonal = blobAspect >= 0.7 && blobAspect <= 1.4 && fillRatio < 0.80;

  // Snap bbox edges to tile-grid boundaries for straight bridges.
  // Diagonal bridge bbox corners are not at grid boundaries, so skip snapping there.
  const minX = isDiagonal ? blob.minX : snapToGrid(blob.minX, extents);
  const minY = isDiagonal ? blob.minY : snapToGrid(blob.minY, extents);
  const maxX = isDiagonal ? blob.maxX : snapToGrid(blob.maxX, extents);
  const maxY = isDiagonal ? blob.maxY : snapToGrid(blob.maxY, extents);

  const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

  // Score one perpendicular cross-section strip.
  // Scans inward from each side, skipping water/blended pixels, to find railing pixels.
  // Railing (~20% of width) should be brighter than the walkway (estimated via lower quartile).
  function scoreStrip(getPixelRGB: (pos: number) => { r: number; g: number; b: number }, sampleMin: number, sampleMax: number, lumaDiff: number = BRIDGE_RAILING_LUMA_MIN_DIFF): number {
    const N = sampleMax - sampleMin + 1;
    if (N < 4) return 0;
    const railN = Math.max(1, Math.round(N * 0.2));
    const lumaOf = (rgb: { r: number; g: number; b: number }) => 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    // Skip water-like pixels (tolerance 60 to catch blended water/bridge edges)
    // and out-of-bounds sentinel (0,0,0) from diagonal cross-sections
    const shouldSkip = (rgb: { r: number; g: number; b: number }) =>
      (rgb.r === 0 && rgb.g === 0 && rgb.b === 0) ||
      matchesAnyColor(rgb, SCREENSHOT_COLORS.WATER, 60);

    // Collect non-water pixel lumas for robust walkway estimate
    const nonWaterLumas: number[] = [];
    for (let p = sampleMin; p <= sampleMax; p++) {
      const rgb = getPixelRGB(p);
      if (!shouldSkip(rgb)) nonWaterLumas.push(lumaOf(rgb));
    }
    if (nonWaterLumas.length < 3) return 0;

    // Walkway luma: lower quartile (immune to grid dots and railing, which are brighter)
    nonWaterLumas.sort((a, b) => a - b);
    const walkwayLuma = nonWaterLumas[Math.floor(nonWaterLumas.length * 0.25)];

    // From left: skip water-like pixels, collect first railN non-water pixels as railing
    let leftSum = 0, leftCount = 0;
    for (let p = sampleMin; p <= sampleMax && leftCount < railN; p++) {
      const rgb = getPixelRGB(p);
      if (shouldSkip(rgb)) continue;
      leftSum += lumaOf(rgb);
      leftCount++;
    }

    // From right: skip water-like pixels, collect first railN non-water pixels as railing
    let rightSum = 0, rightCount = 0;
    for (let p = sampleMax; p >= sampleMin && rightCount < railN; p--) {
      const rgb = getPixelRGB(p);
      if (shouldSkip(rgb)) continue;
      rightSum += lumaOf(rgb);
      rightCount++;
    }

    if (leftCount === 0 || rightCount === 0) return 0;
    return (leftSum / leftCount - walkwayLuma >= lumaDiff &&
            rightSum / rightCount - walkwayLuma >= lumaDiff) ? 1 : 0;
  }

  function scoreVertical(): number {
    if (blobAspect > 0.9) return 0;
    let total = 0, count = 0;
    for (let y = minY; y <= maxY; y++) {
      if (y < 0 || y >= imageHeight) continue;
      const sMinX = Math.max(0, minX - 2);
      const sMaxX = Math.min(imageWidth - 1, maxX + 2);
      total += scoreStrip(p => { const i = (y * imageWidth + p) * 4; return { r: data[i], g: data[i + 1], b: data[i + 2] }; }, sMinX, sMaxX);
      count++;
    }
    return count > 0 ? total / count : 0;
  }

  function scoreHorizontal(): number {
    if (blobAspect < 1.1) return 0;
    let total = 0, count = 0;
    for (let x = minX; x <= maxX; x++) {
      if (x < 0 || x >= imageWidth) continue;
      const sMinY = Math.max(0, minY - 2);
      const sMaxY = Math.min(imageHeight - 1, maxY + 2);
      total += scoreStrip(p => { const i = (p * imageWidth + x) * 4; return { r: data[i], g: data[i + 1], b: data[i + 2] }; }, sMinY, sMaxY);
      count++;
    }
    return count > 0 ? total / count : 0;
  }

  // TLBR (45°): cross-sections are anti-diagonal lines x+y=C, swept from minX+minY to maxX+maxY.
  // At each C, use blob.pixels to find the actual x range (railing to railing), then scoreStrip.
  function scoreTLBR(): number {
    if (!isDiagonal) return 0;
    let total = 0, count = 0;
    for (let C = minX + minY; C <= maxX + maxY; C++) {
      const xLo = Math.max(0, Math.max(minX, C - maxY) - 2);
      const xHi = Math.min(imageWidth - 1, Math.min(maxX, C - minY) + 2);
      if (xHi - xLo < 4) continue;
      total += scoreStrip(x => {
        const y = C - x;
        if (y < 0 || y >= imageHeight || x < 0 || x >= imageWidth) return { r: 0, g: 0, b: 0 };
        const i = (y * imageWidth + x) * 4;
        return { r: data[i], g: data[i + 1], b: data[i + 2] };
      }, xLo, xHi, BRIDGE_RAILING_LUMA_MIN_DIFF_DIAG);
      count++;
    }
    return count > 0 ? total / count : 0;
  }

  // TRBL (135°): cross-sections are diagonal lines x-y=C, swept from minX-maxY to maxX-minY.
  function scoreTRBL(): number {
    if (!isDiagonal) return 0;
    let total = 0, count = 0;
    for (let C = minX - maxY; C <= maxX - minY; C++) {
      const xLo = Math.max(0, Math.max(minX, C + minY) - 2);
      const xHi = Math.min(imageWidth - 1, Math.min(maxX, C + maxY) + 2);
      if (xHi - xLo < 4) continue;
      total += scoreStrip(x => {
        const y = x - C;
        if (y < 0 || y >= imageHeight || x < 0 || x >= imageWidth) return { r: 0, g: 0, b: 0 };
        const i = (y * imageWidth + x) * 4;
        return { r: data[i], g: data[i + 1], b: data[i + 2] };
      }, xLo, xHi, BRIDGE_RAILING_LUMA_MIN_DIFF_DIAG);
      count++;
    }
    return count > 0 ? total / count : 0;
  }

  const vertScore  = scoreVertical();
  const horizScore = scoreHorizontal();
  const tlbrScore  = scoreTLBR();
  const trblScore  = scoreTRBL();

  const scored: Array<{ orient: OrientationVariant; score: number }> = [];
  for (const orient of orientations) {
    const score =
      orient.rotation === 0   ? vertScore  :
      orient.rotation === 90  ? horizScore :
      orient.rotation === 45  ? tlbrScore  :
      orient.rotation === 135 ? trblScore  :
      0;
    if (score > 0) scored.push({ orient, score });
  }

  if (scored.length === 0) return null;
  const best = scored.reduce((a, b) => a.score > b.score ? a : b);
  const structThreshold = (best.orient.rotation === 45 || best.orient.rotation === 135)
    ? BRIDGE_STRUCTURE_PASS_THRESHOLD_DIAG
    : BRIDGE_STRUCTURE_PASS_THRESHOLD;
  if (best.score < structThreshold) return null;

  // Detect the actual bridge extent along its length direction, trimming path-pixel contamination.
  // Sweeps along the bridge direction; a position is "valid" if it has bridge-like pixel colors
  // (desaturated, in the expected luma range) OR has water immediately adjacent on a perpendicular side.
  // The detected extent is snapped to the nearest valid bridge length {3, 4, 5} units.
  const ppc = extents.pixelsPerCoord;

  function isBridgeLikePixel(x: number, y: number): boolean {
    if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) return false;
    const idx = (y * imageWidth + x) * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    const l = luma(r, g, b);
    return l >= BRIDGE_LUMA_MIN && l <= BRIDGE_LUMA_MAX
      && hslSaturation({ r, g, b }) <= BRIDGE_SAT_MAX_DETECT;
  }

  function isWaterPx(x: number, y: number): boolean {
    if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) return false;
    const idx = (y * imageWidth + x) * 4;
    return matchesAnyColor({ r: data[idx], g: data[idx + 1], b: data[idx + 2] }, SCREENSHOT_COLORS.WATER, 40);
  }

  function snapBridgeLength(measuredLen: number): 3 | 4 | 5 {
    return BRIDGE_LENGTHS.reduce((best, l) =>
      Math.abs(l - measuredLen) < Math.abs(best - measuredLen) ? l : best,
    ) as 3 | 4 | 5;
  }

  function detectBridgeExtent(rotation: number): [number, number, number, number] {
    const fallback: [number, number, number, number] = [minX, minY, maxX, maxY];

    if (rotation === 0 || rotation === 180) {
      // Vertical bridge: sweep y rows
      const validRows: boolean[] = [];
      for (let y = minY; y <= maxY; y++) {
        let n = 0, total = 0;
        for (let x = minX; x <= maxX; x++) {
          if (isBridgeLikePixel(x, y)) n++;
          total++;
        }
        const waterLeft  = isWaterPx(minX - 1, y) || isWaterPx(minX - 2, y);
        const waterRight = isWaterPx(maxX + 1, y) || isWaterPx(maxX + 2, y);
        validRows.push((total > 0 && n / total >= BRIDGE_EXTENT_THRESHOLD) || waterLeft || waterRight);
      }
      let minBY = maxY, maxBY = minY;
      for (let i = 0; i < validRows.length; i++) {
        if (validRows[i]) { minBY = Math.min(minBY, minY + i); maxBY = Math.max(maxBY, minY + i); }
      }
      if (minBY > maxBY) return fallback;
      const snapped  = snapBridgeLength((maxBY - minBY) / ppc);
      const centerY  = (minBY + maxBY) / 2;
      return [minX, snapToGrid(centerY - snapped * ppc / 2, extents), maxX, snapToGrid(centerY + snapped * ppc / 2, extents)];

    } else if (rotation === 90 || rotation === 270) {
      // Horizontal bridge: sweep x columns
      let minBX = maxX, maxBX = minX;
      for (let x = minX; x <= maxX; x++) {
        let n = 0, total = 0;
        for (let y = minY; y <= maxY; y++) {
          if (isBridgeLikePixel(x, y)) n++;
          total++;
        }
        const waterTop    = isWaterPx(x, minY - 1) || isWaterPx(x, minY - 2);
        const waterBottom = isWaterPx(x, maxY + 1) || isWaterPx(x, maxY + 2);
        if ((total > 0 && n / total >= BRIDGE_EXTENT_THRESHOLD) || waterTop || waterBottom) {
          minBX = Math.min(minBX, x); maxBX = Math.max(maxBX, x);
        }
      }
      if (minBX > maxBX) return fallback;
      const snapped  = snapBridgeLength((maxBX - minBX) / ppc);
      const centerX  = (minBX + maxBX) / 2;
      return [snapToGrid(centerX - snapped * ppc / 2, extents), minY, snapToGrid(centerX + snapped * ppc / 2, extents), maxY];

    } else if (rotation === 45) {
      // TLBR diagonal: sweep C = x+y
      let minBC = Infinity, maxBC = -Infinity;
      for (let C = minX + minY; C <= maxX + maxY; C++) {
        const xLo = Math.max(minX, C - maxY);
        const xHi = Math.min(maxX, C - minY);
        if (xHi - xLo < 2) continue;
        const cX0 = Math.round(xLo + (xHi - xLo) * 0.2);
        const cX1 = Math.round(xHi - (xHi - xLo) * 0.2);
        let n = 0, total = 0;
        for (let x = cX0; x <= cX1; x++) {
          if (isBridgeLikePixel(x, C - x)) n++;
          total++;
        }
        const waterNE = isWaterPx(xHi + 1, C - xHi - 1) || isWaterPx(xHi + 2, C - xHi - 2);
        const waterSW = isWaterPx(xLo - 1, C - xLo + 1) || isWaterPx(xLo - 2, C - xLo + 2);
        if ((total > 0 && n / total >= BRIDGE_EXTENT_THRESHOLD) || waterNE || waterSW) {
          if (C < minBC) minBC = C;
          if (C > maxBC) maxBC = C;
        }
      }
      if (!isFinite(minBC)) return fallback;
      const snapped = snapBridgeLength((maxBC - minBC) / (ppc * Math.SQRT2));
      const centerC = (minBC + maxBC) / 2;
      const halfC   = snapped * ppc * Math.SQRT2 / 2;
      return [
        Math.max(minX, Math.round(centerC - halfC - maxY)),
        Math.max(minY, Math.round(centerC - halfC - maxX)),
        Math.min(maxX, Math.round(centerC + halfC - minY)),
        Math.min(maxY, Math.round(centerC + halfC - minX)),
      ];

    } else if (rotation === 135) {
      // TRBL diagonal: sweep C = x-y
      let minBC = Infinity, maxBC = -Infinity;
      for (let C = minX - maxY; C <= maxX - minY; C++) {
        const xLo = Math.max(minX, C + minY);
        const xHi = Math.min(maxX, C + maxY);
        if (xHi - xLo < 2) continue;
        const cX0 = Math.round(xLo + (xHi - xLo) * 0.2);
        const cX1 = Math.round(xHi - (xHi - xLo) * 0.2);
        let n = 0, total = 0;
        for (let x = cX0; x <= cX1; x++) {
          if (isBridgeLikePixel(x, x - C)) n++;
          total++;
        }
        const waterNW = isWaterPx(xLo - 1, xLo - 1 - C) || isWaterPx(xLo - 2, xLo - 2 - C);
        const waterSE = isWaterPx(xHi + 1, xHi + 1 - C) || isWaterPx(xHi + 2, xHi + 2 - C);
        if ((total > 0 && n / total >= BRIDGE_EXTENT_THRESHOLD) || waterNW || waterSE) {
          if (C < minBC) minBC = C;
          if (C > maxBC) maxBC = C;
        }
      }
      if (!isFinite(minBC)) return fallback;
      const snapped = snapBridgeLength((maxBC - minBC) / (ppc * Math.SQRT2));
      const centerC = (minBC + maxBC) / 2;
      const halfC   = snapped * ppc * Math.SQRT2 / 2;
      return [
        Math.max(minX, Math.round(centerC - halfC + minY)),
        Math.max(minY, Math.round(minX - (centerC + halfC))),
        Math.min(maxX, Math.round(centerC + halfC + minY)),
        Math.min(maxY, Math.round(maxX - (centerC - halfC))),
      ];
    }

    return fallback;
  }

  const trimmedBboxPx = detectBridgeExtent(best.orient.rotation);
  return { orientation: best.orient, score: best.score, trimmedBboxPx };
}

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

  const blobAspect = blobW / blobH;
  const blobFillRatio = blob.area / (blobW * blobH);

  for (let ci = 0; ci < candidates.length; ci++) {
    const candidate = candidates[ci];
    if (candidate.orientations && candidate.orientations.length > 0) {
      // Orientation-aware: try each rotation and pick the best
      for (let oi = 0; oi < candidate.orientations.length; oi++) {
        const orient = candidate.orientations[oi];
        // Pre-filter: diagonal orientations (45°/135°) require an approximately square
        // bounding box and low fill ratio (the rotated bridge is diamond-shaped in its bbox,
        // filling ~50% of the area). Straight blobs have high fill ratios and non-square bboxes.
        if (orient.rotation === 45 || orient.rotation === 135) {
          if (blobAspect < 0.7 || blobAspect > 1.4) continue;  // Must be roughly square
          if (blobFillRatio > 0.65) continue;                    // Must have unfilled corners
        }
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
// ============ Stair Detection (custom stripe-pattern approach) ============

// Group ColorBlob[] by bounding-box proximity (union-find).
// Blobs whose bboxes are within gapPx on BOTH axes are placed in the same group.
function groupNearbyBlobs(blobs: ColorBlob[], gapPx: number): ColorBlob[][] {
  const parent = blobs.map((_, i) => i);
  function find(i: number): number {
    return parent[i] === i ? i : (parent[i] = find(parent[i]));
  }
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const a = blobs[i], b = blobs[j];
      const dx = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
      const dy = Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY));
      if (dx <= gapPx && dy <= gapPx) parent[find(i)] = find(j);
    }
  }
  const map = new Map<number, ColorBlob[]>();
  for (let i = 0; i < blobs.length; i++) {
    const r = find(i);
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(blobs[i]);
  }
  return Array.from(map.values());
}

// Scan a 1D luminance profile through a perpendicular slice of the image.
// isHorizontal=true  → scan along X (one sample per column).
// isHorizontal=false → scan along Y (one sample per row).
// At each position the average luma of a ±sliceHalfPx-wide cross-slice is recorded.
function buildStairBrightnessProfile(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  isHorizontal: boolean,
  scanStart: number,    // first pixel in the scan direction
  scanEnd: number,      // last pixel in the scan direction (inclusive)
  sliceCenter: number,  // centre pixel in the perpendicular direction
  sliceHalfPx: number,
): number[] {
  const profile: number[] = [];
  if (!isHorizontal) {
    // Scan along Y
    const left  = Math.max(0, Math.round(sliceCenter - sliceHalfPx));
    const right = Math.min(imageWidth - 1, Math.round(sliceCenter + sliceHalfPx));
    const w = right - left + 1;
    for (let y = Math.round(scanStart); y <= Math.round(scanEnd) && y < imageHeight; y++) {
      let sum = 0;
      for (let x = left; x <= right; x++) {
        const pi = (y * imageWidth + x) * 4;
        sum += data[pi] * 0.299 + data[pi + 1] * 0.587 + data[pi + 2] * 0.114;
      }
      profile.push(sum / w);
    }
  } else {
    // Scan along X
    const top = Math.max(0, Math.round(sliceCenter - sliceHalfPx));
    const bot = Math.min(imageHeight - 1, Math.round(sliceCenter + sliceHalfPx));
    const h = bot - top + 1;
    for (let x = Math.round(scanStart); x <= Math.round(scanEnd) && x < imageWidth; x++) {
      let sum = 0;
      for (let y = top; y <= bot; y++) {
        const pi = (y * imageWidth + x) * 4;
        sum += data[pi] * 0.299 + data[pi + 1] * 0.587 + data[pi + 2] * 0.114;
      }
      profile.push(sum / h);
    }
  }
  return profile;
}

// Count positions where adjacent luma values differ by more than brightnessThreshold.
function countBrightnessTransitions(profile: number[], brightnessThreshold: number): number {
  let t = 0;
  for (let i = 1; i < profile.length; i++)
    if (Math.abs(profile[i] - profile[i - 1]) > brightnessThreshold) t++;
  return t;
}

// Detect stair icons using a stripe-pattern approach instead of blob dilation.
// Each stair step forms its own small connected blob without dilation; we gate on
// step shape (1.8–2.2 × 0.6–1.1 coords), group nearby same-direction step blobs,
// then confirm the repeating stair/dark stripe pattern (≥10 transitions in 3 units).
async function detectStairs(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
): Promise<DetectMapIconsResult> {
  const ppc = extents.pixelsPerCoord;
  const stairTemplate = ICON_TEMPLATES.find(t => t.type === 'stairsStoneUp')!;
  const stairColor = stairTemplate.colors[0];
  const tolerance = stairTemplate.colorTolerance;
  const bbTolerance = stairTemplate.blockBoundaryTolerance;

  const STEP_LONG_MIN   = Math.round(1.8 * ppc);
  const STEP_LONG_MAX   = Math.round(2.2 * ppc);
  const STEP_SHORT_MIN  = Math.round(0.6 * ppc);
  const STEP_SHORT_MAX  = Math.round(1.6 * ppc);
  const GROUP_GAP_PX    = Math.round(1 * ppc);
  const SLICE_HALF_PX        = Math.round(1 * ppc);   // 2-unit wide cross-section slice
  const STAIR_SCAN_PX        = Math.round(4 * ppc);   // scan 4 units from each anchor edge
  const BRIGHTNESS_THRESHOLD = 25;                     // min luma delta; bright/dark gap ≥ 32
  const MIN_TRANSITIONS      = 6;                      // 3+ complete bright↔dark cycles
  const STAIR_BRIGHT_MIN     = 186;                    // midpoint: dark max ≈170, bright min ≈202

  // Step 1: raw blobs, no dilation
  const rawBlobs = findColorBlobs(
    data, imageWidth, imageHeight, extents,
    [stairColor], tolerance, 0, bbTolerance,
  );

  // Step 2: per-blob step gate — accept only blobs shaped like a single stair step.
  // Scan direction = direction of the SHORT (narrow) dimension (where steps repeat).
  //   Wide in X, narrow in Y → steps stack vertically → scan along Y (scanVertical=true)
  //   Wide in Y, narrow in X → steps stack horizontally → scan along X (scanVertical=false)
  type StepBlob = { blob: ColorBlob; scanVertical: boolean };
  type StairGroupDebug = {
    group: ColorBlob[];
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    scanVertical: boolean;
    transitions: number;
    accepted: boolean;
  };
  const stepBlobs: StepBlob[] = [];
  for (const blob of rawBlobs) {
    const w = blob.maxX - blob.minX + 1;
    const h = blob.maxY - blob.minY + 1;
    if (w >= STEP_LONG_MIN && w <= STEP_LONG_MAX && h >= STEP_SHORT_MIN && h <= STEP_SHORT_MAX) {
      stepBlobs.push({ blob, scanVertical: true });
    } else if (h >= STEP_LONG_MIN && h <= STEP_LONG_MAX && w >= STEP_SHORT_MIN && w <= STEP_SHORT_MAX) {
      stepBlobs.push({ blob, scanVertical: false });
    }
  }

  // Step 3: group nearby step blobs with the same scan direction
  const vBlobs = stepBlobs.filter(s =>  s.scanVertical).map(s => s.blob);
  const hBlobs = stepBlobs.filter(s => !s.scanVertical).map(s => s.blob);
  const allGroups = [
    ...groupNearbyBlobs(vBlobs, GROUP_GAP_PX).map(g => ({ blobs: g, scanVertical: true  })),
    ...groupNearbyBlobs(hBlobs, GROUP_GAP_PX).map(g => ({ blobs: g, scanVertical: false })),
  ];

  const icons: DetectedIcon[] = [];
  const blobDebug: BlobDebugEntry[] = [];
  const groupDebugResults: StairGroupDebug[] = [];

  for (let _gi = 0; _gi < allGroups.length; _gi++) {
    const { blobs: group, scanVertical } = allGroups[_gi];
    // Compute merged bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let area = 0;
    for (const b of group) {
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
      area += b.area;
    }
    const bbox = { minX, minY, maxX, maxY };
    const mergedBlob: ColorBlob = {
      pixels: new Set(group.flatMap(b => Array.from(b.pixels))),
      minX, minY, maxX, maxY, area,
    };

    // Step 4: brightness-based stripe test.
    // The anchor blob may sit at either end of the stair, so scan outward from BOTH
    // edges for STAIR_SCAN_PX pixels and take the direction with more transitions.
    //   Vertical (scanVertical=true):  upward from top edge, downward from bottom edge.
    //   Horizontal (scanVertical=false): leftward from left edge, rightward from right edge.
    const sliceCenter = scanVertical
      ? (bbox.minX + bbox.maxX) / 2   // vertical stairs: sample along a horizontal slice
      : (bbox.minY + bbox.maxY) / 2;  // horizontal stairs: sample along a vertical slice
    const isHoriz = !scanVertical;

    // Step 4: brightness-based stripe test + bounding-box extension.
    // Scan outward from BOTH edges of the anchor blob for up to 4 units.
    // The winning direction (more transitions) tells us where the steps are.
    // We also find the last pixel slice that reads as stair-bright to set the final bbox.
    type ScanResult = { transitions: number; profile: number[] };
    const scanEdge = (start: number, end: number): ScanResult => {
      const profile = buildStairBrightnessProfile(
        data, imageWidth, imageHeight, isHoriz, start, end, sliceCenter, SLICE_HALF_PX,
      );
      return { transitions: countBrightnessTransitions(profile, BRIGHTNESS_THRESHOLD), profile };
    };

    let transitions: number;
    let finalMinX = minX, finalMinY = minY, finalMaxX = maxX, finalMaxY = maxY;

    if (scanVertical) {
      const upStart  = Math.max(0, bbox.minY - STAIR_SCAN_PX);
      const downEnd  = Math.min(imageHeight - 1, bbox.maxY + STAIR_SCAN_PX);
      const upResult   = scanEdge(upStart, bbox.minY);
      const downResult = scanEdge(bbox.maxY, downEnd);

      if (downResult.transitions >= upResult.transitions) {
        transitions = downResult.transitions;
        // profile[0]=bbox.maxY, grows away from anchor → last bright index
        let lastBright = 0;
        for (let i = downResult.profile.length - 1; i >= 0; i--)
          if (downResult.profile[i] >= STAIR_BRIGHT_MIN) { lastBright = i; break; }
        finalMaxY = bbox.maxY + lastBright;
      } else {
        transitions = upResult.transitions;
        // profile[0]=upStart (far end), grows toward anchor → first bright index
        let firstBright = upResult.profile.length - 1;
        for (let i = 0; i < upResult.profile.length; i++)
          if (upResult.profile[i] >= STAIR_BRIGHT_MIN) { firstBright = i; break; }
        finalMinY = upStart + firstBright;
      }
    } else {
      const leftStart = Math.max(0, bbox.minX - STAIR_SCAN_PX);
      const rightEnd  = Math.min(imageWidth - 1, bbox.maxX + STAIR_SCAN_PX);
      const leftResult  = scanEdge(leftStart, bbox.minX);
      const rightResult = scanEdge(bbox.maxX, rightEnd);

      if (rightResult.transitions >= leftResult.transitions) {
        transitions = rightResult.transitions;
        let lastBright = 0;
        for (let i = rightResult.profile.length - 1; i >= 0; i--)
          if (rightResult.profile[i] >= STAIR_BRIGHT_MIN) { lastBright = i; break; }
        finalMaxX = bbox.maxX + lastBright;
      } else {
        transitions = leftResult.transitions;
        let firstBright = leftResult.profile.length - 1;
        for (let i = 0; i < leftResult.profile.length; i++)
          if (leftResult.profile[i] >= STAIR_BRIGHT_MIN) { firstBright = i; break; }
        finalMinX = leftStart + firstBright;
      }
    }

    const accepted = transitions >= MIN_TRANSITIONS;
    groupDebugResults.push({
      group,
      bbox: { minX: finalMinX, minY: finalMinY, maxX: finalMaxX, maxY: finalMaxY },
      scanVertical, transitions, accepted,
    });

    if (!accepted) {
      blobDebug.push({ colorGroup: 'stairs', blob: mergedBlob, accepted: false, rejectReason: 'stair-scan' });
      continue;
    }

    // Step 5: orientation match using the extended bbox that covers the full stair.
    const finalBlob: ColorBlob = {
      ...mergedBlob,
      minX: finalMinX, minY: finalMinY, maxX: finalMaxX, maxY: finalMaxY,
    };
    const { template: matchedTemplate, score: matchScore, orientation: matchedOrientation } =
      await matchBlobToTemplate(data, imageWidth, finalBlob, [stairTemplate]);

    blobDebug.push({ colorGroup: 'stairs', blob: finalBlob, accepted: true });

    const blobCX = (finalMinX + finalMaxX) / 2;
    const blobCY = (finalMinY + finalMaxY) / 2;
    icons.push({
      template: matchedTemplate,
      centerCoordX: (blobCX - extents.full.left) / ppc,
      centerCoordY: (blobCY - extents.full.top)  / ppc,
      blobCenterPx: [blobCX, blobCY],
      blobBBoxPx:   [finalMinX, finalMinY, finalMaxX, finalMaxY],
      confidence: matchScore,
      orientation: matchedOrientation,
      resolvedType:     matchedOrientation?.objectType     ?? matchedTemplate.type,
      resolvedCategory: matchedOrientation?.objectCategory ?? matchedTemplate.category,
      resolvedObjectSize: (matchedOrientation?.objectSize  ?? matchedTemplate.objectSizeInCoords) as [number, number],
    });
  }

  await saveStairStagesDebug(data, imageWidth, imageHeight, rawBlobs, stepBlobs, groupDebugResults);
  return { icons, blobDebug };
}

// When a blob fails single-icon validation but is large enough to contain 2 icons,
// try corner-based sub-icon detection: test each of the 4 bbox corners as a candidate
// icon-sized region, independently score them, and emit passing corners as candidates.
// Also emits a fill-only candidate so the merged blob gets terrain-filled regardless.
async function tryDetectSubIcons(
  blob: ColorBlob,
  group: IconTemplate[],
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  ppc: number,
  extents: IslandExtents,
  allCandidates: DetectedIcon[],
): Promise<void> {
  const scaleRatio = ppc / ICON_TEMPLATE_SCALE;
  const maxExpArea = Math.max(...group.map(t => t.opaqueArea * scaleRatio * scaleRatio));

  // Only attempt if the blob is large enough to potentially contain 2+ icons
  if (blob.area < maxExpArea * 1.2) return;

  const refTemplate = group[0];
  // Expected icon bbox size in pixels
  const iconW = Math.round(refTemplate.sizeInCoords[0] * ppc);
  const iconH = Math.round(refTemplate.sizeInCoords[1] * ppc);

  // 4 corner sub-regions, each icon-sized, anchored to the corners of the merged blob bbox
  const corners: Array<[number, number, number, number]> = [
    [blob.minX,          blob.minY,          blob.minX + iconW, blob.minY + iconH], // TL
    [blob.maxX - iconW,  blob.minY,          blob.maxX,         blob.minY + iconH], // TR
    [blob.minX,          blob.maxY - iconH,  blob.minX + iconW, blob.maxY],         // BL
    [blob.maxX - iconW,  blob.maxY - iconH,  blob.maxX,         blob.maxY],         // BR
  ];

  const matched: Array<{
    rMinX: number; rMinY: number; rMaxX: number; rMaxY: number;
    template: IconTemplate; confidence: number;
  }> = [];

  for (let _ci = 0; _ci < corners.length; _ci++) {
    const [rMinX, rMinY, rMaxX, rMaxY] = corners[_ci];
    // Rescan image data for dark pixels in this corner (avoids scan-space index bug)
    let area = 0;
    for (let y = Math.max(0, rMinY); y <= Math.min(imageHeight - 1, rMaxY); y++) {
      for (let x = Math.max(0, rMinX); x <= Math.min(imageWidth - 1, rMaxX); x++) {
        const i = (y * imageWidth + x) * 4;
        if (matchesAnyColor(
          { r: data[i], g: data[i + 1], b: data[i + 2] },
          refTemplate.colors,
          refTemplate.colorTolerance,
        )) area++;
      }
    }

    const subBlob: ColorBlob = {
      pixels: new Set(),  // unused by validateBlob / matchBlobToTemplate
      minX: rMinX, minY: rMinY, maxX: rMaxX, maxY: rMaxY, area,
    };

    let bestShapeConf = 0;
    for (const tmpl of group) {
      const c = validateBlob(subBlob, tmpl, ppc);
      if (c > bestShapeConf) bestShapeConf = c;
    }
    if (bestShapeConf < 0.2) continue;  // too weak, skip corner

    const { template: matchedTemplate, score: matchScore } =
      await matchBlobToTemplate(data, imageWidth, subBlob, group);
    const confidence = bestShapeConf * 0.4 + matchScore * 0.6;
    if (confidence < 0.35) continue;

    matched.push({ rMinX, rMinY, rMaxX, rMaxY, template: matchedTemplate, confidence });
  }

  // Deduplicate only if two corners have literally the same center pixel
  const deduped: typeof matched = [];
  for (const m of matched) {
    const cx = Math.round((m.rMinX + m.rMaxX) / 2);
    const cy = Math.round((m.rMinY + m.rMaxY) / 2);
    const duplicate = deduped.some(d =>
      Math.round((d.rMinX + d.rMaxX) / 2) === cx &&
      Math.round((d.rMinY + d.rMaxY) / 2) === cy,
    );
    if (!duplicate) deduped.push(m);
  }

  // Emit matched corner icons as normal candidates
  for (const { rMinX, rMinY, rMaxX, rMaxY, template: matchedTemplate, confidence } of deduped) {
    const blobCenterPxX = (rMinX + rMaxX) / 2;
    const blobCenterPxY = (rMinY + rMaxY) / 2;
    const { cx, cy } = pixelToIslandCoord(blobCenterPxX, blobCenterPxY, extents);
    allCandidates.push({
      template: matchedTemplate,
      centerCoordX: cx, centerCoordY: cy,
      blobCenterPx: [blobCenterPxX, blobCenterPxY],
      blobBBoxPx: [rMinX, rMinY, rMaxX, rMaxY],
      confidence,
    });
  }

  if (deduped.length > 0) {
    console.log(`  Corner sub-icon: found ${deduped.map(d => d.template.name).join(', ')}`);
  }

  // Fill fallback: emit a fill-only candidate using the original merged blob bbox so the
  // dark brown region gets terrain-filled even if icon identity couldn't be determined.
  // Prefer a template without tanRoundedRectFill to avoid incorrect tan area fill.
  const fillTemplate = group.find(t => !t.tanRoundedRectFill) ?? group[0];
  const blobCenterPxX = (blob.minX + blob.maxX) / 2;
  const blobCenterPxY = (blob.minY + blob.maxY) / 2;
  const { cx, cy } = pixelToIslandCoord(blobCenterPxX, blobCenterPxY, extents);
  allCandidates.push({
    template: fillTemplate,
    centerCoordX: cx, centerCoordY: cy,
    blobCenterPx: [blobCenterPxX, blobCenterPxY],
    blobBBoxPx: [blob.minX, blob.minY, blob.maxX, blob.maxY],
    confidence: 0.1,
    fillOnly: true,
  });
}

// After all icon fills are complete, find the orange building-indicator icon
// (a playerhouse/house/tent recolored to #F78721 orange + #FFE952 yellow interior)
// anywhere on the map and fill it with terrain color.
async function detectAndFillBuildingIndicator(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
  grid: PixelGrid,
): Promise<void> {
  const ORANGE: RGB = { r: 0xF7, g: 0x87, b: 0x21 };  // #F78721
  const YELLOW: RGB = { r: 0xFF, g: 0xE9, b: 0x52 };  // #FFE952
  const INITIAL_TOL = 35;
  const PERMISSIVE_TOL = 100;
  const ppc = extents.pixelsPerCoord;
  const dx4 = [0, 0, -1, 1];
  const dy4 = [-1, 1, 0, 0];

  // Find blobs of orange/yellow color anywhere on the map
  const blobs = findColorBlobs(
    data, imageWidth, imageHeight, extents,
    [ORANGE, YELLOW], INITIAL_TOL,
  );

  type Candidate = { pixels: Set<number>; minX: number; maxX: number; minY: number; maxY: number };
  const candidates: Candidate[] = [];

  for (const blob of blobs) {
    // blob.pixels uses scan-space indices — rescan bbox in image-space directly
    const seedPixels = new Set<number>();
    for (let sy = blob.minY; sy <= blob.maxY; sy++) {
      for (let sx = blob.minX; sx <= blob.maxX; sx++) {
        if (sx < 0 || sx >= imageWidth || sy < 0 || sy >= imageHeight) continue;
        const pixel = getPixelAt(data, imageWidth, sx, sy);
        if (matchesAnyColor(pixel, [ORANGE, YELLOW], INITIAL_TOL)) {
          seedPixels.add(sy * imageWidth + sx);
        }
      }
    }
    if (seedPixels.size === 0) continue;

    // BFS-expand with permissive tolerance to capture yellow interior + transitions
    let minX = blob.minX, maxX = blob.maxX, minY = blob.minY, maxY = blob.maxY;
    const expandedPixels = new Set<number>(seedPixels);
    const bfsQueue: number[] = [...seedPixels];
    for (let qi = 0; qi < bfsQueue.length; qi++) {
      const idx = bfsQueue[qi];
      const px = idx % imageWidth;
      const py = Math.floor(idx / imageWidth);
      for (let d = 0; d < 4; d++) {
        const nx = px + dx4[d];
        const ny = py + dy4[d];
        if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
        const nIdx = ny * imageWidth + nx;
        if (expandedPixels.has(nIdx)) continue;
        const npx = getPixelAt(data, imageWidth, nx, ny);
        if (matchesAnyColor(npx, [ORANGE, YELLOW], PERMISSIVE_TOL)) {
          expandedPixels.add(nIdx);
          bfsQueue.push(nIdx);
          if (nx < minX) minX = nx;
          if (nx > maxX) maxX = nx;
          if (ny < minY) minY = ny;
          if (ny > maxY) maxY = ny;
        }
      }
    }

    // Filter by bbox size in island coords (must be between 3×3 and 8×8)
    const bboxWCoords = (maxX - minX + 1) / ppc;
    const bboxHCoords = (maxY - minY + 1) / ppc;
    if (bboxWCoords < 3 || bboxHCoords < 3 || bboxWCoords > 8 || bboxHCoords > 8) continue;

    candidates.push({ pixels: expandedPixels, minX, maxX, minY, maxY });
  }

  // Helper: save a pixel-data canvas snapshot as a debug image
  const savePixelSnapshot = async (label: string) => {
    const snap = document.createElement('canvas');
    snap.width = imageWidth;
    snap.height = imageHeight;
    const snapCtx = snap.getContext('2d')!;
    const snapData = snapCtx.createImageData(imageWidth, imageHeight);
    snapData.data.set(data);
    snapCtx.putImageData(snapData, 0, 0);
    return { canvas: snap, ctx: snapCtx };
  };

  // debug_13b: detection overlay (always saved, even if no candidates found)
  const { canvas: dbgCanvas, ctx: dbgCtx } = await savePixelSnapshot('13b');

  if (candidates.length === 0) {
    console.log('Building indicator: not found');
    await downloadCanvas(dbgCanvas, 'debug_13b_building_indicator_detection.png');
    return;
  }

  // Pick the largest candidate by pixel count
  const best = candidates.reduce((a, b) => a.pixels.size >= b.pixels.size ? a : b);
  console.log(`Building indicator: found ${best.pixels.size}px, bbox ${((best.maxX - best.minX + 1) / ppc).toFixed(1)}×${((best.maxY - best.minY + 1) / ppc).toFixed(1)} coords`);

  // Draw candidate bboxes on debug image
  for (const c of candidates) {
    const isBest = c === best;
    dbgCtx.strokeStyle = isBest ? 'red' : 'blue';
    dbgCtx.lineWidth = 2;
    dbgCtx.strokeRect(c.minX, c.minY, c.maxX - c.minX, c.maxY - c.minY);
    dbgCtx.fillStyle = isBest ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,255,0.2)';
    dbgCtx.fillRect(c.minX, c.minY, c.maxX - c.minX, c.maxY - c.minY);
  }
  await downloadCanvas(dbgCanvas, 'debug_13b_building_indicator_detection.png');

  // Sample surrounding terrain level
  const grassSamples: RGB[] = [];
  for (const linearIdx of best.pixels) {
    const px = linearIdx % imageWidth;
    const py = Math.floor(linearIdx / imageWidth);
    for (let d = 0; d < 4; d++) {
      const nx = px + dx4[d];
      const ny = py + dy4[d];
      if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
      const nIdx = ny * imageWidth + nx;
      if (best.pixels.has(nIdx)) continue;
      const npx = getPixelAt(data, imageWidth, nx, ny);
      if (isScreenshotGrass(npx)) grassSamples.push(npx);
    }
  }
  const fillLevel = resolveGrassLevel(grassSamples);
  const paintColor = terrainLevelToColor(fillLevel);

  // Paint pixels in the image data
  for (const linearIdx of best.pixels) {
    const dataIdx = linearIdx * 4;
    data[dataIdx]     = paintColor.r;
    data[dataIdx + 1] = paintColor.g;
    data[dataIdx + 2] = paintColor.b;
  }

  // debug_13c: post-fill snapshot
  const postCanvas = document.createElement('canvas');
  postCanvas.width = imageWidth;
  postCanvas.height = imageHeight;
  const postCtx = postCanvas.getContext('2d')!;
  const postData = postCtx.createImageData(imageWidth, imageHeight);
  postData.data.set(data);
  postCtx.putImageData(postData, 0, 0);
  await downloadCanvas(postCanvas, 'debug_13c_post_building_indicator_fill.png');

  // Update grid for the bbox region
  const { cx: gMinXf, cy: gMinYf } = pixelToIslandCoord(best.minX, best.minY, extents);
  const { cx: gMaxXf, cy: gMaxYf } = pixelToIslandCoord(best.maxX, best.maxY, extents);
  const gx0 = Math.max(0, Math.floor(gMinXf));
  const gy0 = Math.max(0, Math.floor(gMinYf));
  const gx1 = Math.min(ISLAND_COORD_WIDTH, Math.ceil(gMaxXf));
  const gy1 = Math.min(ISLAND_COORD_HEIGHT, Math.ceil(gMaxYf));
  for (let y = gy0; y <= gy1; y++) {
    for (let x = gx0; x <= gx1; x++) {
      const idx = y * ISLAND_COORD_WIDTH + x;
      grid.primary[idx] = fillLevel;
      grid.diagonal[idx] = DIAGONAL.NONE;
      grid.secondary[idx] = TERRAIN.UNKNOWN;
    }
  }
}

// Groups templates by primary color, runs blob detection once per group,
// uses template matching to differentiate same-color icons,
// then applies placement constraints (row, uniqueness, non-overlap).
async function detectMapIcons(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
  grid: PixelGrid,
  includeOnlyColorKeys?: Set<string>,  // If set, only detect these color groups
  excludeColorKeys?: Set<string>,       // If set, skip these color groups
): Promise<DetectMapIconsResult> {
  let allCandidates: DetectedIcon[] = [];
  const blobDebug: BlobDebugEntry[] = [];
  const ppc = extents.pixelsPerCoord;

  // Color keys for stairs and bridge groups (used to tag blob debug entries)
  const STAIRS_COLOR_KEY = colorKey({ r: 0xF5, g: 0xDE, b: 0x99 });
  const BRIDGE_COLOR_KEY = colorKey({ r: 0x7F, g: 0x82, b: 0x67 });

  // Group templates by primary color
  const colorGroups = new Map<string, IconTemplate[]>();
  for (const tmpl of ICON_TEMPLATES) {
    const key = colorKey(tmpl.colors[0]);
    const group = colorGroups.get(key) || [];
    group.push(tmpl);
    colorGroups.set(key, group);
  }

  // Phase 1: Collect all candidate detections (no grid clearing yet)
  const colorGroupEntries = Array.from(colorGroups.entries());
  for (let _cgi = 0; _cgi < colorGroupEntries.length; _cgi++) {
    const [key, group] = colorGroupEntries[_cgi];
    // Apply color group filters
    if (includeOnlyColorKeys && !includeOnlyColorKeys.has(key)) continue;
    if (excludeColorKeys?.has(key)) continue;

    const groupName = group.length === 1
      ? group[0].name
      : group.map(t => t.name).join('/');
    console.log(`Generate from Screenshot: detecting ${groupName} (color ${key})...`);

    const refTemplate = group[0];
    const groupDilationRadius = Math.max(
      ...group.map(t => t.maskDilationRadius ?? 0),
      ...group.map(t => Math.ceil((t.maskDilationRadiusCoords ?? 0) * ppc)),
    );
    // Elevated tolerance near block boundary gridlines (bridges/stairs only)
    const groupBlockBoundaryTolerance = group.reduce<number | undefined>(
      (acc, t) => t.blockBoundaryTolerance !== undefined
        ? Math.max(acc ?? 0, t.blockBoundaryTolerance)
        : acc,
      undefined,
    );
    const blobs = findColorBlobs(
      data, imageWidth, imageHeight, extents,
      refTemplate.colors, refTemplate.colorTolerance,
      groupDilationRadius,
      groupBlockBoundaryTolerance,
      refTemplate.maxSaturation,
    );
    console.log(`  Found ${blobs.length} blobs for color group (dilation=${groupDilationRadius}px)`);

    // Identify if this group is stairs or bridges for blob debug tracking
    const blobDebugGroup: 'stairs' | 'bridges' | null =
      key === STAIRS_COLOR_KEY ? 'stairs' :
      key === BRIDGE_COLOR_KEY ? 'bridges' :
      null;

    for (let _bi = 0; _bi < blobs.length; _bi++) {
      const blob = blobs[_bi];
      if (group.length === 1 && !refTemplate.orientations) {
        // Single template, no orientation variants — simple path
        const confidence = validateBlob(blob, refTemplate, ppc);
        if (confidence < 0.4) {
          await tryDetectSubIcons(blob, [refTemplate], data, imageWidth, imageHeight, ppc, extents, allCandidates);
          if (blobDebugGroup) blobDebug.push({ colorGroup: blobDebugGroup, blob, accepted: false, rejectReason: 'shape' });
          continue;
        }

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
        if (blobDebugGroup) blobDebug.push({ colorGroup: blobDebugGroup, blob, accepted: true });

        console.log(
          `  ${refTemplate.name} at (${cx.toFixed(1)}, ${cy.toFixed(1)}) ` +
          `conf=${(confidence * 100).toFixed(0)}% blob=${blob.area}px`,
        );
        continue;
      }

      // Multi-template group OR single template with orientations: use template matching
      let bestShapeConfidence = 0;
      let bestTemplate = group[0];
      for (const tmpl of group) {
        const c = validateBlob(blob, tmpl, ppc);
        if (c > bestShapeConfidence) { bestShapeConfidence = c; bestTemplate = tmpl; }
      }
      if (bestShapeConfidence < 0.3) {
        await tryDetectSubIcons(blob, group, data, imageWidth, imageHeight, ppc, extents, allCandidates);
        if (blobDebugGroup) blobDebug.push({ colorGroup: blobDebugGroup, blob, accepted: false, rejectReason: 'shape' });
        continue;
      }

      let matchedTemplate: IconTemplate;
      let matchScore: number;
      let matchedOrientation: OrientationVariant | undefined;
      let trimmedBboxPx: [number, number, number, number] = [blob.minX, blob.minY, blob.maxX, blob.maxY];

      if (key === BRIDGE_COLOR_KEY && bestTemplate.orientations && bestTemplate.orientations.length > 0) {
        // Bridge blobs: use structural railing check instead of template-image pixel matching
        const structResult = structurallyScanBridgeOrientation(
          data, imageWidth, imageHeight, blob, bestTemplate.orientations, extents,
        );
        if (!structResult) {
          if (blobDebugGroup) blobDebug.push({ colorGroup: blobDebugGroup, blob, accepted: false, rejectReason: 'struct' });
          continue;
        }
        matchedTemplate = bestTemplate;
        matchScore = structResult.score;
        matchedOrientation = structResult.orientation;
        trimmedBboxPx = structResult.trimmedBboxPx;
      } else {
        const result = await matchBlobToTemplate(data, imageWidth, blob, group);
        matchedTemplate = result.template;
        matchScore = result.score;
        matchedOrientation = result.orientation;
      }

      const confidence = bestShapeConfidence * 0.4 + matchScore * 0.6;
      if (confidence < 0.4) {
        await tryDetectSubIcons(blob, group, data, imageWidth, imageHeight, ppc, extents, allCandidates);
        if (blobDebugGroup) blobDebug.push({ colorGroup: blobDebugGroup, blob, accepted: false, rejectReason: 'conf' });
        continue;
      }

      const blobCenterPxX = (trimmedBboxPx[0] + trimmedBboxPx[2]) / 2;
      const blobCenterPxY = (trimmedBboxPx[1] + trimmedBboxPx[3]) / 2;
      const { cx, cy } = pixelToIslandCoord(blobCenterPxX, blobCenterPxY, extents);

      const detected: DetectedIcon = {
        template: matchedTemplate,
        centerCoordX: cx,
        centerCoordY: cy,
        blobCenterPx: [blobCenterPxX, blobCenterPxY],
        blobBBoxPx: trimmedBboxPx,
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
      if (blobDebugGroup) blobDebug.push({ colorGroup: blobDebugGroup, blob, accepted: true });

      const orientLabel = matchedOrientation ? ` orient=${matchedOrientation.rotation}°` : '';
      console.log(
        `  ${matchedTemplate.name} at (${cx.toFixed(1)}, ${cy.toFixed(1)}) ` +
        `conf=${(confidence * 100).toFixed(0)}% match=${(matchScore * 100).toFixed(0)}%${orientLabel} blob=${blob.area}px`,
      );
    }

    // Supplemental pass: seed blobs from auxiliary colors (e.g. white icon interior),
    // expand BFS to include adjacent primary-color pixels, then validate+match as usual.
    // This helps detect dark-circle icons where dark-brown pixels are sparse/indistinct.
    // Build deduplicated auxiliary color list without Map.values() spread (Babel ES5 can't spread MapIterator)
    const auxColorsSeen = new Set<string>();
    const auxColors: RGB[] = [];
    for (const t of group) {
      for (const c of (t.auxiliaryBlobColors ?? [])) {
        const k = `${c.r},${c.g},${c.b}`;
        if (!auxColorsSeen.has(k)) { auxColorsSeen.add(k); auxColors.push(c); }
      }
    }
    const auxTol = group.reduce<number>((acc, t) => Math.max(acc, t.auxiliaryBlobColorTolerance ?? 25), 0);

    if (auxColors.length > 0) {
      const auxBlobs = findColorBlobs(data, imageWidth, imageHeight, extents, auxColors, auxTol, 0);
      console.log(`  Supplemental aux blobs: ${auxBlobs.length} (seeded from white interior)`);
      const dx4Aux = [0, 0, -1, 1], dy4Aux = [-1, 1, 0, 0];
      const minExpected = Math.min(...group.map(t => Math.min(...t.sizeInCoords)));
      const maxExpected = Math.max(...group.map(t => Math.max(...t.sizeInCoords)));

      for (let _ai = 0; _ai < auxBlobs.length; _ai++) {
        const auxBlob = auxBlobs[_ai];
        // Size filter: must be plausibly in range for a template in this group
        const bboxW = (auxBlob.maxX - auxBlob.minX + 1) / ppc;
        const bboxH = (auxBlob.maxY - auxBlob.minY + 1) / ppc;
        if (bboxW < minExpected * 0.3 || bboxH < minExpected * 0.3) continue;
        if (bboxW > maxExpected * 2.0 || bboxH > maxExpected * 2.0) continue;

        // Seed merged blob from aux blob bbox in image-space (avoid scan-space index issue)
        const mergedPixels = new Set<number>();
        let mMinX = auxBlob.minX, mMaxX = auxBlob.maxX, mMinY = auxBlob.minY, mMaxY = auxBlob.maxY;
        for (let sy = auxBlob.minY; sy <= auxBlob.maxY; sy++) {
          for (let sx = auxBlob.minX; sx <= auxBlob.maxX; sx++) {
            if (sx < 0 || sx >= imageWidth || sy < 0 || sy >= imageHeight) continue;
            if (matchesAnyColor(getPixelAt(data, imageWidth, sx, sy), auxColors, auxTol))
              mergedPixels.add(sy * imageWidth + sx);
          }
        }
        if (mergedPixels.size === 0) continue;

        // BFS expand to adjacent primary-color (dark brown) or aux-color pixels
        const bfsQ = [...mergedPixels];
        for (let qi = 0; qi < bfsQ.length; qi++) {
          const idx = bfsQ[qi];
          const bpx = idx % imageWidth, bpy = Math.floor(idx / imageWidth);
          for (let d = 0; d < 4; d++) {
            const nx = bpx + dx4Aux[d], ny = bpy + dy4Aux[d];
            if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
            const nIdx = ny * imageWidth + nx;
            if (mergedPixels.has(nIdx)) continue;
            const npx = getPixelAt(data, imageWidth, nx, ny);
            if (matchesAnyColor(npx, refTemplate.colors, refTemplate.colorTolerance) ||
                matchesAnyColor(npx, auxColors, auxTol)) {
              mergedPixels.add(nIdx);
              bfsQ.push(nIdx);
              if (nx < mMinX) mMinX = nx; if (nx > mMaxX) mMaxX = nx;
              if (ny < mMinY) mMinY = ny; if (ny > mMaxY) mMaxY = ny;
            }
          }
        }

        const mergedBlob: ColorBlob = {
          pixels: mergedPixels, minX: mMinX, maxX: mMaxX, minY: mMinY, maxY: mMaxY,
          area: mergedPixels.size,
        };
        const mCX = (mMinX + mMaxX) / 2, mCY = (mMinY + mMaxY) / 2;
        const { cx: mCx, cy: mCy } = pixelToIslandCoord(mCX, mCY, extents);

        if (group.length === 1 && !refTemplate.orientations) {
          const confidence = validateBlob(mergedBlob, refTemplate, ppc);
          if (confidence < 0.4) {
            await tryDetectSubIcons(mergedBlob, [refTemplate], data, imageWidth, imageHeight, ppc, extents, allCandidates);
            continue;
          }
          console.log(`  [aux] ${refTemplate.name} at (${mCx.toFixed(1)}, ${mCy.toFixed(1)}) conf=${(confidence * 100).toFixed(0)}% blob=${mergedBlob.area}px`);
          allCandidates.push({
            template: refTemplate, centerCoordX: mCx, centerCoordY: mCy,
            blobCenterPx: [mCX, mCY], blobBBoxPx: [mMinX, mMinY, mMaxX, mMaxY], confidence,
          });
        } else {
          // Multi-template: pick best by shape+match confidence
          const shapePassed = group.filter(t => validateBlob(mergedBlob, t, ppc) >= 0.3);
          let bestConf = 0, bestTmpl: IconTemplate | null = null;
          if (shapePassed.length > 0) {
            const matchResult = await matchBlobToTemplate(data, imageWidth, mergedBlob, shapePassed);
            const sc = validateBlob(mergedBlob, matchResult.template, ppc);
            bestConf = sc * 0.3 + matchResult.score * 0.7;
            bestTmpl = matchResult.template;
          }
          if (bestConf < 0.4 || !bestTmpl) {
            await tryDetectSubIcons(mergedBlob, group, data, imageWidth, imageHeight, ppc, extents, allCandidates);
            continue;
          }
          console.log(`  [aux] ${bestTmpl.name} at (${mCx.toFixed(1)}, ${mCy.toFixed(1)}) conf=${(bestConf * 100).toFixed(0)}% blob=${mergedBlob.area}px`);
          allCandidates.push({
            template: bestTmpl, centerCoordX: mCx, centerCoordY: mCy,
            blobCenterPx: [mCX, mCY], blobBBoxPx: [mMinX, mMinY, mMaxX, mMaxY], confidence: bestConf,
          });
        }
      }
    }
  }

  console.log(`Generate from Screenshot: ${allCandidates.length} candidates before constraints`);

  // Phase 2: Apply placement constraints

  // 2a. Row constraints
  const AMENITY_ROW_TYPES = new Set([
    'townhallSprite', 'center', 'ableSprite', 'museumSprite', 'nookSprite', 'tentSprite',
  ]);
  allCandidates = allCandidates.filter(icon => {
    if (icon.fillOnly) return true;  // fill-only: bypass all placement constraints
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
  type BridgeSliceResult = { pos: number; water: boolean };
  type BridgeWaterSide = { slices: BridgeSliceResult[]; passed: boolean };
  type BridgeWaterEntry = {
    icon: DetectedIcon;
    sideA: BridgeWaterSide;
    sideB: BridgeWaterSide;
    accepted: boolean;
  };
  const bridgeWaterDebug: BridgeWaterEntry[] = [];

  allCandidates = allCandidates.filter(icon => {
    if (!icon.template.requiresWaterAdjacency || !icon.orientation) return true;

    const rotation = icon.orientation.rotation;
    const isStraightBridge = rotation === 0 || rotation === 90 || rotation === 180 || rotation === 270;
    const [rawBMinX, rawBMinY, rawBMaxX, rawBMaxY] = icon.blobBBoxPx;
    const bMinX = isStraightBridge ? snapToGrid(rawBMinX, extents) : rawBMinX;
    const bMinY = isStraightBridge ? snapToGrid(rawBMinY, extents) : rawBMinY;
    const bMaxX = isStraightBridge ? snapToGrid(rawBMaxX, extents) : rawBMaxX;
    const bMaxY = isStraightBridge ? snapToGrid(rawBMaxY, extents) : rawBMaxY;

    const BRIDGE_SLICE_INSIDE_PX = 2;
    const BRIDGE_SLICE_OUTSIDE_PX = 4;
    const BRIDGE_SLICE_WATER_THRESHOLD = 0.5;

    let sideAResult: BridgeWaterSide | null = null;
    let sideBResult: BridgeWaterSide | null = null;

    if (rotation === 0 || rotation === 180) {
      // Vertical bridge (N-S): slices are full-height columns, water left/right
      const checkColumn = (x: number): boolean => {
        if (x < 0 || x >= imageWidth) return false;
        let n = 0, total = 0;
        for (let y = bMinY; y <= bMaxY; y++) {
          if (y < 0 || y >= imageHeight) continue;
          const idx = (y * imageWidth + x) * 4;
          if (matchesAnyColor({ r: data[idx], g: data[idx + 1], b: data[idx + 2] }, SCREENSHOT_COLORS.WATER, 40)) n++;
          total++;
        }
        return total > 0 && n / total >= BRIDGE_SLICE_WATER_THRESHOLD;
      };
      const slicesA: BridgeSliceResult[] = [];
      for (let x = bMinX + BRIDGE_SLICE_INSIDE_PX; x >= bMinX - BRIDGE_SLICE_OUTSIDE_PX; x--) {
        slicesA.push({ pos: x, water: checkColumn(x) });
      }
      const slicesB: BridgeSliceResult[] = [];
      for (let x = bMaxX - BRIDGE_SLICE_INSIDE_PX; x <= bMaxX + BRIDGE_SLICE_OUTSIDE_PX; x++) {
        slicesB.push({ pos: x, water: checkColumn(x) });
      }
      sideAResult = { slices: slicesA, passed: slicesA.some(s => s.water) };
      sideBResult = { slices: slicesB, passed: slicesB.some(s => s.water) };

    } else if (rotation === 90 || rotation === 270) {
      // Horizontal bridge (E-W): slices are full-width rows, water top/bottom
      const checkRow = (y: number): boolean => {
        if (y < 0 || y >= imageHeight) return false;
        let n = 0, total = 0;
        for (let x = bMinX; x <= bMaxX; x++) {
          if (x < 0 || x >= imageWidth) continue;
          const idx = (y * imageWidth + x) * 4;
          if (matchesAnyColor({ r: data[idx], g: data[idx + 1], b: data[idx + 2] }, SCREENSHOT_COLORS.WATER, 40)) n++;
          total++;
        }
        return total > 0 && n / total >= BRIDGE_SLICE_WATER_THRESHOLD;
      };
      const slicesA: BridgeSliceResult[] = [];
      for (let y = bMinY + BRIDGE_SLICE_INSIDE_PX; y >= bMinY - BRIDGE_SLICE_OUTSIDE_PX; y--) {
        slicesA.push({ pos: y, water: checkRow(y) });
      }
      const slicesB: BridgeSliceResult[] = [];
      for (let y = bMaxY - BRIDGE_SLICE_INSIDE_PX; y <= bMaxY + BRIDGE_SLICE_OUTSIDE_PX; y++) {
        slicesB.push({ pos: y, water: checkRow(y) });
      }
      sideAResult = { slices: slicesA, passed: slicesA.some(s => s.water) };
      sideBResult = { slices: slicesB, passed: slicesB.some(s => s.water) };

    } else {
      // Diagonal bridges (45°/135°): walk along the bridge axis, check perpendicular
      // "columns" at various distances from center, mirroring the column/row approach
      // used for straight bridges. Each column runs the full axis length at a fixed
      // perpendicular offset d from center, ranging from inside to outside the estimated edge.
      const ppc = extents.pixelsPerCoord;
      const diagLen = Math.min(bMaxX - bMinX, bMaxY - bMinY);
      // Bridge half-width in perpendicular steps (each step = √2 px)
      const halfWidthSteps = Math.round((1.85 * ppc / 2) / Math.SQRT2);

      // Axis direction and perpendicular direction
      let ax0X: number, axDX: number;
      let perpDX: number, perpDY: number;
      if (rotation === 45) {
        // TLBR: axis (+1,+1) from top-left, perp NE=(+1,-1)
        ax0X = bMinX; axDX = 1;
        perpDX = 1; perpDY = -1;
      } else {
        // TRBL: axis (-1,+1) from top-right, perp NW=(-1,-1)
        ax0X = bMaxX; axDX = -1;
        perpDX = -1; perpDY = -1;
      }

      const checkColumn = (d: number, side: 1 | -1): boolean => {
        // side=+1 for sideA (NE/NW), side=-1 for sideB (SW/SE)
        let n = 0, total = 0;
        for (let i = 0; i <= diagLen; i++) {
          const cx = ax0X + axDX * i;
          const cy = bMinY + i;
          const px = cx + side * perpDX * d;
          const py = cy + side * perpDY * d;
          if (px < 0 || py < 0 || px >= imageWidth || py >= imageHeight) continue;
          const idx = (py * imageWidth + px) * 4;
          if (matchesAnyColor({ r: data[idx], g: data[idx + 1], b: data[idx + 2] }, SCREENSHOT_COLORS.WATER, 40)) n++;
          total++;
        }
        return total > 0 && n / total >= BRIDGE_SLICE_WATER_THRESHOLD;
      };

      const slicesA: BridgeSliceResult[] = [];
      const slicesB: BridgeSliceResult[] = [];
      for (let d = halfWidthSteps - BRIDGE_SLICE_INSIDE_PX; d <= halfWidthSteps + BRIDGE_SLICE_OUTSIDE_PX; d++) {
        slicesA.push({ pos: d, water: checkColumn(d, 1) });
        slicesB.push({ pos: d, water: checkColumn(d, -1) });
      }
      sideAResult = { slices: slicesA, passed: slicesA.some(s => s.water) };
      sideBResult = { slices: slicesB, passed: slicesB.some(s => s.water) };
    }

    const accepted = sideAResult.passed && sideBResult.passed;
    if (!accepted) {
      console.log(
        `  Constraint: rejected ${icon.template.name} at ` +
        `(${icon.centerCoordX.toFixed(1)}, ${icon.centerCoordY.toFixed(1)}) ` +
        `(water adjacency: A:${sideAResult.passed ? 'OK' : 'FAIL'} B:${sideBResult.passed ? 'OK' : 'FAIL'})`,
      );
    }
    bridgeWaterDebug.push({ icon, sideA: sideAResult, sideB: sideBResult, accepted });
    return accepted;
  });
  await saveBridgeWaterDebug(data, imageWidth, imageHeight, bridgeWaterDebug);

  // 2b. Uniqueness: keep highest-confidence per type, respecting maxCount from templates
  const typeMaxCounts = new Map<string, number>();
  for (const tmpl of ICON_TEMPLATES) {
    const mc = tmpl.maxCount ?? 1;
    typeMaxCounts.set(tmpl.type, Math.max(typeMaxCounts.get(tmpl.type) ?? 1, mc));
  }
  const typeGroups = new Map<string, DetectedIcon[]>();
  const fillOnlyCandidates: DetectedIcon[] = [];
  for (const icon of allCandidates) {
    if (icon.fillOnly) { fillOnlyCandidates.push(icon); continue; }  // bypass uniqueness
    const key = icon.template.type;
    if (!typeGroups.has(key)) typeGroups.set(key, []);
    typeGroups.get(key)!.push(icon);
  }
  const filtered: DetectedIcon[] = [...fillOnlyCandidates];
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
    if (icon.fillOnly) { accepted.push(icon); continue; }  // bypass overlap check
    const fp = getFootprint(icon);
    const overlaps = accepted.some(a => {
      if (a.fillOnly) return false;  // fill-only don't block others
      const afp = getFootprint(a);
      const xOverlap = Math.min(fp.x1, afp.x1) - Math.max(fp.x0, afp.x0);
      const yOverlap = Math.min(fp.y1, afp.y1) - Math.max(fp.y0, afp.y0);
      if (xOverlap <= 0 || yOverlap <= 0) return false;  // No intersection
      // Allow up to allowedOverlap units in each axis (for large circle amenity icons)
      const allowed = Math.max(icon.template.allowedOverlap ?? 0, a.template.allowedOverlap ?? 0);
      return xOverlap > allowed || yOverlap > allowed;
    });
    if (overlaps) {
      console.log(`  Constraint: rejected ${icon.template.name} at (${icon.centerCoordX.toFixed(1)}, ${icon.centerCoordY.toFixed(1)}) (overlap)`);
      continue;
    }
    accepted.push(icon);
  }

  // Phase 3: Clear grid regions for accepted icons only
  for (const icon of accepted) {
    if (icon.fillOnly) continue;  // fill-only: don't clear grid (no object placed)
    const [objW, objH] = icon.resolvedObjectSize ?? icon.template.objectSizeInCoords;
    const topLeftX = Math.round(icon.centerCoordX - objW / 2);
    const topLeftY = Math.round(icon.centerCoordY - objH / 2);
    clearGridRegion(grid, topLeftX, topLeftY, objW, objH);
  }

  console.log(`Generate from Screenshot: ${accepted.length} icons after constraints`);
  return { icons: accepted, blobDebug };
}

// Convert detected icons to the v2 object groups format:
// { 'category_type': [x1, y1, x2, y2, ...] }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function detectedIconsToObjectGroups(
  icons: DetectedIcon[],
): Record<string, number[]> {
  const groups: Record<string, number[]> = {};
  for (const icon of icons) {
    if (icon.fillOnly) continue;
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

// Debug output: draw detected icons on the screenshot.
// If preprocessedData is provided it is used as the canvas base instead of the original image,
// which is useful for Pass 2 where icons and gridlines have already been removed from the pixel data.
async function saveIconDetectionDebug(
  image: HTMLImageElement,
  extents: IslandExtents,
  detectedIcons: DetectedIcon[],
  filename: string,
  preprocessedData?: Uint8ClampedArray,
): Promise<void> {
  if (skipDebug) return;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  if (preprocessedData) {
    canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(image.width, image.height);
    imageData.data.set(preprocessedData);
    ctx.putImageData(imageData, 0, 0);
  } else {
    ({ canvas, ctx } = createDebugCanvas(image));
  }
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

  await downloadCanvas(canvas, filename);
}

// Remove the white dotted gridline overlay from raw pixel data by detecting
// brightness increases at expected block-boundary positions and applying the
// inverse of the 25%-opacity white composite formula.
// Returns a bitmask (1 = pixel was corrected) for debug visualization.
function removeGridlineOverlay(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
): Uint8Array {
  const ppc = extents.pixelsPerCoord;
  // Pattern geometry: 8 dashes per 16-coord block, 2:1 dash:gap ratio
  const PERIOD_COORDS = 2, DASH_FRACTION = 2 / 3;
  const PERIOD_PX = PERIOD_COORDS * ppc;
  const DASH_PX   = DASH_FRACTION * PERIOD_PX;
  // Detection constants
  const PERP_OFFSET      = 4;  // px perpendicular to line for baseline sample
  const SEARCH_HALF_WIDTH = 2; // ±px to search for distortion-shifted line centre
  const LINE_HALF_WIDTH  = 1;  // px on each side of detected centre to correct
  const EDGE_ZONE        = 1;  // extend dash gate by this many px for antialiased edges
  const MIN_SURPLUS      = 8;  // brightness surplus threshold (full dash)
  const GAP_PENALTY      = 0.3; // phase-score penalty for brightness at gap positions
  const corrected = new Uint8Array(imageWidth * imageHeight);

  // Stage A: build surplus profile along one boundary line.
  // surplus[i] = max brightness within ±SEARCH_HALF_WIDTH of boundaryPx − perp baseline.
  function buildSurplusProfile(
    boundaryPx: number,
    isHorizontal: boolean,
    scanStart: number,
    scanEnd: number,
  ): Float32Array {
    const surplus = new Float32Array(scanEnd - scanStart);
    const perpAxis = isHorizontal ? imageHeight : imageWidth;
    for (let i = 0; i < surplus.length; i++) {
      const s = scanStart + i;
      const aOff = Math.max(0, boundaryPx - PERP_OFFSET);
      const bOff = Math.min(perpAxis - 1, boundaryPx + PERP_OFFSET);
      const aP = isHorizontal ? getPixelAt(data, imageWidth, s, aOff) : getPixelAt(data, imageWidth, aOff, s);
      const bP = isHorizontal ? getPixelAt(data, imageWidth, s, bOff) : getPixelAt(data, imageWidth, bOff, s);
      const perp = (aP.r + aP.g + aP.b + bP.r + bP.g + bP.b) / 6;
      let maxBr = 0;
      for (let d = -SEARCH_HALF_WIDTH; d <= SEARCH_HALF_WIDTH; d++) {
        const lc = boundaryPx + d;
        if (lc < 0 || lc >= perpAxis) continue;
        const { r, g, b } = isHorizontal
          ? getPixelAt(data, imageWidth, s, lc)
          : getPixelAt(data, imageWidth, lc, s);
        maxBr = Math.max(maxBr, (r + g + b) / 3);
      }
      surplus[i] = maxBr - perp;
    }
    return surplus;
  }

  // Stage B-1: element-wise max across profiles, clamped to 0.
  // Ensures icon-occluded positions on some lines don't suppress the combined signal.
  function combineProfiles(profiles: Float32Array[]): Float32Array {
    const combined = new Float32Array(profiles[0].length);
    for (let i = 0; i < combined.length; i++) {
      let v = 0;
      for (const p of profiles) v = Math.max(v, p[i]);
      combined[i] = v;
    }
    return combined;
  }

  // Stage B-2: sweep phase candidates and return the best-fitting offset.
  function findPhase(combined: Float32Array): number {
    let bestPhase = 0, bestScore = -Infinity;
    for (let ph = 0; ph < Math.ceil(PERIOD_PX); ph++) {
      let score = 0;
      for (let i = 0; i < combined.length; i++)
        score += (i + ph) % PERIOD_PX < DASH_PX ? combined[i] : -combined[i] * GAP_PENALTY;
      if (score > bestScore) { bestScore = score; bestPhase = ph; }
    }
    return bestPhase;
  }

  // Stage C: apply corrections to one boundary line using the shared phase.
  // Handles sub-pixel distortion (brightest-pixel search) and partial-brightness
  // antialiased edges (proportional alpha correction, extended EDGE_ZONE gate).
  function applyCorrections(
    boundaryPx: number,
    isHorizontal: boolean,
    surplus: Float32Array,
    phase: number,
    scanStart: number,
  ): void {
    const perpAxis = isHorizontal ? imageHeight : imageWidth;
    for (let i = 0; i < surplus.length; i++) {
      const phasePos = (i + phase) % PERIOD_PX;
      const isEdgeZone = phasePos >= DASH_PX && phasePos < DASH_PX + EDGE_ZONE;
      if (phasePos >= DASH_PX + EDGE_ZONE) continue;  // true gap — skip
      const minSurp = isEdgeZone ? MIN_SURPLUS / 2 : MIN_SURPLUS;
      if (surplus[i] < minSurp) continue;             // no brightening (icon / gap)
      const s = scanStart + i;

      // Perpendicular baseline
      const aOff = Math.max(0, boundaryPx - PERP_OFFSET);
      const bOff = Math.min(perpAxis - 1, boundaryPx + PERP_OFFSET);
      const aP = isHorizontal ? getPixelAt(data, imageWidth, s, aOff) : getPixelAt(data, imageWidth, aOff, s);
      const bP = isHorizontal ? getPixelAt(data, imageWidth, s, bOff) : getPixelAt(data, imageWidth, bOff, s);
      const perp = (aP.r + aP.g + aP.b + bP.r + bP.g + bP.b) / 6;

      // Find actual line centre (brightest pixel in search band — handles distortion)
      let bestBr = -1, bestLineCoord = boundaryPx;
      for (let d = -SEARCH_HALF_WIDTH; d <= SEARCH_HALF_WIDTH; d++) {
        const lc = boundaryPx + d;
        if (lc < 0 || lc >= perpAxis) continue;
        const { r, g, b } = isHorizontal
          ? getPixelAt(data, imageWidth, s, lc)
          : getPixelAt(data, imageWidth, lc, s);
        const br = (r + g + b) / 3;
        if (br > bestBr) { bestBr = br; bestLineCoord = lc; }
      }
      if (bestBr - perp < MIN_SURPLUS / 2) continue;  // confirm brightness surplus

      // Correct ±LINE_HALF_WIDTH around detected centre.
      // Use estimated overlay alpha (from per-pixel surplus) for proportional correction:
      //   alpha_est = clamp(pixSurplus / (255 - perp), 0, 0.25)
      //   corrected = clamp((channel - 255*alpha) / (1 - alpha), 0, 255)
      // For full-dash pixels alpha_est ≈ 0.25 (same as correctGridlineChannel).
      // For antialiased edge pixels alpha_est < 0.25, correction is proportionally smaller.
      for (let d = -LINE_HALF_WIDTH; d <= LINE_HALF_WIDTH; d++) {
        const lc = bestLineCoord + d;
        if (lc < 0 || lc >= perpAxis) continue;
        let px: number, py: number;
        if (isHorizontal) { px = s; py = lc; } else { px = lc; py = s; }
        const pi = (py * imageWidth + px) * 4;
        const pixBr = (data[pi] + data[pi + 1] + data[pi + 2]) / 3;
        const pixSurplus = pixBr - perp;
        const alpha = perp < 255
          ? Math.min(0.25, Math.max(0, pixSurplus / (255 - perp)))
          : 0;
        if (alpha > 0) {
          const inv = 1 - alpha;
          data[pi]     = Math.max(0, Math.min(255, Math.round((data[pi]     - 255 * alpha) / inv)));
          data[pi + 1] = Math.max(0, Math.min(255, Math.round((data[pi + 1] - 255 * alpha) / inv)));
          data[pi + 2] = Math.max(0, Math.min(255, Math.round((data[pi + 2] - 255 * alpha) / inv)));
        }
        corrected[py * imageWidth + px] = 1;
      }
    }
  }

  const xStart = Math.round(extents.full.left);
  const xEnd   = Math.round(extents.full.left + ISLAND_COORD_WIDTH  * ppc);
  const yStart = Math.round(extents.full.top);
  const yEnd   = Math.round(extents.full.top  + ISLAND_COORD_HEIGHT * ppc);

  // Horizontal gridlines — all share one phase (period divides evenly into block size)
  {
    const boundaries = Array.from(
      { length: Math.floor(ISLAND_COORD_HEIGHT / BLOCK_SIZE) - 1 },
      (_, r) => Math.round(extents.full.top + (r + 1) * BLOCK_SIZE * ppc),
    );
    const profiles = boundaries.map(by => buildSurplusProfile(by, true, xStart, xEnd));
    const phase = findPhase(combineProfiles(profiles));
    boundaries.forEach((by, li) => applyCorrections(by, true, profiles[li], phase, xStart));
  }

  // Vertical gridlines — all share one phase
  {
    const boundaries = Array.from(
      { length: Math.floor(ISLAND_COORD_WIDTH / BLOCK_SIZE) - 1 },
      (_, c) => Math.round(extents.full.left + (c + 1) * BLOCK_SIZE * ppc),
    );
    const profiles = boundaries.map(bx => buildSurplusProfile(bx, false, yStart, yEnd));
    const phase = findPhase(combineProfiles(profiles));
    boundaries.forEach((bx, li) => applyCorrections(bx, false, profiles[li], phase, yStart));
  }

  const count = corrected.reduce((sum, v) => sum + v, 0);
  console.log(`Generate from Screenshot: gridline overlay removed (${count} pixels corrected)`);
  return corrected;
}

// Debug output: show corrected screenshot with green overlay on corrected pixels
async function saveGridlineRemovalDebug(
  image: HTMLImageElement,
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  corrected: Uint8Array,
): Promise<void> {
  if (skipDebug) return;
  // Draw corrected pixel data as the base
  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(imageWidth, imageHeight);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);

  // Overlay semi-transparent green on every corrected pixel
  ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
  for (let py = 0; py < imageHeight; py++) {
    for (let px = 0; px < imageWidth; px++) {
      if (corrected[py * imageWidth + px]) {
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }

  await downloadCanvas(canvas, 'debug_06_gridline_removal.png');
}

async function saveEdgeTileDebug(
  image: HTMLImageElement,
  extents: IslandExtents,
  edgeResult: EdgeTileMatchResult,
): Promise<void> {
  if (skipDebug) return;
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

  await downloadCanvas(canvas, 'debug_07_edge_tiles.png');
}

async function savePostIconFillDebug(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
): Promise<void> {
  if (skipDebug) return;
  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(imageWidth, imageHeight);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);
  await downloadCanvas(canvas, 'debug_09_post_icon_fill.png');
}

async function savePostStairBridgeFillDebug(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
): Promise<void> {
  if (skipDebug) return;
  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(imageWidth, imageHeight);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);
  await downloadCanvas(canvas, 'debug_13_post_stair_bridge_fill.png');
}

// Debug output: draw bridge water-adjacency slice check results.
// For each bridge candidate, shows colored column (vertical bridge) or row (horizontal bridge) slices
// from inside the blob outward, green = water detected, red = not water.
async function saveBridgeWaterDebug(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  entries: Array<{
    icon: DetectedIcon;
    sideA: { slices: Array<{ pos: number; water: boolean }>; passed: boolean };
    sideB: { slices: Array<{ pos: number; water: boolean }>; passed: boolean };
    accepted: boolean;
  }>,
): Promise<void> {
  if (skipDebug) return;
  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(imageWidth, imageHeight);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);

  for (const { icon, sideA, sideB, accepted } of entries) {
    const [bMinX, bMinY, bMaxX, bMaxY] = icon.blobBBoxPx;
    const rotation = icon.orientation?.rotation ?? 0;

    // Draw blob bbox border
    ctx.strokeStyle = accepted ? '#00FF00' : '#FF0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(bMinX, bMinY, bMaxX - bMinX, bMaxY - bMinY);

    if (rotation === 0 || rotation === 180) {
      // Vertical bridge: slices are full-height columns
      const h = bMaxY - bMinY + 1;
      for (const { pos: x, water } of sideA.slices) {
        ctx.fillStyle = water ? 'rgba(0,255,0,0.6)' : 'rgba(255,0,0,0.4)';
        ctx.fillRect(x, bMinY, 1, h);
      }
      for (const { pos: x, water } of sideB.slices) {
        ctx.fillStyle = water ? 'rgba(0,255,0,0.6)' : 'rgba(255,0,0,0.4)';
        ctx.fillRect(x, bMinY, 1, h);
      }
    } else if (rotation === 90 || rotation === 270) {
      // Horizontal bridge: slices are full-width rows
      const w = bMaxX - bMinX + 1;
      for (const { pos: y, water } of sideA.slices) {
        ctx.fillStyle = water ? 'rgba(0,255,0,0.6)' : 'rgba(255,0,0,0.4)';
        ctx.fillRect(bMinX, y, w, 1);
      }
      for (const { pos: y, water } of sideB.slices) {
        ctx.fillStyle = water ? 'rgba(0,255,0,0.6)' : 'rgba(255,0,0,0.4)';
        ctx.fillRect(bMinX, y, w, 1);
      }
    } else if (rotation === 45 || rotation === 135) {
      // Diagonal: draw lines parallel to bridge axis at each perpendicular offset d
      const diagLen = Math.min(bMaxX - bMinX, bMaxY - bMinY);
      const ax0X = rotation === 45 ? bMinX : bMaxX;
      const axDX = rotation === 45 ? 1 : -1;
      const perpDX = rotation === 45 ? 1 : -1;
      const perpDY = rotation === 45 ? -1 : -1;

      // Draw sideA columns (positive perp direction)
      for (const { pos: d, water } of sideA.slices) {
        ctx.fillStyle = water ? 'rgba(0,255,0,0.6)' : 'rgba(255,0,0,0.4)';
        for (let i = 0; i <= diagLen; i += 2) {
          const px = ax0X + axDX * i + perpDX * d;
          const py = bMinY + i + perpDY * d;
          ctx.fillRect(px, py, 1, 1);
        }
      }
      // Draw sideB columns (negative perp direction)
      for (const { pos: d, water } of sideB.slices) {
        ctx.fillStyle = water ? 'rgba(0,255,0,0.6)' : 'rgba(255,0,0,0.4)';
        for (let i = 0; i <= diagLen; i += 2) {
          const px = ax0X + axDX * i - perpDX * d;
          const py = bMinY + i - perpDY * d;
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }

    // Side pass/fail labels + orientation
    ctx.font = '10px monospace';
    ctx.fillStyle = sideA.passed ? '#00FF00' : '#FF4444';
    ctx.fillText(`A:${sideA.passed ? 'OK' : 'FAIL'}`, bMinX + 2, bMinY + 12);
    ctx.fillStyle = sideB.passed ? '#00FF00' : '#FF4444';
    ctx.fillText(`B:${sideB.passed ? 'OK' : 'FAIL'}`, bMinX + 2, bMinY + 24);
    ctx.fillStyle = '#FFFF00';
    ctx.fillText(`${rotation}° ${icon.resolvedType ?? icon.template.type}`, bMinX + 2, bMinY + 36);
  }

  await downloadCanvas(canvas, 'debug_11e_bridge_water_check.png');
}

// Debug output: draw blob detection results for stairs and bridge color groups.
// Shows all found blobs with green (accepted) or red (rejected) bounding boxes.
async function saveBlobDetectionDebug(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  blobDebug: BlobDebugEntry[],
): Promise<void> {
  if (skipDebug) return;
  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(imageWidth, imageHeight);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);

  for (const entry of blobDebug) {
    const { blob, accepted, colorGroup } = entry;
    if (blob.area < 10) continue; // Skip tiny blobs to reduce noise
    const bboxW = blob.maxX - blob.minX + 1;
    const bboxH = blob.maxY - blob.minY + 1;

    // Semi-transparent fill overlay: yellow for stairs, olive for bridges
    const [or, og, ob] = colorGroup === 'stairs' ? [0xF5, 0xDE, 0x99] : [0x7F, 0x82, 0x67];
    ctx.fillStyle = `rgba(${or}, ${og}, ${ob}, 0.35)`;
    ctx.fillRect(blob.minX, blob.minY, bboxW, bboxH);

    // Bounding box: green = accepted, red = rejected
    ctx.strokeStyle = accepted ? '#00FF00' : '#FF0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(blob.minX, blob.minY, bboxW, bboxH);

    // Label
    ctx.fillStyle = accepted ? '#00FF00' : '#FF4444';
    ctx.font = '11px monospace';
    ctx.fillText(
      `${colorGroup} ${blob.area}px ${accepted ? 'OK' : 'FAIL'}`,
      blob.minX + 2,
      blob.minY + 13,
    );
    if (!accepted && entry.rejectReason) {
      ctx.fillText(entry.rejectReason, blob.minX + 2, blob.minY + 25);
    }
  }

  await downloadCanvas(canvas, 'debug_11_blob_detection.png');
}

// Debug output: four images showing each stage of stair detection.
async function saveStairStagesDebug(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  rawBlobs: ColorBlob[],
  stepBlobs: Array<{ blob: ColorBlob; scanVertical: boolean }>,
  groups: Array<{
    group: ColorBlob[];
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    scanVertical: boolean;
    transitions: number;
    accepted: boolean;
  }>,
): Promise<void> {
  if (skipDebug) return;
  function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(imageWidth, imageHeight);
    imageData.data.set(data);
    ctx.putImageData(imageData, 0, 0);
    return { canvas, ctx };
  }

  // debug_11a: all stair-color connected components (no dilation), yellow boxes + W×H label
  {
    const { canvas, ctx } = makeCanvas();
    ctx.font = '10px monospace';
    for (const blob of rawBlobs) {
      const w = blob.maxX - blob.minX + 1, h = blob.maxY - blob.minY + 1;
      ctx.fillStyle = 'rgba(200,200,200,0.3)';
      ctx.fillRect(blob.minX, blob.minY, w, h);
      ctx.strokeStyle = '#FFFF00';
      ctx.lineWidth = 1;
      ctx.strokeRect(blob.minX, blob.minY, w, h);
      ctx.fillStyle = '#FFFF00';
      ctx.fillText(`${w}x${h}`, blob.minX + 1, blob.minY + 10);
    }
    await downloadCanvas(canvas, 'debug_11a_stair_raw_blobs.png');
  }

  // debug_11b: step-shape gate — green=accepted (with V/H scan dir), red=rejected
  {
    const { canvas, ctx } = makeCanvas();
    ctx.font = '10px monospace';
    const acceptedSet = new Set(stepBlobs.map(s => s.blob));
    const dirMap = new Map(stepBlobs.map(s => [s.blob, s.scanVertical ? 'V' : 'H']));
    for (const blob of rawBlobs) {
      const w = blob.maxX - blob.minX + 1, h = blob.maxY - blob.minY + 1;
      if (acceptedSet.has(blob)) {
        ctx.fillStyle = 'rgba(0,255,100,0.25)';
        ctx.fillRect(blob.minX, blob.minY, w, h);
        ctx.strokeStyle = '#00FF64';
        ctx.lineWidth = 1;
        ctx.strokeRect(blob.minX, blob.minY, w, h);
        ctx.fillStyle = '#00FF64';
        ctx.fillText(`${w}x${h} ${dirMap.get(blob)}`, blob.minX + 1, blob.minY + 10);
      } else {
        ctx.fillStyle = 'rgba(255,50,50,0.2)';
        ctx.fillRect(blob.minX, blob.minY, w, h);
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 1;
        ctx.strokeRect(blob.minX, blob.minY, w, h);
        ctx.fillStyle = '#FF4444';
        ctx.fillText(`${w}x${h}`, blob.minX + 1, blob.minY + 10);
      }
    }
    await downloadCanvas(canvas, 'debug_11b_stair_step_gate.png');
  }

  // debug_11c: groups — dim green per member step blob, bright yellow merged group bbox
  {
    const { canvas, ctx } = makeCanvas();
    ctx.font = '10px monospace';
    for (const { group, bbox } of groups) {
      for (const b of group) {
        ctx.fillStyle = 'rgba(0,200,100,0.2)';
        ctx.fillRect(b.minX, b.minY, b.maxX - b.minX + 1, b.maxY - b.minY + 1);
        ctx.strokeStyle = '#00C864';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX + 1, b.maxY - b.minY + 1);
      }
      const bw = bbox.maxX - bbox.minX + 1, bh = bbox.maxY - bbox.minY + 1;
      ctx.strokeStyle = '#FFFF00';
      ctx.lineWidth = 2;
      ctx.strokeRect(bbox.minX, bbox.minY, bw, bh);
      ctx.fillStyle = '#FFFF00';
      ctx.fillText(`${group.length} steps`, bbox.minX + 2, bbox.minY + 12);
    }
    await downloadCanvas(canvas, 'debug_11c_stair_groups.png');
  }

  // debug_11d: stripe pattern test — green=accepted, red=rejected; label shows transition count
  {
    const { canvas, ctx } = makeCanvas();
    ctx.font = '11px monospace';
    for (const { bbox, transitions, accepted } of groups) {
      const bw = bbox.maxX - bbox.minX + 1, bh = bbox.maxY - bbox.minY + 1;
      ctx.fillStyle = accepted ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)';
      ctx.fillRect(bbox.minX, bbox.minY, bw, bh);
      ctx.strokeStyle = accepted ? '#00FF00' : '#FF0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(bbox.minX, bbox.minY, bw, bh);
      ctx.fillStyle = accepted ? '#00FF00' : '#FF4444';
      ctx.fillText(
        `${transitions}t ${accepted ? 'OK' : 'FAIL'}`,
        bbox.minX + 2,
        bbox.minY + 13,
      );
    }
    await downloadCanvas(canvas, 'debug_11d_stair_pattern_test.png');
  }
}

// Debug output: overlay edge block terrain after fillEdgeRegionsWithLevel1.
// Shows which cells in edge blocks were converted to LEVEL1.
async function saveEdgeFillDebug(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
  grid: PixelGrid,
): Promise<void> {
  if (skipDebug) return;
  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(imageWidth, imageHeight);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);

  const ppc = extents.pixelsPerCoord;
  const fullLeft = extents.full.left;
  const fullTop = extents.full.top;

  for (const [blockX, blockY] of EDGE_CCW_POSITIONS) {
    const startCoordX = blockX * 16;
    const startCoordY = blockY * 16;

    // Semi-transparent terrain overlay for each cell in the block
    ctx.globalAlpha = 0.5;
    for (let ly = 0; ly < 16; ly++) {
      for (let lx = 0; lx < 16; lx++) {
        const idx = (startCoordY + ly) * ISLAND_COORD_WIDTH + (startCoordX + lx);
        const terrain = grid.primary[idx];
        const [r, g, b] = TERRAIN_DEBUG_COLORS[terrain] || [128, 128, 128];
        const screenX = fullLeft + (startCoordX + lx) * ppc;
        const screenY = fullTop + (startCoordY + ly) * ppc;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(screenX, screenY, ppc, ppc);
      }
    }
    ctx.globalAlpha = 1.0;

    // Yellow border around each edge block
    const blockScreenX = fullLeft + startCoordX * ppc;
    const blockScreenY = fullTop + startCoordY * ppc;
    const blockSizePx = 16 * ppc;
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(blockScreenX, blockScreenY, blockSizePx, blockSizePx);
  }

  await downloadCanvas(canvas, 'debug_10_edge_fill.png');
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

// ============ Options ============

export type GenerateOptions = {
  /** When false, skips all debug image generation and zip download. Default: true. */
  debug?: boolean;
  /** Progress callback invoked after each major pipeline step. */
  onProgress?: (completed: number, total: number) => void;
  /** Called after the user selects a file but before heavy processing begins. */
  onFileSelected?: () => void;
};

/** Module-level flag set by generateFromScreenshot() to gate debug output. */
let skipDebug = false;

// ============ Debug Image Output ============
// Pattern from devTools.ts:3756-3760 (canvas → toDataURL → <a> download)

// Set to a JSZip instance before running the debug pipeline; cleared after download.
// When set, downloadCanvas adds to the zip instead of triggering individual downloads.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let debugZip: any = null;

async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  if (skipDebug) return;
  if (debugZip !== null) {
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
    debugZip.file(filename, blob);
    return;
  }
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

async function saveTopBoundaryDebug(
  image: HTMLImageElement,
  result: BoundaryResult,
  width: number,
): Promise<void> {
  if (skipDebug) return;
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

  await downloadCanvas(canvas, 'debug_01_top_boundary.png');
}

async function saveBottomBoundaryDebug(
  image: HTMLImageElement,
  result: BoundaryResult,
  width: number,
): Promise<void> {
  if (skipDebug) return;
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

  await downloadCanvas(canvas, 'debug_02_bottom_boundary.png');
}

async function saveLeftBoundaryDebug(
  image: HTMLImageElement,
  result: VerticalBoundaryResult,
  topY: number,
  bottomY: number,
): Promise<void> {
  if (skipDebug) return;
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

  await downloadCanvas(canvas, 'debug_03_left_boundary.png');
}

async function saveRightBoundaryDebug(
  image: HTMLImageElement,
  result: VerticalBoundaryResult,
  topY: number,
  bottomY: number,
): Promise<void> {
  if (skipDebug) return;
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

  await downloadCanvas(canvas, 'debug_04_right_boundary.png');
}

async function saveExtentsDebug(
  image: HTMLImageElement,
  extents: IslandExtents,
): Promise<void> {
  if (skipDebug) return;
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

  await downloadCanvas(canvas, 'debug_05_island_extents.png');
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

// Map terrain to level-only colors: anything not LEVEL2/LEVEL3 is treated as LEVEL1.
function levelDebugColor(terrain: number): [number, number, number] {
  if (terrain === TERRAIN.LEVEL3) return [0x65, 0xCA, 0x44];
  if (terrain === TERRAIN.LEVEL2) return [0x46, 0xA5, 0x44];
  return [0x3F, 0x7C, 0x41]; // LEVEL1 (and everything else)
}

async function savePixelGridDebug(grid: PixelGrid): Promise<void> {
  if (skipDebug) return;
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
        const [r, g, b] = levelDebugColor(grid.primary[idx]);
        gridImageData.data[outIdx] = r;
        gridImageData.data[outIdx + 1] = g;
        gridImageData.data[outIdx + 2] = b;
      } else {
        // Diagonal: blend the two colors 50/50 at this resolution
        const [r1, g1, b1] = levelDebugColor(grid.primary[idx]);
        const [r2, g2, b2] = levelDebugColor(grid.secondary[idx]);
        gridImageData.data[outIdx] = (r1 + r2) >> 1;
        gridImageData.data[outIdx + 1] = (g1 + g2) >> 1;
        gridImageData.data[outIdx + 2] = (b1 + b2) >> 1;
      }
      gridImageData.data[outIdx + 3] = 255;
    }
  }

  gridCtx.putImageData(gridImageData, 0, 0);
  await downloadCanvas(gridCanvas, 'debug_14a_pixel_grid.png');

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

      const [r1, g1, b1] = levelDebugColor(grid.primary[idx]);

      if (grid.diagonal[idx] === DIAGONAL.NONE) {
        // Solid cell
        overlayCtx.fillStyle = `rgb(${r1},${g1},${b1})`;
        overlayCtx.fillRect(x0, y0, scale, scale);
      } else {
        const [r2, g2, b2] = levelDebugColor(grid.secondary[idx]);

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

  await downloadCanvas(overlayCanvas, 'debug_14b_pixel_overlay.png');
}

// ============ Path Vectorization & Fill ============

function tracePathPolylines(grid: PixelGrid): [number, number][][] {
  const pathSet = new Set<number>();
  for (let i = 0; i < grid.primary.length; i++) {
    if (grid.primary[i] === TERRAIN.PATH) pathSet.add(i);
  }
  if (pathSet.size === 0) return [];

  const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy8 = [-1, -1, -1, 0, 0, 1, 1, 1];
  const visited = new Set<number>();
  const polylines: [number, number][][] = [];

  for (const startIdx of pathSet) {
    if (visited.has(startIdx)) continue;

    // BFS to find this connected component
    const component: number[] = [];
    const compQueue = [startIdx];
    const compVisited = new Set([startIdx]);
    for (let qi = 0; qi < compQueue.length; qi++) {
      const idx = compQueue[qi];
      component.push(idx);
      const cx = idx % ISLAND_COORD_WIDTH, cy = Math.floor(idx / ISLAND_COORD_WIDTH);
      for (let d = 0; d < 8; d++) {
        const nx = cx + dx8[d], ny = cy + dy8[d];
        if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
        const nIdx = ny * ISLAND_COORD_WIDTH + nx;
        if (!pathSet.has(nIdx) || compVisited.has(nIdx)) continue;
        compVisited.add(nIdx);
        compQueue.push(nIdx);
      }
    }

    // Find degree of each cell in component (8-connectivity path neighbors)
    const degree = new Map<number, number>();
    for (const idx of component) {
      const cx = idx % ISLAND_COORD_WIDTH, cy = Math.floor(idx / ISLAND_COORD_WIDTH);
      let deg = 0;
      for (let d = 0; d < 8; d++) {
        const nx = cx + dx8[d], ny = cy + dy8[d];
        if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
        const nIdx = ny * ISLAND_COORD_WIDTH + nx;
        if (pathSet.has(nIdx)) deg++;
      }
      degree.set(idx, deg);
    }

    // Find walk start: prefer degree-1 endpoints; fall back to any unvisited cell
    const endpoint = component.find(idx => degree.get(idx) === 1 && !visited.has(idx))
      ?? component.find(idx => !visited.has(idx));
    if (endpoint === undefined) continue;

    // Walk from endpoint, emitting vertices at direction changes
    const walkVisited = new Set<number>();
    const polylineStack = [endpoint];

    while (polylineStack.length > 0) {
      let cur = polylineStack.pop()!;
      if (walkVisited.has(cur)) continue;

      const vertices: [number, number][] = [];
      let prevDx = 0, prevDy = 0;
      let continueWalk = true;

      while (continueWalk) {
        walkVisited.add(cur);
        visited.add(cur);
        const cx = cur % ISLAND_COORD_WIDTH, cy = Math.floor(cur / ISLAND_COORD_WIDTH);

        // Find next unvisited path neighbor
        let next = -1, ndx = 0, ndy = 0;
        for (let d = 0; d < 8; d++) {
          const nx = cx + dx8[d], ny = cy + dy8[d];
          if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
          const nIdx = ny * ISLAND_COORD_WIDTH + nx;
          if (!pathSet.has(nIdx) || walkVisited.has(nIdx)) continue;
          // Queue branching neighbors for separate polylines
          if (next !== -1) { polylineStack.push(nIdx); continue; }
          next = nIdx; ndx = nx - cx; ndy = ny - cy;
        }

        // Emit vertex if direction changed or at start/end
        if (vertices.length === 0 || ndx !== prevDx || ndy !== prevDy) {
          vertices.push([cx, cy]);
        }

        if (next === -1) {
          continueWalk = false;
        } else {
          prevDx = ndx; prevDy = ndy;
          cur = next;
        }
      }

      if (vertices.length > 0) polylines.push(vertices);
    }
  }

  return polylines;
}

async function processPathPixels(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
  grid: PixelGrid,
): Promise<{ polylines: [number, number][][]; pathOutlines: [number, number][][] }> {
  // Step 1: Vectorize before filling (while grid still has PATH values)
  const polylines = tracePathPolylines(grid);
  const totalPoints = polylines.reduce((sum, p) => sum + p.length, 0);
  console.log(`Path vectorization: ${polylines.length} polylines, ${totalPoints} vertices`);

  // Step 2: Record which cells are PATH (before overwriting with level)
  const wasPathCell = new Uint8Array(ISLAND_COORD_WIDTH * ISLAND_COORD_HEIGHT);
  for (let i = 0; i < grid.primary.length; i++) {
    if (grid.primary[i] === TERRAIN.PATH) wasPathCell[i] = 1;
  }

  // Step 3: Multi-source BFS — fill PATH cells with nearest LEVEL1/2/3
  // Seed: every LEVEL1/2/3 cell enqueues its PATH neighbors
  const bfsQueue: Array<{ cellIdx: number; level: TerrainType }> = [];
  const bfsVisited = new Uint8Array(ISLAND_COORD_WIDTH * ISLAND_COORD_HEIGHT);
  const dx4 = [0, 0, -1, 1], dy4 = [-1, 1, 0, 0];

  for (let cy = 0; cy < ISLAND_COORD_HEIGHT; cy++) {
    for (let cx = 0; cx < ISLAND_COORD_WIDTH; cx++) {
      const idx = cy * ISLAND_COORD_WIDTH + cx;
      const t = grid.primary[idx] as TerrainType;
      if (t !== TERRAIN.LEVEL1 && t !== TERRAIN.LEVEL2 && t !== TERRAIN.LEVEL3) continue;
      for (let d = 0; d < 4; d++) {
        const nx = cx + dx4[d], ny = cy + dy4[d];
        if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
        const nIdx = ny * ISLAND_COORD_WIDTH + nx;
        if (grid.primary[nIdx] !== TERRAIN.PATH || bfsVisited[nIdx]) continue;
        bfsVisited[nIdx] = 1;
        bfsQueue.push({ cellIdx: nIdx, level: t });
      }
    }
  }

  // BFS propagation through PATH cells
  for (let qi = 0; qi < bfsQueue.length; qi++) {
    const { cellIdx, level } = bfsQueue[qi];
    grid.primary[cellIdx] = level;
    grid.diagonal[cellIdx] = DIAGONAL.NONE;
    grid.secondary[cellIdx] = TERRAIN.UNKNOWN;
    const cx = cellIdx % ISLAND_COORD_WIDTH;
    const cy = Math.floor(cellIdx / ISLAND_COORD_WIDTH);
    for (let d = 0; d < 4; d++) {
      const nx = cx + dx4[d], ny = cy + dy4[d];
      if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
      const nIdx = ny * ISLAND_COORD_WIDTH + nx;
      if (grid.primary[nIdx] !== TERRAIN.PATH || bfsVisited[nIdx]) continue;
      bfsVisited[nIdx] = 1;
      bfsQueue.push({ cellIdx: nIdx, level });
    }
  }

  // Step 4: Paint image pixels for originally-PATH grid cells; collect for extension step
  const paintedPathPixelSet = new Set<number>();
  for (let py = 0; py < imageHeight; py++) {
    for (let px = 0; px < imageWidth; px++) {
      const { cx, cy } = pixelToIslandCoord(px, py, extents);
      const gx = Math.floor(cx), gy = Math.floor(cy);
      if (gx < 0 || gx >= ISLAND_COORD_WIDTH || gy < 0 || gy >= ISLAND_COORD_HEIGHT) continue;
      const cellIdx = gy * ISLAND_COORD_WIDTH + gx;
      if (!wasPathCell[cellIdx]) continue;
      const paintColor = terrainLevelToColor(grid.primary[cellIdx] as TerrainType);
      const dataIdx = (py * imageWidth + px) * 4;
      data[dataIdx]     = paintColor.r;
      data[dataIdx + 1] = paintColor.g;
      data[dataIdx + 2] = paintColor.b;
      paintedPathPixelSet.add(py * imageWidth + px);
    }
  }

  // Step 4.5: Expand path fill by a few pixels for transition/anti-aliased edge colors.
  // Pixels just outside the classified PATH region often blend the tan path color with
  // adjacent grass green; a looser color tolerance catches these edge pixels.
  const PATH_EXTENSION_TOLERANCE = 65; // Looser than COLOR_TOLERANCE (40) for blended edge pixels
  const PATH_EXTENSION_RADIUS = 3;
  let extendedCount = 0;

  const extVisited = new Set<number>(paintedPathPixelSet);
  const extQueue: Array<{ pIdx: number; depth: number }> = [];

  // Seed BFS from the boundary of painted path pixels
  for (const pIdx of paintedPathPixelSet) {
    const epx = pIdx % imageWidth, epy = Math.floor(pIdx / imageWidth);
    for (let d = 0; d < 4; d++) {
      const nx = epx + dx4[d], ny = epy + dy4[d];
      if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
      const nIdx = ny * imageWidth + nx;
      if (extVisited.has(nIdx)) continue;
      extVisited.add(nIdx);
      extQueue.push({ pIdx: nIdx, depth: 1 });
    }
  }

  for (let qi = 0; qi < extQueue.length; qi++) {
    const { pIdx, depth } = extQueue[qi];
    const epx = pIdx % imageWidth, epy = Math.floor(pIdx / imageWidth);
    const pixel = getPixelAt(data, imageWidth, epx, epy);

    // Only extend into pixels that still look path-like (transition colors)
    if (!matchesAnyColor(pixel, SCREENSHOT_COLORS.PATH, PATH_EXTENSION_TOLERANCE)) continue;

    // Determine level from this pixel's grid cell (already filled by BFS in step 3)
    const { cx, cy } = pixelToIslandCoord(epx, epy, extents);
    const gx = Math.floor(cx), gy = Math.floor(cy);
    if (gx < 0 || gx >= ISLAND_COORD_WIDTH || gy < 0 || gy >= ISLAND_COORD_HEIGHT) continue;
    const cellIdx = gy * ISLAND_COORD_WIDTH + gx;
    const level = grid.primary[cellIdx] as TerrainType;
    if (level !== TERRAIN.LEVEL1 && level !== TERRAIN.LEVEL2 && level !== TERRAIN.LEVEL3) continue;

    const paintColor = terrainLevelToColor(level);
    const dataIdx = pIdx * 4;
    data[dataIdx]     = paintColor.r;
    data[dataIdx + 1] = paintColor.g;
    data[dataIdx + 2] = paintColor.b;
    extendedCount++;

    // Continue BFS within radius
    if (depth < PATH_EXTENSION_RADIUS) {
      for (let d = 0; d < 4; d++) {
        const nx = epx + dx4[d], ny = epy + dy4[d];
        if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
        const nIdx = ny * imageWidth + nx;
        if (extVisited.has(nIdx)) continue;
        extVisited.add(nIdx);
        extQueue.push({ pIdx: nIdx, depth: depth + 1 });
      }
    }
  }

  console.log(`Path extension: ${extendedCount} additional transition pixels painted`);

  // Step 4.6: Trace closed polygon outlines of the path region (for v2 map drawing layer)
  const pathCellSet = new Set<number>();
  for (let i = 0; i < wasPathCell.length; i++) {
    if (wasPathCell[i]) pathCellSet.add(i);
  }
  const pathOutlines = traceTerrainOutline(pathCellSet);
  console.log(`Path outline: ${pathOutlines.length} polygons`);

  // Step 5: Debug image
  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(imageWidth, imageHeight);
  imgData.data.set(data);
  ctx.putImageData(imgData, 0, 0);
  await downloadCanvas(canvas, 'debug_13d_post_path_fill.png');

  return { polylines, pathOutlines };
}

// ============ Terrain Outline Tracing ============

// Minimum connected-component size (in grid cells) to include in terrain outlines.
// Single isolated cells are treated as noise and skipped.
const MIN_REGION_SIZE = 2;

/**
 * Traces closed polygon outlines for every 4-connected component in `cellSet`
 * that has at least MIN_REGION_SIZE cells. Returns an array of closed polygons;
 * each polygon is an array of [x, y] integer vertex coordinates with collinear
 * intermediate vertices compressed out.
 */
function traceTerrainOutline(cellSet: Set<number>): [number, number][][] {
  const VWIDTH = ISLAND_COORD_WIDTH + 1; // vertex grid width (113 for 112 cells)
  const encodeV = (x: number, y: number) => y * VWIDTH + x;

  const dx4c = [0, 1, 0, -1]; // 4-connectivity for component BFS
  const dy4c = [-1, 0, 1, 0];

  const polygons: [number, number][][] = [];
  const globalVisited = new Set<number>();

  for (const startIdx of cellSet) {
    if (globalVisited.has(startIdx)) continue;

    // BFS to find 4-connected component
    const component: number[] = [];
    const queue: number[] = [startIdx];
    const compVisited = new Set<number>([startIdx]);
    for (let qi = 0; qi < queue.length; qi++) {
      const idx = queue[qi];
      component.push(idx);
      const cx = idx % ISLAND_COORD_WIDTH, cy = Math.floor(idx / ISLAND_COORD_WIDTH);
      for (let d = 0; d < 4; d++) {
        const nx = cx + dx4c[d], ny = cy + dy4c[d];
        if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
        const nIdx = ny * ISLAND_COORD_WIDTH + nx;
        if (!cellSet.has(nIdx) || compVisited.has(nIdx)) continue;
        compVisited.add(nIdx);
        queue.push(nIdx);
      }
    }
    for (const idx of component) globalVisited.add(idx);

    if (component.length < MIN_REGION_SIZE) continue;

    // Build directed half-edge map for the boundary of this component.
    // Each directed edge goes CCW around the set (interior on the left).
    // Vertex encoding: v(x, y) = y * VWIDTH + x
    const edgeMap = new Map<number, number>(); // fromVertex → toVertex

    for (const cellIdx of compVisited) {
      const cx = cellIdx % ISLAND_COORD_WIDTH, cy = Math.floor(cellIdx / ISLAND_COORD_WIDTH);

      // Top edge: (cx,cy)→(cx+1,cy) if (cx,cy-1) not in comp
      if (cy === 0 || !compVisited.has((cy - 1) * ISLAND_COORD_WIDTH + cx))
        edgeMap.set(encodeV(cx, cy), encodeV(cx + 1, cy));
      // Right edge: (cx+1,cy)→(cx+1,cy+1) if (cx+1,cy) not in comp
      if (cx === ISLAND_COORD_WIDTH - 1 || !compVisited.has(cy * ISLAND_COORD_WIDTH + cx + 1))
        edgeMap.set(encodeV(cx + 1, cy), encodeV(cx + 1, cy + 1));
      // Bottom edge: (cx+1,cy+1)→(cx,cy+1) if (cx,cy+1) not in comp
      if (cy === ISLAND_COORD_HEIGHT - 1 || !compVisited.has((cy + 1) * ISLAND_COORD_WIDTH + cx))
        edgeMap.set(encodeV(cx + 1, cy + 1), encodeV(cx, cy + 1));
      // Left edge: (cx,cy+1)→(cx,cy) if (cx-1,cy) not in comp
      if (cx === 0 || !compVisited.has(cy * ISLAND_COORD_WIDTH + cx - 1))
        edgeMap.set(encodeV(cx, cy + 1), encodeV(cx, cy));
    }

    // Trace closed polygons by following the edge chain, compressing collinear segments
    const edgeVisited = new Set<number>();
    for (const [startFrom] of edgeMap) {
      if (edgeVisited.has(startFrom)) continue;

      const vertices: [number, number][] = [];
      let cur = startFrom;
      let prevDx = 0, prevDy = 0;

      // Safety limit: a polygon can have at most 4 * component.length edges
      const maxSteps = component.length * 4 + 4;
      for (let step = 0; step < maxSteps; step++) {
        if (step > 0 && cur === startFrom) break; // closed the loop
        edgeVisited.add(cur);

        const next = edgeMap.get(cur);
        if (next === undefined) break; // broken chain (shouldn't happen)

        const curX = cur % VWIDTH, curY = Math.floor(cur / VWIDTH);
        const nextX = next % VWIDTH, nextY = Math.floor(next / VWIDTH);
        const dx = nextX - curX, dy = nextY - curY;

        // Emit vertex only when direction changes (compresses collinear segments)
        if (vertices.length === 0 || dx !== prevDx || dy !== prevDy) {
          vertices.push([curX, curY]);
        }
        prevDx = dx; prevDy = dy;
        cur = next;
      }

      if (vertices.length >= 4) polygons.push(vertices);
    }
  }

  return polygons;
}

// ============ Water Fill & Vectorization ============

async function processWaterPixels(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  extents: IslandExtents,
  grid: PixelGrid,
  preEdgeWaterCells?: Uint8Array,
): Promise<{ waterOutlines: [number, number][][] }> {
  const dx4 = [0, 0, -1, 1], dy4 = [-1, 1, 0, 0];

  // Step 1: Record which cells are WATER (before overwriting with level)
  const wasWaterCell = new Uint8Array(ISLAND_COORD_WIDTH * ISLAND_COORD_HEIGHT);
  for (let i = 0; i < grid.primary.length; i++) {
    if (grid.primary[i] === TERRAIN.WATER) wasWaterCell[i] = 1;
  }
  // Also include water cells that were converted to LEVEL1 by fillEdgeRegionsWithLevel1
  if (preEdgeWaterCells) {
    for (let i = 0; i < preEdgeWaterCells.length; i++) {
      if (preEdgeWaterCells[i]) wasWaterCell[i] = 1;
    }
  }

  // Step 2: Multi-source BFS — fill WATER cells with nearest LEVEL1/2/3
  const bfsQueue: Array<{ cellIdx: number; level: TerrainType }> = [];
  const bfsVisited = new Uint8Array(ISLAND_COORD_WIDTH * ISLAND_COORD_HEIGHT);

  for (let cy = 0; cy < ISLAND_COORD_HEIGHT; cy++) {
    for (let cx = 0; cx < ISLAND_COORD_WIDTH; cx++) {
      const idx = cy * ISLAND_COORD_WIDTH + cx;
      const t = grid.primary[idx] as TerrainType;
      if (t !== TERRAIN.LEVEL1 && t !== TERRAIN.LEVEL2 && t !== TERRAIN.LEVEL3) continue;
      for (let d = 0; d < 4; d++) {
        const nx = cx + dx4[d], ny = cy + dy4[d];
        if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
        const nIdx = ny * ISLAND_COORD_WIDTH + nx;
        if (grid.primary[nIdx] !== TERRAIN.WATER || bfsVisited[nIdx]) continue;
        bfsVisited[nIdx] = 1;
        bfsQueue.push({ cellIdx: nIdx, level: t });
      }
    }
  }

  for (let qi = 0; qi < bfsQueue.length; qi++) {
    const { cellIdx, level } = bfsQueue[qi];
    grid.primary[cellIdx] = level;
    grid.diagonal[cellIdx] = DIAGONAL.NONE;
    grid.secondary[cellIdx] = TERRAIN.UNKNOWN;
    const cx = cellIdx % ISLAND_COORD_WIDTH;
    const cy = Math.floor(cellIdx / ISLAND_COORD_WIDTH);
    for (let d = 0; d < 4; d++) {
      const nx = cx + dx4[d], ny = cy + dy4[d];
      if (nx < 0 || nx >= ISLAND_COORD_WIDTH || ny < 0 || ny >= ISLAND_COORD_HEIGHT) continue;
      const nIdx = ny * ISLAND_COORD_WIDTH + nx;
      if (grid.primary[nIdx] !== TERRAIN.WATER || bfsVisited[nIdx]) continue;
      bfsVisited[nIdx] = 1;
      bfsQueue.push({ cellIdx: nIdx, level });
    }
  }
  console.log(`Water fill: ${bfsQueue.length} cells filled`);

  // Step 3: Paint image pixels for originally-WATER grid cells; collect for extension step
  const paintedWaterPixelSet = new Set<number>();
  for (let py = 0; py < imageHeight; py++) {
    for (let px = 0; px < imageWidth; px++) {
      const { cx, cy } = pixelToIslandCoord(px, py, extents);
      const gx = Math.floor(cx), gy = Math.floor(cy);
      if (gx < 0 || gx >= ISLAND_COORD_WIDTH || gy < 0 || gy >= ISLAND_COORD_HEIGHT) continue;
      const cellIdx = gy * ISLAND_COORD_WIDTH + gx;
      if (!wasWaterCell[cellIdx]) continue;
      const paintColor = terrainLevelToColor(grid.primary[cellIdx] as TerrainType);
      const dataIdx = (py * imageWidth + px) * 4;
      data[dataIdx]     = paintColor.r;
      data[dataIdx + 1] = paintColor.g;
      data[dataIdx + 2] = paintColor.b;
      paintedWaterPixelSet.add(py * imageWidth + px);
    }
  }

  // Step 3.5: Pixel-space BFS extension for water edge pixels
  const WATER_EXTENSION_TOLERANCE = 80; // Higher tolerance since water is highly distinct from remaining colors
  const WATER_EXTENSION_RADIUS = 3;
  let waterExtendedCount = 0;

  const extVisited = new Set<number>(paintedWaterPixelSet);
  const extQueue: Array<{ pIdx: number; depth: number }> = [];
  for (const pIdx of paintedWaterPixelSet) {
    const epx = pIdx % imageWidth, epy = Math.floor(pIdx / imageWidth);
    for (let d = 0; d < 4; d++) {
      const nx = epx + dx4[d], ny = epy + dy4[d];
      if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
      const nIdx = ny * imageWidth + nx;
      if (extVisited.has(nIdx)) continue;
      extVisited.add(nIdx);
      extQueue.push({ pIdx: nIdx, depth: 1 });
    }
  }
  for (let qi = 0; qi < extQueue.length; qi++) {
    const { pIdx, depth } = extQueue[qi];
    const epx = pIdx % imageWidth, epy = Math.floor(pIdx / imageWidth);
    const pixel = getPixelAt(data, imageWidth, epx, epy);
    if (!matchesAnyColor(pixel, SCREENSHOT_COLORS.WATER, WATER_EXTENSION_TOLERANCE)) continue;
    const { cx, cy } = pixelToIslandCoord(epx, epy, extents);
    const gx = Math.floor(cx), gy = Math.floor(cy);
    if (gx < 0 || gx >= ISLAND_COORD_WIDTH || gy < 0 || gy >= ISLAND_COORD_HEIGHT) continue;
    const cellIdx = gy * ISLAND_COORD_WIDTH + gx;
    const level = grid.primary[cellIdx] as TerrainType;
    if (level !== TERRAIN.LEVEL1 && level !== TERRAIN.LEVEL2 && level !== TERRAIN.LEVEL3) continue;
    const paintColor = terrainLevelToColor(level);
    const dataIdx = pIdx * 4;
    data[dataIdx]     = paintColor.r;
    data[dataIdx + 1] = paintColor.g;
    data[dataIdx + 2] = paintColor.b;
    waterExtendedCount++;
    if (depth < WATER_EXTENSION_RADIUS) {
      for (let d = 0; d < 4; d++) {
        const nx = epx + dx4[d], ny = epy + dy4[d];
        if (nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight) continue;
        const nIdx = ny * imageWidth + nx;
        if (extVisited.has(nIdx)) continue;
        extVisited.add(nIdx);
        extQueue.push({ pIdx: nIdx, depth: depth + 1 });
      }
    }
  }
  console.log(`Water extension: ${waterExtendedCount} additional transition pixels painted`);

  // Step 4: Trace closed polygon outlines of the water region
  const waterCellSet = new Set<number>();
  for (let i = 0; i < wasWaterCell.length; i++) {
    if (wasWaterCell[i]) waterCellSet.add(i);
  }
  const waterOutlines = traceTerrainOutline(waterCellSet);
  console.log(`Water outline: ${waterOutlines.length} polygons`);

  // Step 5: Debug image
  const canvas = document.createElement('canvas');
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(imageWidth, imageHeight);
  imgData.data.set(data);
  ctx.putImageData(imgData, 0, 0);
  await downloadCanvas(canvas, 'debug_13e_post_water_fill.png');

  return { waterOutlines };
}

// ============ Level Outline Vectorization ============

function traceLevelOutlines(grid: PixelGrid): {
  level2Outlines: [number, number][][];
  level3Outlines: [number, number][][];
} {
  // LEVEL3 region: only cells classified as LEVEL3
  const level3Set = new Set<number>();
  for (let i = 0; i < grid.primary.length; i++) {
    if (grid.primary[i] === TERRAIN.LEVEL3) level3Set.add(i);
  }
  const level3Outlines = traceTerrainOutline(level3Set);

  // LEVEL2 region: cells classified as LEVEL2 or LEVEL3 (level2 "contains" level3)
  const level2Set = new Set<number>();
  for (let i = 0; i < grid.primary.length; i++) {
    if (grid.primary[i] === TERRAIN.LEVEL2 || grid.primary[i] === TERRAIN.LEVEL3) level2Set.add(i);
  }
  const level2Outlines = traceTerrainOutline(level2Set);

  console.log(`Level outlines: L2=${level2Outlines.length} polygons, L3=${level3Outlines.length} polygons`);
  return { level2Outlines, level3Outlines };
}

// ============ V2 Map Assembly ============

async function buildAndLoadV2Map(
  pathOutlines:   [number, number][][],
  waterOutlines:  [number, number][][],
  level2Outlines: [number, number][][],
  level3Outlines: [number, number][][],
  edgeAssetIndices: number[],
  objectGroups: Record<string, number[]>,
): Promise<void> {
  // Flatten a vertex array to the [x1,y1,x2,y2,...] format expected by decodeDrawing
  const flatPoly = (verts: [number, number][]) => verts.flatMap(([x, y]) => [x, y]);

  // level1: always the full-island rectangle
  const level1Path = [0, 0, ISLAND_COORD_WIDTH, 0, ISLAND_COORD_WIDTH, ISLAND_COORD_HEIGHT, 0, ISLAND_COORD_HEIGHT];

  // Encode a set of polygons as single path or CompoundPath (array of paths)
  const encodePaths = (polys: [number, number][][]): number[] | number[][] => {
    if (polys.length === 0) return [];
    if (polys.length === 1) return flatPoly(polys[0]);
    return polys.map(flatPoly);
  };

  const drawing: Record<string, number[] | number[][]> = {
    level1: [level1Path], // CompoundPath with one child (full rectangle)
  };

  if (level2Outlines.length > 0) drawing['level2'] = encodePaths(level2Outlines);
  if (level3Outlines.length > 0) drawing['level3'] = encodePaths(level3Outlines);
  if (waterOutlines.length > 0)  drawing['water']  = encodePaths(waterOutlines);
  if (pathOutlines.length > 0)   drawing['pathDirt'] = encodePaths(pathOutlines);

  const v2Map: Record<string, unknown> = {
    version: 'v2',
    drawing,
    edgeTiles: edgeAssetIndices,
  };
  if (Object.keys(objectGroups).length > 0) {
    v2Map['objects'] = objectGroups;
  }

  const jsonStr = JSON.stringify(v2Map);
  console.log(`Generate from Screenshot: loading v2 map (${jsonStr.length} bytes)...`);
  loadMapFromJSONString(jsonStr);
  console.log('Generate from Screenshot: v2 map loaded');
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

export async function generateFromScreenshot(options: GenerateOptions = {}): Promise<void> {
  const { debug = true, onProgress, onFileSelected } = options;
  skipDebug = !debug;

  // Progress reporting — keep TOTAL_STEPS in sync with reportProgress() calls below
  const TOTAL_STEPS = 13;
  let currentStep = 0;
  const reportProgress = () => { currentStep++; onProgress?.(currentStep, TOTAL_STEPS); };

  console.log('Generate from Screenshot: starting...');

  // 1. Open file dialog
  let file: File;
  try {
    file = await openImageFileDialog();
  } catch {
    console.log('Generate from Screenshot: cancelled');
    skipDebug = false;
    return;
  }

  onFileSelected?.();

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

  // Set up zip accumulator for all debug images (lazy-import JSZip, never loaded at startup)
  if (!skipDebug) {
    const JSZip = (await import('jszip')).default;
    debugZip = new JSZip();
  }

  reportProgress(); // step 1: image loaded

  // 4. Detect top boundary (rock cliff edge)
  console.log('Generate from Screenshot: detecting top boundary...');
  const topResult = detectTopBoundary(data, width, height);
  if (topResult.boundaryY !== null) {
    console.log(`Generate from Screenshot: top boundary at y=${topResult.boundaryY}`);
  } else {
    console.warn('Generate from Screenshot: could not detect top boundary');
  }
  await saveTopBoundaryDebug(image, topResult, width);

  reportProgress(); // step 2: top boundary

  // 5. Detect bottom boundary (beach edge)
  console.log('Generate from Screenshot: detecting bottom boundary...');
  const bottomResult = detectBottomBoundary(data, width, height);
  if (bottomResult.boundaryY !== null) {
    console.log(`Generate from Screenshot: bottom boundary at y=${bottomResult.boundaryY}`);
  } else {
    console.warn('Generate from Screenshot: could not detect bottom boundary');
  }
  await saveBottomBoundaryDebug(image, bottomResult, width);

  reportProgress(); // step 3: bottom boundary

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
    await saveLeftBoundaryDebug(image, leftResult, topResult.boundaryY, bottomResult.boundaryY);

    console.log('Generate from Screenshot: detecting right boundary...');
    rightResult = detectRightBoundary(data, width, height, topResult.boundaryY, bottomResult.boundaryY);
    if (rightResult.boundaryX !== null) {
      console.log(`Generate from Screenshot: right boundary at x=${rightResult.boundaryX}`);
    } else {
      console.warn('Generate from Screenshot: could not detect right boundary');
    }
    await saveRightBoundaryDebug(image, rightResult, topResult.boundaryY, bottomResult.boundaryY);
  } else {
    console.warn('Generate from Screenshot: skipping left/right detection — top/bottom boundaries required');
  }

  reportProgress(); // step 4: left/right boundaries

  // 8. Derive full island extents from all 4 boundaries
  if (topResult.boundaryY === null || bottomResult.boundaryY === null) {
    console.warn('Generate from Screenshot: cannot derive extents — top/bottom boundary detection failed');
    if (!skipDebug && debugZip) {
      const earlyZipBlob = await debugZip.generateAsync({ type: 'blob' });
      debugZip = null;
      const earlyZipLink = document.createElement('a');
      earlyZipLink.href = URL.createObjectURL(earlyZipBlob);
      earlyZipLink.download = 'debug_screenshot.zip';
      earlyZipLink.click();
    }
    console.log('Generate from Screenshot: done (early exit)');
    skipDebug = false;
    throw new Error('Could not detect island boundaries in the screenshot.');
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
  await saveExtentsDebug(image, extents);

  // debug_06: remove white gridline overlay from raw pixel data before any classification
  console.log('Generate from Screenshot: removing gridline overlay...');
  const gridlineCorrected = removeGridlineOverlay(data, width, height, extents);
  await saveGridlineRemovalDebug(image, data, width, height, gridlineCorrected);

  reportProgress(); // step 5: extents + gridline removal

  // 9. detect objects and fill them with a placeholder color or specific color
  // objects include location marker, player house, house, residence services, museum, shop, tailor, stairs

  // 10. Pixelize screenshot into terrain grid with diagonal detection
  console.log('Generate from Screenshot: pixelizing to terrain grid...');
  const pixelGrid = pixelateScreenshot(data, width, height, extents);

  reportProgress(); // step 6: terrain grid

  // 10.5 Match edge tiles against reference library
  console.log('Generate from Screenshot: matching edge tiles...');
  const edgeResult = matchEdgeTiles(pixelGrid);
  const edgeAssetIndices = edgeResult.assetIndices; // eslint-disable-line @typescript-eslint/no-unused-vars
  // edgeAssetIndices will be used when building the final v2 map output
  await saveEdgeTileDebug(image, extents, edgeResult);  // debug_07

  reportProgress(); // step 7: edge tiles

  // Color keys identifying stair and bridge color groups
  const STAIRS_KEY = colorKey({ r: 0xF5, g: 0xDE, b: 0x99 });
  const BRIDGE_KEY = colorKey({ r: 0x7F, g: 0x82, b: 0x67 });
  const STAIR_BRIDGE_KEYS = new Set([STAIRS_KEY, BRIDGE_KEY]);

  // 10.5b Pass 1: Detect all non-stair/bridge icons
  console.log('Generate from Screenshot: detecting regular map icons (pass 1)...');
  const regularResult = await detectMapIcons(data, width, height, extents, pixelGrid, undefined, STAIR_BRIDGE_KEYS);
  const regularIcons = regularResult.icons; // eslint-disable-line @typescript-eslint/no-unused-vars

  // debug_08: regular icon detection overlays
  await saveIconDetectionDebug(image, extents, regularIcons, 'debug_08_icon_detection.png');

  // Fill regular icon regions at pixel level with surrounding terrain color
  await fillIconRegionsWithTerrain(data, width, extents, pixelGrid, regularIcons);
  // debug_09: pixel data after regular icon fill
  await savePostIconFillDebug(data, width, height);

  reportProgress(); // step 8: regular icons

  // 10.5c Edge fill: paint edge block sand/rock pixels to level1 in raw pixel data,
  // then update terrain grid. Must happen before stair/bridge detection so sand ≈ stair
  // color false positives are eliminated from the pixel canvas.

  // Snapshot water cells BEFORE edge fill converts them to LEVEL1
  const preEdgeWaterCells = new Uint8Array(pixelGrid.primary.length);
  for (let i = 0; i < pixelGrid.primary.length; i++) {
    if (pixelGrid.primary[i] === TERRAIN.WATER) preEdgeWaterCells[i] = 1;
  }

  // debug_10a: pixel data BEFORE edge extra fill expansion
  if (!skipDebug) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const cx = c.getContext('2d')!;
    const id = cx.createImageData(width, height);
    id.data.set(data);
    cx.putImageData(id, 0, 0);
    await downloadCanvas(c, 'debug_10a_pre_edge_extra_fill.png');
  }
  fillEdgeRegionsInScreenshot(data, width, height, extents, edgeResult);
  // debug_10b: pixel data AFTER edge extra fill expansion
  if (!skipDebug) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const cx = c.getContext('2d')!;
    const id = cx.createImageData(width, height);
    id.data.set(data);
    cx.putImageData(id, 0, 0);
    await downloadCanvas(c, 'debug_10b_post_edge_extra_fill.png');
  }
  fillEdgeRegionsWithLevel1(pixelGrid);
  // debug_10: pixel data after edge fill
  await saveEdgeFillDebug(data, width, height, extents, pixelGrid);

  reportProgress(); // step 9: edge fill

  // 10.5d Pass 2: Detect stairs (custom stripe-pattern) and bridges (existing detection)
  console.log('Generate from Screenshot: detecting stairs (pass 2)...');
  const stairResult = await detectStairs(data, width, height, extents);

  console.log('Generate from Screenshot: detecting bridges (pass 2)...');
  const bridgeResult = await detectMapIcons(data, width, height, extents, pixelGrid, new Set([BRIDGE_KEY]), undefined);

  const stairBridgeIcons = [...stairResult.icons, ...bridgeResult.icons]; // eslint-disable-line @typescript-eslint/no-unused-vars
  const combinedBlobDebug = [...stairResult.blobDebug, ...bridgeResult.blobDebug];

  // debug_11: blob detection results for stairs/bridges
  await saveBlobDetectionDebug(data, width, height, combinedBlobDebug);
  // debug_12: stair/bridge icon detection overlays
  await saveIconDetectionDebug(image, extents, stairBridgeIcons, 'debug_12_stair_bridge_detection.png', data);

  // Fill stair/bridge icon regions
  await fillIconRegionsWithTerrain(data, width, extents, pixelGrid, stairBridgeIcons);
  // debug_13: pixel data after stair/bridge fill
  await savePostStairBridgeFillDebug(data, width, height);

  reportProgress(); // step 10: stairs/bridges

  // Post-fill pass: find and erase the orange building-indicator icon (if present anywhere on map)
  await detectAndFillBuildingIndicator(data, width, height, extents, pixelGrid);

  reportProgress(); // step 11: building indicator

  // All detected icons combined (for final map output)
  const detectedIcons = [...regularIcons, ...stairBridgeIcons]; // eslint-disable-line @typescript-eslint/no-unused-vars
  // detectedIcons (and detectedIconsToObjectGroups()) will be used when building the final v2 map output

  // 12a. Detect and fill path pixels; vectorize for future SVG output
  const { polylines: pathPolylines, pathOutlines } = // eslint-disable-line @typescript-eslint/no-unused-vars
    await processPathPixels(data, width, height, extents, pixelGrid);

  // 12b. Detect and fill water pixels; vectorize water region outline
  const { waterOutlines } = await processWaterPixels(data, width, height, extents, pixelGrid, preEdgeWaterCells);

  // 12c. Vectorize terrain level outlines from the final grid state
  const { level2Outlines, level3Outlines } = traceLevelOutlines(pixelGrid);

  // debug_14a/b: pixel grid (after path + water fill — no PATH or WATER cells should remain)
  await savePixelGridDebug(pixelGrid);

  reportProgress(); // step 12: path + water + level outlines

  // Download all debug images as a single zip
  if (!skipDebug && debugZip) {
    const zipBlob = await debugZip.generateAsync({ type: 'blob' });
    debugZip = null;
    const zipLink = document.createElement('a');
    zipLink.href = URL.createObjectURL(zipBlob);
    zipLink.download = 'debug_screenshot.zip';
    zipLink.click();
  }

  // 13. Assemble and load the v2 map
  const objectGroups = detectedIconsToObjectGroups(detectedIcons);
  await buildAndLoadV2Map(pathOutlines, waterOutlines, level2Outlines, level3Outlines,
    edgeResult.assetIndices, objectGroups);

  reportProgress(); // step 13: map assembled and loaded

  console.log('Generate from Screenshot: done');
  skipDebug = false;
}
