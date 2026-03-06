import paper from 'paper';

import { AsyncObjectDefinition } from '../helpers/AsyncObjectDefinition';
import { colors } from '../colors';

export const asyncStructureDefinition = new AsyncObjectDefinition();

asyncStructureDefinition.value = {
  houseIcon: {
    svg: 'static/svg/icon-house.svg',
    preserveColor: true,
    menuScaling: new paper.Point(1.2, 1.2),
    scaling: new paper.Point(0.16, 0.16),
    offset: new paper.Point(-2, -3.8),
  },
  playerHouseIcon: {
    svg: 'static/svg/icon-player-house.svg',
    preserveColor: true,
    menuScaling: new paper.Point(1.2, 1.2),
    scaling: new paper.Point(0.16, 0.16),
    size: new paper.Size(5, 4),
    offset: new paper.Point(-2.5, -3.8),
  },
  playerTentIcon: {
    svg: 'static/svg/icon-playertent.svg',
    preserveColor: true,
    menuScaling: new paper.Point(1.2, 1.2),
    scaling: new paper.Point(0.16, 0.16),
    size: new paper.Size(5, 4),
    offset: new paper.Point(-2.5, -3.8),
  },
  tentRound: { svg: 'static/svg/structure-tentRound.svg' },
  tentTriangle: { svg: 'static/svg/structure-tentTriangle.svg' },
  tentTrapezoid: { svg: 'static/svg/structure-tentTrapezoid.svg' },
  hut: { svg: 'static/svg/structure-hut.svg' },
  house: { svg: 'static/svg/structure-house.svg' },
  building: { svg: 'static/svg/structure-building.svg' },
  tentSprite: {
    img: 'static/sprite/building-tent.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.022, 0.022),
    size: new paper.Size([5, 4]),
    offset: new paper.Point(-2.5, -3.6),
  },
  playerhouseSprite: {
    img: 'static/sprite/building-playerhouse.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.022, 0.022),
    size: new paper.Size([5, 4]),
    offset: new paper.Point(-2.5, -3.6),
  },
  houseSprite: {
    img: 'static/sprite/building-house.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.02, 0.02),
  },
  //    houseFlatSprite: {
  //      img: 'static/sprite/building-flathouse.png',
  //      menuScaling: new paper.Point(.17, .17),
  //      scaling: new paper.Point(.014, .014),
  //    },
  //    houseOutlineFlatSprite: {
  //      img: 'static/sprite/building-flathouseoutline.png',
  //      menuScaling: new paper.Point(.17, .17),
  //      scaling: new paper.Point(.014, .014),
  //    },
  treePineSprite: {
    legacy: 'pine',
    legacyCategory: 'tree',
    img: 'static/sprite/tree-pine.png',
  },
  treePalmSprite: {
    legacy: 'palm',
    legacyCategory: 'tree',
    img: 'static/sprite/tree-palm.png',
  },
  treeFruitSprite: {
    legacy: 'treeOrange',
    legacyCategory: 'tree',
    img: 'static/sprite/tree-fruit.png',
  },
  // legacy
  bush: {
    img: 'static/sprite/tree-fruit.png',
    legacy: 'flatBush',
    legacyCategory: 'tree',
  },
  fruit: {
    img: 'static/sprite/tree-fruit.png',
    legacy: 'flatTree',
    legacyCategory: 'tree',
  },
  palm: {
    img: 'static/sprite/tree-fruit.png',
    legacy: 'flatPalm',
    legacyCategory: 'tree',
  },
  pine: {
    img: 'static/sprite/tree-fruit.png',
    legacy: 'flatPine',
    legacyCategory: 'tree',
  },
};

export function initDefaults() {
  Object.keys(asyncStructureDefinition.value).forEach((structureType) => {
    const def = asyncStructureDefinition.value[structureType];
    def.category = 'structures';
    def.type = structureType;

    if (!def.img && !def.preserveColor) {
      def.colorData = colors.npc;
    }
    def.scaling = def.scaling || new paper.Point(0.032, 0.032);
    def.menuScaling = def.menuScaling || new paper.Point(0.3, 0.3);
    def.size = def.size || new paper.Size(4, 4);
    def.offset = def.offset || new paper.Point(-2, -3.6);
    def.onSelect = function () {};
  });
}

