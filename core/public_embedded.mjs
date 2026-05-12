/**
 * public/ initial expansion sources.
 *
 * The frontend sources live in core/public-assets/ as normal HTML/CSS/JS files.
 * This module keeps the server-facing PUBLIC_FILES contract small and stable.
 *
 * License: Apache License 2.0
 * Copyright: Kazutora Harada / Nigimitamalove
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = join(__dirname, 'public-assets');

function readAsset(name) {
  return readFileSync(join(ASSET_DIR, name), 'utf8');
}

function readBinaryAsset(name) {
  return readFileSync(join(ASSET_DIR, name));
}

export const PUBLIC_FILES = {
  'index.html': readAsset('index.html'),
  'style.css': readAsset('style.css'),
  'app.js': readAsset('app.js'),
  'favicon-32.png': readBinaryAsset('favicon-32.png'),
  'apple-touch-icon.png': readBinaryAsset('apple-touch-icon.png'),
  'app-logo.png': readBinaryAsset('app-logo.png'),
};
