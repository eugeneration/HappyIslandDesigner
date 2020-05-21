import { AsyncObjectDefinition } from '../helpers/AsyncObjectDefinition';

export const asyncFlowerDefinition = new AsyncObjectDefinition();

asyncFlowerDefinition.value = {
  blackCosmos: {
    img: 'static/sprite/flower/blackcosmos.png',
  },
  orangeCosmos: {
    img: 'static/sprite/flower/orangecosmos.png',
  },
  pinkCosmos: {
    img: 'static/sprite/flower/pinkcosmos.png',
  },
  redCosmos: {
    img: 'static/sprite/flower/redcosmos.png',
  },
  whiteCosmos: {
    img: 'static/sprite/flower/whitecosmos.png',
  },
  yellowCosmos: {
    img: 'static/sprite/flower/yellowcosmos.png',
  },
  blackLilies: {
    img: 'static/sprite/flower/blacklilies.png',
  },
  orangeLilies: {
    img: 'static/sprite/flower/orangelilies.png',
  },
  pinkLilies: {
    img: 'static/sprite/flower/pinklilies.png',
  },
  redLilies: {
    img: 'static/sprite/flower/redlilies.png',
  },
  lilyWhite: {
    img: 'static/sprite/flower/whitelilies.png',
  },
  yellowLilies: {
    img: 'static/sprite/flower/yellowlilies.png',
  },
  blackRoses: {
    img: 'static/sprite/flower/blackroses.png',
  },
  blueRoses: {
    img: 'static/sprite/flower/blueroses.png',
  },
  goldRoses: {
    img: 'static/sprite/flower/goldroses.png',
  },
  orangeRoses: {
    img: 'static/sprite/flower/orangeroses.png',
  },
  pinkRoses: {
    img: 'static/sprite/flower/pinkroses.png',
  },
  purpleRoses: {
    img: 'static/sprite/flower/purpleroses.png',
  },
  redRoses: {
    img: 'static/sprite/flower/redroses.png',
  },
  whiteRoses: {
    img: 'static/sprite/flower/whiteroses.png',
  },
  yellowRoses: {
    img: 'static/sprite/flower/yellowroses.png',
  },
  bluePansies: {
    img: 'static/sprite/flower/bluepansies.png',
  },
  orangePansies: {
    img: 'static/sprite/flower/orangepansies.png',
  },
  pansyPurple: {
    img: 'static/sprite/flower/purplepansies.png',
  },
  pansyRed: {
    img: 'static/sprite/flower/redpansies.png',
  },
  whitePansies: {
    img: 'static/sprite/flower/whitepansies.png',
  },
  pansyYellow: {
    img: 'static/sprite/flower/yellowpansies.png',
  },
  blackTulips: {
    img: 'static/sprite/flower/blacktulips.png',
  },
  orangeTulips: {
    img: 'static/sprite/flower/orangetulips.png',
  },
  pinkTulips: {
    img: 'static/sprite/flower/pinktulips.png',
  },
  purpleTulips: {
    img: 'static/sprite/flower/purpletulips.png',
  },
  tulipRed: {
    img: 'static/sprite/flower/redtulips.png',
  },
  tulipWhite: {
    img: 'static/sprite/flower/whitetulips.png',
  },
  tulipYellow: {
    img: 'static/sprite/flower/yellowtulips.png',
  },
  blueHyacinths: {
    img: 'static/sprite/flower/bluehyacinths.png',
  },
  orangeHyacinths: {
    img: 'static/sprite/flower/orangehyacinths.png',
  },
  pinkHyacinths: {
    img: 'static/sprite/flower/pinkhyacinths.png',
  },
  purpleHyacinths: {
    img: 'static/sprite/flower/purplehyacinths.png',
  },
  hyacinthRed: {
    img: 'static/sprite/flower/redhyacinths.png',
  },
  hyacinthWhite: {
    img: 'static/sprite/flower/whitehyacinths.png',
  },
  yellowHyacinths: {
    img: 'static/sprite/flower/yellowhyacinths.png',
  },
  greenMums: {
    img: 'static/sprite/flower/greenmums.png',
  },
  pinkMums: {
    img: 'static/sprite/flower/pinkmums.png',
  },
  purpleMums: {
    img: 'static/sprite/flower/purplemums.png',
  },
  redMums: {
    img: 'static/sprite/flower/redmums.png',
  },
  chrysanthemumWhite: {
    img: 'static/sprite/flower/whitemums.png',
  },
  yellowMums: {
    img: 'static/sprite/flower/yellowmums.png',
  },
  blueWindflowers: {
    img: 'static/sprite/flower/bluewindflowers.png',
  },
  poppyOrange: {
    img: 'static/sprite/flower/orangewindflowers.png',
  },
  pinkWindflowers: {
    img: 'static/sprite/flower/pinkwindflowers.png',
  },
  purpleWindflowers: {
    img: 'static/sprite/flower/purplewindflowers.png',
  },
  poppyRed: {
    img: 'static/sprite/flower/redwindflowers.png',
  },
  poppyWhite: {
    img: 'static/sprite/flower/whitewindflowers.png',
  },
  lilyOfTheValley: {
    img: 'static/sprite/flower/lilyOfTheValley.png',
  },
  weedBrush: {
    img: 'static/sprite/flower/weed-brush.png',
  },
  weedBush: {
    img: 'static/sprite/flower/weed-bush.png',
  },
  weedCattail: {
    img: 'static/sprite/flower/weed-cattail.png',
  },
  weedClover: {
    img: 'static/sprite/flower/weed-clover.png',
  },
  weedDandelion: {
    img: 'static/sprite/flower/weed-dandelion.png',
  },

};

export function load() {
  Object.keys(asyncFlowerDefinition.value).forEach((type) => {
    const def = asyncFlowerDefinition.value[type];
    def.category = 'flower';
    def.type = type;
    def.scaling = def.scaling || new paper.Point(0.016, 0.016);
    def.menuScaling = def.menuScaling || new paper.Point(0.65, 0.65);
    def.size = new paper.Size(1, 1);
    def.offset =
      def.offset ||
      new paper.Point(-def.size.width / 2, -def.size.height + 0.2);
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
