import type { Config } from 'tailwindcss';
import uiPreset from '@tecpap/ui/tailwind-preset';

const config: Config = {
  presets: [uiPreset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
