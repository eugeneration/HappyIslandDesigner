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
    drawBackground();
    updateSegments();
    updateColorTools();
}

// This function is called whenever the user
// clicks the mouse in the view:
function onMouseDown(event) {
    startDraw(event);
}
tool.minDistance = 10;
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
// GRID overlay
var gridCells = 6;
var grid = [];
for (var i = 0; i < gridCells; i++) {
    line = new Path(getSegment(i));
    line.strokeColor = '#ffffff';
    line.strokeWidth = 3;
    line.strokeCap = 'round';
    line.dashArray = [10, 12];
    grid.push(line);
}
function getSegment(i, horizontal) {
    var pos = 10 + i * (view.size.width / gridCells); 
    return [[pos, 10], [pos, 600]]
}
function updateSegments() {
    for (var i = 0; i < gridCells; i++) {
        var segmentPoints = getSegment(i);
        grid[i].segments[0].point = segmentPoints[0];
        grid[i].segments[1].point = segmentPoints[1];
    }
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
    }
    onUpdateColor();
});


// ===============================================
// DRAWING

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
// COORDINATE HELPERS

function canvasCoordinate(values) {
    if (values.top) {

    }
    else if (values.bottom) {

    }
}



