import { emitter } from './emitter';
import { state } from './state';
import { colors } from './colors';
import { isV2Map } from './mapState';
import { markWaterfallDirty, clearWaterfall } from './waterfall';

export const appSettings = {
  showWaterEffects: false,
};

export function setShowWaterEffects(enabled: boolean): void {
  appSettings.showWaterEffects = enabled;
  emitter.emit('waterEffectsChanged', enabled);
}

emitter.on('waterEffectsChanged', (enabled) => {
  const waterPath = state.drawing['water'];
  if (waterPath && isV2Map()) {
    if (enabled) {
      waterPath.fillColor = colors.waterLevel1Overlay77.color;
      waterPath.opacity = 0.77;
    } else {
      waterPath.fillColor = colors.water.color;
      waterPath.opacity = 1;
    }
  }
  if (enabled) {
    markWaterfallDirty();
  } else {
    clearWaterfall();
  }
});
