import i18next from 'i18next';
import { emitter } from '../emitter';
import { hideLeftMenu, showLeftMenu } from './leftMenu';
import { hideUndoMenu, showUndoMenu } from '../drawer';
import { toolState } from '../tools/state';
import { showWizardProgress, hideWizardProgress } from './wizardProgressBar';
import { confirmDestructiveActionAsync, autosaveTrigger } from '../state';
import { loadBaseMapFromSvg } from '../load';
import { initializeEdgeTiles, fillEdgeTilesWithPlaceholders, loadEdgeTilesAsGeometry } from './edgeTiles';
import { getAirportBlocks, hidePositionSelector } from './mapPositionSelector';
import { hideOptionSelector } from './mapOptionSelector';

export type WizardStep = 'entrypoint' | 'screenshot' | 'start' | 'river' | 'baseMapGrid' | 'riverMouth1' | 'riverMouth2' | 'airport' | 'peninsulaSide' | 'peninsulaPos' | 'peninsulaShape' | 'dockSide' | 'dockShape' | 'secretBeachPos' | 'secretBeachShape' | 'leftRockPos' | 'leftRockShape' | 'rightRockPos' | 'rightRockShape' | 'fillPlaceholder' | 'grid' | 'legacyriver' | 'legacygrid';

export type WizardState = {
  step: WizardStep;
  riverDirection: 'west' | 'south' | 'east' | null;
  riverMouth1Shape: number | null;
  riverMouth2Shape: number | null;
  airportPosition: number | null;
  peninsulaSide: 'left' | 'right' | null;
  peninsulaPosition: number | null;
  peninsulaShape: number | null;
  dockSide: 'left' | 'right' | null;
  dockShape: number | null;
  secretBeachPosition: number | null;
  secretBeachShape: number | null;
  leftRockPosition: number | null;
  leftRockShape: number | null;
  rightRockPosition: number | null;
  rightRockShape: number | null;
  currentPlaceholderIndex: number;
};

const initialState: WizardState = {
  step: 'start',
  riverDirection: null,
  riverMouth1Shape: null,
  riverMouth2Shape: null,
  airportPosition: null,
  peninsulaSide: null,
  peninsulaPosition: null,
  peninsulaShape: null,
  dockSide: null,
  dockShape: null,
  secretBeachPosition: null,
  secretBeachShape: null,
  leftRockPosition: null,
  leftRockShape: null,
  rightRockPosition: null,
  rightRockShape: null,
  currentPlaceholderIndex: 0,
};

let wizardState: WizardState = { ...initialState };

// Step order for navigation (new flow ends with baseMapGrid, legacy flow uses legacygrid)
export const stepOrder: WizardStep[] = ['river', 'riverMouth1', 'riverMouth2', 'airport', 'dockSide', 'dockShape', 'peninsulaSide', 'peninsulaPos', 'peninsulaShape', 'secretBeachPos', 'secretBeachShape', 'leftRockPos', 'leftRockShape', 'rightRockPos', 'rightRockShape', 'fillPlaceholder', 'baseMapGrid'];
const legacyStepOrder: WizardStep[] = ['river', 'legacyriver', 'legacygrid'];

// Steps that show modal vs map selection
export const modalSteps: WizardStep[] = ['entrypoint', 'screenshot', 'river', 'baseMapGrid', 'peninsulaSide', 'dockSide', 'grid', 'legacyriver', 'legacygrid'];
export const mapSteps: WizardStep[] = ['riverMouth1', 'riverMouth2', 'airport', 'dockShape', 'peninsulaPos', 'peninsulaShape', 'secretBeachPos', 'secretBeachShape', 'leftRockPos', 'leftRockShape', 'rightRockPos', 'rightRockShape', 'fillPlaceholder'];

export function getWizardState(): WizardState {
  return { ...wizardState };
}


function setPrevStep(): void {
  const currentIndex = stepOrder.indexOf(wizardState.step);
  if (currentIndex > 0) {
    const prevStep = stepOrder[currentIndex - 1];
    wizardState.step = prevStep;

    if (stepShouldBeSkipped(prevStep)) {
      setPrevStep();
    }
  }
}

function setNextStep(): void {
  const currentIndex = stepOrder.indexOf(wizardState.step);
  if (currentIndex != -1 && currentIndex < stepOrder.length - 1) {
    const nextStep = stepOrder[currentIndex + 1];
    wizardState.step = nextStep;

    if (stepShouldBeSkipped(nextStep)) {
      setNextStep();
    }
  }
}

function stepShouldBeSkipped(step: WizardStep): boolean {
  switch(step) {
    case 'dockSide':
      return wizardState.riverDirection != 'south' && wizardState.dockSide != null;
  }
  return false;
}

export function resetWizard(): void {
  hidePositionSelector();
  hideOptionSelector();
  wizardState = { ...initialState };
  hideWizardProgress();
  showLeftMenu();
  showUndoMenu();
  toolState.isDevModeActive = false;
  toolState.onUp();
  toolState.switchToolType('terrain');
  emitter.emit('wizardStateChanged', wizardState);
}

export async function skipWizard(): Promise<void> {
  const proceed = await confirmDestructiveActionAsync(
    'Clear your map? You will lose all unsaved changes.'
  );
  if (!proceed) return;
  hidePositionSelector();
  hideOptionSelector();
  await loadBaseMapFromSvg(0);
  initializeEdgeTiles();
  fillEdgeTilesWithPlaceholders();
  loadEdgeTilesAsGeometry();
  autosaveTrigger();
  resetWizard();
}

export function skipWizardNonDestructive(): void {
  const confirmed = confirm(i18next.t('skip_confirm'));
  if (confirmed) {
    hidePositionSelector();
    hideOptionSelector();
    loadEdgeTilesAsGeometry();
    autosaveTrigger();
    resetWizard();
  }
}

export function startWizard(): void {
  wizardState.step = 'entrypoint';
  emitter.emit('wizardStateChanged', wizardState);
}

function enterWizardMode(): void {
  hideLeftMenu();
  hideUndoMenu();
  toolState.isDevModeActive = true;
  toolState.onUp();
  showWizardProgress();
}

export function goToTileEditorFlow(): void {
  enterWizardMode();
  wizardState.step = 'river';
  emitter.emit('wizardStateChanged', wizardState);
}

export function goToScreenshotFlow(): void {
  enterWizardMode();
  wizardState.step = 'screenshot';
  emitter.emit('wizardStateChanged', wizardState);
}

export function goToEntrypoint(): void {
  wizardState.step = 'entrypoint';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setRiverDirection(direction: 'west' | 'south' | 'east'): void {
  wizardState.riverDirection = direction;

  if (direction == 'west')
    wizardState.dockSide = 'right';
  else if (direction == 'east')
    wizardState.dockSide = 'left';

  // Continue to edge tile flow
  setNextStep();

  emitter.emit('wizardStateChanged', wizardState);
}

export function setRiverMouth1Shape(shape: number): void {
  wizardState.riverMouth1Shape = shape;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setRiverMouth2Shape(shape: number): void {
  wizardState.riverMouth2Shape = shape;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setAirportPosition(position: number): void {
  wizardState.airportPosition = position;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setDockSide(side: 'left' | 'right'): void {
  wizardState.dockSide = side;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setDockShape(shape: number): void {
  wizardState.dockShape = shape;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setPeninsulaSide(side: 'left' | 'right'): void {
  wizardState.peninsulaSide = side;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setPeninsulaPosition(position: number): void {
  wizardState.peninsulaPosition = position;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setPeninsulaShape(shape: number): void {
  wizardState.peninsulaShape = shape;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setSecretBeachPosition(position: number): void {
  wizardState.secretBeachPosition = position;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setSecretBeachShape(shape: number): void {
  wizardState.secretBeachShape = shape;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setLeftRockPosition(position: number): void {
  wizardState.leftRockPosition = position;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setLeftRockShape(shape: number): void {
  wizardState.leftRockShape = shape;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setRightRockPosition(position: number): void {
  wizardState.rightRockPosition = position;
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function setRightRockShape(shape: number): void {
  wizardState.rightRockShape = shape;
  setNextStep();
  wizardState.currentPlaceholderIndex = 0;
  emitter.emit('wizardStateChanged', wizardState);
}

export function advanceToNextPlaceholder(): void {
  // Increment to track how many placeholders we've filled (used by goBack)
  // Note: we always use index 0 for accessing getRemainingPlaceholders() since it
  // returns only remaining items, but we track the count for goBack logic
  wizardState.currentPlaceholderIndex++;
  emitter.emit('wizardStateChanged', wizardState);
}

export function finishPlaceholders(): void {
  setNextStep();
  emitter.emit('wizardStateChanged', wizardState);
}

export function goToLegacyRiverSelection(): void {
  wizardState.step = 'legacyriver';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setLegacyRiverDirection(direction: 'west' | 'south' | 'east'): void {
  wizardState.riverDirection = direction;
  wizardState.step = 'legacygrid';
  emitter.emit('wizardStateChanged', wizardState);
}

export function goBack(): void {
  const currentIndex = stepOrder.indexOf(wizardState.step);

  if (currentIndex > 0) {
    setPrevStep();

    // Clear the selection for the step we're going back to, and restore tiles if needed
    switch (wizardState.step) {
      case 'river':
        wizardState.riverDirection = null;
        break;
      case 'riverMouth1':
        wizardState.riverMouth1Shape = null;
        break;
      case 'riverMouth2':
        wizardState.riverMouth2Shape = null;
        break;
      case 'airport':
        // Restore both airport tiles before clearing position
        if (wizardState.riverDirection !== null && wizardState.airportPosition !== null) {
          const airportBlocks = getAirportBlocks(
            wizardState.riverDirection as 'west' | 'south' | 'east',
            wizardState.airportPosition
          );
          for (const block of airportBlocks) {
            emitter.emit('restoreTile', { x: block.x, y: block.y });
          }
        }
        wizardState.airportPosition = null;
        break;
      case 'dockSide':
        wizardState.dockSide = null;
        break;
      case 'dockShape':
        // Restore the dock tile before clearing shape
        if (wizardState.dockSide !== null) {
          const blockX = wizardState.dockSide === 'left' ? 0 : 6;
          emitter.emit('restoreTile', { x: blockX, y: 5 });
        }
        wizardState.dockShape = null;
        break;
      case 'peninsulaSide':
        wizardState.peninsulaSide = null;
        break;
      case 'peninsulaPos':
        // Restore the peninsula placeholder tile before clearing position
        if (wizardState.peninsulaSide !== null && wizardState.peninsulaPosition !== null) {
          const blockX = wizardState.peninsulaSide === 'left' ? 0 : 6;
          const blockY = wizardState.peninsulaPosition + 1;
          emitter.emit('restoreTile', { x: blockX, y: blockY });
        }
        wizardState.peninsulaPosition = null;
        break;
      case 'peninsulaShape':
        // Restore the peninsula tile before clearing shape
        if (wizardState.peninsulaSide !== null && wizardState.peninsulaPosition !== null) {
          const blockX = wizardState.peninsulaSide === 'left' ? 0 : 6;
          const blockY = wizardState.peninsulaPosition + 1;
          emitter.emit('restoreTile', { x: blockX, y: blockY });
        }
        wizardState.peninsulaShape = null;
        break;
      case 'secretBeachPos':
        // Restore the secret beach placeholder tile before clearing position
        if (wizardState.riverDirection !== null && wizardState.secretBeachPosition !== null) {
          let columns: number[];
          switch (wizardState.riverDirection) {
            case 'west': columns = [3, 4, 5]; break;
            case 'south': columns = [2, 3, 4]; break;
            case 'east': columns = [1, 2, 3]; break;
          }
          const blockX = columns[wizardState.secretBeachPosition];
          emitter.emit('restoreTile', { x: blockX, y: 0 });
        }
        wizardState.secretBeachPosition = null;
        break;
      case 'secretBeachShape':
        // Restore the secret beach tile before clearing shape
        if (wizardState.riverDirection !== null && wizardState.secretBeachPosition !== null) {
          let columns: number[];
          switch (wizardState.riverDirection) {
            case 'west': columns = [3, 4, 5]; break;
            case 'south': columns = [2, 3, 4]; break;
            case 'east': columns = [1, 2, 3]; break;
          }
          const blockX = columns[wizardState.secretBeachPosition];
          emitter.emit('restoreTile', { x: blockX, y: 0 });
        }
        wizardState.secretBeachShape = null;
        break;
      case 'leftRockPos':
        wizardState.leftRockPosition = null;
        break;
      case 'leftRockShape':
        // Restore the left rock tile before clearing shape
        if (wizardState.leftRockPosition !== null) {
          const blockY = wizardState.leftRockPosition + 1;
          emitter.emit('restoreTile', { x: 0, y: blockY });
        }
        wizardState.leftRockShape = null;
        break;
      case 'rightRockPos':
        wizardState.rightRockPosition = null;
        break;
      case 'rightRockShape':
        // Restore the right rock tile before clearing shape
        if (wizardState.rightRockPosition !== null) {
          const blockY = wizardState.rightRockPosition + 1;
          emitter.emit('restoreTile', { x: 6, y: blockY });
        }
        wizardState.rightRockShape = null;
        break;
      case 'fillPlaceholder':
        // For fillPlaceholder, if we're past the first placeholder, go back to previous placeholder
        // Otherwise we've already moved to the previous step (rightRockShape)
        if (wizardState.currentPlaceholderIndex > 0) {
          // Restore the most recently filled placeholder tile
          emitter.emit('restoreFilledPlaceholder');
          wizardState.currentPlaceholderIndex--;
          // Stay on fillPlaceholder step, just with decremented index
          wizardState.step = 'fillPlaceholder';
        }
        break;
    }

    emitter.emit('wizardStateChanged', wizardState);
  }
  else {
    const currentLegacyIndex = legacyStepOrder.indexOf(wizardState.step);
    if (currentLegacyIndex > 0) {
      const prevStep = legacyStepOrder[currentLegacyIndex - 1];
      wizardState.step = prevStep;

      switch (wizardState.step) {
        case 'legacyriver':
          break;
        case 'legacygrid':
          wizardState.riverDirection = null;
          break;
      }
      emitter.emit('wizardStateChanged', wizardState);
    }
  }
}

export function isModalStep(step: WizardStep): boolean {
  return modalSteps.includes(step);
}

export function isMapStep(step: WizardStep): boolean {
  return mapSteps.includes(step);
}

export function canGoBack(): boolean {
  return stepOrder.indexOf(wizardState.step) > 0;
}

/**
 * Dev tool: auto-complete the island wizard flow up to the grid step,
 * selecting the first option at every choice.
 * Uses river direction 'west'.
 */
export function autoCompleteToGrid(): void {
  // Reset wizard state
  wizardState = { ...initialState };

  // Emit so ModalMapSelect picks up the state, then do tile replacements
  // We use a slight delay so the blank map loads first
  wizardState.step = 'baseMapGrid';
  emitter.emit('autoIslandFlow', wizardState);
}
