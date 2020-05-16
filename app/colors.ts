import paper from 'paper';

export type Color = { cssColor: string,color: paper.Color; key: string; name: string };

const c = new paper.Color(0); // placeholder color

// if you want to rename a color, you must add a name parameter with the old name
// otherwise backwards compatibility for encoding/decoding will break
export const colors = {
  invisible: {cssColor: 'rgba(0, 0, 0, 0.00001)', color: c, key: '', name: ''},

  // terrain color
  water: { cssColor: '#83e1c3', color: c, key: '', name: '' },
  sand: { cssColor: '#eee9a9', color: c, key: '', name: '' },
  level1: { cssColor: '#347941', color: c, key: '', name: '' },
  level2: { cssColor: '#35a043', color: c, key: '', name: '' },
  level3: { cssColor: '#4ac34e', color: c, key: '', name: '' },
  rock: { cssColor: '#737a89', color: c, key: '', name: '' },
  campground: { cssColor: '#b0a280', color: c, key: '', name: '' },
  townsquare: { cssColor: '#E2AA78', color: c, key: '', name: '' },

  // paths
  pathDirt: { cssColor: '#d5ac71', color: c, key: '', name: '' },
  pathSand: { cssColor: '#f9df96', color: c, key: '', name: '' },
  pathStone: { cssColor: '#999a8c', color: c, key: '', name: '' },
  pathBrick: { cssColor: '#e38f68', color: c, key: '', name: '' },
  pathEraser: { cssColor: '#f1b2c1', color: c, key: '', name: '' },

  // structures
  special: { cssColor: '#ffffff', color: c, key: '', name: '' },
  dock: { cssColor: '#a9926e', color: c, key: '', name: '' },
  amenity: { cssColor: '#514d40', color: c, key: '', name: '' },
  amenityWhite: { cssColor: '#efedd5', color: c, key: '', name: '' },
  human: { cssColor: '#F078B0', color: c, key: '', name: '' },
  npc: { cssColor: '#f8bd26', color: c, key: '', name: '' },
  selected: { cssColor: '#ed772f', color: c, key: '', name: '' },
  pin: { cssColor: '#e75a2e', color: c, key: '', name: '' },

  // Map drawer UI
  selection: { cssColor: '#50EEFF', color: c, key: '', name: '' },

  // UI
  white: { cssColor: '#f9f7ed', color: c, key: '', name: '' },
  paper: { cssColor: '#f5f3e5', color: c, key: '', name: '' }, // general white
  paperOverlay: { cssColor: '#ecebd5', color: c, key: '', name: '' },
  paperOverlay2: { cssColor: '#e4e2d0', color: c, key: '', name: '' },

  // colors from nookPhone (colors are hued towards red/yellow)
  purple: { cssColor: '#be84f0', color: c, key: '', name: '' },
  blue: { cssColor: '#8c97ec', color: c, key: '', name: '' },
  lightBlue: { cssColor: '#b4bdfd', color: c, key: '', name: '' },
  orange: { cssColor: '#df8670', color: c, key: '', name: '' },
  magenta: { cssColor: '#f550ab', color: c, key: '', name: '' },
  pink: { cssColor: '#f09eb3', color: c, key: '', name: '' },
  cyan: { cssColor: '#63d5bf', color: c, key: '', name: '' },
  turquoise: { cssColor: '#86e0bb', color: c, key: '', name: '' },
  green: { cssColor: '#8dd08a', color: c, key: '', name: '' },
  lime: { cssColor: '#d2e541', color: c, key: '', name: '' },
  red: { cssColor: '#ee666e', color: c, key: '', name: '' },
  offBlack: { cssColor: '#4b3b32', color: c, key: '', name: '' },
  offWhite: { cssColor: '#f6f2e0', color: c, key: '', name: '' },
  lightText: { cssColor: '#dcd8ca', color: c, key: '', name: '' },
  text: { cssColor: '#726a5a', color: c, key: '', name: '' },
  yellow: { cssColor: '#f5d830', color: c, key: '', name: '' },
  lightYellow: { cssColor: '#f7e676', color: c, key: '', name: '' },
  lightBrown: { cssColor: '#bfab76', color: c, key: '', name: '' },

  // generic colors
  firetruck: { cssColor: '#ef3c1d', color: c, key: '', name: '' },
  flamingo: { cssColor: '#f8ad82', color: c, key: '', name: '' },
  brick: { cssColor: '#ab4f46', color: c, key: '', name: '' },

  safetyOrange: { cssColor: '#f56745', color: c, key: '', name: '' },
  lifeguardOrange: { cssColor: '#f59447', color: c, key: '', name: '' },

  frogYellow: { cssColor: '#f7d00e', color: c, key: '', name: '' },
  lightBannerYellow: { cssColor: '#fdf252', color: c, key: '', name: '' },
  darkBannerYellow: { cssColor: '#c7b451', color: c, key: '', name: '' },

  tentGreen: { cssColor: '#22b759', color: c, key: '', name: '' },
  darkBlueGreen: { cssColor: '#11a972', color: c, key: '', name: '' },
  lightGreen: { cssColor: '#5aeb89', color: c, key: '', name: '' },
  jaybird: { cssColor: '#42bbf3', color: c, key: '', name: '' },

  darkGreyBlue: { cssColor: '#7c8da6', color: c, key: '', name: '' },
  lightGreyBlue: { cssColor: '#9cbbce', color: c, key: '', name: '' },

  highlightCircle: { cssColor: '#2adbb8', color: c, key: '', name: '' },

  // Water UI
  // game trailer had this color panel
  oceanPanel: { cssColor: '#39ba9c', color: c, key: '', name: '' },
  oceanPanelDark: { cssColor: '#39ba9c', color: c, key: '', name: '' },
  oceanText: { cssColor: '#57b499', color: c, key: '', name: '' }, // text on ocean
  oceanDarker: { cssColor: '#77d6bd', color: c, key: '', name: '' }, // dark overlay
  oceanDark: { cssColor: '#70cfb6', color: c, key: '', name: '' }, // dark overlay
  oceanLighter: { cssColor: '#d7fef1', color: c, key: '', name: '' }, // light overlay
  oceanLight: { cssColor: '#a3f8dd', color: c, key: '', name: '' }, // light overlay
  oceanWave: { cssColor: '#63d4b2', color: c, key: '', name: '' },
};

Object.keys(colors).forEach((colorKey) => {
  const colorData = colors[colorKey];
  colorData.color = new paper.Color(colorData.cssColor);
  if (!colorData.name) {
    // if it has a custom encoded name, make sure to use that
    colorData.name = colorKey;
  }
  colorData.key = colorKey;
});

export function getColorDataFromEncodedName(encodedColorName: string) {
  if (!encodedColorName) {
    return null;
  }
  return Object.values(colors).find((c) => {
    return c.name === encodedColorName;
  });
}
