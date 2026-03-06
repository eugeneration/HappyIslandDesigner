import paper from 'paper';
import i18next from 'i18next';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';
import { getCachedSvgContent } from '../lazyTilesCache';
import { getImageSrcForAsset } from './edgeTileAssets';
import { hideEdgeTileAtBlock, showEdgeTileAtBlock } from './edgeTiles';
import { getMobileOperatingSystem } from '../helpers/getMobileOperatingSystem';
import { createWrappedLabel } from '../helpers/createWrappedLabel';
import { computeWizardZoom, SHAPE_SELECTOR_SPAN, startViewAnimation, tickViewAnimation, stopViewAnimation, isViewAnimating, VIEW_TRANSITION_DURATION } from './viewAnimation';

let selectorUI: paper.Group | null = null;
let fixedUI: paper.Group | null = null;
let frameHandler: ((event: { delta: number }) => void) | null = null;
let interactionOverlay: paper.Path | null = null;
let fixedLabelGroup: paper.Group | null = null;
let resizeHandler: (() => void) | null = null;

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
const HOVER_SCALE = 1.05;           // 5% size increase on hover
const HOVER_LIFT = -0.75;           // Move up 0.75 units on hover (center card only)
const HOVER_TILT = 1.5;             // 1.5 degree tilt on hover (center card only)
const HOVER_SPEED = 0.225;          // Lerp factor for hover animation
const SCROLL_SETTLE_THRESHOLD = 0.02; // Max offset from integer to consider "settled" for hover

// State
let cardSpacing = 12;
let optionCards: paper.Group[] = [];
let previewGroup: paper.Group | null = null;
let tilePointer: paper.Item | null = null;
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

// Selection animation constants
const HOP_DURATION = 0.4;            // Hop arc to tile position (seconds) — dismiss runs in parallel
const SQUISH_DURATION = 0.2;         // Squish-bounce on landing
const PARTICLE_DURATION = 0.3;       // Star burst + card fade
// VIEW_TRANSITION_DURATION imported from ./viewAnimation
const DISMISS_SLIDE_DISTANCE = 3;    // Island units cards slide away during dismiss
const HOP_PEAK_SCALE_MULT = 1.4;     // Scale multiplier at hop peak (z-illusion)
const SQUISH_AMPLITUDE = 0.15;       // Max deformation during squish (15%)
const PARTICLE_COUNT = 8;
const PARTICLE_SPEED = 30;           // Island units per second
const PARTICLE_SIZE = 0.75;          // Island units, base size
const SETTLE_DELAY = 0.5;           // Pause after particles before moving on

// Selection animation types
enum SelectionAnimPhase {
  HopToTile = 'hopToTile',
  LandingSquish = 'landingSquish',
  ParticleBurst = 'particleBurst',
  SettleDelay = 'settleDelay',
  ViewTransition = 'viewTransition',
}

type Particle = {
  item: paper.Item;
  velocity: paper.Point;
  life: number;
  initialScale: number;
  spinSpeed: number;
};

type SelectionAnimState = {
  phase: SelectionAnimPhase;
  phaseTime: number;
  selectedCard: paper.Group;
  otherCards: paper.Group[];
  originalPositions: Map<paper.Group, paper.Point>;  // for dismiss slide
  hopStart: paper.Point;
  hopEnd: paper.Point;
  hopStartScale: number;
  hopEndScale: number;
  particles: Particle[];
  eventName: string;
  eventValue: number;
  eventEmitted: boolean;
};

// Selection animation state
let selectionAnim: SelectionAnimState | null = null;
let animationBlocked = false;

// Easing functions
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function bounceDamped(t: number): number {
  const frequency = 2.5;
  const decay = 4;
  return Math.sin(t * Math.PI * frequency) * Math.exp(-t * decay);
}

function parabolicArc(t: number, start: number, peak: number, end: number): number {
  // Quadratic Bezier: passes through peak at t=0.5
  const p0 = start;
  const p1 = 2 * peak - 0.5 * start - 0.5 * end;
  const p2 = end;
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

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
  group.data = { index, option, baseSize: buttonSize, hovered: false, hoverAmount: 0 };

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

function isScrollSettled(): boolean {
  return !touchMoved
    && !wheelGestureActive
    && Math.abs(scrollOffset - Math.round(scrollOffset)) < SCROLL_SETTLE_THRESHOLD
    && Math.abs(targetScrollOffset - scrollOffset) < SCROLL_SETTLE_THRESHOLD;
}

function updateDeckPositions(): void {
  if (!currentConfig) return;

  // Skip update when settled — both target and animated position at same integer, and no hover animating
  const settledEpsilon = 0.001;
  const hoverAnimating = optionCards.some(c => Math.abs(c.data.hoverAmount - (c.data.hovered ? 1 : 0)) > settledEpsilon);
  const isSettled = lastZOrderCenter !== -1
    && Math.abs(targetScrollOffset - scrollOffset) < settledEpsilon
    && Math.abs(targetScrollOffset - Math.round(targetScrollOffset)) < settledEpsilon
    && !touchMoved
    && !hoverAnimating;
  if (isSettled) return;

  // Clear all hovers while scrolling so cards don't snap into hover animation mid-scroll
  if (!isScrollSettled()) {
    optionCards.forEach(c => { c.data.hovered = false; });
  }

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

    // Animate hover amount
    const hoverTarget = card.data.hovered ? 1 : 0;
    card.data.hoverAmount += (hoverTarget - card.data.hoverAmount) * HOVER_SPEED;
    if (Math.abs(card.data.hoverAmount - hoverTarget) < 0.001) card.data.hoverAmount = hoverTarget;
    const h = card.data.hoverAmount;

    const hoverScale = 1 + (HOVER_SCALE - 1) * h;
    const finalScale = scale * hoverScale;
    card.scaling = new paper.Point(finalScale, finalScale);
    const isCenter = card.data.index === selectedIndex;
    card.rotation = isCenter ? HOVER_TILT * h : 0;

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

    const lift = isCenter ? HOVER_LIFT * h : 0;
    if (axis === 'x') {
      card.position = new paper.Point(anchor.x + offset, anchor.y + baseOffset + lift);
    } else {
      card.position = new paper.Point(anchor.x + baseOffset + lift, anchor.y + offset);
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

  // Position pointer at center card's bottom-right, on top of all cards
  if (tilePointer) {
    const settled = isScrollSettled();
    tilePointer.visible = settled;
    if (settled) {
      const centerCard = optionCards[selectedIndex];
      if (centerCard) {
        const halfSize = centerCard.data.baseSize / 2 * CENTER_SCALE;
        tilePointer.position = new paper.Point(
          centerCard.position.x + halfSize,
          centerCard.position.y + halfSize
        );
        tilePointer.bringToFront();
      }
    }
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

// ── Selection animation ──────────────────────────────────────────────

function startSelectionAnimation(card: paper.Group): void {
  if (!currentConfig || animationBlocked) return;
  animationBlocked = true;
  emitter.emit('disableWizardBackButton');
  if (tilePointer) tilePointer.visible = false;

  const tileSize = 16;
  const currentScale = CENTER_SCALE;
  const hopEndScale = (tileSize / (card.data.baseSize - 2));

  const otherCards = optionCards.filter(c => c !== card);
  const originalPositions = new Map<paper.Group, paper.Point>();
  optionCards.forEach(c => originalPositions.set(c, c.position.clone()));

  selectionAnim = {
    phase: SelectionAnimPhase.HopToTile,
    phaseTime: 0,
    selectedCard: card,
    otherCards,
    originalPositions,
    hopStart: card.position.clone(),
    hopEnd: currentConfig.anchorPoint.clone(),
    hopStartScale: currentScale,
    hopEndScale,
    particles: [],
    eventName: currentConfig.eventName,
    eventValue: currentConfig.options[selectedIndex].value,
    eventEmitted: false,
  };
}

function updateSelectionAnimation(delta: number): void {
  if (!selectionAnim) return;
  selectionAnim.phaseTime += delta;

  switch (selectionAnim.phase) {
    case SelectionAnimPhase.HopToTile:
      updateHopPhase(selectionAnim, delta);
      break;
    case SelectionAnimPhase.LandingSquish:
      updateSquishPhase(selectionAnim, delta);
      break;
    case SelectionAnimPhase.ParticleBurst:
      updateParticlePhase(selectionAnim, delta);
      break;
    case SelectionAnimPhase.SettleDelay:
      updateSettleDelayPhase(selectionAnim, delta);
      break;
    case SelectionAnimPhase.ViewTransition:
      updateViewTransitionPhase(selectionAnim, delta);
      break;
  }
}

function transitionToPhase(anim: SelectionAnimState, phase: SelectionAnimPhase): void {
  anim.phase = phase;
  anim.phaseTime = 0;
}

function updateHopPhase(anim: SelectionAnimState, _delta: number): void {
  if (!currentConfig) return;
  const t = Math.min(anim.phaseTime / HOP_DURATION, 1);
  const eased = easeOutCubic(t);
  const card = anim.selectedCard;

  // Dismiss other cards in parallel with hop
  const axis = getScrollAxis(currentConfig.direction);
  anim.otherCards.forEach(c => {
    c.opacity = 1 - eased;
    const orig = anim.originalPositions.get(c)!;
    const sign = c.data.index < selectedIndex ? -1 : 1;
    const slideOffset = sign * DISMISS_SLIDE_DISTANCE * uiScale * eased;
    if (axis === 'y') {
      c.position = new paper.Point(orig.x, orig.y + slideOffset);
    } else {
      c.position = new paper.Point(orig.x + slideOffset, orig.y);
    }
  });
  if (fixedUI) fixedUI.opacity = 1 - eased;
  if (previewGroup) previewGroup.opacity = 0.7 * (1 - eased);

  // Position: lerp with ease-out for responsive feel
  card.position = anim.hopStart.add(
    anim.hopEnd.subtract(anim.hopStart).multiply(eased)
  );

  // Scale: parabolic arc — larger at midpoint for z-illusion
  const peakScale = Math.max(anim.hopStartScale, anim.hopEndScale) * HOP_PEAK_SCALE_MULT;
  const scale = parabolicArc(t, anim.hopStartScale, peakScale, anim.hopEndScale);
  card.scaling = new paper.Point(scale, scale);

  // Rotation: ease back to 0
  card.rotation = card.rotation * (1 - eased);

  if (t >= 1) {
    anim.otherCards.forEach(c => { c.visible = false; });
    if (previewGroup) previewGroup.visible = false;
    card.position = anim.hopEnd.clone();
    card.scaling = new paper.Point(anim.hopEndScale, anim.hopEndScale);
    card.rotation = 0;
    transitionToPhase(anim, SelectionAnimPhase.LandingSquish);
  }
}

function updateSquishPhase(anim: SelectionAnimState, _delta: number): void {
  const t = Math.min(anim.phaseTime / SQUISH_DURATION, 1);
  const card = anim.selectedCard;

  // Emit event on first frame — tile swaps in underneath the card
  if (!anim.eventEmitted) {
    anim.eventEmitted = true;
    emitter.emit(anim.eventName, { value: anim.eventValue });
    if (hiddenEdgeTileBlock) {
      showEdgeTileAtBlock(hiddenEdgeTileBlock.x, hiddenEdgeTileBlock.y);
    }
  }

  // Damped oscillation squish
  const squish = bounceDamped(t);
  const scaleX = anim.hopEndScale * (1 + SQUISH_AMPLITUDE * squish);
  const scaleY = anim.hopEndScale * (1 - SQUISH_AMPLITUDE * squish);
  card.scaling = new paper.Point(scaleX, scaleY);

  if (t >= 1) {
    card.scaling = new paper.Point(anim.hopEndScale, anim.hopEndScale);
    createParticleBurst(anim);
    transitionToPhase(anim, SelectionAnimPhase.ParticleBurst);
  }
}

function createStarPath(size: number): paper.Path {
  const points: paper.Point[] = [];
  const outerRadius = size;
  const innerRadius = size * 0.4;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    points.push(new paper.Point(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    ));
  }
  const star = new paper.Path(points);
  star.closed = true;
  return star;
}

function createParticleBurst(anim: SelectionAnimState): void {
  const center = anim.hopEnd;
  const cardRadius = anim.hopEndScale * anim.selectedCard.data.baseSize / 2;
  anim.particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
    const speed = PARTICLE_SPEED * (0.7 + Math.random() * 0.6);
    const initialScale = 0.6 + Math.random() * 0.8;
    const star = createStarPath(PARTICLE_SIZE * uiScale);
    // Spawn from card edge, not center
    star.position = center.add(new paper.Point(
      Math.cos(angle) * cardRadius,
      Math.sin(angle) * cardRadius
    ));
    star.fillColor = i % 2 === 0
      ? new paper.Color('#FFD700')
      : new paper.Color('#FFFFFF');
    selectorUI?.addChild(star);
    anim.particles.push({
      item: star,
      velocity: new paper.Point(
        Math.cos(angle) * speed * uiScale,
        Math.sin(angle) * speed * uiScale
      ),
      life: 1,
      initialScale,
      spinSpeed: (Math.random() - 0.5) * 720,
    });
  }
}

function updateParticlePhase(anim: SelectionAnimState, delta: number): void {
  const t = Math.min(anim.phaseTime / PARTICLE_DURATION, 1);
  const card = anim.selectedCard;

  // Fade the selected card out quickly
  card.opacity = Math.max(0, 1 - t * 3);

  // Update particles
  anim.particles.forEach(p => {
    p.life -= delta / PARTICLE_DURATION;
    p.item.position = p.item.position.add(p.velocity.multiply(delta));
    p.velocity = p.velocity.multiply(0.95);
    p.item.rotation += p.spinSpeed * delta;
    const easedLife = easeOutCubic(Math.max(0, p.life));
    p.item.opacity = easedLife;
    const s = p.initialScale * easedLife;
    p.item.scaling = new paper.Point(s, s);
  });

  if (t >= 1) {
    anim.particles.forEach(p => p.item.remove());
    anim.particles = [];
    card.visible = false;
    cleanupSelectorUI();
    transitionToPhase(anim, SelectionAnimPhase.SettleDelay);
  }
}

function updateSettleDelayPhase(anim: SelectionAnimState, _delta: number): void {
  if (anim.phaseTime >= SETTLE_DELAY) {
    transitionToPhase(anim, SelectionAnimPhase.ViewTransition);
  }
}

function updateViewTransitionPhase(anim: SelectionAnimState, _delta: number): void {
  // View animation is driven by startViewAnimation (called by showOptionSelector wrapper).
  // If no view animation arrives (next step is a modal), finish after a timeout.
  if (!isViewAnimating() && anim.phaseTime > 0.4) {
    finishSelectionAnimation();
  }
}

// ── Standalone tile particle bursts ──────────────────────────────────

export function spawnTileParticles(blockX: number, blockY: number): void {
  const center = new paper.Point(blockX * 16 + 8, blockY * 16 + 8);
  const scale = 1 / paper.view.zoom;
  const tileRadius = 8;
  const particles: Particle[] = [];

  layers.mapOverlayLayer.activate();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
    const speed = PARTICLE_SPEED * (0.7 + Math.random() * 0.6);
    const initialScale = 0.6 + Math.random() * 0.8;
    const star = createStarPath(PARTICLE_SIZE * scale);
    star.position = center.add(new paper.Point(
      Math.cos(angle) * tileRadius,
      Math.sin(angle) * tileRadius
    ));
    star.fillColor = i % 2 === 0
      ? new paper.Color('#FFD700')
      : new paper.Color('#FFFFFF');
    layers.mapOverlayLayer.addChild(star);
    particles.push({
      item: star,
      velocity: new paper.Point(
        Math.cos(angle) * speed * scale,
        Math.sin(angle) * speed * scale
      ),
      life: 1,
      initialScale,
      spinSpeed: (Math.random() - 0.5) * 720,
    });
  }

  const elapsed = { value: 0 };
  const handler = (event: { delta: number }) => {
    elapsed.value += event.delta;
    const t = Math.min(elapsed.value / PARTICLE_DURATION, 1);
    particles.forEach(p => {
      p.life -= event.delta / PARTICLE_DURATION;
      p.item.position = p.item.position.add(p.velocity.multiply(event.delta));
      p.velocity = p.velocity.multiply(0.95);
      p.item.rotation += p.spinSpeed * event.delta;
      const easedLife = easeOutCubic(Math.max(0, p.life));
      p.item.opacity = easedLife;
      const s = p.initialScale * easedLife;
      p.item.scaling = new paper.Point(s, s);
    });
    if (t >= 1) {
      particles.forEach(p => p.item.remove());
      paper.view.off('frame', handler);
    }
  };
  paper.view.on('frame', handler);
}



function cleanupSelectorUI(): void {
  if (selectorUI) {
    const canvas = paper.view.element;
    const data = selectorUI.data;
    if (data?.wheelHandler) canvas.removeEventListener('wheel', data.wheelHandler);
    if (data?.touchStartHandler) canvas.removeEventListener('touchstart', data.touchStartHandler);
    if (data?.touchMoveHandler) canvas.removeEventListener('touchmove', data.touchMoveHandler);
    if (data?.touchEndHandler) canvas.removeEventListener('touchend', data.touchEndHandler);
  }
  optionCards.forEach(c => c.remove());
  optionCards = [];
  if (previewGroup) { previewGroup.remove(); previewGroup = null; }
  if (tilePointer) { tilePointer.remove(); tilePointer = null; }
  if (fixedUI) { fixedUI.remove(); fixedUI = null; }
  if (resizeHandler) { emitter.off('resize', resizeHandler); resizeHandler = null; }
  fixedLabelGroup = null;
}

function finishSelectionAnimation(): void {
  if (selectorUI) { selectorUI.remove(); selectorUI = null; }
  // Edge tile was already shown in squish phase — don't restore
  hiddenEdgeTileBlock = null;
  if (frameHandler) {
    paper.view.off('frame', frameHandler);
    frameHandler = null;
  }
  if (wheelSettleTimer) { clearTimeout(wheelSettleTimer); wheelSettleTimer = null; }
  wheelGestureActive = false;
  interactionOverlay = null;
  currentConfig = null;
  selectionAnim = null;
  animationBlocked = false;
}

function computeZoomToFit(
  anchor: paper.Point,
  direction: OptionDirection,
  spacing: number
): { zoom: number; center: paper.Point } {
  // Shift center toward the card stack so cards aren't at view edge
  let centerX = anchor.x;
  let centerY = anchor.y;
  switch (direction) {
    case 'bottom':
      centerY += spacing;
      break;
    case 'left':
      centerX -= spacing;
      break;
    case 'right':
      centerX += spacing;
      break;
  }

  return computeWizardZoom(new paper.Point(centerX, centerY), SHAPE_SELECTOR_SPAN);
}

export function showOptionSelector(config: MapOptionSelectorConfig): void {
  // If selection animation is running, defer this call until view transition completes
  if (selectionAnim) {
    const target = computeZoomToFit(config.anchorPoint, config.direction, config.spacing || 12);
    startViewAnimation(target, VIEW_TRANSITION_DURATION, () => {
      finishSelectionAnimation();
      showOptionSelectorImmediate(config);
    });
    return;
  }
  showOptionSelectorImmediate(config);
}

function showOptionSelectorImmediate(config: MapOptionSelectorConfig): void {
  hideOptionSelector();

  currentConfig = config;
  cardSpacing = config.spacing || 12;
  const buttonSize = (config.buttonSize || 10) * 1.2;

  // Reset state
  optionCards = [];
  const initialIndex = config.options.length > 2 ? 1 : 0;
  selectedIndex = initialIndex;
  lastZOrderCenter = -1;
  scrollOffset = initialIndex;
  targetScrollOffset = initialIndex;
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
  previewGroup.onClick = () => {
    if (animationBlocked || !currentConfig) return;
    const centerCard = optionCards[selectedIndex];
    if (centerCard) {
      startSelectionAnimation(centerCard);
    }
  };
  selectorUI.addChild(previewGroup);

  // Pointer finger icon — tracks center card's bottom-right, layered on top of all cards
  paper.project.importSVG('static/svg/pointer.svg', {
    onLoad: (svgItem: paper.Item) => {
      svgItem.scale(6 / svgItem.bounds.width);
      svgItem.visible = false;
      tilePointer = svgItem;
      if (selectorUI) selectorUI.addChild(svgItem);
    },
    insert: false,
  });

  // Create option cards (all at same position initially, will be positioned by updateDeckPositions)
  config.options.forEach((option, index) => {
    const card = createOptionCard(option, index, buttonSize);
    card.position = config.anchorPoint;
    optionCards.push(card);
    selectorUI!.addChild(card);

    card.onMouseEnter = () => { if (isScrollSettled()) card.data.hovered = true; };
    card.onMouseLeave = () => { card.data.hovered = false; };

    // Click handler - confirm if already centered, otherwise scroll to this card
    card.onClick = () => {
      if (animationBlocked) return;
      if (index === selectedIndex && currentConfig) {
        startSelectionAnimation(card);
      } else {
        scrollToIndex(index);
      }
    };
  });

  // Zoom to fit
  zoomToFit(config.anchorPoint, config.direction, cardSpacing);

  // Calculate UI scale after zoom
  uiScale = 1 / paper.view.zoom;

  // Create fixed UI (label) on fixedLayer at bottom of screen
  layers.fixedLayer.activate();
  fixedUI = new paper.Group();
  fixedUI.applyMatrix = false;
  emitter.emit('enableWizardBackButton');

  const viewWidth = paper.view.viewSize.width;

  // Label below progress bar at top
  if (config.title) {
    const isMobile = getMobileOperatingSystem() !== 'unknown';
    const subLabelContent = isMobile
      ? i18next.t('option_swipe_confirm')
      : i18next.t('option_scroll_confirm');
    const maxLabelWidth = viewWidth - 140;
    const { group: wrappedLabel } = createWrappedLabel(config.title, subLabelContent, maxLabelWidth);

    fixedLabelGroup = wrappedLabel;
    fixedLabelGroup.position = new paper.Point(viewWidth / 2, 60);
    fixedUI.addChild(fixedLabelGroup);
  }

  // Listen for resize
  resizeHandler = () => {
    const w = paper.view.viewSize.width;
    if (fixedLabelGroup) fixedLabelGroup.position.x = w / 2;
    // Recalculate zoom for new window size
    if (currentConfig) {
      const target = computeZoomToFit(
        currentConfig.anchorPoint,
        currentConfig.direction,
        cardSpacing
      );
      paper.view.zoom = target.zoom;
      paper.view.center = target.center;
    }
  };
  emitter.on('resize', resizeHandler);

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
  frameHandler = (event: { delta: number }) => {
    if (selectionAnim) {
      updateSelectionAnimation(event.delta);
    } else {
      updateDeckPositions();
    }
    if (isViewAnimating()) {
      tickViewAnimation(event.delta);
    }
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

    if (!currentConfig || animationBlocked) return;

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
    if (event.touches.length !== 1 || animationBlocked) return;
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
  // Force-complete any in-progress animation
  if (selectionAnim) {
    selectionAnim.particles.forEach(p => p.item.remove());
    selectionAnim = null;
    animationBlocked = false;
  }
  stopViewAnimation();

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
  if (resizeHandler) {
    emitter.off('resize', resizeHandler);
    resizeHandler = null;
  }
  interactionOverlay = null;
  currentConfig = null;
  optionCards = [];
  previewGroup = null;
  fixedLabelGroup = null;
}

function zoomToFit(
  anchor: paper.Point,
  direction: OptionDirection,
  spacing: number
): void {
  const target = computeZoomToFit(anchor, direction, spacing);
  startViewAnimation(target);
}

export function isOptionSelectorVisible(): boolean {
  return selectorUI !== null && selectorUI.visible;
}

// Hide selector when wizard back button is pressed (avoids circular import with wizardProgressBar)
emitter.on('wizardBackButtonPressed', () => {
  hideOptionSelector();
});
