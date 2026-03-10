import paper from 'paper';

let numSvgToLoad = 0;
let numSvgLoaded = 0;
function OnLoaded() {
  numSvgLoaded += 1;
  if (numSvgToLoad === numSvgLoaded) {
    // all done loading
  }
}

export function loadSvg(filename: string, itemCallback) {
  numSvgToLoad += 1;
  paper.project.importSVG(filename, {
    onLoad(item: paper.Item) {
      item.remove();
      item.position = new paper.Point(0, 0);
      itemCallback(item);
      OnLoaded();
    },
  });
}
