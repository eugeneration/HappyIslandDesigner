import { colors, Color } from './colors';

// layerDefinition[colors.water] = {
//  elevation: -5,
//  addLayers: [colors.water],
//  cutLayers: [colors.rock],
//  limit: true,
// };

export const layerDefinition: {
  [key: string]: {
    priority: number;
    elevation: number;
    addLayers: Color['key'][];
    cutLayers: Color['key'][];
  };
} = {
  [colors.level3.key]: {
    priority: 50,
    elevation: 40,
    addLayers: [
      colors.sand.key,
      colors.level1.key,
      colors.level2.key,
      colors.level3.key,
    ],
    cutLayers: [colors.rock.key, colors.water.key],
  },
  [colors.level2.key]: {
    priority: 40,
    elevation: 30,
    addLayers: [colors.sand.key, colors.level1.key, colors.level2.key],
    cutLayers: [colors.rock.key, colors.level3.key, colors.water.key],
  },
  [colors.level1.key]: {
    priority: 30,
    elevation: 20,
    addLayers: [colors.sand.key, colors.level1.key],
    cutLayers: [
      colors.rock.key,
      colors.level2.key,
      colors.level3.key,
      colors.water.key,
    ],
  },
  [colors.rock.key]: {
    priority: 20,
    elevation: 5,
    addLayers: [colors.rock.key, colors.sand.key],
    cutLayers: [
      colors.level1.key,
      colors.level2.key,
      colors.level3.key,
      colors.water.key,
    ],
  },
  [colors.sand.key]: {
    priority: 10,
    elevation: 10,
    addLayers: [colors.sand.key],
    cutLayers: [
      colors.rock.key,
      colors.level1.key,
      colors.level2.key,
      colors.level3.key,
      colors.water.key,
    ],
  },
  [colors.water.key]: {
    priority: 0,
    elevation: 0,
    addLayers: [],
    cutLayers: [
      colors.sand.key,
      colors.rock.key,
      colors.level1.key,
      colors.level2.key,
      colors.level3.key,
      colors.water.key,
    ],
  },
};
// layerDefinition[colors.eraser.key] = {
//  elevation: 0,
//  addLayers: [],
//  cutLayers: [colors.sand.key, colors.rock.key, colors.level1.key,
//  colors.level2.key, colors.level3.key, colors.water.key],
// };
