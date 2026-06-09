/* ============================================================
 * cutout.js — 把"纯白背景"的立绘抠成真透明 PNG（无依赖，纯 Node zlib）
 *
 * 原理：从图像四边做洪水填充(flood fill)，把与边缘连通的接近白色的像素
 *       置为透明——只删背景，人物内部的白色(高光/衣物)不受影响。边缘做羽化。
 *
 * 用法：node scripts/cutout.js <输入png> <输出png> [容差0-100]
 * ============================================================ */
const fs = require("fs");
const zlib = require("zlib");

function readPNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("非 PNG");
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error("仅支持8位RGB/RGBA, got bd=" + bitDepth + " ct=" + colorType);
  const ch = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  // 反滤波
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    for (let x = 0; x < stride; x++) {
      const rawv = raw[p++];
      const a = x >= ch ? out[y * stride + x - ch] : 0;       // left
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;         // up
      const c = (x >= ch && y > 0) ? out[(y - 1) * stride + x - ch] : 0; // up-left
      let v;
      switch (ft) {
        case 0: v = rawv; break;
        case 1: v = rawv + a; break;
        case 2: v = rawv + b; break;
        case 3: v = rawv + ((a + b) >> 1); break;
        case 4: { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
                  const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); v = rawv + pr; break; }
        default: v = rawv;
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  // 转成 RGBA
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i*4] = out[i*ch]; rgba[i*4+1] = out[i*ch+1]; rgba[i*4+2] = out[i*ch+2];
    rgba[i*4+3] = ch === 4 ? out[i*ch+3] : 255;
  }
  return { w, h, rgba };
}

function writePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunks = [];
  const mk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const tb = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])) >>> 0, 0);
    return Buffer.concat([len, tb, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  chunks.push(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  chunks.push(mk("IHDR", ihdr));
  chunks.push(mk("IDAT", idat));
  chunks.push(mk("IEND", Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

let CRC_T = null;
function crc32(buf) {
  if (!CRC_T) { CRC_T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); CRC_T[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 边缘洪水填充抠背景
function cutout(img, tol) {
  const { w, h, rgba } = img;
  const t = (tol != null ? tol : 16) * 2.55 * 3; // 容差(RGB距离和)
  const isBgLike = (i) => (255 - rgba[i*4]) + (255 - rgba[i*4+1]) + (255 - rgba[i*4+2]) < t; // 接近白
  const mask = new Uint8Array(w * h);   // 1=背景
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
  while (stack.length) {
    const idx = stack.pop();
    if (mask[idx]) continue;
    if (!isBgLike(idx)) continue;
    mask[idx] = 1;
    const x = idx % w, y = (idx / w) | 0;
    if (x > 0) stack.push(idx - 1);
    if (x < w - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - w);
    if (y < h - 1) stack.push(idx + w);
  }
  // 置透明 + 边缘羽化（背景相邻一圈给半透明，去硬边/白边）
  let cleared = 0;
  for (let i = 0; i < w * h; i++) {
    if (mask[i]) { rgba[i*4+3] = 0; cleared++; }
  }
  // 羽化：人物边缘像素若紧邻背景，降一点 alpha 并去白边
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (mask[i] || rgba[i*4+3] === 0) continue;
    let nbBg = 0;
    if (x > 0 && mask[i-1]) nbBg++;
    if (x < w-1 && mask[i+1]) nbBg++;
    if (y > 0 && mask[i-w]) nbBg++;
    if (y < h-1 && mask[i+w]) nbBg++;
    if (nbBg) rgba[i*4+3] = 170;   // 半透明软边
  }
  return cleared / (w * h);
}

const [,, inp, outp, tolStr] = process.argv;
if (!inp || !outp) { console.error("用法: node scripts/cutout.js <in.png> <out.png> [tol]"); process.exit(1); }
const img = readPNG(fs.readFileSync(inp));
const ratio = cutout(img, tolStr ? parseInt(tolStr, 10) : 16);
fs.writeFileSync(outp, writePNG(img.w, img.h, img.rgba));
console.log(`抠图完成 ${outp}  透明像素占比 ${(ratio*100).toFixed(1)}%  (${img.w}x${img.h})`);
