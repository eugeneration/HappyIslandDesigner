import { Group, Path, Point, PointText, Raster, Rectangle, Size, view } from 'paper';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';

export var modals: Array<paper.Group> = [];

export function renderModal(
  name: string,
  width: number,
  height: number,
  onDismiss,
  options?: {fullscreen?: boolean}
): paper.Group {
  var fullscreen = options?.fullscreen ?? false;

  layers.modalLayer.activate();

  const group = new Group();

  const darkFill = new Path.Rectangle(new paper.Rectangle(0, 0, 1, 1));
  darkFill.fillColor = colors.offBlack.color;
  darkFill.fillColor.alpha = 0.3;
  darkFill.onMouseUp = onDismiss;

  var modal = new Path();
  modal.fillColor = colors.paper.color;
  modal.onMouseEnter = function () {
    group.data.text.content = name;
  };

  const modalContents = new Group();
  modalContents.applyMatrix = false;
  modalContents.pivot = new Point(0, 0);
  modalContents.data = {
    addElement() {},
  };

  function resize() {
    const topLeft = new Point(0, 0);// + view.bounds.topLeft;
    const center = new Point(view.bounds.width * view.scaling.x / 2, view.bounds.height * view.scaling.y / 2);// + view.bounds.topLeft * 2;
    const bottomRight = new Point(view.bounds.width * view.scaling.x, view.bounds.height * view.scaling.y);// + view.bounds.topLeft * 2;

    darkFill.bounds = new Rectangle(topLeft, bottomRight);

    if (fullscreen) {
      modal.segments = new Path.Rectangle(new Rectangle(
        width, height, bottomRight.x - width * 2, bottomRight.y - height * 2),
        new Size(60, 60)).segments;
    }
    else if (!modal || modal.segments.length == 0) {
      modal.segments = new Path.Rectangle(new Rectangle(
        center.x - width / 2,
        center.y - height / 2, width, height),
        new Size(60, 60)).segments;
    }
    modal.position = center;
    modalContents.position = modal.bounds.topLeft.add(new Point(40, 120));

    group.data.width = modal.bounds.width - 40 * 2;
    group.data.height = modal.bounds.height - 120 - 40;
    group.data.contents = modalContents;
  }
  emitter.on('resize', resize);
  resize();

  const text = new PointText(new Point(group.data.width / 2, -50));
  text.justification = 'center';
  text.content = name;
  text.fontSize = 20;
  text.fontFamily = 'TTNorms, sans-serif';
  text.fillColor = colors.text.color;
  modalContents.addChild(text);

  const statusBar = new Raster('static/img/ui-phonestatus.png');
  statusBar.scaling = new Point(0.35, 0.35);
  statusBar.position = new Point(group.data.width / 2 - 10, -93);
  modalContents.addChild(statusBar);

  const time = new PointText(new Point(group.data.width / 2, -90));
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

  modals.push(group);
  group.data.isShown = function() { return group.opacity > 0.8; };
  group.data.show = function(isShown) {
    modals.forEach(function (modal) {
      var show = isShown && modal == group;
      var targetOpacity = show ? 1 : 0;
      if (modal.opacity != targetOpacity)
        modal.tweenTo({opacity: targetOpacity}, 200);
      modal.locked = !show;
    });
  }

  return group;
}
