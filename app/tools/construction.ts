import paper from 'paper';
import { AsyncObjectDefinition } from '../helpers/AsyncObjectDefinition';

export const asyncConstructionDefinition = new AsyncObjectDefinition();

asyncConstructionDefinition.value = {
  bridgeStoneHorizontal: {
    img: 'static/sprite/construction/bridge-stone-horizontal.png',
    size: new paper.Size(6, 4),
  },
  bridgeStoneVertical: {
    img: 'static/sprite/construction/bridge-stone-vertical.png',
    size: new paper.Size(4, 6),
  },
  bridgeStoneTLBR: {
    img: 'static/sprite/construction/bridge-stone-tlbr.png',
    size: new paper.Size(6, 6),
  },
  bridgeStoneTRBL: {
    img: 'static/sprite/construction/bridge-stone-trbl.png',
    size: new paper.Size(6, 6),
  },
  bridgeWoodHorizontal: {
    img: 'static/sprite/construction/bridge-wood-horizontal.png',
    size: new paper.Size(6, 4),
  },
  bridgeWoodVertical: {
    img: 'static/sprite/construction/bridge-wood-vertical.png',
    size: new paper.Size(4, 6),
  },
  bridgeWoodTLBR: {
    img: 'static/sprite/construction/bridge-wood-tlbr.png',
    size: new paper.Size(6, 6),
  },
  bridgeWoodTRBL: {
    img: 'static/sprite/construction/bridge-wood-trbl.png',
    size: new paper.Size(6, 6),
  },
  bridgeVerticalSprite: {
    img: 'static/sprite/structure-bridge-vertical.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.026, 0.026),
    size: new paper.Size(4, 6),
    offset: new paper.Point(-1.5, -5),
  },
  stairsStoneUp: {
    img: 'static/sprite/construction/stairs-stone-up.png',
    size: new paper.Size(2, 4),
  },
  stairsStoneDown: {
    img: 'static/sprite/construction/stairs-stone-down.png',
    size: new paper.Size(2, 4),
  },
  stairsStoneLeft: {
    img: 'static/sprite/construction/stairs-stone-left.png',
    size: new paper.Size(4, 2),
  },
  stairsStoneRight: {
    img: 'static/sprite/construction/stairs-stone-right.png',
    size: new paper.Size(4, 2),
  },
  stairsWoodUp: {
    img: 'static/sprite/construction/stairs-wood-up.png',
    size: new paper.Size(2, 4),
  },
  stairsWoodDown: {
    img: 'static/sprite/construction/stairs-wood-down.png',
    size: new paper.Size(2, 4),
  },
  stairsWoodLeft: {
    img: 'static/sprite/construction/stairs-wood-left.png',
    size: new paper.Size(4, 2),
  },
  stairsWoodRight: {
    img: 'static/sprite/construction/stairs-wood-right.png',
    size: new paper.Size(4, 2),
  },
  // legacy
  bridgeHorizontalSprite: {
    img: 'static/sprite/structure-bridge-horizontal.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.026, 0.026),
    size: new paper.Size(5, 3),
    offset: new paper.Point(-2.8, -2.7),
  },
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
  Object.keys(asyncConstructionDefinition.value).forEach((type) => {
    const def = asyncConstructionDefinition.value[type];
    def.category = 'construction';
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
        asyncConstructionDefinition.onLoad();
      };
      img.remove();
    }
  });
}
