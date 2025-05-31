import eslint from 'vite-plugin-eslint';

/**
* @type {import('vite').UserConfig}
*/
export default {
  plugins: [eslint()],
  // eslint-disable-next-line no-undef
  base: process.env.NODE_ENV === 'production' ? 'sunshine/' : ''
}
