import paper from 'paper';
import { emitter } from '../emitter';
import { colors } from '../colors';

export let modalLayer: paper.Layer;

export function renderModal(
  name: string,
  width: number,
  height: number,
  onDismiss,
): paper.Group {
  if (!modalLayer) {
    modalLayer = new paper.Layer();
    modalLayer.applyMatrix = false;
  }
  const topLeft = new paper.Point(0, 0); // + paper.view.bounds.topLeft;
  const center = new paper.Point(
    (paper.view.bounds.width * paper.view.scaling.x) / 2,
    (paper.view.bounds.height * paper.view.scaling.y) / 2,
  ); // + paper.view.bounds.topLeft * 2;
  const bottomRight = new paper.Point(
    paper.view.bounds.width * paper.view.scaling.x,
    paper.view.bounds.height * paper.view.scaling.y,
  ); // + paper.view.bounds.topLeft * 2;

  modalLayer.activate();

  const group = new paper.Group();

  const darkFill = new paper.Path.Rectangle(
    new paper.Rectangle(topLeft, bottomRight),
  );
  darkFill.fillColor = colors.offBlack.color;
  darkFill.fillColor.alpha = 0.3;
  darkFill.onMouseUp = onDismiss;

  const modal = new paper.Path.Rectangle(
    new paper.Rectangle(
      center.x - width / 2,
      center.y - height / 2,
      width,
      height,
    ),
    new paper.Size(60, 60),
  );
  modal.fillColor = colors.paper.color;
  modal.onMouseEnter = function (event) {
    group.data.text.content = name;
  };

  const modalContents = new paper.Group();
  modalContents.applyMatrix = false;
  modalContents.pivot = new paper.Point(0, 0);
  modalContents.position = modal.bounds.topLeft.add(new paper.Point(40, 120));
  modalContents.data = {
    addElement() {},
  };

  group.data = {
    width: modal.bounds.width - 40 * 2,
    height: modal.bounds.height - 120 - 40,
    contents: modalContents,
  };

  emitter.on('resize', () => {
    const topLeft = new paper.Point(0, 0); // + paper.view.bounds.topLeft;
    const center = new paper.Point(
      (paper.view.bounds.width * paper.view.scaling.x) / 2,
      (paper.view.bounds.height * paper.view.scaling.y) / 2,
    ); // + paper.view.bounds.topLeft * 2;
    const bottomRight = new paper.Point(
      paper.view.bounds.width * paper.view.scaling.x,
      paper.view.bounds.height * paper.view.scaling.y,
    ); // + paper.view.bounds.topLeft * 2;

    // var topLeft = paper.view.viewToProject(paper.view.projectToView(new paper.Point(0, 0)));// + paper.view.bounds.topLeft;
    // var center = paper.view.viewToProject(paper.view.projectToView(new paper.Point(paper.view.bounds.width / 2, paper.view.bounds.height / 2)));// + paper.view.bounds.topLeft * 2;
    // var bottomRight = paper.view.viewToProject(paper.view.projectToView(new paper.Point(paper.view.bounds.width, paper.view.bounds.height)));// + paper.view.bounds.topLeft * 2;

    darkFill.bounds = new paper.Rectangle(topLeft, bottomRight);
    modal.position = center;
    modalContents.position = modal.bounds.topLeft.add(new paper.Point(40, 135));
  });

  const text = new paper.PointText(new paper.Point(group.data.width / 2, -50));
  text.justification = 'center';
  (text.content = name), (text.fontSize = 20);
  text.fontFamily = 'TTNorms, sans-serif';
  text.fillColor = colors.text.color;
  modalContents.addChild(text);

  const statusBar = new paper.Raster('static/img/ui-phonestatus.png');
  statusBar.scaling = new paper.Point(0.35, 0.35);
  statusBar.position = new paper.Point(group.data.width / 2 - 10, -93);
  modalContents.addChild(statusBar);

  const time = new paper.PointText(new paper.Point(group.data.width / 2, -90));
  time.justification = 'center';
  time.fontSize = 12;
  time.fontFamily = 'TTNorms, sans-serif';
  time.fillColor = colors.lightText.color;
  time.content = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  setInterval(() => {
    time.content = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, 10000);
  modalContents.addChild(time);

  group.addChildren([darkFill, modal, modalContents]);

  group.data.text = text;

  return group;
}
