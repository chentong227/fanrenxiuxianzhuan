// Generate simple solid-color placeholder PNGs to replace spider images
// Creates a minimal valid PNG with a solid background color
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function makePNG(w, h, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT chunk - raw pixel data with filter byte per row
  const rowSize = w * 3 + 1;
  const raw = Buffer.alloc(rowSize * h);
  for (let y = 0; y < h; y++) {
    raw[y * rowSize] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const off = y * rowSize + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(raw);

  // IEND chunk
  const iend = Buffer.alloc(0);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    // CRC32
    const crcData = Buffer.concat([typeBuf, data]);
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < crcData.length; i++) {
      crc ^= crcData[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
      }
    }
    crcBuf.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend)
  ]);
}

// Replace spider images with solid color placeholders
// Muted teal-green for spider (neutral, non-spider)
const replacements = [
  { file: 'assets/portraits/baiyu_zhizhu.png', w: 400, h: 600 },
  { file: 'assets/battlers/bt_baiyu_zhizhu.png', w: 600, h: 800 },
  { file: 'assets/portraits/xueyu_zhizhu.png', w: 400, h: 600 },
  { file: 'assets/battlers/bt_xueyu_zhizhu.png', w: 600, h: 800 },
];

const COLOR = [120, 140, 130]; // muted sage green

for (const r of replacements) {
  const png = makePNG(r.w, r.h, COLOR[0], COLOR[1], COLOR[2]);
  const outPath = path.join(__dirname, '..', r.file);
  fs.writeFileSync(outPath, png);
  console.log('Replaced: ' + r.file + ' (' + r.w + 'x' + r.h + ')');
}
console.log('Done. Spider images replaced with placeholder.');
