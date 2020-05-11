import paper from 'paper';
import { AsyncObjectDefinition } from '../../helpers/AsyncObjectDefinition';

export const asyncStairsDefinition = new AsyncObjectDefinition();

asyncStairsDefinition.value = {
  stairsStoneUp: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/stairs/stairs-stone-up.png',
    size: new paper.Size(2, 4),
  },
  stairsStoneDown: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/stairs/stairs-stone-down.png',
    size: new paper.Size(2, 4),
  },
  stairsStoneLeft: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/stairs/stairs-stone-left.png',
    size: new paper.Size(4, 2),
  },
  stairsStoneRight: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/stairs/stairs-stone-right.png',
    size: new paper.Size(4, 2),
  },
  stairsWoodUp: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/stairs/stairs-wood-up.png',
    size: new paper.Size(2, 4),
  },
  stairsWoodDown: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/stairs/stairs-wood-down.png',
    size: new paper.Size(2, 4),
  },
  stairsWoodLeft: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/stairs/stairs-wood-left.png',
    size: new paper.Size(4, 2),
  },
  stairsWoodRight: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/stairs/stairs-wood-right.png',
    size: new paper.Size(4, 2),
  },

  flatStairsNaturalUp: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-natural-up.png',
    size: new paper.Size(2, 4),
  },
  flatStairsNaturalLeft: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-natural-left.png',
    size: new paper.Size(4, 2),
  },
  flatStairsNaturalRight: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-natural-right.png',
    size: new paper.Size(4, 2),
  },
  flatStairsNaturalDown: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-natural-down.png',
    size: new paper.Size(2, 4),
  },

  flatStairsWhitePlankUp: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-white-plank-up.png',
    size: new paper.Size(2, 4),
  },
  flatStairsWhitePlankLeft: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-white-plank-left.png',
    size: new paper.Size(4, 2),
  },
  flatStairsWhitePlankRight: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-white-plank-right.png',
    size: new paper.Size(4, 2),
  },
  flatStairsWhitePlankDown: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-white-plank-down.png',
    size: new paper.Size(2, 4),
  },

  flatStairsBluePlankUp: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-blue-plank-up.png',
    size: new paper.Size(2, 4),
  },
  flatStairsBluePlankLeft: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-blue-plank-left.png',
    size: new paper.Size(4, 2),
  },
  flatStairsBluePlankRight: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-blue-plank-right.png',
    size: new paper.Size(4, 2),
  },
  flatStairsBluePlankDown: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-blue-plank-down.png',
    size: new paper.Size(2, 4),
  },

  flatStairsLogUp: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-log-up.png',
    size: new paper.Size(2, 4),
  },
  flatStairsLogLeft: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-log-left.png',
    size: new paper.Size(4, 2),
  },
  flatStairsLogRight: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-log-right.png',
    size: new paper.Size(4, 2),
  },
  flatStairsLogDown: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-log-down.png',
    size: new paper.Size(2, 4),
  },

  flatStairsStoneUp: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-stone-up.png',
    size: new paper.Size(2, 4),
  },
  flatStairsStoneLeft: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-stone-left.png',
    size: new paper.Size(4, 2),
  },
  flatStairsStoneRight: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-stone-right.png',
    size: new paper.Size(4, 2),
  },
  flatStairsStoneDown: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-stone-down.png',
    size: new paper.Size(2, 4),
  },

  flatStairsBrickUp: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-brick-up.png',
    size: new paper.Size(2, 4),
  },
  flatStairsBrickLeft: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-brick-left.png',
    size: new paper.Size(4, 2),
  },
  flatStairsBrickRight: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-brick-right.png',
    size: new paper.Size(4, 2),
  },
  flatStairsBrickDown: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-brick-down.png',
    size: new paper.Size(2, 4),
  },

  flatStairsBlueSteelUp: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-blue-steel-up.png',
    size: new paper.Size(2, 4),
  },
  flatStairsBlueSteelLeft: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-blue-steel-left.png',
    size: new paper.Size(4, 2),
  },
  flatStairsBlueSteelRight: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-blue-steel-right.png',
    size: new paper.Size(4, 2),
  },
  flatStairsBlueSteelDown: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-blue-steel-down.png',
    size: new paper.Size(2, 4),
  },

  flatStairsRedSteelUp: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-red-steel-up.png',
    size: new paper.Size(2, 4),
  },
  flatStairsRedSteelLeft: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-red-steel-left.png',
    size: new paper.Size(4, 2),
  },
  flatStairsRedSteelRight: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-red-steel-right.png',
    size: new paper.Size(4, 2),
  },
  flatStairsRedSteelDown: {
    img: 'static/sprite/construction/stairs/flat/flat-stairs-red-steel-down.png',
    size: new paper.Size(2, 4),
  },

  // legacy
  rampSprite: {
    legacy: 'stairsStoneRight',
    img: 'static/sprite/structure-ramp.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.026, 0.026),
    size: new paper.Size(5, 3),
    offset: new paper.Point(-2.8, -2.7),
  },
};

export function load() {
  Object.keys(asyncStairsDefinition.value).forEach((type) => {
    const def = asyncStairsDefinition.value[type];
    def.category = 'stairs';
    def.type = type;
    def.scaling = def.scaling || new paper.Point(0.029, 0.029);
    def.menuScaling = def.menuScaling || new paper.Point(0.18, 0.18);
    def.offset =
      def.offset || new paper.Point(-def.size.width / 2, -def.size.height);
    def.onSelect = function () {};
    // imnmediately load the assets
    if (def.img) {
      const img = new paper.Raster(def.img);
      def.icon = img;
      def.icon.onLoad = function () {
        asyncStairsDefinition.onLoad();
      };
      img.remove();
    }
  });
}
