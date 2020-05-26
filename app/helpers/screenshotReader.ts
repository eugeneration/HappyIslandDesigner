import { loadMapFromJSON } from "../load";

export function detectScreenshot() {
  // look for a particular aspect ratio

  // check that the entire perimeter has the same average color

}

//const colorsHex = {
//  ocean: '#79d6c3',
//  sand: '#ede5a3',
//  rock: '#757c8a',
//
//  level1: '#447b40',
//  level2: '#45a240',
//  level3: '#60c749',
//  level4: '',
//
//  amenityBack: '#757c8a',
//  amenityIcon: '#f6f5f2',
//
//  bridge: '#84856e',
//  dock: '#a28a61',
//
//  house: '#fbb91d',
//  playerHouse: '#fc85af',
//
//  markerRed: '#f36a2d',
//  markerWhite: '#eee1ad', // kind of off
//}

interface ColorProperties {
  color: Color,
  weight: number,
  minSize?: number,
  adjacency?: string[],
  under?: number[],
  xMin?: number,
  yMin?: number,
  xMax?: number,
  yMax?: number,
  name: string,
  index: number,
}

type ColorPropertiesPartial = Omit<ColorProperties, 'name' | 'index' | 'under'> & {
  under?: string[],
};

// todo: don't keep this giant dictionary in memory

const colorsPartial: Record<string, ColorPropertiesPartial> = {
  none: {
    color: [255, 0, 255],
    weight: 1000,
  },
  none1: {
    color: [255, 0, 100],
    weight: 1000,
  },
  none2: {
    color: [100, 0, 255],
    weight: 1000,
  },
  sand: {
    color: [237, 229, 163], // #ede5a3
    weight: 10,
    adjacency: ['water', 'level1'],
    under: ['rock', 'level1', 'level2', 'level3'],
    xMax: 13,
    yMax: 13,
  },
  rock: {
    color: [117, 124, 138], // #757c8a
    weight: 5,
    adjacency: ['water', 'sand', 'level1'],
    under: ['level1', 'level2', 'level3'],
    minSize: 20,
  },
  dock: {
    color: [162, 138,  97], // #a28a61
    weight: 1,
    minSize: 130,
    adjacency: ['water', 'sand'],
    yMax: 8,
  },
  water: {
    color: [121, 214, 195], // #79d6c3
    weight: 10,
    minSize: 5,
    adjacency: ['sand', 'level1'],
  },
  level1: {
    color: [ 68, 123,  64], // #447b40
    weight: 10,
    minSize: 5,
    adjacency: ['water', 'sand'],
    under: ['level2', 'level3'],
    yMin: 13,
  },
  level2: {
    color: [ 69, 162,  64], // #45a240
    weight: 10,
    minSize: 5,
    adjacency: ['level1', 'level3'],
    under: ['level3'],
    xMin: 13,
    yMin: 13,
  },
  level3: {
    color: [ 96, 199,  73], // #60c749
    weight: 10,
    minSize: 5,
    adjacency: ['level2'],
    xMin: 14,
    yMin: 14,
  },
  amenityBack: {
    color: [ 82,  78,  63], // #524e3f
    minSize: 20,
    weight: 3,
  },
  amenityIcon: {
    color: [246, 245, 242], // #f6f5f2
    weight: 3,
    minSize: 10,
    adjacency: ['amenityBack'],
  },
  bridge: {
    color: [132, 133, 110], // #84856e
    weight: 3,
    minSize: 100,
    adjacency: ['water', 'level1'],
    xMin: 14,
    yMin: 14,
  },
  house: {
    color: [251, 185,  29], // #fbb91d
    adjacency: ['sand'],
    minSize: 2,
    weight: 3,
  },
  playerHouse: {
    color: [252, 133, 175], // #fc85af
    adjacency: ['sand'],
    minSize: 40,
    weight: 3,
  },
  markerRed: {
    color: [243, 106,  45], // #f36a2d
    minSize: 200,
    weight: 3,
  },
  markerWhite: {
    color: [238, 225, 173], // #eee1ad
    weight: 3,
    minSize: 20,
  },
}
const colors: {[key: string]: ColorProperties} = {};
const colorArr: ColorProperties[] = [];
Object.keys(colorsPartial).forEach((colorName, index) => {
  const colorProperty: ColorProperties = {
    ...colorsPartial[colorName],
    under: undefined,
    name: colorName,
    index: index,
  }
  colors[colorName] = colorProperty;
  colorArr.push(colorProperty);
});
Object.keys(colors).forEach(colorName => {
  colors[colorName].under = colorsPartial[colorName].under?.map(name => colors[name].index) || undefined;
})

const amenityColors = [
  'amenityBack',
  'amenityIcon',
  'house',
  'playerHouse',
  'markerRed',
//  'markerWhite',
];

const outerColors = [
  'sand',
  'rock',
  'dock',
  'water',
  'level1',
];

const innerColors = [
  'water',
  'level1',
  'level2',
  'level3',
  'bridge',
];

const amenityColorArr: ColorProperties[] = amenityColors.map(name => colors[name]);
const innerColorArr: ColorProperties[] = innerColors.map(name => colors[name]).concat(amenityColorArr);
const outerColorArr: ColorProperties[] = outerColors.map(name => colors[name]).concat(amenityColorArr);

console.log(innerColorArr, outerColorArr);

var img = new Image();
img.src = 'static/screenshots/79497106-71d3b080-8027-11ea-806b-7f268b461b36.jpg';
readMapFromScreenshot(img);

type Color = [number, number, number];

type Coord = [number, number];

interface Point {
  x: number,
  y: number,
}
function Point(x, y): Point {return {x,y};}

interface Rect {
  p0: Point,
  p1: Point,
  width: number,
  height: number,
}
function Rect(p0, p1): Rect {return {p0, p1, width: Math.abs(p0.x - p1.x), height: Math.abs(p0.y - p1.y)};}

const screenshotDimensions = Point(1280, 720);
const tileDimensions = Point(112, 96);

const p0 = Point(951, 631)
const px = 85.3;

const p0xPercent = (p0.x - px * 7) / screenshotDimensions.x;
const p1xPercent = p0.x / screenshotDimensions.x;
const p0yPercent = p0.y / screenshotDimensions.y;
const p1yPercent = (p0.y - px * 6) / screenshotDimensions.y;
const screenshotRectangle = (canvasWidth: number, canvasHeight: number) => Rect(
  Point(p0xPercent * canvasWidth, p0yPercent * canvasHeight),
  Point(p1xPercent * canvasWidth, p1yPercent * canvasHeight),
);
const density = 6;

const resizedDimensions = Point(tileDimensions.x * density, tileDimensions.y * density);
const byteWidth = resizedDimensions.x * 4;

export function readMapFromScreenshot(rawImg) {
  loadImage(rawImg).then(async image => {
    const rawCanvas = await screenshotCanvas(image);
    image.remove();
    const cropCanvas = await crop(rawCanvas, screenshotRectangle(rawCanvas.width, rawCanvas.height));
    rawCanvas.remove();

    // todo: get the houses and amenity locations
    // await featureMatching(cropCanvas);

    await resize(cropCanvas, Point(tileDimensions.x * density, tileDimensions.y * density));

    getColors(cropCanvas).then(canvas => {
      // canvas.style.position = "absolute";
      // canvas.style.top = '0';
      // canvas.style.width = '100%';
      // canvas.style['image-rendering'] = 'pixelated';
      // document.body.appendChild(canvas);
      canvas.remove();
    });
  });
}

function loadImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => {resolve(image)};
    image.onerror = err => reject(err);
  });
}

function screenshotCanvas(image: HTMLImageElement): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.height = image.height;
  canvas.width = image.width;
  const canvasCtx = canvas.getContext('2d');
  canvasCtx?.drawImage(image, 0, 0);

  return new Promise<HTMLCanvasElement>((resolve) => {
    console.log(canvas.width, canvas.height, canvas.width/canvas.height);
    if (canvas.width != screenshotDimensions.x || canvas.height != screenshotDimensions.y) {
      // todo: don't resize here - use percentage dimensions to get the crop area and then resize once later
      // @ts-ignore
      import("hermite-resize").then(hermiteModule => {
        const hermite = new hermiteModule.default();
        hermite.resample(canvas, screenshotDimensions.x, screenshotDimensions.y, true, () => resolve(canvas));
      });
    } else {
      resolve(canvas);
    }
  });
}

async function crop(canvas: HTMLCanvasElement, rect: Rect) {
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = rect.width;
  cropCanvas.height = rect.height;
  const cropCanvasCtx = cropCanvas.getContext('2d');
  cropCanvasCtx?.drawImage(canvas, rect.p0.x, rect.p1.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  canvas.remove();

  return cropCanvas;
}

// async function featureMatching(canvas: HTMLCanvasElement) {
//   const canvasCtx = canvas.getContext('2d');
//   if (canvasCtx == null) throw "invalid canvas";

//   import('tracking').then(tracking => {
//     console.log(tracking.default);
//   });
// }

async function resize(canvas: HTMLCanvasElement, scale: Point) {
  return new Promise<HTMLCanvasElement>((resolve) => {
    if (canvas.width === scale.x && canvas.height === scale.y) resolve(canvas);
    import("hermite-resize").then(hermiteModule => {
      const hermite = new hermiteModule.default();
      hermite.resample(canvas, scale.x, scale.y, true, () => resolve(canvas));
    });
    //const canvasCtx = canvas.getContext('2d');
    //const originalWidth = canvas.width;
    //const originalHeight = canvas.height;
    //canvas.width = scale.x;
    //canvas.height = scale.y;
    //canvasCtx?.drawImage(canvas, 0, 0, originalWidth, originalHeight, 0, 0, canvas.width, canvas.height);
    //resolve(canvas);
  });
}

async function getColors(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const canvasCtx = canvas.getContext('2d');
  if (canvasCtx == null) throw "invalid canvas";
  const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
  const colorBytes = imageData.data;

  {
    let index = 0;

    for (let y = 0; y < canvas.height; y++) {
      const tileY = (y / density)
      for (let x = 0; x < canvas.width; x++) {
        const tileX = (x / density)
        const isInside = Math.abs(canvas.width / 2 - x) < (canvas.width / 2 - 13 * density) && Math.abs(canvas.height / 2 - y) < (canvas.height / 2 - 13 * density);
        const isDotted = isInside && (
          (tileX + 0.2) % 16 < .6 && (tileY + 0.6) % 2 < 1.2
          || (tileY + 0.3) % 16 < .6  && (tileX + 0.6) % 2 < 1.2
        );

        //const color = nearestColor([colorBytes[index], colorBytes[index + 1], colorBytes[index + 2]]);
        const colorPossibilities = isInside ? innerColorArr : outerColorArr;
        const colorBalance = isDotted ? -25 : 0;
        const [colorIndex, distSq] = nearestColor(
          [colorBytes[index] + colorBalance,
            colorBytes[index + 1] + colorBalance,
            colorBytes[index + 2] + colorBalance
          ],
          colorPossibilities);

        colorBytes[index+0] = colorIndex;//isInside ? 255 : color[0];
        colorBytes[index+1] = 0;
        colorBytes[index+2] = 0;//isDotted ? 255 : color[2];
        colorBytes[index+3] = distSq;
        index += 4;
      }
    }
  }

  //function magicWandLimitSize(
  //  x: number,
  //  y: number,
  //  bytes: Uint8ClampedArray,
  //) {
  //  let index = x * 4 + y * byteWidth;
  //  if (bytes[index + 1] > 0) return;
//
  //  const targetColor = bytes[index];
  //  const boundaryColors: Map<number, number> = new Map;
  //  const boundary: number[] = [];
  //  const interior: number[] = [];
  //  const queue: number[] = [index];
  //}

//  function coordToByte(c: Coord): number {
//    return c[0] * 4 + c[1] * byteWidth;
//  }

  function pointToByte(x: number, y: number): number {
    return x * 4 + y * byteWidth;
  }

  function byteToCoord(i: number): Coord {
    return [(i % byteWidth) / 4, ~~(i / byteWidth)];
  }

  const tileToTileIndex = (x: number, y: number): number => y * tileDimensions.x + x;
  const tileToByte = (x: number, y: number): number => {
    return pointToByte(x * density, y * density);
  }
  const tileIndexToTile = (i: number): Coord => [i % tileDimensions.x, ~~(i / tileDimensions.x)];
  //const tileIndexToByte = (i: number): number => {
  //  var tileCoord = tileIndexToTile(i);
  //  return tileToByte(tileCoord);
  //}

  function noiseReduction(
    x: number,
    y: number,
    bytes: Uint8ClampedArray,
  ) {
    return magicWandOuterBoundary(x, y, bytes, {}, {});
  }

  function simpleInfill(
    x: number,
    y: number,
    bytes: Uint8ClampedArray,
  ) {
    return magicWandOuterBoundary(x, y, bytes, {}, {}, true);
  }

  // we assume the r pixel has the color index
  function magicWandOuterBoundary(
    x: number,
    y: number,
    bytes: Uint8ClampedArray,
    merge: {[key: number]: boolean},
    transformations: {[key: number]: number},
    fill?: boolean,
  ) {
    let index = pointToByte(x, y);
    if (bytes[index + 1] > 0) return {};

    const targetColor = bytes[index];
    const boundaryColors: Map<number, number> = new Map;
    const boundary: number[] = [];
    const interior: number[] = [];
    const queue: number[] = [index];

    let xMin, yMin, xMax, yMax;

    while (queue.length > 0) {
      const i = queue.pop() ?? 0;
      const color = bytes[i];
      if (targetColor !== color && merge[color] == null) { // todo: merge is dangerous if there is a single rouge pixel
        boundary.push(i);
        boundaryColors.set(color, (boundaryColors.get(color) || 0) + 1);
      }
      else if (bytes[i + 1] === targetColor) continue;
      else {
        bytes[i + 1] = targetColor;
        interior.push(i);
        if (x > 0) queue.push(i + 4);
        if (x < resizedDimensions.x - 1) queue.push(i - 4);
        if (y > 0) queue.push(i - byteWidth);
        if (y < resizedDimensions.y - 1) queue.push(i + byteWidth);
        bytes[i] = targetColor;

        const coord = byteToCoord(i);
        if (xMin == null || coord[0] < xMin) { xMin = coord[0]; }
        if (xMax == null || coord[0] > xMax) { xMax = coord[0]; }
        if (yMin == null || coord[1] < yMin) { yMin = coord[1]; }
        if (yMax == null || coord[1] > yMax) { yMax = coord[1]; }
      }

      const transformColor = transformations[bytes[i]];
      if (transformColor) bytes[index] = transformColor;
    }

    let boundaryColor: number;
    boundaryColors.forEach((count, color) => {
      if (boundaryColor == null || ((boundaryColors.get(boundaryColor) ?? 0) < count)) {
        boundaryColor = color;
      }
    })

//    if (fill) console.log(colorArr[targetColor].name, '=>', colorArr[boundaryColor].name)

    var minSize = colorArr[targetColor].minSize;
    if (fill || minSize && interior.length < minSize || xMin == xMax || yMin == yMax) {
      interior.forEach(i => bytes[i] = boundaryColor);

      // clear arrays
      interior.length = 0;
      boundary.length = 0;
    }

    return {
      interior,
      boundary,
      boundaryColor,
    };
  }

  function forEachTile(tileAction: (tileIndex: number, x: number, y: number) => void, vertical = false) {
    forEachCell(tileAction, tileDimensions.x, tileDimensions.y, 1, vertical);
  }

  function forEachPixel(pixelAction: (pixelIndex: number, x: number, y: number) => void, vertical = false) {
    forEachCell(pixelAction, resizedDimensions.x, resizedDimensions.y, 4, vertical);
  }

  function forEachCell(callback: (index: number, x: number, y: number) => void, width: number, height: number, cellSize: number, vertical = false) {
    let index = 0;
    if (vertical) {
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          callback(index, x, y);
          index += width * cellSize;
        }
        index = x * cellSize;
      }
    } else {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          callback(index, x, y);
          index += cellSize;
        }
      }
    }
  }

  {
    // go through through the image horizontally and vertically
    let colorIndices: number[];
    let currentLine = -1;
    let prevColor: number;
    let prevColorIndex: number;
    let prevIndex: number;
    let currentColor: number;

    const denoise = (index, x, y, vertical = false) => {
      const color = colorBytes[index];

      if (vertical && y < 13 * density)  return; // ingore the top area of thin

      const line = vertical ? x : y;
      if (line !== currentLine) {
        colorIndices = [index];
        currentLine = line;
        prevColor = color;
        currentColor = color;
      }
      else if (color === currentColor) {
        colorIndices.push(index);
      }
      else {
        if (colorIndices.length <= 3 && (currentColor !== colors.markerWhite.index && currentColor !== colors.amenityIcon.index)) {
          // fill first half with prev, second half with next
          const width = colorIndices.length;
          const halfWidth = Math.floor(width / 2);
          for (let i = 0; i < width; i++) {
            let c: number;
            if (i <= halfWidth) c = prevColor;
            if (i >= width - halfWidth) c = color;
            else { // the middle value
              // choose whichever side has a smaller color distance, stored in the alpha channel
              c = color === prevColor ? color
                : colorBytes[prevColorIndex + 3] < colorBytes[index + 3] ? prevColor : color;
            }
            colorBytes[colorIndices[i]] = c;
          }
        }
        prevColor = currentColor;
        prevColorIndex = prevIndex;
        colorIndices = [index];
        currentColor = color;
      }
      prevIndex = index;
    }

    forEachPixel((index, x, y) => denoise(index, x, y)) // horizontal
    forEachPixel((index, x, y) => denoise(index, x, y, true), true) // vertical
  }

  // handle the marker first, as its white border potentially conflicts with the amenities
  forEachPixel((index, x, y) => {
    var colorIndex = colorBytes[index];
    switch (colorIndex) {
      case colors.markerRed.index:
        magicWandOuterBoundary(x, y, colorBytes, {[colors.markerWhite.index]: true}, {});
        break;
      case colors.markerWhite.index:
        magicWandOuterBoundary(x, y, colorBytes, {}, {});
        break;
      case colors.bridge.index: {// bridge overlaps with a lot of features
        const {interior, boundaryColor} = noiseReduction(x, y, colorBytes);
        if (boundaryColor != colors.water.index) // bridge is mostly surrounded by water
          interior?.forEach(i => colorBytes[i] = boundaryColor ?? 0);
        break;
      }
      case colors.level1.index:
      case colors.level2.index:
      case colors.level3.index:
      case colors.water.index:
      case colors.playerHouse.index:
      case colors.house.index:
        noiseReduction(x, y, colorBytes);
        break;
      case colors.dock.index:
        magicWandOuterBoundary(x, y, colorBytes, {}, {});
        break;
    }
  });

  forEachPixel(i => {
    colorBytes[i + 1] = 0;
  });

  /*
  function centerOfMass(indices: number[], round): Coord {
    var avgCoord: Coord = [0, 0];
    indices.forEach(i => {
      var coord = byteToCoord(i);
      avgCoord[0] += coord[0];
      avgCoord[1] += coord[1];
    });
    avgCoord = [avgCoord[0] / indices.length, avgCoord[1] / indices.length];

    if (round) return [Math.round(avgCoord[0]), Math.round(avgCoord[1])];
    return avgCoord;
  }

  const maskBuffer = new Uint8ClampedArray(resizedDimensions.x * resizedDimensions.y);
*/

  // remove all non-terrain features
  forEachPixel((index, x, y) => {
    var colorIndex = colorBytes[index];
    switch (colorIndex) {
      case colors.markerRed.index:
      case colors.playerHouse.index:
      case colors.house.index:
      case colors.amenityBack.index:
        simpleInfill(x, y, colorBytes);
        break;
      case colors.amenityIcon.index: {
        const noiseInterior = noiseReduction(x, y, colorBytes).interior;
        noiseInterior?.forEach(i => colorBytes[i+1] = 0)

        const {interior} = magicWandOuterBoundary(x, y, colorBytes, {
          [colors.markerWhite.index]: true,
          //[colors.water.index]: true,
          [colors.bridge.index]: true}, {});

        interior?.forEach(i => colorBytes[i+1] = 0)

        simpleInfill(x, y, colorBytes);
        break;
      }
      case colors.rock.index:
        noiseReduction(x, y, colorBytes);
        break;
      //case colors.playerHouse.index: {
        //var fill = magicWandOuterBoundary(x, y, colorBytes, {}, {});
        //if (fill.length > 0) {
        //  var center = centerOfMass(fill, true);
        //  colorBytes[coordToByte(center)] = 0;
        //}
      //  break;
      //}
    }
  });

  function generatorForEach<T>(colorGenerator: Generator<T, void>, callback: (value: T) => any) {
    let result = colorGenerator.next();
    while (!result.done) {
      callback(result.value);
      result = colorGenerator.next();
    }
  }

  function getMajorityDelta (colorGenerator: Generator<number, void>):
  {
    delta: number,
    colorCount: Map<number, number>,
    sortedColors: number[],
  } {
    let colorCount: Map<number, number> = new Map();

    let total = 0;
    generatorForEach(colorGenerator, color => {
      colorCount.set(color, (colorCount.get(color) ?? 0) + 1);
      total++;
    });

    const sortedColors = Array.from(colorCount.keys()).sort(
      (a, b) => (colorCount.get(a) ?? 0) - (colorCount.get(b) ?? 0)).reverse();

    const leader = (colorCount.get(sortedColors[0]) ?? 0) / total;
    const runnerUp = (colorCount.get(sortedColors[1]) ?? 0) / total;

    return {
      delta: leader - runnerUp,
      colorCount,
      sortedColors,
    };
  }

  function* fullTile(startingIndex: number, bytes: Uint8ClampedArray) {
    let i = startingIndex;
    for (let y = 0; y < density; y++) {
      for (let x = 0; x < density; x++) {
        const cellX = x * 4;
        yield bytes[i + cellX];
      }
      i += byteWidth;
    }
  }

  // function* triangle(
  //   right: boolean,
  //   top: boolean,
  //   offset: number,
  //   startingIndex: number,
  //   bytes: Uint8ClampedArray) {
  //   for (let i = 0; i < density - offset; i++) {
  //     const y = top ? i : density - 1 - i;
  //     for (let j = 0; j < density - i - offset; j++) {
  //       const x = right ? density - 1 - j : j;
  //       yield bytes[startingIndex + x * 4 + y * byteWidth];
  //     }
  //   }
  // }

  // function isPair(sortedColors: number[], color1: number, color2: number) {
  //   return sortedColors[0] === color1 && sortedColors[1] === color2
  //     || sortedColors[1] === color1 && sortedColors[0] === color2;
  // }

  // xy can go to the edges
  const vertexWidth = tileDimensions.x + 1;
  function xyToVertexIndex(x: number, y: number) {
    return x + y * vertexWidth;
  }
  function vertexIndexToXY(coord: number): Coord {
    return [coord % vertexWidth, ~~(coord / vertexWidth)];
  }

  const tiles = new Uint8ClampedArray(tileDimensions.x * tileDimensions.y);
  const deltas = new Float32Array(tileDimensions.x * tileDimensions.y);

  // super simplified version of below
  let index = 0;
  let tileIndex = 0;

  for (let tiley = 0; tiley < tileDimensions.y; ++tiley) {
    for (let tilex = 0; tilex < tileDimensions.x; ++tilex) {
      const {delta, sortedColors} = getMajorityDelta(fullTile(index, colorBytes))
      deltas[tileIndex] = delta;
      tiles[tileIndex] = sortedColors[0];
      tileIndex++;
      index += density * 4;
    }
    index += byteWidth * (density - 1);
  }
  // let index = 0;
  // let tileIndex = 0;
  // let diagonalFlag = colorArr.length;
  // let diagonals: {[key: number]: number[]} = {};
  // for (let tiley = 0; tiley < tileDimensions.y; ++tiley) {
  //   for (let tilex = 0; tilex < tileDimensions.x; ++tilex) {


  //     const {delta, sortedColors/*, colorCount*/} = getMajorityDelta(fullTile(index, colorBytes))

  //     if (sortedColors.length == 1) {
  //       tiles[tileIndex] = sortedColors[0];
  //     } else {
  //       let threshold = 0.8;

  //       if (delta > threshold) { // if strong majority, declare this a solid tile
  //         tiles[tileIndex] = sortedColors[0];
  //       }
  //       else if (delta > 0.25) {
  //         threshold = .55;
  //         //console.log(delta, colorCount);
  //         const {delta: tlDelta, sortedColors: tlSortedColors} = getMajorityDelta(triangle(false, true, 0, index, colorBytes));
  //         const {delta: brDelta, sortedColors: brSortedColors} = getMajorityDelta(triangle(true, false, 0, index, colorBytes));
  //         const tlbrDelta = (tlDelta + brDelta) / 2;
  //         const tlbrValid = tlbrDelta > threshold && isPair(sortedColors, tlSortedColors[0], brSortedColors[0]);

  //         if (tlbrValid) {
  //           //console.log('tlbr', tlSortedColors[0], brSortedColors[0]);
  //           tiles[tileIndex] = colors.house.index;
  //           diagonals[tileIndex] = [tileIndex, 1, tlSortedColors[0], brSortedColors[0], tlbrDelta];
  //         } else {
  //           // bottom left / top right
  //           const {delta: blDelta, sortedColors: blSortedColors} = getMajorityDelta(triangle(false, false, 0, index, colorBytes));
  //           const {delta: trDelta, sortedColors: trSortedColors} = getMajorityDelta(triangle(true, true, 0, index, colorBytes));
  //           const trblDelta = (blDelta + trDelta) / 2;
  //           const trblValid = trblDelta > threshold && isPair(sortedColors, trSortedColors[0], blSortedColors[0]);

  //           if (trblValid) {
  //             //console.log('bltr', trSortedColors[0], blSortedColors[0]);
  //             tiles[tileIndex] = colors.markerRed.index;
  //             diagonals[tileIndex] = [tileIndex, 0, blSortedColors[0], trSortedColors[0], trblDelta];
  //           } else {
  //             tiles[tileIndex] = sortedColors[0];//0;
  //           }
  //         }
  //       } else {
  //         tiles[tileIndex] = sortedColors[0];
  //       }
  //     }
  //     tileIndex++;
  //     index += density * 4;
  //   }
  //   index += byteWidth * (density - 1);
  // }

  // function validateDiagonals() {
  //   const width = tileDimensions.x;
  //   const height = tileDimensions.y;
  //   function isDiagonal(color) {
  //     return color === colors.house.index || color === colors.markerRed.index;
  //   }

  //   function getColorMajority(index, c0, c1) {
  //     let c0Count = 0;
  //     let c1Count = 0;
  //     const [x, y] = tileIndexToTile(index);

  //     if (x > 0) {
  //       if (tiles[index - 1] === c0) c0Count++;
  //       if (tiles[index - 1] === c1) c1Count++;
  //     }
  //     if (x < width - 1) {
  //       if (tiles[index + 1] === c0) c0Count++;
  //       if (tiles[index + 1] === c1) c1Count++;
  //     }
  //     if (y > 0) {
  //       if (tiles[index - width] === c0) c0Count++;
  //       if (tiles[index - width] === c1) c1Count++;
  //     }
  //     if (y < height - 1) {
  //       if (tiles[index + width] === c0) c0Count++;
  //       if (tiles[index + width] === c1) c1Count++;
  //     }
  //     return c0Count >= c1Count ? c0 : c1;
  //   }

  //   const toDelete = {};
  //   // eslint-disable-next-line
  //   for (let [index, tlbr, c0, c1] of Object.values(diagonals)) {
  //     const [x, y] = tileIndexToTile(index);

  //     function checkColor(neighborIndex) {
  //       if (toDelete[index]) return;

  //       var color = tiles[neighborIndex];
  //       if (isDiagonal(color)) {
  //         const weakerDiagonal = (diagonals[index][4] < diagonals[neighborIndex][4]) ? index : neighborIndex;
  //         tiles[weakerDiagonal] = getColorMajority(weakerDiagonal, diagonals[weakerDiagonal][2], diagonals[weakerDiagonal][3]);
  //         toDelete[weakerDiagonal] = true;
  //         if (weakerDiagonal === index)
  //           isValid = false;
  //         return;
  //       }
  //       if (color === c0) {
  //         c0Count++;
  //       } else if (color === c1) {
  //         c1Count++;
  //       }
  //       else {
  //         isValid = false;
  //       }
  //     }

  //     let c0Count = 0;
  //     let c1Count = 0;
  //     let isValid = true;
  //     if (isValid && x > 0) {
  //       checkColor(index - 1);
  //     }
  //     if (isValid && x < width - 1) {
  //       checkColor(index + 1);
  //     }
  //     if (isValid && y > 0) {
  //       checkColor(index - width);
  //     }
  //     if (isValid && y < height - 1) {
  //       checkColor(index + width);
  //     }

  //     if (!isValid || c0Count >= 3) {
  //       tiles[index] = c0;
  //       toDelete[index] = true;
  //     } else if (c1Count >= 3) {
  //       tiles[index] = c1;
  //       toDelete[index] = true;
  //     }
  //   }
  //   for (let index of Object.keys(toDelete)) {
  //     delete diagonals[index];
  //   }
  // }
  // validateDiagonals();
  // validateDiagonals();
  // validateDiagonals();


  //index = 0;
  //tileIndex = 0;
  //for (let tiley = 0; tiley < tileDimensions.y; ++tiley) {
  //  for (let tilex = 0; tilex < tileDimensions.x; ++tilex) {
  //    var tileColor = tiles[tileIndex];
  //    let i = index;
  //    for (let y = 0; y < density; y++) {
  //      for (let x = 0; x < density; x++) {
  //        var cellX = x * 4;
//
  //        if (tileColor !== 0)
  //          colorBytes[i + cellX] = tileColor;
  //      }
  //      i += byteWidth;
  //    }
//
  //    tileIndex++;
  //    index += density * 4;
  //  }
  //  index += byteWidth * (density - 1);
  //}

  // calculate vertices
  const allPolygons: {[key: number]: number[][][]} = {};
  {
    const markedArray = new Uint8ClampedArray(tileDimensions.x * tileDimensions.y);
    const width = tileDimensions.x;
    const height = tileDimensions.y;
    forEachTile((tileIndex) => {
      const targetColor = tiles[tileIndex] ?? 0;
      if (markedArray[tileIndex] === targetColor) return {};
      const queue: number[] = [tileIndex];
      const edges: Map<number, number> = new Map();

      function validate(i: number, validIndex: boolean, currentColor: number, onValid: (i: number) => any, onInvalid: (i: number) => any) {
        if (!validIndex) onInvalid(i);
        if (markedArray[i] === targetColor) return;
        const color = tiles[i];
        const isUnderColor = colorArr[targetColor].under != null && colorArr[targetColor].under?.indexOf(color) !== -1 && currentColor !== color;
        if (targetColor === color || isUnderColor) onValid(i);
        else onInvalid(i);
      }

      while (queue.length > 0) {
        const index = queue.pop() ?? 0;
        const [x, y] = tileIndexToTile(index);

        markedArray[index] = targetColor;

        const currentColor = tiles[index];

        validate(index - 1, (x > 0), currentColor, i => queue.push(i), () => edges.set(xyToVertexIndex(x, y + 1), xyToVertexIndex(x, y)));
        validate(index + 1, (x < width - 1), currentColor, i => queue.push(i), () => edges.set(xyToVertexIndex(x + 1, y), xyToVertexIndex(x + 1, y + 1)));
        validate(index - width, (y > 0), currentColor, i => queue.push(i), () => edges.set(xyToVertexIndex(x, y), xyToVertexIndex(x + 1, y)));
        validate(index + width, (y < height - 1), currentColor, i => queue.push(i), () => edges.set(xyToVertexIndex(x + 1, y + 1), xyToVertexIndex(x, y + 1)));
      }

      // // diagonals
      // const c0Complete = {};
      // const c1Complete = {};

      // for (let [index, tlbr, c0] of Object.values(diagonals)) {
      //   var [x, y] = tileIndexToTile(index);

      //   if (c0 === targetColor) {
      //     if (c0Complete[index]) {
      //       continue;
      //     } else {
      //       c0Complete[index] == 1;
      //     }
      //   } else {
      //     if (c1Complete[index]) {
      //       continue;
      //     } else {
      //       c1Complete[index] == 1;
      //     }
      //   }

      //   var start: number = 0, end: number = 0, corner: number = 0;
      //   let isLeft: boolean, isRight: boolean;
      //   if (tlbr) {
      //     isLeft = tiles[tileToTileIndex(x - 1, y)] === targetColor
      //       && tiles[tileToTileIndex(x, y - 1)] === targetColor;
      //     isRight = tiles[tileToTileIndex(x + 1, y)] === targetColor
      //       && tiles[tileToTileIndex(x, y + 1)] === targetColor;

      //     if (isLeft) {
      //       start = xyToVertexIndex(x + 1, y);
      //       end = xyToVertexIndex(x, y + 1);
      //       corner = xyToVertexIndex(x, y);
      //     }
      //     if (isRight) {
      //       start = xyToVertexIndex(x, y + 1);
      //       end = xyToVertexIndex(x + 1, y);
      //       corner = xyToVertexIndex(x + 1, y + 1);
      //     }
      //   } else {
      //     isLeft = tiles[tileToTileIndex(x - 1, y)] === targetColor
      //       && tiles[tileToTileIndex(x, y + 1)] === targetColor;
      //     isRight = tiles[tileToTileIndex(x + 1, y)] === targetColor
      //       && tiles[tileToTileIndex(x, y - 1)] === targetColor;


      //     if (isLeft) {
      //       start = xyToVertexIndex(x, y);
      //       end = xyToVertexIndex(x + 1, y + 1);
      //       corner = xyToVertexIndex(x, y + 1);
      //     }
      //     if (isRight) {
      //       start = xyToVertexIndex(x + 1, y + 1);
      //       end = xyToVertexIndex(x, y);
      //       corner = xyToVertexIndex(x + 1, y);
      //     }
      //   }
      //   if (isLeft || isRight) {
      //     if (edges.has(end) && edges.has(corner) && edges.has(start)) {
      //       edges.delete(start);
      //       edges.delete(corner);
      //     }
      //     edges.set(start, end);
      //     if (!edges.has(end)) {
      //       //edges.set(end, corner);
      //     }
      //   }
      // }

      function firstElementOfMap<K, V> (map: Map<K, V>): [K, V] | undefined {
        var firstIt = map.entries().next();
        if (!firstIt.done) {
          return firstIt.value;
        }
      }

      const polygons: number[][] = [];
      let currentPolygon: number[] = [];
      let prevVertex = 0;
      let nextVertex = 0;
      let prevDiagonal = false;

      function isDiagonal(prevVertex, currentVertex, nextVertex) {
        var prevHorizontal = prevVertex + 1 === currentVertex || prevVertex - 1 === currentVertex;
        var nextHorizontal = currentVertex + 1 === nextVertex || currentVertex - 1 === nextVertex;

        // if one of the sides is diagonal, cannot make this a diagonal
        if ((!prevHorizontal
          && prevVertex + vertexWidth !== currentVertex
          && prevVertex - vertexWidth !== currentVertex)
          || (!nextHorizontal
            && currentVertex + vertexWidth !== nextVertex
            && currentVertex - vertexWidth !== nextVertex)
            ) {
          return false;
        }

        // consider a diagonal at a corner
        if (prevHorizontal != nextHorizontal) {
          var prevXY = vertexIndexToXY(prevVertex);
          var nextXY = vertexIndexToXY(nextVertex);
          var tileIndex = tileToTileIndex(~~((prevXY[0] + nextXY[0]) / 2), ~~((prevXY[1] + nextXY[1]) / 2));
          if (deltas[tileIndex] < 0.9) {
            return true;
          }
        }
        return false;
      }

      while (edges.size > 0) {
        if (currentPolygon.length == 0) {
          var randomEdge = firstElementOfMap(edges);
          if (randomEdge) {
            currentPolygon.push(randomEdge[0]);
            edges.delete(randomEdge[0])
            nextVertex = randomEdge[1];
          }
        } else {
          var nextNextVertex = edges.get(nextVertex);
          if (nextNextVertex) {
            // if (targetColor === colors.level1.index) {
              // let [v0x, v0y] = vertexIndexToXY(nextVertex);
              // let [v1x, v1y] = vertexIndexToXY(nextNextVertex);
            //   if (v0x == 112) v0x = 111;
            //   if (v1x == 112) v1x = 111;
            //   colorBytes[tileToByte((v0x + v1x) / 2 + (v1x - v0x) * (1/3), (v0y + v1y) / 2 + (v1y - v0y) * (1/3))] = 1;
            //   colorBytes[tileToByte((v0x + v1x) / 2 - (v1x - v0x) * (1/3), (v0y + v1y) / 2 - (v1y - v0y) * (1/3))] = 2;
            //   colorBytes[tileToByte((v0x + v1x) / 2, (v0y + v1y) / 2)] = 0;
            // }
            if (currentPolygon.length > 0) {
              let [v0x, v0y] = vertexIndexToXY(prevVertex);
              let [v1x, v1y] = vertexIndexToXY(nextNextVertex);
              var delta = deltas[tileToTileIndex(~~((v0x + v1x) / 2), ~~((v0y + v1y) / 2))];
              colorBytes[tileToByte((v0x + v1x) / 2, (v0y + v1y) / 2)] = delta;
            }

            currentPolygon.push(nextVertex);
            if (!prevDiagonal && currentPolygon.length > 0) {
              if (isDiagonal(prevVertex, nextVertex, nextNextVertex)) {
                currentPolygon.pop();
                prevDiagonal = true;
              }
            } else {
              prevDiagonal = false;
            }
            edges.delete(nextVertex);
            prevVertex = prevDiagonal ? prevVertex : nextVertex;
            nextVertex = nextNextVertex;
          } else {
            if (isDiagonal(currentPolygon[currentPolygon.length - 2], currentPolygon[currentPolygon.length - 1], currentPolygon[0])) {
              currentPolygon.pop();
            } else if (isDiagonal(currentPolygon[currentPolygon.length - 1], currentPolygon[0], currentPolygon[1])) {
              currentPolygon.shift();
            }

            //if (nextVertex == currentPolygon[0])
            polygons.push(currentPolygon);
            currentPolygon = [];
          }
        }
      }
      if (currentPolygon.length > 0) polygons.push(currentPolygon);

      if (!(targetColor in allPolygons)) {
        allPolygons[targetColor] = [];
      }
      allPolygons[targetColor].push(polygons);
    });
  }
  console.log(allPolygons);

  // encode into drawing json
  const drawingData: {[key: string]: (number[][][] & number[][])} = {
    sand: [],
    rock: [],
    level1: [],
    level2: [],
    level3: [],
  };
  {
    for (let [colorIndex, colorPolygons] of Object.entries(allPolygons)) {
      const colorName = colorArr[colorIndex].name;
      if (colorName in drawingData) {
        for (let complexPoly of colorPolygons) {
          //const polyArray = complexPoly.length === 1 ? drawingData[colorName] : [];
          const polyArray = drawingData[colorName];
          for (let polygon of complexPoly) {
            const points: number[] = [];
            for (let point of polygon) {
              var [x, y] = vertexIndexToXY(point as unknown as number);
              points.push(x, y);
            }
            polyArray.push(points);
          }
          //if (complexPoly.length > 1) {
          //  drawingData[colorName].push(polyArray);
          //}
        }
      }
    }
    const mapJson = {
      version: 1,
      drawing: drawingData,
    };
    console.log(mapJson);
    loadMapFromJSON(mapJson);
  }

  // fill
  forEachPixel((index, x, y) => {
    const color = colorArr[colorBytes[index]].color;
    colorBytes[index+0] = color[0];//isInside ? 255 : color[0];
    colorBytes[index+1] = color[1];
    colorBytes[index+2] = color[2];//isDotted ? 255 : color[2];
    colorBytes[index+3] = 255;//distSq;

    if (x % density == 0 || y % density == 0) {
      colorBytes[index+0] += 10;
      colorBytes[index+1] += 10;
      colorBytes[index+2] += 10;
    }

    index += 4;
  })

  canvasCtx.putImageData(imageData, 0, 0);
  return canvas;
}

//function fillCell(color: Color, colorBytes: Uint8ClampedArray, x: number, y: number, density: number) {
//  for (let y = 0; y < density; y++) {
//    for (let x = 0; x < density; x++) {
//      var cellX = x * 4;
//      colorBytes[i + cellX + 0] = color[0];
//      colorBytes[i + cellX + 1] = color[1];
//      colorBytes[i + cellX + 2] = color[2];
//    }
//  }
//}

function nearestColor(c: Color, colors: ColorProperties[]): [number, number]
{
  let minDistanceSq = Infinity,
    minIndex: number = 0;

  for (let i = 0; i < colors.length; ++i) {
    const colorProp = colors[i];
    const color = colorProp.color;

    const distanceSq = (
      Math.pow(c[0] - color[0], 2) +
      Math.pow(c[1] - color[1], 2) +
      Math.pow(c[2] - color[2], 2)
    );

    if (distanceSq < minDistanceSq) {
      minDistanceSq = distanceSq;
      minIndex = colorProp.index ?? 0;
    }
  }

  return [minIndex, minDistanceSq];
}

/*async function inpaint(
  canvas: HTMLCanvasElement,
  imageData: Uint8ClampedArray,
  maskPixels: number[],
  maskBuffer: Uint8ClampedArray,
) {
  return new Promise(resolve =>
    import("./inpaint").then(Inpaint => {
      // fill buffer (single channel) using pixels indices (quad channel)
      maskPixels.forEach(p => maskBuffer[p / 4] = 1);

      Inpaint.default(canvas.width, canvas.height, imageData, maskBuffer);
      resolve();

      // clear buffer
      maskPixels.forEach(p => maskBuffer[p / 4] = 0);
    })
  );
}*/

// Code graveyard


// attempt to get amenities and houses without open CV - a fools errand
/*

*/

//function nearestColor(color: Color): Color {
//  if (isCloseEnough(color, colors.amenityBack, 40)) return colors.amenityBack;
//
//  if (isCloseEnough(color, colors.rock, 20)) return colors.rock;
//  if (isCloseEnough(color, colors.ocean, 40)) return colors.ocean;
//  if (isCloseEnough(color, colors.level1, 20)) return colors.level1;
//  if (isCloseEnough(color, colors.level2, 18)) return colors.level2;
//  if (isCloseEnough(color, colors.level3, 18)) return colors.level3;
//
//  if (isCloseEnough(color, colors.markerRed, 50)) return colors.markerRed;
//  if (isCloseEnough(color, colors.markerWhite, 30)) return colors.markerWhite;
//  if (isCloseEnough(color, colors.house, 50)) return colors.house;
//  if (isCloseEnough(color, colors.playerHouse, 60)) return colors.playerHouse;
//
//  if (isCloseEnough(color, colors.sand, 36)) return colors.sand;
//
//  return [255, 0, 255];
//}
//
//function isCloseEnough(c0: Color, c1: Color, tolerance: number): boolean {
//  const r = c0[0] - c1[0];
//  const g = c0[1] - c1[1];
//  const b = c0[2] - c1[2];
//  return (r * r + g * g + b * b) <= tolerance * tolerance;
//}
