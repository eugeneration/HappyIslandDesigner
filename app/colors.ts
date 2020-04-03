import paper from 'paper';

export type Color = { color: paper.Color; key: string; name: string };

// if you want to rename a color, you must add a name parameter with the old name
// otherwise backwards compatibility for encoding/decoding will break
export const colors: {
  [key: string]: Color;
} = {
  invisible: {
    color: new paper.Color('rgba(0, 0, 0, 0.00001)'),
    key: '',
    name: '',
  },

  // terrain color
  water: { color: new paper.Color('#83e1c3'), key: '', name: '' },
  sand: { color: new paper.Color('#eee9a9'), key: '', name: '' },
  level1: { color: new paper.Color('#347941'), key: '', name: '' },
  level2: { color: new paper.Color('#35a043'), key: '', name: '' },
  level3: { color: new paper.Color('#4ac34e'), key: '', name: '' },
  rock: { color: new paper.Color('#737a89'), key: '', name: '' },
  campground: { color: new paper.Color('#b0a280'), key: '', name: '' },
  townsquare: { color: new paper.Color('#E2AA78'), key: '', name: '' },

  // paths
  pathDirt: { color: new paper.Color('#d5ac71'), key: '', name: '' },
  pathSand: { color: new paper.Color('#f9df96'), key: '', name: '' },
  pathStone: { color: new paper.Color('#999a8c'), key: '', name: '' },
  pathBrick: { color: new paper.Color('#e38f68'), key: '', name: '' },
  pathEraser: { color: new paper.Color('#f1b2c1'), key: '', name: '' },

  // structures
  special: { color: new paper.Color('#ffffff'), key: '', name: '' },
  dock: { color: new paper.Color('#a9926e'), key: '', name: '' },
  amenity: { color: new paper.Color('#514d40'), key: '', name: '' },
  amenityWhite: { color: new paper.Color('#efedd5'), key: '', name: '' },
  human: { color: new paper.Color('#F078B0'), key: '', name: '' },
  npc: { color: new paper.Color('#f8bd26'), key: '', name: '' },
  selected: { color: new paper.Color('#ed772f'), key: '', name: '' },
  pin: { color: new paper.Color('#e75a2e'), key: '', name: '' },

  // Map drawer UI
  selection: { color: new paper.Color('#50EEFF'), key: '', name: '' },

  // UI
  white: { color: new paper.Color('#f9f7ed'), key: '', name: '' },
  paper: { color: new paper.Color('#f5f3e5'), key: '', name: '' }, // general white
  paperOverlay: { color: new paper.Color('#ecebd5'), key: '', name: '' },
  paperOverlay2: { color: new paper.Color('#e4e2d0'), key: '', name: '' },

  // colors from nookPhone (colors are hued towards red/yellow)
  purple: { color: new paper.Color('#be84f0'), key: '', name: '' },
  blue: { color: new paper.Color('#8c97ec'), key: '', name: '' },
  lightBlue: { color: new paper.Color('#b4bdfd'), key: '', name: '' },
  orange: { color: new paper.Color('#df8670'), key: '', name: '' },
  magenta: { color: new paper.Color('#f550ab'), key: '', name: '' },
  pink: { color: new paper.Color('#f09eb3'), key: '', name: '' },
  cyan: { color: new paper.Color('#63d5bf'), key: '', name: '' },
  turquoise: { color: new paper.Color('#86e0bb'), key: '', name: '' },
  green: { color: new paper.Color('#8dd08a'), key: '', name: '' },
  lime: { color: new paper.Color('#d2e541'), key: '', name: '' },
  red: { color: new paper.Color('#ee666e'), key: '', name: '' },
  offBlack: { color: new paper.Color('#4b3b32'), key: '', name: '' },
  offWhite: { color: new paper.Color('#f6f2e0'), key: '', name: '' },
  lightText: { color: new paper.Color('#dcd8ca'), key: '', name: '' },
  text: { color: new paper.Color('#726a5a'), key: '', name: '' },
  yellow: { color: new paper.Color('#f5d830'), key: '', name: '' },
  lightYellow: { color: new paper.Color('#f7e676'), key: '', name: '' },
  lightBrown: { color: new paper.Color('#bfab76'), key: '', name: '' },

  // generic colors
  firetruck: { color: new paper.Color('#ef3c1d'), key: '', name: '' },
  flamingo: { color: new paper.Color('#f8ad82'), key: '', name: '' },
  brick: { color: new paper.Color('#ab4f46'), key: '', name: '' },

  safetyOrange: { color: new paper.Color('#f56745'), key: '', name: '' },
  lifeguardOrange: { color: new paper.Color('#f59447'), key: '', name: '' },

  frogYellow: { color: new paper.Color('#f7d00e'), key: '', name: '' },
  lightBannerYellow: { color: new paper.Color('#fdf252'), key: '', name: '' },
  darkBannerYellow: { color: new paper.Color('#c7b451'), key: '', name: '' },

  tentGreen: { color: new paper.Color('#22b759'), key: '', name: '' },
  darkBlueGreen: { color: new paper.Color('#11a972'), key: '', name: '' },
  lightGreen: { color: new paper.Color('#5aeb89'), key: '', name: '' },
  jaybird: { color: new paper.Color('#42bbf3'), key: '', name: '' },

  darkGreyBlue: { color: new paper.Color('#7c8da6'), key: '', name: '' },
  lightGreyBlue: { color: new paper.Color('#9cbbce'), key: '', name: '' },

  highlightCircle: { color: new paper.Color('#2adbb8'), key: '', name: '' },

  // Water UI
  oceanPanel: { color: new paper.Color('#39ba9c'), key: '', name: '' }, // game trailer had this color panel
  oceanPanelDark: { color: new paper.Color('#39ba9c'), key: '', name: '' },
  oceanText: { color: new paper.Color('#57b499'), key: '', name: '' }, // text on ocean
  oceanDarker: { color: new paper.Color('#77d6bd'), key: '', name: '' }, // dark overlay
  oceanDark: { color: new paper.Color('#70cfb6'), key: '', name: '' }, // dark overlay
  oceanLighter: { color: new paper.Color('#d7fef1'), key: '', name: '' }, // light overlay
  oceanLight: { color: new paper.Color('#a3f8dd'), key: '', name: '' }, // light overlay
  oceanWave: { color: new paper.Color('#63d4b2'), key: '', name: '' },
};

Object.keys(colors).forEach((colorKey) => {
  const colorData = colors[colorKey];
  if (!colorData.name) {
    // if it has a custom encoded name, make sure to use that
    colorData.name = colorKey;
  }
  colorData.key = colorKey;
});

export function getColorDataFromEncodedName(encodedColorName: string) {
  if (!encodedColorName) { return null; }
  return Object.values(colors).find((c) => { return c.name === encodedColorName; });
}
