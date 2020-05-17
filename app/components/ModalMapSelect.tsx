import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import {Box, Button, Image, Flex, Grid, Heading, Text, Link} from 'theme-ui'
import { colors } from '../colors';
import './modal.scss';
import Layouts, { LayoutType, Layout } from './islandLayouts';
import useBlockZoom from './useBlockZoom';

import { loadMapFromJSONString } from '../load';
import {confirmDestructiveAction, isMapEmpty} from '../state';

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
  function openModal() {
    setIsOpen(true);
  }

  function afterOpenModal() {

  }

  function closeModal(){
    if (!isMapEmpty())
      setIsOpen(false);
  }

  useEffect(() => {
    Modal.setAppElement('body');
  }, []);

  const refCallback = useBlockZoom();

  return (
    <div>
      <button id="open-map-select" style={{display: 'none'}} onClick={openModal}>Open Modal</button>
      <button id="close-map-select" style={{display: 'none'}} onClick={closeModal}>Open Modal</button>
      <Modal
        isOpen={modalIsOpen}
        closeTimeoutMS={200} // keep in sync with modal.scss
        onAfterOpen={afterOpenModal}
        onRequestClose={closeModal}
        style={customStyles}
        sx={{}}
        contentLabel="Example Modal"
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
          <IslandLayoutSelector />
          <Box p={3} sx={{
            backgroundColor: colors.level3.cssColor,
            borderRadius: '4px 30px 30px 4px',
          }} />
        </Flex>
      </Modal>
    </div>
  );
}

function IslandLayoutSelector() {
  const [layoutType, setLayoutType] = useState<LayoutType>(LayoutType.none);
  const [layout, setLayout] = useState<number>(-1);
  const [help, setHelp] = useState<boolean>(false);

  useEffect(() => {
    if (layout != -1)
    {
      const layoutData = getLayouts(layoutType)[layout];
      loadMapFromJSONString(layoutData.data);
      CloseMapSelectModal();
    }
  }, [layoutType, layout]);

  function getLayouts(type: LayoutType) {
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

  if (help) {
    return (
      <Flex p={[0, 3]} sx={{flexDirection: 'column', alignItems: 'center', position: 'relative'}}>
        <Box sx={{position: 'absolute', left: 0, top: [1, 30]}}>
          <Button variant='icon' onClick={() => setHelp(false)}>
            <Image sx={{width: 'auto'}} src='static/img/back.png' />
          </Button>
        </Box>
        <Image sx={{width: 100, margin: 'auto'}} src={'static/img/blathers.png'}/>
        <Heading m={3} sx={{px: layoutType ? 4 : 0, textAlign: 'center'}}>{'Please help contribute!'}</Heading>
        <Text my={2}>{'Sorry, we don\'t have all the map templates yet (there are almost 100 river layouts in the game!). Each option you see here has been hand-made by a member of the community.'}</Text>
        <Text my={2}>{'You can use the \'Upload Screenshot\' tool to trace an image of your island. When you\'re done please consider contributing your island map in either the '}<Link href={'https://github.com/eugeneration/HappyIslandDesigner/issues/59'}>Github</Link>{' or '}<Link href={'https://discord.gg/EtaqD5H'}>Discord</Link>!</Text>
        <Text my={2}>{'Please note that your island may have different shaped rock formations, beaches, and building positions than another island with the same river layout.'}</Text>
      </Flex>
    )
  }

  let content;
  if (layoutType != LayoutType.none) {
    var layouts: Array<Layout> = getLayouts(layoutType);
    content = (
      <Grid
        gap={0}
        columns={[2, 3, 4]}
        sx={{justifyItems: 'center' }}>
        {
          layouts.map((layout, index) => (
            <Card
              key={index}
              onClick={() => {
                confirmDestructiveAction(
                  'Clear your map? You will lose all unsaved changes.',
                  () => {
                    setLayout(index);
                  });
              }}>
              <Image variant='card' src={`static/img/layouts/${layoutType}-${layout.name}.png`}/>
            </Card>
          )).concat(
            <Card key={'help'} onClick={()=>{setHelp(true)}}>
              <Image sx={{width: 24}} src={'static/img/menu-help.png'} />
              <Text sx={{fontFamily: 'body'}}>{'Why isn\'t my map here?'}</Text>
            </Card>
          )
        }
      </Grid>
    );
  }
  else {
    content = (
      <Flex sx={{flexDirection: ['column', 'row'], alignItems: 'center'}}>
        <Card onClick={() => setLayoutType(LayoutType.west)}><Image variant='card' src={'static/img/island-type-west.png'}/></Card>
        <Card onClick={() => setLayoutType(LayoutType.south)}><Image variant='card' src={'static/img/island-type-south.png'}/></Card>
        <Card onClick={() => setLayoutType(LayoutType.east)}><Image variant='card' src={'static/img/island-type-east.png'}/></Card>
        <Card onClick={() => {
          setLayoutType(LayoutType.blank);
          confirmDestructiveAction(
            'Clear your map? You will lose all unsaved changes.',
            () => {
              setLayout(0);
            });
        }}><Image variant='card' src={'static/img/island-type-blank.png'}/></Card>      </Flex>
    );
  }
  return (
    <Box p={[0, 3]} sx={{position: 'relative'}}>
      {layoutType && <Box sx={{position: 'absolute', top: [1, 3]}}>
        <Button variant='icon' onClick={() => setLayoutType(LayoutType.none)}>
          <Image src='static/img/back.png' />
        </Button>
      </Box>}
      <Heading m={2} sx={{px: layoutType ? 4 : 0, textAlign: 'center'}}>{layoutType ? 'Choose your Island!' : 'Choose your Layout!'}</Heading>
      {layoutType && <Text m={2} sx={{textAlign: 'center'}}>{'You probably won\'t find an exact match, but pick one that roughly resembles your island.'}</Text>}
      {content}
    </Box>
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
