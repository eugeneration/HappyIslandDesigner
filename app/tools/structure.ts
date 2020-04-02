import paper from 'paper';

import { AsyncObjectDefinition } from '../helpers/AsyncObjectDefinition';
import { colors } from '../colors';
import { loadSvg } from '../helpers/svgLoad';

export const asyncStructureDefinition = new AsyncObjectDefinition();

asyncStructureDefinition.value = {
  tentRound: {},
  tentTriangle: {},
  tentTrapezoid: {},
  hut: {},
  house: {},
  building: {},
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

export function load() {
  // set up the definitions programatically because they are all the same
  Object.keys(asyncStructureDefinition.value).forEach((structureType) => {
    const def = asyncStructureDefinition.value[structureType];
    def.category = 'structures';
    def.type = structureType;

    def.colorData = colors.npc;
    def.scaling = def.scaling || new paper.Point(0.032, 0.032);
    def.menuScaling = def.menuScaling || new paper.Point(0.3, 0.3);
    def.size = def.size || new paper.Size(4, 4);
    def.offset = def.offset || new paper.Point(-2, -3.6);
    def.onSelect = function () {};
    // imnmediately load the assets
    if (def.img) {
      const img = new paper.Raster(def.img);
      def.icon = img;
      def.icon.onLoad = function () {
        asyncStructureDefinition.onLoad();
      };
      img.remove();
    } else {
      loadSvg(`structure-${structureType}`, (item) => {
        // item.pivot += new paper.Point(-2, -3.6);
        def.icon = item;
        asyncStructureDefinition.onLoad();
      });
    }
  });
}
