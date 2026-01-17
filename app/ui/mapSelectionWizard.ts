import { emitter } from '../emitter';

export type WizardStep = 'river' | 'airport' | 'peninsulaSide' | 'peninsulaPos' | 'peninsulaShape' | 'grid';

export type WizardState = {
  step: WizardStep;
  riverDirection: 'west' | 'south' | 'east' | null;
  airportPosition: number | null;
  peninsulaSide: 'left' | 'right' | null;
  peninsulaPosition: number | null;
  peninsulaShape: number | null;
};

const initialState: WizardState = {
  step: 'river',
  riverDirection: null,
  airportPosition: null,
  peninsulaSide: null,
  peninsulaPosition: null,
  peninsulaShape: null,
};

let wizardState: WizardState = { ...initialState };

// Step order for navigation
const stepOrder: WizardStep[] = ['river', 'airport', 'peninsulaSide', 'peninsulaPos', 'peninsulaShape', 'grid'];

// Steps that show modal vs map selection
export const modalSteps: WizardStep[] = ['river', 'peninsulaSide', 'grid'];
export const mapSteps: WizardStep[] = ['airport', 'peninsulaPos', 'peninsulaShape'];

export function getWizardState(): WizardState {
  return { ...wizardState };
}

export function resetWizard(): void {
  wizardState = { ...initialState };
  emitter.emit('wizardStateChanged', wizardState);
}

export function setRiverDirection(direction: 'west' | 'south' | 'east'): void {
  wizardState.riverDirection = direction;
  wizardState.step = 'airport';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setAirportPosition(position: number): void {
  wizardState.airportPosition = position;
  wizardState.step = 'peninsulaSide';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setPeninsulaSide(side: 'left' | 'right'): void {
  wizardState.peninsulaSide = side;
  wizardState.step = 'peninsulaPos';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setPeninsulaPosition(position: number): void {
  wizardState.peninsulaPosition = position;
  wizardState.step = 'peninsulaShape';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setPeninsulaShape(shape: number): void {
  wizardState.peninsulaShape = shape;
  wizardState.step = 'grid';
  emitter.emit('wizardStateChanged', wizardState);
}

export function goBack(): void {
  const currentIndex = stepOrder.indexOf(wizardState.step);
  if (currentIndex > 0) {
    const prevStep = stepOrder[currentIndex - 1];
    wizardState.step = prevStep;

    // Clear the selection for the step we're going back from
    switch (wizardState.step) {
      case 'river':
        wizardState.riverDirection = null;
        break;
      case 'airport':
        wizardState.airportPosition = null;
        break;
      case 'peninsulaSide':
        wizardState.peninsulaSide = null;
        break;
      case 'peninsulaPos':
        wizardState.peninsulaPosition = null;
        break;
      case 'peninsulaShape':
        wizardState.peninsulaShape = null;
        break;
    }

    emitter.emit('wizardStateChanged', wizardState);
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
