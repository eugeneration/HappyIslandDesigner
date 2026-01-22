import React, { useState, useEffect, useRef } from 'react';
import Modal from 'react-modal';
import paper from 'paper';
import {Box, Button, Image, Flex, Grid, Heading, Text, Link} from '@theme-ui/components'
import { colors } from '../colors';
import './modal.scss';
import Layouts, { LayoutType, Layout } from './islandLayouts';
import useBlockZoom from './useBlockZoom';

import { loadMapFromJSONString } from '../load';
import {confirmDestructiveAction, isMapEmpty} from '../state';
import { emitter } from '../emitter';
import { showPositionSelector, hidePositionSelector, SelectionType, getPeninsulaPosition, getAirportBlocks, getSecretBeachBlock, getSecretBeachPosition, getRockPosition, getRockBlock, RiverDirection } from '../ui/mapPositionSelector';
import { showOptionSelector, OptionDirection } from '../ui/mapOptionSelector';
import { showEdgeTiles, hideEdgeTiles, replaceBlocks, restoreBlocks, setRiverTiles, getRemainingPlaceholders, PlaceholderType } from '../ui/edgeTiles';
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
const tileImages: Record<PlaceholderType, string[]> = {
  top_left: [
    'static/tiles/top_left/26 - 3sy5W7R.png',
    'static/tiles/top_left/27 - mKkuBGS.png',
    'static/tiles/top_left/28 - Wsc0wcG.png',
  ],
  top_right: [
    'static/tiles/top_right/13 - PCgPfdN.png',
    'static/tiles/top_right/14 - f8zzseF.png',
    'static/tiles/top_right/15 - IXhHmuY.png',
  ],
  bottom_left: [
    'static/tiles/bottom_left/48 - iLjCW2O.png',
    'static/tiles/bottom_left/49 - epj7EMt.png',
    'static/tiles/bottom_left/50 - keMBShp.png',
    'static/tiles/bottom_left/51 - rjaAFsj.png',
  ],
  bottom_right: [
    'static/tiles/bottom_right/39 - AjicFEz.png',
    'static/tiles/bottom_right/40 - BsmCSdo.png',
    'static/tiles/bottom_right/41 - Ubewm2Y.png',
    'static/tiles/bottom_right/42 - 3TX1fOO.png',
  ],
  left: [
    'static/tiles/left/54 - qCe5VxM.png',
    'static/tiles/left/55 - MJwO2PW.png',
    'static/tiles/left/56 - G7cJXjm.png',
    'static/tiles/left/57 - pJU2kTE.png',
    'static/tiles/left/58 - r720Voz.png',
  ],
  right: [
    'static/tiles/right/1 - ISdNX8N.png',
    'static/tiles/right/2 - 0Nl1fz8.png',
    'static/tiles/right/3 - 8lHF1d5.png',
    'static/tiles/right/68 - KBHEtY0.png',
    'static/tiles/right/69 - BCpO1K5.png',
  ],
  top: [
    'static/tiles/top/19 - ZN9h9K4.png',
    'static/tiles/top/20 - hTYvr5L.png',
    'static/tiles/top/21 - 2lzjMi4.png',
    'static/tiles/top/22 - 1w29p5L.png',
    'static/tiles/top/23 - 5JzK0IN.png',
    'static/tiles/top/24 - qtgHzOc.png',
    'static/tiles/top/25 - pN01yZH.png',
  ],
  bottom: [
    'static/tiles/bottom/29 - QJsmplp.png',
    'static/tiles/bottom/30 - X7FbpvK.png',
    'static/tiles/bottom/31 - LRICn1q.png',
    'static/tiles/bottom/32 - BJ16eY9.png',
  ],
};

// Option selector direction for each placeholder type
const placeholderDirection: Record<PlaceholderType, OptionDirection> = {
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
            showEdgeTiles();
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
              options: [
                { label: '1', value: 0, imageSrc: 'static/tiles/bottom_river/45 - iaL3IcU.png' },
                { label: '2', value: 1, imageSrc: 'static/tiles/bottom_river/46 - TIj5eT1.png' },
                { label: '3', value: 2, imageSrc: 'static/tiles/bottom_river/47 - szIJe08.png' },
              ],
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
            let options: { label: string; value: number; imageSrc: string }[];
            let direction: OptionDirection;

            switch (riverDir) {
              case 'west':
                // Left river at (0, 2)
                anchorPoint = new paper.Point(8, 2 * 16 + 8);
                options = [
                  { label: '1', value: 0, imageSrc: 'static/tiles/left_river/62 - 3EvOplj.png' },
                  { label: '2', value: 1, imageSrc: 'static/tiles/left_river/63 - EX7BYGw.png' },
                ];
                direction = 'left';
                break;
              case 'east':
                // Right river at (6, 2)
                anchorPoint = new paper.Point(6 * 16 + 8, 2 * 16 + 8);
                options = [
                  { label: '1', value: 0, imageSrc: 'static/tiles/right_river/7 - OZtIhTC.png' },
                  { label: '2', value: 1, imageSrc: 'static/tiles/right_river/8 - hWGQub0.png' },
                ];
                direction = 'right';
                break;
              case 'south':
                // Second bottom river at (5, 5)
                anchorPoint = new paper.Point(5 * 16 + 8, 5 * 16 + 8);
                options = [
                  { label: '1', value: 0, imageSrc: 'static/tiles/bottom_river/45 - iaL3IcU.png' },
                  { label: '2', value: 1, imageSrc: 'static/tiles/bottom_river/46 - TIj5eT1.png' },
                  { label: '3', value: 2, imageSrc: 'static/tiles/bottom_river/47 - szIJe08.png' },
                ];
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
              ? [
                  { label: '1', value: 0, imageSrc: 'static/tiles/left_peninsula/59 - Dy1isCL.png' },
                  { label: '2', value: 1, imageSrc: 'static/tiles/left_peninsula/60 - oTGqpUF.png' },
                  { label: '3', value: 2, imageSrc: 'static/tiles/left_peninsula/61 - 4w4i9nr.png' },
                ]
              : [
                  { label: '1', value: 0, imageSrc: 'static/tiles/right_peninsula/4 - ZLMp5LA.png' },
                  { label: '2', value: 1, imageSrc: 'static/tiles/right_peninsula/5 - gZVRJnv.png' },
                  { label: '3', value: 2, imageSrc: 'static/tiles/right_peninsula/6 - ydnTxJO.png' },
                ];

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
              ? [
                  { label: '1', value: 0, imageSrc: 'static/tiles/bottom_left_dock/52 - bvT1yJ7.png' },
                  { label: '2', value: 1, imageSrc: 'static/tiles/bottom_left_dock/53 - W1DZoXV.png' },
                ]
              : [
                  { label: '1', value: 0, imageSrc: 'static/tiles/bottom_right_dock/43 - lRh7pLD.png' },
                  { label: '2', value: 1, imageSrc: 'static/tiles/bottom_right_dock/44 - Kkxl2RH.png' },
                ];

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
              options: [
                { label: '1', value: 0, imageSrc: 'static/tiles/top_secret_beach/16 - J9KTWix.png' },
                { label: '2', value: 1, imageSrc: 'static/tiles/top_secret_beach/17 - TJTblBV.png' },
                { label: '3', value: 2, imageSrc: 'static/tiles/top_secret_beach/18 - 4F6lHPo.png' },
              ],
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
              options: [
                { label: '1', value: 0, imageSrc: 'static/tiles/left_rock/64 - xifLxPa.png' },
                { label: '2', value: 1, imageSrc: 'static/tiles/left_rock/65 - pFh72wi.png' },
                { label: '3', value: 2, imageSrc: 'static/tiles/left_rock/66 - TnsI1wo.png' },
                { label: '4', value: 3, imageSrc: 'static/tiles/left_rock/67 - mQNwwge.png' },
              ],
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
              options: [
                { label: '1', value: 0, imageSrc: 'static/tiles/right_rock/9 - YSjtaWO.png' },
                { label: '2', value: 1, imageSrc: 'static/tiles/right_rock/10 - ByrJZyo.png' },
                { label: '3', value: 2, imageSrc: 'static/tiles/right_rock/11 - Ar9LNtJ.png' },
                { label: '4', value: 3, imageSrc: 'static/tiles/right_rock/12 - UgoRJy3.png' },
              ],
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
              const images = tileImages[placeholder.type];
              const direction = placeholderDirection[placeholder.type];

              // Calculate anchor point (center of the block)
              const anchorPoint = new paper.Point(
                placeholder.x * 16 + 8,
                placeholder.y * 16 + 8
              );

              // Create options from images
              const options = images.map((imageSrc, idx) => ({
                label: `${idx + 1}`,
                value: idx,
                imageSrc,
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

      const riverImages = [
        'static/tiles/bottom_river/45 - iaL3IcU.png',
        'static/tiles/bottom_river/46 - TIj5eT1.png',
        'static/tiles/bottom_river/47 - szIJe08.png',
      ];

      replaceBlocks([{ x: blockX, y: 5 }], [riverImages[value]], 'river');
      setRiverMouth1Shape(value);
    };

    const handleRiverMouth2ShapeSelected = ({ value }: { value: number }) => {
      const currentState = getWizardState();
      const riverDir = currentState.riverDirection as RiverDirection;

      let block: { x: number; y: number };
      let riverImages: string[];

      switch (riverDir) {
        case 'west':
          // Left river at (0, 2)
          block = { x: 0, y: 2 };
          riverImages = [
            'static/tiles/left_river/62 - 3EvOplj.png',
            'static/tiles/left_river/63 - EX7BYGw.png',
          ];
          break;
        case 'east':
          // Right river at (6, 2)
          block = { x: 6, y: 2 };
          riverImages = [
            'static/tiles/right_river/7 - OZtIhTC.png',
            'static/tiles/right_river/8 - hWGQub0.png',
          ];
          break;
        case 'south':
          // Second bottom river at (5, 5)
          block = { x: 5, y: 5 };
          riverImages = [
            'static/tiles/bottom_river/45 - iaL3IcU.png',
            'static/tiles/bottom_river/46 - TIj5eT1.png',
            'static/tiles/bottom_river/47 - szIJe08.png',
          ];
          break;
      }

      replaceBlocks([block], [riverImages[value]], 'river');
      setRiverMouth2Shape(value);
    };

    const handleAirportSelected = ({ index }: { index: number }) => {
      // Get current wizard state (not from React state which might be stale in closure)
      const currentState = getWizardState();
      const riverDir = currentState.riverDirection as RiverDirection;
      const airportBlocks = getAirportBlocks(riverDir, index);

      // Replace the placeholder blocks with airport images
      const airportImages = [
        'static/tiles/airport/34 - OmmYDBq.png',
        'static/tiles/airport/35 - bawoPn6.png',
      ];
      replaceBlocks(airportBlocks, airportImages, 'airport');

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

      // Get the peninsula image based on side and shape
      const peninsulaImages = side === 'left'
        ? [
            'static/tiles/left_peninsula/59 - Dy1isCL.png',
            'static/tiles/left_peninsula/60 - oTGqpUF.png',
            'static/tiles/left_peninsula/61 - 4w4i9nr.png',
          ]
        : [
            'static/tiles/right_peninsula/4 - ZLMp5LA.png',
            'static/tiles/right_peninsula/5 - gZVRJnv.png',
            'static/tiles/right_peninsula/6 - ydnTxJO.png',
          ];

      replaceBlocks([{ x: blockX, y: blockY }], [peninsulaImages[value]], 'peninsula');

      setPeninsulaShape(value);
    };

    const handleDockShapeSelected = ({ value }: { value: number }) => {
      const currentState = getWizardState();
      const dockSide = currentState.dockSide as 'left' | 'right';

      // Dock is at bottom corners: left (0, 5) or right (6, 5)
      const blockX = dockSide === 'left' ? 0 : 6;
      const blockY = 5;

      // Get the dock image based on side and shape
      const dockImages = dockSide === 'left'
        ? [
            'static/tiles/bottom_left_dock/52 - bvT1yJ7.png',
            'static/tiles/bottom_left_dock/53 - W1DZoXV.png',
          ]
        : [
            'static/tiles/bottom_right_dock/43 - lRh7pLD.png',
            'static/tiles/bottom_right_dock/44 - Kkxl2RH.png',
          ];

      replaceBlocks([{ x: blockX, y: blockY }], [dockImages[value]], 'dock');

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

      // Get the secret beach image based on shape
      const beachImages = [
        'static/tiles/top_secret_beach/16 - J9KTWix.png',
        'static/tiles/top_secret_beach/17 - TJTblBV.png',
        'static/tiles/top_secret_beach/18 - 4F6lHPo.png',
      ];

      replaceBlocks([block], [beachImages[value]], 'secretBeach');

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

      // Get the left rock image based on shape
      const rockImages = [
        'static/tiles/left_rock/64 - xifLxPa.png',
        'static/tiles/left_rock/65 - pFh72wi.png',
        'static/tiles/left_rock/66 - TnsI1wo.png',
        'static/tiles/left_rock/67 - mQNwwge.png',
      ];

      replaceBlocks([block], [rockImages[value]], 'rock');

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

      // Get the right rock image based on shape
      const rockImages = [
        'static/tiles/right_rock/9 - YSjtaWO.png',
        'static/tiles/right_rock/10 - ByrJZyo.png',
        'static/tiles/right_rock/11 - Ar9LNtJ.png',
        'static/tiles/right_rock/12 - UgoRJy3.png',
      ];

      replaceBlocks([block], [rockImages[value]], 'rock');

      setRightRockShape(value);
    };

    const handlePlaceholderShapeSelected = ({ value }: { value: number }) => {
      const currentState = getWizardState();
      const placeholders = getRemainingPlaceholders();
      const currentIndex = currentState.currentPlaceholderIndex;

      if (currentIndex < placeholders.length) {
        const placeholder = placeholders[currentIndex];
        const images = tileImages[placeholder.type];

        // Track the position being filled (for going back)
        filledPlaceholderPositions.current.push({ x: placeholder.x, y: placeholder.y });

        // Replace the placeholder with selected tile
        replaceBlocks(
          [{ x: placeholder.x, y: placeholder.y }],
          [images[value]],
          'filled'
        );

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
        hideEdgeTiles();
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
      () => {
        // Load blank map
        const blankLayout = Layouts.blank[0];
        loadMapFromJSONString(blankLayout.data);

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
          <Text variant='secondary'>or enter creative mode</Text>
        </Button>
      </Flex>
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
        hideEdgeTiles();
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
      <Text m={2} sx={{textAlign: 'center'}}>{'Creative mode lets you redraw the entire island for fun, but not everything will work in game.'}</ Text>
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
