import paper from 'paper';

const svgPath = 'static/svg/';
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
  paper.project.importSVG(`${svgPath + filename}.svg`, {
    onLoad(item: paper.Item) {
      item.remove();
      item.position = new paper.Point(0, 0);
      itemCallback(item);
      OnLoaded();
    },
  });
}
