var colors = {
  water: '#7cd5c4',
  sand: '#f0e5a6',
  level1: '#42753e',
  level2: '#4ca14e',
  level3: '#62c360',
  rock: '#717488',
}

// ===============================================
// GLOBAL FUNCTIONS

function onResize(event) {
  // Whenever the window is resized, recenter the path:
  resizeCoordinates();
  drawBackground();
  updateColorTools();
}

tool.minDistance = 1;

function onMouseMove(event) {
  updateCoordinateLabel(event);
}

// This function is called whenever the user
// clicks the mouse in the view:
function onMouseDown(event) {
  startDraw(event);
}

function onMouseDrag(event) {
  updateCoordinateLabel(event)
  draw(event);
}

function onMouseUp(event) {
  endDraw(event);
}

// ===============================================
// BACKGROUND

var backgroundRect = new Path();

function drawBackground() {
  defaultLayer.activate();
  // background color
  backgroundRect.remove();
  backgroundRect = new Path.Rectangle({
    point: [0, 0],
    size: [view.size.width, view.size.height],
  });
  backgroundRect.sendToBack();
  backgroundRect.fillColor = colors.water;
  mapLayer.activate();
}

// ===============================================
// COLOR CONTROL

var activeColor = Path.Circle([0, 0], 30);
activeColor.fillColor = paintColor;

function updateColorTools() {
  activeColor
}

function onUpdateColor() {
  activeColor.fillColor = paintColor;
}

var paintColor = colors.level1;

function onKeyDown(event) {
  var shift = Key.isDown('shift');
  var control = Key.isDown('control') || Key.isDown('meta');
  switch (event.key) {
    case '1':
      paintColor = colors.water;
      break;
    case '2':
      paintColor = colors.sand;
      break;
    case '3':
      paintColor = colors.level1;
      break;
    case '4':
      paintColor = colors.level2;
      break;
    case '5':
      paintColor = colors.level3;
      break;
    case '6':
      paintColor = colors.rock;
      break;
    case 'q':
      updatePaintTool(paintTools.grid);
      break;
    case 'w':
      updatePaintTool(paintTools.diagonals);
      break;
    case 'e':
      updatePaintTool(paintTools.freeform);
      break;
    case '[':
      brushSize = Math.max(brushSize - 1, 0);
      updateBrush();
      break;
    case ']':
      brushSize = Math.max(brushSize + 1, 0);
      updateBrush();
      break;
    case 'p':
      cycleBrushHead();
      updateBrush();
      break;
    case 'm':
      var o = objectMap(state.drawing, function(pathItem) {
        var p;
        if (pathItem._children) {
          p = pathItem._children.map(function(path) {
            return path._segments.map(function(s) {
              var c = s._point;
              return {
                x: Math.round(c.x),
                y: Math.round(c.y)
              };
            })
          });
        } else {
          p = pathItem._segments.map(function(s) {
            var c = s._point;
            return {
              x: Math.round(c.x),
              y: Math.round(c.y)
            };
          });
        }
        return p;
      });
      console.log(JSON.stringify(o));
      break;
    case 'z':
      if (control && shift) {
        console.log('redo');  
      }
      else if (control) {
        console.log('undo');
      }
      break;
  }
  onUpdateColor();
};

var defaultLayer = project.activeLayer;
var mapLayer = new Layer();
var mapOverlayLayer = new Layer();
var uiLayer = new Layer();
var viewLayer = new Layer();

mapLayer.activate();

mapLayer.applyMatrix = false;
mapLayer.pivot = new Point(0, 0);
mapOverlayLayer.applyMatrix = false;
mapOverlayLayer.pivot = new Point(0, 0);

// ===============================================
// PATH DRAWING

// Create a new path once, when the script is executed:
var myPath;

function startDraw() {
  myPath = new Path();
  myPath.strokeColor = paintColor;
  myPath.strokeWidth = 10;
}

function draw(event) {
  // Add a segment to the path at the position of the mouse:
  myPath.add(event.point);
  myPath.smooth({
    type: 'catmull-rom'
  });
}

function endDraw() {

}

// ===============================================
// PATH DRAWING

var paintTools = {
  grid: 'grid',
  diagonals: 'diagonals',
  freeform: 'freeform',
};
var paintTool = paintTools.grid;

// Create a new path once, when the script is executed:
var myPath;

function startDraw(event) {
  switch (paintTool) {
    case paintTools.grid:
      startDrawGrid(event.point);
      break;
    case paintTools.diagonals:
      break;
    case paintTools.freeform:
      myPath = new Path();
      myPath.strokeColor = paintColor;
      myPath.strokeWidth = 10;
      break;
  }
}

function draw(event) {
  switch (paintTool) {
    case paintTools.grid:
      drawGrid(event.point);
      break;
    case paintTools.diagonals:
      break;
    case paintTools.freeform:
      // Add a segment to the path at the position of the mouse:
      myPath.add(event.point);
      myPath.smooth({
        type: 'catmull-rom'
      });
      break;
  }
}

function endDraw(event) {

}

function changePaintTool(newPaintTool) {
  switch (paintTool) {
    case paintTools.grid:
      break;
    case paintTools.diagonals:
      break;
    case paintTools.freeform:
      break;
  }
  endDraw();
  paintTool = newPaintTool;
}


// ===============================================
// PIXEL FITTING
// TODO: have a way to convert back to the original path
// - save the original strokes, the pixelation is basically a filter on top
function fitToPixels() {

}


// ===============================================
// SHAPE DRAWING

// Draw a specified shape on the pixel grid


// ===============================================
// PIXEL COORDINATE HELPERS

var mapMargin = 0.1;
var horizontalBlocks = 7;
var verticalBlocks = 6;
var horizontalDivisions = 16;
var verticalDivisions = 16;
var verticalRatio = 1; //0.767;

var cellWidth = 0;
var cellHeight = 0;

var remapX = function(i) {
  return i
};
var remapY = function(i) {
  return i
};
var remapInvX = function(i) {
  return i
};
var remapInvY = function(i) {
  return i
};
resizeCoordinates();

function resizeCoordinates() {
  var marginX = view.size.width * 0.1;

  var width = view.size.width - marginX * 2;
  var blockWidth = width / horizontalBlocks;
  cellWidth = blockWidth / horizontalDivisions;
  cellHeight = cellWidth * verticalRatio;
  var blockHeight = cellHeight * verticalDivisions;
  var height = blockHeight * verticalBlocks;

  var xView = view.size.width - marginX;
  var xCoord = horizontalBlocks * horizontalDivisions;

  var marginY = (view.size.height - height) / 2;
  var yView = height + marginX;
  var yCoord = verticalBlocks * verticalDivisions;

  remapX = createRemap(marginX, xView, 0, xCoord);
  remapY = createRemap(marginY, yView, 0, yCoord);
  remapInvX = createRemap(0, xCoord, marginX, xView);
  remapInvY = createRemap(0, yCoord, marginY, yView);

  mapLayer.position = new Point(marginX, marginY);
  mapLayer.scaling = new Point(cellWidth, cellHeight);

  mapOverlayLayer.position = new Point(marginX, marginY);
  mapOverlayLayer.scaling = new Point(cellWidth, cellHeight);
}

function viewToMap(viewCoordinate) {
  return new Coordinate(
    remapX(viewCoordinate.x),
    remapY(viewCoordinate.y));
}

function mapToView(canvasCoordinate) {
  return new Point(
    remapInvX(canvasCoordinate.x),
    remapInvY(canvasCoordinate.y));
}

var Coordinate = ES3Class({
  constructor: function(_x, _y) {
    this.x = _x;
    this.y = _y;
  },
  area: function() {
    return this.x * this.y;
  },
  toString: function() {
    return '' + this.x + ' ' + this.y;
  },
  floor: function() {
    return new Coordinate(Math.floor(this.x), Math.floor(this.y));
  },
  add: function(arr) {
    return new Coordinate(this.x + arr[0], this.y + arr[1]);
  }
});

// ===============================================
// GRID overlay

mapOverlayLayer.activate();
var gridRaster;
createGrid();

function createGrid() {
  mapOverlayLayer.activate();
  if (gridRaster) gridRaster.remove();
  var grid = [];
  for (var i = 0; i < horizontalBlocks * horizontalDivisions; i++) {
    var line = createGridLine(getSegment(i, true), i % horizontalDivisions == 0);
    grid.push(line);
  }
  for (var i = 0; i < verticalBlocks * verticalDivisions; i++) {
    var line = createGridLine(getSegment(i, false), i % verticalDivisions == 0);
    grid.push(line);
  }
  var gridGroup = new Group(grid);
  gridRaster = gridGroup.rasterize(view.resolution * 10);
  gridGroup.remove();
  mapLayer.activate();
}

function createGridLine(segment, blockEdge) {
  line = new Path(segment);
  line.strokeColor = '#ffffff';
  line.strokeWidth = blockEdge ? .2 : 0.1;
  line.strokeCap = 'round';
  //line.dashArray = blockEdge ? [4, 6] : null;
  line.opacity = blockEdge ? 0.5 : 0.3;
  return line;
}

function getSegment(i, horizontal) {
  return horizontal ? [new Point(i, 0), new Point(i, verticalBlocks * verticalDivisions)] : [new Point(0, i), new Point(horizontalBlocks * horizontalDivisions, i)];
}
/*function updateSegments() {
    for (var i = 0; i < horizontalBlocks * horizontalDivisions; i++) {
        var segmentPoints = getSegment(i, true);
        grid[i].segments[0].point = segmentPoints[0];
        grid[i].segments[1].point = segmentPoints[1];
    }
    for (var v = 0; v < verticalBlocks * verticalDivisions; v++) {
        var segmentPoints = getSegment(v, false);
        grid[i + v].segments[0].point = segmentPoints[0];
        grid[i + v].segments[1].point = segmentPoints[1];
    }
}*/

// ===============================================
// COORDINATE LABEL

mapOverlayLayer.activate();
//var coordinateLabel = new PointText(new Point(0, 0));
//coordinateLabel.fontSize = 3;

function centerBrushOffset(width, height) {
  return new Point(width * 0.5 * cellWidth, height * 0.5 * cellHeight);
}


var brushSize = 1;
var brushSegments;
var brush = new Path();
var brushOutline = new Path();

var brushTypes = {
  square: 'square',
  diamond: 'diamond',
};
var brushType = brushTypes.square;
updateBrush();

function cycleBrushHead() {
  var heads = Object.keys(brushTypes).sort(function(a, b) {
    return a == b ? 0 : a < b ? -1 : 1;
  });
  var index = heads.indexOf(brushType);
  brushType = heads[(index + 1) % heads.length];
}

function updateBrush() {
  brushSegments = getBrushSegments(brushSize);

  var prevPos = brush.position;

  brush.layer = uiLayer;
  brush.segments = brushSegments;
  brush.pivot = new Point(0, 0);
  brush.position = prevPos;
  brush.opacity = 0.5;
  brush.closed = true;
  brush.fillColor = paintColor;

  brushOutline.segments = brushSegments;
  brushOutline.position = prevPos;
  brushOutline.closed = true;
  brushOutline.strokeColor = '#fff';
  brushOutline.strokeWidth = 0.1;
}

function updateCoordinateLabel(event) {
  var rawCoordinate = mapOverlayLayer.globalToLocal(event.point);
  var coordinate = rawCoordinate.floor();
  //coordinateLabel.content = '' + event.point + '\n' + coordinate.toString();
  //coordinateLabel.position = rawCoordinate;

  brushOutline.position = rawCoordinate;

  brush.position = coordinate;
}

function getBrushSegments(size, centered) {
  // square
  var sizeX = size;
  var sizeY = size;
  var offset = centered ?
    new Point(sizeX * -0.5, sizeY * -0.5) :
    new Point(0, 0);
  switch (brushType) {
    case brushTypes.square:
      return [
        offset,
        offset.add([0, sizeY]),
        offset.add([sizeX, sizeY]),
        offset.add([sizeX, 0]),
      ];
    case brushTypes.diamond:
      return [
        offset.add([sizeX * 0.5, sizeY]),
        offset.add([sizeX, sizeY * 0.5]),
        offset.add([sizeX * 0.5, 0]),
        offset.add([0, sizeY * 0.5]),
      ];
  }
}

function transformSegments(segments, coordinate) {
  var p = coordinate;
  return segments.map(function(s) {
    return s + p
  });
}

// ===============================================
// STATE AND HISTORY

// command pattern
// draw {
//   contains delta segments for each affected layer
// }
// 

mapLayer.activate();
var state = {
  history: [],
  drawing: loadTemplate(),
};

function doCommand(command) {

}

function drawCommand() {
  return {
    command: 'draw',
    data: {

    }
  }
}

// ===============================================
// DRAWING METHODS


//var drawPoints = [];

var prevGridCoordinate;
var prevDrawCoordinate;

function startDrawGrid(viewPosition) {
  mapLayer.activate();
  var coordinate = mapLayer.globalToLocal(viewPosition);
  prevGridCoordinate = coordinate;
  drawGrid(viewPosition);
}

function drawGrid(viewPosition) {
  mapLayer.activate();
  var coordinate = new Point(mapLayer.globalToLocal(viewPosition));

  var drawPaths = [];
  doForCellsOnLine(
    prevGridCoordinate.x, prevGridCoordinate.y,
    coordinate.x, coordinate.y,
    function(x, y) {
      var p = getDrawPath(new Point(x, y).floor());
      if (p) drawPaths.push(p);
    });

  var path; 
  if (drawPaths.length == 1) {
    path = drawPaths[0];
  }
  else if (drawPaths.length > 1) {
    path = new CompoundPath({children: drawPaths});
    path.closed = true;
  }
  if (path) addDrawPath(path, paintColor);

  prevGridCoordinate = coordinate;
}

function getDrawPath(coordinate, drawPath) {
  if (coordinate != prevDrawCoordinate) {
    prevDrawCoordinate = coordinate;
    var drawPoints = transformSegments(brushSegments, coordinate);
    var p = new Path(drawPoints);
    p.closed = true;
    return p;
  }
}

// use for the vertex based drawing method for later
/*
function drawGridCoordinate(coordinate) {
  var newDrawPoints = transformSegments(brushSegments, coordinate);

  if (!newDrawPoints.equals(drawPoints)) {
    drawPoints = newDrawPoints;
    addDrawPoints(drawPoints, paintColor);
  }
}*/

function addDrawPath(path, color) {
  mapLayer.activate();
  if (!state.drawing.hasOwnProperty(color)) {
    state.drawing[color] = new Path();
  }
  var unite = state.drawing[color].unite(path);
  unite.fillColor = color;
  unite.insertAbove(state.drawing[color]);
  state.drawing[color].remove();
  path.remove();
  state.drawing[color] = unite;
}

// ===============================================
// HELPERS
function createRemap(inMin, inMax, outMin, outMax) {
  return function remap(x) {
    return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  };
}

function ES3Class(obj) {
  var
    // if there isn't a constructor, create one
    constructor = obj.hasOwnProperty('constructor') ?
    obj.constructor : function() {},
    key;
  for (key in obj) {
    // per each own property in the received object
    if (obj.hasOwnProperty(key) && key !== 'constructor') {
      // copy such property to the constructor prototype
      constructor.prototype[key] = obj[key];
    }
  }
  // return what will be used to create new Instances
  return constructor;
}

function doForCellsOnLine(x0, y0, x1, y1, setPixel) {
  var interval = 0.2;

  if (Math.abs(x0 - x1) + Math.abs(y0 - y1) < 0.2) {
    setPixel(x0, y0);
    return;
  }

  var p0 = new Point(x0, y0);
  var p1 = new Point(x1, y1);
  var delta = p1 - p0;
  var slope = delta.normalize() * interval;

  var prevCellPoint = null;
  var totalLength = delta.length;
  var length = 0;

  do {
    var cellPoint = p0.floor();
    if (prevCellPoint != cellPoint) {
      setPixel(cellPoint.x, cellPoint.y);
      prevCellPoint = cellPoint;
    }
    p0 += slope;
    length += interval;
  } while (length < totalLength)
}

function clamp(num, min, max) {
  return num <= min ? min : num >= max ? max : num;
}

// https://stackoverflow.com/questions/7837456/how-to-compare-arrays-in-javascript
Array.prototype.equals = function(array) {
  // if the other array is a falsy value, return
  if (!array)
    return false;

  // compare lengths - can save a lot of time 
  if (this.length != array.length)
    return false;

  for (var i = 0, l = this.length; i < l; i++) {
    // Check if we have nested arrays
    if (this[i] instanceof Array && array[i] instanceof Array) {
      // recurse into the nested arrays
      if (!this[i].equals(array[i]))
        return false;
    } else if (this[i] != array[i]) {
      // Warning - two different object instances will never be equal: {x:20} != {x:20}
      return false;
    }
  }
  return true;
}

function objectMap(object, mapFn) {
  return Object.keys(object).reduce(function(result, key) {
    result[key] = mapFn(object[key], key)
    return result
  }, {})
}

// ==== TEMPLATES

function loadTemplate() {
  return objectMap(template, function(colorData, color) {
    // if array of arrays, make compound path
    var p;
    if (colorData[0].x) {
      // normal path
      p = new Path(colorData);
    } else {
      p = new CompoundPath({
        children: colorData.map(function(pathData) {
          return new Path(pathData);
        }),
      });
    }
    p.fillColor = color;
    return p;
  })
}