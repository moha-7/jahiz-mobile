import { createAnimations } from '@tamagui/animations-react-native';
import { defaultConfig } from '@tamagui/config/v5';
import { createTamagui } from 'tamagui';

const animations = createAnimations({
  instant: {
    damping: 30,
    mass: 0.7,
    stiffness: 500,
  },

  quick: {
    damping: 24,
    mass: 0.8,
    stiffness: 320,
  },

  smooth: {
    damping: 22,
    mass: 1,
    stiffness: 190,
  },

  gentle: {
    damping: 26,
    mass: 1.1,
    stiffness: 130,
  },

  spring: {
    damping: 16,
    mass: 0.9,
    stiffness: 210,
  },
});

const config = createTamagui({
  ...defaultConfig,

  animations,

  settings: {
    ...defaultConfig.settings,
    defaultPosition: 'relative',
    onlyAllowShorthands: false,
  },
});

export type JahizTamaguiConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends JahizTamaguiConfig {}
}

export default config;
