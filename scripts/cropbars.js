/* ============================================================
 * cropbars.js — 自动裁掉场景图四边烤死的"影院黑边"（无依赖，纯 Node zlib）
 *
 * 原理：从四边向内扫描，整行/整列亮度接近纯黑视为黑边；
 *       再向内吃掉少量渐变过渡像素；安全阈值防止误裁夜景。
 *
 * 用法：node scripts/cropbars.js <png...>          就地裁切
 *       node scripts/cropbars.js --scenes          处理 assets 下全部场景图
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SCENES = ["yaolu", "houshan", "town", "wuting", "qingniu", "road", "shanmen", "miju"];

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
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    for (let x = 0; x < stride; x++) {
      const rawv = raw[p++];
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = (x >= ch && y > 0) ? out[(y - 1) * stride + x - ch] : 0;
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
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i*3] = out[i*ch]; rgb[i*3+1] = out[i*ch+1]; rgb[i*3+2] = out[i*ch+2];
  }
  return { w, h, rgb };
}

function writePNG_RGB(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const mk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const tb = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])) >>> 0, 0);
    return Buffer.concat([len, tb, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    mk("IHDR", ihdr), mk("IDAT", idat), mk("IEND", Buffer.alloc(0)),
  ]);
}

let CRC_T = null;
function crc32(buf) {
  if (!CRC_T) { CRC_T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); CRC_T[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function rowStat(img, y) {
  const { w, rgb } = img;
  let sum = 0, max = 0;
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    const lum = (rgb[i] * 2 + rgb[i+1] * 3 + rgb[i+2]) / 6;
    sum += lum; if (lum > max) max = lum;
  }
  return { mean: sum / w, max };
}
function colStat(img, x) {
  const { w, h, rgb } = img;
  let sum = 0, max = 0;
  for (let y = 0; y < h; y++) {
    const i = (y * w + x) * 3;
    const lum = (rgb[i] * 2 + rgb[i+1] * 3 + rgb[i+2]) / 6;
    sum += lum; if (lum > max) max = lum;
  }
  return { mean: sum / h, max };
}

// 严格黑边：均值<10 且最亮像素<40（防止把夜景当黑边）
const isBar = (st) => st.mean < 10 && st.max < 40;
// 渐变过渡：均值<26
const isFade = (st) => st.mean < 26;

function detect(img) {
  const { w, h } = img;
  let top = 0, bottom = 0, left = 0, right = 0;
  while (top < h * 0.4 && isBar(rowStat(img, top))) top++;
  while (bottom < h * 0.4 && isBar(rowStat(img, h - 1 - bottom))) bottom++;
  while (left < w * 0.4 && isBar(colStat(img, left))) left++;
  while (right < w * 0.4 && isBar(colStat(img, w - 1 - right))) right++;
  // 只有真的存在黑边(≥8px)才追加吃掉渐变过渡（最多再6px）
  const eat = (n, statFn, fromEnd, limit) => {
    if (n < 8) return 0;
    let extra = 0;
    while (extra < 6 && n + extra < limit && isFade(statFn(fromEnd ? limit - 1 - (n + extra) : n + extra))) extra++;
    return n + extra;
  };
  top = eat(top, (y) => rowStat(img, y), false, h);
  bottom = eat(bottom, (y) => rowStat(img, y), true, h);
  left = eat(left, (x) => colStat(img, x), false, w);
  right = eat(right, (x) => colStat(img, x), true, w);
  return { top, bottom, left, right };
}

function crop(img, c) {
  const nw = img.w - c.left - c.right;
  const nh = img.h - c.top - c.bottom;
  const out = Buffer.alloc(nw * nh * 3);
  for (let y = 0; y < nh; y++) {
    const src = ((y + c.top) * img.w + c.left) * 3;
    img.rgb.copy(out, y * nw * 3, src, src + nw * 3);
  }
  return { w: nw, h: nh, rgb: out };
}

function processFile(fp) {
  const img = readPNG(fs.readFileSync(fp));
  const c = detect(img);
  const total = c.top + c.bottom + c.left + c.right;
  if (total < 8) { console.log(`${path.basename(fp)}  无黑边，跳过`); return; }
  const nh = img.h - c.top - c.bottom, nw = img.w - c.left - c.right;
  if (nh < img.h * 0.5 || nw < img.w * 0.5) { console.log(`${path.basename(fp)}  检测异常(裁剩过小)，跳过`); return; }
  const out = crop(img, c);
  fs.writeFileSync(fp, writePNG_RGB(out.w, out.h, out.rgb));
  console.log(`${path.basename(fp)}  裁切 上${c.top} 下${c.bottom} 左${c.left} 右${c.right} → ${out.w}x${out.h}`);
}

const args = process.argv.slice(2);
if (!args.length) { console.error("用法: node scripts/cropbars.js <png...> | --scenes"); process.exit(1); }
const files = args[0] === "--scenes"
  ? SCENES.map((id) => path.join(__dirname, "..", "assets", id + ".png")).filter((f) => fs.existsSync(f))
  : args;
for (const f of files) {
  try { processFile(f); } catch (e) { console.log(`${path.basename(f)}  失败: ${e.message}`); }
}
