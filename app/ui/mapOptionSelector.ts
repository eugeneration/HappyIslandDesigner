import paper from 'paper';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';
import { createButton } from './createButton';
import { goBack } from './mapSelectionWizard';
import { getCachedSvgContent } from '../generatedTilesCache';
import { getImageSrcForAsset } from './edgeTileAssets';
import { hideEdgeTileAtBlock, showEdgeTileAtBlock } from './edgeTiles';

let selectorUI: paper.Group | null = null;
let fixedUI: paper.Group | null = null;
let frameHandler: ((event: { delta: number }) => void) | null = null;
let interactionOverlay: paper.Path | null = null;

export type OptionDirection = 'left' | 'right' | 'bottom';

export type OptionConfig = {
  label: string;
  value: number;
  assetIndex?: number;
  imageSrc?: string;
};

export type MapOptionSelectorConfig = {
  anchorPoint: paper.Point;
  options: OptionConfig[];
  direction: OptionDirection;
  eventName: string;
  title?: string;
  spacing?: number;
  buttonSize?: number;
  hideEdgeTile?: boolean;
};

// Deck stacking constants
const STACK_SCALE = 0.65;           // Scale of stacked cards
const CENTER_SCALE = 1.0;           // Scale of center card
const STACK_BASE_OFFSET = 8;        // Base offset from center (in island units)
const STACK_CARD_OFFSET = 1.5;      // Offset between stacked cards
const MAX_STACK_VISIBLE = 3;        // Max cards visible in each stack
const ANIMATION_SPEED = 0.2;        // Lerp factor for smooth transitions

// State
let cardSpacing = 12;
let optionCards: paper.Group[] = [];
let previewGroup: paper.Group | null = null;
let hiddenEdgeTileBlock: { x: number; y: number } | null = null;
let currentConfig: MapOptionSelectorConfig | null = null;
let uiScale = 1;

// Scroll state
let scrollOffset = 0;               // Current scroll position (animated)
let targetScrollOffset = 0;         // Target index to snap to
let selectedIndex = 0;              // Currently selected card index
let lastZOrderCenter = -1;          // Last center index used for z-ordering

// Wheel scroll state
let wheelSettleTimer: ReturnType<typeof setTimeout> | null = null;
let wheelGestureActive = false;       // Whether a wheel gesture is in progress
let wheelGestureAnchor = 0;           // Integer position when gesture started
let wheelUserDisplacement = 0;        // Raw user delta (excludes snap force)
let wheelPeakDisplacement = 0;        // Peak displacement magnitude during gesture
let wheelGestureCooldownUntil = 0;    // Timestamp: ignore wheel events until this time
let lastWheelEventTime = 0;           // Timestamp of last wheel event
const WHEEL_SENSITIVITY = 0.007;      // Dampening for wheel/trackpad delta -> card units
const COMMIT_THRESHOLD = 0.15;        // Displacement to commit to next card (iOS paging-like)
const SNAP_STRENGTH = 0.1;            // Per-frame pull toward committed target
const SNAP_DELAY = 80;                // ms after last wheel event before snap force kicks in
const WHEEL_SETTLE_MS = 200;          // Pause before finalizing gesture
const DIRECTION_CHANGE_THRESHOLD = 0.02; // Min |scaledDelta| to count as intentional direction change

// Touch state
let touchStartX = 0;
let touchStartY = 0;
let touchStartOffset = 0;           // targetScrollOffset when touch began
let touchMoved = false;
let touchVelocity = 0;              // Cards per ms
let lastTouchTime = 0;
let lastTouchDelta = 0;
const TOUCH_DEAD_ZONE = 10;         // Pixels before recognizing as scroll
const PIXELS_PER_CARD = 80;         // Pixels of drag per card scrolled
const MOMENTUM_FACTOR = 80;          // Velocity multiplier for momentum

function getScrollAxis(direction: OptionDirection): 'x' | 'y' {
  return direction === 'bottom' ? 'x' : 'y';
}

function createOptionCard(
  option: OptionConfig,
  index: number,
  buttonSize: number
): paper.Group {
  const group = new paper.Group();
  group.applyMatrix = false;
  group.data = { index, option, baseSize: buttonSize };

  // Shadow
  const shadowOffset = 0.5;
  const shadowRect = new paper.Path.Rectangle(
    new paper.Rectangle(-buttonSize / 2 + shadowOffset, -buttonSize / 2 + shadowOffset, buttonSize, buttonSize),
    new paper.Size(2, 2)
  );
  shadowRect.fillColor = new paper.Color(0.3, 0.2, 0.15, 0.3);
  group.addChild(shadowRect);

  // Main card background
  const bgRect = new paper.Path.Rectangle(
    new paper.Rectangle(-buttonSize / 2, -buttonSize / 2, buttonSize, buttonSize),
    new paper.Size(2, 2)
  );
  bgRect.fillColor = new paper.Color('#ffffff');
  group.addChild(bgRect);

  // Helper to add SVG
  const addSvgToButton = (item: paper.Item) => {
    const scale = (buttonSize - 2) / Math.max(item.bounds.width, item.bounds.height);
    item.scale(scale, item.bounds.center);
    item.position = new paper.Point(0, 0);

    const bgSize = buttonSize - 2;
    const greenBg = new paper.Path.Rectangle(
      new paper.Rectangle(-bgSize / 2, -bgSize / 2, bgSize, bgSize)
    );
    greenBg.fillColor = colors.level1.color;
    group.addChild(greenBg);
    group.addChild(item);
  };

  // Load SVG content
  if (option.assetIndex !== undefined) {
    const cachedSvg = getCachedSvgContent(option.assetIndex);
    if (cachedSvg) {
      const item = paper.project.importSVG(cachedSvg, { insert: false });
      if (item) addSvgToButton(item);
    } else {
      const imageSrc = getImageSrcForAsset(option.assetIndex);
      if (imageSrc) {
        paper.project.importSVG(imageSrc, {
          onLoad: (item: paper.Item) => addSvgToButton(item),
          insert: false,
        });
      }
    }
  } else if (option.imageSrc) {
    paper.project.importSVG(option.imageSrc, {
      onLoad: (item: paper.Item) => addSvgToButton(item),
      insert: false,
    });
  } else {
    const label = new paper.PointText(new paper.Point(0, 1));
    label.justification = 'center';
    label.fontFamily = 'TTNorms, sans-serif';
    label.fontSize = buttonSize * 0.35;
    label.fillColor = colors.text.color;
    label.content = option.label;
    group.addChild(label);
  }

  return group;
}

function updateDeckPositions(): void {
  if (!currentConfig) return;

  // Skip update when settled — both target and animated position at same integer
  const settledEpsilon = 0.001;
  const isSettled = lastZOrderCenter !== -1
    && Math.abs(targetScrollOffset - scrollOffset) < settledEpsilon
    && Math.abs(targetScrollOffset - Math.round(targetScrollOffset)) < settledEpsilon
    && !touchMoved;
  if (isSettled) return;

  const axis = getScrollAxis(currentConfig.direction);
  const anchor = currentConfig.anchorPoint;

  // Snap force: pull target toward committed card (iOS paging-like detent)
  // Disabled during active touch drag and while actively scrolling
  // Commit target based on user-only displacement (snap force doesn't count toward commit)
  if (!touchMoved && Date.now() - lastWheelEventTime > SNAP_DELAY) {
    const maxIndex = currentConfig.options.length - 1;
    let snapTarget: number;
    if (wheelGestureActive) {
      // Use peak unless user deliberately reversed direction
      const effectiveDisplacement = (Math.sign(wheelUserDisplacement) === Math.sign(wheelPeakDisplacement))
        ? wheelPeakDisplacement
        : wheelUserDisplacement;
      snapTarget = getCommittedTarget(wheelGestureAnchor, wheelGestureAnchor + effectiveDisplacement, maxIndex);
    } else {
      snapTarget = Math.round(targetScrollOffset);
    }
    targetScrollOffset += (snapTarget - targetScrollOffset) * SNAP_STRENGTH;
  }

  // Smooth animation toward target
  scrollOffset += (targetScrollOffset - scrollOffset) * ANIMATION_SPEED;

  // Update selected index when animation is close enough
  const nearestIndex = Math.round(scrollOffset);
  if (nearestIndex !== selectedIndex && Math.abs(scrollOffset - nearestIndex) < 0.1) {
    selectedIndex = nearestIndex;
    updatePreview();
  }

  // Position each card based on distance from current scroll position
  optionCards.forEach((card) => {
    const distanceFromCenter = card.data.index - scrollOffset;
    let scale: number;
    let offset: number;

    const absDistance = Math.abs(distanceFromCenter);
    const direction = Math.sign(distanceFromCenter) || 1;

    // Scale: interpolate toward center when within 0.5
    if (absDistance < 0.5) {
      const t = 1 - absDistance * 2; // 0 to 1 as card approaches center
      scale = STACK_SCALE + (CENTER_SCALE - STACK_SCALE) * t;
    } else {
      scale = STACK_SCALE;
    }

    // Offset: continuous function — no jump at boundaries
    if (absDistance < 1) {
      // Linear from 0 at center to (STACK_BASE_OFFSET + STACK_CARD_OFFSET) at d=1
      // Continuous with stack formula at d=1: 1*(BASE+CARD) = BASE+1*CARD
      offset = direction * absDistance * (STACK_BASE_OFFSET + STACK_CARD_OFFSET);
    } else {
      // Standard stack formula
      const stackPosition = Math.min(absDistance, MAX_STACK_VISIBLE);
      offset = direction * (STACK_BASE_OFFSET + stackPosition * STACK_CARD_OFFSET);
    }

    const finalScale = scale * uiScale;
    card.scaling = new paper.Point(finalScale, finalScale);

    // Position based on direction
    let baseOffset = 0;
    switch (currentConfig!.direction) {
      case 'left':
        baseOffset = -cardSpacing;
        break;
      case 'right':
        baseOffset = cardSpacing;
        break;
      case 'bottom':
        baseOffset = cardSpacing;
        break;
    }

    if (axis === 'x') {
      card.position = new paper.Point(anchor.x + offset, anchor.y + baseOffset);
    } else {
      card.position = new paper.Point(anchor.x + baseOffset, anchor.y + offset);
    }

    // Z-order: center card on top, stacked cards behind
    // Cards closer to center should be on top
    const zOrder = Math.abs(card.data.index - Math.round(scrollOffset));
    card.data.zOrder = zOrder;
  });

  // Re-order children by z-order only when center card changes
  const currentCenter = Math.round(scrollOffset);
  if (selectorUI && currentCenter !== lastZOrderCenter) {
    lastZOrderCenter = currentCenter;
    const sorted = [...optionCards].sort((a, b) => b.data.zOrder - a.data.zOrder);
    sorted.forEach(card => {
      if (card.parent === selectorUI) {
        selectorUI!.addChild(card); // Re-adds to end, creating correct z-order
      }
    });
  }
}

function scrollToIndex(index: number): void {
  if (!currentConfig) return;
  targetScrollOffset = Math.max(0, Math.min(index, currentConfig.options.length - 1));
}

function getCommittedTarget(anchor: number, current: number, maxIndex: number): number {
  const d = current - anchor;
  const absD = Math.abs(d);
  if (absD < COMMIT_THRESHOLD) return anchor; // Below threshold: snap back
  // First card commits at COMMIT_THRESHOLD (0.15)
  // Subsequent cards require crossing 0.5 past each integer boundary
  const additionalCards = Math.max(0, Math.floor(absD - 0.5));
  const cards = 1 + additionalCards;
  const target = anchor + Math.sign(d) * cards;
  return Math.max(0, Math.min(target, maxIndex));
}

function updatePreview(): void {
  if (!currentConfig || !previewGroup) return;

  previewGroup.removeChildren();

  if (selectedIndex < 0 || selectedIndex >= currentConfig.options.length) return;

  const option = currentConfig.options[selectedIndex];
  if (!option || option.assetIndex === undefined) return;

  const cachedSvg = getCachedSvgContent(option.assetIndex);
  if (cachedSvg) {
    const item = paper.project.importSVG(cachedSvg, { insert: false });
    if (item) {
      const tileSize = 16;
      const scale = tileSize / Math.max(item.bounds.width, item.bounds.height);
      item.scale(scale);
      item.position = currentConfig.anchorPoint;
      item.opacity = 0.7;
      previewGroup.addChild(item);
    }
  }
}

function createBackButton(position: paper.Point): paper.Group {
  const bgCircle = new paper.Path.Circle(new paper.Point(0, 0), 4);
  bgCircle.fillColor = colors.paper.color;

  const arrow = new paper.Path();
  arrow.strokeColor = colors.text.color;
  arrow.strokeWidth = 0.8;
  arrow.strokeCap = 'round';
  arrow.add(new paper.Point(1.5, 0));
  arrow.add(new paper.Point(-1.5, 0));
  arrow.add(new paper.Point(-0.5, -1.5));
  arrow.add(new paper.Point(-1.5, 0));
  arrow.add(new paper.Point(-0.5, 1.5));

  const button = createButton(bgCircle, 6, () => {
    hideOptionSelector();
    goBack();
  }, {
    highlightedColor: colors.paperOverlay.color,
    selectedColor: colors.paperOverlay2.color,
  });

  button.addChild(arrow);
  button.position = position;

  return button;
}

function createConfirmButton(position: paper.Point): paper.Group {
  const bgCircle = new paper.Path.Circle(new paper.Point(0, 0), 4);
  bgCircle.fillColor = colors.jaybird.color;

  const check = new paper.Path();
  check.strokeColor = colors.paper.color;
  check.strokeWidth = 1;
  check.strokeCap = 'round';
  check.strokeJoin = 'round';
  check.add(new paper.Point(-1.5, 0));
  check.add(new paper.Point(-0.5, 1.2));
  check.add(new paper.Point(1.5, -1));

  const button = createButton(bgCircle, 6, () => {
    if (currentConfig && selectedIndex >= 0) {
      const option = currentConfig.options[selectedIndex];
      emitter.emit(currentConfig.eventName, { value: option.value });
      hideOptionSelector();
    }
  }, {
    highlightedColor: colors.blue.color,
    selectedColor: colors.jaybird.color,
  });

  button.addChild(check);
  button.position = position;

  return button;
}

export function showOptionSelector(config: MapOptionSelectorConfig): void {
  hideOptionSelector();

  currentConfig = config;
  cardSpacing = config.spacing || 12;
  const buttonSize = config.buttonSize || 10;

  // Reset state
  optionCards = [];
  selectedIndex = 0;
  lastZOrderCenter = -1;
  scrollOffset = 0;
  targetScrollOffset = 0;
  if (wheelSettleTimer) { clearTimeout(wheelSettleTimer); wheelSettleTimer = null; }
  wheelGestureActive = false;
  wheelGestureAnchor = 0;
  wheelUserDisplacement = 0;
  wheelPeakDisplacement = 0;
  wheelGestureCooldownUntil = 0;
  lastWheelEventTime = 0;
  touchStartX = 0;
  touchStartY = 0;
  touchStartOffset = 0;
  touchMoved = false;
  touchVelocity = 0;

  layers.mapOverlayLayer.activate();

  selectorUI = new paper.Group();
  selectorUI.applyMatrix = false;

  // Create large interaction overlay to block map interactions
  const viewBounds = paper.view.bounds;
  interactionOverlay = new paper.Path.Rectangle(
    new paper.Rectangle(
      viewBounds.x - viewBounds.width,
      viewBounds.y - viewBounds.height,
      viewBounds.width * 3,
      viewBounds.height * 3
    )
  );
  // Use colors.invisible for proper Paper.js hit detection
  interactionOverlay.fillColor = colors.invisible.color;
  selectorUI.addChild(interactionOverlay);

  // Create preview group (replaces anchor dot)
  previewGroup = new paper.Group();
  previewGroup.applyMatrix = false;
  selectorUI.addChild(previewGroup);

  // Create option cards (all at same position initially, will be positioned by updateDeckPositions)
  config.options.forEach((option, index) => {
    const card = createOptionCard(option, index, buttonSize);
    card.position = config.anchorPoint;
    optionCards.push(card);
    selectorUI!.addChild(card);

    // Click handler - scroll to this card
    card.onClick = () => {
      scrollToIndex(index);
    };
  });

  // Zoom to fit
  zoomToFit(config.anchorPoint, config.direction, cardSpacing);

  // Calculate UI scale after zoom
  uiScale = 1 / paper.view.zoom;

  // Create fixed UI (back button, label, confirm) on fixedLayer at bottom of screen
  layers.fixedLayer.activate();
  fixedUI = new paper.Group();
  fixedUI.applyMatrix = false;

  const viewWidth = paper.view.viewSize.width;
  const viewHeight = paper.view.viewSize.height;
  const fixedScale = 5;
  const bottomY = viewHeight - 40;

  // Back button at bottom-left
  const backButton = createBackButton(new paper.Point(0, 0));
  backButton.scaling = new paper.Point(fixedScale, fixedScale);
  backButton.position = new paper.Point(50, bottomY);
  fixedUI.addChild(backButton);

  // Label at bottom-center
  if (config.title) {
    const label = new paper.PointText(new paper.Point(0, 0));
    label.content = config.title;
    label.justification = 'center';
    label.fontFamily = 'TTNorms, sans-serif';
    label.fontSize = 16;
    label.fillColor = colors.text.color;

    const labelBg = new paper.Path.Rectangle(
      new paper.Rectangle(
        label.bounds.x - 8,
        label.bounds.y - 4,
        label.bounds.width + 16,
        label.bounds.height + 8
      ),
      new paper.Size(6, 6)
    );
    labelBg.fillColor = colors.paper.color;
    labelBg.opacity = 0.9;

    const labelGroup = new paper.Group([labelBg, label]);
    labelGroup.applyMatrix = false;
    labelGroup.position = new paper.Point(viewWidth / 2, bottomY);
    fixedUI.addChild(labelGroup);
  }

  // Confirm button to the right of center
  const confirmButton = createConfirmButton(new paper.Point(0, 0));
  confirmButton.scaling = new paper.Point(fixedScale, fixedScale);
  confirmButton.position = new paper.Point(viewWidth / 2 + 60, bottomY);
  fixedUI.addChild(confirmButton);

  layers.mapOverlayLayer.activate();

  // Hide the existing edge tile at this block so preview shows cleanly
  if (config.hideEdgeTile) {
    const blockX = Math.floor(config.anchorPoint.x / 16);
    const blockY = Math.floor(config.anchorPoint.y / 16);
    hiddenEdgeTileBlock = { x: blockX, y: blockY };
    hideEdgeTileAtBlock(blockX, blockY);
  }

  // Set up event handlers
  setupEventHandlers();

  // Start animation loop
  frameHandler = () => {
    updateDeckPositions();
  };
  paper.view.on('frame', frameHandler);

  // Initial positioning and preview
  updateDeckPositions();
  updatePreview();
}

function setupEventHandlers(): void {
  if (!selectorUI || !interactionOverlay) return;

  const canvas = paper.view.element;

  // Mousewheel handler - gesture anchor + commit threshold (iOS paging-like)
  const wheelHandler = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!currentConfig) return;

    // Ignore late momentum events from macOS trackpad after gesture settled
    if (Date.now() < wheelGestureCooldownUntil) return;

    lastWheelEventTime = Date.now();

    const rawDelta = currentConfig.direction === 'bottom' ? event.deltaX || event.deltaY : event.deltaY;
    const maxIndex = currentConfig.options.length - 1;

    // Start new gesture if not already active
    if (!wheelGestureActive) {
      wheelGestureActive = true;
      wheelGestureAnchor = Math.round(targetScrollOffset);
    }

    // Accumulate delta into both target (animation) and user displacement (commit logic)
    const scaledDelta = rawDelta * WHEEL_SENSITIVITY;

    // Detect direction reversal (ignoring small jitter)
    if (wheelGestureActive && wheelUserDisplacement !== 0
        && Math.sign(scaledDelta) !== Math.sign(wheelUserDisplacement)
        && Math.abs(scaledDelta) > DIRECTION_CHANGE_THRESHOLD) {
      // Reset gesture from current card position
      wheelGestureAnchor = Math.round(targetScrollOffset);
      wheelUserDisplacement = 0;
      wheelPeakDisplacement = 0;
      if (wheelSettleTimer) { clearTimeout(wheelSettleTimer); wheelSettleTimer = null; }
    }

    targetScrollOffset += scaledDelta;
    targetScrollOffset = Math.max(0, Math.min(targetScrollOffset, maxIndex));
    wheelUserDisplacement += scaledDelta;
    // Track peak displacement — preserve highest intent even if jitter reduces it
    if (Math.abs(wheelUserDisplacement) > Math.abs(wheelPeakDisplacement)) {
      wheelPeakDisplacement = wheelUserDisplacement;
    }

    // End gesture after pause — finalize to committed target based on user-only displacement
    if (wheelSettleTimer) clearTimeout(wheelSettleTimer);
    wheelSettleTimer = setTimeout(() => {
      // Use peak unless user deliberately reversed direction
      const effectiveDisplacement = (Math.sign(wheelUserDisplacement) === Math.sign(wheelPeakDisplacement))
        ? wheelPeakDisplacement
        : wheelUserDisplacement;
      const committedTarget = getCommittedTarget(wheelGestureAnchor, wheelGestureAnchor + effectiveDisplacement, maxIndex);
      scrollToIndex(committedTarget);
      wheelGestureActive = false;
      wheelUserDisplacement = 0;
      wheelPeakDisplacement = 0;
      wheelGestureCooldownUntil = Date.now() + 150; // Ignore macOS deceleration tail events
    }, WHEEL_SETTLE_MS);
  };
  canvas.addEventListener('wheel', wheelHandler, { passive: false });

  // Touch handlers for mobile swipe - continuous with velocity
  const touchStartHandler = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartOffset = targetScrollOffset;
    touchMoved = false;
    touchVelocity = 0;
    lastTouchTime = Date.now();
    lastTouchDelta = 0;
  };

  const touchMoveHandler = (event: TouchEvent) => {
    if (event.touches.length !== 1 || !currentConfig) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // Use appropriate axis based on direction
    const delta = currentConfig.direction === 'bottom' ? deltaX : deltaY;

    // Dead zone to distinguish taps from scrolls
    if (!touchMoved && Math.abs(delta) > TOUCH_DEAD_ZONE) {
      touchMoved = true;
    }

    if (touchMoved) {
      event.preventDefault();
      event.stopPropagation();

      // Convert pixel delta to card units (negative because drag direction is opposite to scroll direction)
      const cardDelta = -delta / PIXELS_PER_CARD;
      const maxIndex = currentConfig.options.length - 1;
      targetScrollOffset = Math.max(0, Math.min(touchStartOffset + cardDelta, maxIndex));

      // Track velocity (cards per ms)
      const now = Date.now();
      const dt = now - lastTouchTime;
      if (dt > 0) {
        touchVelocity = (cardDelta - lastTouchDelta) / dt;
      }
      lastTouchTime = now;
      lastTouchDelta = cardDelta;
    }
  };

  const touchEndHandler = () => {
    if (touchMoved && currentConfig) {
      // Apply momentum based on velocity
      const momentum = touchVelocity * MOMENTUM_FACTOR;
      const projected = targetScrollOffset + momentum;
      const maxIndex = currentConfig.options.length - 1;
      scrollToIndex(Math.round(Math.max(0, Math.min(projected, maxIndex))));
    }
    touchMoved = false;
  };

  canvas.addEventListener('touchstart', touchStartHandler, { passive: true });
  canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });
  canvas.addEventListener('touchend', touchEndHandler, { passive: true });

  // Store handlers for cleanup
  selectorUI.data = {
    wheelHandler,
    touchStartHandler,
    touchMoveHandler,
    touchEndHandler,
  };

  // Block other mouse interactions on overlay
  interactionOverlay.onMouseDown = (event: paper.MouseEvent) => {
    event.stopPropagation();
  };
  interactionOverlay.onMouseDrag = (event: paper.MouseEvent) => {
    event.stopPropagation();
  };
}

export function hideOptionSelector(): void {
  if (selectorUI) {
    const canvas = paper.view.element;
    const data = selectorUI.data;

    if (data?.wheelHandler) {
      canvas.removeEventListener('wheel', data.wheelHandler);
    }
    if (data?.touchStartHandler) {
      canvas.removeEventListener('touchstart', data.touchStartHandler);
    }
    if (data?.touchMoveHandler) {
      canvas.removeEventListener('touchmove', data.touchMoveHandler);
    }
    if (data?.touchEndHandler) {
      canvas.removeEventListener('touchend', data.touchEndHandler);
    }

    selectorUI.remove();
    selectorUI = null;
  }

  if (fixedUI) {
    fixedUI.remove();
    fixedUI = null;
  }

  // Restore hidden edge tile
  if (hiddenEdgeTileBlock) {
    showEdgeTileAtBlock(hiddenEdgeTileBlock.x, hiddenEdgeTileBlock.y);
    hiddenEdgeTileBlock = null;
  }

  if (frameHandler) {
    paper.view.off('frame', frameHandler);
    frameHandler = null;
  }

  if (wheelSettleTimer) { clearTimeout(wheelSettleTimer); wheelSettleTimer = null; }
  wheelGestureActive = false;
  wheelGestureAnchor = 0;
  wheelUserDisplacement = 0;
  wheelPeakDisplacement = 0;
  wheelGestureCooldownUntil = 0;
  lastWheelEventTime = 0;
  interactionOverlay = null;
  currentConfig = null;
  optionCards = [];
  previewGroup = null;
}

function zoomToFit(
  anchor: paper.Point,
  direction: OptionDirection,
  spacing: number
): void {
  const view = paper.view;
  const layer = layers.mapOverlayLayer;

  // For deck stacking, we need less space since cards stack
  const stackSpan = STACK_BASE_OFFSET + MAX_STACK_VISIBLE * STACK_CARD_OFFSET;
  let minX: number, maxX: number, minY: number, maxY: number;

  switch (direction) {
    case 'bottom':
      minX = anchor.x - stackSpan - spacing * 2;
      maxX = anchor.x + stackSpan + spacing * 2;
      minY = anchor.y - spacing;
      maxY = anchor.y + spacing * 3;
      break;
    case 'left':
      minX = anchor.x - spacing * 3;
      maxX = anchor.x + spacing;
      minY = anchor.y - stackSpan - spacing * 2;
      maxY = anchor.y + stackSpan + spacing * 2;
      break;
    case 'right':
      minX = anchor.x - spacing;
      maxX = anchor.x + spacing * 3;
      minY = anchor.y - stackSpan - spacing * 2;
      maxY = anchor.y + stackSpan + spacing * 2;
      break;
  }

  const localBounds = new paper.Rectangle(minX, minY, maxX - minX, maxY - minY);
  const topLeft = layer.localToGlobal(localBounds.topLeft);
  const bottomRight = layer.localToGlobal(localBounds.bottomRight);
  const globalBounds = new paper.Rectangle(topLeft, bottomRight);

  const viewPadding = 1.3;
  const zoomX = view.viewSize.width / (globalBounds.width * viewPadding);
  const zoomY = view.viewSize.height / (globalBounds.height * viewPadding);
  const newZoom = Math.min(zoomX, zoomY, 4);

  view.zoom = newZoom;
  view.center = globalBounds.center;
}

export function isOptionSelectorVisible(): boolean {
  return selectorUI !== null && selectorUI.visible;
}
