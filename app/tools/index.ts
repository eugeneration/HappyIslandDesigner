// @ts-nocheck
import paper from 'paper';
import {
  updateCoordinateLabel,
  updateObjectPreview,
  updatePaintColor,
  setBrushPreviewActive,
  setObjectPreviewActive,
} from '../brush';

import * as amenitiesDef from './amenities';
import * as constructionDef from './construction';
import * as flowerDef from './flower';
import * as structureDef from './structure';
import * as treeDef from './tree';
import { toolState } from './state';
import { colors } from '../colors';
import { imgPath } from '../constants';
import { createMenu } from '../ui/createMenu';
import { createButton } from '../ui/createButton';
import { addToLeftToolMenu, setLeftMenuExtended } from '../ui/leftMenu';
import { layers } from '../layers';
import { objectMap } from '../helpers/objectMap';
import { createObjectIcon, placeObject } from '../ui/createObject';
import { constructionDisplayNames } from './construction';
import { layerDefinition } from '../layerDefinition';
import { showBrushSizeUI } from '../ui/brushMenu';
import { isV2Map } from '../mapState';
import { emitter } from '../emitter';
import { getObjectData } from '../helpers/getObjectData';
import { pathDefinition } from '../pathDefinition';
import { getColorAtCoordinate } from '../getColorAtCoordinate';
import { startDraw, draw, endDraw } from '../paint';
import { enterEdgeEditMode, exitEdgeEditMode, isEdgeEditModeActive } from '../ui/edgeTileEditor';
import { setEdgeTilesInteractive, getInnerDrawableBounds } from '../ui/edgeTiles';
import { trackMiscAction, trackObjectPlacement } from '../analytics';

const toolPrefix = 'tool-';

function isOutOfIslandBounds(event): boolean {
  if (!isV2Map()) return false;
  const coord = layers.mapOverlayLayer.globalToLocal(event.point);
  return !getInnerDrawableBounds().contains(coord);
}

class BaseToolCategoryDefinition {
  onSelect(subclass, isSelected, isReselected) {
    subclass.icon.data.select(isSelected);

    if (isReselected) {
      this.toggleMenu(subclass);
    } else {
      this.openMenu(subclass, isSelected);
    }

    subclass.enablePreview(isSelected);
  }
  onMouseMove(subclass, event: paper.MouseEvent) {
    updateCoordinateLabel(event);
  }
  onMouseDown(subclass, event: paper.MouseEvent) {
    updateCoordinateLabel(event);
  }
  onMouseDrag(subclass, event: paper.MouseEvent) {
    updateCoordinateLabel(event);
  }
  onMouseUp(subclass, event: paper.MouseEvent) {
    updateCoordinateLabel(event);
  }
  onKeyDown(/*subclass, event: paper.KeyEvent*/) {}
  enablePreview(/*subclass, isEnabled: boolean*/) {}
  toggleMenu(subclass) {
    if (subclass.openMenu) {
      subclass.openMenu(!(subclass.iconMenu && subclass.iconMenu.visible));
    }
  }
  openMenu(subclass, isSelected) {
    if (subclass.openMenu) {
      subclass.openMenu(isSelected);
    }
  }
  updateTool(subclass, prevToolData, nextToolData, isToolTypeSwitch) {
    // Make edge tiles block cursor only for terrain/path tools
    const isTerrainTool = nextToolData.type === 'terrain' || nextToolData.type === 'path';
    setEdgeTilesInteractive(isTerrainTool);

    const sameToolType =
      prevToolData &&
      prevToolData.definition.type === nextToolData.definition.type;
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
      const prevTool =
        prevToolData && prevToolData.tool ? prevToolData.tool.type : null;
      const nextTool =
        nextToolData && nextToolData.tool ? nextToolData.tool.type : null;
      const sameTool = sameToolType && prevTool === nextTool;
      if (!sameTool) {
        if (prevToolData && prevToolData.tool && prevToolData.tool.onSelect) {
          prevToolData.tool.onSelect(false);
        }
        if (nextToolData && nextToolData.tool && nextToolData.tool.onSelect) {
          nextToolData.tool.onSelect(true);
        }
        // todo: decouple view from logic
        if (
          subclass.iconMenu &&
          (nextToolData.type === 'structures' ||
            nextToolData.type === 'amenities' ||
            nextToolData.type === 'construction' ||
            nextToolData.type === 'tree' ||
            nextToolData.type === 'flower')
        ) {
          subclass.iconMenu.data.update(nextTool);
          updateObjectPreview();
          // Update menu button icon and persist variant for construction tools
          if (nextToolData.type === 'construction' &&
              nextToolData.tool &&
              constructionDisplayNames[nextTool]) {
            const variantName = constructionDisplayNames[nextTool];
            nextToolData.definition.lastVariant[variantName] = nextToolData.tool;
            if (nextToolData.definition.updateMenuButtonIcon) {
              nextToolData.definition.updateMenuButtonIcon(nextToolData.tool);
            }
          }
        }
      }
    }
  }
}
const baseToolCategoryDefinition = new BaseToolCategoryDefinition();

class BaseObjectCategoryDefinition {
  constructor({type, icon, tools, menuOptions, yPos}) {
    this.type = type;
    this.icon = icon;
    this.tools = tools;
    this.menuOptions = menuOptions;
    this.yPos = yPos;
  }

  base = baseToolCategoryDefinition;

  type: string;
  icon: string;
  tools: any; // asyncTreeDefinition,

  menuOptions = {};
  yPos = 0;

  iconMenu: paper.Group | null = null;
  defaultTool: null;
  modifiers = {};
  defaultModifiers = {};

  onSelect(isSelected, isReselected) {
    this.base.onSelect(this, isSelected, isReselected);
  }
  onMouseMove(event) {
    this.base.onMouseMove(this, event);
  }
  onMouseDown(event) {
    placeObject(event);
    trackObjectPlacement(this.type);
    this.base.onMouseDown(this, event);
  }
  onMouseDrag(event) {
    this.base.onMouseDrag(this, event);
  }
  onMouseUp(event) {
    this.base.onMouseUp(this, event);
  }
  onKeyDown(event) {
    this.base.onKeyDown(this, event);
  }
  enablePreview(isEnabled) {
    this.base.enablePreview(this, isEnabled);
    setObjectPreviewActive(isEnabled);
  }
  menuBaseButtons: Record<string, { button: paper.Group, baseDef: any }> = {};
  lastVariant: Record<string, any> = {};

  updateMenuButtonIcon(newDef) {
    if (!this.iconMenu) return;
    // Find which base button should show this variant
    // For stairs: base is stairsIconUp, for bridge: base is bridgeIconVertical
    const displayName = constructionDisplayNames[newDef.type];
    if (!displayName) return;

    const baseType = displayName === 'Stairs' ? 'stairsIconUp' : 'bridgeIconVertical4';
    const entry = this.menuBaseButtons[baseType];
    if (!entry) return;

    const { button } = entry;

    const doUpdate = () => {
      // Replace the icon child (index 1, after the circle backing at index 0)
      const oldIcon = button.children[1];
      if (oldIcon) oldIcon.remove();
      const newIcon = createObjectIcon(newDef, getObjectData(newDef));
      newIcon.scaling = newDef.menuScaling;
      if (newDef.rotation) {
        newIcon.rotate(newDef.rotation);
      }
      button.insertChild(1, newIcon);

      // Update selection state to highlight the base button
      this.iconMenu.data.update(baseType);
    };

    if (newDef.icon) {
      doUpdate();
    } else {
      // Icon not loaded yet (hidden variant) — load on demand
      if (!newDef._onIconLoaded) newDef._onIconLoaded = [];
      newDef._onIconLoaded.push(doUpdate);
      constructionDef.asyncConstructionDefinition.loadItemAsset(newDef.type);
    }
  }

  openMenu(isSelected) {
    if (this.iconMenu === null) {
      this.tools.getAsyncValue((definitions) => {
        layers.fixedLayer.activate();
        const categoryDefinition = this;
        this.iconMenu = createMenu(
          objectMap(definitions, (def) => {
            if (def.legacy || def.legacyCategory || def.hidden) {
              return null;
            }
            const icon = createObjectIcon(def, getObjectData(def));
            icon.scaling = def.menuScaling;
            const btn = createButton(icon, 20, () => {
              const displayName = constructionDisplayNames[def.type];
              const toolDef = (displayName && this.lastVariant[displayName]) || def;
              toolState.switchTool(
                toolState.toolMapValue(categoryDefinition, toolDef, {}),
              );
            });
            // Track base buttons for stairs/bridge
            if (constructionDisplayNames[def.type]) {
              this.menuBaseButtons[def.type] = { button: btn, baseDef: def };
            }
            return btn;
          }),
          this.menuOptions,
        );
        this.iconMenu.data.setPointer(this.yPos);
        this.iconMenu.pivot = new paper.Point(0, 0);
        this.iconMenu.position = new paper.Point(100, 45);
        // this is a little messy
        if (toolState.activeTool && toolState.activeTool.tool) {
          this.iconMenu.data.update(toolState.activeTool.tool.type);
        }
        this.iconMenu.visible = isSelected;
      });
    } else {
      this.iconMenu.visible = isSelected;
    }
  }
}

export const toolCategoryDefinition: any = {};

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
  //  shovel: {
  // },
  //  sprite: {
  //    type: 'sprite',
  //    targetLayers: [mapIconLayer],
  //  },

export function initTools() {
  amenitiesDef.initDefaults();
  structureDef.initDefaults();
  constructionDef.initDefaults();
  treeDef.initDefaults();
  flowerDef.initDefaults();

  toolCategoryDefinition.terrain = {
    base: baseToolCategoryDefinition,
    type: 'terrain',
    layer: layers.mapLayer,
    icon: 'color',
    modifiers: {},
    iconMenu: null,
    defaultModifiers: {},
    data: {
      paintColorData: colors.level1,
    },
    onSelect(isSelected, isReselected) {
      this.base.onSelect(this, isSelected, isReselected);
    },
    onMouseMove(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDown(event) {
      this.base.onMouseDown(this, event);
      if (isOutOfIslandBounds(event)) return;
      if (paper.Key.isDown('alt')) {
        trackMiscAction('color_pick');
        const rawCoordinate = layers.mapOverlayLayer.globalToLocal(event.point);
        updatePaintColor(getColorAtCoordinate(rawCoordinate));
      }
      startDraw(event);
    },
    onMouseDrag(event) {
      this.base.onMouseDrag(this, event);
      if (isOutOfIslandBounds(event)) return;
      draw(event);
    },
    onMouseUp(event) {
      this.base.onMouseUp(this, event);
      endDraw(event);
    },
    onKeyDown(event) {
      this.base.onKeyDown(this, event);
    },
    enablePreview(isEnabled) {
      this.base.enablePreview(this, isEnabled);
      setBrushPreviewActive(isEnabled);
    },
    openMenu(isSelected) {
      if (this.iconMenu === null) {
        layers.fixedLayer.activate();
        updatePaintColor(this.data.paintColorData);
        this.iconMenu = createMenu(
          objectMap(layerDefinition, (definition, colorKey) => {
            const colorData = colors[colorKey];
            const paintCircle = new paper.Path.Circle(
              new paper.Point(0, 0),
              16,
            );
            paintCircle.fillColor = colorData.color;
            paintCircle.locked = true;
            return createButton(paintCircle, 20, () => {
              updatePaintColor(colorData);
              this.data.paintColorData = colorData;
            });
          }),
          { spacing: 45, extraColumns: 1 },
        );
        this.iconMenu.data.setPointer(60);
        this.iconMenu.pivot = new paper.Point(0, 0);
        this.iconMenu.position = new paper.Point(100, 45);
        // this is a little messy
        this.iconMenu.data.update(this.data.paintColorData.key);

        // Update visibility of sand/rock buttons based on map version
        const updateV2Colors = () => {
          const v2 = isV2Map();
          const buttonMap = this.iconMenu.data.buttonMap;
          if (buttonMap[colors.sand.key]) {
            buttonMap[colors.sand.key].visible = !v2;
          }
          if (buttonMap[colors.rock.key]) {
            buttonMap[colors.rock.key].visible = !v2;
          }
          // Move water button to rock's position for V2 (no gap)
          if (buttonMap[colors.water.key]) {
            buttonMap[colors.water.key].position.y = v2 ? 45 * 4 : 45 * 6;
          }
          // If currently selected color is sand/rock and we're in V2, switch to level1
          if (v2 && (this.data.paintColorData.key === colors.sand.key || this.data.paintColorData.key === colors.rock.key)) {
            updatePaintColor(colors.level1);
            this.data.paintColorData = colors.level1;
            this.iconMenu.data.update(colors.level1.key);
          }
        };

        // Initial update
        updateV2Colors();

        // Listen for map version changes
        emitter.on('mapVersionChanged', updateV2Colors);
      }
      if (isSelected && this.data.paintColorData) {
        updatePaintColor(this.data.paintColorData);
      }
      this.iconMenu.visible = isSelected;
      showBrushSizeUI(isSelected);
    },
  };

  toolCategoryDefinition.path = {
    base: baseToolCategoryDefinition,
    type: 'path',
    layer: layers.mapLayer,
    icon: 'path',
    modifiers: {},
    defaultModifiers: {},
    iconMenu: null,
    data: {
      paintColorData: colors.pathDirt,
    },
    onSelect(isSelected, isReselected) {
      this.base.onSelect(this, isSelected, isReselected);
    },
    onMouseMove(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDown(event) {
      this.base.onMouseDown(this, event);
      if (isOutOfIslandBounds(event)) return;
      if (paper.Key.isDown('alt')) {
        trackMiscAction('color_pick');
        const rawCoordinate = layers.mapOverlayLayer.globalToLocal(event.point);
        updatePaintColor(getColorAtCoordinate(rawCoordinate));
      }
      startDraw(event);
    },
    onMouseDrag(event) {
      this.base.onMouseDrag(this, event);
      if (isOutOfIslandBounds(event)) return;
      draw(event);
    },
    onMouseUp(event) {
      this.base.onMouseUp(this, event);
      endDraw(event);
    },
    onKeyDown(event) {
      this.base.onKeyDown(this, event);
    },
    enablePreview(isEnabled) {
      this.base.enablePreview(this, isEnabled);
      setBrushPreviewActive(isEnabled);
    },
    openMenu(isSelected) {
      if (this.iconMenu === null) {
        layers.fixedLayer.activate();
        updatePaintColor(this.data.paintColorData);
        const pathColorButtons = objectMap(
          pathDefinition,
          (definition, colorKey) => {
            let buttonIcon;
            const colorData = colors[colorKey];
            if (colorKey === colors.pathEraser.key) {
              buttonIcon = new paper.Group();
              const eraserImg = new paper.Raster(
                `${imgPath + toolPrefix}eraser.png`,
              );
              eraserImg.scaling = new paper.Point(0.35, 0.35);
              buttonIcon.addChildren([eraserImg]);
            } else {
              const paintCircle = new paper.Path.Circle(
                new paper.Point(0, 0),
                16,
              );
              paintCircle.fillColor = colorData.color;
              paintCircle.locked = true;
              buttonIcon = paintCircle;
            }

            return createButton(buttonIcon, 20, () => {
              updatePaintColor(colorData);
              this.data.paintColorData = colorData;
            });
          },
        );
        this.iconMenu = createMenu(pathColorButtons, {
          spacing: 45,
          extraColumns: 1,
          extraRows: 1,
        });
        this.iconMenu.data.setPointer(110);
        this.iconMenu.pivot = new paper.Point(0, 0);
        this.iconMenu.position = new paper.Point(100, 45);
        // this is a little messy
        this.iconMenu.data.update(this.data.paintColorData.key);
      }
      if (isSelected && this.data.paintColorData) {
        updatePaintColor(this.data.paintColorData);
      }
      this.iconMenu.visible = isSelected;
      showBrushSizeUI(isSelected);
    },
  };

  toolCategoryDefinition.structures =
    new BaseObjectCategoryDefinition({
      type: 'structures',
      icon: 'house',
      tools: structureDef.asyncStructureDefinition,
      menuOptions: { spacing: 50, perColumn: 9 },
      yPos: 160,
    });

  toolCategoryDefinition.amenities =
    new BaseObjectCategoryDefinition({
      type: 'amenities',
      icon: 'amenities',
      tools: amenitiesDef.asyncAmenitiesDefinition,
      menuOptions: { spacing: 50, perColumn: 8 },
      yPos: 208,
    });

  toolCategoryDefinition.construction =
    new BaseObjectCategoryDefinition({
      type: 'construction',
      icon: 'construction',
      tools: constructionDef.asyncConstructionDefinition,
      menuOptions: { spacing: 50, perColumn: 9 },
      yPos: 260,
    });

  toolCategoryDefinition.tree =
    new BaseObjectCategoryDefinition({
      type: 'tree',
      icon: 'tree',
      tools: treeDef.asyncTreeDefinition,
      menuOptions: { spacing: 50, perColumn: 8 },
      yPos: 310,
    });
  toolCategoryDefinition.flower =
    new BaseObjectCategoryDefinition({
      type: 'flower',
      icon: 'flower',
      tools: flowerDef.asyncFlowerDefinition,
      menuOptions: { spacing: 50, perColumn: 9 },
      yPos: 360,
    });

  // Edge tool - only for V2 maps
  toolCategoryDefinition.edge = {
    base: baseToolCategoryDefinition,
    type: 'edge',
    icon: null, // Will be set to button
    iconMenu: null,
    data: {},
    onSelect(isSelected, isReselected) {
      this.base.onSelect(this, isSelected, isReselected);
      // Exit edge edit mode when deselecting
      if (!isSelected && isEdgeEditModeActive()) {
        exitEdgeEditMode();
      }
    },
    onMouseMove(event) {
      this.base.onMouseMove(this, event);
    },
    onMouseDown(event) {
      this.base.onMouseDown(this, event);
    },
    onMouseDrag(event) {
      this.base.onMouseDrag(this, event);
    },
    onMouseUp(event) {
      this.base.onMouseUp(this, event);
    },
    onKeyDown(event) {
      this.base.onKeyDown(this, event);
    },
    enablePreview(isEnabled) {
      this.base.enablePreview(this, isEnabled);
    },
    openMenu(isSelected) {
      if (this.iconMenu === null) {
        layers.fixedLayer.activate();

        // "Adjust Edges" button - small blue square
        const adjustIcon = new paper.Path.Rectangle({
          rectangle: new paper.Rectangle(-8, -8, 16, 16),
          fillColor: colors.oceanDark.color,
          strokeColor: colors.text.color,
          strokeWidth: 1,
        });

        const adjustButton = createButton(adjustIcon, 16, () => {
          enterEdgeEditMode();
        });

        this.iconMenu = createMenu(
          { adjust: adjustButton },
          { spacing: 45, extraColumns: 1 },
        );
        this.iconMenu.data.setPointer(405);
        this.iconMenu.pivot = new paper.Point(0, 0);
        this.iconMenu.position = new paper.Point(100, 45);
      }
      this.iconMenu.visible = isSelected;
    },
  };

  // function squircle (size){ // squircle=square+circle
  //  let hsize = size / 2; // half size
  //
  //  let squircle = new paper.Path();
  //
  //  squircle.add(
  //    new Segment(new paper.Point(0,0), new paper.Point(0,0), new paper.Point(0,hsize)),
  //    new Segment(new paper.Point(0,size), new paper.Point(0,size), new paper.Point(hsize,size)),
  //    new Segment(new paper.Point(size,size), new paper.Point(size,size), new paper.Point(size,hsize)),
  //    new Segment(new paper.Point(size,0), new paper.Point(size,0), new paper.Point(hsize,0))
  //  );
  //  squircle.closed = true;
  //
  //  return squircle;
  // }
  // layers.fixedLayer.activate();
  // let box = squircle(100);
  // box.fillColor = colors.npc;
  // box.position = new paper.Point(300, 300);
  // box.selected = true;
  //
  // let d = new paper.Path.Rectangle(300, 300, 10, 10);
  // d.fillColor = colors.npc;

  // let activeToolIndicator = new paper.Path.Rectangle(0, 100, 5, 40);
  // let activeToolIndicator = new paper.Path.Circle(30, 120, 20);
  // activeToolIndicator.fillColor = colors.npc;

  Object.keys(toolCategoryDefinition).forEach((toolType) => {
    const def = toolCategoryDefinition[toolType];
    def.updateTool = function (prevToolData, nextToolData, isToolTypeSwitch) {
      def.base.updateTool(def, prevToolData, nextToolData, isToolTypeSwitch);
    };

    // Handle edge tool specially - uses programmatic icon
    if (toolType === 'edge') {
      return; // Skip, will be added separately below
    }

    const tool = new paper.Raster(`${imgPath + toolPrefix + def.icon}.png`);

    const button = createButton(tool, 20, () => {
      toolState.switchToolType(toolType);
    });
    switch (def.icon) {
      case 'color':
        tool.position = new paper.Point(-8, 0);
        break;
    }
    tool.scaling = new paper.Point(0.4, 0.4);

    addToLeftToolMenu(button);
    def.icon = button;
  });

  // Edge tool - V2 only
  {
    // WIP: hide edge tool from left menu until fully implemented
    const WIP_HIDE_EDGE_TOOL = true;

    if (!WIP_HIDE_EDGE_TOOL) {
      const edgeDef = toolCategoryDefinition.edge;

      const tool = new paper.Raster(`${imgPath + toolPrefix}island.png`);
      const edgeButton = createButton(tool, 20, () => {
        toolState.switchToolType('edge');
      });
      tool.scaling = new paper.Point(0.2, 0.2);

      addToLeftToolMenu(edgeButton);
      edgeDef.icon = edgeButton;

      // Set visibility based on map version
      const updateEdgeToolVisibility = () => {
        const visible = isV2Map();
        edgeButton.visible = visible;
        setLeftMenuExtended(visible);
      };
      updateEdgeToolVisibility();
      emitter.on('mapVersionChanged', updateEdgeToolVisibility);
    }
  }
}

export function loadObjectAsset(category: string, type: string) {
  toolCategoryDefinition[category]?.tools?.loadItemAsset(type);
}

export function loadObjectSprites() {
  Object.keys(toolCategoryDefinition).forEach((cat) => {
    toolCategoryDefinition[cat].tools?.loadAllAssets();
  });
}
