import paper from 'paper';
import { clearMap, setNewMapData, autosaveTrigger, addToHistory } from './state';
import { decodeMap } from './save';
import steg from './vendors/steganography';
import LZString from 'lz-string';
import { showLoadingScreen } from "./ui/loadingScreen";
import { OpenMapSelectModal } from './components/ModalMapSelect';
import { deleteEdgeTiles } from './ui/edgeTiles';
import { emitMapLoaded } from './mapState';
import { addPath } from './paint';
import { getBaseMapSrc } from './generatedBaseMapCache';
import { layers } from './layers';
import { colors } from './colors';

// todo - this file should be merged with save.ts, then optionally split into different modules
// right now, very similar logic is split between two files which makes no sense

function clickElem(elem) {
  // Thx user1601638 on Stack Overflow (6/6/2018 - https://stackoverflow.com/questions/13405129/javascript-create-and-save-file )
  const eventMouse = document.createEvent('MouseEvents');
  eventMouse.initMouseEvent(
    'click',
    true,
    false,
    window,
    0,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    0,
    null,
  );
  elem.dispatchEvent(eventMouse);
}

export function tryLoadAutosaveMap() {
  document.cookie = '';
  if (localStorage) {
    const autosave = localStorage.getItem('autosave');
    if (autosave !== null) {
      deleteEdgeTiles();
      clearMap();
      setNewMapData(decodeMap(JSON.parse(autosave)));
      emitMapLoaded();
      return true;
    }
  }
  // open the new map modal
  OpenMapSelectModal();
  return false;
}

// @ts-ignore
window.loadMap = loadMapFromJSONString;

export function loadMapFromJSONString(mapJSONString: string) {
  let json;
  try {
    json = JSON.parse(mapJSONString);
  } catch (err) {
    try {
      json = JSON.parse(LZString.decompressFromUTF16(mapJSONString))
    } catch (e) {
      json = JSON.parse(LZString.decompress(mapJSONString))
    }
  }

  deleteEdgeTiles();
  clearMap();
  const map = decodeMap(json);
  setNewMapData(map);
  autosaveTrigger();
  emitMapLoaded();
}

export function loadMapFromFile() {
  loadImage((image) => {
    const mapJSONString = steg.decode(image.src, {
      height: image.height,
      width: image.width,
    });
    loadMapFromJSONString(mapJSONString);
  });
}

export function loadImage(onLoad) {
  const readFile = function (eventRead) {
    const file = eventRead.target.files[0];
    if (!file) {
      return;
    }
    if (file.type == "image/heic") { // convert to png
      // this takes a long time, so show loading screen
      showLoadingScreen(true);
      import("heic2any").then(heic2anyModule => {
        const heic2any = heic2anyModule.default;
        heic2any({blob: file })
          .then(function(conversionResult) {
            showLoadingScreen(false);
            const blob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
            const url = URL.createObjectURL(blob);
            loadDataURLAsImage(url);
          })
          .catch(function(e) {
            showLoadingScreen(false);
            console.error(e);
          });
      });
    } else {
      blobToDataURL(file, loadDataURLAsImage);
    }

    function loadDataURLAsImage (dataURL) {
      const image = new Image();
      image.src = dataURL;
      image.addEventListener('load', function() {onLoad(image)}, false);
    }
  }
  loadFile(readFile);
}

export function loadFile(onLoad) {
  const fileInput = document.createElement('input');
  document.body.appendChild(fileInput);
  fileInput.type = 'file';
  fileInput.accept="image/*";
  fileInput.style.display = 'none';
  fileInput.onchange = (event) => {
    onLoad(event);
    fileInput.remove();
  }
  clickElem(fileInput);
}

function blobToDataURL(blob, callback) {
  const a = new FileReader();
  a.onload = function(e) {callback(e.target?.result);}
  a.readAsDataURL(blob);
}

type BaseMapLayers = {
  level2: paper.Path[],
  level3: paper.Path[],
  river: paper.Path[],
}

// Color to layer mapping
const LAYER_COLORS: Record<string, keyof BaseMapLayers> = {
  '#35a043': 'level2',
  '#4ac34e': 'level3',
  '#83e1c3': 'river',
};

// Extract layer data from SVG content, creating Paper.js paths directly
function extractLayers(svgContent: string): BaseMapLayers {
  const result: BaseMapLayers = { level2: [], level3: [], river: [] };

  // Match path elements - extract full path tag then parse attributes
  const pathRegex = /<path([^>]*)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(svgContent)) !== null) {
    const attrs = match[1];

    // Extract fill and d attributes
    const fillMatch = attrs.match(/fill="([^"]+)"/);
    const dMatch = attrs.match(/d="([^"]+)"/);

    if (fillMatch && dMatch) {
      const fill = fillMatch[1];
      const d = dMatch[1];
      const layerKey = LAYER_COLORS[fill];
      if (layerKey) {
        // Create Paper.js path directly from SVG path data
        const path = new paper.Path(d);
        path.closed = true;
        result[layerKey].push(path);
      }
    }
  }

  return result;
}

// Load base map terrain from SVG file
// Index 0 or cache miss: just clear terrain and fill level1 with green rectangle
export async function loadBaseMapFromSvg(mapNumber: number): Promise<void> {
  const svgPath = getBaseMapSrc(mapNumber);

  layers.mapLayer.activate();

  // Clear existing terrain first
  clearMap();

  // Create level1 rectangle covering island extents
  const level1Rect = new paper.Path.Rectangle({
    from: new paper.Point(0, 0),
    to: new paper.Point(112, 96),
  });
  level1Rect.fillColor = colors.level1.color;
  addPath(true, level1Rect as paper.Path, 'level1');

  // If no SVG path (index 0 or cache miss), just have the level1 rectangle
  if (!svgPath) {
    console.log(`Base map ${mapNumber} not found - using blank terrain`);
    addToHistory({ type: 'draw', data: {} });
    return;
  }

  console.log(`Loading base map ${mapNumber}: ${svgPath}`);

  // Fetch SVG content
  const response = await fetch(svgPath);
  const svgContent = await response.text();

  // Extract layers as Paper.js paths directly
  const layerPaths = extractLayers(svgContent);

  // Color key mapping from layer to terrain colors
  const layerMapping: { key: keyof BaseMapLayers; colorKey: string }[] = [
    { key: 'level2', colorKey: 'level2' },
    { key: 'level3', colorKey: 'level3' },
    { key: 'river', colorKey: 'water' },
  ];

  // Add paths to terrain
  for (const { key, colorKey } of layerMapping) {
    const paths = layerPaths[key];
    if (paths.length === 0) continue;

    // Create compound path if multiple polygons, otherwise use single path
    let pathItem: paper.PathItem;
    if (paths.length === 1) {
      pathItem = paths[0];
    } else {
      pathItem = new paper.CompoundPath({
        children: paths,
      });
    }

    // Add to terrain
    addPath(true, pathItem as paper.Path, colorKey);
  }

  // Add to history for undo
  addToHistory({ type: 'draw', data: {} });

  console.log(`Loaded base map ${mapNumber} as terrain`);
}
