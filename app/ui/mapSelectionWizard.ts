import { emitter } from '../emitter';

export type WizardStep = 'river' | 'riverMouth1' | 'riverMouth2' | 'airport' | 'peninsulaSide' | 'peninsulaPos' | 'peninsulaShape' | 'dockSide' | 'dockShape' | 'secretBeachPos' | 'secretBeachShape' | 'leftRockPos' | 'leftRockShape' | 'rightRockPos' | 'rightRockShape' | 'grid';

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
};

const initialState: WizardState = {
  step: 'river',
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
};

let wizardState: WizardState = { ...initialState };

// Step order for navigation
const stepOrder: WizardStep[] = ['river', 'riverMouth1', 'riverMouth2', 'airport', 'peninsulaSide', 'peninsulaPos', 'peninsulaShape', 'dockSide', 'dockShape', 'secretBeachPos', 'secretBeachShape', 'leftRockPos', 'leftRockShape', 'rightRockPos', 'rightRockShape', 'grid'];

// Steps that show modal vs map selection
export const modalSteps: WizardStep[] = ['river', 'peninsulaSide', 'dockSide', 'grid'];
export const mapSteps: WizardStep[] = ['riverMouth1', 'riverMouth2', 'airport', 'peninsulaPos', 'peninsulaShape', 'dockShape', 'secretBeachPos', 'secretBeachShape', 'leftRockPos', 'leftRockShape', 'rightRockPos', 'rightRockShape'];

export function getWizardState(): WizardState {
  return { ...wizardState };
}

export function resetWizard(): void {
  wizardState = { ...initialState };
  emitter.emit('wizardStateChanged', wizardState);
}

export function setRiverDirection(direction: 'west' | 'south' | 'east'): void {
  wizardState.riverDirection = direction;
  wizardState.step = 'riverMouth1';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setRiverMouth1Shape(shape: number): void {
  wizardState.riverMouth1Shape = shape;
  wizardState.step = 'riverMouth2';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setRiverMouth2Shape(shape: number): void {
  wizardState.riverMouth2Shape = shape;
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
  wizardState.step = 'dockSide';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setDockSide(side: 'left' | 'right'): void {
  wizardState.dockSide = side;
  wizardState.step = 'dockShape';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setDockShape(shape: number): void {
  wizardState.dockShape = shape;
  wizardState.step = 'secretBeachPos';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setSecretBeachPosition(position: number): void {
  wizardState.secretBeachPosition = position;
  wizardState.step = 'secretBeachShape';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setSecretBeachShape(shape: number): void {
  wizardState.secretBeachShape = shape;
  wizardState.step = 'leftRockPos';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setLeftRockPosition(position: number): void {
  wizardState.leftRockPosition = position;
  wizardState.step = 'leftRockShape';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setLeftRockShape(shape: number): void {
  wizardState.leftRockShape = shape;
  wizardState.step = 'rightRockPos';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setRightRockPosition(position: number): void {
  wizardState.rightRockPosition = position;
  wizardState.step = 'rightRockShape';
  emitter.emit('wizardStateChanged', wizardState);
}

export function setRightRockShape(shape: number): void {
  wizardState.rightRockShape = shape;
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
      case 'riverMouth1':
        wizardState.riverMouth1Shape = null;
        break;
      case 'riverMouth2':
        wizardState.riverMouth2Shape = null;
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
      case 'dockSide':
        wizardState.dockSide = null;
        break;
      case 'dockShape':
        wizardState.dockShape = null;
        break;
      case 'secretBeachPos':
        wizardState.secretBeachPosition = null;
        break;
      case 'secretBeachShape':
        wizardState.secretBeachShape = null;
        break;
      case 'leftRockPos':
        wizardState.leftRockPosition = null;
        break;
      case 'leftRockShape':
        wizardState.leftRockShape = null;
        break;
      case 'rightRockPos':
        wizardState.rightRockPosition = null;
        break;
      case 'rightRockShape':
        wizardState.rightRockShape = null;
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
