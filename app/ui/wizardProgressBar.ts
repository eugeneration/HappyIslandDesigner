import paper from 'paper';
import i18next from 'i18next';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';
import { createButton } from './createButton';
import { WizardStep, WizardState, skipWizardNonDestructive, goBack, canGoBack } from './mapSelectionWizard';

type Milestone = {
  steps: WizardStep[];
  weight: number;
};

const milestones: Milestone[] = [
  { steps: ['river', 'riverMouth1', 'riverMouth2'], weight: 1 },
  { steps: ['airport'], weight: 1 },
  { steps: ['dockSide', 'dockShape'], weight: 1 },
  { steps: ['peninsulaSide', 'peninsulaPos', 'peninsulaShape'], weight: 1 },
  { steps: ['secretBeachPos', 'secretBeachShape'], weight: 1 },
  { steps: ['leftRockPos', 'leftRockShape'], weight: 1 },
  { steps: ['rightRockPos', 'rightRockShape'], weight: 1 },
  { steps: ['fillPlaceholder'], weight: 3 },
  { steps: ['baseMapGrid'], weight: 1 },
];

// Total number of dots = milestones + 1 final dot
const NUM_DOTS = milestones.length + 1;

let progressGroup: paper.Group | null = null;
let bgLine: paper.Path | null = null;
let progressLine: paper.Path | null = null;
let subProgressLine: paper.Path | null = null;
let dots: paper.Path.Circle[] = [];
let skipButton: paper.Group | null = null;
let wizardBackButton: paper.Group | null = null;
let backArrow: paper.Raster | null = null;
let wizardChangeHandler: ((state: WizardState) => void) | null = null;
let resizeHandler: (() => void) | null = null;
let disableBackHandler: (() => void) | null = null;
let enableBackHandler: (() => void) | null = null;
let lastState: WizardState | null = null;

const TOP_Y = 20;
const PAD_LEFT = 72;
const PAD_RIGHT = 80;
const DOT_RADIUS = 4;
const LINE_WIDTH = 2;

const totalWeight = milestones.reduce((sum, m) => sum + m.weight, 0);

// Dots are at milestone boundaries. Index 0..milestones.length-1 are milestone start dots,
// index milestones.length is the final dot at the end.
function getDotX(index: number, viewWidth: number): number {
  let cumWeight = 0;
  for (let i = 0; i < index && i < milestones.length; i++) {
    cumWeight += milestones[i].weight;
  }
  if (index >= milestones.length) cumWeight = totalWeight;
  return PAD_LEFT + cumWeight * ((viewWidth - PAD_LEFT - PAD_RIGHT) / totalWeight);
}

function findMilestone(step: WizardStep): { milestoneIndex: number; subStepIndex: number } | null {
  for (let i = 0; i < milestones.length; i++) {
    const subIndex = milestones[i].steps.indexOf(step);
    if (subIndex !== -1) {
      return { milestoneIndex: i, subStepIndex: subIndex };
    }
  }
  return null;
}

function getSubProgressX(state: WizardState, viewWidth: number): number | null {
  const found = findMilestone(state.step as WizardStep);
  if (!found) return null;

  const { milestoneIndex, subStepIndex } = found;
  const milestone = milestones[milestoneIndex];
  const dotX = getDotX(milestoneIndex, viewWidth);
  const nextDotX = getDotX(milestoneIndex + 1, viewWidth);

  // For fillPlaceholder, use placeholder count for sub-progress
  if (state.step === 'fillPlaceholder') {
    if (state.totalPlaceholders > 0) {
      const fraction = state.currentPlaceholderIndex / state.totalPlaceholders;
      if (fraction > 0) return dotX + fraction * (nextDotX - dotX);
    }
    return null;
  }

  // If dockSide was skipped (west/east river), don't show sub-progress for dockShape
  if (state.step === 'dockShape' && state.riverDirection !== 'south') return null;

  // For normal milestones, sub-progress based on sub-step index
  if (subStepIndex === 0) return null;
  const fraction = subStepIndex / milestone.steps.length;
  return dotX + fraction * (nextDotX - dotX);
}

function repositionProgressBar(): void {
  if (!progressGroup) return;
  const viewWidth = paper.view.viewSize.width;

  if (bgLine) {
    bgLine.segments[1].point.x = viewWidth - PAD_RIGHT;
  }
  for (let i = 0; i < dots.length; i++) {
    dots[i].position.x = getDotX(i, viewWidth);
  }
  if (lastState) {
    const found = findMilestone(lastState.step as WizardStep);
    if (found && progressLine) {
      progressLine.segments[1].point.x = getDotX(found.milestoneIndex, viewWidth);
    }
    if (subProgressLine) {
      const subX = lastState ? getSubProgressX(lastState, viewWidth) : null;
      if (subX !== null) {
        const milestoneX = found ? getDotX(found.milestoneIndex, viewWidth) : PAD_LEFT;
        subProgressLine.segments[0].point.x = milestoneX;
        subProgressLine.segments[1].point.x = subX;
        subProgressLine.visible = true;
      } else {
        subProgressLine.visible = false;
      }
    }
  }
  if (skipButton) {
    skipButton.position.x = viewWidth - 16 - skipButton.bounds.width / 2;
  }
}

export function showWizardProgress(): void {
  if (progressGroup) return;

  const prevLayer = paper.project.activeLayer;
  layers.fixedLayer.activate();

  const viewWidth = paper.view.viewSize.width;

  progressGroup = new paper.Group();
  progressGroup.applyMatrix = false;

  // Background line (full width)
  bgLine = new paper.Path.Line(
    new paper.Point(PAD_LEFT, TOP_Y),
    new paper.Point(viewWidth - PAD_RIGHT, TOP_Y)
  );
  bgLine.strokeColor = colors.paper.color;
  bgLine.strokeWidth = LINE_WIDTH;
  progressGroup.addChild(bgLine);

  // Completed progress line (dark, extends to current milestone dot)
  progressLine = new paper.Path.Line(
    new paper.Point(PAD_LEFT, TOP_Y),
    new paper.Point(PAD_LEFT, TOP_Y)
  );
  progressLine.strokeColor = colors.level3.color;
  progressLine.strokeWidth = LINE_WIDTH;
  progressGroup.addChild(progressLine);

  // Sub-progress line (yellow, extends from milestone dot to sub-progress point)
  subProgressLine = new paper.Path.Line(
    new paper.Point(PAD_LEFT, TOP_Y),
    new paper.Point(PAD_LEFT, TOP_Y)
  );
  subProgressLine.strokeColor = colors.yellow.color;
  subProgressLine.strokeWidth = LINE_WIDTH;
  subProgressLine.visible = false;
  progressGroup.addChild(subProgressLine);

  // Create dots (one per milestone + final dot)
  dots = [];
  for (let i = 0; i < NUM_DOTS; i++) {
    const x = getDotX(i, viewWidth);
    const dot = new paper.Path.Circle(new paper.Point(x, TOP_Y), DOT_RADIUS);
    dot.fillColor = colors.paper.color;
    progressGroup.addChild(dot);
    dots.push(dot);
  }

  // Skip button at right of progress bar
  const skipText = new paper.PointText(new paper.Point(viewWidth - 16, TOP_Y + 4));
  skipText.content = i18next.t('wizard_skip');
  skipText.justification = 'right';
  skipText.fontFamily = 'TTNorms, sans-serif';
  skipText.fontSize = 12;
  skipText.fillColor = colors.text.color;

  const skipBg = new paper.Path.Rectangle(
    new paper.Rectangle(
      skipText.bounds.x - 8,
      skipText.bounds.y - 4,
      skipText.bounds.width + 16,
      skipText.bounds.height + 8
    ),
    new paper.Size(8, 8)
  );
  skipBg.fillColor = colors.paper.color;

  skipButton = new paper.Group([skipBg, skipText]);
  skipButton.applyMatrix = false;
  skipButton.onClick = () => {
    skipWizardNonDestructive();
  };
  skipButton.onMouseEnter = () => {
    skipBg.opacity = 0.8;
    paper.view.element.style.cursor = 'pointer';
  };
  skipButton.onMouseLeave = () => {
    skipBg.opacity = 1;
    paper.view.element.style.cursor = '';
  };
  progressGroup.addChild(skipButton);

  // Back button at top-left
  backArrow = new paper.Raster('static/img/back.png');
  backArrow.scale(0.09);

  const backBg = new paper.Path.Circle(new paper.Point(0, 0), 4);
  backBg.fillColor = colors.paper.color;

  wizardBackButton = createButton(backBg, 5, () => {
    emitter.emit('wizardBackButtonPressed');
    goBack();
  }, {
    highlightedColor: colors.yellow.color,
    selectedColor: colors.yellow.color,
  });
  wizardBackButton.addChild(backArrow);
  wizardBackButton.scaling = new paper.Point(5, 5);
  wizardBackButton.position = new paper.Point(30, 30);
  progressGroup.addChild(wizardBackButton);

  // Disabled initially (first step, canGoBack() = false)
  wizardBackButton.data.disable(true);
  backArrow.opacity = 0.5;

  // Listen for state changes
  wizardChangeHandler = (state: WizardState) => {
    updateWizardProgress(state);
  };
  emitter.on('wizardStateChanged', wizardChangeHandler);

  // Listen for resize
  resizeHandler = repositionProgressBar;
  emitter.on('resize', resizeHandler);

  // Listen for back button enable/disable from selectors (avoids circular imports)
  disableBackHandler = () => disableWizardBackButton();
  enableBackHandler = () => enableWizardBackButton();
  emitter.on('disableWizardBackButton', disableBackHandler);
  emitter.on('enableWizardBackButton', enableBackHandler);

  prevLayer.activate();
}

function updateWizardProgress(state: WizardState): void {
  if (!progressGroup || dots.length === 0) return;

  const found = findMilestone(state.step as WizardStep);
  if (!found) return;

  lastState = { ...state };
  const { milestoneIndex } = found;
  const viewWidth = paper.view.viewSize.width;

  // Color dots based on milestone progress
  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i];
    if (i < milestoneIndex) {
      dot.fillColor = colors.level3.color; // Completed
    } else if (i === milestoneIndex) {
      dot.fillColor = colors.yellow.color; // Current
    } else {
      dot.fillColor = colors.paper.color; // Future
    }
  }

  // Completed progress line extends to current milestone's dot
  if (progressLine) {
    const milestoneX = getDotX(milestoneIndex, viewWidth);
    progressLine.segments[1].point = new paper.Point(milestoneX, TOP_Y);
  }

  // Yellow sub-progress line for in-progress milestone
  if (subProgressLine) {
    const subX = getSubProgressX(state, viewWidth);
    if (subX !== null) {
      const milestoneX = getDotX(milestoneIndex, viewWidth);
      subProgressLine.segments[0].point = new paper.Point(milestoneX, TOP_Y);
      subProgressLine.segments[1].point = new paper.Point(subX, TOP_Y);
      subProgressLine.visible = true;
    } else {
      subProgressLine.visible = false;
    }
  }

  // Sync back button state
  if (wizardBackButton && backArrow) {
    const canBack = canGoBack();
    wizardBackButton.data.disable(!canBack);
    backArrow.opacity = canBack ? 1 : 0.5;
  }
}

export function hideWizardProgress(): void {
  if (wizardChangeHandler) {
    emitter.off('wizardStateChanged', wizardChangeHandler);
    wizardChangeHandler = null;
  }
  if (resizeHandler) {
    emitter.off('resize', resizeHandler);
    resizeHandler = null;
  }
  if (disableBackHandler) {
    emitter.off('disableWizardBackButton', disableBackHandler);
    disableBackHandler = null;
  }
  if (enableBackHandler) {
    emitter.off('enableWizardBackButton', enableBackHandler);
    enableBackHandler = null;
  }
  if (progressGroup) {
    progressGroup.remove();
    progressGroup = null;
  }
  bgLine = null;
  progressLine = null;
  subProgressLine = null;
  dots = [];
  skipButton = null;
  wizardBackButton = null;
  backArrow = null;
  lastState = null;
}

function disableWizardBackButton(): void {
  if (wizardBackButton) {
    wizardBackButton.data.disable(true);
    if (backArrow) backArrow.opacity = 0.5;
  }
}

function enableWizardBackButton(): void {
  if (wizardBackButton && canGoBack()) {
    wizardBackButton.data.disable(false);
    if (backArrow) backArrow.opacity = 1;
  }
}
