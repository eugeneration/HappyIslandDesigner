import paper from 'paper';

import { AsyncObjectDefinition } from '../helpers/AsyncObjectDefinition';
import { colors } from '../colors';
import { loadSvg } from '../helpers/svgLoad';

export const asyncAmenitiesDefinition = new AsyncObjectDefinition();

asyncAmenitiesDefinition.value = {
  dock: {
    colorData: colors.dock,
    size: new paper.Size(7, 2),
    menuScaling: new paper.Point(0.2, 0.2),
    offset: new paper.Point(-3.5, -1.85),
  },
  airport: {},
  center: {
    extraObject() {
      const baseGround = new paper.Path.Rectangle(
        new paper.Rectangle(0, 0, 12, 10),
        new paper.Size(1, 1),
      );
      baseGround.fillColor = colors.campground.color;
      baseGround.position = new paper.Point(1, 7);
      return baseGround;
    },
  },
  townhallSprite: {
    img: 'static/sprite/building-townhall.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.023, 0.023),
    size: new paper.Size(6, 4),
    offset: new paper.Point(-3, -3.6),
    extraObject() {
      const baseGround = new paper.Path.Rectangle(
        new paper.Rectangle(0, 0, 12, 10),
        new paper.Size(1, 1),
      );
      baseGround.fillColor = colors.townsquare.color;
      baseGround.position = new paper.Point(3, 5);
      return baseGround;
    },
  },
  campsiteSprite: {
    img: 'static/sprite/building-campsite.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.021, 0.021),
    size: new paper.Size(4, 4),
    offset: new paper.Point(-2, -3.4),
  },
  museumSprite: {
    img: 'static/sprite/building-museum.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.028, 0.028),
    size: new paper.Size(7, 4),
    offset: new paper.Point(-3.5, -4),
  },
  nookSprite: {
    img: 'static/sprite/building-nook.png',
    menuScaling: new paper.Point(0.17, 0.17),
    scaling: new paper.Point(0.02, 0.02),
    size: new paper.Size(7, 4),
    offset: new paper.Point(-3.6, -3.6),
  },
  ableSprite: {
    img: 'static/sprite/building-able.png',
    menuScaling: new paper.Point(0.16, 0.16),
    scaling: new paper.Point(0.021, 0.021),
    size: new paper.Size(5, 4),
    offset: new paper.Point(-2.5, -3.9),
  },
  lighthouseSprite: {
    img: 'static/sprite/structure-lighthouse.png',
    size: new paper.Size([2, 2]),
    scaling: new paper.Point(0.015, 0.015),
    menuScaling: new paper.Point(0.14, 0.14),
    offset: new paper.Point(-1, -1.85),
  },
  lighthouse: {
    colorData: colors.pin,
    size: new paper.Size([2, 2]),
    menuScaling: new paper.Point(0.3, 0.3),
    offset: new paper.Point(-1, -1.6),
  },
  airportBlue: {
    img: 'static/sprite/structure/airport.png',
    size: new paper.Size([10, 6]),
    scaling: new paper.Point(0.03, 0.03),
    menuScaling: new paper.Point(0.14, 0.14),
    offset: new paper.Point(-5, -5.5),
  },
  airportRed: {
    img: 'static/sprite/structure/airport-red.png',
    size: new paper.Size([10, 6]),
    scaling: new paper.Point(0.03, 0.03),
    menuScaling: new paper.Point(0.14, 0.14),
    offset: new paper.Point(-5, -5.5),
  },
  airportYellow: {
    img: 'static/sprite/structure/airport-yellow.png',
    size: new paper.Size([10, 6]),
    scaling: new paper.Point(0.03, 0.03),
    menuScaling: new paper.Point(0.14, 0.14),
    offset: new paper.Point(-5, -5.5),
  },
  airportGreen: {
    img: 'static/sprite/structure/airport-green.png',
    size: new paper.Size([10, 6]),
    scaling: new paper.Point(0.03, 0.03),
    menuScaling: new paper.Point(0.14, 0.14),
    offset: new paper.Point(-5, -5.5),
  },

  // legacy
  bridgeVerticalSprite: {
    legacyCategory: 'construction',
    img: 'static/sprite/structure-bridge-vertical.png',
  },
  bridgeHorizontalSprite: {
    legacyCategory: 'construction',
    img: 'static/sprite/structure-bridge-horizontal.png',
  },
  rampSprite: {
    legacy: 'stairsStoneLeft',
    legacyCategory: 'construction',
    img: 'static/sprite/structure-ramp.png',
  },
};

export function load() {
  Object.keys(asyncAmenitiesDefinition.value).forEach((type) => {
    const def = asyncAmenitiesDefinition.value[type];
    def.category = 'amenities';
    def.type = type;
    def.scaling = def.scaling || new paper.Point(0.03, 0.03);
    def.menuScaling = def.menuScaling || new paper.Point(0.14, 0.14);
    def.size = def.size || new paper.Size([8, 8]);
    def.offset = def.offset || new paper.Point(-4, -7.6);
    def.onSelect = () => {};
    // imnmediately load the assets
    if (def.img) {
      const img = new paper.Raster(def.img);
      def.icon = img;
      def.icon.onLoad = function onLoad() {
        asyncAmenitiesDefinition.onLoad();
      };
      img.remove();
    } else {
      loadSvg(`amenity-${type}`, (item) => {
        // item.pivot += new paper.Point(-2, -3.6);
        def.icon = item;
        asyncAmenitiesDefinition.onLoad();
      });
    }
  });
}
