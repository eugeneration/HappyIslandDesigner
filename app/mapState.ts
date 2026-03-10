import { emitter } from './emitter';

export type MapVersion = 1 | 2;

type MapState = {
  version: MapVersion;
};

const mapState: MapState = {
  version: 1,  // Default to V1
};

export function getMapVersion(): MapVersion {
  return mapState.version;
}

export function isV2Map(): boolean {
  return mapState.version === 2;
}

export function setMapVersion(version: MapVersion): void {
  if (mapState.version !== version) {
    mapState.version = version;
    emitter.emit('mapVersionChanged', version);
  }
}

export function resetMapState(): void {
  mapState.version = 1;
}

export function emitMapLoaded(): void {
  emitter.emit('mapLoaded');
}
