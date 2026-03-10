import paper from 'paper';
import { colors } from '../colors';
import { showHelpMenu } from './help';
import { createButton } from './createButton';
import { imgPath } from '../constants';
import { layers } from '../layers';
import { toolCategoryDefinition } from '../tools';

let leftToolMenuPosition: paper.Point;
let leftToolMenu: paper.Group;
let leftToolMenuBacking: paper.Path;
const leftToolMenuIconHeight = 50;
const defaultBackingHeight = 480;
const extendedBackingHeight = 530;

export function addToLeftToolMenu(icon?: any) {
  if (!icon) {
    //      // create spacer
    //      icon = new paper.Path.Rectangle(0, 0, 40, 2);
    //      icon.fillColor = colors.lightText.color;
    //      icon.position = leftToolMenuPosition - new paper.Point(0, leftToolMenuIconHeight / 4);
    //      leftToolMenu.addChild(icon);
    leftToolMenuPosition.y += leftToolMenuIconHeight / 2;
    return;
  }

  icon.position = leftToolMenuPosition;
  leftToolMenu.addChild(icon);
  leftToolMenuPosition.y += leftToolMenuIconHeight;
}

export function createLeftMenu() {
  layers.fixedLayer.activate();

  leftToolMenu = new paper.Group();
  leftToolMenu.applyMatrix = false;
  leftToolMenu.position = new paper.Point(30, 0);

  leftToolMenuBacking = new paper.Path();
  leftToolMenuBacking.strokeColor = colors.paper.color;
  leftToolMenuBacking.strokeWidth = 120;
  leftToolMenuBacking.strokeCap = 'round';
  leftToolMenuBacking.segments = [
    new paper.Segment(new paper.Point(-30, -0)),
    new paper.Segment(new paper.Point(-30, 480)),
  ];
  leftToolMenu.addChild(leftToolMenuBacking);

  leftToolMenuPosition = new paper.Point(0, 40);

  // add gap
  leftToolMenuPosition.y += 60;
}

export function setLeftMenuExtended(extended: boolean): void {
  if (leftToolMenuBacking) {
    const height = extended ? extendedBackingHeight : defaultBackingHeight;
    leftToolMenuBacking.segments[1].point.y = height;
  }
}

export function hideLeftMenu(): void {
  if (leftToolMenu) leftToolMenu.visible = false;
  // Hide any open tool sub-menus via their openMenu(false) which handles side effects
  // (e.g. terrain/path also hide brush size UI)
  Object.values(toolCategoryDefinition).forEach((cat: any) => {
    if (cat.openMenu && cat.iconMenu) cat.openMenu(false);
  });
}

export function showLeftMenu(): void {
  if (leftToolMenu) leftToolMenu.visible = true;
}

export function addHelpButton() {
  addToLeftToolMenu(); // add gap

  const btn = new paper.Raster(`${imgPath}menu-help.png`);
  btn.scaling = new paper.Point(0.3, 0.3);
  btn.position = new paper.Point(0, 4);

  const button = createButton(btn, 20, () => showHelpMenu(true));
  addToLeftToolMenu(button);
}
