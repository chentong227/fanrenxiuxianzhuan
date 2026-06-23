// Generate simple placeholder PNGs for spider images
// Creates a solid jade-green square with a white "灵" character drawn as pixels
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makePNG(width, height, drawFn) {
  // RGBA pixel data
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = a;
    }
  }

  // Build PNG
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    // CRC32
    const crcData = Buffer.concat([typeBuf, data]);
    let crcVal = 0xFFFFFFFF;
    for (let i = 0; i < crcData.length; i++) {
      crcVal ^= crcData[i];
      for (let j = 0; j < 8; j++) {
        crcVal = (crcVal & 1) ? (0xEDB88320 ^ (crcVal >>> 1)) : (crcVal >>> 1);
      }
    }
    crc.writeUInt32BE((crcVal ^ 0xFFFFFFFF) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT - raw pixel data with filter bytes
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    pixels.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', iend)]);
}

// Draw a simple jade-green background with a lighter circle in center (like a spirit orb)
function drawSpider(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxR = Math.min(w, h) * 0.35;

  // Background: dark jade green
  let r = 30, g = 80, b = 60, a = 255;

  // Spirit orb in center
  if (dist < maxR) {
    const t = 1 - dist / maxR;
    r = Math.round(80 + t * 100);
    g = Math.round(180 + t * 60);
    b = Math.round(140 + t * 80);
  } else if (dist < maxR + 3) {
    // Soft edge
    r = 60; g = 130; b = 100;
  }

  return [r, g, b, a];
}

const targets = [
  'assets/battlers/bt_baiyu_zhizhu.png',
  'assets/battlers/bt_xueyu_zhizhu.png',
  'assets/portraits/baiyu_zhizhu.png',
  'assets/portraits/xueyu_zhizhu.png',
];

const root = path.resolve(__dirname, '..');

for (const rel of targets) {
  const full = path.join(root, rel);
  // Battlers are typically ~400x600, portraits ~400x500
  const isBattler = rel.includes('battlers');
  const w = isBattler ? 400 : 400;
  const h = isBattler ? 600 : 500;
  const png = makePNG(w, h, drawSpider);
  fs.writeFileSync(full, png);
  console.log(`Generated placeholder: ${rel} (${w}x${h})`);
}
