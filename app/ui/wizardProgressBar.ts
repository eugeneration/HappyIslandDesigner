import paper from 'paper';
import { emitter } from '../emitter';
import { colors } from '../colors';
import { layers } from '../layers';
import { stepOrder, WizardState, skipWizard } from './mapSelectionWizard';

let progressGroup: paper.Group | null = null;
let bgLine: paper.Path | null = null;
let progressLine: paper.Path | null = null;
let dots: paper.Path.Circle[] = [];
let wizardChangeHandler: ((state: WizardState) => void) | null = null;

const TOP_Y = 20;
const PAD_X = 60;
const DOT_RADIUS = 4;
const LINE_WIDTH = 2;

function getDotX(index: number, viewWidth: number): number {
  const totalSteps = stepOrder.length;
  if (totalSteps <= 1) return viewWidth / 2;
  return PAD_X + index * ((viewWidth - 2 * PAD_X) / (totalSteps - 1));
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
    new paper.Point(PAD_X, TOP_Y),
    new paper.Point(viewWidth - PAD_X, TOP_Y)
  );
  bgLine.strokeColor = colors.paper.color;
  bgLine.strokeWidth = LINE_WIDTH;
  progressGroup.addChild(bgLine);

  // Progress line (starts at zero length)
  progressLine = new paper.Path.Line(
    new paper.Point(PAD_X, TOP_Y),
    new paper.Point(PAD_X, TOP_Y)
  );
  progressLine.strokeColor = colors.level3.color;
  progressLine.strokeWidth = LINE_WIDTH;
  progressGroup.addChild(progressLine);

  // Create dots
  dots = [];
  for (let i = 0; i < stepOrder.length; i++) {
    const x = getDotX(i, viewWidth);
    const dot = new paper.Path.Circle(new paper.Point(x, TOP_Y), DOT_RADIUS);
    dot.strokeColor = colors.paper.color;
    dot.strokeWidth = 1.5;
    dot.fillColor = null;
    progressGroup.addChild(dot);
    dots.push(dot);
  }

  // Skip button at right of progress bar
  const skipText = new paper.PointText(new paper.Point(viewWidth - 30, TOP_Y + 4));
  skipText.content = 'Skip';
  skipText.justification = 'center';
  skipText.fontFamily = 'TTNorms, sans-serif';
  skipText.fontSize = 12;
  skipText.fillColor = colors.paper.color;

  const skipBg = new paper.Path.Rectangle(
    new paper.Rectangle(
      skipText.bounds.x - 8,
      skipText.bounds.y - 4,
      skipText.bounds.width + 16,
      skipText.bounds.height + 8
    ),
    new paper.Size(8, 8)
  );
  skipBg.fillColor = colors.level3.color;

  const skipButton = new paper.Group([skipBg, skipText]);
  skipButton.applyMatrix = false;
  skipButton.onClick = () => {
    skipWizard();
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

  // Listen for state changes
  wizardChangeHandler = (state: WizardState) => {
    updateWizardProgress(state.step);
  };
  emitter.on('wizardStateChanged', wizardChangeHandler);

  prevLayer.activate();
}

function updateWizardProgress(step: string): void {
  if (!progressGroup || dots.length === 0) return;

  const currentIndex = stepOrder.indexOf(step as any);
  if (currentIndex === -1) return;

  const viewWidth = paper.view.viewSize.width;

  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i];
    if (i < currentIndex) {
      // Completed
      dot.fillColor = colors.level3.color;
      dot.strokeColor = colors.level3.color;
    } else if (i === currentIndex) {
      // Current
      dot.fillColor = null;
      dot.strokeColor = colors.yellow.color;
    } else {
      // Future
      dot.fillColor = null;
      dot.strokeColor = colors.paper.color;
    }
  }

  // Update progress line to extend to current dot
  const currentX = getDotX(currentIndex, viewWidth);
  if (progressLine) {
    progressLine.segments[1].point = new paper.Point(currentX, TOP_Y);
  }
}

export function hideWizardProgress(): void {
  if (wizardChangeHandler) {
    emitter.off('wizardStateChanged', wizardChangeHandler);
    wizardChangeHandler = null;
  }
  if (progressGroup) {
    progressGroup.remove();
    progressGroup = null;
  }
  bgLine = null;
  progressLine = null;
  dots = [];
}
