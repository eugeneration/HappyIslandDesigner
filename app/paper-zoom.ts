// ===============================================
// TOUCH EVENTS

// https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Multi-touch_interaction

// ===============================================
// SCROLL EVENTS

import {project, view, Point} from 'paper';

export function zoom() {
  view.on('twofingermove', (event) => {
    changeZoomCentered(event.deltaScale * 500, event.center);
    view.center = view.viewToProject(
      view.projectToView(view.center).subtract(event.deltaPosition),
    );
  });

  const MouseWheelHandler = (event) => {
    const mousePosition = new paper.Point(event.offsetX, event.offsetY);

    let deltaX = event.deltaX;
    let deltaY = event.deltaY;
    let factor = -1;
    deltaY *= factor;

    if (event.altKey || event.ctrlKey) {
      if (event.altKey) {
        deltaY += deltaX;
      }
      if (event.ctrlKey) {
        deltaY *= 6;
      }
      changeZoomCentered(deltaY, mousePosition);
    } else {
      changeCenterPosition(deltaX, deltaY);
    }
    event.preventDefault();
  };

  // doesn't work on some older browsers but whatevs
  view.element.addEventListener("wheel", MouseWheelHandler, false);

  // function onResize(event) {
  // Whenever the window is resized, recenter the path:
  // }

  // ===============================================
  // MOUSE EVENTS

  // Todo: add middle click panning functionality for mouse
  //function onMiddleClickDown(event) {
  //  console.log(event);
  //}
  //
  //function onMiddleClickDrag(event) {}
  //
  //function onMiddleClickUp(event) {}

  let isSpaceDown = false;
  let mouseNativeStart: paper.Point | null = null;
  let viewCenterStart: paper.Point | null = null;

  view.on('keydown', (event) => {
    if (event.key === 'space') {
      isSpaceDown = true;
    }
  });

  view.on('keyup', (event) => {
    if (event.key === 'space') {
      isSpaceDown = false;
    }
  });

  // This function is called whenever the user
  // clicks the mouse in the view:
  view.on('mousedown', (event) => {
    if (!isSpaceDown) {
      return;
    }
    viewCenterStart = view.center;
    // Have to use native mouse offset, because ev.delta
    //  changes as the view is scrolled.
    mouseNativeStart = new Point(event.event.offsetX, event.event.offsetY);
  });

  view.on('mousedrag', (event) => {
    if (!isSpaceDown) {
      return;
    }
    if (viewCenterStart && mouseNativeStart) {
      const nativeDelta = new paper.Point(
        event.event.offsetX - mouseNativeStart.x,
        event.event.offsetY - mouseNativeStart.y,
      );
      // Move into view coordinates to subract delta,
      //  then back into project coords.
      view.center = view.viewToProject(
        view.projectToView(viewCenterStart).subtract(nativeDelta),
      );
    }
  });

  view.on('mouseup', () => {
    mouseNativeStart = null;
    viewCenterStart = null;
  });

  // ===============================================
  // PUBLIC FUNCTIONS

  let _minZoom;
  let _maxZoom;

  setZoomRange([view.size.multiply(2), view.size.multiply(0.05)]);

  function changeCenterPosition(deltaX, deltaY) {

    view.center = view.center.add(new paper.Point(deltaX, -deltaY).divide(view.zoom));
    // limit movement
    view.center = new paper.Point(
      Math.min(
        Math.max(view.center.x, view.scaling.x * view.bounds.width * 0),
        view.scaling.x * view.bounds.width,
      ),
      Math.min(
        Math.max(view.center.y, view.scaling.y * view.bounds.height * 0),
        view.scaling.y * view.bounds.height,
      ),
    );
  }

  function setZoomRange(range /* paper.Size[] */) /* number[] */ {
    const { view } = project;
    const aSize = range.shift();
    const bSize = range.shift();
    const a =
      aSize &&
      Math.min(
        view.bounds.height / aSize.height,
        view.bounds.width / aSize.width,
      );
    const b =
      bSize &&
      Math.min(
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
    if (zoom !== view.zoom) {
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
    let newZoom = delta > 0 ? view.zoom * factor : view.zoom / factor;
    newZoom = setZoomConstrained(newZoom);

    if (!newZoom) {
      return;
    }

    const zoomScale = oldZoom / newZoom;
    const centerAdjust = viewPos.subtract(oldCenter);
    const offset = viewPos
      .subtract(centerAdjust.multiply(zoomScale))
      .subtract(oldCenter);

    view.center = view.center.add(offset);
  }

}
