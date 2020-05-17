import paper from 'paper';

import { renderModal } from './modal';
import { colors } from '../colors';
import i18next from 'i18next';

export let helpMenu: paper.Group;

export function showHelpMenu(isShown: boolean) {
  if (!helpMenu) {
    helpMenu = renderModal(i18next.t('hotkey'), 340, 560, () => {
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
    helpText.content = i18next.t('hotkey_tips1');

    const helpText2 = new paper.PointText(new paper.Point(100, -10));
    helpText2.justification = 'left';
    helpText2.fontSize = 16;
    helpText2.fontFamily = 'TTNorms, sans-serif';
    helpText2.fillColor = colors.text.color;
    helpText2.content = i18next.t('hotkey_tips2');

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
    versionCode.content = 'v0.4.1';

    helpMenu.data.contents.addChildren([
      helpTextRaster,
      helpText2Raster,
      versionCode,
    ]);

    helpMenu.opacity = 0;
  }
  helpMenu.data.show(isShown);
}
