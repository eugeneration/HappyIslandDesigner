// ===============================================
// TOUCH EVENTS

// https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Multi-touch_interaction

// ===============================================
// SCROLL EVENTS

view.on('twofingermove', (event) => {
  changeZoomCentered(event.deltaScale * 500, event.center);
  view.center = view.viewToProject(
    view.projectToView(view.center)
      .subtract(event.deltaPosition),
  );
});

$(view.element).mousewheel((event) => {
  const mousePosition = new Point(event.offsetX, event.offsetY);

  if (event.altKey || event.ctrlKey) {
    if (event.altKey) event.deltaY += event.deltaX;
    if (event.ctrlKey) event.deltaY *= 6;
    changeZoomCentered(event.deltaY * event.deltaFactor, mousePosition);
  } else {
    changeCenterPosition(event.deltaX, event.deltaY, event.deltaFactor);
  }
  event.preventDefault();
});

// function onResize(event) {
// Whenever the window is resized, recenter the path:
// }

// ===============================================
// MOUSE EVENTS

function onMiddleClickDown(event) {
  console.log(event);
}

function onMiddleClickDrag(event) {

}

function onMiddleClickUp(event) {

}

let isSpaceDown = false;
let mouseNativeStart = null;
let viewCenterStart = null;

view.on('keydown', (event) => {
  if (event.key == 'space') isSpaceDown = true;
});

view.on('keyup', (event) => {
  if (event.key == 'space') isSpaceDown = false;
});

// This function is called whenever the user
// clicks the mouse in the view:
view.on('mousedown', (event) => {
  if (!isSpaceDown) return;
  viewCenterStart = view.center;
  // Have to use native mouse offset, because ev.delta
  //  changes as the view is scrolled.
  mouseNativeStart = new Point(event.event.offsetX, event.event.offsetY);
});

view.on('mousedrag', (event) => {
  if (!isSpaceDown) return;
  if (viewCenterStart) {
    const nativeDelta = new Point(
      event.event.offsetX - mouseNativeStart.x,
      event.event.offsetY - mouseNativeStart.y,
    );
    // Move into view coordinates to subract delta,
    //  then back into project coords.
    view.center = view.viewToProject(
      view.projectToView(viewCenterStart)
        .subtract(nativeDelta),
    );
  }
});

view.on('mouseup', (event) => {
  mouseNativeStart = null;
  viewCenterStart = null;
});

// ===============================================
// PUBLIC FUNCTIONS

setZoomRange([view.size * 2, view.size * 0.05]);

function changeCenterPosition(deltaX, deltaY, factor) {
  view.center += new Point(deltaX, -deltaY) * factor / view.zoom;
  // limit movement
  view.center = new Point(
    Math.min(Math.max(view.center.x, view.scaling.x * view.bounds.width * 0), view.scaling.x * view.bounds.width),
    Math.min(Math.max(view.center.y, view.scaling.y * view.bounds.height * 0), view.scaling.y * view.bounds.height),
  );
}

function setZoomRange(range /* paper.Size[] */) /* number[] */ {
  const { view } = project;
  const aSize = range.shift();
  const bSize = range.shift();
  const a = aSize && Math.min(
    view.bounds.height / aSize.height,
    view.bounds.width / aSize.width,
  );
  const b = bSize && Math.min(
    view.bounds.height / bSize.height,
    view.bounds.width / bSize.width,
  );
  const min = Math.min(a, b);
  if (min) {
    _minZoom = min;
  }
  const max = Math.max(a, b);
  if (max) {
    _maxZoom = max;
  }
  return [_minZoom, _maxZoom];
}

// ===============================================
// ZOOM FUNCTIONS

function setZoomConstrained(zoom) {
  if (_minZoom) {
    zoom = Math.max(zoom, _minZoom);
  }
  if (_maxZoom) {
    zoom = Math.min(zoom, _maxZoom);
  }
  const { view } = project;
  if (zoom != view.zoom) {
    view.zoom = zoom;
    return zoom;
  }
  return null;
}

function changeZoomCentered(delta, mousePos) {
  if (!delta) {
    return;
  }
  const { view } = project;
  const oldZoom = view.zoom;
  const oldCenter = view.center;
  const viewPos = view.viewToProject(mousePos);

  const factor = 1 + Math.abs(delta) / 500;
  let newZoom = delta > 0
    ? view.zoom * factor
    : view.zoom / factor;
  newZoom = setZoomConstrained(newZoom);

  if (!newZoom) {
    return;
  }

  const zoomScale = oldZoom / newZoom;
  const centerAdjust = viewPos.subtract(oldCenter);
  const offset = viewPos.subtract(centerAdjust.multiply(zoomScale))
    .subtract(oldCenter);

  view.center = view.center.add(offset);
}
