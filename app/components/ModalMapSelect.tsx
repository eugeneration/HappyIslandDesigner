import React, { useState, useEffect, useRef } from 'react';
import Modal from 'react-modal';
import paper from 'paper';
import {Box, Button, Image, Flex, Grid, Heading, Text, Link} from '@theme-ui/components'
import { colors } from '../colors';
import './modal.scss';
import Layouts, { LayoutType, Layout, baseMapLayouts } from './islandLayouts';
import { baseMapCache } from '../generatedBaseMapCache';
import useBlockZoom from './useBlockZoom';

import { loadMapFromJSONString, loadBaseMapFromSvg } from '../load';
import {confirmDestructiveAction, isMapEmpty} from '../state';
import { emitter } from '../emitter';
import { type OptionConfig } from '../ui/mapOptionSelector';
import { showPositionSelector, hidePositionSelector, SelectionType, getPeninsulaPosition, getAirportBlocks, getSecretBeachBlock, getSecretBeachPosition, getRockPosition, getRockBlock, RiverDirection } from '../ui/mapPositionSelector';
import { showOptionSelector, OptionDirection } from '../ui/mapOptionSelector';
import { initializeEdgeTiles, fillEdgeTilesWithPlaceholders, replaceBlocks, restoreBlocks, setRiverTiles, getRemainingPlaceholders } from '../ui/edgeTiles';
import { tileAssetIndices, getAssetByIndex, categoryAssetIndices, type TileDirection } from '../ui/edgeTileAssets';
import {
  WizardState,
  getWizardState,
  resetWizard,
  startWizard,
  setRiverDirection,
  setRiverMouth1Shape,
  setRiverMouth2Shape,
  setAirportPosition,
  setPeninsulaSide,
  setPeninsulaPosition,
  setPeninsulaShape,
  setDockSide,
  setDockShape,
  setSecretBeachPosition,
  setSecretBeachShape,
  setLeftRockPosition,
  setLeftRockShape,
  setRightRockPosition,
  setRightRockShape,
  advanceToNextPlaceholder,
  finishPlaceholders,
  goToLegacyRiverSelection,
  setLegacyRiverDirection,
  goBack,
  isModalStep,
  isMapStep,
} from '../ui/mapSelectionWizard';

const shadowColor = "rgba(75, 59, 50, 0.3)" // offblack

// Helper to create options array from asset indices
function createOptionsFromAssets(assetIndices: number[]): OptionConfig[] {
  return assetIndices.map((assetIndex, i) => ({
    label: String(i + 1),
    value: i,
    assetIndex: assetIndex,
    imageSrc: getAssetByIndex(assetIndex)?.imageSrc || '',
  }));
}


const customStyles = {
  overlay: {
    backgroundColor: shadowColor,
  },
  content : {
    top                   : '50%',
    left                  : '50%',
    right                 : 'auto',
    bottom                : 'auto',
    marginRight           : '-50%',
    transform             : 'translate(-50%, -50%)',
    background: 'none',
    border: 0,
    display: 'flex',
    padding: 0,
    maxHeight: '90%',
    maxWidth: '90%',
  }
};

// Tile images for each placeholder type

// Option selector direction for each placeholder type
const placeholderDirection: Record<TileDirection, OptionDirection> = {
  top_left: 'bottom',
  top_right: 'bottom',
  bottom_left: 'left',
  bottom_right: 'right',
  left: 'left',
  right: 'right',
  top: 'bottom',
  bottom: 'bottom',
};

export function OpenMapSelectModal() {
  document.getElementById('open-map-select')?.click();
}

export function CloseMapSelectModal() {
  document.getElementById('close-map-select')?.click();
}

export default function ModalMapSelect(){
  const [modalIsOpen,setIsOpen] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState>(getWizardState());

  // Track filled placeholder positions for going back during fillPlaceholder step
  const filledPlaceholderPositions = useRef<{x: number, y: number}[]>([]);

  // only called by external triggers
  function startModal() {
    startWizard();
    openModal();
  }

  function openModal() {
    setIsOpen(true);
  }

  function afterOpenModal() {

  }

  function closeModal(){
    if (!isMapEmpty())
      setIsOpen(false);
  }

  // Listen for wizard state changes - must be at this level since modal content unmounts when closed
  useEffect(() => {
    const handleWizardChange = (state: WizardState) => {
      setWizardState({ ...state });

      // If moving to a modal step, open modal
      setIsOpen(isModalStep(state.step));

      // If moving to a map step, show appropriate selector
      if (isMapStep(state.step)) {
        setTimeout(() => {
          if (state.step === 'riverMouth1') {
            // Show edge tiles at the start of the wizard flow
            initializeEdgeTiles();
            fillEdgeTilesWithPlaceholders();
            // Show river placeholder tiles (will be replaced when shapes are selected)
            setRiverTiles(state.riverDirection as RiverDirection);

            // Get position for first river mouth (always bottom river)
            const riverDir = state.riverDirection as RiverDirection;
            let blockX: number;
            switch (riverDir) {
              case 'west': blockX = 4; break;
              case 'east': blockX = 2; break;
              case 'south': blockX = 1; break;
            }
            const anchorPoint = new paper.Point(blockX * 16 + 8, 5 * 16 + 8);

            showOptionSelector({
              anchorPoint,
              options: createOptionsFromAssets(categoryAssetIndices.bottom_river),
              direction: 'bottom',
              eventName: 'riverMouth1ShapeSelected',
              title: 'Shape?',
              spacing: 14,
              buttonSize: 12,
            });
          } else if (state.step === 'riverMouth2') {
            // Get position for second river mouth (depends on direction)
            const riverDir = state.riverDirection as RiverDirection;
            let anchorPoint: paper.Point;
            let options: OptionConfig[];
            let direction: OptionDirection;

            switch (riverDir) {
              case 'west':
                // Left river at (0, 2)
                anchorPoint = new paper.Point(8, 2 * 16 + 8);
                options = createOptionsFromAssets(categoryAssetIndices.left_river);
                direction = 'left';
                break;
              case 'east':
                // Right river at (6, 2)
                anchorPoint = new paper.Point(6 * 16 + 8, 2 * 16 + 8);
                options = createOptionsFromAssets(categoryAssetIndices.right_river);
                direction = 'right';
                break;
              case 'south':
                // Second bottom river at (5, 5)
                anchorPoint = new paper.Point(5 * 16 + 8, 5 * 16 + 8);
                options = createOptionsFromAssets(categoryAssetIndices.bottom_river);
                direction = 'bottom';
                break;
            }

            showOptionSelector({
              anchorPoint,
              options,
              direction,
              eventName: 'riverMouth2ShapeSelected',
              title: 'Shape?',
              spacing: 14,
              buttonSize: 12,
            });
          } else if (state.step === 'airport') {
            showPositionSelector('airport', state.riverDirection as RiverDirection);
          } else if (state.step === 'peninsulaPos') {
            const selectorType: SelectionType = state.peninsulaSide === 'left' ? 'peninsulaLeft' : 'peninsulaRight';
            showPositionSelector(selectorType);
          } else if (state.step === 'peninsulaShape') {
            // Show option selector for peninsula shape
            const side = state.peninsulaSide as 'left' | 'right';
            const posIndex = state.peninsulaPosition as number;
            const anchorPoint = getPeninsulaPosition(side, posIndex);
            const direction: OptionDirection = side === 'left' ? 'left' : 'right';

            // Use peninsula tile images based on side
            const peninsulaOptions = side === 'left'
              ? createOptionsFromAssets(categoryAssetIndices.left_peninsula)
              : createOptionsFromAssets(categoryAssetIndices.right_peninsula);

            showOptionSelector({
              anchorPoint,
              options: peninsulaOptions,
              direction,
              eventName: 'peninsulaShapeSelected',
              title: 'Shape?',
              spacing: 14,
              buttonSize: 12,
            });
          } else if (state.step === 'dockShape') {
            // Show option selector for dock shape
            const dockSide = state.dockSide as 'left' | 'right';
            // Dock is at bottom corners: left (0, 5) or right (6, 5)
            const blockX = dockSide === 'left' ? 0 : 6;
            const anchorPoint = new paper.Point(blockX * 16 + 8, 5 * 16 + 8);
            const direction: OptionDirection = dockSide === 'left' ? 'left' : 'right';

            const dockOptions = dockSide === 'left'
              ? createOptionsFromAssets(categoryAssetIndices.bottom_left_dock)
              : createOptionsFromAssets(categoryAssetIndices.bottom_right_dock);

            showOptionSelector({
              anchorPoint,
              options: dockOptions,
              direction,
              eventName: 'dockShapeSelected',
              title: 'Shape?',
              spacing: 14,
              buttonSize: 12,
            });
          } else if (state.step === 'secretBeachPos') {
            // Show secret beach position selector
            showPositionSelector('secretBeach', state.riverDirection as RiverDirection);
          } else if (state.step === 'secretBeachShape') {
            // Show option selector for secret beach shape
            const riverDir = state.riverDirection as RiverDirection;
            const posIndex = state.secretBeachPosition as number;
            const anchorPoint = getSecretBeachPosition(riverDir, posIndex);

            showOptionSelector({
              anchorPoint,
              options: createOptionsFromAssets(categoryAssetIndices.top_secret_beach),
              direction: 'bottom',
              eventName: 'secretBeachShapeSelected',
              title: 'Shape?',
              spacing: 14,
              buttonSize: 12,
            });
          } else if (state.step === 'leftRockPos') {
            // Show left rock position selector
            showPositionSelector('leftRock');
          } else if (state.step === 'leftRockShape') {
            // Show option selector for left rock shape
            const posIndex = state.leftRockPosition as number;
            const anchorPoint = getRockPosition('left', posIndex);

            showOptionSelector({
              anchorPoint,
              options: createOptionsFromAssets(categoryAssetIndices.left_rock),
              direction: 'left',
              eventName: 'leftRockShapeSelected',
              title: 'Shape?',
              spacing: 14,
              buttonSize: 12,
            });
          } else if (state.step === 'rightRockPos') {
            // Show right rock position selector
            showPositionSelector('rightRock');
          } else if (state.step === 'rightRockShape') {
            // Show option selector for right rock shape
            const posIndex = state.rightRockPosition as number;
            const anchorPoint = getRockPosition('right', posIndex);

            showOptionSelector({
              anchorPoint,
              options: createOptionsFromAssets(categoryAssetIndices.right_rock),
              direction: 'right',
              eventName: 'rightRockShapeSelected',
              title: 'Shape?',
              spacing: 14,
              buttonSize: 12,
            });
          } else if (state.step === 'fillPlaceholder') {
            // Get remaining placeholders and show option selector for the first one
            const placeholders = getRemainingPlaceholders();

            if (placeholders.length > 0) {
              // Always use index 0 since getRemainingPlaceholders() returns only remaining items
              const placeholder = placeholders[0];
              const indices = tileAssetIndices[placeholder.type];
              const direction = placeholderDirection[placeholder.type];

              // Calculate anchor point (center of the block)
              const anchorPoint = new paper.Point(
                placeholder.x * 16 + 8,
                placeholder.y * 16 + 8
              );

              // Create options from asset indices
              const options: OptionConfig[] = indices.map((assetIndex, idx) => ({
                label: `${idx + 1}`,
                value: idx,
                assetIndex: assetIndex,
                imageSrc: getAssetByIndex(assetIndex)?.imageSrc || '',
              }));

              showOptionSelector({
                anchorPoint,
                options,
                direction,
                eventName: 'placeholderShapeSelected',
                title: 'Shape?',
                spacing: 14,
                buttonSize: 12,
              });
            } else {
              // No more placeholders, move to grid
              finishPlaceholders();
            }
          }
        }, 250);
      }
    };

    emitter.on('wizardStateChanged', handleWizardChange);
    return () => {
      emitter.off('wizardStateChanged', handleWizardChange);
    };
  }, []);

  // Listen for tile restore events (when going back from shape steps)
  useEffect(() => {
    const handleRestoreTile = ({ x, y }: { x: number; y: number }) => {
      restoreBlocks([{ x, y }]);
    };

    emitter.on('restoreTile', handleRestoreTile);
    return () => {
      emitter.off('restoreTile', handleRestoreTile);
    };
  }, []);

  // Listen for map selection events - must be at this level since modal content unmounts when closed
  useEffect(() => {
    const handleRiverMouth1ShapeSelected = ({ value }: { value: number }) => {
      const currentState = getWizardState();
      const riverDir = currentState.riverDirection as RiverDirection;

      // Get block position for first river mouth (always bottom river)
      let blockX: number;
      switch (riverDir) {
        case 'west': blockX = 4; break;
        case 'east': blockX = 2; break;
        case 'south': blockX = 1; break;
      }

      replaceBlocks({ x: blockX, y: 5, assetIndex: categoryAssetIndices.bottom_river[value] });
      setRiverMouth1Shape(value);
    };

    const handleRiverMouth2ShapeSelected = ({ value }: { value: number }) => {
      const currentState = getWizardState();
      const riverDir = currentState.riverDirection as RiverDirection;

      let block: { x: number; y: number };
      let riverAssets: number[];

      switch (riverDir) {
        case 'west':
          block = { x: 0, y: 2 };
          riverAssets = categoryAssetIndices.left_river;
          break;
        case 'east':
          block = { x: 6, y: 2 };
          riverAssets = categoryAssetIndices.right_river;
          break;
        case 'south':
          block = { x: 5, y: 5 };
          riverAssets = categoryAssetIndices.bottom_river;
          break;
      }

      replaceBlocks({ ...block, assetIndex: riverAssets[value] });
      setRiverMouth2Shape(value);
    };

    const handleAirportSelected = ({ index }: { index: number }) => {
      // Get current wizard state (not from React state which might be stale in closure)
      const currentState = getWizardState();
      const riverDir = currentState.riverDirection as RiverDirection;
      const airportBlocks = getAirportBlocks(riverDir, index);

      // Replace the placeholder blocks with airport tiles
      for (let i = 0; i < airportBlocks.length; i++) {
        replaceBlocks({ x: airportBlocks[i].x, y: airportBlocks[i].y, assetIndex: categoryAssetIndices.airport[i] });
      }

      setAirportPosition(index);
    };

    const handlePeninsulaPosSelected = ({ index }: { index: number }) => {
      setPeninsulaPosition(index);
    };

    const handlePeninsulaShapeSelected = ({ value }: { value: number }) => {
      const currentState = getWizardState();
      const side = currentState.peninsulaSide as 'left' | 'right';
      const posIndex = currentState.peninsulaPosition as number;

      // Map position index to block row (positions are at 20%, 40%, 60%, 80% of height)
      // Position 0 → block row 1, Position 1 → row 2, etc.
      const blockY = posIndex + 1;
      const blockX = side === 'left' ? 0 : 6; // horizontalBlocks - 1

      const peninsulaAssets = side === 'left'
        ? categoryAssetIndices.left_peninsula
        : categoryAssetIndices.right_peninsula;

      replaceBlocks({ x: blockX, y: blockY, assetIndex: peninsulaAssets[value] });

      setPeninsulaShape(value);
    };

    const handleDockShapeSelected = ({ value }: { value: number }) => {
      const currentState = getWizardState();
      const dockSide = currentState.dockSide as 'left' | 'right';

      // Dock is at bottom corners: left (0, 5) or right (6, 5)
      const blockX = dockSide === 'left' ? 0 : 6;
      const blockY = 5;

      const dockAssets = dockSide === 'left'
        ? categoryAssetIndices.bottom_left_dock
        : categoryAssetIndices.bottom_right_dock;

      replaceBlocks({ x: blockX, y: blockY, assetIndex: dockAssets[value] });

      setDockShape(value);
    };

    const handleSecretBeachPosSelected = ({ index }: { index: number }) => {
      setSecretBeachPosition(index);
    };

    const handleSecretBeachShapeSelected = ({ value }: { value: number }) => {
      const currentState = getWizardState();
      const riverDir = currentState.riverDirection as RiverDirection;
      const posIndex = currentState.secretBeachPosition as number;

      // Get the block position for the secret beach
      const block = getSecretBeachBlock(riverDir, posIndex);

      replaceBlocks({ ...block, assetIndex: categoryAssetIndices.top_secret_beach[value] });

      setSecretBeachShape(value);
    };

    const handleLeftRockPosSelected = ({ index }: { index: number }) => {
      setLeftRockPosition(index);
    };

    const handleLeftRockShapeSelected = ({ value }: { value: number }) => {
      const currentState = getWizardState();
      const posIndex = currentState.leftRockPosition as number;

      // Get the block position for the left rock
      const block = getRockBlock('left', posIndex);

      replaceBlocks({ ...block, assetIndex: categoryAssetIndices.left_rock[value] });

      setLeftRockShape(value);
    };

    const handleRightRockPosSelected = ({ index }: { index: number }) => {
      setRightRockPosition(index);
    };

    const handleRightRockShapeSelected = ({ value }: { value: number }) => {
      const currentState = getWizardState();
      const posIndex = currentState.rightRockPosition as number;

      // Get the block position for the right rock
      const block = getRockBlock('right', posIndex);

      replaceBlocks({ ...block, assetIndex: categoryAssetIndices.right_rock[value] });

      setRightRockShape(value);
    };

    const handlePlaceholderShapeSelected = ({ value }: { value: number }) => {
      const placeholders = getRemainingPlaceholders();

      if (placeholders.length > 0) {
        // Always use index 0 since getRemainingPlaceholders() returns only remaining items
        const placeholder = placeholders[0];
        const indices = tileAssetIndices[placeholder.type];

        // Track the position being filled (for going back)
        filledPlaceholderPositions.current.push({ x: placeholder.x, y: placeholder.y });

        // Replace the placeholder with selected tile
        replaceBlocks({ x: placeholder.x, y: placeholder.y, assetIndex: indices[value] });

        // Check if there are more placeholders
        const remainingAfter = getRemainingPlaceholders();
        if (remainingAfter.length > 0) {
          // Advance to next placeholder
          advanceToNextPlaceholder();
        } else {
          // All done, move to grid
          finishPlaceholders();
        }
      }
    };

    const handleRestoreFilledPlaceholder = () => {
      const position = filledPlaceholderPositions.current.pop();
      if (position) {
        restoreBlocks([position]);
      }
    };

    // Function that returns a promise that resolves after 'ms' milliseconds
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleAutoIslandFlow = async (state: WizardState) => {
      // Set all wizard state values (first/simplest options)
      state.riverDirection = 'west';
      state.dockSide = 'right'; // auto-set by west
      state.riverMouth1Shape = 0;
      state.riverMouth2Shape = 0;
      state.airportPosition = 0;
      state.dockShape = 0;
      state.peninsulaSide = 'left';
      state.peninsulaPosition = 0;
      state.peninsulaShape = 0;
      state.secretBeachPosition = 0;
      state.secretBeachShape = 0;
      state.leftRockPosition = 0;
      state.leftRockShape = 0;
      state.rightRockPosition = 0;
      state.rightRockShape = 0;

      // Load blank map first
      const blankLayout = Layouts.blank[0];
      loadMapFromJSONString(blankLayout.data);

      // Show edge tiles and set river tiles
      initializeEdgeTiles();

      setRiverTiles(state.riverDirection as RiverDirection);

      // Replace tiles sequentially to avoid async race conditions
      // River mouth 1 (west: block (4,5))
      replaceBlocks({ x: 4, y: 5, assetIndex: categoryAssetIndices.bottom_river[0] });

      // River mouth 2 (west: left river at (0,2))
      replaceBlocks({ x: 0, y: 2, assetIndex: categoryAssetIndices.left_river[0] });

      // Airport (west, position 0: blocks (1,5) and (2,5))
      const airportBlocks = getAirportBlocks('west', 0);
      replaceBlocks({ x: airportBlocks[0].x, y: airportBlocks[0].y, assetIndex: categoryAssetIndices.airport[0] });
      replaceBlocks({ x: airportBlocks[1].x, y: airportBlocks[1].y, assetIndex: categoryAssetIndices.airport[1] });

      // Dock (right side, shape 0: block (6,5))
      replaceBlocks({ x: 6, y: 5, assetIndex: categoryAssetIndices.bottom_right_dock[0] });

      // Peninsula (left side, position 0, shape 0: block (0,1))
      replaceBlocks({ x: 0, y: 1, assetIndex: categoryAssetIndices.left_peninsula[0] });

      // Secret beach (west, position 0, shape 0)
      const secretBeachBlock = getSecretBeachBlock('west', 0);
      replaceBlocks({ ...secretBeachBlock, assetIndex: categoryAssetIndices.top_secret_beach[0] });

      // Left rock (position 0, shape 0)
      const leftRockBlock = getRockBlock('left', 0);
      replaceBlocks({ ...leftRockBlock, assetIndex: categoryAssetIndices.left_rock[0] });

      // Right rock (position 0, shape 0)
      const rightRockBlock = getRockBlock('right', 0);
      replaceBlocks({ ...rightRockBlock, assetIndex: categoryAssetIndices.right_rock[0] });

      // hacky, wait for edge tiles to load first
      await delay(400);

      // Fill all remaining placeholders with first option
      let placeholders = getRemainingPlaceholders();
      while (placeholders.length > 0) {
        const placeholder = placeholders[0];
        const indices = tileAssetIndices[placeholder.type];
        replaceBlocks({ x: placeholder.x, y: placeholder.y, assetIndex: indices[0] });
        // hacky, wait for edge tile to load first
        await delay(200);
        placeholders = getRemainingPlaceholders();
      }

      // Now open modal at grid step
      setWizardState({ ...state });
      emitter.emit('wizardStateChanged', state);
    };

    emitter.on('riverMouth1ShapeSelected', handleRiverMouth1ShapeSelected);
    emitter.on('riverMouth2ShapeSelected', handleRiverMouth2ShapeSelected);
    emitter.on('airportSelected', handleAirportSelected);
    emitter.on('peninsulaPosSelected', handlePeninsulaPosSelected);
    emitter.on('peninsulaShapeSelected', handlePeninsulaShapeSelected);
    emitter.on('dockShapeSelected', handleDockShapeSelected);
    emitter.on('secretBeachPosSelected', handleSecretBeachPosSelected);
    emitter.on('secretBeachShapeSelected', handleSecretBeachShapeSelected);
    emitter.on('leftRockPosSelected', handleLeftRockPosSelected);
    emitter.on('leftRockShapeSelected', handleLeftRockShapeSelected);
    emitter.on('rightRockPosSelected', handleRightRockPosSelected);
    emitter.on('rightRockShapeSelected', handleRightRockShapeSelected);
    emitter.on('placeholderShapeSelected', handlePlaceholderShapeSelected);
    emitter.on('restoreFilledPlaceholder', handleRestoreFilledPlaceholder);
    emitter.on('autoIslandFlow', handleAutoIslandFlow);

    return () => {
      emitter.off('riverMouth1ShapeSelected', handleRiverMouth1ShapeSelected);
      emitter.off('riverMouth2ShapeSelected', handleRiverMouth2ShapeSelected);
      emitter.off('airportSelected', handleAirportSelected);
      emitter.off('peninsulaPosSelected', handlePeninsulaPosSelected);
      emitter.off('peninsulaShapeSelected', handlePeninsulaShapeSelected);
      emitter.off('dockShapeSelected', handleDockShapeSelected);
      emitter.off('secretBeachPosSelected', handleSecretBeachPosSelected);
      emitter.off('secretBeachShapeSelected', handleSecretBeachShapeSelected);
      emitter.off('leftRockPosSelected', handleLeftRockPosSelected);
      emitter.off('leftRockShapeSelected', handleLeftRockShapeSelected);
      emitter.off('rightRockPosSelected', handleRightRockPosSelected);
      emitter.off('rightRockShapeSelected', handleRightRockShapeSelected);
      emitter.off('placeholderShapeSelected', handlePlaceholderShapeSelected);
      emitter.off('restoreFilledPlaceholder', handleRestoreFilledPlaceholder);
      emitter.off('autoIslandFlow', handleAutoIslandFlow);
    };
  }, []);

  const refCallback = useBlockZoom();

  return (
    <div>
      <button id="open-map-select" style={{display: 'none'}} onClick={startModal}>Open Modal</button>
      <button id="close-map-select" style={{display: 'none'}} onClick={closeModal}>Open Modal</button>
      {/* @ts-ignore - react-modal types incompatible with React 16 */}
      <Modal
        isOpen={modalIsOpen}
        closeTimeoutMS={200} // keep in sync with modal.scss
        onAfterOpen={afterOpenModal}
        onRequestClose={closeModal}
        style={customStyles}
        sx={{}}
        contentLabel="Example Modal"
        ariaHideApp={false}
      >
        <Flex
          ref={refCallback}
          p={3}
          sx={{
            backgroundColor : colors.paper.cssColor,
            border: 0,
            borderRadius: 8,
            flexDirection: 'column',
            overflow: 'auto',
            //borderRadius: 60,
            //minWidth: 260,
          }}>
          <Box p={2} sx={{
            backgroundColor: colors.level3.cssColor,
            borderRadius: '30px 4px 4px 30px',
          }}>
            <Image variant='block' sx={{maxWidth: 150}} src='static/img/nook-inc-white.png'/>
          </Box>
          <IslandLayoutSelector wizardState={wizardState} />
          <Box p={3} sx={{
            backgroundColor: colors.level3.cssColor,
            borderRadius: '4px 30px 30px 4px',
          }} />
        </Flex>
      </Modal>
    </div>
  );
}

function IslandLayoutSelector({ wizardState }: { wizardState: WizardState }) {
  const [layout, setLayout] = useState<number>(-1);
  const [help, setHelp] = useState<boolean>(false);

  // Handle layout selection in grid
  useEffect(() => {
    if (layout != -1) {
      const layoutType = wizardState.riverDirection as LayoutType;
      const layouts = getLayouts(layoutType);
      if (layouts[layout]) {
        loadMapFromJSONString(layouts[layout].data);
        resetWizard();
      }
    }
  }, [layout, wizardState.riverDirection]);

  function getLayouts(type: LayoutType | null): Layout[] {
    switch (type) {
      case LayoutType.west:
        return Layouts.west;
      case LayoutType.south:
        return Layouts.south;
      case LayoutType.east:
        return Layouts.east;
      case LayoutType.blank:
        return Layouts.blank;
    }
    return [];
  }

  // Help screen
  if (help) {
    return (
      <Flex p={[0, 3]} sx={{flexDirection: 'column', alignItems: 'center', position: 'relative'}}>
        <Box sx={{position: 'absolute', left: 0, top: [1, 30]}}>
          <Button variant='icon' onClick={() => setHelp(false)}>
            <Image sx={{width: 'auto'}} src='static/img/back.png' />
          </Button>
        </Box>
        <Image sx={{width: 100, margin: 'auto'}} src={'static/img/blathers.png'}/>
        <Heading m={3} sx={{px: 4, textAlign: 'center'}}>{'Please help contribute!'}</Heading>
        <Text my={2}>{'Sorry, we don\'t have all the map templates yet (there are almost 100 river layouts in the game!). Each option you see here has been hand-made by a member of the community.'}</Text>
        <Text my={2}>{'You can use the \'Upload Screenshot\' tool to trace an image of your island. When you\'re done please consider contributing your island map in either the '}<Link href={'https://github.com/eugeneration/HappyIslandDesigner/issues/59'}>Github</Link>{' or '}<Link href={'https://discord.gg/EtaqD5H'}>Discord</Link>!</Text>
        <Text my={2}>{'Please note that your island may have different shaped rock formations, beaches, and building positions than another island with the same river layout.'}</Text>
      </Flex>
    );
  }

  // Render content based on wizard step
  const renderContent = () => {
    switch (wizardState.step) {
      case 'river':
        return <RiverDirectionStep />;
      case 'baseMapGrid':
        return <BaseMapGridStep
          layoutType={wizardState.riverDirection as LayoutType}
          onSelect={async (baseMapIndex) => {
            await loadBaseMapFromSvg(baseMapIndex);
            resetWizard();
          }}
          onBack={goBack}
        />;
      case 'peninsulaSide':
        return <PeninsulaSideStep onBack={goBack} />;
      case 'dockSide':
        return <DockSideStep onBack={goBack} />;
      case 'legacyriver':
        return <LegacyRiverDirectionStep onBack={goBack} />;
      case 'legacygrid':
      case 'grid':
        return <IslandGridStep
          layoutType={wizardState.riverDirection as LayoutType}
          layouts={getLayouts(wizardState.riverDirection as LayoutType)}
          onSelect={(index) => {
            confirmDestructiveAction(
              'Clear your map? You will lose all unsaved changes.',
              () => setLayout(index)
            );
          }}
          onHelp={() => setHelp(true)}
          onBack={goBack}
        />;
      default:
        return null;
    }
  };

  return (
    <Box p={[0, 3]} sx={{position: 'relative'}}>
      {renderContent()}
    </Box>
  );
}

// Step 1: River Direction
function RiverDirectionStep() {
  const handleClick = (direction: 'west' | 'south' | 'east') => {
    confirmDestructiveAction(
      'Clear your map? You will lose all unsaved changes.',
      async () => {
        // load blank terrain
        await loadBaseMapFromSvg(0);

        // Set direction and move to next step - wizard state handler will show airport selector
        setRiverDirection(direction);
      }
    );
  };

  const handleLegacyClick = () => {
    goToLegacyRiverSelection();
  }

  return (
    <>
      <Heading m={2} sx={{textAlign: 'center'}}>{'Choose your Layout!'}</Heading>
      <Flex sx={{flexDirection: ['column', 'row'], alignItems: 'center'}}>
        <Card onClick={() => handleClick('west')}><Image variant='card' src={'static/img/island-type-west.png'}/></Card>
        <Card onClick={() => handleClick('south')}><Image variant='card' src={'static/img/island-type-south.png'}/></Card>
        <Card onClick={() => handleClick('east')}><Image variant='card' src={'static/img/island-type-east.png'}/></Card>
      </Flex>
      <Flex sx={{flexDirection: ['column', 'row'], justifyContent: 'center', alignItems: 'center'}}>
        <Button variant='borderless' onClick={handleLegacyClick}>
          <Text variant='secondary'>or use a Creative Mode template</Text>
        </Button>
      </Flex>
    </>
  );
}

// Base Map Grid Step - shows pre-made base maps for the selected river direction
interface BaseMapGridStepProps {
  layoutType: LayoutType;
  onSelect: (baseMapIndex: number) => void;
  onBack: () => void;
}

function BaseMapGridStep({ layoutType, onSelect, onBack }: BaseMapGridStepProps) {
  const baseMapIndices = baseMapLayouts[layoutType] || [];

  return (
    <>
      <Box sx={{position: 'absolute', left: 0, top: [1, 3]}}>
        <Button variant='icon' onClick={onBack}>
          <Image src='static/img/back.png' />
        </Button>
      </Box>
      <Heading m={2} sx={{px: 4, textAlign: 'center'}}>{'Choose a Base Map!'}</Heading>
      <Text m={2} sx={{textAlign: 'center'}}>{'Select a base map for your island terrain.'}</Text>
      <Grid
        gap={0}
        columns={[2, 3, 4]}
        sx={{justifyItems: 'center' }}>
        {/* Blank option first (index 0) */}
        <Card key={0} onClick={() => onSelect(0)}>
          <Image variant='card' src={'static/img/island-type-blank.png'}/>
        </Card>
        {/* River direction base maps */}
        {baseMapIndices.map((baseMapIndex) => {
          const baseMap = baseMapCache[baseMapIndex];
          if (!baseMap) return null;
          return (
            <Card
              key={baseMapIndex}
              onClick={() => onSelect(baseMapIndex)}>
              <Image variant='card' src={`static/base_map/${baseMap}`}/>
            </Card>
          );
        })}
      </Grid>
    </>
  );
}

// Step 1: River Direction
function LegacyRiverDirectionStep({ onBack }: { onBack: () => void }) {
  const handleClick = (direction: 'west' | 'south' | 'east') => {
    // Set direction and move to next step - wizard state handler will show airport selector
    setLegacyRiverDirection(direction);
  };

  const handleBlankClick = () => {
    confirmDestructiveAction(
      'Clear your map? You will lose all unsaved changes.',
      () => {
        const blankLayout = Layouts.blank[0];
        loadMapFromJSONString(blankLayout.data);
        resetWizard();
      }
    );
  };

  return (
    <>
      <Box sx={{position: 'absolute', left: 0, top: [1, 3]}}>
        <Button variant='icon' onClick={() => { onBack(); }}>
          <Image src='static/img/back.png' />
        </Button>
      </Box>
      <Heading m={2} sx={{textAlign: 'center'}}>{'Choose a Template!'}</ Heading>
      <Text m={2} sx={{textAlign: 'center'}}>{'Creative Mode lets you redraw the entire island, but not everything will work in game.'}</ Text>
      <Flex sx={{flexDirection: ['column', 'row'], alignItems: 'center'}}>
        <Card onClick={() => handleClick('west')}><Image variant='card' src={'static/img/island-type-west.png'}/></Card>
        <Card onClick={() => handleClick('south')}><Image variant='card' src={'static/img/island-type-south.png'}/></Card>
        <Card onClick={() => handleClick('east')}><Image variant='card' src={'static/img/island-type-east.png'}/></Card>
        <Card onClick={handleBlankClick}><Image variant='card' src={'static/img/island-type-blank.png'}/></Card>
      </Flex>
    </>
  );
}

// Step 3: Peninsula Side
function PeninsulaSideStep({ onBack }: { onBack: () => void }) {
  const handleClick = (side: 'left' | 'right') => {
    setPeninsulaSide(side);

    // Show peninsula position selector
    setTimeout(() => {
      const selectorType: SelectionType = side === 'left' ? 'peninsulaLeft' : 'peninsulaRight';
      showPositionSelector(selectorType);
    }, 250);
  };

  return (
    <>
      <Box sx={{position: 'absolute', left: 0, top: [1, 3]}}>
        <Button variant='icon' onClick={() => { hidePositionSelector(); onBack(); }}>
          <Image src='static/img/back.png' />
        </Button>
      </Box>
      <Heading m={2} sx={{px: 4, textAlign: 'center'}}>{'Peninsula Side?'}</Heading>
      <Flex sx={{flexDirection: ['column', 'row'], alignItems: 'center', justifyContent: 'center'}}>
        <Card onClick={() => handleClick('left')}>
          <Image variant='card' src={'static/img/island-peninsula-left.png'}/>
        </Card>
        <Card onClick={() => handleClick('right')}>
          <Image variant='card' src={'static/img/island-peninsula-right.png'}/>
        </Card>
      </Flex>
    </>
  );
}

// Step 4: Dock Side
function DockSideStep({ onBack }: { onBack: () => void }) {
  const handleClick = (side: 'left' | 'right') => {
    setDockSide(side);
  };

  return (
    <>
      <Box sx={{position: 'absolute', left: 0, top: [1, 3]}}>
        <Button variant='icon' onClick={() => { hidePositionSelector(); onBack(); }}>
          <Image src='static/img/back.png' />
        </Button>
      </Box>
      <Heading m={2} sx={{px: 4, textAlign: 'center'}}>{'Dock Side?'}</Heading>
      <Flex sx={{flexDirection: ['column', 'row'], alignItems: 'center', justifyContent: 'center'}}>
        <Card onClick={() => handleClick('left')}>
          <Image variant='card' src={'static/img/island-dock-left.png'}/>
        </Card>
        <Card onClick={() => handleClick('right')}>
          <Image variant='card' src={'static/img/island-dock-right.png'}/>
        </Card>
      </Flex>
    </>
  );
}

// Step 6: Island Grid
interface IslandGridStepProps {
  layoutType: LayoutType;
  layouts: Layout[];
  onSelect: (index: number) => void;
  onHelp: () => void;
  onBack: () => void;
}

function IslandGridStep({ layoutType, layouts, onSelect, onHelp, onBack }: IslandGridStepProps) {
  return (
    <>
      <Box sx={{position: 'absolute', left: 0, top: [1, 3]}}>
        <Button variant='icon' onClick={onBack}>
          <Image src='static/img/back.png' />
        </Button>
      </Box>
      <Heading m={2} sx={{px: 4, textAlign: 'center'}}>{'Choose your Island!'}</Heading>
      <Text m={2} sx={{textAlign: 'center'}}>{'You probably won\'t find an exact match, but pick one that roughly resembles your island.'}</Text>
      <Grid
        gap={0}
        columns={[2, 3, 4]}
        sx={{justifyItems: 'center' }}>
        {layouts.map((layout, index) => (
          <Card
            key={index}
            onClick={() => onSelect(index)}>
            <Image variant='card' src={`static/img/layouts/${layoutType}-${layout.name}.png`}/>
          </Card>
        )).concat(
          <Card key={'help'} onClick={onHelp}>
            <Image sx={{width: 24}} src={'static/img/menu-help.png'} />
            <Text sx={{fontFamily: 'body'}}>{'Why isn\'t my map here?'}</Text>
          </Card>
        )}
      </Grid>
    </>
  );
}

interface CardProps {
  children: React.ReactNode,
  onClick?: React.MouseEventHandler,
  maxWidth?: number,
}
function Card({children, onClick, maxWidth}: CardProps) {
  return (
    <Button
      p={2}
      m={[1, 2]}
      variant='card'
      onClick={onClick}
      sx={maxWidth ? {maxWidth: maxWidth} : {maxWidth: 185}}
    >
      {children}
    </Button>
  );
}
