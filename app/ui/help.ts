import paper from 'paper';

import { renderModal } from './modal';
import { colors } from '../colors';

export let helpMenu: paper.Group;

export function showHelpMenu(isShown: boolean) {
  if (!helpMenu) {
    helpMenu = renderModal('Hotkeys', 340, 560, () => {
      showHelpMenu(false);
    });
    helpMenu.onMouseUp = function () {
      showHelpMenu(false);
    };

    const helpText = new paper.PointText(new paper.Point(80, -10));
    helpText.justification = 'right';
    helpText.fontSize = 16;
    helpText.fontFamily = 'TTNorms, sans-serif';
    helpText.fillColor = colors.oceanText.color;
    helpText.content =
      'space+drag\n' +
      'alt+scroll\n' +
      '\\\n' +
      'shift+drag\n' +
      '[ ]\n' +
      'p\n' +
      'alt+click\n' +
      'delete\n' +
      'ctrl + z\n' +
      'ctrl + y\n' +
      '\n' +
      'v\n' +
      'b\n' +
      'n\n' +
      'm\n' +
      '\n' +
      'ctrl + s\n' +
      'ctrl + o\n' +
      'esc\n' +
      '?\n' +
      '';

    const helpText2 = new paper.PointText(new paper.Point(100, -10));
    helpText2.justification = 'left';
    helpText2.fontSize = 16;
    helpText2.fontFamily = 'TTNorms, sans-serif';
    helpText2.fillColor = colors.text.color;
    helpText2.content =
      'pan\n' +
      'zoom\n' +
      'toggle grid\n' +
      'draw line\n' +
      'adjust brush size\n' +
      'square/circle brush\n' +
      'color pick\n' +
      'delete selection\n' +
      'undo\n' +
      'redo\n' +
      '\n' +
      'terrain tool \n' +
      'path tool\n' +
      'building tool\n' +
      'amenities tool\n' +
      '\n' +
      'save\n' +
      'open map file\n' +
      'main menu\n' +
      'hotkeys\n' +
      '';

    const helpTextRaster = helpText.rasterize();
    const helpText2Raster = helpText2.rasterize();
    helpText.remove();
    helpText2.remove();

    const versionCode = new paper.PointText(
      new paper.Point(
        helpMenu.data.width / 2,
        helpMenu.data.height,
      )
    );
    versionCode.justification = 'center';
    versionCode.fontSize = 12;
    versionCode.fontFamily = 'TTNorms, sans-serif';
    versionCode.fillColor = colors.lightText.color;
    versionCode.content = 'v0.4.0';

    helpMenu.data.contents.addChildren([
      helpTextRaster,
      helpText2Raster,
      versionCode,
    ]);

    helpMenu.opacity = 0;
  }
  helpMenu.data.show(isShown);
}
