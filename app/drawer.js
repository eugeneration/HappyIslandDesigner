var backgroundLayer = project.activeLayer;
var mapLayer = new Layer();
var mapIconLayer = new Layer();
var mapOverlayLayer = new Layer();
var uiLayer = new Layer();
var fixedLayer = new Layer();
backgroundLayer.applyMatrix = false;
fixedLayer.applyMatrix = false;

mapLayer.applyMatrix = false;
mapLayer.pivot = new Point(0, 0);
mapIconLayer.applyMatrix = false;
mapIconLayer.pivot = new Point(0, 0);
mapOverlayLayer.applyMatrix = false;
mapOverlayLayer.pivot = new Point(0, 0);

var colors = {
  eraser: '#f1b2c1', // this is not actually drawn - just erases
  water: '#7cd5c4',
  sand: '#f0e5a6',
  level1: '#42753e',
  level2: '#4ca14e',
  level3: '#62c360',
  rock: '#717488',
  human: '#F078B0',
  npc: '#FABD25',
  selected: '#EA822F',
  pin: '#E85A31',
  paper: '#fefae4',
}

// load assets
var svgPath = 'svg/'
var imgPath = 'img/'
var treePrefix = 'tree-';
var toolPrefix = 'tool-';
var numSvgToLoad = 0;
var numSvgLoaded = 0;
function OnLoaded() {
  numSvgLoaded++;
  if (numSvgToLoad == numSvgLoaded) {
    // all done loading
  }
}

var domParser = new DOMParser;
var loadSvg = function(filename, itemCallback) {
  numSvgToLoad++;
  project.importSVG(svgPath + filename + '.svg', 
    {
      onLoad: function(item, svg) {
        item.remove();
        item.position = new Point(0, 0);
        itemCallback(item);
        OnLoaded();
      }
    });
};

function createMenu(items) {
  var i = 0;
  var iconMenu = new Group();
  var buttonMap = objectMap(items, function(item, name) {
    item.position = new Point(80, 20 + 50 * i);
    iconMenu.addChild(item);
    i++;
    return item;
  });
  iconMenu.data = {
    buttonMap: buttonMap,
    update: function(selectedButton) {
      Object.keys(buttonMap).forEach(function(name) {
        buttonMap[name].data.select(name == selectedButton);
      });
    },
  };
  return iconMenu;
}

function createIconMenu(categoryDefinition, definitions) {
  fixedLayer.activate();
  return createMenu(
    objectMap(definitions, function(def, name) {
      var icon = def.icon.clone();
      icon.scaling = def.menuScaling;
      return createButton(icon, 20, function(button) {
        toolState.switchTool(toolState.toolMapValue(categoryDefinition, def, {}));
      });
    })
  );
}

function encodeObject(object) {
  return {
    position: [object.position.x, object.position.y],
    id: object.data.id,
    category: object.data.category,
    type: object.data.type,
    color: object.data.color,
  };
}

function decodeObject(encodedData) {
  var position = new Point(encodedData.position);
  var objectData = {
    id: encodedData.id,
    category: encodedData.category,
    type: encodedData.type,
    color: encodedData.color,
  };
  applyCommand(objectCreateCommand(objectData, position), true);
}

function getObjectData(objectDefinition) {
  return {
    id: Date.now(),
    category: objectDefinition.category,
    type: objectDefinition.type,
    color: objectDefinition.color,
  };
}

function createObjectAsync(objectData, callback) {
  toolCategoryDefinition[objectData.category].tools.getAsyncValue(
    function(tools) {
      callback(createObject(tools[objectData.type], objectData));
    });
}

function createObject(objectDefinition, itemData) {
  mapIconLayer.activate();
  var item = objectDefinition.icon.clone({insert: false});

  item.scaling = objectDefinition.scaling;
  item.pivot = item.bounds.bottomCenter;
  item.pivot += objectDefinition.offset;
  item.position = new Point(0, 0);
  item.fillColor = itemData.color;

  var group = new Group();

  var bound = new Path.Rectangle(new Rectangle(item.position, objectDefinition.size), .15);
  bound.strokeColor = 'white';
  bound.strokeColor.alpha = 0;
  bound.strokeWidth = 0.15;
  bound.fillColor = colors.selected;
  bound.fillColor.alpha = 0.0001;
  group.addChildren([item, bound]);
  group.pivot = bound.bounds.topLeft;

  group.data = itemData;

  group.onMouseEnter = function(event) {
    bound.strokeColor.alpha = 1;
  }
  group.onMouseLeave = function(event) {
    bound.strokeColor.alpha = 0;
  }
  group.onMouseDown = function(event) {
    var coordinate = mapOverlayLayer.globalToLocal(event.point);
    group.data.prevPosition = group.position;
    group.data.clickPivot = coordinate - group.pivot;
    grabObject(coordinate, group);
  }
  group.onMouseDrag = function(event) {
    var coordinate = mapOverlayLayer.globalToLocal(event.point);
    group.position = (coordinate - group.data.clickPivot).round();
    dragObject(coordinate, group);
  }
  group.onMouseUp = function(event) {
    var prevPosition = group.data.prevPosition;
    if (!prevPosition) return;

    var coordinate = mapOverlayLayer.globalToLocal(event.point);
    delete group.data.prevPosition;
    delete group.data.clickPivot;
    if (prevPosition == coordinate.position);
    dropObject(coordinate, group, prevPosition);
  }

  return group;
}

mapLayer.activate();

// ===============================================
// GLOBAL FUNCTIONS

function onResize(event) {
  // Whenever the window is resized, recenter the path:
  resizeCoordinates();
  drawBackground();
  updateColorTools();
}

tool.minDistance = 1;

var prevViewMatrix = view.matrix.clone();
fixedLayer.activate();
function onFrame() {
  if (!view.matrix.equals(prevViewMatrix)) {
    var inverted = view.matrix.inverted();
    backgroundLayer.matrix = inverted;
    fixedLayer.matrix = inverted;
    prevViewMatrix = view.matrix.clone();
  }
  //fixedLayer.pivot = new Point(0, 0);
 // fixedLayer.position = view.viewSize.topLeft;
  //var inverseZoom = 1 / view.zoom;
  
  //fixedLayer.scaling = new Point(inverseZoom, inverseZoom);
}
mapLayer.activate();

// ===============================================
// BACKGROUND

 backgroundLayer.activate();
var backgroundRect = new Path();
backgroundRect.fillColor = colors.water;
backgroundRect.onMouseEnter = function(event) {
  toolState.focusOnCanvas(true);
}
backgroundRect.onMouseLeave = function(event) {
  toolState.focusOnCanvas(false);
}

onMouseDown = function onMouseDown(event) {
  toolState.onDown(true);
  if (toolState.toolIsActive)
    toolState.activeTool.definition.onMouseDown(event);
}
onMouseMove = function onMouseMove(event) {
  if (toolState.toolIsActive)
    toolState.activeTool.definition.onMouseMove(event);
}
onMouseDrag = function onMouseDrag(event) {
  if (toolState.toolIsActive)
    toolState.activeTool.definition.onMouseDrag(event);
}
onMouseUp = function onMouseUp(event) {
  toolState.onDown(false);
  if (toolState.toolIsActive)
    toolState.activeTool.definition.onMouseUp(event);
}

function drawBackground() {
  backgroundRect.segments = [
    new Point(0, 0),
    new Point(view.size.width, 0),
    new Point(view.size.width, view.size.height),
    new Point(0, view.size.height),
  ];
  mapLayer.activate();
}

// ===============================================
// MAIN UI
window.addEventListener("beforeunload", function (e) {
  if (actionsSinceSave == 0) {
      return undefined;
  }

  var confirmationMessage = 'It looks like you have been editing something. '
                          + 'If you leave before saving, your changes will be lost.';
  (e || window.event).returnValue = confirmationMessage; //Gecko + IE
  return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
});

function downloadText(filename, text) {
  downloadDataURL(filename, 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
}

function downloadDataURL(filename, data) {
  var element = document.createElement('a');
  element.setAttribute('href', data);
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function autosaveMap() {
  if(localStorage) {
    localStorage.setItem("autosave", encodeMap());
    actionsSinceSave = 0;
    return true;
  } else {
    console.log("Cannot autosave: your browser does not support local storage.");
    return false;
  }
}
function tryLoadAutosaveMap() {
  document.cookie = '';
  if(localStorage) {
    var autosave = localStorage.getItem("autosave");
    if (autosave != null) {
      clearMap();
      setNewMapData(decodeMap(JSON.parse(autosave)));
      return true;
    }
  }
  return false;
}
function clearAutosave() {
  if(localStorage) {
    localStorage.removeItem("autosave");
  }
}

function saveMapToFile() {
  var mapJson = encodeMap();

  var saveMargins = new Point(8, 8);

  uiLayer.activate();
  var mapRaster = mapLayer.rasterize();
  var mapPositionDelta = mapLayer.globalToLocal(mapLayer.bounds.topLeft);

  var iconsRaster = mapIconLayer.rasterize();
  var iconsPositionDelta = mapIconLayer.globalToLocal(mapIconLayer.bounds.topLeft);

  var gridClone = gridRaster.clone();

  var mapBounds = gridRaster.bounds.clone();
  mapBounds.size += saveMargins;
  mapBounds.point -= saveMargins / 2;
  var mapBoundsClippingMask = new Path.Rectangle(mapBounds);

  var background = mapBoundsClippingMask.clone();
  background.fillColor = colors.water;

  mapBoundsClippingMask.clipMask = true;

  var text = new PointText(mapBounds.bottomRight - new Point(2, 2));
  text.justification = 'right';
  text.content = "made at eugeneration.github.io/HappyIslandDesigner";
  text.fontFamily = 'Fredoka One';
  text.fillColor = '#c3f6fb'
  text.strokeWidth = 0;
  text.fontSize = 2;
  text.selected = true;

  var group = new Group();
  group.clipped = true;

  group.addChildren([mapBoundsClippingMask, background, mapRaster, iconsRaster, gridClone, text]);

  // the raster doesn't scale for some reason, so manually scale it;
  mapRaster.scaling /= mapLayer.scaling;
  mapRaster.bounds.topLeft = mapPositionDelta;

  iconsRaster.scaling /= mapLayer.scaling;
  iconsRaster.bounds.topLeft = iconsPositionDelta;

  var combinedImage = group.rasterize(708.5);
  combinedImage.position.x += 200;
  combinedImage.remove();
  group.remove();

  var mapRasterSize = combinedImage.size;
  var mapRasterData = combinedImage.toDataURL();

  var shadowCanvas = document.createElement('canvas'),
    shadowCtx = shadowCanvas.getContext('2d');
  shadowCanvas.style.display = 'none';
  var image = new Image();
  image.src = mapRasterData;
  image.addEventListener('load',
    function() {
      mapRasterData = steg.encode(mapJson, mapRasterData, {
        height: mapRasterSize.height,
        width: mapRasterSize.width,
      });

      var filename = "HappyIslandDesigner_" + Date.now() + ".png";
      downloadDataURL(filename, mapRasterData);
    }
    , false);

  autosaveMap();
  return;
}

function loadMapFromFile() {
  readFile = function(e) {
    var file = e.target.files[0];
    if (!file) {
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      var dataURL = e.target.result;

      var image = new Image();
      image.src = dataURL;
      image.addEventListener('load',
        function() {
          var mapJSONString = steg.decode(dataURL, {
            height: image.height,
            width: image.width,
          });
          clearMap();
          var map = decodeMap(JSON.parse(mapJSONString));
          setNewMapData(map);
        }, false);
    }
    reader.readAsDataURL(file);
  }
  fileInput = document.createElement("input");
  fileInput.type='file';
  fileInput.style.display='none';
  fileInput.onchange=readFile;
  clickElem(fileInput);
}

function clickElem(elem) {
  // Thx user1601638 on Stack Overflow (6/6/2018 - https://stackoverflow.com/questions/13405129/javascript-create-and-save-file )
  var eventMouse = document.createEvent("MouseEvents")
  eventMouse.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
  elem.dispatchEvent(eventMouse)
}

// ===============================================
// UI ELEMENTS

function createButton(item, buttonSize, onClick) {
  var group = new Group();

  var button = new Path.Circle(0, 0, buttonSize);
  button.fillColor = colors.sand;
  button.fillColor.alpha = 0.0001;

  group.applyMatrix = false;
  group.addChildren([button, item]);

  group.data = {
    selected: false,
    hovered: false,
    select: function(isSelected) {
      group.data.selected = isSelected;
      button.fillColor = isSelected ? colors.npc : colors.sand;
      button.fillColor.alpha = isSelected ? 1 : 0.0001;
    },
    hover: function(isHover) {
      group.data.hovered = isHover;
      button.fillColor.alpha = isHover || group.data.selected ? 1 : 0.0001;
    }
  }
  group.onMouseEnter = function(event) {
    group.data.hover(true);
  }
  group.onMouseLeave = function(event) {
    group.data.hover(false);
  }
  group.onMouseDown = function(event) {
    onClick(group);
  }
  return group;
}


// ===============================================
// TOOLS

fixedLayer.activate();

//var menuButton = new Path();
//menuButton.strokeColor = colors.selected;
////menuButton.strokeColor *= 0.9;
//menuButton.strokeWidth = 120;
//menuButton.strokeCap = 'round';
//menuButton.segments = [
//  new Point(-20, 0),
//  new Point(0, 0),
//];


var mainMenu = new Path();
var saveButton = new Path.Circle(120, 50, 30);
saveButton.fillColor = colors.paper;
saveButton.onMouseDown = function() {
  saveMapToFile();
};

var loadButton = new Path.Circle(200, 50, 30);
loadButton.fillColor = colors.paper;
loadButton.onMouseDown = function() {
  loadMapFromFile();
};

var newButton = new Path.Circle(280, 50, 30);
newButton.fillColor = colors.paper;
newButton.onMouseDown = function() {
  var r = confirm("Clear your map? You will lose all unsaved changes.");
  if (r == true) {
    loadTemplate();
  } else { }
};

var leftToolMenu = new Path();
leftToolMenu.strokeColor = colors.paper;
leftToolMenu.strokeWidth = 120;
leftToolMenu.strokeCap = 'round';
leftToolMenu.segments = [
  new Point(0, 120),
  new Point(0, 400),
];

var leftToolMenuPosition = new Point(30, 120);
var leftToolMenuIconHeight = 50;

function addToLeftToolMenu(icon) {
  icon.position = leftToolMenuPosition;
  leftToolMenuPosition.y += leftToolMenuIconHeight;
}


// =======================================
// TOOLS

// =======================================
// STRUCTURE TOOL
var asyncObjectDefinition = {
  loadedCount: 0,
  targetCount: function() {return Object.keys(this.value).length;},
  onLoad: function() {
    this.loadedCount++;
    if (this.loadedCount == this.targetCount()) {
      this.loadingCallbacks.forEach(
        function(callback) { callback(this.value); }.bind(this));
      this.loadingCallbacks = [];
    }
  },
  loadingCallbacks: [],
  getAsyncValue: function(callback) {
    if (this.loadedCount == this.targetCount()) {
      callback(this.value);
      return true; // returns whether the value was returned immediately
    } else {
      this.loadingCallbacks.push(callback);
      return false;
    }
  },
};
var asyncStructureDefinition = Object.create(asyncObjectDefinition);
asyncStructureDefinition.value = {
  tentRound: {},
  tentTriangle: {},
  tentTrapezoid: {},
  hut: {},
  house: {},
  building: {},
  lighthouse: {},
  bush: {},
  fruit: {},
  palm: {},
  pine: {},
}
// set up the definitions programatically because they are all the same
Object.keys(asyncStructureDefinition.value).forEach(function(structureType) {
  var def = asyncStructureDefinition.value[structureType];
  def.category = 'structures';
  def.type = structureType;

  if (structureType == 'bush'
    || structureType == 'fruit'
    || structureType == 'palm'
    || structureType == 'pine') {
    var isBush = structureType == 'bush';
    def.color = colors.level3;
    def.scaling = new Point(.03, .03);
    def.menuScaling = new Point(.6, .6);
    def.size = new Size([isBush ? 1 : 2, 1]);
    def.offset = isBush ? new Point( -0.5, -1) : new Point(-1, -.75);
    def.onSelect = function(isSelected) {};
    // imnmediately load the assets
    loadSvg('tree-' + structureType, function(item) {
      //item.pivot += new Point(-2, -3.6);
      def.icon = item;
      asyncStructureDefinition.onLoad();
    });
  } else {
    def.color = colors.human;
    def.scaling = new Point(.03, .03);
    def.menuScaling = new Point(.3, .3);
    def.size = new Size(4, 4);
    def.offset = new Point(-2, -3.6);
    def.onSelect = function(isSelected) {};
    // imnmediately load the assets
    loadSvg('structure-' + structureType, function(item) {
      //item.pivot += new Point(-2, -3.6);
      def.icon = item;
      asyncStructureDefinition.onLoad();
    });
  }
});

var asyncTreeDefinition = Object.create(asyncObjectDefinition);
asyncTreeDefinition.value = {
  
}

// =======================================
// BASE LEVEL TOOLS

var baseToolCategoryDefinition = {
  onSelect: function(subclass, isSelected) {
    subclass.icon.data.select(isSelected);
    this.openMenu(subclass, isSelected);
  },
  onMouseMove: function(subclass, event) {
    updateCoordinateLabel(event);
  },
  onMouseDown: function(subclass, event) {
    updateCoordinateLabel(event);
  },
  onMouseDrag: function(subclass, event) {
    updateCoordinateLabel(event);
  },
  onMouseUp: function(subclass, event) {
  },
  onKeyDown: function(subclass, event) {
    console.log('base onKeyDown');
  },
  openMenu: function(subclass, isSelected) {
    if (subclass.openMenu) {
      if (!isSelected) {
        if (this.iconMenu)
          this.iconMenu.remove();
      }
      else {
        subclass.openMenu(isSelected);
      }
    }
  },
  updateTool: function(subclass, prevToolData, nextToolData) {
    var sameToolType = prevToolData && (prevToolData.definition.type === nextToolData.definition.type);
    if (!sameToolType) {
      if (prevToolData) {
        prevToolData.definition.onSelect(false);
      }
      nextToolData.definition.onSelect(true);
    }
    {
      var prevTool = (prevToolData && prevToolData.tool) ? prevToolData.tool.type : null;
      var nextTool = (nextToolData && nextToolData.tool) ? nextToolData.tool.type : null;
      var sameTool = sameToolType && prevTool === nextTool;
      if (!sameTool) {
        if (prevToolData && prevToolData.tool && prevToolData.tool.onSelect)
          prevToolData.tool.onSelect(false);
        if (nextToolData && nextToolData.tool && nextToolData.tool.onSelect)
          nextToolData.tool.onSelect(true);
        // todo: decouple view from logic
        if (this.iconMenu) {
          this.iconMenu.data.update(nextTool);
        }
      }
    }
  },
}
var toolCategoryDefinition = {
  pointer: {
    base: baseToolCategoryDefinition,
    type: 'pointer',
    layer: mapIconLayer,
    icon: "pointer",
    tools: {},
    defaultTool: null,
    modifiers: {},
    defaultModifiers: {

    },
    onSelect: function(isSelected) {
      this.base.onSelect(this, isSelected);
    },
    onMouseMove: function(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDown: function(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDrag: function(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseUp: function(event) {
      this.base.onMouseMove(this, event);
    },
    onKeyDown: function(event) {console.log('pointer onKeyDown')},
  },
  terrain: {
    base: baseToolCategoryDefinition,
    type: 'terrain',
    layer: mapLayer,
    icon: "color",
    tools: {},
    defaultTool: null,
    modifiers: {},
    defaultModifiers: {

    },
    onSelect: function(isSelected) {
      this.base.onSelect(this, isSelected);
    },
    onMouseMove: function(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDown: function(event) {
      this.base.onMouseMove(this, event);
      startDraw(event);
    },
    onMouseDrag: function(event) {
      this.base.onMouseMove(this, event);
      draw(event);
    },
    onMouseUp: function(event) {
      this.base.onMouseMove(this, event);
      endDraw(event);
    },
    onKeyDown: function(event) {console.log('terrain onKeyDown')},
  },
  structures: {
    base: baseToolCategoryDefinition,
    type: 'structures',
    layer: mapIconLayer,
    icon: "structure",
    tools: asyncStructureDefinition,
    defaultTool: null,
    modifiers: {},
    defaultModifiers: {

    },
    onSelect: function(isSelected) {
      this.base.onSelect(this, isSelected);
    },
    onMouseMove: function(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDown: function(event) {
      placeObject(event);
      this.base.onMouseMove(this, event);
    },
    onMouseDrag: function(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseUp: function(event) {
      this.base.onMouseMove(this, event);
    },
    onKeyDown: function(event) {console.log('structures onKeyDown')},
    openMenu: function(isSelected) {
      this.tools.getAsyncValue(function(definitions) {
        this.base.iconMenu = createIconMenu(this, definitions);
        // this is a little messy
        if (toolState.activeTool && toolState.activeTool.tool) {
          this.base.iconMenu.data.update(toolState.activeTool.tool.type);
        }
      }.bind(this));
    },
  },
  path: {
    base: baseToolCategoryDefinition,
    type: 'path',
    layer: mapLayer,
    icon: "path",
    tools: {},
    defaultTool: null,
    modifiers: {},
    defaultModifiers: {

    },
    onSelect: function(isSelected) {
      this.base.onSelect(this, isSelected);
    },
    onMouseMove: function(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDown: function(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDrag: function(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseUp: function(event) {
      this.base.onMouseMove(this, event);
    },
    onKeyDown: function(event) {
    },
    openMenu: function(isSelected) {
      if (!isSelected) {
        if (this.iconMenu)
          this.iconMenu.remove();
      }
      else {
        this.tools.getAsyncValue(function(definitions) {
          this.iconMenu = createIconMenu(this, definitions);

          // this is a little messy
          if (toolState.activeTool && toolState.activeTool.tool) {
            this.iconMenu.data.update(toolState.activeTool.tool.type);
          }
        }.bind(this));
      }
    },
  },
//  shovel: {

//},
//  sprite: {
//    type: 'sprite',
//    targetLayers: [mapIconLayer],
//  },
};
// add additional sub functions to all definitions
Object.keys(toolCategoryDefinition).forEach(function(toolType) {
  var def = toolCategoryDefinition[toolType];
  def.updateTool = function(prevToolData, nextToolData) {
    def.base.updateTool(def, prevToolData, nextToolData);
  };
});

// Todo: make state use a Listener paradigm rather than triggering method calls
var toolState = {
  activeTool: null,
  toolMap: {},
  
  isCanvasFocused: false,
  toolIsActive: false,
  isDown: false,
  toolMapValue: function(definition, tool, modifiers) {
    return {
      type: definition.type,
      definition: definition,
      tool: tool,
      modifiers: modifiers,
    };
  },
  defaultToolMapValue: function(toolType) {
    var def = toolCategoryDefinition[toolType];
    return this.toolMapValue(def, def.defaultTool, def.defaultModifiers);
  },
  switchToolType: function(toolType) {
    if (!this.toolMap.hasOwnProperty(toolType)) {
      this.switchTool(this.defaultToolMapValue(toolType));
    } else {
      this.switchTool(this.toolMap[toolType]);
    }
  },
  switchTool: function(toolData) {
    var prevTool = this.activeTool;
    this.activeTool = toolData;
    this.toolMap[toolData.type] = toolData;
    if (prevTool) prevTool.definition.updateTool(prevTool, toolData);
    else if (toolData) toolData.definition.updateTool(prevTool, toolData);
  },
  onDown: function(isDown) {
    this.isDown = isDown;
    if (!this.isDown) {
      this.toolIsActive = this.isCanvasFocused;
    }
  },
  focusOnCanvas: function(isFocused) {
    this.isCanvasFocused = isFocused;
    if (!this.isDown) {
      this.toolIsActive = this.isCanvasFocused;
    }
  }
};

//function squircle (size){ // squircle=square+circle
//  var hsize = size / 2; // half size
//  
//  var squircle = new Path();
//
//  squircle.add(
//    new Segment(new Point(0,0), new Point(0,0), new Point(0,hsize)),
//    new Segment(new Point(0,size), new Point(0,size), new Point(hsize,size)),
//    new Segment(new Point(size,size), new Point(size,size), new Point(size,hsize)),
//    new Segment(new Point(size,0), new Point(size,0), new Point(hsize,0))
//  );
//  squircle.closed = true;
//
//  return squircle;
//}
//fixedLayer.activate();
//var box = squircle(100);
//box.fillColor = colors.npc;
//box.position = new Point(300, 300);
//box.selected = true;
//
//var d = new Path.Rectangle(300, 300, 10, 10);
//d.fillColor = colors.npc;


//var activeToolIndicator = new Path.Rectangle(0, 100, 5, 40);
//var activeToolIndicator = new Path.Circle(30, 120, 20);
//activeToolIndicator.fillColor = colors.npc;

Object.keys(toolCategoryDefinition).forEach(function(toolType) {
  var def = toolCategoryDefinition[toolType];
  var tool = new Raster(imgPath + toolPrefix + def.icon + '.png');

  var button = createButton(tool, 20, function() {toolState.switchToolType(toolType)});
  switch (def.icon) {
    case 'color':
      tool.position = new Point(-8, 0);
      break;
  }
  tool.scaling = new Point(.4, .4);
  
  addToLeftToolMenu(button);
  def.icon = button;
});

// add gap
leftToolMenuPosition.y += 60;

var activeColor = new Path.Circle([20, 20], 16);
activeColor.fillColor = paintColor;
addToLeftToolMenu(activeColor);


function updateColorTools() {
  activeColor
}

function onUpdateColor() {
  activeColor.fillColor = paintColor;
}

var paintColor = colors.level1;

fixedLayer.activate();

var toolsPosition = new Point(40, 80);


function initializeApp() {
  toolState.switchToolType(toolCategoryDefinition.terrain.type);
}
initializeApp();

//var pointerToolButton = new Raster('../img/pointer.png');
//pointerToolButton.position = toolsPosition + new Point(0, 0);
//pointerToolButton.scaling = new Point(0.2, 0.2);

function onKeyDown(event) {
  var shift = Key.isDown('shift');
  var control = Key.isDown('control') || Key.isDown('meta');

  var prevActiveTool = toolState.activeTool;
  switch (event.key) {
    case '0':
      paintColor = colors.eraser;
      break;
    case '1':
      paintColor = colors.water;
      break;
    case '2':
      paintColor = colors.sand;
      break;
    case '3':
      paintColor = colors.level1;
      break;
    case '4':
      paintColor = colors.level2;
      break;
    case '5':
      paintColor = colors.level3;
      break;
    case '6':
      paintColor = colors.rock;
      break;
/*    case 'q':
      changePaintTool(paintTools.grid);
      break;
    case 'w':
      changePaintTool(paintTools.diagonals);
      break;
    case 'e':
      changePaintTool(paintTools.freeform);
      break;*/
    case 's':
      if (control) {
        saveMapToFile();
        event.preventDefault();
      }
      break;
    case 'o':
      if (control) {
        loadMapFromFile();
        event.preventDefault();
      }
      break;
    case '[':
      brushSize = Math.max(brushSize - 1, 1);
      updateBrush();
      break;
    case ']':
      brushSize = Math.max(brushSize + 1, 1);
      updateBrush();
      break;
    case 'p':
      cycleBrushHead();
      updateBrush();
      break;
    case 'v':
      toolState.switchToolType(toolCategoryDefinition.pointer.type);
      break;
    case 'b':
      toolState.switchToolType(toolCategoryDefinition.terrain.type);
      break;
    case 'n':
      toolState.switchToolType(toolCategoryDefinition.structures.type);
      break;
    case 'm':
      toolState.switchToolType(toolCategoryDefinition.path.type);
      break;
    case '\\':
      toggleGrid();
      break;
    case '/':
      console.log(encodeMap());
      break;
    case 'z':
      if (control && shift) {
        redo();
      }
      else if (control) {
        undo();
      }
      break;
    case 'y':
      if (control) {
        redo();
        event.preventDefault();
      }
      break;
  }
  if (prevActiveTool == toolState.activeTool) {
    toolState.activeTool.definition.onKeyDown(event);
  }
  onUpdateColor();
};

function removeFloatingPointError(f) {
  return (Math.abs(f - Math.round(f)) < 0.00001) ? Math.round(f) : f;
}
function encodePoint(p) {
  return [removeFloatingPointError(p.x), removeFloatingPointError(p.y)];
}

function encodeMap() {
  var o = {
    objects: objectMap(state.objects, function(object) {
      return encodeObject(object);
    }),
    drawing: objectMap(state.drawing, function(pathItem) {
      var p;
      if (pathItem.children) {
        p = pathItem.children.map(function(path) {
          return path._segments.map(function(s) {
            return encodePoint(s._point);
          })
        });
      } else {
        p = pathItem.segments.map(function(s) {
          return encodePoint(s._point);
        });
      }
      return p;
    }),
  }
  return JSON.stringify(o);
}

function decodeMap(json) {
  mapLayer.activate();
  return {
    drawing: objectMap(json.drawing, function(colorData, color) {
      // if array of arrays, make compound path
      var p;
      if (typeof colorData[0][0] == 'number') {
        // normal path
        p = new Path(colorData.map(function(p) {return new Point(p);}));
      } else {
        p = new CompoundPath({
          children: colorData.map(function(pathData) {
            return new Path(pathData.map(function(p) {return new Point(p);}));
          }),
        });
      }
      p.locked = true;
      p.fillColor = color;
      return p;
    }),
    objects: objectMap(json.objects, function(encodedData) {
      return decodeObject(encodedData);
    }),
  };
}

// ===============================================
// PATH DRAWING

var paintTools = {
  grid: 'grid',
  diagonals: 'diagonals',
  freeform: 'freeform',
};
var paintTool = paintTools.grid;

// Create a new path once, when the script is executed:
var myPath;

function startDraw(event) {
  switch (paintTool) {
    case paintTools.grid:
      startDrawGrid(event.point);
      break;
    case paintTools.diagonals:
      break;
    case paintTools.freeform:
      myPath = new Path();
      myPath.strokeColor = paintColor;
      myPath.strokeWidth = 10;
      break;
  }
}

function draw(event) {
  switch (paintTool) {
    case paintTools.grid:
      drawGrid(event.point);
      break;
    case paintTools.diagonals:
      break;
    case paintTools.freeform:
      // Add a segment to the path at the position of the mouse:
      myPath.add(event.point);
      myPath.smooth({
        type: 'catmull-rom'
      });
      break;
  }
}

function endDraw(event) {
  switch (paintTool) {
    case paintTools.grid:
      endDrawGrid(event.point);
      break;
    case paintTools.diagonals:
      break;
    case paintTools.freeform:
      break;
  }
}

function changePaintTool(newPaintTool) {
  paintTool = newPaintTool;
}

function placeObject(event) {
  var rawCoordinate = mapOverlayLayer.globalToLocal(event.point);
  var coordinate = rawCoordinate.floor();
  if (toolState.activeTool && toolState.activeTool.tool) {
    var objectData = getObjectData(toolState.activeTool.tool);
    var command = objectCreateCommand(objectData, coordinate);
    applyCommand(command, true);
    addToHistory(command);
  }
}

function deleteObject(event, object) {
  var command = objectDeleteCommand(object.data, object.position);
  applyCommand(command, true);
  addToHistory(command);
}

function applyCreateObject(isCreate, createCommand) {
  if (isCreate) {
    createObjectAsync(createCommand.data, function(object) {
      object.position = createCommand.position;
      // immediately grab the structure with the start position of creation
      state.objects[object.data.id] = object;
    });
  } else {
    var id = createCommand.data.id;
    var object = state.objects[id];
    object.remove();
    delete state.objects[id];
  }
}

function updateObjectColor(object, color) {

}

function grabObject(coordinate, object) {
  
}

function dragObject(coordinate, object) {
}

function dropObject(coordinate, object, prevPos) {
  addToHistory(objectPositionCommand(object.data.id, prevPos, object.position));
}

function applyMoveCommand(isApply, moveCommand) {
  state.objects[moveCommand.id].position = isApply ? moveCommand.position : moveCommand.prevPosition;
}

// ===============================================
// PIXEL FITTING
// TODO: have a way to convert back to the original path
// - save the original strokes, the pixelation is basically a filter on top
function fitToPixels() {

}


// ===============================================
// SHAPE DRAWING

// Draw a specified shape on the pixel grid


// ===============================================
// PIXEL COORDINATE HELPERS

var mapMargin = 0.1;
var horizontalBlocks = 7;
var verticalBlocks = 6;
var horizontalDivisions = 16;
var verticalDivisions = 16;
var verticalRatio = 1; //0.767;

var cellWidth = 0;
var cellHeight = 0;
var marginX = 0;
var marginY = 0;

//var remapX = function(i) {
//  return i
//};
//var remapY = function(i) {
//  return i
//};
//var remapInvX = function(i) {
//  return i
//};
//var remapInvY = function(i) {
//  return i
//};
resizeCoordinates();

var mapRatio = ((horizontalBlocks * horizontalDivisions) / (verticalBlocks * verticalDivisions)) / verticalRatio;
function resizeCoordinates() {
  var screenRatio = view.size.width / view.size.height;
  var horizontallyContrained = (screenRatio <= mapRatio);

  // todo - clean this up with less code duplication
  if (horizontallyContrained) {
    marginX = view.size.width * 0.1;

    var width = view.size.width - marginX * 2;
    var blockWidth = width / horizontalBlocks;
    cellWidth = blockWidth / horizontalDivisions;
    cellHeight = cellWidth * verticalRatio;
    var blockHeight = cellHeight * verticalDivisions;
    var height = blockHeight * verticalBlocks;

    marginY = (view.size.height - height) / 2;

    //var xView = view.size.width - marginX;
    //var xCoord = horizontalBlocks * horizontalDivisions;

    //var yView = height + marginX;
    //var yCoord = verticalBlocks * verticalDivisions;

    //remapX = createRemap(marginX, xView, 0, xCoord);
    //remapY = createRemap(marginY, yView, 0, yCoord);
    //remapInvX = createRemap(0, xCoord, marginX, xView);
    //remapInvY = createRemap(0, yCoord, marginY, yView);
  } else {
    marginY = view.size.height * 0.1;

    var height = view.size.height - marginY * 2;
    var blockHeight = height / verticalBlocks;
    cellHeight = blockHeight / verticalDivisions;
    cellWidth = cellHeight / verticalRatio;
    var blockWidth = cellWidth * horizontalDivisions;
    var width = blockWidth * horizontalBlocks;

    marginX = (view.size.width - width) / 2;
  }
  

  mapLayer.position = new Point(marginX, marginY);
  mapLayer.scaling = new Point(cellWidth, cellHeight);

  mapOverlayLayer.position = new Point(marginX, marginY);
  mapOverlayLayer.scaling = new Point(cellWidth, cellHeight);

  mapIconLayer.position = new Point(marginX, marginY);
  mapIconLayer.scaling = new Point(cellWidth, cellHeight);
}

function viewToMap(viewCoordinate) {
  return new Coordinate(
    remapX(viewCoordinate.x),
    remapY(viewCoordinate.y));
}

function mapToView(canvasCoordinate) {
  return new Point(
    remapInvX(canvasCoordinate.x),
    remapInvY(canvasCoordinate.y));
}

// ===============================================
// GRID overlay

mapOverlayLayer.activate();
var gridRaster;
createGrid();

function toggleGrid() {
  gridRaster.visible = !gridRaster.visible;
}

function createGrid() {
  mapOverlayLayer.activate();
  if (gridRaster) gridRaster.remove();
  var grid = [];
  for (var i = 0; i < horizontalBlocks * horizontalDivisions; i++) {
    var line = createGridLine(getSegment(i, true), i % horizontalDivisions == 0);
    grid.push(line);
  }
  for (var i = 0; i < verticalBlocks * verticalDivisions; i++) {
    var line = createGridLine(getSegment(i, false), i % verticalDivisions == 0);
    grid.push(line);
  }
  var gridGroup = new Group(grid);
  gridRaster = gridGroup.rasterize(view.resolution * 10);
  gridGroup.remove();
  mapLayer.activate();
  gridRaster.locked = true;
}

function createGridLine(segment, blockEdge) {
  line = new Path(segment);
  line.strokeColor = '#ffffff';
  line.strokeWidth = blockEdge ? .2 : 0.1;
  line.strokeCap = 'round';
  //line.dashArray = blockEdge ? [4, 6] : null;
  line.opacity = blockEdge ? 0.5 : 0.3;
  return line;
}

function getSegment(i, horizontal) {
  return horizontal ? [new Point(i, 0), new Point(i, verticalBlocks * verticalDivisions)] : [new Point(0, i), new Point(horizontalBlocks * horizontalDivisions, i)];
}
/*function updateSegments() {
    for (var i = 0; i < horizontalBlocks * horizontalDivisions; i++) {
        var segmentPoints = getSegment(i, true);
        grid[i].segments[0].point = segmentPoints[0];
        grid[i].segments[1].point = segmentPoints[1];
    }
    for (var v = 0; v < verticalBlocks * verticalDivisions; v++) {
        var segmentPoints = getSegment(v, false);
        grid[i + v].segments[0].point = segmentPoints[0];
        grid[i + v].segments[1].point = segmentPoints[1];
    }
}*/

// ===============================================
// COORDINATE LABEL

mapOverlayLayer.activate();
//var coordinateLabel = new PointText(new Point(0, 0));
//coordinateLabel.fontSize = 3;

function centerBrushOffset(width, height) {
  return new Point(width * 0.5 * cellWidth, height * 0.5 * cellHeight);
}

var brushSize = 3;
var brushSegments;
var brush = new Path();
var brushOutline = new Path();

var brushTypes = {
  rounded: 'rounded',
  square: 'square',
};
var brushType = brushTypes.rounded;
updateBrush();

function cycleBrushHead() {
  var heads = Object.keys(brushTypes).sort(function(a, b) {
    return a == b ? 0 : a < b ? -1 : 1;
  });
  var index = heads.indexOf(brushType);
  brushType = heads[(index + 1) % heads.length];
}

function updateBrush() {
  brushSegments = getBrushSegments(brushSize);

  var prevPos = brushOutline.position;

  brush.layer = uiLayer;
  brush.segments = brushSegments;
  brush.pivot = new Point(brushSize / 2 - 0.5, brushSize / 2 - 0.5).floor;
  brush.position = prevPos;
  brush.opacity = 0.5;
  brush.closed = true;
  brush.fillColor = paintColor;
  brush.locked = true;

  brushOutline.segments = brushSegments;
  brushOutline.position = prevPos;
  brushOutline.closed = true;
  brushOutline.strokeColor = '#fff';
  brushOutline.strokeWidth = 0.1;
  brushOutline.locked = true;
}

function updateCoordinateLabel(event) {
  var rawCoordinate = mapOverlayLayer.globalToLocal(event.point);
  var coordinate = rawCoordinate.floor();
  //coordinateLabel.content = '' + event.point + '\n' + coordinate.toString();
  //coordinateLabel.position = rawCoordinate;

  brushOutline.position = rawCoordinate;

  brush.position = coordinate;
}

function getBrushSegments(size) {
  // square
  var sizeX = size;
  var sizeY = size;
  var offset = new Point(0, 0);
  switch (brushType) {
    default:
    case brushTypes.square:
      return [
        offset.add([0, 0]),
        offset.add([0, sizeY]),
        offset.add([sizeX, sizeY]),
        offset.add([sizeX, 0]),
      ];
    case brushTypes.rounded:
      // add straight edges if odd number
      var ratio = .67;
      var diagonalSize = Math.floor((size / 2) * ratio);
      var straightSize = size - (2 * diagonalSize);

      var minPoint = diagonalSize;
      var maxPoint = diagonalSize + straightSize;

      return [
        offset.add([minPoint, 0]),
        offset.add([maxPoint, 0]),
        offset.add([size, minPoint]),
        offset.add([size, maxPoint]),
        offset.add([maxPoint, size]),
        offset.add([minPoint, size]),
        offset.add([0, maxPoint]),
        offset.add([0, minPoint]),
      ];
  }
}

function transformSegments(segments, coordinate) {
  var p = coordinate;
  return segments.map(function(s) {
    return s + p
  });
}

// ===============================================
// STATE AND HISTORY

// command pattern
// draw {
//   contains delta segments for each affected layer
// }
// 

mapLayer.activate();
var state = {
  index: -1,
  // TODO: max history
  history: [],
  drawing: {},
  objects: {},
};
if (!tryLoadAutosaveMap()) {
  loadTemplate();
}

function loadTemplate() {
  clearMap();
  setNewMapData(decodeMap(template));
}

var maxHistoryIndex = 99; // max length is one greater than this

function addToHistory(command) {
  state.index += 1;
  // remove future history if went back in time and made an edit
  if (state.index < state.history.length) {
    var removeNum = state.history.length - state.index;
    state.history.splice(-removeNum, removeNum);
  }

  // limit the amount of saved history to reduce memory
  if (state.index > maxHistoryIndex) {
    var removeNum = state.index - maxHistoryIndex;
    state.history.splice(0, removeNum); 
    state.index -= removeNum;
  }
  state.history[state.index] = command;

  // autosave
  actionsCount++;
  actionsSinceSave++;
  clearTimeout(autosaveTimeout);
  if (actionsCount % autosaveActionsInterval == 0) { // every few actions
    autosaveMap();
  } else { // or if a new action hasn't been made in a while
    autosaveTimeout = setTimeout(function() {
      autosaveMap();
    }, autosaveInactivityTimer);
  }
}
var actionsSinceSave = 0;
var actionsCount = 0;
var autosaveActionsInterval = 20;
var autosaveInactivityTimer = 10000;
var autosaveTimeout;

function clearMap() {
  Object.keys(state.drawing).forEach(function(p){
    state.drawing[p].remove();
  });
  state.drawing = {};
  Object.keys(state.objects).forEach(function(p){
    state.objects[p].remove();
  });
  state.objects = {};
}

function setNewMapData(mapData) {
  // state.objects = mapData.objects; // objects are loaded asynchronously
  state.drawing = mapData.drawing;
  autosaveMap(); // automatically save when opening a new map
}

function undo() {
  if (state.index >= 0) {
    applyCommand(state.history[state.index], false);
    state.index -= 1;
  } else {
    console.log('Nothing to undo');
  }
}

function redo() {
  if (state.index < state.history.length - 1) {
    state.index += 1;
    applyCommand(state.history[state.index], true);
  } else {
    console.log('Nothing to redo');
  }
}

function applyCommand(command, isApply) {
  if (isApply == null) {
    console.logError('applyCommand called without an apply direction');
  }
  // if (draw command)
  switch(command.type) {
    case 'draw':
      applyDiff(isApply, command.data);
      break;
    case 'object':
      switch(command.action) {
        case 'create':
          applyCreateObject(isApply, command);
          break;
        case 'delete':
          applyCreateObject(!isApply, command);
          break;
        case 'position':
          applyMoveCommand(isApply, command);
          break;
        case 'color':
          break;
      }
      break;
  }
}

function drawCommand(drawData) {
  return {
    type: 'draw',
    data: drawData,
  }
}

function objectCommand(action, position, objectData) {
  return {
    type: 'object',
    action: action,
    data: objectData,
    position: position,
  };
}

function objectCreateCommand(objectData, position) {
  return objectCommand('create', position.clone(), objectData);
}

function objectDeleteCommand(objectData, position) {
  return objectCommand('delete', position.clone(), objectData);
}

function objectPositionCommand(objectId, prevPosition, position) {
  return {
    type: 'object',
    action: 'position',
    id: objectId,
    position: position.clone(),
    prevPosition: prevPosition.clone(),
  };
}

function objectColorCommand(objectId, prevColor, color) {
  return {
    type: 'object',
    action: 'color',
    id: objectId,
    color: color,
    prevColor: prevColor,
  };
}

// ===============================================
// DRAWING METHODS

var layerDefinition = {};
layerDefinition[colors.eraser] = {
  elevation: 0,
  addLayers: [],
  cutLayers: [colors.sand, colors.rock, colors.level1, colors.level2, colors.level3, colors.water],
}
layerDefinition[colors.sand] = {
  elevation: 10,
  addLayers: [colors.sand],
  cutLayers: [colors.rock, colors.level1, colors.level2, colors.level3, colors.water],
};
layerDefinition[colors.rock] = {
  elevation: 5,
  addLayers: [colors.rock, colors.sand],
  cutLayers: [colors.level1, colors.level2, colors.level3, colors.water],
};
layerDefinition[colors.level1] = {
  elevation: 20,
  addLayers: [colors.sand, colors.level1],
  cutLayers: [colors.level2, colors.level3, colors.water],
};
layerDefinition[colors.level2] = {
  elevation: 30,
  addLayers: [colors.sand, colors.level1, colors.level2],
  cutLayers: [colors.level3, colors.water],
};
layerDefinition[colors.level3] = {
  elevation: 40,
  addLayers: [colors.sand, colors.level1, colors.level2, colors.level3],
  cutLayers: [colors.water],
};
layerDefinition[colors.water] = {
  elevation: -5,
  addLayers: [colors.water],
  cutLayers: [colors.rock],
  limit: true,
};


//var drawPoints = [];

var prevGridCoordinate;
var prevDrawCoordinate;

var diffCollection = {};

function startDrawGrid(viewPosition) {
  mapLayer.activate();
  var coordinate = mapLayer.globalToLocal(viewPosition);
  prevGridCoordinate = coordinate;
  drawGrid(viewPosition);
}

function drawGrid(viewPosition) {
  mapLayer.activate();
  var coordinate = new Point(mapLayer.globalToLocal(viewPosition));

  var drawPaths = [];
  doForCellsOnLine(
    prevGridCoordinate.x, prevGridCoordinate.y,
    coordinate.x, coordinate.y,
    function(x, y) {
      var p = getDrawPath(new Point(x, y).floor());
      if (p) drawPaths.push(p);
    });

  var path; 
  if (drawPaths.length == 1) {
    path = drawPaths[0];
  }
  else if (drawPaths.length > 1) {
    var compound = new CompoundPath({children: drawPaths});
    path = uniteCompoundPath(compound);
  }
  if (path) {
    var diff = getDiff(path, paintColor);

    Object.keys(diff).forEach(function(color) {
      var colorDiff = diff[color];
      if (!diffCollection.hasOwnProperty(color)) {
        diffCollection[color] = {isAdd: colorDiff.isAdd, path: []};
      }
      diffCollection[color].path.push(colorDiff.path);
      if (diffCollection[color].isAdd != colorDiff.isAdd) {
        console.logError('Simultaneous add and remove for ' + color);
      }
    });
    applyDiff(true, diff);
  }

  prevGridCoordinate = coordinate;
}

function endDrawGrid(viewPosition) {
  var mergedDiff = {};
  Object.keys(diffCollection).forEach(function(k) {
    mergedDiff[k] = {
      isAdd: diffCollection[k].isAdd,
      path: uniteCompoundPath(
        new CompoundPath({children: diffCollection[k].path})
      ),
    }
  });
  diffCollection = {};
  if (Object.keys(mergedDiff).length > 0) {
    addToHistory(drawCommand(mergedDiff));
  }
}

function uniteCompoundPath(compound) {
  var p = new Path();
  compound.children.forEach(function(c) {var u = p.unite(c); p.remove(); p = u});
  compound.remove();
  return p;
}

function getDrawPath(coordinate, drawPath) {
  if (coordinate != prevDrawCoordinate) {
    prevDrawCoordinate = coordinate;
    var drawPoints = transformSegments(brushSegments, coordinate);
    
    var p = new Path(drawPoints);
    return p;
  }
}

// use for the vertex based drawing method for later
/*
function drawGridCoordinate(coordinate) {
  var newDrawPoints = transformSegments(brushSegments, coordinate);

  if (!newDrawPoints.equals(drawPoints)) {
    drawPoints = newDrawPoints;
    addDrawPoints(drawPoints, paintColor);
  }
}*/

function getDistanceFromWholeNumber(f) {
  return Math.abs(f - Math.round(f));
}

function getDiff(path, paintColor) {
  mapLayer.activate();
  if (!state.drawing.hasOwnProperty(paintColor)) {
    state.drawing[paintColor] = new Path();
    state.drawing[paintColor].locked = true;
  }
  if (!path.children && path.segments.length < 3) return {};

  // figure out which layers to add and subtract from
  var editLayers = {};
  var definition = layerDefinition[paintColor];
  definition.addLayers.forEach(function(color) { editLayers[color] = true;});
  definition.cutLayers.forEach(function(color) { editLayers[color] = false;});

  var diff = {};
  Object.keys(editLayers).forEach(function(color) {
    var isAdd = editLayers[color];

    var delta = isAdd
      ? path.subtract(state.drawing[color])
      : path.intersect(state.drawing[color]);
    
    // search for invalid points caused by overlapping diagonals
    // todo: for free drawing, remove this check
    var deltaSubPaths = delta.children ? delta.children : [delta];
    deltaSubPaths.forEach(function(p) {
      p.curves.forEach(function(curve) {
        var p1 = curve.segment1.point;
        var p2 = curve.segment2.point;
        if (p1.getDistance(p2, true) < 1) { // use squared distance for speed
          var isSegment1Invalid = (getDistanceFromWholeNumber(p1.x) > 0.1) || (getDistanceFromWholeNumber(p1.y) > 0.1);
          var isSegment2Invalid = (getDistanceFromWholeNumber(p2.x) > 0.1) || (getDistanceFromWholeNumber(p2.y) > 0.1);
          if (!isSegment1Invalid && !isSegment2Invalid) {
            return;
          }
          var invalidSegment = isSegment1Invalid ? curve.segment1 : curve.segment2;
          var goodSegment = isSegment1Invalid ? curve.segment2 : curve.segment1;
          
          // move the invalid point to the good point rotated clockwise/counterclockwise
          var iP = invalidSegment.point;
          var gP = goodSegment.point;

          // flip the x/y axis depending on the direction of the segment
          var xGreater = iP.x < gP.x;
          var yGreater = iP.y < gP.y;
          var axis = xGreater ^ yGreater;

          var newPoint = axis // todo: do I need to check for clockwise?
            ? new Point(gP.x - (xGreater ? 1 : -1), gP.y)
            : new Point(gP.x, gP.y - (yGreater ? 1 : -1));

          invalidSegment.point = newPoint;
        }
      });
    });

    if (delta.children || (delta.segments && delta.segments.length > 0)) {
      diff[color] = {
        isAdd: isAdd,
        path: delta,
      };
    }
    delta.remove();
  });

  return diff;
}

function applyDiff(isApply, diff) {
  Object.keys(diff).forEach(function(color) {
    var colorDiff = diff[color]
    var isAdd = colorDiff.isAdd;
    if (!isApply) isAdd = !isAdd; // do the reverse operation
    addPath(isAdd, colorDiff.path, color);
  })
}

function addPath(isAdd, path, color) {
  mapLayer.activate();
  if (!state.drawing.hasOwnProperty(color)) {
    state.drawing[color] = new Path();
    state.drawing[color].locked = true;
  }
  var combined = isAdd
    ? state.drawing[color].unite(path)
    : state.drawing[color].subtract(path);
  combined.locked = true;
  combined.fillColor = color;
  combined.insertAbove(state.drawing[color]);

  state.drawing[color].remove();
  path.remove();

  state.drawing[color] = combined;
}

// ===============================================
// HELPERS

function addObjectArray(object, key, value) {
  if (!object.hasOwnProperty(key)) {
    object[key] = [];
  }
  object[key].push(value);
}

function createRemap(inMin, inMax, outMin, outMax) {
  return function remap(x) {
    return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  };
}

function doForCellsOnLine(x0, y0, x1, y1, setPixel) {
  var interval = 0.2;

  if (Math.abs(x0 - x1) + Math.abs(y0 - y1) < 0.2) {
    setPixel(x0, y0);
    return;
  }

  var p0 = new Point(x0, y0);
  var p1 = new Point(x1, y1);
  var delta = p1 - p0;
  var slope = delta.normalize() * interval;

  var prevCellPoint = null;
  var totalLength = delta.length;
  var length = 0;

  do {
    var cellPoint = p0.floor();
    if (prevCellPoint != cellPoint) {
      setPixel(cellPoint.x, cellPoint.y);
      prevCellPoint = cellPoint;
    }
    p0 += slope;
    length += interval;
  } while (length < totalLength)
}

function clamp(num, min, max) {
  return num <= min ? min : num >= max ? max : num;
}

// https://stackoverflow.com/questions/7837456/how-to-compare-arrays-in-javascript
Array.prototype.equals = function(array) {
  // if the other array is a falsy value, return
  if (!array)
    return false;

  // compare lengths - can save a lot of time 
  if (this.length != array.length)
    return false;

  for (var i = 0, l = this.length; i < l; i++) {
    // Check if we have nested arrays
    if (this[i] instanceof Array && array[i] instanceof Array) {
      // recurse into the nested arrays
      if (!this[i].equals(array[i]))
        return false;
    } else if (this[i] != array[i]) {
      // Warning - two different object instances will never be equal: {x:20} != {x:20}
      return false;
    }
  }
  return true;
}

function objectMap(object, mapFn) {
  return Object.keys(object).reduce(function(result, key) {
    result[key] = mapFn(object[key], key)
    return result
  }, {})
}
