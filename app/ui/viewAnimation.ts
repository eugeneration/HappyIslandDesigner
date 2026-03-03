import paper from 'paper';
import { layers } from '../layers';

export const VIEW_TRANSITION_DURATION = 0.4;
export const WIZARD_MAX_BLOCK_PX = 150; // max physical size (px) one block should occupy on screen
export const SHAPE_SELECTOR_SPAN = 32; // island units — focused tile + surrounding context

export function computeWizardZoom(
  center: paper.Point,
  minVisibleSpan: number
): { zoom: number; center: paper.Point } {
  const view = paper.view;
  const layer = layers.mapOverlayLayer;

  const half = minVisibleSpan / 2;
  const localBounds = new paper.Rectangle(
    center.x - half, center.y - half,
    minVisibleSpan, minVisibleSpan
  );

  const topLeft = layer.localToGlobal(localBounds.topLeft);
  const bottomRight = layer.localToGlobal(localBounds.bottomRight);
  const globalBounds = new paper.Rectangle(topLeft, bottomRight);

  const fitZoomX = view.viewSize.width / globalBounds.width;
  const fitZoomY = view.viewSize.height / globalBounds.height;
  const globalBlockSize = globalBounds.width / minVisibleSpan * 16;
  const maxZoom = WIZARD_MAX_BLOCK_PX / globalBlockSize;
  const newZoom = Math.min(fitZoomX, fitZoomY, maxZoom);

  const globalCenter = layer.localToGlobal(center);
  return { zoom: newZoom, center: globalCenter };
}

let viewAnim: {
  startZoom: number;
  endZoom: number;
  startCenter: paper.Point;
  endCenter: paper.Point;
  elapsed: number;
  duration: number;
  onComplete?: () => void;
} | null = null;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function startViewAnimation(
  target: { zoom: number; center: paper.Point },
  duration?: number,
  onComplete?: () => void
): void {
  viewAnim = {
    startZoom: paper.view.zoom,
    endZoom: target.zoom,
    startCenter: paper.view.center.clone(),
    endCenter: target.center.clone(),
    elapsed: 0,
    duration: duration ?? VIEW_TRANSITION_DURATION,
    onComplete,
  };
}

export function tickViewAnimation(delta: number): void {
  if (!viewAnim) return;
  viewAnim.elapsed += delta;
  const t = Math.min(viewAnim.elapsed / viewAnim.duration, 1);
  const eased = easeInOutCubic(t);

  paper.view.zoom = viewAnim.startZoom + (viewAnim.endZoom - viewAnim.startZoom) * eased;
  paper.view.center = viewAnim.startCenter.add(
    viewAnim.endCenter.subtract(viewAnim.startCenter).multiply(eased)
  );

  if (t >= 1) {
    paper.view.zoom = viewAnim.endZoom;
    paper.view.center = viewAnim.endCenter;
    const cb = viewAnim.onComplete;
    viewAnim = null;
    cb?.();
  }
}

export function stopViewAnimation(): void {
  viewAnim = null;
}

export function isViewAnimating(): boolean {
  return viewAnim !== null;
}
