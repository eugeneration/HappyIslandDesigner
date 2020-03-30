import paper from 'paper';
import { store } from './store';

export function init() {
  return new Promise((resolve) => {
    window.onload = function () {
      // Setup PaperJS
      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      paper.setup(canvas);
      store.canvas = canvas;

      const map = new paper.Path.Rectangle(
        new paper.Point(150, 150),
        new paper.Point(100, 100)
      );

      map.fillColor = new paper.Color(0, 1, 1);
      resolve();
    };
  });
}
