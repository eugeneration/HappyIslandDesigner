import { AsyncObjectDefinition } from '../helpers/AsyncObjectDefinition';

export const asyncFlowerDefinition = new AsyncObjectDefinition();

asyncFlowerDefinition.value = {
  cosmosBlack: {
    img: 'static/sprite/flower/blackcosmos.png',
  },
  cosmosOrange: {
    img: 'static/sprite/flower/orangecosmos.png',
  },
  cosmosPink: {
    img: 'static/sprite/flower/pinkcosmos.png',
  },
  cosmosRed: {
    img: 'static/sprite/flower/redcosmos.png',
  },
  cosmosWhite: {
    img: 'static/sprite/flower/whitecosmos.png',
  },
  cosmosYellow: {
    img: 'static/sprite/flower/yellowcosmos.png',
  },
  lilyBlack: {
    img: 'static/sprite/flower/blacklilies.png',
  },
  lilyOrange: {
    img: 'static/sprite/flower/orangelilies.png',
  },
  lilyPink: {
    img: 'static/sprite/flower/pinklilies.png',
  },
  lilyRed: {
    img: 'static/sprite/flower/redlilies.png',
  },
  lilyWhite: {
    img: 'static/sprite/flower/whitelilies.png',
  },
  lilyYellow: {
    img: 'static/sprite/flower/yellowlilies.png',
  },
  roseBlack: {
    img: 'static/sprite/flower/blackroses.png',
  },
  roseBlue: {
    img: 'static/sprite/flower/blueroses.png',
  },
  roseGold: {
    img: 'static/sprite/flower/goldroses.png',
  },
  roseOrange: {
    img: 'static/sprite/flower/orangeroses.png',
  },
  rosePink: {
    img: 'static/sprite/flower/pinkroses.png',
  },
  rosePurple: {
    img: 'static/sprite/flower/purpleroses.png',
  },
  roseRed: {
    img: 'static/sprite/flower/redroses.png',
  },
  roseWhite: {
    img: 'static/sprite/flower/whiteroses.png',
  },
  roseYellow: {
    img: 'static/sprite/flower/yellowroses.png',
  },
  pansyBlue: {
    img: 'static/sprite/flower/bluepansies.png',
  },
  pansyOrange: {
    img: 'static/sprite/flower/orangepansies.png',
  },
  pansyPurple: {
    img: 'static/sprite/flower/purplepansies.png',
  },
  pansyRed: {
    img: 'static/sprite/flower/redpansies.png',
  },
  pansyWhite: {
    img: 'static/sprite/flower/whitepansies.png',
  },
  pansyYellow: {
    img: 'static/sprite/flower/yellowpansies.png',
  },
  tulipBlack: {
    img: 'static/sprite/flower/blacktulips.png',
  },
  tulipOrange: {
    img: 'static/sprite/flower/orangetulips.png',
  },
  tulipPink: {
    img: 'static/sprite/flower/pinktulips.png',
  },
  tulipPurple: {
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
  hyacinthBlue: {
    img: 'static/sprite/flower/bluehyacinths.png',
  },
  hyacinthOrange: {
    img: 'static/sprite/flower/orangehyacinths.png',
  },
  hyacinthPink: {
    img: 'static/sprite/flower/pinkhyacinths.png',
  },
  hyacinthPurple: {
    img: 'static/sprite/flower/purplehyacinths.png',
  },
  hyacinthRed: {
    img: 'static/sprite/flower/redhyacinths.png',
  },
  hyacinthWhite: {
    img: 'static/sprite/flower/whitehyacinths.png',
  },
  hyacinthYellow: {
    img: 'static/sprite/flower/yellowhyacinths.png',
  },
  chrysanthemumGreen: {
    img: 'static/sprite/flower/greenmums.png',
  },
  chrysanthemumPink: {
    img: 'static/sprite/flower/pinkmums.png',
  },
  chrysanthemumPurple: {
    img: 'static/sprite/flower/purplemums.png',
  },
  chrysanthemumRed: {
    img: 'static/sprite/flower/redmums.png',
  },
  chrysanthemumWhite: {
    img: 'static/sprite/flower/whitemums.png',
  },
  chrysanthemumYellow: {
    img: 'static/sprite/flower/yellowmums.png',
  },
  poppyBlue: {
    img: 'static/sprite/flower/bluewindflowers.png',
  },
  poppyPink: {
    img: 'static/sprite/flower/pinkwindflowers.png',
  },
  poppyPurple: {
    img: 'static/sprite/flower/purplewindflowers.png',
  },
  poppyOrange: {
    img: 'static/sprite/flower/orangewindflowers.png',
  },
  poppyRed: {
    img: 'static/sprite/flower/redwindflowers.png',
  },
  poppyWhite: {
    img: 'static/sprite/flower/whitewindflowers.png',
  },
  lilyOfTheValley: {
    img: 'static/sprite/flower/lilyofthevalley.png',
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
