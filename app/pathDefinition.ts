import { Color, colors } from './colors';

export const pathDefinition: {
  [key: string]: {
    priority?: number;
    addLayers?: Color['key'][];
    cutLayers: Color['key'][];
    requireLayer?: Color['key'];
  };
} = {};

pathDefinition[colors.pathDirt.key] = {
  priority: 100,
  addLayers: [colors.pathDirt.key],
  cutLayers: [colors.pathBrick.key, colors.pathSand.key, colors.pathStone.key],
  // requireLayer: colors.sand.key, // sand is always drawn below everything else
};
pathDefinition[colors.pathStone.key] = {
  priority: 100,
  addLayers: [colors.pathStone.key],
  cutLayers: [colors.pathBrick.key, colors.pathDirt.key, colors.pathSand.key],
  // requireLayer: colors.sand.key, // sand is always drawn below everything else
};
pathDefinition[colors.pathBrick.key] = {
  priority: 100,
  addLayers: [colors.pathBrick.key],
  cutLayers: [colors.pathDirt.key, colors.pathSand.key, colors.pathStone.key],
  // requireLayer: colors.sand.key, // sand is always drawn below everything else
};
pathDefinition[colors.pathSand.key] = {
  priority: 100,
  addLayers: [colors.pathSand.key],
  cutLayers: [colors.pathBrick.key, colors.pathDirt.key, colors.pathStone.key],
  // requireLayer: colors.sand.key, // sand is always drawn below everything else
};
pathDefinition[colors.pathEraser.key] = {
  cutLayers: [
    colors.pathBrick.key,
    colors.pathDirt.key,
    colors.pathSand.key,
    colors.pathStone.key,
  ],
};
