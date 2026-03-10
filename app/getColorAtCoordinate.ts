import { toolState } from './tools/state';
import { layerDefinition } from './layerDefinition';
import { state } from './state';
import { toolCategoryDefinition } from './tools';
import { colors } from './colors';
import { pathDefinition } from './pathDefinition';
import { isV2Map } from './mapState';

export function getColorAtCoordinate(coordinate) {
  // choose the highest elevation color
  // todo - this logic should be elsewhere
  if (toolState.activeTool) {
    let bestColor;

    if (
      toolState.activeTool.type === toolCategoryDefinition.terrain.type ||
      toolState.activeTool.type === toolCategoryDefinition.path.type
    ) {
      const v2 = isV2Map();
      // V2: level1 is the base layer; V1: water is the base layer
      bestColor = v2 ? colors.level1 : colors.water;

      let bestPriority = 0;
      Object.keys(state.drawing).forEach((colorKey) => {
        const definition =
          layerDefinition[colorKey] || pathDefinition[colorKey];
        if (!definition) {
          console.log('Unknown color in drawing!');
          return;
        }
        const priority =
          (v2 && definition.v2Priority != null
            ? definition.v2Priority
            : definition.priority) || 0;

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
