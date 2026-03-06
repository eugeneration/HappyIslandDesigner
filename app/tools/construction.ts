import paper from 'paper';
import { AsyncObjectDefinition } from '../helpers/AsyncObjectDefinition';

export const asyncConstructionDefinition = new AsyncObjectDefinition();

const SQRT2 = Math.sqrt(2);

asyncConstructionDefinition.value = {
  // Bridge vertical
  bridgeIconVertical3: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 0,
    scaling: new paper.Point(0.16, 0.05 * 3),
    menuScaling: new paper.Point(1.6, 1.0),
    size: new paper.Size(4, 3),
    hidden: true,
  },
  bridgeIconVertical4: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 0,
    scaling: new paper.Point(0.16, 0.05 * 4),
    menuScaling: new paper.Point(1.6, 1.3),
    size: new paper.Size(4, 4),
  },
  bridgeIconVertical5: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 0,
    scaling: new paper.Point(0.16, 0.05 * 5),
    menuScaling: new paper.Point(1.6, 1.6),
    size: new paper.Size(4, 5),
    hidden: true,
  },
  // Bridge horizontal
  bridgeIconHorizontal3: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 90,
    scaling: new paper.Point(0.16, 0.05 * 3),
    menuScaling: new paper.Point(1.0, 1.6),
    size: new paper.Size(3, 4),
    hidden: true,
  },
  bridgeIconHorizontal4: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 90,
    scaling: new paper.Point(0.16, 0.05 * 4),
    menuScaling: new paper.Point(1.3, 1.6),
    size: new paper.Size(4, 4),
    hidden: true,
  },
  bridgeIconHorizontal5: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 90,
    scaling: new paper.Point(0.16, 0.05 * 5),
    menuScaling: new paper.Point(1.6, 1.6),
    size: new paper.Size(5, 4),
    hidden: true,
  },
  // Bridge TLBR (top-left to bottom-right diagonal)
  bridgeIconTLBR3: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 135,
    scaling: new paper.Point(0.16, 0.05 * 2.5 * SQRT2),
    menuScaling: new paper.Point(0.8, 0.8),
    size: new paper.Size(3, 3),
    offset: new paper.Point(0.25, -0.25),
    hidden: true,
  },
  bridgeIconTLBR4: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 135,
    scaling: new paper.Point(0.16, 0.05 * 3 * SQRT2),
    menuScaling: new paper.Point(0.8, 0.8),
    size: new paper.Size(4, 4),
    hidden: true,
  },
  bridgeIconTLBR5: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 135,
    scaling: new paper.Point(0.16, 0.05 * 3.5 * SQRT2),
    menuScaling: new paper.Point(0.8, 0.8),
    size: new paper.Size(4, 4),
    offset: new paper.Point(0.25, -0.25),
    hidden: true,
  },
  // Bridge TRBL (top-right to bottom-left diagonal)
  bridgeIconTRBL3: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 45,
    scaling: new paper.Point(0.16, 0.05 * 2.5 * SQRT2),
    menuScaling: new paper.Point(0.8, 0.8),
    size: new paper.Size(3, 3),
    offset: new paper.Point(0.25, -0.25),
    hidden: true,
  },
  bridgeIconTRBL4: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 45,
    scaling: new paper.Point(0.16, 0.05 * 3 * SQRT2),
    menuScaling: new paper.Point(0.8, 0.8),
    size: new paper.Size(4, 4),
    hidden: true,
  },
  bridgeIconTRBL5: {
    svg: 'static/svg/icon-bridge.svg',
    rotation: 45,
    scaling: new paper.Point(0.16, 0.05 * 3.5 * SQRT2),
    menuScaling: new paper.Point(0.8, 0.8),
    size: new paper.Size(4, 4),
    offset: new paper.Point(0.25, -0.25),
    hidden: true,
  },
  stairsIconUp: {
    svg: 'static/svg/icon-stairs.svg',
    rotation: 0,
    scaling: new paper.Point(0.175, 0.175),
    menuScaling: new paper.Point(1.1, 1.1),
    size: new paper.Size(2, 4),
    offset: new paper.Point(0, -0.25),
  },
  stairsIconRight: {
    svg: 'static/svg/icon-stairs.svg',
    rotation: 90,
    scaling: new paper.Point(0.175, 0.175),
    menuScaling: new paper.Point(1.1, 1.1),
    size: new paper.Size(4, 2),
    offset: new paper.Point(0.25, 0),
    hidden: true,
  },
  stairsIconDown: {
    svg: 'static/svg/icon-stairs.svg',
    rotation: 180,
    scaling: new paper.Point(0.175, 0.175),
    menuScaling: new paper.Point(1.1, 1.1),
    size: new paper.Size(2, 4),
    offset: new paper.Point(0, 0.25),
    hidden: true,
  },
  stairsIconLeft: {
    svg: 'static/svg/icon-stairs.svg',
    rotation: 270,
    scaling: new paper.Point(0.175, 0.175),
    menuScaling: new paper.Point(1.1, 1.1),
    size: new paper.Size(4, 2),
    offset: new paper.Point(-0.25, 0),
    hidden: true,
  },
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
  // legacy (unsuffixed bridge names → renamed to 4-suffix)
  bridgeIconVertical: {
    legacy: 'bridgeIconVertical4',
    svg: 'static/svg/icon-bridge.svg',
    size: new paper.Size(4, 4),
    hidden: true,
  },
  bridgeIconHorizontal: {
    legacy: 'bridgeIconHorizontal4',
    svg: 'static/svg/icon-bridge.svg',
    size: new paper.Size(4, 4),
    hidden: true,
  },
  bridgeIconTLBR: {
    legacy: 'bridgeIconTLBR4',
    svg: 'static/svg/icon-bridge.svg',
    size: new paper.Size(6, 6),
    hidden: true,
  },
  bridgeIconTRBL: {
    legacy: 'bridgeIconTRBL4',
    svg: 'static/svg/icon-bridge.svg',
    size: new paper.Size(6, 6),
    hidden: true,
  },
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

export const rotationOrder: Record<string, string> = {
  // stairs
  stairsIconUp: 'stairsIconRight',
  stairsIconRight: 'stairsIconDown',
  stairsIconDown: 'stairsIconLeft',
  stairsIconLeft: 'stairsIconUp',
  // bridge length 3
  bridgeIconVertical3: 'bridgeIconTRBL3',
  bridgeIconTRBL3: 'bridgeIconHorizontal3',
  bridgeIconHorizontal3: 'bridgeIconTLBR3',
  bridgeIconTLBR3: 'bridgeIconVertical3',
  // bridge length 4
  bridgeIconVertical4: 'bridgeIconTRBL4',
  bridgeIconTRBL4: 'bridgeIconHorizontal4',
  bridgeIconHorizontal4: 'bridgeIconTLBR4',
  bridgeIconTLBR4: 'bridgeIconVertical4',
  // bridge length 5
  bridgeIconVertical5: 'bridgeIconTRBL5',
  bridgeIconTRBL5: 'bridgeIconHorizontal5',
  bridgeIconHorizontal5: 'bridgeIconTLBR5',
  bridgeIconTLBR5: 'bridgeIconVertical5',
};

export const lengthOrder: Record<string, string> = {
  // vertical
  bridgeIconVertical3: 'bridgeIconVertical4',
  bridgeIconVertical4: 'bridgeIconVertical5',
  bridgeIconVertical5: 'bridgeIconVertical3',
  // horizontal
  bridgeIconHorizontal3: 'bridgeIconHorizontal4',
  bridgeIconHorizontal4: 'bridgeIconHorizontal5',
  bridgeIconHorizontal5: 'bridgeIconHorizontal3',
  // TLBR
  bridgeIconTLBR3: 'bridgeIconTLBR4',
  bridgeIconTLBR4: 'bridgeIconTLBR5',
  bridgeIconTLBR5: 'bridgeIconTLBR3',
  // TRBL
  bridgeIconTRBL3: 'bridgeIconTRBL4',
  bridgeIconTRBL4: 'bridgeIconTRBL5',
  bridgeIconTRBL5: 'bridgeIconTRBL3',
};

export const constructionDisplayNames: Record<string, string> = {
  stairsIconUp: 'Stairs', stairsIconRight: 'Stairs',
  stairsIconDown: 'Stairs', stairsIconLeft: 'Stairs',
  bridgeIconVertical3: 'Bridge', bridgeIconVertical4: 'Bridge', bridgeIconVertical5: 'Bridge',
  bridgeIconHorizontal3: 'Bridge', bridgeIconHorizontal4: 'Bridge', bridgeIconHorizontal5: 'Bridge',
  bridgeIconTLBR3: 'Bridge', bridgeIconTLBR4: 'Bridge', bridgeIconTLBR5: 'Bridge',
  bridgeIconTRBL3: 'Bridge', bridgeIconTRBL4: 'Bridge', bridgeIconTRBL5: 'Bridge',
};

export function initDefaults() {
  Object.keys(asyncConstructionDefinition.value).forEach((type) => {
    const def = asyncConstructionDefinition.value[type];
    def.category = 'construction';
    def.type = type;
    def.scaling = def.scaling || new paper.Point(0.029, 0.029);
    def.menuScaling = def.menuScaling || new paper.Point(0.18, 0.18);
    if (def.rotation != null) {
      // Center-based positioning: offset is a fine-tuning displacement from center
      def.offset = def.offset || new paper.Point(0, 0);
    } else {
      // Legacy bottomCenter-based positioning: offset from bottom-center of icon bounds
      def.offset =
        def.offset || new paper.Point(-def.size.width / 2, -def.size.height);
    }
    def.onSelect = function () {};
  });
}
