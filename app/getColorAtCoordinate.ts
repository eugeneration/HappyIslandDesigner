import { toolState } from './tools/state';
import { layerDefinition } from './layerDefinition';
import { state } from './state';
import { toolCategoryDefinition } from './tools';
import { colors } from './colors';
import { pathDefinition } from './pathDefinition';

export function getColorAtCoordinate(coordinate) {
  // choose the highest elevation color
  // todo - this logic should be elsewhere
  if (toolState.activeTool) {
    let bestColor;

    if (
      toolState.activeTool.type === toolCategoryDefinition.terrain.type ||
      toolState.activeTool.type === toolCategoryDefinition.path.type
    ) {
      bestColor = colors.water;

      let bestPriority = 0;
      Object.keys(state.drawing).forEach((colorKey) => {
        const definition =
          layerDefinition[colorKey] || pathDefinition[colorKey];
        if (!definition) {
          console.log('Unknown color in drawing!');
          return;
        }
        const priority = (definition && definition.priority) || 0;

        const layer = state.drawing[colorKey];
        if (layer) {
          if (layer.contains(coordinate)) {
            if (priority > bestPriority) {
              bestPriority = priority;
              bestColor = colors[colorKey];
            }
          }
        }
      });
    }
    return bestColor;
  }
}
