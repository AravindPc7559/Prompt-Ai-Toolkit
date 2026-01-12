#!/usr/bin/env node
/**
 * Creates minimal valid PNG icon files without dependencies
 * Run: node create-icons-simple.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table for PNG
const crcTable = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Helper to create PNG chunk
function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const dataBuf = Buffer.from(data);
  const chunk = Buffer.concat([typeBuf, dataBuf]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(chunk), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(dataBuf.length, 0);
  return Buffer.concat([length, chunk, crc]);
}

function createPNG(size) {
  // PNG signature
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // Create IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);      // Width
  ihdrData.writeUInt32BE(size, 4);       // Height
  ihdrData[8] = 8;                        // Bit depth
  ihdrData[9] = 2;                        // Color type (RGB)
  ihdrData[10] = 0;                       // Compression
  ihdrData[11] = 0;                       // Filter
  ihdrData[12] = 0;                       // Interlace
  const ihdr = createChunk('IHDR', ihdrData);
  
  // Create image data (gradient purple)
  const rowSize = size * 3 + 1; // 3 bytes per pixel + 1 filter byte
  const imageData = Buffer.alloc(size * rowSize);
  
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowSize;
    imageData[rowStart] = 0; // Filter type: none
    for (let x = 0; x < size; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      // Create gradient from #667eea to #764ba2
      const ratio = Math.sqrt((x / size) ** 2 + (y / size) ** 2) / Math.sqrt(2);
      const r = Math.floor(102 + (118 - 102) * ratio);
      const g = Math.floor(126 + (75 - 126) * ratio);
      const b = Math.floor(234 + (162 - 234) * ratio);
      imageData[pixelStart] = Math.min(255, r);
      imageData[pixelStart + 1] = Math.max(0, g);
      imageData[pixelStart + 2] = Math.min(255, b);
    }
  }
  
  // Compress image data
  const compressed = zlib.deflateSync(imageData);
  const idat = createChunk('IDAT', compressed);
  
  // Create IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  // Combine all chunks
  return Buffer.concat([pngSignature, ihdr, idat, iend]);
}

// Create icons directory
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create icons
const sizes = [16, 48, 128];
sizes.forEach(size => {
  const pngData = createPNG(size);
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, pngData);
  console.log(`✅ Created icon${size}.png (${size}x${size})`);
});

console.log('\n✨ All icons created successfully!');
