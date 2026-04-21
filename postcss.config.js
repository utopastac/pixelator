import postcssMixins from 'postcss-mixins';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: [
    postcssMixins({
      mixinsFiles: path.join(__dirname, 'src/styles/mixins.css'),
    }),
  ],
};
