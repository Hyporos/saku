import type { Preview } from '@storybook/react-vite';
import '../src/global.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "#292A30" },
        { name: "panel", value: "#222328" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;