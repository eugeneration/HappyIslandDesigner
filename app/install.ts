import paper from 'paper';
import * as React from "react";
import * as ReactDOM from "react-dom";

import { store } from './store';
import {onKeyUp, onKeyDown} from './keyboard';
import { App } from "./components/App";

export function install() {
  return new Promise((resolve) => {
    window.onload = function onload() {
      paper.install(window);

      // bring outlines back when user presses tab
      document.body.addEventListener('keyup', function(e) {
        if (e.which === 9) /* tab */ {
          document.documentElement.classList.remove('no-focus-outline');
        }
      });

      // Setup PaperJS
      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      paper.setup(canvas);
      store.canvas = canvas;

      const map = new paper.Path.Rectangle(
        new paper.Point(window.innerWidth, window.innerWidth),
        new paper.Point(0, 0),
      );

      // @ts-ignore
      paper.view.onKeyUp = onKeyUp;
      // @ts-ignore
      paper.view.onKeyDown = onKeyDown;

      map.fillColor = new paper.Color(0, 1, 1);
      resolve();

      // Setup React
      ReactDOM.render(
        React.createElement(App, {}),
        document.getElementById("ui-container")
      );
    };
  });
}
