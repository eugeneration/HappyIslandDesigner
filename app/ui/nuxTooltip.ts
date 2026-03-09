import paper from 'paper';
import { Group, Path, Point, PointText, Rectangle, Size, view } from 'paper';
import { colors } from '../colors';
import { emitter } from '../emitter';

const STORAGE_KEY = 'nux_dismissed';

export function hasSeenNux(id: string): boolean {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return data[id] === true;
  } catch {
    return false;
  }
}

export function resetAllNux(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('NUX tooltips reset. They will reappear on next trigger.');
  } catch {
    // ignore storage errors
  }
}

export function markNuxSeen(id: string): void {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data[id] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

type NuxTooltipOptions = {
  id: string;
  text: string;
  target: paper.Item;
  layer: paper.Layer;
  side?: TooltipSide;
};

const PADDING_X = 12;
const PADDING_Y = 8;
const GAP = 8;
const POINTER_WIDTH = 12;
const POINTER_HEIGHT = 8;
const CORNER_RADIUS = 8;
const SCREEN_MARGIN = 8;
const POINTER_MARGIN = 12;

export function showNuxTooltip(options: NuxTooltipOptions): paper.Group | null {
  const { id, text, target, layer, side = 'top' } = options;

  if (hasSeenNux(id)) return null;

  const prevLayer = paper.project.activeLayer;
  layer.activate();

  // Create text items to measure content size
  const mainText = new PointText(new Point(0, 0));
  mainText.content = text;
  mainText.fontFamily = 'TTNorms, sans-serif';
  mainText.fontSize = 13;
  mainText.fillColor = colors.white.color;

  const dismissText = new PointText(new Point(0, 0));
  dismissText.content = 'tap to dismiss';
  dismissText.fontFamily = 'TTNorms, sans-serif';
  dismissText.fontSize = 10;
  dismissText.fillColor = colors.secondaryText.color;

  // Calculate background size from text measurements
  const contentWidth = Math.max(mainText.bounds.width, dismissText.bounds.width);
  const lineSpacing = 4;
  const contentHeight = mainText.bounds.height + lineSpacing + dismissText.bounds.height;
  const bgWidth = contentWidth + PADDING_X * 2;
  const bgHeight = contentHeight + PADDING_Y * 2;

  // Background rounded rectangle (positioned during layout)
  const background = new Path.Rectangle(
    new Rectangle(new Point(0, 0), new Size(bgWidth, bgHeight)),
    new Size(CORNER_RADIUS, CORNER_RADIUS),
  );
  background.fillColor = colors.text.color;

  // Pointer triangle (segments set during layout)
  const pointer = new Path();
  pointer.fillColor = colors.text.color;

  const group = new Group([background, mainText, dismissText, pointer]);

  function positionTooltip() {
    const screenWidth = view.size.width * view.scaling.x;
    const screenHeight = view.size.height * view.scaling.y;
    const targetBounds = target.bounds;
    const targetCenter = targetBounds.center;

    // Calculate initial tooltip top-left
    let tx: number, ty: number;

    if (side === 'top') {
      tx = targetCenter.x - bgWidth / 2;
      ty = targetBounds.top - GAP - POINTER_HEIGHT - bgHeight;
    } else if (side === 'bottom') {
      tx = targetCenter.x - bgWidth / 2;
      ty = targetBounds.bottom + GAP + POINTER_HEIGHT;
    } else if (side === 'left') {
      tx = targetBounds.left - GAP - POINTER_HEIGHT - bgWidth;
      ty = targetCenter.y - bgHeight / 2;
    } else {
      tx = targetBounds.right + GAP + POINTER_HEIGHT;
      ty = targetCenter.y - bgHeight / 2;
    }

    // Clamp to screen edges
    tx = Math.max(SCREEN_MARGIN, Math.min(tx, screenWidth - bgWidth - SCREEN_MARGIN));
    ty = Math.max(SCREEN_MARGIN, Math.min(ty, screenHeight - bgHeight - SCREEN_MARGIN));

    // Position background and text
    background.bounds.topLeft = new Point(tx, ty);
    mainText.bounds.topLeft = new Point(tx + PADDING_X, ty + PADDING_Y);
    dismissText.bounds.topLeft = new Point(tx + PADDING_X, mainText.bounds.bottom + lineSpacing);

    // Rebuild pointer triangle
    pointer.removeSegments();

    if (side === 'top' || side === 'bottom') {
      let px = targetCenter.x;
      px = Math.max(tx + POINTER_MARGIN, Math.min(px, tx + bgWidth - POINTER_MARGIN));

      if (side === 'top') {
        const baseY = ty + bgHeight;
        pointer.add(new Point(px - POINTER_WIDTH / 2, baseY));
        pointer.add(new Point(px, baseY + POINTER_HEIGHT));
        pointer.add(new Point(px + POINTER_WIDTH / 2, baseY));
      } else {
        const baseY = ty;
        pointer.add(new Point(px - POINTER_WIDTH / 2, baseY));
        pointer.add(new Point(px, baseY - POINTER_HEIGHT));
        pointer.add(new Point(px + POINTER_WIDTH / 2, baseY));
      }
    } else {
      let py = targetCenter.y;
      py = Math.max(ty + POINTER_MARGIN, Math.min(py, ty + bgHeight - POINTER_MARGIN));

      if (side === 'left') {
        const baseX = tx + bgWidth;
        pointer.add(new Point(baseX, py - POINTER_WIDTH / 2));
        pointer.add(new Point(baseX + POINTER_HEIGHT, py));
        pointer.add(new Point(baseX, py + POINTER_WIDTH / 2));
      } else {
        const baseX = tx;
        pointer.add(new Point(baseX, py - POINTER_WIDTH / 2));
        pointer.add(new Point(baseX - POINTER_HEIGHT, py));
        pointer.add(new Point(baseX, py + POINTER_WIDTH / 2));
      }
    }
    pointer.closed = true;
  }

  positionTooltip();

  // Dismiss on click: fade out, then remove
  group.onClick = function () {
    markNuxSeen(id);
    group.tweenTo({ opacity: 0 }, 1000);
    setTimeout(() => {
      if (group.parent) group.remove();
    }, 1050);
  };

  // Reposition on window resize
  emitter.on('resize', function onResize() {
    if (!group.parent) return;
    positionTooltip();
  });

  prevLayer.activate();
  return group;
}
