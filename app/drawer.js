  var backgroundLayer = project.activeLayer;
  var mapLayer = new Layer();
  var mapIconLayer = new Layer();
  var mapOverlayLayer = new Layer();
  var uiLayer = new Layer();
  var fixedLayer = new Layer();
  var cloudLayer = new Layer();
  var modalLayer = new Layer();
  backgroundLayer.applyMatrix = false;
  cloudLayer.applyMatrix = false;
  fixedLayer.applyMatrix = false;
  modalLayer.applyMatrix = false;

  mapLayer.applyMatrix = false;
  mapLayer.pivot = new Point(0, 0);
  mapIconLayer.applyMatrix = false;
  mapIconLayer.pivot = new Point(0, 0);
  mapOverlayLayer.applyMatrix = false;
  mapOverlayLayer.pivot = new Point(0, 0);

  var emitter = mitt();

  // if you want to rename a color, you must add a name parameter with the old name
  // otherwise backwards compatibility for encoding/decoding will break
  var colors = {
    invisible: {color: 'rgba(0, 0, 0, 0.00001)'},

    // terrain color
    water: {color:'#83e1c3'},
    sand: {color:'#eee9a9'},
    level1: {color:'#347941'},
    level2: {color:'#35a043'},
    level3: {color:'#4ac34e'},
    rock: {color:'#737a89'},
    campground: {color:'#b0a280'},
    townsquare: {color:'#E2AA78'},

    // paths
    pathDirt: {color:'#d5ac71'},
    pathSand: {color:'#f9df96'},
    pathStone: {color: '#999a8c'},
    pathBrick: {color: '#e38f68'},
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
    paperOverlay: {color: '#ecebd5'},
    paperOverlay2: {color: '#e4e2d0'},

    // colors from nookPhone (colors are hued towards red/yellow)
    purple: {color: "#be84f0"},
    blue: {color: "#8c97ec"},
    lightBlue: {color: "#b4bdfd"},
    orange: {color: "#df8670"},
    magenta: {color: "#f550ab"},
    pink: {color: "#f09eb3"},
    cyan: {color: "#63d5bf"},
    turquoise: {color: "#86e0bb"},
    green: {color: "#8dd08a"},
    lime: {color: "#d2e541"},
    red: {color: "#ee666e"},
    offBlack: {color: "#4b3b32"},
    offWhite: {color: "#f6f2e0"},
    lightText: {color: "#dcd8ca"},
    text: {color: "#726a5a"},
    yellow: {color: "#f5d830"},
    lightYellow: {color: "#f7e676"},
    lightBrown: {color: "#bfab76"},

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
    cutLayers: [colors.pathBrick.key, colors.pathSand.key, colors.pathStone.key],
    //requireLayer: colors.sand.key, // sand is always drawn below everything else
  }
    pathDefinition[colors.pathStone.key] = {
    priority: 100,
    addLayers: [colors.pathStone.key],
    cutLayers: [colors.pathBrick.key, colors.pathDirt.key, colors.pathSand.key],
    //requireLayer: colors.sand.key, // sand is always drawn below everything else
  }
  pathDefinition[colors.pathBrick.key] = {
    priority: 100,
    addLayers: [colors.pathBrick.key],
    cutLayers: [colors.pathDirt.key, colors.pathSand.key, colors.pathStone.key],
    //requireLayer: colors.sand.key, // sand is always drawn below everything else
  }
  pathDefinition[colors.pathSand.key] = {
    priority: 100,
    addLayers: [colors.pathSand.key],
    cutLayers: [colors.pathBrick.key, colors.pathDirt.key, colors.pathStone.key],
    //requireLayer: colors.sand.key, // sand is always drawn below everything else
  }
  pathDefinition[colors.pathEraser.key] = {
    cutLayers: [colors.pathBrick.key, colors.pathDirt.key, colors.pathSand.key, colors.pathStone.key],
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

  // menuOptions
  // spacing: float
  // columnSpacing: float
  // perColumn: int
  // horizontal: bool
  // menuWidth: float
  // noPointer: bool
  // margin : float
  // extraColumns: bool
  // extraRows: bool

  function createMenu(items, options) {
    var itemsCount = Object.keys(items).length;
    var spacing = options.spacing == null ? 50 : options.spacing;
    var perColumn = options.perColumn == null ? itemsCount : options.perColumn;
    var extraColumns = options.extraColumns == null ? 0 : options.extraColumns;
    var extraRows = options.extraRows == null ? 0 : options.extraRows;
    var columnSpacing = options.columnSpacing == null ? 60 : options.columnSpacing;
    var horizontal = options.horizontal == null ? false : options.horizontal;
    var noPointer = options.noPointer == null ? false : options.noPointer;
    var margin = options.margin == null ? 35 : options.margin;
    var i = 0;
    var iconMenu = new Group();

    var columns = Math.ceil(itemsCount / perColumn) + extraColumns;

    var menuLongPosition = -margin;
    var menuShortPosition = -0.5 * columnSpacing;
    var menuLongDimension = 2 * margin + spacing * (perColumn - 1 + extraRows);
    var menuShortDimension = columnSpacing * columns;
    var backing = new Path.Rectangle(
      new Rectangle(
        horizontal ? menuLongPosition : menuShortPosition, 
        horizontal ? menuShortPosition : menuLongPosition,
        horizontal ? menuLongDimension : menuShortDimension,
        horizontal ? menuShortDimension : menuLongDimension),
        Math.min(columnSpacing / 2, 30));
    backing.fillColor = colors.paper.color;

    var triangle;
    if (!noPointer) {
      triangle = new Path.RegularPolygon(new Point(0, 0), 3, 14);
      triangle.fillColor = colors.paper.color;
      triangle.rotate(-90);
      triangle.scale(0.5, 1)
      // respond to horizontal
      triangle.position -= new Point(30 + 3.5, 0);
    } else {
      triangle = new Path();
    }
    iconMenu.addChildren([backing, triangle]);

    var buttonMap = objectMap(items, function(item, name) {
      var column = Math.floor(i / perColumn);
      var buttonLongDimension = spacing * (i - column * perColumn);
      var buttonShortDimension = columnSpacing * (column + extraColumns);
      item.position = new Point(
        horizontal ? buttonLongDimension : buttonShortDimension,
        horizontal ? buttonShortDimension : buttonLongDimension);
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


  var brushSizeUI;
  function showBrushSizeUI(isShown) {
    if (brushSizeUI == null) {
      var group = new Group();
      group.applyMatrix = false;
      var brushPreview = new Path();
      if (brushSegments) {
        brushPreview.segments = brushSegments;
      }
      brushPreview.fillColor = paintColor.color;
      brushPreview.strokeColor = colors.lightText.color;
      brushPreview.strokeWidth = 0.1;
      

      brushSizeText = new PointText(0, 28);
      brushSizeText.fontFamily = 'TTNorms, sans-serif';
      brushSizeText.fontSize = 14;
      brushSizeText.fillColor = colors.text.color;
      brushSizeText.justification = 'center';

      emitter.on('updateBrush', update)
      function update() {
        if (brushSegments) {
          brushPreview.segments = brushSegments;
          brushPreview.bounds.height = Math.min(30, 5 * brushPreview.bounds.height);
          brushPreview.bounds.width = Math.min(30, 5 * brushPreview.bounds.width);
          brushPreview.position = new Point(0, 0);
        }
        brushSizeText.content = brushSize;
      }
      update();

      function brushButton(path, onPress) {
        var icon = new Raster(path);
        icon.scaling = 0.45;
        return createButton(icon, 20, onPress, {
          highlightedColor: colors.paperOverlay.color,
          selectedColor: colors.paperOverlay2.color,
        });
      }
      function brushLineButton(path, onPress) {
        var icon = new Raster(path);
        icon.scaling = 0.45;
        return createButton(icon, 20, onPress, {
          highlightedColor: colors.paperOverlay.color,
          selectedColor: colors.yellow.color,
        });
      }

      var increaseButton = brushButton('img/ui-plus.png', incrementBrush);
      var decreaseButton = brushButton('img/ui-minus.png', decrementBrush);
      increaseButton.position = new Point(0, 70);
      decreaseButton.position = new Point(0, 110);

      var drawLineButton = brushLineButton('img/menu-drawline.png', function() {
        setBrushLineForce(true);
      });
      var drawBrushButton = brushLineButton('img/menu-drawbrush.png', function() {
        setBrushLineForce(false);
      });
      emitter.on('updateBrushLineForce', updateBrushLineButton);
      function updateBrushLineButton(isBrushLine) {
        drawLineButton.data.select(isBrushLine);
        drawBrushButton.data.select(!isBrushLine);
      }
      updateBrushLineButton(brushLineForce);

      drawLineButton.position = new Point(0, 210);
      drawBrushButton.position = new Point(0, 170);

      var backingWidth = 42;
      var brushSizeBacking = new Path.Rectangle(-backingWidth / 2, 0, backingWidth, 153, backingWidth / 2);
      brushSizeBacking.strokeColor = colors.paperOverlay2.color;
      brushSizeBacking.strokeWidth = 2;
      brushSizeBacking.position += new Point(0, -22);

      var brushLineBacking = new Path.Rectangle(-backingWidth / 2, 0, backingWidth, 82, backingWidth / 2);
      brushLineBacking.strokeColor = colors.paperOverlay2.color;
      brushLineBacking.strokeWidth = 2;
      brushLineBacking.position += new Point(0, 149);

      group.addChildren([brushPreview, brushSizeText,
        brushSizeBacking, increaseButton, decreaseButton,
        brushLineBacking, drawLineButton, drawBrushButton]);
      group.pivot = new Point(0, 0);
      group.position = new Point(105, 55);
      brushSizeUI = group;
    }
    brushSizeUI.bringToFront();
    brushSizeUI.visible = isShown;
  }

  var atomicObjectId = 0;

  function encodeObjectGroups(objects) {
    var objectGroups = {};
    Object.values(objects).forEach(function(object) {
      var key = object.data.category + "_" + object.data.type;
      if (!objectGroups[key]) {
        objectGroups[key] = [];
      }
      var encodedPoint = encodePoint(object.position);
      objectGroups[key].push(encodedPoint[0], encodedPoint[1]);
    });
    return objectGroups;
  }

  function decodeObjectGroups(objectGroups, encodingVersion) {
    if (encodingVersion == 0) {
      return objectMap(objectGroups, function(encodedData) {
        return decodeObject(encodedData, version);
      });
    }

    var objects = {};
    Object.keys(objectGroups).forEach(function(key) {
      var keySplit = key.split('_');
      var category = keySplit[0],
        type = keySplit[1];
      var positionArray = objectGroups[key];
      for(var i = 0; i < positionArray.length; i += 2) {
        decodeObject({
          category: category,
          type: type,
          position: [positionArray[i], positionArray[i + 1]],
        }, encodingVersion);
      }
    });
    return objects;
  }

  function decodeObject(encodedData, encodingVersion) {
    var position = new Point(encodedData.position);
    var objectData = {
      category: encodedData.category,
      type: encodedData.type,
    };
    // for legacy or renamed objects, rename them
    if (toolCategoryDefinition[encodedData.category].tools && toolCategoryDefinition[encodedData.category].tools.value) {
      var objectDefinition = toolCategoryDefinition[encodedData.category].tools.value[objectData.type];
      if (objectDefinition.legacy) {
        objectData.type = objectDefinition.legacy;
      }
      if (objectDefinition.legacyCategory) {
          objectData.category = objectDefinition.legacyCategory;
        }
      if (objectDefinition.rename) {
        if (encodingVersion <= objectDefinition.rename[0]) {
          objectData.type = objectDefinition.rename[1];
        }
      }
    }

    applyCommand(objectCreateCommand(objectData, position), true);
    return {
      position: position,
      category: encodedData.category,
      type: encodedData.type,
    };
  }

  function getObjectData(objectDefinition) {
    return {
      category: objectDefinition.category,
      type: objectDefinition.type,
    };
  }

  function createObjectIcon(objectDefinition, itemData) {
    var item = objectDefinition.icon.clone({insert: false});
    if (objectDefinition.colorData) {
      item.fillColor = objectDefinition.colorData.color;
    }
    return item;
  }

  function createObjectBase(objectDefinition, itemData) {
    var item = createObjectIcon(objectDefinition, itemData);
    item.scaling = objectDefinition.scaling;

    if (item.resolution) {
      item = new Group(item);
    }

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
    group.showDeleteButton = function(show) {
      var deleteButton = group.data.deleteButton;

      if (show && deleteButton == null) {
        var icon = new Raster('img/ui-x.png');
        icon.scaling = 0.03;

        var buttonBacking = new Path.Circle(0, 0, 0.9);
        buttonBacking.fillColor = colors.offWhite.color;
        var button = createButton(icon, 0.8, function(event) {group.onDelete(); event.stopPropagation();});
        var deleteButton = new Group();
        deleteButton.applyMatrix =  false;
        deleteButton.addChildren([buttonBacking, button]);
        group.addChild(deleteButton);
        deleteButton.position = this.elements.bound.bounds.topRight;
        group.data.deleteButton = deleteButton;
      }
      if (!show && deleteButton != null) {
        deleteButton.remove();
        group.data.deleteButton = null;
      }
    };
    group.onSelect = function(isSelected) {
      if (group.state.selected != isSelected) {
        this.state.selected = isSelected;
        this.elements.bound.strokeWidth = isSelected ? 0.2 : 0.1;
        this.elements.bound.strokeColor = isSelected ? colors.selection.color : 'white';
        this.elements.bound.strokeColor.alpha = group.state.focused ? 1 : 0;

        group.showDeleteButton(isSelected);
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
      if (prevPosition != coordinate.position) {
        dropObject(coordinate, this, prevPosition);
      }
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
    emitter.emit('resize', event);
  }

  tool.minDistance = 1;

  var prevViewMatrix = view.matrix.clone();

  var inverted = view.matrix.inverted();
  fixedLayer.activate();

//  cloudLayer.matrix = view.matrix.inverted();
//  cloudLayer.scale(2, view.projectToView(new Point(0, 0)));
//  cloudLayer.bounds.topLeft = view.projectToView(new Point(0, 0));
  function onFrame() {
    if (!view.matrix.equals(prevViewMatrix)) {
      var inverted = view.matrix.inverted();
      backgroundLayer.matrix = inverted;

      fixedLayer.matrix = inverted;
      modalLayer.matrix = inverted;
      prevViewMatrix = view.matrix.clone();

//      // clouds shift w/ parallax while scrolling
//      cloudLayer.matrix = inverted;
//      cloudLayer.scale(2, view.projectToView(new Point(0, 0)));
//      cloudLayer.bounds.topLeft = view.projectToView(new Point(0, 0));
    }
    //fixedLayer.pivot = new Point(0, 0);
   // fixedLayer.position = view.viewSize.topLeft;
    //var inverseZoom = 1 / view.zoom;
    
    //fixedLayer.scaling = new Point(inverseZoom, inverseZoom);
  }
  mapLayer.activate();

  // ===============================================
  // BACKGROUND

//  cloudLayer.activate();
//  for (var i = 0; i < 20; i ++) {
//    var cloud = new Raster('img/cloud1.png');
//    cloud.position = new Point((i % 2 + 2) * 120, (i % 2 + 3) * 120);
//  }

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
    if (isSpaceDown) return;
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
    if (isSpaceDown) return;
    if (toolState.toolIsActive)
      toolState.activeTool.definition.onMouseDrag(event);
  }
  onMouseUp = function onMouseUp(event) {
    if (isSpaceDown) return;
    toolState.onUp(event);
    if (toolState.toolIsActive)
      toolState.activeTool.definition.onMouseUp(event);
  }

  function drawBackground() {

    var topLeft = new Point(0, 0);// + view.bounds.topLeft;
    var center = new Point(view.bounds.width , view.bounds.height * view.scaling.y / 2);// + view.bounds.topLeft * 2;
    var bottomRight = new Point(view.bounds.width * view.scaling.x, view.bounds.height * view.scaling.y);// + view.bounds.topLeft * 2;

    backgroundRect.segments = [
      new Point(0, 0),
      new Point(view.size.width * view.scaling.x, 0),
      new Point(view.size.width * view.scaling.x, view.size.height * view.scaling.y),
      new Point(0, view.size.height * view.scaling.y),
    ];
    mapLayer.activate();
  }

  function jumpTween(item) {
    item.Tween()
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
    mapJson = LZString.compress(mapJson);

    var saveMargins = new Point(10, 10);

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
    text.fontFamily = 'TTNorms, sans-serif';
    text.fillColor = colors.oceanDark.color;
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

            var json;
            try {
              var json = JSON.parse(mapJSONString);
            } catch(e) {
              var json = JSON.parse(LZString.decompress(mapJSONString))
            }
            var map = decodeMap(json);

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

  // highlightedColor: string
  // selectedColor: string

  function createButton(item, buttonSize, onClick, options) {

    var highlightedColor = (!options || options.highlightedColor == null) ? colors.sand.color : options.highlightedColor;
    var selectedColor = (!options || options.selectedColor == null) ? colors.npc.color : options.selectedColor;

    var group = new Group();

    var button = new Path.Circle(0, 0, buttonSize);

    group.applyMatrix = false;
    group.addChildren([button, item]);

    function updateColor() {
      button.fillColor = group.data.selected || group.data.pressed
        ? selectedColor
        : highlightedColor;
      button.fillColor.alpha = group.data.selected ? 1
        : group.data.pressed ? 0.5 
        : (group.data.hovered ? 1 : 0.0001);
    }
    updateColor();

    group.data = {
      selected: false,
      hovered: false,
      pressed: false,
      disabled: false,
      select: function(isSelected) {
        group.data.selected = isSelected;
        updateColor();
      },
      hover: function(isHover) {
        group.data.hovered = isHover;
        updateColor();
      },
      press: function(isPressed) {
        group.data.pressed = isPressed;
        updateColor();
      },
      disable: function(isDisabled) {
        group.data.disabled = isDisabled;
        item.opacity = isDisabled ? 0.5 : 1;
        if (isDisabled) group.data.hover(false);
      },
    }
    group.onMouseEnter = function(event) {
      if (group.data.disabled) return;
      group.data.hover(true);
    }
    group.onMouseLeave = function(event) {
      if (group.data.disabled) return;
      group.data.press(false);
      group.data.hover(false);
    }
    group.onMouseDown = function(event) {
      if (group.data.disabled) return;
      group.data.press(true);
    }
    group.onMouseUp = function(event) {
      if (group.data.disabled) return;
      if (group.data.pressed)
        onClick(event, group);
      group.data.press(false);
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

  function renderModal(name, width, height, onDismiss) {
    var topLeft = new Point(0, 0);// + view.bounds.topLeft;
    var center = new Point(view.bounds.width * view.scaling.x / 2, view.bounds.height * view.scaling.y / 2);// + view.bounds.topLeft * 2;
    var bottomRight = new Point(view.bounds.width * view.scaling.x, view.bounds.height * view.scaling.y);// + view.bounds.topLeft * 2;

    modalLayer.activate();

    var group = new Group;

    var darkFill = new Path.Rectangle(new Rectangle(topLeft, bottomRight));
    darkFill.fillColor = colors.offBlack.color;
    darkFill.fillColor.alpha = 0.3;
    darkFill.onMouseUp = onDismiss;

    var modal = new Path.Rectangle(new Rectangle(
      center.x - width / 2, 
      center.y - height / 2, width, height), 60);
    modal.fillColor = colors.paper.color;
    modal.onMouseEnter = function(event) {
      group.data.text.content = name;
    }

    var modalContents = new Group();
    modalContents.applyMatrix = false;
    modalContents.pivot = new Point(0, 0);
    modalContents.position = modal.bounds.topLeft + new Point(40, 120);
    modalContents.data = {
      addElement: function () {

      },
    }

    group.data = {
      width: modal.bounds.width - 40 * 2,
      height: modal.bounds.height - 120 - 40,
      contents: modalContents,
    };

    emitter.on('resize', function() {
      var topLeft = new Point(0, 0);// + view.bounds.topLeft;
      var center = new Point(view.bounds.width * view.scaling.x / 2, view.bounds.height * view.scaling.y / 2);// + view.bounds.topLeft * 2;
      var bottomRight = new Point(view.bounds.width * view.scaling.x, view.bounds.height * view.scaling.y);// + view.bounds.topLeft * 2;

      //var topLeft = view.viewToProject(view.projectToView(new Point(0, 0)));// + view.bounds.topLeft;
      //var center = view.viewToProject(view.projectToView(new Point(view.bounds.width / 2, view.bounds.height / 2)));// + view.bounds.topLeft * 2;
      //var bottomRight = view.viewToProject(view.projectToView(new Point(view.bounds.width, view.bounds.height)));// + view.bounds.topLeft * 2;

      darkFill.bounds = new Rectangle(topLeft, bottomRight);
      modal.position = center;
      modalContents.position = modal.bounds.topLeft + new Point(40, 135);
    })

    var text = new PointText(new Point(group.data.width / 2, -50));
    text.justification = 'center';
    text.content = name,
    text.fontSize = 20;
    text.fontFamily = 'TTNorms, sans-serif';
    text.fillColor = colors.text.color;
    modalContents.addChild(text);

    var statusBar = new Raster('img/ui-phonestatus.png');
    statusBar.scaling = 0.35;
    statusBar.position = new Point(group.data.width / 2 - 10, -93);
    modalContents.addChild(statusBar);

    var time = new PointText(new Point(group.data.width / 2, -90));
    time.justification = 'center';
    time.fontSize = 12;
    time.fontFamily = 'TTNorms, sans-serif';
    time.fillColor = colors.lightText.color;
    time.content = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    setInterval(function() {
      time.content = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }, 10000);
    modalContents.addChild(time);

    group.addChildren([darkFill, modal, modalContents]);

    group.data.text = text;

    return group;
  }

  var helpMenu;
  function showHelpMenu(isShown) {
    if (helpMenu == null) {
      helpMenu = renderModal('Hotkeys', 340, 560, function() {showHelpMenu(false)});
      helpMenu.onMouseUp = function() {
        showHelpMenu(false);
      }

      var helpText = new PointText(new Point(80, -10));
      helpText.justification = 'right';
      helpText.fontSize = 16;
      helpText.fontFamily = 'TTNorms, sans-serif';
      helpText.fillColor = colors.oceanText.color;
      helpText.content = 
        'space+drag\n'+
        'alt+scroll\n'+
        '\\\n'+
        'shift+drag\n'+
        '[ ]\n'+
        'p\n'+
        'alt+click\n'+
        'delete\n'+
        'ctrl + z\n'+
        'ctrl + y\n'+
        '\n'+
        'v\n'+
        'b\n'+
        'n\n'+
        'm\n'+
        '\n'+
        'ctrl + s\n'+
        'ctrl + o\n'+
        'esc\n'+
        '?\n'+
        '';

      var helpText2 = new PointText(new Point(100, -10));
      helpText2.justification = 'left';
      helpText2.fontSize = 16;
      helpText2.fontFamily = 'TTNorms, sans-serif';
      helpText2.fillColor = colors.text.color;
      helpText2.content = 
        'pan\n'+
        'zoom\n'+
        'toggle grid\n'+
        'draw line\n'+
        'adjust brush size\n'+
        'square/circle brush\n'+
        'color pick\n'+
        'delete selection\n'+
        'undo\n'+
        'redo\n'+
        '\n'+
        'terrain tool \n'+
        'path tool\n'+
        'building tool\n'+
        'amenities tool\n'+
        '\n'+
        'save\n'+
        'open map file\n'+
        'main menu\n'+
        'hotkeys\n'+
        '';

      var helpTextRaster = helpText.rasterize();
      var helpText2Raster = helpText2.rasterize();
      helpText.remove();
      helpText2.remove();

      var versionCode = new PointText(helpMenu.data.width / 2, helpMenu.data.height);
      versionCode.justification = 'center';
      versionCode.fontSize = 12;
      versionCode.fontFamily = 'TTNorms, sans-serif';
      versionCode.fillColor = colors.lightText.color;
      versionCode.content = "v0.3a";

      helpMenu.data.contents.addChildren([helpTextRaster, helpText2Raster, versionCode]);

      helpMenu.opacity = 0;
    }
    helpMenu.tweenTo({opacity: isShown ? 1 : 0}, 200);
    helpMenu.locked = !isShown;
  }


  var mainMenu;

  function showMainMenu(isShown) {
    if (mainMenu == null) {
      if (!isShown) return;
      mainMenu = renderModal('Main Menu', 260, 370, function() {showMainMenu(false)});

      var hitSizeHalf = new Point(35, 35);
      var hitSize = new Size(70, 70);
      function createMenuButton(name, img, index, onMouseDown, onMouseEnter) {
        var buttonGroup = new Group();

        var button = new Raster(img);
        button.scaling = new Point(0.4, 0.4);
        button.locked = true;

        var hitTarget = new Path.Rectangle(button.position - hitSizeHalf, hitSize);
        hitTarget.fillColor = colors.invisible.color;

        buttonGroup.applyMatrix = false;
        buttonGroup.addChildren([hitTarget, button]);
        buttonGroup.position = new Point(20 + index * 70, 0);

        buttonGroup.onMouseDown = function(event) {
          onMouseDown();
        };

        buttonGroup.onMouseEnter = function(event) {
          mainMenu.data.text.content = name;

          button.position = new Point(0, 0);
          button.animate([{
            properties: {
                position: {y: "-5"},
                scale: 1.1,
            },
            settings: {
                duration:60,
                easing:'linear',
            }
          },
          {
            properties: {
                position: {y: "+7"},
            },
            settings: {
                duration:60,
                easing:"linear"
            }
          },
          {
            properties: {
                position: {y: "-2"},
            },
            settings: {
                duration:120,
                easing:"linear"
            }
          }]);
        }
        buttonGroup.onMouseLeave = function(event) {
           button.animate({
            properties: {
                scale: 1,
            },
            settings: {
                duration:60,
                easing:'linear',
            }
          });
        }

        return buttonGroup;
      }

      var saveButton = createMenuButton("Save as Image (Ctrl+S)", 'img/menu-save.png', 0,
        function() {saveMapToFile()});
      var loadButton = createMenuButton('Load Map (Ctrl+O)', 'img/menu-open.png', 1,
        function() {loadMapFromFile()});
      var newButton = createMenuButton('New Map', 'img/menu-new.png', 2,
        function() {
          var r = confirm("Clear your map? You will lose all unsaved changes. Make sure you save changes by hitting Ctrl+S before you clear your map.");
          if (r == true) {
            loadTemplate();
          } else { }
        });
      
      var downloaddroidButton = createMenuButton('Download for Android', 'img/menu_androiddownload.png', 3,
        function() {window.open('https://github.com/FlynnFarrow/HappyIslandDesigner/releases/download/androidapp-v1.0-beta/HappyIslandDesigner_Android_1.0_BETA.zip', '_blank')});

      var twitterButton = createMenuButton('Twitter', 'img/menu-twitt.png', 0,
        function() {window.open('https://twitter.com/island_designer', '_blank')});
      twitterButton.position = new Point(0, 210);

      mainMenu.data.contents.addChildren([saveButton, loadButton, newButton, downloaddroidButton, twitterButton]);
      mainMenu.opacity = 0;
    }
    mainMenu.tweenTo({opacity: isShown ? 1 : 0}, 200);
    mainMenu.locked = !isShown;
  }

  var leftToolMenu = new Group();
  leftToolMenu.applyMatrix = false;
  leftToolMenu.position = [30, 0];

  var leftToolMenuBacking = new Path();
  leftToolMenuBacking.strokeColor = colors.paper.color;
  leftToolMenuBacking.strokeWidth = 120;
  leftToolMenuBacking.strokeCap = 'round';
  leftToolMenuBacking.segments = [
    new Point(-30, -0),
    new Point(-30, 480)
  ];
  leftToolMenu.addChild(leftToolMenuBacking);

  var leftToolMenuPosition = new Point(0, 100);
  var leftToolMenuIconHeight = 50;

  function addToLeftToolMenu(icon) {
    if (icon == null) {
//      // create spacer
//      icon = new Path.Rectangle(0, 0, 40, 2);
//      icon.fillColor = colors.lightText.color;
//      icon.position = leftToolMenuPosition - new Point(0, leftToolMenuIconHeight / 4);
//      leftToolMenu.addChild(icon);
      leftToolMenuPosition.y += leftToolMenuIconHeight / 2;
      return;
    }

    icon.position = leftToolMenuPosition;
    leftToolMenu.addChild(icon);
    leftToolMenuPosition.y += leftToolMenuIconHeight;
  }

  var redoButton = undoMenuButton('img/menu-redo.png', function() {redo()});
  var undoButton = undoMenuButton('img/menu-undo.png', function() {undo()});
  var undoMenu = createMenu({
    'undo': undoButton,
    'redo': redoButton,
  }, {spacing: 38, columnSpacing: 45, margin: 23, horizontal: true, noPointer: true}
  );

  function undoMenuButton(path, onPress) {
    var icon = new Raster(path);
    icon.scaling = 0.45;
    return createButton(icon, 20, onPress);
  }
  emitter.on('historyUpdate', updateUndoButtonState);
  function updateUndoButtonState() {
    undoButton.data.disable(!canUndo());
    redoButton.data.disable(!canRedo());
  }
  updateUndoButtonState();

  emitter.on('resize', function() {positionUndoMenu();})
  function positionUndoMenu() {
    undoMenu.position = new Point(view.bounds.width * view.scaling.x, 0) + new Point(-50, 30);
  }
  positionUndoMenu();


  // layout for mobile version
  //var mainMenuButton = new Path.Circle(new Point(view.center.x, 0), 40);
  // mainMenuButtonIcon.position = new Point(view.center.x, 20);

  var mainMenuButton = new Path.Circle(new Point(30, 30), 24);
  mainMenuButton.fillColor = colors.pink.color;
  mainMenuButton.opacity = 0.00001;
  mainMenuButtonIcon = new Group();
  mainMenuButtonIcon.applyMatrix = false;
  mainMenuButtonIcon.position = new Point(30, 30);
  mainMenuButtonIcon.addChildren([
    new Path.Rectangle({point: [-10, -10], size: [20, 4]}),
    new Path.Rectangle({point: [-10, -2], size: [20, 4]}),
    new Path.Rectangle({point: [-10, 6], size: [20, 4]}),
  ]);
  mainMenuButtonIcon.fillColor = colors.text.color;
  mainMenuButtonIcon.locked = true;

  mainMenuButton.onMouseEnter = function(event) {
    mainMenuButton.tweenTo({opacity: 1}, 150);
    mainMenuButtonIcon.tweenTo({fillColor: colors.offWhite.color}, 150);
  }
  mainMenuButton.onMouseLeave = function(event) {
    mainMenuButton.tweenTo({opacity: 0.00001}, 150);
    mainMenuButtonIcon.tweenTo({fillColor: colors.text.color}, 150);
  }
  mainMenuButton.onMouseDown = function(event) {
    mainMenuButtonIcon.fillColor = colors.yellow.color;
  }
  mainMenuButton.onMouseUp = function(event) {
    showMainMenu(true);
    mainMenuButton.onMouseLeave(event);
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
    townhallSprite: {
      img: 'sprite/building-townhall.png',
      menuScaling: new Point(.17, .17),
      scaling: new Point(.023, .023),
      size: new Size(6, 4),
      offset: new Point(-3, -3.6),
      extraObject: function() {
        var baseGround = new Path.Rectangle(new Rectangle(0, 0, 12, 10), 1);
        baseGround.fillColor = colors.townsquare.color;
        baseGround.position = new Point(3, 5);
        return baseGround;
      },
    },
    campsiteSprite: {
      img: 'sprite/building-campsite.png',
      menuScaling: new Point(.17, .17),
      scaling: new Point(.017, .017),
      size: new Size(4, 3),
      offset: new Point(-2, -2.6),
    },
    museumSprite: {
      img: 'sprite/building-museum.png',
      menuScaling: new Point(.17, .17),
      scaling: new Point(.028, .028),
      size: new Size(7, 4),
      offset: new Point(-3.5, -4),
    },
    nookSprite: {
      img: 'sprite/building-nook.png',
      menuScaling: new Point(.17, .17),
      scaling: new Point(.020, .020),
      size: new Size(7, 4),
      offset: new Point(-3.6, -3.6),
    },
    ableSprite: {
      img: 'sprite/building-able.png',
      menuScaling: new Point(.16, .16),
      scaling: new Point(.021, .021),
      size: new Size(5, 4),
      offset: new Point(-2.5, -3.9),
    },
    lighthouseSprite: {
      img: 'sprite/structure-lighthouse.png',
      size: new Size([2, 2]),
      scaling: new Point(.015, .015),
      menuScaling: new Point(.14, .14),
      offset: new Point(-1, -1.85),
    },
    lighthouse: {
      colorData: colors.pin,
      size: new Size([2, 2]),
      menuScaling: new Point(.3, .3),
      offset: new Point(-1, -1.6),
    },
    airportBlue: {
      img: 'sprite/structure/airport.png',
      size: new Size([10, 6]),
      scaling: new Point(.03, .03),
      menuScaling: new Point(.14, .14),
      offset: new Point(-5, -5.5),
    },
    airportRed: {
      img: 'sprite/structure/airport-red.png',
      size: new Size([10, 6]),
      scaling: new Point(.03, .03),
      menuScaling: new Point(.14, .14),
      offset: new Point(-5, -5.5),
    },
    airportYellow: {
      img: 'sprite/structure/airport-yellow.png',
      size: new Size([10, 6]),
      scaling: new Point(.03, .03),
      menuScaling: new Point(.14, .14),
      offset: new Point(-5, -5.5),
    },
    airportGreen: {
      img: 'sprite/structure/airport-green.png',
      size: new Size([10, 6]),
      scaling: new Point(.03, .03),
      menuScaling: new Point(.14, .14),
      offset: new Point(-5, -5.5),
    },

    //legacy
    bridgeVerticalSprite: {
      legacyCategory: 'construction',
      img: 'sprite/structure-bridge-vertical.png',
    },
    bridgeHorizontalSprite: {
      legacyCategory: 'construction',
      img: 'sprite/structure-bridge-horizontal.png',
    },
    rampSprite: {
      legacy: 'stairsStoneLeft',
      legacyCategory: 'construction',
      img: 'sprite/structure-ramp.png',
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
    if (def.img) {
      var img = new Raster(def.img);
      def.icon = img;
      def.icon.onLoad = function() {asyncAmenitiesDefinition.onLoad();}
      img.remove();
    } else {
      loadSvg('amenity-' + type, function(item) {
        //item.pivot += new Point(-2, -3.6);
        def.icon = item;
        asyncAmenitiesDefinition.onLoad();
      });
    }
  });

  var asyncConstructionDefinition = new AsyncObjectDefinition();
    asyncConstructionDefinition.value = {
      bridgeStoneHorizontal: {
        img: 'sprite/construction/bridge-stone-horizontal.png',
        size: new Size(6, 4),
      },
      bridgeStoneVertical: {
        img: 'sprite/construction/bridge-stone-vertical.png',
        size: new Size(4, 6),
      },
      bridgeStoneTLBR: {
        img: 'sprite/construction/bridge-stone-tlbr.png',
        size: new Size(6, 6),
      },
      bridgeStoneTRBL: {
        img: 'sprite/construction/bridge-stone-trbl.png',
        size: new Size(6, 6),
      },
      bridgeWoodHorizontal: {
        img: 'sprite/construction/bridge-wood-horizontal.png',
        size: new Size(6, 4),
      },
      bridgeWoodVertical: {
        img: 'sprite/construction/bridge-wood-vertical.png',
        size: new Size(4, 6),
      },
      bridgeWoodTLBR: {
        img: 'sprite/construction/bridge-wood-tlbr.png',
        size: new Size(6, 6),
      },
      bridgeWoodTRBL: {
        img: 'sprite/construction/bridge-wood-trbl.png',
        size: new Size(6, 6),
      },
      bridgeVerticalSprite: {
        img: 'sprite/structure-bridge-vertical.png',
        menuScaling: new Point(.17, .17),
        scaling: new Point(.026, .026),
        size: new Size(4, 6),
        offset: new Point(-1.5, -5),
      },
      stairsStoneUp: {
        img: 'sprite/construction/stairs-stone-up.png',
        size: new Size(2, 4),
      },
      stairsStoneDown: {
        img: 'sprite/construction/stairs-stone-down.png',
        size: new Size(2, 4),
      },
      stairsStoneLeft: {
        img: 'sprite/construction/stairs-stone-left.png',
        size: new Size(4, 2),
      },
      stairsStoneRight: {
        img: 'sprite/construction/stairs-stone-right.png',
        size: new Size(4, 2),
      },
      stairsWoodUp: {
        img: 'sprite/construction/stairs-wood-up.png',
        size: new Size(2, 4),
      },
      stairsWoodDown: {
        img: 'sprite/construction/stairs-wood-down.png',
        size: new Size(2, 4),
      },
      stairsWoodLeft: {
        img: 'sprite/construction/stairs-wood-left.png',
        size: new Size(4, 2),
      },
      stairsWoodRight: {
        img: 'sprite/construction/stairs-wood-right.png',
        size: new Size(4, 2),
      },
      //legacy
      bridgeHorizontalSprite: {
        img: 'sprite/structure-bridge-horizontal.png',
        menuScaling: new Point(.17, .17),
        scaling: new Point(.026, .026),
        size: new Size(5, 3),
        offset: new Point(-2.8, -2.7),
      },
      rampSprite: {
        legacy: 'stairsStoneRight',
        img: 'sprite/structure-ramp.png',
        menuScaling: new Point(.17, .17),
        scaling: new Point(.026, .026),
        size: new Size(5, 3),
        offset: new Point(-2.8, -2.7),
      },
    };
  Object.keys(asyncConstructionDefinition.value).forEach(function(type) {
    var def = asyncConstructionDefinition.value[type];
    def.category = 'construction';
    def.type = type;
    def.scaling = def.scaling || new Point(.029, .029);
    def.menuScaling = def.menuScaling || new Point(.18, .18);
    def.size = def.size;
    def.offset = def.offset || new Point(-def.size.width / 2, -def.size.height);
    def.onSelect = function(isSelected) {};
    // imnmediately load the assets
    if (def.img) {
      var img = new Raster(def.img);
      def.icon = img;
      def.icon.onLoad = function() {asyncConstructionDefinition.onLoad();}
      img.remove();
    };
  });

  var asyncTreeDefinition = new AsyncObjectDefinition();
  asyncTreeDefinition.value = {
    tree: {
      img: 'sprite/tree/tree.png',
    },
    treeApple: {
      img: 'sprite/tree/tree-apple.png',
    },
    treeCherry: {
      img: 'sprite/tree/tree-cherry.png',
    },
    treeOrange: {
      img: 'sprite/tree/tree-orange.png',
    },
    treePear: {
      img: 'sprite/tree/tree-pear.png',
    },
    treePeach: {
      img: 'sprite/tree/tree-peach.png',
    },
    treeAutumn: {
      img: 'sprite/tree/tree-autumn.png',
    },
    treeSakura: {
      img: 'sprite/tree/tree-sakura.png',
    },
    pine: {
      rename: [0, 'flatPine'],
      img: 'sprite/tree/pine.png',
    },
    palm: {
      rename: [0, 'flatPalm'],
      img: 'sprite/tree/palm.png',
    },
    bamboo: {
      img: 'sprite/tree-bamboo.png',
      menuScaling: new Point(.26, .26),
      scaling: new Point(.02, .02),
      offset: new Point(-.6, -.75),
    },

    flatBush: {
      svg: 'bush',
    },
    flatTree: {
      svg: 'fruit',
    },
    flatPalm: {
      svg: 'palm',
    },
    flatPine: {
      svg: 'pine',
    },
  };
  Object.keys(asyncTreeDefinition.value).forEach(function(type) {
    var def = asyncTreeDefinition.value[type];
    def.category = 'tree';
    def.type = type;
    def.scaling = def.scaling || new Point(.014, .014);
    def.menuScaling = def.menuScaling || new Point(.2, .2);
    def.size = new Size(1, 1);
    def.offset = def.offset || new Point(-def.size.width / 2, -def.size.height + .2);
    def.onSelect = function(isSelected) {};
    // imnmediately load the assets
    if (def.svg) {
      def.colorData = colors.level3;
      def.scaling = new Point(.03, .03);
      def.menuScaling = new Point(.6, .6);
      def.size = def.size || new Size([1, 1]);
      def.offset = def.offset || new Point(-1, -.75);
      def.onSelect = function(isSelected) {};
      // imnmediately load the assets
      {
        loadSvg('tree-' + def.svg, function(item) {
          //item.pivot += new Point(-2, -3.6);
          def.icon = item;
          asyncTreeDefinition.onLoad();
        });
      }
    }
    else if (def.img) {
      var img = new Raster(def.img);
      def.icon = img;
      def.icon.onLoad = function() {asyncTreeDefinition.onLoad();}
      img.remove();
    };
  });

  var asyncFlowerDefinition = new AsyncObjectDefinition();
  asyncFlowerDefinition.value = {
    chrysanthemumWhite: {
      img: 'sprite/flower/chrysanthemum-white.png',
    },
    hyacinthRed: {
      img: 'sprite/flower/hyacinth-red.png',
    },
    hyacinthWhite: {
      img: 'sprite/flower/hyacinth-white.png',
    },
    lilyWhite: {
      img: 'sprite/flower/lily-white.png',
    },
    pansyPurple: {
      img: 'sprite/flower/pansy-purple.png',
    },
    pansyRed: {
      img: 'sprite/flower/pansy-red.png',
    },
    pansyYellow: {
      img: 'sprite/flower/pansy-yellow.png',
    },
    poppyOrange: {
      img: 'sprite/flower/poppy-orange.png',
    },
    poppyRed: {
      img: 'sprite/flower/poppy-red.png',
    },
    poppyWhite: {
      img: 'sprite/flower/poppy-white.png',
    },
    tulipRed: {
      img: 'sprite/flower/tulip-red.png',
    },
    tulipWhite: {
      img: 'sprite/flower/tulip-white.png',
    },
    tulipYellow: {
      img: 'sprite/flower/tulip-yellow.png',
    },
//    weedBush: {
//      img: 'sprite/flower/weed-bush.png',
//    },
//    weedBrush: {
//      img: 'sprite/flower/weed-brush.png',
//    },
    weedClover: {
      img: 'sprite/flower/weed-clover.png',
    },
//    weedCattail: {
//      img: 'sprite/flower/weed-cattail.png',
//    },
//    weedDandelion: {
//      img: 'sprite/flower/weed-dandelion.png',
//    },
  };
  Object.keys(asyncFlowerDefinition.value).forEach(function(type) {
    var def = asyncFlowerDefinition.value[type];
    def.category = 'flower';
    def.type = type;
    def.scaling = def.scaling || new Point(.016, .016);
    def.menuScaling = def.menuScaling || new Point(.65, .65);
    def.size = new Size(1, 1);
    def.offset = def.offset || new Point(-def.size.width / 2, -def.size.height + 0.2);
    def.onSelect = function(isSelected) {};
    if (def.img) {
      var img = new Raster(def.img);
      def.icon = img;
      def.icon.onLoad = function() {asyncFlowerDefinition.onLoad();}
      img.remove();
    };
  });

  var asyncStructureDefinition = new AsyncObjectDefinition();
  asyncStructureDefinition.value = {
    tentRound: {},
    tentTriangle: {},
    tentTrapezoid: {},
    hut: {},
    house: {},
    building: {},
    tentSprite: {
      img: 'sprite/building-tent.png',
      menuScaling: new Point(.17, .17),
      scaling: new Point(.022, .022),
      size: new Size([5,4]),
      offset: new Point(-2.5, -3.6)
    },
    playerhouseSprite: {
      img: 'sprite/building-playerhouse.png',
      menuScaling: new Point(.17, .17),
      scaling: new Point(.022, .022),
      size: new Size([5,4]),
      offset: new Point(-2.5, -3.6)
    },
    houseSprite: {
      img: 'sprite/building-house.png',
      menuScaling: new Point(.17, .17),
      scaling: new Point(.02, .02),
    },
//    houseFlatSprite: {
//      img: 'sprite/building-flathouse.png',
//      menuScaling: new Point(.17, .17),
//      scaling: new Point(.014, .014),
//    },
//    houseOutlineFlatSprite: {
//      img: 'sprite/building-flathouseoutline.png',
//      menuScaling: new Point(.17, .17),
//      scaling: new Point(.014, .014),
//    },
    treePineSprite: {
      legacy: 'pine',
      legacyCategory: 'tree',
      img: 'sprite/tree-pine.png',
    },
    treePalmSprite: {
      legacy: 'palm',
      legacyCategory: 'tree',
      img: 'sprite/tree-palm.png',
    },
    treeFruitSprite: {
      legacy: 'treeOrange',
      legacyCategory: 'tree',
      img: 'sprite/tree-fruit.png',
    },
    // legacy
    bush: {
      img: 'sprite/tree-fruit.png',
      legacy: 'flatBush',
      legacyCategory: 'tree',
    },
    fruit: {
      img: 'sprite/tree-fruit.png',
      legacy: 'flatTree',
      legacyCategory: 'tree',
    },
    palm: {
      img: 'sprite/tree-fruit.png',
      legacy: 'flatPalm',
      legacyCategory: 'tree',
    },
    pine: {
      img: 'sprite/tree-fruit.png',
      legacy: 'flatPine',
      legacyCategory: 'tree',
    },
  }
  // set up the definitions programatically because they are all the same
  Object.keys(asyncStructureDefinition.value).forEach(function(structureType) {
    var def = asyncStructureDefinition.value[structureType];
    def.category = 'structures';
    def.type = structureType;

    {
      def.colorData = colors.npc;
      def.scaling = def.scaling || new Point(.032, .032);
      def.menuScaling = def.menuScaling || new Point(.3, .3);
      def.size = def.size || new Size(4, 4);
      def.offset = def.offset || new Point(-2, -3.6);
      def.onSelect = function(isSelected) {};
      // imnmediately load the assets
      if (def.img) {
        var img = new Raster(def.img);
        def.icon = img;
        def.icon.onLoad = function() {asyncStructureDefinition.onLoad();};
        img.remove();
      } else {
        loadSvg('structure-' + structureType, function(item) {
          //item.pivot += new Point(-2, -3.6);
          def.icon = item;
          asyncStructureDefinition.onLoad();
        });
      }
    }
  });

  //var asyncTreeDefinition = Object.create(asyncObjectDefinition);
  //asyncTreeDefinition.value = {
  //  
  //}

  // =======================================
  // BASE LEVEL TOOLS

  var baseToolCategoryDefinition = {
    onSelect: function(subclass, isSelected, isReselected) {
      subclass.icon.data.select(isSelected);

      if (isReselected) this.toggleMenu(subclass);
      else this.openMenu(subclass, isSelected);

      if (!isSelected) subclass.enablePreview(isSelected);
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
    toggleMenu: function(subclass) {
      if (subclass.openMenu) {
        subclass.openMenu(!(subclass.iconMenu && subclass.iconMenu.visible));
      }
    },
    openMenu: function(subclass, isSelected) {
      if (subclass.openMenu) {
        subclass.openMenu(isSelected);
      }
    },
    updateTool: function(subclass, prevToolData, nextToolData, isToolTypeSwitch) {
      var sameToolType = prevToolData && (prevToolData.definition.type === nextToolData.definition.type);
      if (!sameToolType) {
        if (prevToolData) {
          prevToolData.definition.onSelect(false);
        }
        nextToolData.definition.onSelect(true);
      } else if (isToolTypeSwitch) {
        // user pressed the tool menu button - toggle the menu visibility
        prevToolData.definition.onSelect(true, true);
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
          if (subclass.iconMenu && (
            nextToolData.type == 'structures' ||
            nextToolData.type == 'amenities' ||
            nextToolData.type == 'construction' ||
            nextToolData.type == 'tree' ||
            nextToolData.type == 'flower')) {
            subclass.iconMenu.data.update(nextTool);
            updateObjectPreview();
          }
        }
      }
    },
  }

  var baseObjectCategoryDefinition = {
    base: baseToolCategoryDefinition,
    //type: 'tree', // filled in by base class
    //icon: "amenities",
    //tools: asyncTreeDefinition,
    //menuOptions: {},
    //yPos: 185
    layer: mapIconLayer,
    defaultTool: null,
    modifiers: {},
    defaultModifiers: {},
    onSelect: function(isSelected, isReselected) {
      this.base.onSelect(this, isSelected, isReselected);
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
      if (this.iconMenu == null) {
        this.tools.getAsyncValue(function(definitions) {
          fixedLayer.activate();
          var categoryDefinition = this;
          this.iconMenu = createMenu(
            objectMap(definitions, function(def, name) {
              if (def.legacy || def.legacyCategory) return null;
              var icon = createObjectIcon(def, getObjectData(def));
              icon.scaling = def.menuScaling;
              return createButton(icon, 20, function(event, button) {
                toolState.switchTool(toolState.toolMapValue(categoryDefinition, def, {}));
              });
            }),
            this.menuOptions
          );
          this.iconMenu.data.setPointer(this.yPos);
          this.iconMenu.pivot = new Point(0, 0);
          this.iconMenu.position = new Point(100, 45);
          // this is a little messy
          if (toolState.activeTool && toolState.activeTool.tool) {
            this.iconMenu.data.update(toolState.activeTool.tool.type);
          }
          this.iconMenu.visible = isSelected;
        }.bind(this));
      } else {
        this.iconMenu.visible = isSelected;
      }
    },
  };

  var toolCategoryDefinition = {
//    pointer: {
//      base: baseToolCategoryDefinition,
//      type: 'pointer',
//      layer: mapIconLayer,
//      icon: "pointer",
//      tools: {},
//      defaultTool: null,
//      modifiers: {},
//      defaultModifiers: {
//      },
//      onSelect: function(isSelected) {
//        this.base.onSelect(this, isSelected);
//      },
//      onMouseMove: function(event) {
//        this.base.onMouseMove(this, event);
//      },
//      onMouseDown: function(event) {
//        this.base.onMouseDown(this, event);
//      },
//      onMouseDrag: function(event) {
//        this.base.onMouseDrag(this, event);
//      },
//      onMouseUp: function(event) {
//        this.base.onMouseUp(this, event);
//      },
//      onKeyDown: function(event) {
//        this.base.onKeyDown(this, event);
//      },
//      enablePreview: function(isEnabled) {
//        this.base.enablePreview(this, isEnabled);
//      },
//    },
    terrain: {
      base: baseToolCategoryDefinition,
      type: 'terrain',
      layer: mapLayer,
      icon: "color",
      modifiers: {},
      defaultModifiers: {

      },
      data: {
        paintColorData: colors.level1,
      },
      onSelect: function(isSelected, isReselected) {
        this.base.onSelect(this, isSelected, isReselected);
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
        if (this.iconMenu == null) {
          fixedLayer.activate();
          updatePaintColor(this.data.paintColorData);
          this.iconMenu = createMenu(
            objectMap(layerDefinition, function(definition, colorKey) {
              var colorData = colors[colorKey];
              var paintCircle = new Path.Circle(new Point(0, 0), 16);
              paintCircle.fillColor = colorData.color;
              paintCircle.locked = true;
              return createButton(paintCircle, 20, function(event, button) {
                updatePaintColor(colorData);
                this.data.paintColorData = colorData;
              }.bind(this));
            }.bind(this)),
            {spacing: 45, extraColumns: 1}
          );
          this.iconMenu.data.setPointer(60);
          this.iconMenu.pivot = new Point(0, 0);
          this.iconMenu.position = new Point(100, 45);
          // this is a little messy
          this.iconMenu.data.update(this.data.paintColorData.key);
        }
        this.iconMenu.visible = isSelected;
        var adjusterUI = showBrushSizeUI(isSelected);
      },
    },
    path: {
      base: baseToolCategoryDefinition,
      type: 'path',
      layer: mapLayer,
      icon: "path",
      modifiers: {},
      defaultModifiers: {

      },
      data: {
        paintColorData: colors.pathDirt,
      },
      onSelect: function(isSelected, isReselected) {
        this.base.onSelect(this, isSelected, isReselected);
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
        if (this.iconMenu == null) {
          fixedLayer.activate();
          updatePaintColor(this.data.paintColorData);
          var pathColorButtons =
            objectMap(pathDefinition, function(definition, colorKey) {
              var buttonIcon;
              var colorData = colors[colorKey];
              if (colorKey == colors.pathEraser.key) {
                buttonIcon = new Group();
                eraserImg = new Raster(imgPath + toolPrefix + 'eraser.png');
                eraserImg.scaling = new Point(0.35, 0.35);
                buttonIcon.addChildren([eraserImg]); 
              } else {
                var paintCircle = new Path.Circle(new Point(0, 0), 16);
                paintCircle.fillColor = colorData.color;
                paintCircle.locked = true;
                buttonIcon = paintCircle;
              }

              return createButton(buttonIcon, 20, function(event, button) {
                updatePaintColor(colorData);
                this.data.paintColorData = colorData;
              }.bind(this));
            }.bind(this))
          this.iconMenu = createMenu(pathColorButtons, {spacing: 45, extraColumns: 1, extraRows: 1});
          this.iconMenu.data.setPointer(110);
          this.iconMenu.pivot = new Point(0, 0);
          this.iconMenu.position = new Point(100, 45);
          // this is a little messy
          this.iconMenu.data.update(this.data.paintColorData.key);
        }
        this.iconMenu.visible = isSelected;
        var adjusterUI = showBrushSizeUI(isSelected);
      },
    },
    structures: Object.assign(Object.create(baseObjectCategoryDefinition), {
      type: 'structures',
      icon: "structure",
      tools: asyncStructureDefinition,
      menuOptions: {spacing: 50, perColumn: 9},
      yPos: 160,
    }),
    amenities: Object.assign(Object.create(baseObjectCategoryDefinition), {
      type: 'amenities',
      icon: "amenities",
      tools: asyncAmenitiesDefinition,
      menuOptions: {spacing: 50, perColumn: 8},
      yPos: 208,
    }),

    construction: Object.assign(Object.create(baseObjectCategoryDefinition), {
      type: 'construction',
      icon: "construction",
      tools: asyncConstructionDefinition,
      menuOptions: {spacing: 50, perColumn: 9},
      yPos: 260,
    }),

    tree: Object.assign(Object.create(baseObjectCategoryDefinition), {
      type: 'tree',
      icon: "tree",
      tools: asyncTreeDefinition,
      menuOptions: {spacing: 50, perColumn: 8},
      yPos: 310,
    }),
    flower: Object.assign(Object.create(baseObjectCategoryDefinition), {
      type: 'flower',
      icon: "flower",
      tools: asyncFlowerDefinition,
      menuOptions: {spacing: 50, perColumn: 9},
      yPos: 360,
    })

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
    def.updateTool = function(prevToolData, nextToolData, isToolTypeSwitch) {
      def.base.updateTool(def, prevToolData, nextToolData, isToolTypeSwitch);
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
        this.switchTool(this.defaultToolMapValue(toolType), true);
      } else {
        this.switchTool(this.toolMap[toolType], true);
      }
    },
    switchTool: function(toolData, isToolTypeSwitch) {
      var prevTool = this.activeTool;
      this.activeTool = toolData;
      this.toolMap[toolData.type] = toolData;
      if (prevTool) prevTool.definition.updateTool(prevTool, toolData, isToolTypeSwitch);
      else if (toolData) toolData.definition.updateTool(prevTool, toolData, isToolTypeSwitch);
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
  addToLeftToolMenu(); // spacer

  var tool = new Raster(imgPath + 'menu-help.png');
  tool.scaling = new Point(.3, .3);
  tool.position = new Point(0, 4);
  var button = createButton(tool, 20, function() {});
  button.onMouseUp = function() {showHelpMenu(true)};
  addToLeftToolMenu(button);

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
      if (toolState.activeTool.definition.iconMenu) {

        var toolCategory;
        if (layerDefinition[colorData.key]) {
          toolCategory = toolCategoryDefinition.terrain.type;
        } else if (pathDefinition[colorData.key]) {
          toolCategory = toolCategoryDefinition.path.type;
        }
        if (toolState.activeTool.type != toolCategory){
          toolState.switchToolType(toolCategory);
        }

        toolState.activeTool.definition.iconMenu.data.update(colorData.key);
      }
    }
  }

  fixedLayer.activate();

  var toolsPosition = new Point(40, 80);

  //var pointerToolButton = new Raster('../img/pointer.png');
  //pointerToolButton.position = toolsPosition + new Point(0, 0);
  //pointerToolButton.scaling = new Point(0.2, 0.2);

  var isSpaceDown = false;

  function onKeyUp(event) {
    switch (event.key) {
      case 'space':
        isSpaceDown = false
        break;
      }
  }

  function onKeyDown(event) {
    var shift = Key.isDown('shift');
    var control = Key.isDown('control') || Key.isDown('meta');

    var prevActiveTool = toolState.activeTool;
    switch (event.key) {
      case 'space':
        isSpaceDown = true;
        break;
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
        decrementBrush();
        break;
      case ']':
      case '}':
        incrementBrush();
        break;
//      case 'l':
//        brushSweep = !brushSweep;
//        break;
      case 'p':
        cycleBrushHead();
        break;
//      case 'v':
//        toolState.switchToolType(toolCategoryDefinition.pointer.type);
//        break;
      case 'b':
        toolState.switchToolType(toolCategoryDefinition.terrain.type);
        break;
      case 'n':
        toolState.switchToolType(toolCategoryDefinition.path.type);
        break;
      case 'm':
        toolState.switchToolType(toolCategoryDefinition.structures.type);
        break;
      case ',':
        toolState.switchToolType(toolCategoryDefinition.amenities.type);
        break;
      case 'backspace':
      case 'delete':
        toolState.deleteSelection();
        break;
      case 'escape':
        var isMainMenuShown = mainMenu != null && mainMenu.opacity > 0.8 ? true : false;
        showMainMenu(!isMainMenuShown);
        var isHelpMenuShown = helpMenu != null && helpMenu.opacity > 0.8 ? true : false;
        if (isHelpMenuShown == true) showHelpMenu(false);
        break;
      case '?':
        var isHelpMenuShown = helpMenu != null && helpMenu.opacity > 0.8 ? true : false;
        var isMainMenuShown = mainMenu != null && mainMenu.opacity > 0.8 ? true : false;
        showHelpMenu(!isHelpMenuShown);
        if (isMainMenuShown == true) showMainMenu(false);
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
    return Math.round((f + Number.EPSILON) * 100) / 100;
  }
  function encodePoint(p) {
    return [removeFloatingPointError(p.x), removeFloatingPointError(p.y)];
  }

  function encodePath(p) {
    var positions = [];
    p.segments.forEach(function(s) {
      var encodedPoint = encodePoint(s.point);
      positions.push(encodedPoint[0], encodedPoint[1]);
    });
    return positions;
  }

  function decodePath(positionArray) {
    var points = [];
    for (var i = 0 ; i < positionArray.length; i += 2) {
      points.push(new Point(positionArray[i], positionArray[i+1]))
    }
    return points;
  }

  function encodeDrawing(drawing) {
    var encodedDrawing = {};
    Object.keys(drawing).forEach(function(colorKey) {
      var pathItem = drawing[colorKey];
      var p;
      if (pathItem.children) {
        p = pathItem.children.map(function(path) {
          return encodePath(path);
        });
      } else {
        p = encodePath(pathItem);
      }
      var encodedColorName = colors[colorKey].name;
      encodedDrawing[encodedColorName] = p;
    });
    return encodedDrawing;
  }

  function decodeDrawing(encodedDrawing, version) {
     // colors translated from encoded name => keys
    var decodedDrawing = {};
    Object.keys(encodedDrawing).forEach(function(colorName) {
      var colorData = getColorDataFromEncodedName(colorName);
      var pathData = encodedDrawing[colorName];

      // if array of arrays, make compound path
      var p;
      if (pathData.length == 0) {
        p = new Path();
      }
      else {
        if (version == 0) {
          if (typeof pathData[0][0] == 'number') {
            // normal path
            p = new Path(pathData.map(function(p) {return new Point(p);}));
          } else {
            p = new CompoundPath({
              children: pathData.map(function(pathData) {
                return new Path(pathData.map(function(p) {return new Point(p);}));
              }),
            });
          }
        } else {
          if (typeof pathData[0] == 'number') {
            // normal path
            p = new Path(decodePath(pathData));
          } else {
            p = new CompoundPath({
              children: pathData.map(function(pathData) {
                return new Path(decodePath(pathData));
              }),
            });
          }
        }
      }
      p.locked = true;
      p.fillColor = colorData.color;
      decodedDrawing[colorData.key] = p;
    });
    return decodedDrawing;
  }

  function encodeMap(compress) {
    // colors translated from keys => encoded name
    var o = {
      version: 1,
      objects: encodeObjectGroups(state.objects),
      drawing: encodeDrawing(state.drawing),
    }
    return JSON.stringify(o);
  }

  function decodeMap(json) {
    mapLayer.activate();
    var version = json.version;
    return {
      version: json.version,
      drawing: decodeDrawing(json.drawing, version),
      objects: decodeObjectGroups(json.objects, version),
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
        if (!brushLine && (isShift || brushLineForce)) {
          startDrawGrid(event.point);
        } else if (brushLine && !(isShift || brushLineForce)) {
          drawGrid(event.point);
          stopGridLinePreview();
        }
        brushLine = (isShift || brushLineForce);

        if ((brushLine)) {
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
          var isShift = Key.isDown('shift');
          if (isShift || brushLineForce) {
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
        object.data.id = atomicObjectId++;
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

    var viewWidth = view.size.width * view.scaling.x;
    var viewHeight = view.size.height * view.scaling.y;

    // todo - clean this up with less code duplication
    if (horizontallyContrained) {
      marginX = view.size.width * 0.1;

      var width = viewWidth - marginX * 2;
      var blockWidth = width / horizontalBlocks;
      cellWidth = blockWidth / horizontalDivisions;
      cellHeight = cellWidth * verticalRatio;
      var blockHeight = cellHeight * verticalDivisions;
      var height = blockHeight * verticalBlocks;

      marginY = (viewHeight- height) / 2;

      //var xView = view.size.width - marginX;
      //var xCoord = horizontalBlocks * horizontalDivisions;

      //var yView = height + marginX;
      //var yCoord = verticalBlocks * verticalDivisions;

      //remapX = createRemap(marginX, xView, 0, xCoord);
      //remapY = createRemap(marginY, yView, 0, yCoord);
      //remapInvX = createRemap(0, xCoord, marginX, xView);
      //remapInvY = createRemap(0, yCoord, marginY, yView);
    } else {
      marginY = viewHeight * 0.1;

      var height = viewHeight - marginY * 2;
      var blockHeight = height / verticalBlocks;
      cellHeight = blockHeight / verticalDivisions;
      cellWidth = cellHeight / verticalRatio;
      var blockWidth = cellWidth * horizontalDivisions;
      var width = blockWidth * horizontalBlocks;

      marginX = (viewWidth - width) / 2;
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
      var line = createGridLine(i, true, i != 0 && i % horizontalDivisions == 0);
      grid.push(line);
    }
    for (var i = 0; i < verticalBlocks * verticalDivisions; i++) {
      var line = createGridLine(i, false, i != 0 && i % verticalDivisions == 0);
      grid.push(line);
    }
    var gridGroup = new Group(grid);

    // it starts counting from the second block
    for (var i = 0; i < horizontalBlocks; i++) {
      var gridLabel = new PointText((i + .5) * horizontalDivisions, verticalBlocks * verticalDivisions + 4);
      gridLabel.justification = 'center';
      gridLabel.fontFamily = 'TTNorms, sans-serif';
      gridLabel.fontSize = 3;
      gridLabel.fillColor = colors.oceanText.color;
      gridLabel.content = 1 + i;
      gridGroup.addChild(gridLabel);
    }

    for (var i = 0; i < verticalBlocks; i++) {
      var gridLabel = new PointText(-4, (i + 0.5) * verticalDivisions + 1);
      gridLabel.justification = 'center';
      gridLabel.fontFamily = 'TTNorms, sans-serif';
      gridLabel.fontSize = 3;
      gridLabel.fillColor = colors.oceanText.color;
      gridLabel.content = String.fromCharCode(65 + i); // A = 65
      gridGroup.addChild(gridLabel);
    }

    gridRaster = gridGroup.rasterize(view.resolution * 10);
    gridGroup.remove();
    mapLayer.activate();
    gridRaster.locked = true;
  }

  function createGridLine(i, horizontal, blockEdge) {
    var gridNegativeMarginLeft = blockEdge ? 4 : 0;
    var gridNegativeMarginRight = blockEdge ? 4 : 0;
    var gridNegativeMarginTop = blockEdge ? 0 : 0;
    var gridNegativeMarginBottom = blockEdge ? 4 : 0;
    var segment = horizontal
      ? [new Point(i, -gridNegativeMarginTop), new Point(i, verticalBlocks * verticalDivisions + gridNegativeMarginTop + gridNegativeMarginBottom)]
      : [new Point(-gridNegativeMarginLeft, i), new Point(horizontalBlocks * horizontalDivisions + gridNegativeMarginLeft + gridNegativeMarginRight, i)];

    line = new Path(segment);
    line.strokeColor = '#ffffff';
    line.strokeWidth = blockEdge ? .2 : 0.1;
    line.strokeCap = 'round';
    //line.dashArray = blockEdge ? [4, 6] : null;
    line.opacity = blockEdge ? 0.5 : 0.2;
    return line;
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
  var brushLineForce = false;
  var brushType = brushTypes.rounded;
  updateBrush();

  function setBrushLineForce(isLine) {
    brushLineForce = isLine;
    emitter.emit('updateBrushLineForce', brushLineForce);
  }
  setBrushLineForce(false);

  function cycleBrushHead() {
    var heads = Object.keys(brushTypes).sort(function(a, b) {
      return a == b ? 0 : a < b ? -1 : 1;
    });
    var index = heads.indexOf(brushType);
    brushType = heads[(index + 1) % heads.length];
    updateBrush();
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

  function decrementBrush() {
    brushSize = Math.max(brushSize - 1, 1);
    updateBrush();
  }
  function incrementBrush() {
    brushSize = Math.max(brushSize + 1, 1);
    updateBrush();
  }
  function updateBrush() {
    brushSegments = getBrushSegments(brushSize);

    var prevPosOutline = brushOutline.position;

    brush.layer = uiLayer;
    brush.segments = brushSegments;
    brush.pivot = new Point(brushSize / 2 - 0.5, brushSize / 2 - 0.5);
    brush.position = getBrushCenteredCoordinate(prevPosOutline);
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

    emitter.emit('updateBrush');
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

    emitter.emit('historyUpdate', 'add');
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

  function canRedo() {
    return state == null ? 0 : state.index < state.history.length - 1;
  }

  function canUndo() {
    return state == null ? 0 : state.index >= 0;
  }

  function undo() {
    if (canUndo()) {
      applyCommand(state.history[state.index], false);
      state.index -= 1;
      emitter.emit('historyUpdate', 'undo');
    } else {
      console.log('Nothing to undo');
    }
  }

  function redo() {
    if (canRedo()) {
      state.index += 1;
      applyCommand(state.history[state.index], true);
      emitter.emit('historyUpdate', 'redo');
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
          console.error('Simultaneous add and remove for ' + colorKey);
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

  function objectMap(object, mapFn, allowNull) {
    return Object.keys(object).reduce(function(result, key) {
      var value = mapFn(object[key], key);
      if (value != null)
        result[key] = value;
      return result;
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
