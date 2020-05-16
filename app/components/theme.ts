import {colors} from '../colors'
import { changePaintTool } from '../paint'

const shadowColor = "rgba(75, 59, 50, 0.3)" // offblack

// example theme.js
export default {
  breakpoints: [
    '40em', '56em', '64em',
  ],

  colors: {
    text: colors.text.cssColor,
    background: colors.paper.cssColor,
    primary: '#33e',
    secondary: '#333',
    white: '#fff',
  },
  fontSizes: [
    12, 14, 16, 20, 24, 32, 48, 64
  ],
  space: [
    0, 4, 8, 16, 32, 64, 128, 256
  ],
  fonts: {
    body: '"Quicksand", "TTNorms", sans-serif',
    heading: '"TTNorms", sans-serif',
    monospace: 'monospace'
  },
  fontWeights: {
    body: 400,
    heading: 700,
    bold: 700
  },
  lineHeights: {
    body: 1.5,
    heading: 1.125,
  },

  images: {
    block: {
      display: 'block',
    },
    card: {
      display: 'block',
      width: '100%',
      maxWidth: 300,
      borderRadius: 6,
    },
  },

  buttons: {
    primary: {
      color: 'background',
      bg: 'primary',
      '&:hover': {
        bg: 'text',
      }
    },
    card: {
      color: 'text',
      bg: 'white',
      boxShadow: '0 0 3px 0 ' + shadowColor,
      borderRadius: 8,
      transition: 'transform 0.1s',
      '&:hover': {
        boxShadow: '2px 2px 3px 1px ' + shadowColor,
        transform: 'rotate(2deg) scale(1.05)'
      },
      '&:active': {
        boxShadow: '1px 1px 3px 1px ' + shadowColor,
      },
    },
    icon: {
      background: 'none',
      borderRadius: 24,
      width: 36,
      height: 36,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 2,
      '&:hover': {
        backgroundColor: colors.yellow.cssColor,
      },
    },
  },

  styles: {
    root: {
      // uses the theme values provided above
      fontFamily: 'body',
      fontWeight: 'body',
      userSelect: 'none',
      fontVariantLigatures: 'no-common-ligatures',
    },
    h1: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 5
    },
    h2: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 4
    },
    h3: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 3
    },
    h4: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 2
    },
    h5: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 1
    },
    h6: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 0
    },
    p: {
      color: 'text',
      fontFamily: 'body',
      fontWeight: 'body',
      lineHeight: 'body',
    },
    img: {
      display: 'block',
    },
  },
}
