// generateFromScreenshot.ts
// Analyzes an ACNH map screenshot to detect island boundaries and generate a v2 map.
// Step 1: Island extent detection via color-based boundary scanning.

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
};

// Result of per-cell diagonal detection
type CellResult = {
  primary: TerrainType;
  secondary: TerrainType;
  diagonal: DiagonalType;
  confidence: number; // 0–255
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

// Object marker colors and dimensions (for future detection steps)
// TODO: Object detection not yet implemented. Ideally use an image classifier
// for increased accuracy.
// - Amenity: fill #524F41, icon #EEEAE9
// - House: #FEB418, approx 4x4 island coords
// - Player house: #FF82AD, approx 5x4 island coords
// - Stairs: #F5D896, must be 4x2 island coords
// - Bridge: #808368, must be 3x2, 4x2, or 5x2 island coords

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

  // Grass levels: check from most distinctive (brightest) to least
  if (matchesAnyColor(pixel, SCREENSHOT_COLORS.LEVEL3_GRASS)) return TERRAIN.LEVEL3;
  if (matchesAnyColor(pixel, SCREENSHOT_COLORS.LEVEL2_GRASS)) return TERRAIN.LEVEL2;
  if (matchesAnyColor(pixel, SCREENSHOT_COLORS.LEVEL1_GRASS)) return TERRAIN.LEVEL1;

  // Fallback: green-channel heuristic for grass that doesn't match samples exactly
  // Screenshot grass green channels: L1 ~0x7C, L2 ~0xA5, L3 ~0xCA
  if (pixel.g > pixel.r && pixel.g > pixel.b) {
    if (pixel.g >= 0xB0) return TERRAIN.LEVEL3;
    if (pixel.g >= 0x90) return TERRAIN.LEVEL2;
    if (pixel.g >= 0x60) return TERRAIN.LEVEL1;
  }

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

// Classify a single cell as solid or diagonal based on its classified samples.
function detectCellContent(samples: ClassifiedSample[]): CellResult {
  // 1. Count terrain types across all samples
  const counts = new Map<TerrainType, number>();
  for (const s of samples) {
    counts.set(s.terrain, (counts.get(s.terrain) || 0) + 1);
  }

  // 2. Find dominant terrain
  let dominantTerrain: TerrainType = TERRAIN.UNKNOWN;
  let dominantCount = 0;
  for (const [terrain, count] of counts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantTerrain = terrain;
    }
  }

  // 3. If ≥80% of samples match → solid cell
  const total = samples.length;
  if (dominantCount / total >= 0.80) {
    return {
      primary: dominantTerrain,
      secondary: TERRAIN.UNKNOWN,
      diagonal: DIAGONAL.NONE,
      confidence: Math.round(255 * dominantCount / total),
    };
  }

  // 4. Find second most common terrain
  let secondTerrain: TerrainType = TERRAIN.UNKNOWN;
  let secondCount = 0;
  for (const [terrain, count] of counts) {
    if (terrain !== dominantTerrain && count > secondCount) {
      secondCount = count;
      secondTerrain = terrain;
    }
  }

  // 5. If second terrain is < 15% of samples → noise, treat as solid
  if (secondCount / total < 0.15) {
    return {
      primary: dominantTerrain,
      secondary: TERRAIN.UNKNOWN,
      diagonal: DIAGONAL.NONE,
      confidence: Math.round(255 * dominantCount / total),
    };
  }

  // 6. Score both diagonal orientations
  const backslashScore = scoreDiagonal(samples, dominantTerrain, secondTerrain, DIAGONAL.BACKSLASH);
  const slashScore = scoreDiagonal(samples, dominantTerrain, secondTerrain, DIAGONAL.SLASH);

  // 7. Accept diagonal if score ≥ 0.65
  const minDiagonalScore = 0.65;

  if (backslashScore >= slashScore && backslashScore >= minDiagonalScore) {
    const [primary, secondary] = getTriangleTerrains(
      samples, dominantTerrain, secondTerrain, DIAGONAL.BACKSLASH,
    );
    return {
      primary,
      secondary,
      diagonal: DIAGONAL.BACKSLASH,
      confidence: Math.round(255 * backslashScore),
    };
  } else if (slashScore >= minDiagonalScore) {
    const [primary, secondary] = getTriangleTerrains(
      samples, dominantTerrain, secondTerrain, DIAGONAL.SLASH,
    );
    return {
      primary,
      secondary,
      diagonal: DIAGONAL.SLASH,
      confidence: Math.round(255 * slashScore),
    };
  }

  // 8. Neither diagonal fits well → solid with dominant terrain
  return {
    primary: dominantTerrain,
    secondary: TERRAIN.UNKNOWN,
    diagonal: DIAGONAL.NONE,
    confidence: Math.round(255 * dominantCount / total),
  };
}

// Main pixelization function: sample the screenshot at each of the 112×96 island coordinates.
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

  let solidCount = 0;
  let diagonalCount = 0;

  for (let cy = 0; cy < ISLAND_COORD_HEIGHT; cy++) {
    for (let cx = 0; cx < ISLAND_COORD_WIDTH; cx++) {
      // Pixel bounds of this coordinate cell
      const cellLeft = fullLeft + cx * ppc;
      const cellTop = fullTop + cy * ppc;

      // Inset region to avoid edge bleed
      const inset = ppc * INSET_FRAC;
      const sampleLeft = cellLeft + inset;
      const sampleTop = cellTop + inset;
      const sampleWidth = ppc - 2 * inset;
      const sampleHeight = ppc - 2 * inset;

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
            });
          }
        }
      }

      // Classify cell
      const result = samples.length > 0
        ? detectCellContent(samples)
        : { primary: TERRAIN.UNKNOWN, secondary: TERRAIN.UNKNOWN, diagonal: DIAGONAL.NONE, confidence: 0 };

      const idx = cy * ISLAND_COORD_WIDTH + cx;
      grid.primary[idx] = result.primary;
      grid.diagonal[idx] = result.diagonal;
      grid.secondary[idx] = result.secondary;
      grid.confidence[idx] = result.confidence;

      if (result.diagonal === DIAGONAL.NONE) solidCount++;
      else diagonalCount++;
    }
  }

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
  savePixelGridDebug(pixelGrid);

  // 11. detect water pixels and fill them with their surrounding level
  // determine level of terrain under water by looking at pixels adjacent to terrain, layer must cut a straight line under the water

  // 12. detect paths and fill them with their surrounding level
  // try to detect curved corners, but don't try so hard
  // note: path editing will have to include a 'repaint' tool, as well as a curving tool
  // paths should also be inset

  console.log('Generate from Screenshot: done');
}
