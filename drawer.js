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
    createGrid();//updateSegments();
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
    draw(event);
}

function onMouseUp(event) {
    endDraw(event);
}

// ===============================================
// BACKGROUND

var backgroundRect = new Path();
drawBackground();
function drawBackground() {
    // background color
    backgroundRect.remove();
    backgroundRect = new Path.Rectangle({
        point: [0, 0],
        size: [view.size.width, view.size.height],
    });
    backgroundRect.sendToBack();
    backgroundRect.fillColor = colors.water;
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
$(document).keydown(function(event) {
    switch(event.key) {
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
    }
    onUpdateColor();
});


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
    myPath.smooth({type: 'catmull-rom'});
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
function startDraw() {
    switch (paintTool) {
        case paintTools.grid:
            break;
        case paintTools.diagonals:
            break;
        case paintTools.freeform:
            break;
    }
    myPath = new Path();
    myPath.strokeColor = paintColor;
    myPath.strokeWidth = 10;
}
function draw(event) {
    // Add a segment to the path at the position of the mouse:
    myPath.add(event.point);
    myPath.smooth({type: 'catmull-rom'});
}
function endDraw() {

}
function changePaintTool(newPaintTool) {
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
var verticalRatio = 1;//0.767;

var remapX = function (i) {return i};
var remapY = function (i) {return i};
var remapInvX = function (i) {return i};
var remapInvY = function (i) {return i};

function resizeCoordinates() {
    var margin = view.size.width * 0.1;

    var width = view.size.width - margin * 2;
    var blockWidth = width / horizontalBlocks;
    var cellWidth = blockWidth / horizontalDivisions;
    var cellHeight = cellWidth * verticalRatio;
    var blockHeight = cellHeight * verticalDivisions;
    var height = blockHeight * verticalBlocks;
    
    var xView = view.size.width - margin;
    var xCoord = horizontalBlocks * horizontalDivisions;
    var yView = height + margin;
    var yCoord = verticalBlocks * verticalDivisions;
    console.log(margin, xView, 0, xCoord);
    remapX = createRemap(margin, xView, 0, xCoord);
    remapY = createRemap(margin, yView, 0, yCoord);
    remapInvX = createRemap(0, xCoord, margin, xView);
    remapInvY = createRemap(0, yCoord, margin, yView);
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
    constructor: function (_x, _y) {
        this.x = _x;
        this.y = _y;
    },
    area: function () {
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
var gridRaster;
function createGrid() {
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
    gridRaster = gridGroup.rasterize(view.resolution * 2);
    gridGroup.remove();
}
function createGridLine(segment, blockEdge) {
    line = new Path(segment);
    line.strokeColor = '#ffffff';
    line.strokeWidth = blockEdge ? 2 : 1;
    line.strokeCap = 'round';
    line.dashArray = blockEdge ? [10, 12] : null;
    line.opacity = blockEdge ? 0.5 : 0.2;
    return line;
}
function getSegment(i, horizontal) {
    return horizontal
        ? [mapToView(new Point(i, 0)), mapToView(new Point(i, verticalBlocks * verticalDivisions))]
        : [mapToView(new Point(0, i)), mapToView(new Point(horizontalBlocks * horizontalDivisions, i))];
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
var coordinateLabel = new PointText([0, 0]);

var brush = new Path();
function updateCoordinateLabel(event) {
    var coordinate = viewToMap(event.point).floor();
    coordinateLabel.content = '' + event.point + '\n' + coordinate.toString();
    coordinateLabel.position = event.point;

    brush.segments = getBrushSegments(coordinate);
    brush.closed = true;
    brush.fillColor = paintColor;
}
function getBrushSegments(coordinate) {
    // square
    return [
        mapToView(coordinate), 
        mapToView(coordinate.add([0, 1])), 
        mapToView(coordinate.add([1, 1])), 
        mapToView(coordinate.add([1, 0])), 
    ]
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
      obj.constructor : function () {},
    key
  ;
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
