import paper from 'paper';

import { renderModal } from './modal';
import { colors } from '../colors';
import { saveMapToFile } from '../save';
import { loadMapFromFile, loadTemplate } from '../load';

let mainMenu: paper.Group;

function createMenuButton(
  name: string,
  img: string,
  index: number,
  onMouseDown: () => void,
) {
  const buttonGroup = new paper.Group();

  const hitSizeHalf = new paper.Point(35, 35);
  const hitSize = new paper.Size(70, 70);

  const button = new paper.Raster(img);
  button.scaling = new paper.Point(0.4, 0.4);
  button.locked = true;

  const hitTarget = new paper.Path.Rectangle(
    button.position - hitSizeHalf,
    hitSize,
  );
  hitTarget.fillColor = colors.invisible.color;

  buttonGroup.applyMatrix = false;
  buttonGroup.addChildren([hitTarget, button]);
  buttonGroup.position = new paper.Point(20 + index * 70, 0);

  buttonGroup.onMouseDown = function () {
    onMouseDown();
  };

  buttonGroup.onMouseEnter = function () {
    mainMenu.data.text.content = name;

    button.position = new paper.Point(0, 0);
    button.animate([
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
    button.animate({
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
    mainMenu = renderModal('Main Menu', 260, 370, () => {
      showMainMenu(false);
    });

    const saveButton = createMenuButton(
      'Save as Image',
      'static/img/menu-save.png',
      0,
      () => {
        saveMapToFile();
      },
    );
    const loadButton = createMenuButton(
      'Load Map',
      'static/img/menu-open.png',
      1,
      () => {
        loadMapFromFile();
      },
    );
    const newButton = createMenuButton(
      'New Map',
      'static/img/menu-new.png',
      2,
      () => {
        // eslint-disable-next-line no-alert, no-restricted-globals
        const r = confirm('Clear your map? You will lose all unsaved changes.');
        if (r === true) {
          loadTemplate();
        }
      },
    );

    const twitterButton = createMenuButton(
      'Twitter',
      'static/img/menu-twitt.png',
      0,
      () => {
        window.open('https://twitter.com/island_designer', '_blank');
      },
    );
    twitterButton.position = new paper.Point(0, 210);

    mainMenu.data.contents.addChildren([
      saveButton,
      loadButton,
      newButton,
      twitterButton,
    ]);
    mainMenu.opacity = 0;
  }
  mainMenu.tweenTo({ opacity: isShown ? 1 : 0 }, 200);
  mainMenu.locked = !isShown;
}
