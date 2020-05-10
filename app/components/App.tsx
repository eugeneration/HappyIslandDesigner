import React from 'react';
import { ThemeProvider } from 'theme-ui'
import theme from './theme'
import ModalMapSelect from './ModalMapSelect';

//export interface AppProps { }

export function App(/*props: AppProps*/) {
  return (
    <ThemeProvider theme={theme}>
      <main>
        {/* <Flex
          p={2}
          color='color'
          bg='background'
          sx={{
            alignItems: 'center'
          }}>
          <Text p={2}>Rebass</Text>
          <Box mx='auto' />
        </Flex> */}
        <ModalMapSelect />
      </main>
    </ThemeProvider>
  );
}
