// @ts-nocheck
import paper from 'paper';
import LZString from 'lz-string';
import i18next from 'i18next';
import steg from './vendors/steganography';

import { state } from './state';
import { downloadDataURL, downloadDataURLForiOSSafari } from './helpers/download';
import { layers } from './layers';
import { colors } from './colors';
import { getGridRaster } from './grid';
import { getMobileOperatingSystem } from "./helpers/getMobileOperatingSystem";

import { encodeMapV1, decodeMapV1, encodeObjectGroups, encodeDrawing } from './save-legacy';
import { getEdgeAssetIndices, isEdgeTilesVisible } from './ui/edgeTiles';
import { trackMapSave, trackMapComplexity, computeMapComplexity } from './analytics';
import { getMapVersion } from './mapState';
import { hasSeenNux, markNuxSeen } from './ui/nuxTooltip';

export function encodeMap() {
  // V1 map if no edge tiles are present
  if (!isEdgeTilesVisible()) {
    return encodeMapV1();
  }

  // V2 format with edge tiles
  const objects = encodeObjectGroups(state.objects);
  const drawing = encodeDrawing(state.drawing);
  const edgeTileNumbers = getEdgeAssetIndices();

  const o = {
    version: 'v2',
    objects,
    drawing,
    edgeTiles: edgeTileNumbers,  // Array of 24 numbers in CCW order
  };
  if (Object.keys(o.objects).length === 0) {
    delete o.objects;
  }
  return JSON.stringify(o);
}

export function decodeMap(json) {
  if (json == null) return;

  // Check version to determine which decoder to use
  if (json.version === 'v2') {
    return decodeMapV2(json);
  }

  // todo: v1 map should clear edge tiles and v2 specific features

  // V1 or legacy format
  return decodeMapV1(json);
}

function decodeMapV2(json) {
  // Decode V1 data (objects, drawing) using legacy decoder
  const result = decodeMapV1({
    version: 1,
    objects: json.objects,
    drawing: json.drawing,
  });

  // todo: clean up implementation, add error checking
  // Load edge tiles from array
  result.version = 2;
  if (json.edgeTiles) {
    result.edgeTiles = json.edgeTiles;
  }

  return result;
}

export function autosaveMap() {
  if (localStorage) {
    localStorage.setItem('autosave', encodeMap());
    state.actionsSinceSave = 0;
    return true;
  }
  console.log('Cannot autosave: your browser does not support local storage.');
  return false;
}

export function autosaveMapRaw(jsonString: string) {
  if (localStorage) {
    localStorage.setItem('autosave', jsonString);
    state.actionsSinceSave = 0;
    return true;
  }
  return false;
}

// @ts-ignore
window.clearAutosave = clearAutosave;
export function clearAutosave() {
  if (localStorage) {
    localStorage.removeItem('autosave');
  }
}

const SAVE_TUTORIAL_NUX_ID = 'save_tutorial';
let pendingSaveTutorial = false;

export function showPendingSaveTutorial(): void {
  if (pendingSaveTutorial) {
    pendingSaveTutorial = false;
    showSaveTutorial();
  }
}

function showSaveTutorial(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.4)',
      zIndex: '10000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: '0',
      transition: 'opacity 0.3s ease',
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      background: '#fffbf0',
      borderRadius: '24px',
      padding: '28px 32px',
      maxWidth: '480px',
      minWidth: '300px',
      width: '80vw',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      fontFamily: 'TTNorms, sans-serif',
      textAlign: 'center',
    });

    const img = document.createElement('img');
    img.src = 'static/img/tutorial-saving.png';
    Object.assign(img.style, {
      width: '100%',
      maxWidth: '420px',
      aspectRatio: '1082 / 439',
      marginBottom: '16px',
      borderRadius: '12px',
    });

    const title = document.createElement('div');
    title.textContent = i18next.t('save_tutorial_title');
    Object.assign(title.style, {
      fontSize: '18px',
      fontWeight: '700',
      color: '#3d3d3d',
      marginBottom: '14px',
    });

    const desc = document.createElement('div');
    Object.assign(desc.style, {
      fontSize: '14px',
      lineHeight: '1.5',
      color: '#555',
      marginBottom: '20px',
    });
    const descText = document.createTextNode(i18next.t('save_tutorial_description') + ' ');
    const warning = document.createElement('span');
    warning.textContent = i18next.t('save_tutorial_warning');
    Object.assign(warning.style, {
      fontWeight: '700',
      color: '#1976D2',
    });
    desc.appendChild(descText);
    desc.appendChild(warning);

    const btn = document.createElement('button');
    btn.textContent = i18next.t('save_tutorial_ok');
    Object.assign(btn.style, {
      background: 'rgba(66, 187, 243, 0.9)',
      color: '#fff',
      border: 'none',
      borderRadius: '20px',
      padding: '8px 32px',
      fontSize: '15px',
      fontWeight: '700',
      fontFamily: 'TTNorms, sans-serif',
      cursor: 'pointer',
    });

    const dismiss = () => {
      markNuxSeen(SAVE_TUTORIAL_NUX_ID);
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 300);
    };

    btn.addEventListener('click', dismiss);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) dismiss();
    });

    modal.appendChild(img);
    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(btn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });
  });
}

export function saveMapToFile() {
  let mapJson = encodeMap();
  const jsonSizeBytes = mapJson.length;
  mapJson = LZString.compressToUTF16(mapJson);

  const saveMargins = new paper.Size(10, 10);

  layers.uiLayer.activate();
  const mapRaster = layers.mapLayer.rasterize();
  const mapPositionDelta = layers.mapLayer.globalToLocal(
    layers.mapLayer.bounds.topLeft,
  );

  const mapEdgeRaster = layers.mapEdgeLayer.rasterize();
  const mapEdgePositionDelta = layers.mapEdgeLayer.globalToLocal(
    layers.mapEdgeLayer.bounds.topLeft,
  );

  const iconsRaster = layers.mapIconLayer.rasterize();
  const iconsPositionDelta = layers.mapIconLayer.globalToLocal(
    layers.mapIconLayer.bounds.topLeft,
  );

  const gridRaster = getGridRaster();

  const gridClone = gridRaster.clone();

  const mapBounds = gridRaster.bounds.clone();
  mapBounds.size = mapBounds.size.add(saveMargins);
  mapBounds.point = mapBounds.point.subtract(saveMargins.divide(2).height);
  const mapBoundsClippingMask = new paper.Path.Rectangle(mapBounds);

  const background = mapBoundsClippingMask.clone();
  background.fillColor = colors.water.color;

  mapBoundsClippingMask.clipMask = true;

  const text = new paper.PointText(
    mapBounds.bottomRight.subtract(new paper.Point(2, 2)),
  );
  text.justification = 'right';
  text.content = 'made at eugeneration.github.io/HappyIslandDesigner';
  text.fontFamily = 'TTNorms, sans-serif';
  text.fillColor = colors.oceanDark.color;
  text.strokeWidth = 0;
  text.fontSize = 2;
  text.selected = true;

  let v2Text: paper.PointText | undefined;
  if (getMapVersion() === 2) {
    v2Text = new paper.PointText(
      mapBounds.bottomLeft.subtract(new paper.Point(-2, 2)),
    );
    v2Text.justification = 'left';
    v2Text.content = 'v2';
    v2Text.fontFamily = 'TTNorms, sans-serif';
    v2Text.fillColor = colors.oceanDark.color;
    v2Text.strokeWidth = 0;
    v2Text.fontSize = 2;
    v2Text.selected = true;
  }

  const group = new paper.Group();
  group.clipped = true;

  group.addChildren([
    mapBoundsClippingMask,
    background,
    mapRaster,
    mapEdgeRaster,
    iconsRaster,
    gridClone,
    text,
  ]);
  if (v2Text) {
    group.addChild(v2Text);
  }

  // the raster doesn't scale for some reason, so manually scale it;
  mapRaster.scaling = mapRaster.scaling.divide(layers.mapLayer.scaling);
  mapRaster.bounds.topLeft = mapPositionDelta;

  mapEdgeRaster.scaling = mapEdgeRaster.scaling.divide(layers.mapLayer.scaling);
  mapEdgeRaster.bounds.topLeft = mapEdgePositionDelta;
  
  iconsRaster.scaling = iconsRaster.scaling.divide(layers.mapLayer.scaling);
  iconsRaster.bounds.topLeft = iconsPositionDelta;

  const combinedImage = group.rasterize(708.5);
  combinedImage.position.x += 200;
  combinedImage.remove();
  group.remove();

  const mapRasterSize = combinedImage.size;
  let mapRasterData = combinedImage.toDataURL();

  const shadowCanvas = document.createElement('canvas');
  // const shadowCtx = shadowCanvas.getContext('2d');
  shadowCanvas.style.display = 'none';
  const image = new Image();
  image.src = mapRasterData;

  const os = getMobileOperatingSystem();
  const isSafari = navigator.vendor && navigator.vendor.indexOf('Apple') > -1 &&
    navigator.userAgent &&
    navigator.userAgent.indexOf('CriOS') == -1 &&
    navigator.userAgent.indexOf('FxiOS') == -1;
  let w;
  if (os == "iOS" && !isSafari) {
    w = window.open('about:blank');
  }

  image.addEventListener(
    'load',
    () => {
      mapRasterData = steg.encode(mapJson, mapRasterData, {
        height: mapRasterSize.height,
        width: mapRasterSize.width,
      });

      const filename = `HappyIslandDesigner_${Date.now()}.png`;

      if (os == "iOS") {
        if (isSafari) {
          downloadDataURLForiOSSafari(filename, mapRasterData)
        } else {
          image.src = mapRasterData;
          image.addEventListener(
            'load',
            () => {
              w?.document.write(image.outerHTML);
            },
            false,
          );
        }
      } else {
        downloadDataURL(filename, mapRasterData);
      }
      const ver = getMapVersion();
      trackMapSave(ver);
      trackMapComplexity(ver, computeMapComplexity(state.drawing, state.objects), jsonSizeBytes);

      if (!hasSeenNux(SAVE_TUTORIAL_NUX_ID)) {
        pendingSaveTutorial = true;
      }
    },
    false,
  );

  autosaveMap();
}
