import { AsyncObjectDefinition } from '../helpers/AsyncObjectDefinition';

export const asyncFlowerDefinition = new AsyncObjectDefinition();

asyncFlowerDefinition.value = {
  chrysanthemumWhite: {
    img: 'static/sprite/flower/chrysanthemum-white.png',
  },
  hyacinthRed: {
    img: 'static/sprite/flower/hyacinth-red.png',
  },
  hyacinthWhite: {
    img: 'static/sprite/flower/hyacinth-white.png',
  },
  lilyWhite: {
    img: 'static/sprite/flower/lily-white.png',
  },
  pansyPurple: {
    img: 'static/sprite/flower/pansy-purple.png',
  },
  pansyRed: {
    img: 'static/sprite/flower/pansy-red.png',
  },
  pansyYellow: {
    img: 'static/sprite/flower/pansy-yellow.png',
  },
  poppyOrange: {
    img: 'static/sprite/flower/poppy-orange.png',
  },
  poppyRed: {
    img: 'static/sprite/flower/poppy-red.png',
  },
  poppyWhite: {
    img: 'static/sprite/flower/poppy-white.png',
  },
  tulipRed: {
    img: 'static/sprite/flower/tulip-red.png',
  },
  tulipWhite: {
    img: 'static/sprite/flower/tulip-white.png',
  },
  tulipYellow: {
    img: 'static/sprite/flower/tulip-yellow.png',
  },
  //    weedBush: {
  //      img: 'static/sprite/flower/weed-bush.png',
  //    },
  //    weedBrush: {
  //      img: 'static/sprite/flower/weed-brush.png',
  //    },
  weedClover: {
    img: 'static/sprite/flower/weed-clover.png',
  },
  //    weedCattail: {
  //      img: 'static/sprite/flower/weed-cattail.png',
  //    },
  //    weedDandelion: {
  //      img: 'static/sprite/flower/weed-dandelion.png',
  //    },
};

export function load() {
  Object.keys(asyncFlowerDefinition.value).forEach((type) => {
    const def = asyncFlowerDefinition.value[type];
    def.category = 'flower';
    def.type = type;
    def.scaling = def.scaling || new paper.Point(0.016, 0.016);
    def.menuScaling = def.menuScaling || new paper.Point(0.65, 0.65);
    def.size = new paper.Size(1, 1);
    def.offset = def.offset
      || new paper.Point(-def.size.width / 2, -def.size.height + 0.2);
    def.onSelect = function () {};
    if (def.img) {
      const img = new paper.Raster(def.img);
      def.icon = img;
      def.icon.onLoad = function () {
        asyncFlowerDefinition.onLoad();
      };
      img.remove();
    }
  });
}
