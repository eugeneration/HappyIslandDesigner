// Terrain type enum for classification
enum TerrainType {
  Water = 0,
  Sand = 1,
  Rock = 2,
  Grass = 3,
  Unknown = 4
}

// SVG tile data paths
const SVG_TILES = [
  'static/tiles_data/placeholder_bottom.svg',
  'static/tiles_data/placeholder_bottom_left.svg',
  'static/tiles_data/placeholder_bottom_right.svg',
  'static/tiles_data/placeholder_bottom_river.svg',
  'static/tiles_data/placeholder_left.svg',
  'static/tiles_data/placeholder_left_river.svg',
  'static/tiles_data/placeholder_right.svg',
  'static/tiles_data/placeholder_right_river.svg',
  'static/tiles_data/placeholder_top.svg',
  'static/tiles_data/placeholder_top_left.svg',
  'static/tiles_data/placeholder_top_right.svg',
  'static/tiles_data/placeholder_top_secret_beach.svg',
];

// Grid size for signature (16x16 = 256 cells)
const GRID_SIZE = 16;

type TileSignature = Uint8Array; // GRID_SIZE * GRID_SIZE terrain types

export class TileImageMatcher {
  private svgSignatures: Map<string, TileSignature> = new Map();
  private initialized = false;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    // Create offscreen canvas for image processing
    this.canvas = document.createElement('canvas');
    this.canvas.width = GRID_SIZE;
    this.canvas.height = GRID_SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  // Initialize by pre-computing SVG signatures
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const promises = SVG_TILES.map(async (svgPath) => {
      const signature = await this.computeSvgSignature(svgPath);
      this.svgSignatures.set(svgPath, signature);
    });

    await Promise.all(promises);
    this.initialized = true;
  }

  // Compute signature for an SVG by rasterizing it
  private async computeSvgSignature(svgPath: string): Promise<TileSignature> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
        this.ctx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE);
        const imageData = this.ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
        resolve(this.computeSignature(imageData));
      };
      img.onerror = reject;
      img.src = svgPath;
    });
  }

  // Classify a pixel RGB to terrain type
  private classifyPixel(r: number, g: number, b: number): TerrainType {
    // Simple heuristics based on color channels
    // Water: high blue/green, teal tones
    // Sand: high red+green (yellow), low blue
    // Rock: similar R/G/B (grey)
    // Grass: high green, low red

    const isGrey = Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30;

    if (isGrey && r > 60 && r < 140) {
      return TerrainType.Rock;
    }

    // Check for water (teal/cyan - high green and blue)
    if (g > 150 && b > 150 && g > r) {
      return TerrainType.Water;
    }

    // Check for sand (yellowish - high red and green, lower blue)
    if (r > 180 && g > 180 && b < 180) {
      return TerrainType.Sand;
    }

    // Check for grass (green dominant)
    if (g > r && g > b && g > 80) {
      return TerrainType.Grass;
    }

    return TerrainType.Unknown;
  }

  // Compute signature from ImageData
  private computeSignature(imageData: ImageData): TileSignature {
    const signature = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const data = imageData.data;

    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const idx = i * 4;
      signature[i] = this.classifyPixel(data[idx], data[idx + 1], data[idx + 2]);
    }

    return signature;
  }

  // Compute signature from an HTMLImageElement or ImageBitmap
  computeImageSignature(image: HTMLImageElement | ImageBitmap): TileSignature {
    this.ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
    this.ctx.drawImage(image, 0, 0, GRID_SIZE, GRID_SIZE);
    const imageData = this.ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
    return this.computeSignature(imageData);
  }

  // Compare two signatures, return distance (lower = better match)
  private compareSignatures(a: TileSignature, b: TileSignature): number {
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) distance++;
    }
    return distance;
  }

  // Find best matching SVG for an image
  async findBestMatch(image: HTMLImageElement | ImageBitmap): Promise<{ path: string; distance: number } | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const imageSignature = this.computeImageSignature(image);

    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const [path, svgSignature] of this.svgSignatures) {
      const distance = this.compareSignatures(imageSignature, svgSignature);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = path;
      }
    }

    return bestMatch ? { path: bestMatch, distance: bestDistance } : null;
  }

  // Get all matches sorted by distance
  async findAllMatches(image: HTMLImageElement | ImageBitmap): Promise<Array<{ path: string; distance: number }>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const imageSignature = this.computeImageSignature(image);
    const matches: Array<{ path: string; distance: number }> = [];

    for (const [path, svgSignature] of this.svgSignatures) {
      const distance = this.compareSignatures(imageSignature, svgSignature);
      matches.push({ path, distance });
    }

    return matches.sort((a, b) => a.distance - b.distance);
  }
}

// Singleton instance (lazy initialized)
let matcherInstance: TileImageMatcher | null = null;

export function getTileImageMatcher(): TileImageMatcher {
  if (!matcherInstance) {
    matcherInstance = new TileImageMatcher();
  }
  return matcherInstance;
}
