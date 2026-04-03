import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import { fileURLToPath } from 'url';
import { dirname, resolve as pathResolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = pathResolve(__dirname, '../theme-app-extension/public');

export default defineConfig([
  // ── Unminified build (development / debugging) ─────────────────────────
  {
    input: 'widget.ts',
    output: {
      file: pathResolve(OUTPUT_DIR, 'blindbox.js'),
      format: 'iife',
      name: 'BlindBoxApp',
      sourcemap: false,
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
      typescript({
        tsconfig: './tsconfig.json',
      }),
      postcss({
        extract: pathResolve(OUTPUT_DIR, 'blindbox.css'),
        minimize: false,
        inject: false, // CSS must be a separate file for Sline {{#asset}} tag
      }),
    ],
  },
  // ── Minified build (production) ────────────────────────────────────────
  {
    input: 'widget.ts',
    output: {
      file: pathResolve(OUTPUT_DIR, 'blindbox.min.js'),
      format: 'iife',
      name: 'BlindBoxApp',
      sourcemap: false,
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
      typescript({
        tsconfig: './tsconfig.json',
      }),
      postcss({
        extract: false, // CSS already extracted in first build
        inject: false,
        minimize: true,
      }),
      terser({
        compress: { drop_console: true },
        format: { comments: false },
      }),
    ],
  },
]);
