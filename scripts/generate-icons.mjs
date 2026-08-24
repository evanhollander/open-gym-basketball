import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const src = join(__dirname, 'icon-source.svg');
const maskableSrc = join(__dirname, 'icon-maskable-source.svg');

async function make(source, size, outName) {
  await sharp(source).resize(size, size).png().toFile(join(publicDir, outName));
  console.log('wrote', outName);
}

await make(src, 192, 'pwa-192x192.png');
await make(src, 512, 'pwa-512x512.png');
await make(src, 180, 'apple-touch-icon.png');
await make(maskableSrc, 512, 'pwa-maskable-512x512.png');

// Also refresh the plain favicon to match the new basketball mark.
await sharp(src).resize(64, 64).png().toFile(join(publicDir, 'favicon.png'));

console.log('done');
