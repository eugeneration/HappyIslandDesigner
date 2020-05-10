import React, { useState, useEffect, useRef } from 'react';
import Modal from 'react-modal';
import {Box, Button, Image, Flex, Grid, Heading, Text} from 'theme-ui'
import { colors } from '../colors';
import './modal.scss';
import Layouts, { LayoutType, Layout } from './islandLayouts';
import useBlockZoom from './useBlockZoom';

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
    padding: 20,
    display: 'flex',
    maxHeight: '98%',
  }
};

export default function ModalMapSelect(){
  const [modalIsOpen,setIsOpen] = useState(false);
  function openModal() {
    setIsOpen(true);
  }

  function afterOpenModal() {

  }

  function closeModal(){
    setIsOpen(false);
  }

  useEffect(() => {
    openModal(); // TEMP


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
          <Box p={[0, 3]}>
            <Heading m={3} sx={{textAlign: 'center'}}>Choose your Island!</Heading>
            <IslandLayoutSelector />
          </Box>
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

  if (layoutType != LayoutType.none) {
    var layouts: Array<Layout> = [];
    switch (layoutType) {
      case LayoutType.west:
        layouts = Layouts.west;
        break;
      case LayoutType.south:
        layouts = Layouts.south;
        break;
      case LayoutType.east:
        layouts = Layouts.east;
        break;
    }
    return (
      <Flex sx={{flexDirection: 'column'}}>
        <Button onClick={() => setLayoutType(LayoutType.none)}><Text>Back</Text></Button>
        <Grid sx={{flexDirection: ['column', 'row']}}>
          {
            layouts.map((layout, index) => (
              <Card
                key={index}
                onClick={() => setLayout(index)}>
                <Image variant='card' src={`static/img/layouts/${layout.name}.png`}/>
              </Card>
            ))
          }
        </Grid>
        {layout >= 0 &&
          <Button onClick={() => alert('select layout ' + layoutType + layout)}><Text>Layout</Text></Button>}
      </Flex>
    );
  }
  return (
    <Flex sx={{flexDirection: ['column', 'row']}}>
      <Card onClick={() => setLayoutType(LayoutType.west)}><Image variant='card' src={'static/img/island-type-west.png'}/></Card>
      <Card onClick={() => setLayoutType(LayoutType.south)}><Image variant='card' src={'static/img/island-type-south.png'}/></Card>
      <Card onClick={() => setLayoutType(LayoutType.east)}><Image variant='card' src={'static/img/island-type-east.png'}/></Card>
    </Flex>
  );
}

interface CardProps {
  children: React.ReactNode,
  onClick?: React.MouseEventHandler,
}
function Card({children, onClick}: CardProps) {
  return (
    <Button
      p={2}
      m={2}
      variant='card'
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
