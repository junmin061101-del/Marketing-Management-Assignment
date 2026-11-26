// Source of vendor/blob-upload.js. Rebuild after updating @vercel/blob:
//   npx esbuild scripts/vendor-src/blob-upload.mjs --bundle --minify --format=iife --platform=browser --target=es2019 "--define:process.env={}" --outfile=vendor/blob-upload.js
// The app gets the client token from /api/upload itself (with its login token) and passes it to put().
import { put } from '@vercel/blob/client';
window.GGBlob = { put };
