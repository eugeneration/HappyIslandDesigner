import paper from 'paper';
import i18next from 'i18next';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';
import { createButton } from './createButton';
import { stepOrder, WizardState, skipWizardNonDestructive, goBack, canGoBack } from './mapSelectionWizard';

let progressGroup: paper.Group | null = null;
let bgLine: paper.Path | null = null;
let progressLine: paper.Path | null = null;
let dots: paper.Path.Circle[] = [];
let skipButton: paper.Group | null = null;
let wizardBackButton: paper.Group | null = null;
let backArrow: paper.Raster | null = null;
let wizardChangeHandler: ((state: WizardState) => void) | null = null;
let resizeHandler: (() => void) | null = null;
let disableBackHandler: (() => void) | null = null;
let enableBackHandler: (() => void) | null = null;
let currentStepIndex = 0;

const TOP_Y = 20;
const PAD_LEFT = 72;
const PAD_RIGHT = 80;
const DOT_RADIUS = 4;
const LINE_WIDTH = 2;

function getDotX(index: number, viewWidth: number): number {
  const totalSteps = stepOrder.length;
  if (totalSteps <= 1) return viewWidth / 2;
  return PAD_LEFT + index * ((viewWidth - PAD_LEFT - PAD_RIGHT) / (totalSteps - 1));
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
  if (progressLine) {
    progressLine.segments[1].point.x = getDotX(currentStepIndex, viewWidth);
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

  // Progress line (starts at zero length)
  progressLine = new paper.Path.Line(
    new paper.Point(PAD_LEFT, TOP_Y),
    new paper.Point(PAD_LEFT, TOP_Y)
  );
  progressLine.strokeColor = colors.level3.color;
  progressLine.strokeWidth = LINE_WIDTH;
  progressGroup.addChild(progressLine);

  // Create dots
  dots = [];
  for (let i = 0; i < stepOrder.length; i++) {
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
    updateWizardProgress(state.step);
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

function updateWizardProgress(step: string): void {
  if (!progressGroup || dots.length === 0) return;

  const currentIndex = stepOrder.indexOf(step as any);
  if (currentIndex === -1) return;
  currentStepIndex = currentIndex;

  const viewWidth = paper.view.viewSize.width;

  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i];
    if (i < currentIndex) {
      // Completed
      dot.fillColor = colors.level3.color;
    } else if (i === currentIndex) {
      // Current
      dot.fillColor = colors.yellow.color;
    } else {
      // Future
      dot.fillColor = colors.paper.color;
    }
  }

  // Update progress line to extend to current dot
  const currentX = getDotX(currentIndex, viewWidth);
  if (progressLine) {
    progressLine.segments[1].point = new paper.Point(currentX, TOP_Y);
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
  dots = [];
  skipButton = null;
  wizardBackButton = null;
  backArrow = null;
  currentStepIndex = 0;
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
