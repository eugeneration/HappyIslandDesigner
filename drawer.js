
// Create a Paper.js Path to draw a line into it:
var path = new Path();
// Give the stroke a color
path.strokeColor = 'black';
var start = new Point(100, 100);
// Move to start and draw a line from there
path.moveTo(start);
// Note the plus operator on Point objects.
// PaperScript does that for us, and much more!
path.lineTo(start + [ 100, -50 ]);


// Create a circle shaped path with its center at the center
// of the view and a radius of 30:
var circle = new Path.Circle({
    center: view.center,
    radius: 30,
    strokeColor: 'black'
});

function onResize(event) {
    // Whenever the window is resized, recenter the path:
    circle.position = view.center;
}

// Create a new path once, when the script is executed:
var myPath = new Path();
myPath.strokeColor = 'black';

// This function is called whenever the user
// clicks the mouse in the view:
function onMouseDown(event) {
    // Add a segment to the path at the position of the mouse:
    console.log(project);
    project.zoom = event.point.x;
}