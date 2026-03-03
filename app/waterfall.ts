import paper from 'paper';
import { state } from './state';
import { colors } from './colors';
import { layers } from './layers';
import { emitter } from './emitter';
import { appSettings } from './settings';

let waterfallGroup: paper.Group | null = null;
let dirty = false;

const STROKE_WIDTH = 0.3; // island units; only ~0.15 visible after clipping

export function initWaterfall(): void {
  emitter.on('mapLoaded', rebuildWaterfall);
}

export function markWaterfallDirty(): void {
  if (!dirty) {
    dirty = true;
    requestAnimationFrame(() => {
      dirty = false;
      rebuildWaterfall();
    });
  }
}

function rebuildWaterfall(): void {
  if (waterfallGroup) {
    waterfallGroup.remove();
    waterfallGroup = null;
  }

  if (!appSettings.showWaterEffects) return;

  const waterPath = state.drawing['water'];
  if (!waterPath || waterPath.isEmpty()) return;

  const level2Path = state.drawing['level2'];
  const level3Path = state.drawing['level3'];
  if (!level2Path && !level3Path) return;

  layers.mapLayer.activate();
  waterfallGroup = new paper.Group();

  // Water clone as clip mask
  const clipMask = waterPath.clone();
  clipMask.clipMask = true;
  waterfallGroup.addChild(clipMask);

  // Level2 outline (level1↔level2 boundary)
  if (level2Path && !level2Path.isEmpty()) {
    const outline = level2Path.clone();
    outline.fillColor = null;
    outline.strokeColor = colors.waterfall.color;
    outline.strokeWidth = STROKE_WIDTH;
    waterfallGroup.addChild(outline);
  }

  // Level3 outline (level2↔level3 boundary)
  if (level3Path && !level3Path.isEmpty()) {
    const outline = level3Path.clone();
    outline.fillColor = null;
    outline.strokeColor = colors.waterfall.color;
    outline.strokeWidth = STROKE_WIDTH;
    waterfallGroup.addChild(outline);
  }

  waterfallGroup.locked = true;
  waterfallGroup.insertAbove(waterPath);
}

export function clearWaterfall(): void {
  if (waterfallGroup) {
    waterfallGroup.remove();
    waterfallGroup = null;
  }
  dirty = false;
}
