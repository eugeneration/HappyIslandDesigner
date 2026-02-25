import paper from 'paper';

export const VIEW_TRANSITION_DURATION = 0.4;

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
