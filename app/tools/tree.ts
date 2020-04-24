import paper from 'paper';

import { AsyncObjectDefinition } from '../helpers/AsyncObjectDefinition';
import { loadSvg } from '../helpers/svgLoad';
import { colors } from '../colors';

export const asyncTreeDefinition = new AsyncObjectDefinition();

asyncTreeDefinition.value = {
  tree: {
    img: 'static/sprite/tree/tree.png',
  },
  treeApple: {
    img: 'static/sprite/tree/tree-apple.png',
  },
  treeCherry: {
    img: 'static/sprite/tree/tree-cherry.png',
  },
  treeOrange: {
    img: 'static/sprite/tree/tree-orange.png',
  },
  treePear: {
    img: 'static/sprite/tree/tree-pear.png',
  },
  treePeach: {
    img: 'static/sprite/tree/tree-peach.png',
  },
  treeAutumn: {
    img: 'static/sprite/tree/tree-autumn.png',
  },
  treeSakura: {
    img: 'static/sprite/tree/tree-sakura.png',
  },
  pine: {
    rename: [0, 'flatPine'],
    img: 'static/sprite/tree/pine.png',
  },
  palm: {
    rename: [0, 'flatPalm'],
    img: 'static/sprite/tree/palm.png',
  },
  bamboo: {
    img: 'static/sprite/tree-bamboo.png',
    menuScaling: new paper.Point(0.26, 0.26),
    scaling: new paper.Point(0.02, 0.02),
    offset: new paper.Point(-0.6, -0.75),
  },

  flatBush: {
    svg: 'bush',
  },
  flatTree: {
    svg: 'fruit',
  },
  flatPalm: {
    svg: 'palm',
  },
  flatPine: {
    svg: 'pine',
  },
};

export function load() {
  Object.keys(asyncTreeDefinition.value).forEach((type) => {
    const def = asyncTreeDefinition.value[type];
    def.category = 'tree';
    def.type = type;
    def.scaling = def.scaling || new paper.Point(0.014, 0.014);
    def.menuScaling = def.menuScaling || new paper.Point(0.2, 0.2);
    def.size = new paper.Size(1, 1);
    def.offset =
      def.offset ||
      new paper.Point(-def.size.width / 2, -def.size.height + 0.2);
    def.onSelect = function () {};

    // imnmediately load the assets
    if (def.svg) {
      def.colorData = colors.level3;
      def.scaling = new paper.Point(0.03, 0.03);
      def.menuScaling = new paper.Point(0.6, 0.6);
      def.size = def.size || new paper.Size([1, 1]);
      def.offset = def.offset || new paper.Point(-1, -0.75);
      def.onSelect = function () {};
      // imnmediately load the assets

      loadSvg(`tree-${def.svg}`, (item) => {
        // item.pivot += new paper.Point(-2, -3.6);
        def.icon = item;
        asyncTreeDefinition.onLoad();
      });
    } else if (def.img) {
      const img = new paper.Raster(def.img);
      def.icon = img;
      def.icon.onLoad = function () {
        asyncTreeDefinition.onLoad();
      };
      img.remove();
    }
  });
}
