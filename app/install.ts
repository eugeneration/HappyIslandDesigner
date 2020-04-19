import paper from 'paper';
import { store } from './store';

import {onKeyUp, onKeyDown} from './keyboard';

export function install() {
  return new Promise((resolve) => {
    window.onload = function onload() {
      paper.install(window);

      // Setup PaperJS
      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      paper.setup(canvas);
      store.canvas = canvas;

      const map = new paper.Path.Rectangle(
        new paper.Point(window.innerWidth, window.innerWidth),
        new paper.Point(0, 0),
      );

      paper.view.onKeyUp = onKeyUp;
      paper.view.onKeyDown = onKeyDown;

      map.fillColor = new paper.Color(0, 1, 1);
      resolve();
    };
  });
}
