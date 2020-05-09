import {colors} from '../colors'

// example theme.js
export default {
  colors: {
    text: colors.text.cssColor,
    background: colors.paper.cssColor,
    primary: '#33e',
  },
  fontSizes: [
    12, 14, 16, 20, 24, 32, 48, 64
  ],
  space: [
    0, 4, 8, 16, 32, 64, 128, 256
  ],
  fonts: {
    body: '"TTNorms", sans-serif',
    heading: 'inherit',
    monospace: 'monospace'
  },
  styles: {
    root: {
      // uses the theme values provided above
      fontFamily: 'body',
      fontWeight: 'body',
    },
  },
}
