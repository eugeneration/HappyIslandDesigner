declare global {
  interface Window { gtag?: (...args: any[]) => void; }
}

function trackEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  } else {
    console.log('[analytics]', eventName, params ?? '');
  }
}

// --- Wizard timing state ---
let wizardStartTime: number | null = null;
let wizardFlowType: string | null = null;

export function getWizardFlowType(): string | null { return wizardFlowType; }

function getWizardDurationSeconds(): number | null {
  if (wizardStartTime === null) return null;
  return Math.round((Date.now() - wizardStartTime) / 1000);
}

// --- Batched counters ---
const usageCounts: Record<string, number> = {};
const objectCounts: Record<string, number> = {};
const strokeCounts: Record<string, number> = {};

function flushBatchedEvents(): void {
  if (Object.keys(usageCounts).length > 0) {
    trackEvent('tool_usage', { ...usageCounts });
    for (const k of Object.keys(usageCounts)) delete usageCounts[k];
  }
  if (Object.keys(objectCounts).length > 0) {
    trackEvent('object_placement', { ...objectCounts });
    for (const k of Object.keys(objectCounts)) delete objectCounts[k];
  }
  if (Object.keys(strokeCounts).length > 0) {
    trackEvent('brush_stroke', { ...strokeCounts });
    for (const k of Object.keys(strokeCounts)) delete strokeCounts[k];
  }
}

// --- Immediate events ---

export function trackSessionStart(isRefresh: boolean, hasAutosave: boolean, language: string, loadTimeMs?: number): void {
  trackEvent('session_start', {
    is_refresh: isRefresh,
    has_autosave: hasAutosave,
    language,
    window_width: window.innerWidth,
    window_height: window.innerHeight,
    load_time_ms: loadTimeMs ?? null,
  });
}

export function trackMapLoad(entryMethod: string, version: number): void {
  trackEvent('map_loaded', {
    entry_method: entryMethod,
    map_version: version,
  });
}

export function trackMapSave(version: number): void {
  trackEvent('map_save', { map_version: version });
}

export function trackMapComplexity(
  version: number,
  complexity: Record<string, number>,
  payloadSizeBytes: number,
): void {
  trackEvent('map_complexity', {
    map_version: version,
    ...complexity,
    payload_size_bytes: payloadSizeBytes,
  });
}

export function trackWizardStart(flowType: string): void {
  wizardStartTime = Date.now();
  wizardFlowType = flowType;
  trackEvent('wizard_start', { flow_type: flowType });
}

export function trackWizardComplete(flowType: string, completedVia?: string, skipStep?: string): void {
  const params: Record<string, any> = {
    flow_type: flowType,
    duration_seconds: getWizardDurationSeconds(),
  };
  if (completedVia) params.completed_via = completedVia;
  if (skipStep) params.skip_step = skipStep;
  trackEvent('wizard_complete', params);
  wizardStartTime = null;
  wizardFlowType = null;
}

export function trackWizardCancel(flowType: string | null, step: string): void {
  trackEvent('wizard_cancel', {
    flow_type: flowType,
    cancel_step: step,
    duration_seconds: getWizardDurationSeconds(),
  });
  wizardStartTime = null;
  wizardFlowType = null;
}

export function trackWizardDenyChanges(flowType: string): void {
  trackEvent('wizard_deny_changes', { flow_type: flowType });
}

export function trackScreenshotDuration(durationMs: number): void {
  trackEvent('screenshot_generate', {
    duration_seconds: Math.round(durationMs / 1000),
  });
}

export function trackMainMenuAction(action: string): void {
  trackEvent('main_menu_action', { action });
}

export function trackError(errorType: string, message?: string): void {
  trackEvent('app_error', {
    error_type: errorType,
    error_message: message ? message.substring(0, 100) : undefined,
  });
}

// --- Batched increment functions ---

export function trackToolUsage(toolType: string): void {
  const key = `tool_${toolType}`;
  usageCounts[key] = (usageCounts[key] || 0) + 1;
}

export function trackUndoRedo(action: 'undo' | 'redo'): void {
  usageCounts[`action_${action}`] = (usageCounts[`action_${action}`] || 0) + 1;
}

export function trackOverlayAction(action: string): void {
  usageCounts[`overlay_${action}`] = (usageCounts[`overlay_${action}`] || 0) + 1;
}

export function trackMiscAction(action: string): void {
  usageCounts[action] = (usageCounts[action] || 0) + 1;
}

export function trackObjectPlacement(category: string): void {
  objectCounts[`obj_${category}`] = (objectCounts[`obj_${category}`] || 0) + 1;
}

export function trackBrushStroke(colorKey: string): void {
  strokeCounts[colorKey] = (strokeCounts[colorKey] || 0) + 1;
}

// --- Map complexity helper ---

export function computeMapComplexity(
  drawing: Record<string, any>,
  objects: Record<string, any>,
): Record<string, number> {
  const terrainColors = ['water', 'level1', 'level2', 'level3', 'rock', 'sand'];
  const pathColors = ['pathDirt', 'pathSand', 'pathStone', 'pathBrick', 'pathEraser'];

  let terrainVertices = 0;
  let pathVertices = 0;

  for (const [key, pathItem] of Object.entries(drawing)) {
    if (!pathItem) continue;
    let count = 0;
    if ((pathItem as any).children) {
      for (const child of (pathItem as any).children) {
        count += child.segments ? child.segments.length : 0;
      }
    } else if ((pathItem as any).segments) {
      count = (pathItem as any).segments.length;
    }
    if (terrainColors.includes(key)) {
      terrainVertices += count;
    } else if (pathColors.includes(key)) {
      pathVertices += count;
    }
  }

  const objCounts: Record<string, number> = {
    obj_structures: 0,
    obj_amenities: 0,
    obj_construction: 0,
    obj_tree: 0,
    obj_flower: 0,
  };
  for (const obj of Object.values(objects)) {
    const cat = (obj as any)?.data?.category;
    if (cat && `obj_${cat}` in objCounts) {
      objCounts[`obj_${cat}`]++;
    }
  }

  return {
    terrain_vertices: terrainVertices,
    path_vertices: pathVertices,
    ...objCounts,
  };
}

// --- Overlay flow timing ---
let overlayStartTime: number | null = null;

export function trackOverlayFlowStart(): void {
  overlayStartTime = Date.now();
  trackEvent('overlay_flow_start');
}

export function trackOverlayFlowComplete(): void {
  const duration = overlayStartTime !== null ? Math.round((Date.now() - overlayStartTime) / 1000) : null;
  trackEvent('overlay_flow_complete', { duration_seconds: duration });
  overlayStartTime = null;
}

export function trackOverlayFlowCancel(): void {
  const duration = overlayStartTime !== null ? Math.round((Date.now() - overlayStartTime) / 1000) : null;
  trackEvent('overlay_flow_cancel', { duration_seconds: duration });
  overlayStartTime = null;
}

// --- Init ---

export function initAnalytics(): void {
  setInterval(flushBatchedEvents, 60000);
  window.addEventListener('beforeunload', flushBatchedEvents);
  window.addEventListener('error', (e) => {
    trackError('uncaught', e.message);
  });
}
