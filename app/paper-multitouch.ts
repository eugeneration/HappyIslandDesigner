import paper, { Path, Point, Color } from 'paper';

export function multitouch() {
  let myPaths: paper.Path[] = [];

  window.onload = function () {
    const colors: paper.Color[] = [
      new paper.Color('#83e1c3'),
      new paper.Color('#eee9a9'),
      new paper.Color('#347941'),
      new paper.Color('#35a043'),
      new paper.Color('#4ac34e'),
      new paper.Color('#737a89'),
      new paper.Color('#b0a280'),
      new paper.Color('#d5ac71'),
      new paper.Color('#f9df96'),
      new paper.Color('#999a8c'),
      new paper.Color('#e38f68'),
      new paper.Color('#f1b2c1'),
    ];

    const blah = new Path.Rectangle(new Point(100, 100), new Point(300, 300));
    blah.fillColor = new Color(1, 0, 1);

    // Define array of paths (I've choose 12 because my multitouch table accept 12 touch max)
    for (let i = 0; i < 12; i++) {
      const myPath = new Path();
      myPath.strokeColor = new Color(0, 1, 1);
      myPath.strokeWidth = 2;
      myPaths.push(myPath);
    }

    const myCanvas = document.getElementById('myCanvas');

    // Listen multitouch event for simultation
    document.body.addEventListener('touchstart', touchStart, false);
    document.body.addEventListener('touchmove', touchmove, false);
    document.body.addEventListener('touchend', touchEnd, false);

    const tpCache = {};
    let gestureCache: null | {
      start: any;
      prev: any;
    } = null;

    function getFingerData(event, touch) {
      return {
        touch,
        timeStamp: event.timeStamp,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      };
    }

    function getTwoFingerGestureData(event, touch1, touch2) {
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;

      return {
        identifiers: [touch1.identifier, touch2.identifier],
        centerX: (touch1.clientX + touch2.clientX) / 2,
        centerY: (touch1.clientY + touch2.clientY) / 2,
        distance: Math.sqrt(dx * dx + dy * dy),
        angle: Math.atan2(dy, dx),
      };
    }

    function touchStart(ev) {
      ev.preventDefault();
      for (let i = 0; i < ev.changedTouches.length; i++) {
        tpCache[ev.changedTouches[i].identifier] = {
          start: getFingerData(ev, ev.changedTouches[i]),
          prev: getFingerData(ev, ev.changedTouches[i]),
        };
      }

      if (ev.targetTouches.length == 2) {
        const gestureData = getTwoFingerGestureData(
          ev,
          ev.targetTouches[0],
          ev.targetTouches[1],
        );
        gestureCache = {
          start: gestureData,
          prev: gestureData,
        };
      } else {
        gestureCache = null;
      }
    }

    function touchEnd(ev) {
      ev.preventDefault();

      // Finish all paths
      myPaths = [];
      for (var i = 0; i < 12; i++) {
        const myPath = new Path();
        myPath.strokeColor = new Color(0, 1, 0);
        myPath.strokeWidth = 2;
        myPaths.push(myPath);
      }

      for (var i = 0; i < ev.changedTouches.length; i++) {
        const delta = getDeltaStart(getFingerData(ev, ev.changedTouches[i]));
        delete tpCache[ev.changedTouches[i].identifier];
      }

      if (ev.targetTouches.length == 2) {
        const gestureData = getTwoFingerGestureData(
          ev,
          ev.targetTouches[0],
          ev.targetTouches[1],
        );
        gestureCache = {
          start: gestureData,
          prev: gestureData,
        };
      } else {
        gestureCache = null;
      }

      if (ev.targetTouches.length == 0) {
        console.log('all fingers up');
      }
    }

    const prevDistanceAngle = null;

    function touchmove(ev) {
      ev.preventDefault();

      // Draw path for each touch
      for (var i = 0; i < ev.changedTouches.length; i++) {
        var x1;
        var y1;
        x1 = ev.changedTouches[i].pageX;
        y1 = ev.changedTouches[i].pageY;

        myPaths[i].strokeColor = colors[i];
        myPaths[i].add(paper.view.viewToProject(new Point(x1, y1)));
        paper.view.draw();
      }

      if (ev.targetTouches.length == 1) {
        // Check if the two target touches are the same ones that started
        // the 2-touch
        const delta = getDeltaPrev(getFingerData(ev, ev.targetTouches[0]));
        if (delta) {
          // do something
        }
      }

      if (ev.targetTouches.length == 2) {
        // Check if the two target touches are the same ones that started
        // the 2-touch
        const fingerData1 = getFingerData(ev, ev.targetTouches[0]);
        const fingerData2 = getFingerData(ev, ev.targetTouches[1]);

        const delta1 = getDeltaPrev(fingerData1);
        const delta2 = getDeltaPrev(fingerData2);

        if (delta1 && delta2) {
          const pan = new Point(
            delta1.clientX + delta2.clientX,
            delta1.clientY + delta2.clientY,
          );

          // TODO: verify that the finger identifiers are the same!
          const gestureData = getTwoFingerGestureData(
            ev,
            fingerData1.touch,
            fingerData2.touch,
          );

          // calculate the difference between current touch values and the start values
          const scalePixelChange = gestureData.distance - gestureCache.prev.distance;
          const angleChange = gestureData.angle - gestureCache.prev.angle;

          // calculate how much this should affect the actual object
          const scalingDelta = scalePixelChange / gestureCache.prev.distance;
          const rotationDelta = (angleChange * 180) / Math.PI;

          gestureCache.prev = gestureData;

          paper.view.scale(
            1 + scalingDelta,
            paper.view.viewToProject(
              new Point(gestureCache.prev.centerX, gestureCache.prev.centerY),
            ),
          );
        }
      }
      //    console.log(ev);

      for (var i = 0; i < ev.changedTouches.length; i++) {
        tpCache[ev.changedTouches[i].identifier].prev = getFingerData(
          ev,
          ev.changedTouches[i],
        );
      }
    }

    function getDeltaPrev(fingerData) {
      const id = fingerData.touch.identifier;
      const prevFingerData = tpCache[id] && tpCache[id].prev;
      if (prevFingerData) {
        return getDelta(prevFingerData, fingerData);
      }
      return null;
    }
    function getDeltaStart(fingerData) {
      const id = fingerData.touch.identifier;
      const prevFingerData = tpCache[id] && tpCache[id].start;
      if (prevFingerData) {
        return getDelta(prevFingerData, fingerData);
      }
      return null;
    }

    // returns null if prev point not found.
    function getDelta(fingerData0, fingerData1) {
      return {
        identifier: fingerData1.touch.identifier,
        clientX: fingerData1.touch.clientX - fingerData0.touch.clientX,
        clientY: fingerData1.touch.clientY - fingerData0.touch.clientY,
        time: fingerData1.timeStamp - fingerData0.timeStamp,
        previous: fingerData0.touch,
        current: fingerData1.touch,
      };
    }
  };
}
