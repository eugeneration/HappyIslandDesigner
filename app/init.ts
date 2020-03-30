import paper from 'paper';

export function init() {
  window.onload = function () {
    const map = new paper.Path.Rectangle(
      new paper.Point(150, 150),
      new paper.Point(100, 100)
    );

    map.fillColor = new paper.Color(0, 1, 1);
  };
}
