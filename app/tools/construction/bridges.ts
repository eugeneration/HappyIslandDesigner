import paper from 'paper';
import { AsyncObjectDefinition } from '../../helpers/AsyncObjectDefinition';

export const asyncBridgesDefinition = new AsyncObjectDefinition();

asyncBridgesDefinition.value = {
  bridgeStoneHorizontal: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/bridges/bridge-stone-horizontal.png',
    size: new paper.Size(6, 4),
  },
  bridgeStoneVertical: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/bridges/bridge-stone-vertical.png',
    size: new paper.Size(4, 6),
  },
  bridgeStoneTLBR: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/bridges/bridge-stone-tlbr.png',
    size: new paper.Size(6, 6),
  },
  bridgeStoneTRBL: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/bridges/bridge-stone-trbl.png',
    size: new paper.Size(6, 6),
  },
  bridgeWoodHorizontal: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/bridges/bridge-wood-horizontal.png',
    size: new paper.Size(6, 4),
  },
  bridgeWoodVertical: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/bridges/bridge-wood-vertical.png',
    size: new paper.Size(4, 6),
  },
  bridgeWoodTLBR: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/bridges/bridge-wood-tlbr.png',
    size: new paper.Size(6, 6),
  },
  bridgeWoodTRBL: {
    legacyCategory: 'construction',
    img: 'static/sprite/construction/bridges/bridge-wood-trbl.png',
    size: new paper.Size(6, 6),
  },

  flatBridgeLogVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-log-vertical.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(4, 6),
  },
  flatBridgeLogHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-log-horizontal.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(6, 4),
  },
  flatBridgeLogTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-log-trbl.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeLogTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-log-tlbr.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeSuspensionVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-suspension-vertical.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(4, 6),
  },
  flatBridgeSuspensionHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-suspension-horizontal.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(6, 4),
  },
  flatBridgeSuspensionTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-suspension-trbl.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeSuspensionTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-suspension-tlbr.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },

  flatBridgeLogLargeVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-log-large-vertical.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(4, 7),
  },
  flatBridgeLogLargeHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-log-large-horizontal.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(7, 4),
  },
  flatBridgeLogLargeTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-log-large-trbl.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeLogLargeTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-log-large-tlbr.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeSuspensionLargeVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-suspension-large-vertical.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(4, 7),
  },
  flatBridgeSuspensionLargeHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-suspension-large-horizontal.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(7, 4),
  },
  flatBridgeSuspensionLargeTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-suspension-large-trbl.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeSuspensionLargeTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-suspension-large-tlbr.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },

  flatBridgeWoodenVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-wooden-vertical.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(4, 6),
  },
  flatBridgeWoodenHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-wooden-horizontal.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(6, 4),
  },
  flatBridgeWoodenTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-wooden-trbl.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeWoodenTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-wooden-tlbr.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeStoneVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-stone-vertical.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(4, 6),
  },
  flatBridgeStoneHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-stone-horizontal.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(6, 4),
  },
  flatBridgeStoneTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-stone-trbl.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeStoneTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-stone-tlbr.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },

  flatBridgeWoodenLargeVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-wooden-large-vertical.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(4, 7),
  },
  flatBridgeWoodenLargeHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-wooden-large-horizontal.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(7, 4),
  },
  flatBridgeWoodenLargeTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-wooden-large-trbl.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeWoodenLargeTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-wooden-large-tlbr.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeStoneLargeVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-stone-large-vertical.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(4, 7),
  },
  flatBridgeStoneLargeHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-stone-large-horizontal.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(7, 4),
  },
  flatBridgeStoneLargeTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-stone-large-trbl.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeStoneLargeTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-stone-large-tlbr.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },

  flatBridgeBrickVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-brick-vertical.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(4, 6),
  },
  flatBridgeBrickHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-brick-horizontal.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(6, 4),
  },
  flatBridgeBrickTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-brick-trbl.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeBrickTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-brick-tlbr.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeZenVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-zen-vertical.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(4, 6),
  },
  flatBridgeZenHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-zen-horizontal.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(6, 4),
  },
  flatBridgeZenTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-zen-trbl.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeZenTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-zen-tlbr.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },

  flatBridgeBrickLargeVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-brick-large-vertical.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(4, 7),
  },
  flatBridgeBrickLargeHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-brick-large-horizontal.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(7, 4),
  },
  flatBridgeBrickLargeTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-brick-large-trbl.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeBrickLargeTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-brick-large-tlbr.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeZenLargeVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-zen-large-vertical.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(4, 7),
  },
  flatBridgeZenLargeHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-zen-large-horizontal.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(7, 4),
  },
  flatBridgeZenLargeTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-zen-large-trbl.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeZenLargeTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-zen-large-tlbr.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },

  flatBridgeRedZenVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-red-zen-vertical.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(4, 6),
  },
  flatBridgeRedZenHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-red-zen-horizontal.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(6, 4),
  },
  flatBridgeRedZenTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-red-zen-trbl.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeRedZenTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-red-zen-tlbr.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeIronVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-iron-vertical.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(4, 6),
  },
  flatBridgeIronHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-iron-horizontal.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(6, 4),
  },
  flatBridgeIronTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-iron-trbl.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },
  flatBridgeIronTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-iron-tlbr.png',
    menuScaling: new paper.Point(0.1, 0.1),
    size: new paper.Size(7, 7),
  },

  flatBridgeRedZenLargeVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-red-zen-large-vertical.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(4, 7),
  },
  flatBridgeRedZenLargeHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-red-zen-large-horizontal.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(7, 4),
  },
  flatBridgeRedZenLargeTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-red-zen-large-trbl.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeRedZenLargeTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-red-zen-large-tlbr.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeIronLargeVertical: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-iron-large-vertical.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(4, 7),
  },
  flatBridgeIronLargeHorizontal: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-iron-large-horizontal.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(7, 4),
  },
  flatBridgeIronLargeTRBL: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-iron-large-trbl.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },
  flatBridgeIronLargeTLBR: {
    img: 'static/sprite/construction/bridges/flat/flat-bridge-iron-large-tlbr.png',
    menuScaling: new paper.Point(0.12, 0.12),
    size: new paper.Size(8, 8),
  },

  // legacy
  bridgeVerticalSprite: {
    img: 'static/sprite/structure-bridge-vertical.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.026, 0.026),
    size: new paper.Size(4, 6),
    offset: new paper.Point(-1.5, -5),
  },
  bridgeHorizontalSprite: {
    img: 'static/sprite/structure-bridge-horizontal.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.026, 0.026),
    size: new paper.Size(5, 3),
    offset: new paper.Point(-2.8, -2.7),
  },
};

export function load() {
  Object.keys(asyncBridgesDefinition.value).forEach((type) => {
    const def = asyncBridgesDefinition.value[type];
    def.category = 'bridges';
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
        asyncBridgesDefinition.onLoad();
      };
      img.remove();
    }
  });
}
