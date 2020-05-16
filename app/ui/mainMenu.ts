// @ts-nocheck
import paper from 'paper';
import * as animatePaper from 'paper-animate';
import i18next from 'i18next';

import { renderModal } from './modal';
import { colors } from '../colors';
import { saveMapToFile } from '../save';
import { loadMapFromFile, loadTemplate } from '../load';
import { showSwitchModal } from './screenshotModal';
import { OpenMapSelectModal } from '../components/ModalMapSelect';


export let mainMenu: paper.Group;

function createMenuButton(
  name: string,
  img: string,
  column: number,
  row: number,
  onMouseDown: () => void,
) {
  const buttonGroup = new paper.Group();

  const hitSizeHalf = new paper.Point(35, 35);
  const hitSize = new paper.Size(70, 70);

  const button = new paper.Raster(img);
  button.scaling = new paper.Point(0.4, 0.4);
  button.locked = true;

  const hitTarget = new paper.Path.Rectangle(
    button.position.subtract(hitSizeHalf),
    hitSize,
  );
  hitTarget.fillColor = colors.invisible.color;

  buttonGroup.applyMatrix = false;
  buttonGroup.addChildren([hitTarget, button]);
  buttonGroup.position = new paper.Point(20 + column * 70, row * 70);

  buttonGroup.onMouseDown = function () {
    onMouseDown();
  };

  buttonGroup.onMouseEnter = function () {
    mainMenu.data.text.content = name;

    button.position = new paper.Point(0, 0);
    animatePaper.animate(button, [
      {
        properties: {
          position: { y: '-5' },
          scale: 1.1,
        },
        settings: {
          duration: 60,
          easing: 'linear',
        },
      },
      {
        properties: {
          position: { y: '+7' },
        },
        settings: {
          duration: 60,
          easing: 'linear',
        },
      },
      {
        properties: {
          position: { y: '-2' },
        },
        settings: {
          duration: 120,
          easing: 'linear',
        },
      },
    ]);
  };
  buttonGroup.onMouseLeave = function () {
    animatePaper.animate(button, {
      properties: {
        scale: 1,
      },
      settings: {
        duration: 60,
        easing: 'linear',
      },
    });
  };

  return buttonGroup;
}

export function showMainMenu(isShown: boolean) {
  if (!mainMenu) {
    if (!isShown) {
      return;
    }
    mainMenu = renderModal(i18next.t('mainmenu'), 260, 370, () => {
      showMainMenu(false);
    });

    const saveButton = createMenuButton(
      i18next.t('save_image'),
      'static/img/menu-save.png',
      0, 0,
      () => {
        saveMapToFile();
      },
    );
    const loadButton = createMenuButton(
      i18next.t('load_map'),
      'static/img/menu-open.png',
      1, 0,
      () => {
        loadMapFromFile();
      },
    );
    const newButton = createMenuButton(
      i18next.t('new_map'),
      'static/img/menu-new.png',
      2, 0,
      () => {
        // eslint-disable-next-line no-alert, no-restricted-globals
        OpenMapSelectModal();
        showMainMenu(false);
      },
    );
    var switchButton = createMenuButton(
      i18next.t('load_screenshot'),
      'static/img/menu-switch.png', 0, 1,
      () => showSwitchModal(true));

    const twitterButton = createMenuButton(
      i18next.t('twitter'),
      'static/img/menu-twitt.png',
      0, 3,
      () => {
        window.open('https://twitter.com/island_designer', '_blank');
      },
    );
    twitterButton.position = new paper.Point(0, 210);

    mainMenu.data.contents.addChildren([
      saveButton,
      loadButton,
      newButton,
      switchButton,
      twitterButton,
    ]);
    mainMenu.opacity = 0;
  }
  mainMenu.tweenTo({ opacity: isShown ? 1 : 0 }, 200);
  mainMenu.locked = !isShown;
}
