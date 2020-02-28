// ===============================================
// GLOBAL FUNCTIONS

var factor = 1.03;
var _minZoom;
var _maxZoom;
var mouseNativeStart;
var viewCenterStart;

$(view.element).mousewheel(function(event) {
  var mousePosition = new Point(event.offsetX, event.offsetY);
  if (event.shiftKey) {
    changeZoomCentered(event.deltaY, mousePosition);
  } else {
    changeCenterPosition(event.deltaX, event.deltaY, event.deltaFactor);
  }
});

//function onResize(event) {
    // Whenever the window is resized, recenter the path:
//}

// This function is called whenever the user
// clicks the mouse in the view:
function onMouseDown(event) {
    viewCenterStart = view.center;
    // Have to use native mouse offset, because ev.delta 
    //  changes as the view is scrolled.
    mouseNativeStart = new Point(ev.event.offsetX, ev.event.offsetY);
}

function onMouseDrag(event) {
    if(viewCenterStart) {   
        var nativeDelta = new Point(
            event.offsetX - mouseNativeStart.x,
            event.offsetY - mouseNativeStart.y
        );
        // Move into view coordinates to subract delta,
        //  then back into project coords.
        view.center = view.viewToProject( 
            view.projectToView(viewCenterStart)
            .subtract(nativeDelta));
    }
}

function onMouseUp(event) {
    if(mouseNativeStart){
        mouseNativeStart = null;
        viewCenterStart = null;
    }
}


// ===============================================
// PUBLIC FUNCTIONS

setZoomRange([view.size, new Size(100, 100)]);

function changeCenterPosition(deltaX, deltaY, factor) {
  view.center += new Point(deltaX, -deltaY) * factor / view.zoom;
}

function setZoomRange(range /*paper.Size[]*/) /* number[] */ {
    var view = project.view;
    var aSize = range.shift();
    var bSize = range.shift();
    var a = aSize && Math.min( 
        view.bounds.height / aSize.height,         
        view.bounds.width / aSize.width);
    var b = bSize && Math.min( 
        view.bounds.height / bSize.height,         
        view.bounds.width / bSize.width);
    var min = Math.min(a,b);
    if(min){
        _minZoom = min;
    }
    var max = Math.max(a,b);
    if(max){
        _maxZoom = max;
    }
    return [_minZoom, _maxZoom];
}

// ===============================================
// ZOOM FUNCTIONS

function setZoomConstrained(zoom) {
    if(_minZoom) {
        zoom = Math.max(zoom, _minZoom);
    }
    if(_maxZoom){
        zoom = Math.min(zoom, _maxZoom);
    }
    var view = project.view;
    if(zoom != view.zoom){
        view.zoom = zoom;
        return zoom;
    }
    return null;
}

function changeZoomCentered(delta, mousePos) {
    if (!delta) {
        return;
    }
    var view = project.view;
    var oldZoom = view.zoom;
    var oldCenter = view.center;
    var viewPos = view.viewToProject(mousePos);
    
    var newZoom = delta > 0
        ? view.zoom * factor
        : view.zoom / factor;
    newZoom = setZoomConstrained(newZoom);
    
    if(!newZoom){
        return;
    }

    var zoomScale = oldZoom / newZoom;
    var centerAdjust = viewPos.subtract(oldCenter);
    var offset = viewPos.subtract(centerAdjust.multiply(zoomScale))
        .subtract(oldCenter);

    view.center = view.center.add(offset);
};
