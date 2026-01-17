import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import {Box, Button, Image, Flex, Grid, Heading, Text, Link} from '@theme-ui/components'
import { colors } from '../colors';
import './modal.scss';
import Layouts, { LayoutType, Layout } from './islandLayouts';
import useBlockZoom from './useBlockZoom';

import { loadMapFromJSONString } from '../load';
import {confirmDestructiveAction, isMapEmpty} from '../state';
import { emitter } from '../emitter';
import { showPositionSelector, hidePositionSelector, SelectionType, getPeninsulaPosition, getAirportBlocks, RiverDirection } from '../ui/mapPositionSelector';
import { showOptionSelector, OptionDirection } from '../ui/mapOptionSelector';
import { showEdgeTiles, hideEdgeTiles, replaceBlocks, setRiverTiles } from '../ui/edgeTiles';
import {
  WizardState,
  getWizardState,
  resetWizard,
  setRiverDirection,
  setAirportPosition,
  setPeninsulaSide,
  setPeninsulaPosition,
  setPeninsulaShape,
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

export function OpenMapSelectModal() {
  document.getElementById('open-map-select')?.click();
}

export function CloseMapSelectModal() {
  document.getElementById('close-map-select')?.click();
}

export default function ModalMapSelect(){
  const [modalIsOpen,setIsOpen] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState>(getWizardState());

  function openModal() {
    setIsOpen(true);
  }

  function afterOpenModal() {

  }

  function closeModal(){
    if (!isMapEmpty() && wizardState.step == 'river')
      setIsOpen(false);
  }

  // Listen for wizard state changes - must be at this level since modal content unmounts when closed
  useEffect(() => {
    const handleWizardChange = (state: WizardState) => {
      setWizardState({ ...state });

      // If moving to a modal step, open modal
      if (isModalStep(state.step)) {
        openModal();
      }
      // If moving to a map step, close modal and show appropriate selector
      else if (isMapStep(state.step)) {
        setIsOpen(false);
        setTimeout(() => {
          if (state.step === 'airport') {
            // Show edge tiles only at the start of the wizard flow
            showEdgeTiles();
            // Replace placeholders with river tiles based on direction
            setRiverTiles(state.riverDirection as RiverDirection);
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

            showOptionSelector({
              anchorPoint,
              options: [
                { label: '1', value: 0, imageSrc: 'static/img/peninsula-shape-1.png' },
                { label: '2', value: 1, imageSrc: 'static/img/peninsula-shape-2.png' },
                { label: '3', value: 2, imageSrc: 'static/img/peninsula-shape-3.png' },
              ],
              direction,
              eventName: 'peninsulaShapeSelected',
              title: 'Shape?',
              spacing: 14,
              buttonSize: 12,
            });
          }
        }, 250);
      }
    };

    emitter.on('wizardStateChanged', handleWizardChange);
    return () => {
      emitter.off('wizardStateChanged', handleWizardChange);
    };
  }, []);

  // Listen for map selection events - must be at this level since modal content unmounts when closed
  useEffect(() => {
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
      setPeninsulaShape(value);
    };

    emitter.on('airportSelected', handleAirportSelected);
    emitter.on('peninsulaPosSelected', handlePeninsulaPosSelected);
    emitter.on('peninsulaShapeSelected', handlePeninsulaShapeSelected);

    return () => {
      emitter.off('airportSelected', handleAirportSelected);
      emitter.off('peninsulaPosSelected', handlePeninsulaPosSelected);
      emitter.off('peninsulaShapeSelected', handlePeninsulaShapeSelected);
    };
  }, []);

  const refCallback = useBlockZoom();

  return (
    <div>
      <button id="open-map-select" style={{display: 'none'}} onClick={openModal}>Open Modal</button>
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
        CloseMapSelectModal();
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
        CloseMapSelectModal();
      }
    );
  };

  const handleBlankClick = () => {
    confirmDestructiveAction(
      'Clear your map? You will lose all unsaved changes.',
      () => {
        const blankLayout = Layouts.blank[0];
        loadMapFromJSONString(blankLayout.data);
        CloseMapSelectModal();
        resetWizard();
        hideEdgeTiles();
      }
    );
  };

  return (
    <>
      <Heading m={2} sx={{textAlign: 'center'}}>{'Choose your Layout!'}</Heading>
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
    CloseMapSelectModal();

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
