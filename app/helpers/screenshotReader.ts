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
  xMin?: number,
  yMin?: number,
  xMax?: number,
  yMax?: number,
  name: string,
  index: number,
}

type ColorPropertiesPartial = Omit<ColorProperties, 'name' | 'index'>;

// todo: don't keep this giant dictionary in memory

const colorsPartial: Record<string, ColorPropertiesPartial> = {
  none: {
    color: [255, 0, 255],
    weight: 1000,
  },
  sand: {
    color: [237, 229, 163], // #ede5a3
    weight: 10,
    adjacency: ['water', 'level1'],
    xMax: 13,
    yMax: 13,
  },
  rock: {
    color: [117, 124, 138], // #757c8a
    weight: 5,
    adjacency: ['water', 'sand', 'level1'],
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
    yMin: 13,
  },
  level2: {
    color: [ 69, 162,  64], // #45a240
    weight: 10,
    minSize: 5,
    adjacency: ['level1', 'level3'],
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
    name: colorName,
    index: index,
  }
  colors[colorName] = colorProperty;
  colorArr.push(colorProperty);
});

const amenityColors = [
  'amenityBack',
  'amenityIcon',
  'house',
  'playerHouse',
  'markerRed',
  'markerWhite',
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
img.src = 'static/screenshots/EYb_4CbVcAAoKcJ.jpg';
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
const screenshotRectangle = Rect(Point(p0.x - px * 7, p0.y), Point(p0.x, p0.y - px * 6));
const density = 5;

const resizedDimensions = Point(tileDimensions.x * density, tileDimensions.y * density);
const byteWidth = resizedDimensions.x * 4;

export function readMapFromScreenshot(rawImg) {
  console.log('readmap');
  loadImage(rawImg).then(async image => {
    const rawCanvas = await screenshotCanvas(image);
    image.remove();
    const cropCanvas = await crop(rawCanvas, screenshotRectangle);
    rawCanvas.remove();
    await resize(cropCanvas, Point(tileDimensions.x * density, tileDimensions.y * density));

    getColors(cropCanvas).then(canvas => {
      //const canvas = document.createElement('canvas');
      //canvas.height = image.height;
      //canvas.width = image.width;
      //const canvasCtx = canvas.getContext('2d');
      //if (!canvasCtx) return;
      //canvasCtx.drawImage(image, 0, 0);

  //    if (canvas.width != screenshotDimensions.x || canvas.height != screenshotDimensions.y) {
  //      hermite.resample(canvas, screenshotDimensions.x, screenshotDimensions.y, true);
  //    }
      //var map = crop(canvas, screenshotRectangle);
      //canvas.remove();

      console.log(canvas);
      canvas.style.position = "absolute";
      canvas.style.top = '0';
      canvas.style.width = '100%';
      canvas.style['image-rendering'] = 'pixelated';
      document.body.appendChild(canvas);
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
  console.log('done loading canvas');

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = rect.width;
  cropCanvas.height = rect.height;
  const cropCanvasCtx = cropCanvas.getContext('2d');
  cropCanvasCtx?.drawImage(canvas, rect.p0.x, rect.p1.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  canvas.remove();

  return cropCanvas;
}

async function resize(canvas: HTMLCanvasElement, scale: Point) {
  // @ts-ignore
  return new Promise<HTMLCanvasElement>((resolve) => {
    import("hermite-resize").then(hermiteModule => {
      const hermite = new hermiteModule.default();
      hermite.resample(canvas, scale.x, scale.y, true, () => resolve(canvas));
    });
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
          (tileX + 0.3) % 16 < .6 && (tileY + 0.6) % 2 < 1.2
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

  //function checkNeighbors(index: number, arr: Uint8ClampedArray, targetColor: Color, destinationColor: Color) {
  //  for (let y = 0; y < 3; ++y) {
  //    for (let x = 0; x < 3; ++x) {
  //      index++;
  //    }
  //    index += rowWidth - 3;
  //  }
  //}

  // handle the marker first, as its white border potentially conflicts with the amenities
  {
    let index = 0;

    for (let y = 0; y < canvas.height; y++) {
      //const tileY = (y / density)
      for (let x = 0; x < canvas.width; x++) {
        //const tileX = (x / density)
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
        index += 4;
      }
    }
  }

  for (let i = 1; i < colorBytes.length; i += 4) {
    colorBytes[i] = 0;
  }

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
  {
    let index = 0;

    for (let y = 0; y < canvas.height; y++) {
      //const tileY = (y / density)
      for (let x = 0; x < canvas.width; x++) {
        //const tileX = (x / density)

        var colorIndex = colorBytes[index];
        switch (colorIndex) {
          case colors.markerRed.index:
          case colors.playerHouse.index:
          case colors.house.index:
          case colors.amenityBack.index:
            simpleInfill(x, y, colorBytes);
            break;
          case colors.amenityIcon.index: {
            const {interior} = magicWandOuterBoundary(x, y, colorBytes, {[colors.markerWhite.index]: true, [colors.bridge.index]: true, [colors.bridge.index]: true}, {});

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

        //colorBytes[index+0] = color[0];//isInside ? 255 : color[0];
        //colorBytes[index+1] = color[1];
        //colorBytes[index+2] = color[2];//isDotted ? 255 : color[2];
        //colorBytes[index+3] = 255;//distSq;
        index += 4;
      }
    }
  }

  function getMajorityDelta (colorGenerator: Generator<number, void>):
  {
    delta: number,
    superMajority: boolean,
    colorCount: Map<number, number>,
    sortedColors: number[],
  } {
    let colorCount: Map<number, number> = new Map();

    let result = colorGenerator.next();
    while (!result.done) {
      const color = result.value;
      result = colorGenerator.next();
      colorCount.set(color, (colorCount.get(color) ?? 0) + 1);
    }

    const sortedColors = Array.from(colorCount.keys()).sort(
      (a, b) => (colorCount.get(a) ?? 0) - (colorCount.get(b) ?? 0)).reverse();

    const leader = (colorCount.get(sortedColors[0]) ?? 0) / sqDensity;
    const runnerUp = (colorCount.get(sortedColors[1]) ?? 0) / sqDensity;

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

  function isPair(sortedColors: number[], color1: ColorProperties, color2: ColorProperties) {
    return sortedColors[0] === color1.index && sortedColors[1] === color2.index
      || sortedColors[1] === color1.index && sortedColors[0] === color2.index;
  }

  const sqDensity = density * density;
  let index = 0;
  let tileIndex = 0;

  const tiles = new Uint8ClampedArray(tileDimensions.x * tileDimensions.y);
  for (let tiley = 0; tiley < tileDimensions.y; ++tiley) {
    for (let tilex = 0; tilex < tileDimensions.x; ++tilex) {

      const {delta, sortedColors} = getMajorityDelta(fullTile(index, colorBytes));

      if (sortedColors.length == 1) {
        tiles[] = sortedColors[0];
      } else {
        let threshold = 0.6;
        if (isPair(sortedColors, colors.water, colors.level1)) threshold = 0.7;
        if (isPair(sortedColors, colors.water, colors.sand)) threshold = 0.2;

        if (delta > threshold) { // if strong majority, declare this a solid tile
          resolvedColor = sortedColors[0];
        }
        else {
          resolvedColor = 0; // todo
        }
      }

      let i = index;
      for (let y = 0; y < density; y++) {
        for (let x = 0; x < density; x++) {
          var cellX = x * 4;
          colorBytes[i + cellX] = resolvedColor;
        }
        i += byteWidth;
      }

      tileIndex++;
      index += density * 4;
    }
    index += byteWidth * (density - 1);
  }

  // fill
  {
    let index = 0;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const color = colorArr[colorBytes[index]].color;
        colorBytes[index+0] = color[0];//isInside ? 255 : color[0];
        colorBytes[index+1] = color[1];
        colorBytes[index+2] = color[2];//isDotted ? 255 : color[2];
        colorBytes[index+3] = 255;//distSq;
        index += 4;

        //colorBytes[index+0] = color[0];//isInside ? 255 : color[0];
        //colorBytes[index+1] = color[1];
        //colorBytes[index+2] = color[2];//isDotted ? 255 : color[2];
        //colorBytes[index+3] = 255;//distSq;
        //index += 4;
      }
    }
  }

  canvasCtx.putImageData(imageData, 0, 0);
  return canvas;
  //const canvasCtx = canvas.getContext('2d');
  //console.log(rect);
  //canvasCtx?.drawImage(canvas, rect.p0.x, rect.p1.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
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
