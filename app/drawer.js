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

  // if you want to rename a color, you must add a name parameter with the old name
  // otherwise backwards compatibility for encoding/decoding will break
  var colors = {
    // terrain colors
    water: {color:'#83e1c3'},
    sand: {color:'#eee9a9'},
    level1: {color:'#498344'},
    level2: {color:'#49b243'},
    level3: {color:'#6bdd52'},
    rock: {color:'#737a89'},
    campground: {color:'#b0a280'},

    // paths
    pathDirt: {color:'#d99666'},
    pathEraser: {color:'#f1b2c1'},

    // structures
    special: {color:'#ffffff'},
    dock: {color:'#a9926e'},
    amenity: {color:'#514d40'},
    amenityWhite: {color:'#efedd5'},
    human: {color:'#F078B0'},
    npc: {color:'#f8bd26'},
    selected: {color:'#ed772f'},
    pin: {color:'#e75a2e'},

    // Map drawer UI
    selection: {color:'#50EEFF'},

    // UI
    white: {color:'#f9f7ed'},
    paper: {color:'#f5f3e5'}, // general white

    // colors from nookPhone (colors are hued towards red/yellow)
    purple: "#be84f0",
    blue: "#8c97ec",
    lightBlue: "#b4bdfd",
    orange: "#df8670",
    magenta: "#f550ab",
    pink: "#f09eb3",
    cyan: "#63d5bf",
    turquoise: "#86e0bb",
    green: "#8dd08a",
    lime: "#d2e541",
    red: "#ee666e",
    offBlack: "#4b3b32",
    offWhite: "#f6f2e0",
    lightText: "#dcd8ca",
    text: "#726a5a",
    yellow: "#f5d830",
    lightBrown: "#bfab76",

    // generic colors
    firetruck: {color:'#ef3c1d'},
    flamingo: {color:'#f8ad82'},
    brick: {color:'#ab4f46'},

    safetyOrange: {color:'#f56745'},
    lifeguardOrange: {color:'#f59447'},

    frogYellow: {color:'#f7d00e'},
    lightBannerYellow: {color:'#fdf252'},
    darkBannerYellow: {color:'#c7b451'},

    tentGreen: {color:'#22b759'},
    darkBlueGreen: {color:'#11a972'},
    lightGreen: {color:'#5aeb89'},
    jaybird: {color:'#42bbf3'},

    darkGreyBlue: {color:'#7c8da6'},
    lightGreyBlue: {color:'#9cbbce'},

    highlightCircle: {color: '#2adbb8'},

    // Water UI
    oceanPanel: {color:'#39ba9c'}, // game trailer had this color panel
    oceanPanelDark: {color:'39ba9c'},
    oceanText: {color:'#57b499'}, // text on ocean
    oceanDarker: {color:'#77d6bd'}, // dark overlay 
    oceanDark: {color:'#70cfb6'}, // dark overlay
    oceanLighter: {color:'#d7fef1'}, // light overlay 
    oceanLight: {color:'#a3f8dd'}, // light overlay
    oceanWave: {color:'#63d4b2'},
  }
  Object.keys(colors).forEach(function(colorKey) {
    var colorData = colors[colorKey];
    if (!colorData.name) { // if it has a custom encoded name, make sure to use that
      colorData.name = colorKey
    }
    colorData.key = colorKey;
  });

  function getColorDataFromEncodedName(encodedColorName) {
    if (!encodedColorName) return null;
    return Object.values(colors).find(function(c) {return c.name == encodedColorName});
  }

  var pathDefinition = {};
  pathDefinition[colors.pathDirt.key] = {
    priority: 100,
    addLayers: [colors.pathDirt.key],
    //requireLayer: colors.sand.key, // sand is always drawn below everything else
  }
  pathDefinition[colors.pathEraser.key] = {
    cutLayers: [colors.pathDirt.key],
  }

  var layerDefinition = {};
  //layerDefinition[colors.water] = {
  //  elevation: -5,
  //  addLayers: [colors.water],
  //  cutLayers: [colors.rock],
  //  limit: true,
  //};
  layerDefinition[colors.level3.key] = {
    priority: 50,
    elevation: 40,
    addLayers: [colors.sand.key, colors.level1.key, colors.level2.key, colors.level3.key],
    cutLayers: [colors.rock.key, colors.water.key],
  };
  layerDefinition[colors.level2.key] = {
    priority: 40,
    elevation: 30,
    addLayers: [colors.sand.key, colors.level1.key, colors.level2.key],
    cutLayers: [colors.rock.key, colors.level3.key, colors.water.key],
  };
  layerDefinition[colors.level1.key] = {
    priority: 30,
    elevation: 20,
    addLayers: [colors.sand.key, colors.level1.key],
    cutLayers: [colors.rock.key, colors.level2.key, colors.level3.key, colors.water.key],
  };
  layerDefinition[colors.rock.key] = {
    priority: 20,
    elevation: 5,
    addLayers: [colors.rock.key, colors.sand.key],
    cutLayers: [colors.level1.key, colors.level2.key, colors.level3.key, colors.water.key],
  };
  layerDefinition[colors.sand.key] = {
    priority: 10,
    elevation: 10,
    addLayers: [colors.sand.key],
    cutLayers: [colors.rock.key, colors.level1.key, colors.level2.key, colors.level3.key, colors.water.key],
  };
  layerDefinition[colors.water.key] = {
    priority: 0,
    elevation: 0,
    addLayers: [],
    cutLayers: [colors.sand.key, colors.rock.key, colors.level1.key, colors.level2.key, colors.level3.key, colors.water.key],
  };
  //layerDefinition[colors.eraser.key] = {
  //  elevation: 0,
  //  addLayers: [],
  //  cutLayers: [colors.sand.key, colors.rock.key, colors.level1.key, colors.level2.key, colors.level3.key, colors.water.key],
  //};

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

  function createMenu(items, spacing) {
    if (spacing == null) spacing = 50;
    var i = 0;
    var iconMenu = new Group();

    var backing = new Path();
    backing.strokeColor = colors.paper.color;
    backing.strokeWidth = 60;
    backing.strokeCap = 'round';
    backing.segments = [
      new Point(0, 0),
      new Point(0, spacing * (Object.keys(items).length - 1)),
    ];

    var triangle = new Path.RegularPolygon(new Point(0, 0), 3, 14);
    triangle.fillColor = colors.paper.color;
    triangle.rotate(-90);
    triangle.scale(0.5, 1)
    triangle.position -= new Point(30 + 3.5, 0);

    iconMenu.addChildren([backing, triangle]);

    var buttonMap = objectMap(items, function(item, name) {
      item.position = new Point(0, spacing * i);
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
      setPointer: function(distance) {
        triangle.position += new Point(0, distance);
      }
    };

    return iconMenu;
  }

  function encodeObject(object) {
    return {
      position: [object.position.x, object.position.y],
      id: object.data.id,
      category: object.data.category,
      type: object.data.type,
      color: object.data.colorData ? object.data.colorData.name : "",
    };
  }

  function decodeObject(encodedData) {
    var position = new Point(encodedData.position);
    // encode the color name separately from the key so we are able to refactor the code
    var colorData = getColorDataFromEncodedName(encodedData.color);
    var objectData = {
      id: encodedData.id,
      category: encodedData.category,
      type: encodedData.type,
      colorData: colorData,
    };
    applyCommand(objectCreateCommand(objectData, position), true);
    return {
      position: position,
      id: encodedData.id,
      category: encodedData.category,
      type: encodedData.type,
      colorData: colorData,
    };
  }

  function getObjectData(objectDefinition) {
    return {
      id: Date.now(),
      category: objectDefinition.category,
      type: objectDefinition.type,
      colorData: objectDefinition.colorData,
    };
  }

  function createObjectIcon(objectDefinition, itemData) {
    var item = objectDefinition.icon.clone({insert: false});
    if (itemData.colorData) {
      item.fillColor = itemData.colorData.color;
    }
    return item;
  }

  function createObjectBase(objectDefinition, itemData) {
    var item = createObjectIcon(objectDefinition, itemData);
    item.scaling = objectDefinition.scaling;
    item.pivot = item.bounds.bottomCenter;
    item.pivot += objectDefinition.offset;
    item.position = new Point(0, 0);

    var group = new Group();

    var bound = new Path.Rectangle(new Rectangle(item.position, objectDefinition.size), .15);
    bound.strokeColor = 'white';
    bound.strokeColor.alpha = 0;
    bound.strokeWidth = 0.1;
    bound.fillColor = 'white';
    bound.fillColor.alpha = 0.0001;
    group.addChildren([item, bound]);
    group.pivot = bound.bounds.topLeft;

    group.elements = {
      icon: item,
      bound: bound,
    }
    group.data = itemData;
    group.definition = objectDefinition;

    return group;
  }

  function createObjectPreview(objectDefinition, itemData) {
    mapOverlayLayer.activate();
    var group = createObjectBase(objectDefinition, itemData);
    return group;
  }

  function createObject(objectDefinition, itemData) {
    mapIconLayer.activate();

    var group = createObjectBase(objectDefinition, itemData);
    if (objectDefinition.extraObject) {
      group.insertChild(0, objectDefinition.extraObject());
    }

    group.state = {
      selected: false,
      focused: false,
    };
    group.onDelete = function() {
      var command = objectDeleteCommand(group.data, group.position);
      applyCommand(command, true);
      addToHistory(command);
    };
    group.onSelect = function(isSelected) {
      if (group.state.selected != isSelected) {
        this.state.selected = isSelected;
        this.elements.bound.strokeWidth = isSelected ? 0.2 : 0.1;
        this.elements.bound.strokeColor = isSelected ? colors.selection.color : 'white';
        this.elements.bound.strokeColor.alpha = group.state.focused ? 1 : 0;
      }
    }
    group.onMouseEnter = function(event) {
      this.state.focused = true;
      this.elements.bound.strokeColor.alpha = this.state.selected ? 1 : 0.6;
    }
    group.onMouseLeave = function(event) {
      this.state.focused = false;
      this.elements.bound.strokeColor.alpha = this.state.selected ? 1 : 0;
    }
    group.onMouseDown = function(event) {
      //if (Key.isDown('alt')) {
      //  toolState.switchTool(toolState.toolMapValue(
      //    toolCategoryDefinition[this.definition.category],
      //    this.definition,
      //    {}));
      //  return;
      //}

      this.elements.bound.strokeColor.alpha = 1;
      var coordinate = mapOverlayLayer.globalToLocal(event.point);
      this.data.prevPosition = this.position;
      this.data.wasMoved = false;
      this.data.clickPivot = coordinate - this.pivot;
      grabObject(coordinate, this);
    }
    group.onMouseDrag = function(event) {
      var coordinate = mapOverlayLayer.globalToLocal(event.point);
      this.position = (coordinate - this.data.clickPivot).round();
      if (this.position.getDistance(this.data.prevPosition, true) > 0.1) {
        this.data.wasMoved = true;
      }
      dragObject(coordinate, this);
    }
    group.onMouseUp = function(event) {
      this.elements.bound.strokeColor.alpha = this.state.selected ? 1 : 0.6;
      var prevPosition = this.data.prevPosition;
      if (!prevPosition) return;
      var coordinate = mapOverlayLayer.globalToLocal(event.point);

      // if the object was clicked, not dragged
      if (!this.data.wasMoved) {
        toolState.selectObject(this);
      }

      delete this.data.prevPosition;
      delete this.data.clickPivot;
      if (prevPosition == coordinate.position);
      dropObject(coordinate, this, prevPosition);
    }

    return group;
  }

  function createObjectPreviewAsync(objectData, callback) {
    toolCategoryDefinition[objectData.category].tools.getAsyncValue(
      function(tools) {
        callback(createObjectPreview(tools[objectData.type], objectData));
      });
  }

  function createObjectAsync(objectData, callback) {
    toolCategoryDefinition[objectData.category].tools.getAsyncValue(
      function(tools) {
        callback(createObject(tools[objectData.type], objectData));
      });
  }

  mapLayer.activate();

  // ===============================================
  // GLOBAL FUNCTIONS

  function onResize(event) {
    // Whenever the window is resized, recenter the path:
    resizeCoordinates();
    drawBackground();
  }

  tool.minDistance = 1;

  var prevViewMatrix = view.matrix.clone();
  fixedLayer.activate();
  function onFrame() {
    if (!view.matrix.equals(prevViewMatrix)) {
      var inverted = view.matrix.inverted();
      backgroundLayer.matrix = inverted;
      fixedLayer.matrix = inverted;
      fixedLayer.scale(window.devicePixelRatio / 2, view.projectToView(new Point(0, 0)));
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
  backgroundRect.fillColor = colors.water.color;
  backgroundRect.onMouseEnter = function(event) {
    toolState.focusOnCanvas(true);
  }
  backgroundRect.onMouseLeave = function(event) {
    toolState.focusOnCanvas(false);
  }

  onMouseDown = function onMouseDown(event) {
    toolState.onDown(event);
    if (toolState.toolIsActive)
      toolState.activeTool.definition.onMouseDown(event);
  }
  onMouseMove = function onMouseMove(event) {
    if (toolState.toolIsActive) {
      toolState.activeTool.definition.onMouseMove(event);
    }
  }
  onMouseDrag = function onMouseDrag(event) {
    if (toolState.toolIsActive)
      toolState.activeTool.definition.onMouseDrag(event);
  }
  onMouseUp = function onMouseUp(event) {
    toolState.onUp(event);
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
  editor.autosaveMap = autosaveMap;
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
  editor.clearAutosave = clearAutosave;

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
    background.fillColor = colors.water.color;

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
    button.fillColor = colors.sand.color;
    button.fillColor.alpha = 0.0001;

    group.applyMatrix = false;
    group.addChildren([button, item]);

    group.data = {
      selected: false,
      hovered: false,
      select: function(isSelected) {
        group.data.selected = isSelected;
        button.fillColor = isSelected ? colors.npc.color : colors.sand.color;
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
  //menuButton.strokeColor = colors.selected.color;
  ////menuButton.strokeColor *= 0.9;
  //menuButton.strokeWidth = 120;
  //menuButton.strokeCap = 'round';
  //menuButton.segments = [
  //  new Point(-20, 0),
  //  new Point(0, 0),
  //];


  var mainMenu = new Path();
  var saveButton = new Path.Circle(120, 50, 30);
  saveButton.fillColor = colors.paper.color;
  saveButton.onMouseDown = function() {
    saveMapToFile();
  };

  var loadButton = new Path.Circle(200, 50, 30);
  loadButton.fillColor = colors.paper.color;
  loadButton.onMouseDown = function() {
    loadMapFromFile();
  };

  var newButton = new Path.Circle(280, 50, 30);
  newButton.fillColor = colors.paper.color;
  newButton.onMouseDown = function() {
    var r = confirm("Clear your map? You will lose all unsaved changes.");
    if (r == true) {
      loadTemplate();
    } else { }
  };

  var leftToolMenu = new Path();
  leftToolMenu.strokeColor = colors.paper.color;
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
  var AsyncObjectDefinition = ES3Class({
    constructor: function() {
      this.loadedCount = 0;
      this.targetCount = function() {return Object.keys(this.value).length;};
      this.onLoad = function() {
        this.loadedCount++;
        if (this.loadedCount == this.targetCount()) {
          this.loadingCallbacks.forEach(
            function(callback) { callback(this.value); }.bind(this));
          this.loadingCallbacks = [];
        }
      }
      this.loadingCallbacks = [];
      this.getAsyncValue = function(callback) {
        if (this.loadedCount == this.targetCount()) {
          callback(this.value);
          return true; // returns whether the value was returned immediately
        } else {
          this.loadingCallbacks.push(callback);
          return false;
        }
      }
    },
  });

  var asyncAmenitiesDefinition = new AsyncObjectDefinition();
  asyncAmenitiesDefinition.value = {
    dock: {
      colorData: colors.dock,
      size: new Size(7, 2),
      menuScaling: new Point(.2, .2),
      offset: new Point(-3.5, -1.85),
    },
    airport: {},
    center: {
      extraObject: function() {
        var baseGround = new Path.Rectangle(new Rectangle(0, 0, 12, 10), 1);
        baseGround.fillColor = colors.campground.color;
        baseGround.position = new Point(1, 7);
        return baseGround;
      },
    },
    lighthouse: {
      colorData: colors.pin,
      size: new Size([2, 2]),
      menuScaling: new Point(.3, .3),
      offset: new Point(-1, -1.6),
    },
  };
  Object.keys(asyncAmenitiesDefinition.value).forEach(function(type) {
    var def = asyncAmenitiesDefinition.value[type];
    def.category = 'amenities';
    def.type = type;
    def.scaling = def.scaling || new Point(.03, .03);
    def.menuScaling = def.menuScaling || new Point(.14, .14);
    def.size = def.size || new Size([8, 8]);
    def.offset = def.offset || new Point(-4, -7.6);
    def.onSelect = function(isSelected) {};
    // imnmediately load the assets
    loadSvg('amenity-' + type, function(item) {
      //item.pivot += new Point(-2, -3.6);
      def.icon = item;
      asyncAmenitiesDefinition.onLoad();
    });
  });

  var asyncStructureDefinition = new AsyncObjectDefinition();
  asyncStructureDefinition.value = {
    tentRound: {},
    tentTriangle: {},
    tentTrapezoid: {},
    hut: {},
    house: {},
    building: {},
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
      def.colorData = colors.level3;
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
      def.colorData = colors.npc;
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

  //var asyncTreeDefinition = Object.create(asyncObjectDefinition);
  //asyncTreeDefinition.value = {
  //  
  //}

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
      updateCoordinateLabel(event);
    },
    onKeyDown: function(subclass, event) {
    },
    enablePreview: function(subclass, isEnabled) {
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
          if (this.iconMenu && (nextToolData.type == 'structures' || nextToolData.type == 'amenities')) {
            this.iconMenu.data.update(nextTool);
            updateObjectPreview();
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
        this.base.onMouseDown(this, event);
      },
      onMouseDrag: function(event) {
        this.base.onMouseDrag(this, event);
      },
      onMouseUp: function(event) {
        this.base.onMouseUp(this, event);
      },
      onKeyDown: function(event) {
        this.base.onKeyDown(this, event);
      },
      enablePreview: function(isEnabled) {
        this.base.enablePreview(this, isEnabled);
      },
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
      data: {
        paintColorData: colors.level1,
      },
      onSelect: function(isSelected) {
        this.base.onSelect(this, isSelected);
      },
      onMouseMove: function(event) {
        this.base.onMouseMove(this, event);
      },
      onMouseDown: function(event) {
        this.base.onMouseDown(this, event);
        if (Key.isDown('alt')) {
          var rawCoordinate = mapOverlayLayer.globalToLocal(event.point);
          updatePaintColor(getColorAtCoordinate(rawCoordinate));
        }
        startDraw(event);
      },
      onMouseDrag: function(event) {
        this.base.onMouseDrag(this, event);
        draw(event);
      },
      onMouseUp: function(event) {
        this.base.onMouseUp(this, event);
        endDraw(event);
      },
      onKeyDown: function(event) {
        this.base.onKeyDown(this, event);
      },
      enablePreview: function(isEnabled) {
        this.base.enablePreview(this, isEnabled);
        brushOutline.visible = isEnabled;
        brush.visible = isEnabled;
      },
      openMenu: function(isSelected) {
        fixedLayer.activate();
        updatePaintColor(this.data.paintColorData);
        this.base.iconMenu = createMenu(
          objectMap(layerDefinition, function(definition, colorKey) {
            var colorData = colors[colorKey];
            var paintCircle = new Path.Circle(new Point(0, 0), 16);
            paintCircle.fillColor = colorData.color;
            paintCircle.locked = true;
            return createButton(paintCircle, 20, function(button) {
              updatePaintColor(colorData);
              this.data.paintColorData = colorData;
            }.bind(this));
          }.bind(this)),
          45 // menu spacing
        );
        this.base.iconMenu.data.setPointer(55);
        this.base.iconMenu.pivot = new Point(0, 0);
        this.base.iconMenu.position = new Point(100, 120);
        // this is a little messy
        this.base.iconMenu.data.update(this.data.paintColorData.key);
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
      data: {
        paintColorData: colors.pathDirt,
      },
      onSelect: function(isSelected) {
        this.base.onSelect(this, isSelected);
      },
      onMouseMove: function(event) {
        this.base.onMouseMove(this, event);
      },
      onMouseDown: function(event) {
        this.base.onMouseDown(this, event);
        if (Key.isDown('alt')) {
          var rawCoordinate = mapOverlayLayer.globalToLocal(event.point);
          updatePaintColor(getColorAtCoordinate(rawCoordinate));
        }
        startDraw(event);
      },
      onMouseDrag: function(event) {
        this.base.onMouseDrag(this, event);
        draw(event);
      },
      onMouseUp: function(event) {
        this.base.onMouseUp(this, event);
        endDraw(event);
      },
      onKeyDown: function(event) {
        this.base.onKeyDown(this, event);
      },
      enablePreview: function(isEnabled) {
        this.base.enablePreview(this, isEnabled);
        brushOutline.visible = isEnabled;
        brush.visible = isEnabled;
      },
      openMenu: function(isSelected) {
        fixedLayer.activate();
        updatePaintColor(this.data.paintColorData);
        var pathColorButtons =
          objectMap(pathDefinition, function(definition, colorKey) {
            var colorData = colors[colorKey];
            var paintCircle = new Path.Circle(new Point(0, 0), 16);
            paintCircle.fillColor = colorData.color;
            paintCircle.locked = true;
            return createButton(paintCircle, 20, function(button) {
              updatePaintColor(colorData);
              this.data.paintColorData = colorData;
            }.bind(this));
          }.bind(this))
        this.base.iconMenu = createMenu(pathColorButtons, 45);
        this.base.iconMenu.data.setPointer(30);
        this.base.iconMenu.pivot = new Point(0, 0);
        this.base.iconMenu.position = new Point(100, 195);
        // this is a little messy
        this.base.iconMenu.data.update(this.data.paintColorData.key);
      },
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
        this.base.onMouseDown(this, event);
      },
      onMouseDrag: function(event) {
        this.base.onMouseDrag(this, event);
      },
      onMouseUp: function(event) {
        this.base.onMouseUp(this, event);
      },
      onKeyDown: function(event) {
        this.base.onKeyDown(this, event);
      },
      enablePreview: function(isEnabled) {
        this.base.enablePreview(this, isEnabled);
        if (objectPreviewOutline) objectPreviewOutline.visible = isEnabled;
        if (objectPreview) objectPreview.visible = isEnabled;
      },
      openMenu: function(isSelected) {
        this.tools.getAsyncValue(function(definitions) {
          fixedLayer.activate();
          var categoryDefinition = this;
          this.base.iconMenu = createMenu(
            objectMap(definitions, function(def, name) {
              var icon = def.icon.clone();
              icon.scaling = def.menuScaling;
              icon.fillColor = def.colorData.color;
              return createButton(icon, 20, function(button) {
                toolState.switchTool(toolState.toolMapValue(categoryDefinition, def, {}));
              });
            })
          );
          this.base.iconMenu.data.setPointer(105);
          this.base.iconMenu.pivot = new Point(0, 0);
          this.base.iconMenu.position = new Point(100, 170);
          // this is a little messy
          if (toolState.activeTool && toolState.activeTool.tool) {
            this.base.iconMenu.data.update(toolState.activeTool.tool.type);
          }
        }.bind(this));
      },
    },
    amenities: {
      base: baseToolCategoryDefinition,
      type: 'amenities',
      layer: mapIconLayer,
      icon: "amenities",
      tools: asyncAmenitiesDefinition,
      defaultTool: null,
      modifiers: {},
      defaultModifiers: {},
      onSelect: function(isSelected) {
        this.base.onSelect(this, isSelected);
      },
      onMouseMove: function(event) {
        this.base.onMouseMove(this, event);
      },
      onMouseDown: function(event) {
        placeObject(event);
        this.base.onMouseDown(this, event);
      },
      onMouseDrag: function(event) {
        this.base.onMouseDrag(this, event);
      },
      onMouseUp: function(event) {
        this.base.onMouseUp(this, event);
      },
      onKeyDown: function(event) {
        this.base.onKeyDown(this, event);
      },
      enablePreview: function(isEnabled) {
        this.base.enablePreview(this, isEnabled);
        if (objectPreviewOutline) objectPreviewOutline.visible = isEnabled;
        if (objectPreview) objectPreview.visible = isEnabled;
      },
      openMenu: function(isSelected) {
        this.tools.getAsyncValue(function(definitions) {
          fixedLayer.activate();
          var categoryDefinition = this;
          this.base.iconMenu = createMenu(
            objectMap(definitions, function(def, name) {
              var icon = createObjectIcon(def, getObjectData(def));
              icon.scaling = def.menuScaling;
              return createButton(icon, 20, function(button) {
                toolState.switchTool(toolState.toolMapValue(categoryDefinition, def, {}));
              });
            })
          );
          this.base.iconMenu.data.setPointer(60);
          this.base.iconMenu.pivot = new Point(0, 0);
          this.base.iconMenu.position = new Point(100, 265);
          // this is a little messy
          if (toolState.activeTool && toolState.activeTool.tool) {
            this.base.iconMenu.data.update(toolState.activeTool.tool.type);
          }
        }.bind(this));
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

    selected: {},
    isSomethingSelected: function() {return Object.keys(this.selected).length > 0},
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
    deleteSelection: function() {
      Object.keys(this.selected).forEach(function(objectId) {
        var object = this.selected[objectId];
        object.onDelete();
      }.bind(this));
      this.deselectAll();
    },
    selectObject: function(object) {
      this.deselectAll();
      this.selected[object.data.id] = object;
      object.onSelect(true);
    },
    deselectObject: function(object) {
      delete this.selected[object.data.id];
      object.onSelect(false);
    },
    deselectAll: function() {
      Object.keys(this.selected).forEach(function(objectId) {
        var object = this.selected[objectId];
        object.onSelect(false);
      }.bind(this));
      this.selected = {};
    },
    onDown: function(event) {
      // deactivate the tool when something is selected or dragging an object
      this.isDown = true;

      // if we didn't click on one of the selected objects, deselect them
      var clickedOnSelected = false;
      Object.keys(this.selected).forEach(function(objectId) {
        var object = this.selected[objectId];
        if (object.contains(mapOverlayLayer.globalToLocal(event.point))) {
          clickedOnSelected = true;
        }
      }.bind(this));
      if (!clickedOnSelected) {
        this.deselectAll();
      }
    },
    onUp: function(event) {
      this.isDown = false;

      var isActive = this.isCanvasFocused && !this.isSomethingSelected();
      if (this.toolIsActive != isActive) {
        this.toolIsActive = isActive;
        if (this.activeTool) this.activeTool.definition.enablePreview(isActive);
      }
    },
    focusOnCanvas: function(isFocused) {
      this.isCanvasFocused = isFocused;
      if (!this.isDown) {
        var isActive = this.isCanvasFocused && !this.isSomethingSelected();
        if (this.toolIsActive != isActive) {
          this.toolIsActive = isActive;
          if (this.activeTool) this.activeTool.definition.enablePreview(isActive);
        }
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

  //var activeColor = new Path.Circle([20, 20], 16);
  //activeColor.fillColor = paintColor;
  //addToLeftToolMenu(activeColor);


  //function updateColorTools() {
  //  activeColor
  //}

  var paintColor = colors.level1;
  function updatePaintColor(colorData) {
    paintColor = colorData;
    brush.fillColor = colorData.color;
    //activeColor.fillColor = paintColor;

    // todo: separate viewfrom logic
    if (toolState.activeTool &&
      toolState.activeTool.type == toolCategoryDefinition.terrain.type
      || toolState.activeTool.type == toolCategoryDefinition.path.type) {
      if (toolState.activeTool.definition.base.iconMenu) {

        var toolCategory;
        if (layerDefinition[colorData.key]) {
          toolCategory = toolCategoryDefinition.terrain.type;
        } else if (pathDefinition[colorData.key]) {
          toolCategory = toolCategoryDefinition.path.type;
        }
        if (toolState.activeTool.type != toolCategory){
          toolState.switchToolType(toolCategory);
        }

        toolState.activeTool.definition.base.iconMenu.data.update(colorData.key);
      }
    }
  }

  fixedLayer.activate();

  var toolsPosition = new Point(40, 80);

  //var pointerToolButton = new Raster('../img/pointer.png');
  //pointerToolButton.position = toolsPosition + new Point(0, 0);
  //pointerToolButton.scaling = new Point(0.2, 0.2);

  function onKeyDown(event) {
    var shift = Key.isDown('shift');
    var control = Key.isDown('control') || Key.isDown('meta');

    var prevActiveTool = toolState.activeTool;
    switch (event.key) {
      case '0':
        updatePaintColor(colors.eraser);
        break;
      case '1':
        updatePaintColor(colors.sand);
        break;
      case '2':
        updatePaintColor(colors.rock);
        break;
      case '3':
        updatePaintColor(colors.level1);
        break;
      case '4':
        updatePaintColor(colors.level2);
        break;
      case '5':
        updatePaintColor(colors.level3);
        break;
      case '6':
        updatePaintColor(colors.water);
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
      case '{':
        brushSize = Math.max(brushSize - 1, 1);
        updateBrush();
        break;
      case ']':
      case '}':
        brushSize = Math.max(brushSize + 1, 1);
        updateBrush();
        break;
      case 'l':
        brushSweep = !brushSweep;
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
      case 'backspace':
      case 'delete':
        toolState.deleteSelection();
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

        // temp
  //    case 'u':
  //      tracemap.opacity = Math.min(1, tracemap.opacity + 0.2);
  //      break;
  //    case 'h':
  //      tracemap.visible = !tracemap.visible;
  //      break;
  //    case 'j':
  //      tracemap.opacity = Math.max(0, tracemap.opacity -0.2);
  //      break;
      case 'k':
        Object.values(state.drawing).forEach(function(path) {
          path.selected = !path.selected;
        });
        break;
    }
    if (prevActiveTool == toolState.activeTool) {
      toolState.activeTool.definition.onKeyDown(event);
    }
  };

  //mapOverlayLayer.activate();
  //var tracemap = new Raster('img/tracemap.png');
  //tracemap.locked = true;
  //tracemap.position = new Point(55.85, 52.2);
  //tracemap.scaling = new Point(0.082, .082);
  //tracemap.opacity = 0.3;

  function removeFloatingPointError(f) {
    return (Math.abs(f - Math.round(f)) < 0.00001) ? Math.round(f) : f;
  }
  function encodePoint(p) {
    return [removeFloatingPointError(p.x), removeFloatingPointError(p.y)];
  }

  function encodeMap() {

    // colors translated from keys => encoded name
    var encodedDrawing = {};
    Object.keys(state.drawing).forEach(function(colorKey) {
      var pathItem = state.drawing[colorKey];
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
      var encodedColorName = colors[colorKey].name;
      encodedDrawing[encodedColorName] = p;
    });

    var o = {
      version: 0,
      objects: objectMap(state.objects, function(object) {
        return encodeObject(object);
      }),
      drawing: encodedDrawing,
    }
    return JSON.stringify(o);
  }

  function decodeMap(json) {
    mapLayer.activate();

    // colors translated from encoded name => keys
    var decodedDrawing = {};
    Object.keys(json.drawing).forEach(function(colorName) {
      var colorData = getColorDataFromEncodedName(colorName);
      var pathData = json.drawing[colorName];

      // if array of arrays, make compound path
      var p;
      if (pathData.length == 0) {
        p = new Path();
      }
      else if (typeof pathData[0][0] == 'number') {
        // normal path
        p = new Path(pathData.map(function(p) {return new Point(p);}));
      } else {
        p = new CompoundPath({
          children: pathData.map(function(pathData) {
            return new Path(pathData.map(function(p) {return new Point(p);}));
          }),
        });
      }
      p.locked = true;
      p.fillColor = colorData.color;
      decodedDrawing[colorData.key] = p;
    });

    return {
      version: json.version,
      drawing: decodedDrawing,
      objects: objectMap(json.objects, function(encodedData) {
        return decodeObject(encodedData);
      }),
    };
  }

  // ===============================================
  // PATH DRAWING

  var paintTools = {
    grid: 'grid',
    marquee: 'marquee',
    marqueeDiagonal: 'marqueeDiagonal',
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
        myPath.strokeColor = paintColor.color;
        myPath.strokeWidth = 10;
        break;
    }
  }

  function draw(event) {
    switch (paintTool) {
      case paintTools.grid:
        var isShift = Key.isDown('shift');
        if (!brushLine && isShift) {
          startDrawGrid(event.point);
        } else if (brushLine && !isShift) {
          drawGrid(event.point);
          stopGridLinePreview();
        }
        brushLine = isShift;

        if (brushLine) {
          drawGridLinePreview(event.point);
        } else {
          drawGrid(event.point);
        }
        break;
      case paintTools.marquee:
        break;
      case paintTools.marqueeDiagonal:
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
          if (Key.isDown('shift')) {
            drawGrid(event.point);
          }
          endDrawGrid(event.point);
          stopGridLinePreview();
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
    var coordinate = mapOverlayLayer.globalToLocal(event.point);
    if (toolState.activeTool && toolState.activeTool.tool) {
      var objectData = getObjectData(toolState.activeTool.tool);
      var command = objectCreateCommand(objectData, getObjectCenteredCoordinate(coordinate, toolState.activeTool.tool));
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

  function updateObjectColor(object, colorData) {

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

  var brushSize = 2;
  var brushSegments;
  var brush = new Path();
  var brushOutline = new Path();

  var objectPreview;
  var objectPreviewOutline;

  var brushTypes = {
    rounded: 'rounded',
    square: 'square',
  };
  var brushSweep = true;
  var brushLine = false;
  var brushType = brushTypes.rounded;
  updateBrush();

  function cycleBrushHead() {
    var heads = Object.keys(brushTypes).sort(function(a, b) {
      return a == b ? 0 : a < b ? -1 : 1;
    });
    var index = heads.indexOf(brushType);
    brushType = heads[(index + 1) % heads.length];
  }

  function getObjectCenteredCoordinate(rawCoordinate, objectDefinition){
    // hack for even sized brushes
    var sizeX = objectDefinition.size.width / 2;
    var sizeY = objectDefinition.size.height / 2;
    return (rawCoordinate - new Point(sizeX, sizeY) + new Point(0.5, 0.5)).floor();
  }

  function getBrushCenteredCoordinate(rawCoordinate){
    // hack for even sized brushes
    if (brushSize % 2 == 0)
      return (rawCoordinate + new Point(0.5, 0.5)).floor() - new Point(0.5, 0.5);
    else
      return rawCoordinate.floor();
  }

  function updateBrush() {
    brushSegments = getBrushSegments(brushSize);

    var prevPos = brush.position;
    var prevPosOutline = brushOutline.position;

    brush.layer = uiLayer;
    brush.segments = brushSegments;
    brush.pivot = new Point(brushSize / 2 - 0.5, brushSize / 2 - 0.5);
    brush.position = getBrushCenteredCoordinate(prevPos);
    brush.opacity = 0.6;
    brush.closed = true;
    brush.fillColor = paintColor.color;
    brush.locked = true;

    brushOutline.segments = brushSegments;
    brushOutline.position = prevPosOutline;
    brushOutline.closed = true;
    brushOutline.strokeColor = '#fff';
    brushOutline.strokeWidth = 0.1;
    brushOutline.locked = true;
  }

  function updateObjectPreview() {
    if (toolState.activeTool && toolState.activeTool.tool) {
      var prevPos, prevPosOutline; 
      if (objectPreview && objectPreviewOutline) {
        objectPreview.remove();
        objectPreviewOutline.remove();
        prevPos = objectPreview.position;
        prevPosOutline = objectPreviewOutline.position;
      } else {
        prevPos = new Point(0, 0);
        prevPosOutline = new Point(0, 0);
      }

      var objectData = getObjectData(toolState.activeTool.tool);
      createObjectPreviewAsync(objectData, function(object) {
        objectPreview = object;
        object.locked = true;
        object.elements.bound.strokeColor.alpha = 0.6;
        object.opacity = 0.5;

        objectPreviewOutline = object.elements.bound.clone();
        objectPreviewOutline.strokeColor.alpha = 1;

        //todo: have a function that gets the most recent position of the mouse at any time
        objectPreview.position = prevPos;
        objectPreviewOutline.position = prevPosOutline;
      });
    }
  }

  function updateCoordinateLabel(event) {
    var coordinate = mapOverlayLayer.globalToLocal(event.point);
    //coordinateLabel.content = '' + event.point + '\n' + coordinate.toString();
    //coordinateLabel.position = rawCoordinate;

    brushOutline.position = coordinate;
    brush.position = getBrushCenteredCoordinate(coordinate);

    if (objectPreview) objectPreview.position = getObjectCenteredCoordinate(coordinate, objectPreview.definition);
    if (objectPreviewOutline) objectPreviewOutline.position = coordinate;
  }

  function getBrushSegments(size) {
    // square
    var sizeX = size;
    var sizeY = size;
    var offset = new Point(0, 0);
    if (size == 0) {
      return [
        new Point(0, 0),
        new Point(0, 1),
        new Point(1, 0),
      ];
    }
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
        // return diamond if 2
        if (size == 1) {
          return [
            new Point(0, 0),
            new Point(0, 1),
            new Point(1, 1),
            new Point(1, 0),

            //new Point(0, 0),
            //new Point(0, 10),
            //new Point(10, 10),
            //new Point(10, 9),
            //new Point(1, 9),
            //new Point(1, 1),
            //new Point(10, 1),
            //new Point(10, 0),
          ]
        }
        // return diamond if 2
        if (size == 2) {
          return [
            new Point(1, 0),
            new Point(2, 1),
            new Point(1, 2),
            new Point(0, 1),
          ]
        }

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
  }

  function smoothMap() {
    Object.values(state.drawing).forEach(function(path) {
      path.smooth({ type: 'catmull-rom', factor: 0.9 });
    });
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
      throw 'exception: applyCommand called without an apply direction';
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

  function getColorAtCoordinate(coordinate) {
    // choose the highest elevation color
    // todo - this logic should be elsewhere
    if (toolState.activeTool) {
      var bestColor;

      if (toolState.activeTool.type == toolCategoryDefinition.terrain.type
        || toolState.activeTool.type == toolCategoryDefinition.path.type) {
        var bestColor = colors.water;

        var bestPriority = 0;
        Object.keys(state.drawing).forEach(function(colorKey) {
          var toolCategory;

          var definition = layerDefinition[colorKey] || pathDefinition[colorKey];
          if (!definition) {
            console.log('Unknown color in drawing!');
            return;
          }
          var priority = definition && definition.priority || 0;

          var layer = state.drawing[colorKey];
          if (layer) {
            if (layer.contains(coordinate)) {
              if (priority > bestPriority) {
                bestPriority = priority;
                bestColor = colors[colorKey];
              }
            }
          }
        });
      }
      return bestColor;
    }
  }

  // ===============================================
  // DRAWING METHODS

  //var drawPoints = [];

  var startGridCoordinate;
  var prevGridCoordinate;
  var prevDrawCoordinate;

  var diffCollection = {};

  function halfTriangleSegments(x0, y0, x1, y1, offsetX, offsetY) {
    var xMid = (x0 + x1) / 2;
    var yMid = (y0 + y1) / 2;
    return [
      [x0 + offsetX, y0 + offsetY],
      [xMid + offsetX - Math.sign(offsetX) * 0.5, yMid + offsetY - Math.sign(offsetY) * 0.5],
      [x1 + offsetX, y1 + offsetY]
      ];
  }

  // assumes convex simple polygon with clockwise orientation
  // otherwise I have to simplify the polygon after stretching points
  function sweepPath(path, sweepVector) {
    // find the lines w/ segment normals > 0
    var allFrontEdges = [];
    var frontEdge = [];
    var sweepDirection = sweepVector.normalize();

    if (sweepVector.x == 0 && sweepVector.y == 0) return path;

    var isFirstFront = false;
    var isLastFront = false;

    var potentialPoints = [];
    // go backwards so when I add indices I don't affect the index order
    for (var i = path.segments.length - 1; i >= 0; i--) {
      var p0 = path.segments[i];
      var p1 = path.segments[(i - 1 + path.segments.length) % path.segments.length];
      var normal = path.clockwise
        ? new Point(p0.point.y - p1.point.y, p1.point.x - p0.point.x).normalize()
        : new Point(p1.point.y - p0.point.y, p0.point.x - p1.point.x).normalize();
      var dot = normal.dot(sweepDirection);

      if (dot > 0) {
        if (i == path.segments.length - 1) isFirstFront = true;
        if (i == 0) isLastFront = true;

        if (potentialPoints.length > 0) {
          frontEdge.concat(potentialPoints);
          potentialPoints = [];
        }
        if (frontEdge.length == 0) {
          // if this is the first point found in this edge, also add the start point
          frontEdge.push(p0);
        }
        frontEdge.push(p1);
      }
      // include lines w/ normals == 0 if connected to line > 0
      else if (dot == 0) {
        if (frontEdge.length > 0) {
          potentialPoints.push(p1);
        }
      } else {
        if (frontEdge.length > 0) {
          allFrontEdges.push(frontEdge);
          frontEdge = [];
        }
        if (potentialPoints.length > 0) {
          potentialPoints = [];
        }
      }
    }
    if (frontEdge.length > 0) {
      allFrontEdges.push(frontEdge);
    }

    if (allFrontEdges.length == 0) {
      console.log('Did not find any points to sweep!');
      return path;
    }


    // check if there was a wrap around
    var isWrapped = isFirstFront && isLastFront;
    var skipFirst = allFrontEdges[0].length > 1;
    var skipLast = allFrontEdges[allFrontEdges.length - 1].length > 1;

    var first = true;
    allFrontEdges.forEach(function(frontEdge) {
      // duplicate the first and last point in the edge
      // segments are in reverse index order

      var s0 = frontEdge[0];
      var s1 = frontEdge[frontEdge.length - 1];
      var s0Clone = s0.clone();
      var s1Clone = s1.clone();
      if (!(isWrapped && skipFirst && first)) {
         path.insert(s0.index + 1, s0Clone);
      }
      if (!(isWrapped && skipLast && s1.index == path.segments.length - 1)) {
         path.insert(s1.index, s1Clone);
      }
      frontEdge.forEach(function(s) {
        // there is a duplicate when it wraps around
        if (isWrapped && first) {
          first = false;
        }
        else {
          s.point += sweepVector;
        }
      });
    });
    return path;
  }

  // start/end: lattice Point
  // return: unioned Path/CompoundPath

  //var q = [];
  //q.forEach(function(s){s.remove()});
  //q.push(drawPaths[drawPaths.length - 1].clone());
  //q[q.length - 1].selected = true;


  function drawLine(start, end, sweep) {
    var drawPaths = [];
    if (brushSweep) {
      var p = null;
      var prevDelta = null;
      var prevDrawCoordinate = null;
      var prevDrawLineCoordinate = null;
      doForCellsOnLine(
        Math.round(start.x), Math.round(start.y),
        Math.round(end.x), Math.round(end.y),
        function(x, y) {
          p = new Point(x, y);
          if (prevDrawLineCoordinate == null) {
            prevDrawLineCoordinate = p;
          }
          else if (p != prevDrawCoordinate) {
            var delta = p - prevDrawCoordinate;
            if (prevDelta != null && delta != prevDelta) {
              path = getDrawPath(prevDrawCoordinate);
              drawPaths.push(sweepPath(path, prevDrawLineCoordinate - prevDrawCoordinate));  
              prevDrawLineCoordinate = prevDrawCoordinate;
            }
            prevDelta = delta;
          }
          prevDrawCoordinate = p;
        });
      path = getDrawPath(p);
      drawPaths.push(sweepPath(path, prevDrawLineCoordinate - p));
    }
    else {
      // stamping
      doForCellsOnLine(
        Math.round(start.x), Math.round(start.y),
        Math.round(end.x), Math.round(end.y),
        function(x, y) {
          var p = new Point(x, y);
          if (p != prevDrawCoordinate) {
            drawPaths.push(getDrawPath(p));
            prevDrawCoordinate = p;
          }
        });
    }
    var linePath;
    if (drawPaths.length == 1) {
      linePath = drawPaths[0];
    }
    else if (drawPaths.length > 1) {
      var compound = new CompoundPath({children: drawPaths});
      linePath = uniteCompoundPath(compound);
    }
    return linePath;
  }

  // todo: merge this with the other preview code
  var drawPreview;
  function drawGridLinePreview(viewPosition) {
    var rawCoordinate = new Point(mapLayer.globalToLocal(viewPosition));
    coordinate = getBrushCenteredCoordinate(rawCoordinate);

    mapLayer.activate();
    if (drawPreview) {
      drawPreview.remove();
    }
    if (startGridCoordinate == null)
      startDrawGrid(viewPosition);
    drawPreview = drawLine(coordinate, startGridCoordinate);
    if (drawPreview) {
      drawPreview.locked = true;
      drawPreview.opacity = 0.6;
      drawPreview.fillColor = paintColor.color;
    }
  }

  function stopGridLinePreview() {
    if (drawPreview)
      drawPreview.remove();
  }

  function startDrawGrid(viewPosition) {
    mapLayer.activate();
    var coordinate = new Point(mapLayer.globalToLocal(viewPosition));
    coordinate = getBrushCenteredCoordinate(coordinate);
    startGridCoordinate = coordinate;
    prevGridCoordinate = coordinate;
    drawGrid(viewPosition);
  }

  function drawGrid(viewPosition) {
    mapLayer.activate();
    var rawCoordinate = new Point(mapLayer.globalToLocal(viewPosition));
    coordinate = getBrushCenteredCoordinate(rawCoordinate);

    if (prevGridCoordinate == null)
      startDrawGrid(viewPosition);
    var path = drawLine(coordinate, prevGridCoordinate);
    if (path) {
      var diff = getDiff(path, paintColor.key);

      Object.keys(diff).forEach(function(colorKey) {
        var colorDiff = diff[colorKey];
        if (!diffCollection.hasOwnProperty(colorKey)) {
          diffCollection[colorKey] = {isAdd: colorDiff.isAdd, path: []};
        }
        diffCollection[colorKey].path.push(colorDiff.path);
        if (diffCollection[colorKey].isAdd != colorDiff.isAdd) {
          console.logError('Simultaneous add and remove for ' + colorKey);
        }
      });
      applyDiff(true, diff);
    }

    prevGridCoordinate = coordinate;
  }

  function endDrawGrid(viewPosition) {
    var mergedDiff = {};
    prevGridCoordinate = null;
    startGridCoordinate = null;
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

  function getDrawPath(coordinate) {
    var p = new Path(brushSegments);
    p.pivot = new Point(brushSize / 2 - 0.5, brushSize / 2 - 0.5);
    p.position = getBrushCenteredCoordinate(coordinate);
    return p;
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

  function pointApproximates(p0, p1) {
    return Math.abs(p0.x - p1.x) < 0.001 && Math.abs(p0.y - p1.y) < 0.001;
  }

  function getDiff(path, colorKey) {
    if (!path.children && path.segments.length < 3) return {};

    // figure out which layers to add and subtract from
    var definition = layerDefinition[colorKey] || pathDefinition[colorKey];

    // limit the path to the union of the shape on each layer
    if (definition.requireLayer) {
      var union = path.intersect(state.drawing[definition.requireLayer]);
      path.remove();
      path = union;
    }

    var editLayers = {};
    if (definition.addLayers)
      definition.addLayers.forEach(function(colorKey) { editLayers[colorKey] = true;});
    if (definition.cutLayers)
      definition.cutLayers.forEach(function(colorKey) { editLayers[colorKey] = false;});

    var diff = {};
    Object.keys(editLayers).forEach(function(colorKey) {
      var isAdd = editLayers[colorKey];

      var delta = isAdd
        ? path.subtract(state.drawing[colorKey])
        : path.intersect(state.drawing[colorKey]);

      // search for invalid points caused by overlapping diagonals
      // todo: for free drawing, remove this check
      var deltaSubPaths = delta.children ? delta.children : [delta];
       deltaSubPaths.forEach(function(p) {
         correctPath(p, state.drawing[colorKey]);
       });

      if (delta.children || (delta.segments && delta.segments.length > 0)) {
        diff[colorKey] = {
          isAdd: isAdd,
          path: delta,
        };
      }
      delta.remove();
    });

    return diff;
  }

  function correctPath(path, receivingPath) {
    path.segments.forEach(function(segment) {
      var point = segment.point;
      var isSegmentInvalid = (getDistanceFromWholeNumber(point.x) > 0.1) || (getDistanceFromWholeNumber(point.y) > 0.1);
      if (!isSegmentInvalid) return;

      var prevIndex = (segment.index - 1 + path.segments.length) % path.segments.length;
      var nextIndex = (segment.index + 1) % path.segments.length;
      var prevPoint = path.segments[prevIndex].point;
      var nextPoint = path.segments[nextIndex].point;

      // todo: this assumes the problem point is always at .5, which may not be true in degenerate cases
      var possiblePoint1 = point - new Point(0.5 * Math.sign(prevPoint.x - point.x), 0.5 * Math.sign(prevPoint.y - point.y));
      var possiblePoint2 = point - new Point(0.5 * Math.sign(nextPoint.x - point.x), 0.5 * Math.sign(nextPoint.y - point.y));

      if (pointApproximates(receivingPath.getNearestPoint(possiblePoint1), possiblePoint1)) {
        var crossPoint = possiblePoint2 - new Point(Math.sign(possiblePoint2.x - point.x), Math.sign(possiblePoint2.y - point.y));
        path.insert(nextIndex, crossPoint);
        segment.point = possiblePoint1;
      }
      else {
        var crossPoint = possiblePoint1 - new Point(Math.sign(possiblePoint1.x - point.x), Math.sign(possiblePoint1.y - point.y));
        path.insert(prevIndex + 1, crossPoint);
        segment.point = possiblePoint2;
      }
    });
  }

  function applyDiff(isApply, diff) {
    // todo: weird location
    if (isApply) prevDrawCoordinate = null;
    Object.keys(diff).forEach(function(colorKey) {
      var colorDiff = diff[colorKey]
      var isAdd = colorDiff.isAdd;
      if (!isApply) isAdd = !isAdd; // do the reverse operation
      addPath(isAdd, colorDiff.path, colorKey);
    })
  }

  function addPath(isAdd, path, colorKey) {
    mapLayer.activate();
    if (!state.drawing.hasOwnProperty(colorKey)) {
      state.drawing[colorKey] = new Path();
      state.drawing[colorKey].locked = true;
    }
    var combined = isAdd
      ? state.drawing[colorKey].unite(path)
      : state.drawing[colorKey].subtract(path);
    combined.locked = true;
    combined.fillColor = colors[colorKey].color;
    combined.insertAbove(state.drawing[colorKey]);

    state.drawing[colorKey].remove();
    path.remove();

    state.drawing[colorKey] = combined;
  }


  function initializeApp() {
    toolState.switchToolType(toolCategoryDefinition.terrain.type);
    updatePaintColor(colors.level1);
  }
  initializeApp();

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
     var dx = Math.abs(x1 - x0);
     var dy = Math.abs(y1 - y0);
     var sx = (x0 < x1) ? 1 : -1;
     var sy = (y0 < y1) ? 1 : -1;
     var err = dx - dy;

     while(true) {
        setPixel(x0, y0); // Do what you need to for this

        if ((x0 === x1) && (y0 === y1)) break;
        var e2 = 2*err;
        if (e2 > -dy) { err -= dy; x0 += sx; x0 = Math.round(x0);}
        if (e2 < dx) { err += dx; y0 += sy; y0 = Math.round(y0);}
     }
  }


  // interval = 0.2
  function doForCellsOnLinePerInterval(x0, y0, x1, y1, interval, setPixel) {
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

  function maxMagnitude(/* arguments */) {
    var maxIndex = null;
    var maxValue = -1;
    for (var i = 0; i < arguments.length; i++) {
      var abs = Math.abs(arguments[i]);
      if (abs > maxValue) {
        maxIndex = i;
        maxValue = abs;
      }
    }
    if (maxIndex == null) return null;
    return arguments[maxIndex];
  }
