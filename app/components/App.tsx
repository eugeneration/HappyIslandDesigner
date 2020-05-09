import * as React from 'react';
import { ThemeProvider } from 'theme-ui'
import theme from './theme'
import {Global, Box, Flex, Text} from 'theme-ui'

export interface AppProps { }

export function App(props: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <main>
        <Flex
          px={2}
          color='color'
          bg='background'
          alignItems='center'>
          <Text p={2}>Rebass</Text>
          <Box mx='auto' />
        </Flex>
      </main>
    </ThemeProvider>
  );
}
