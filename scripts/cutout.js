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

// 边缘洪水填充抠背景 + 去白边（choke 侵蚀 + 双级羽化 + un-matte 白色解算）
// 白光圈成因：生图时人物边缘像素=前景色×α+白×(1-α) 的抗锯齿混色，
// 只置 alpha 不动 RGB → 暗背景上叠出一圈泛白。三连治法：
//   1) choke：背景吞掉贴边最脏的 N 圈像素（默认1）
//   2) 双级羽化：边缘 2px 渐变 alpha（110/200），软而不糊
//   3) un-matte：按合成公式反解前景原色 c' = (c - 255·(1-a)) / a —— 数学上把白拆走
function cutout(img, tol, choke) {
  const { w, h, rgba } = img;
  const t = (tol != null ? tol : 16) * 2.55 * 3; // 容差(RGB距离和)
  // 背景基准色：四角 8x8 区块采样中位——白底/深灰底/任意纯色底通吃
  // （白衣角色用深灰底生成就不会被键控吃掉——bt_nangongwan 事故的根治）
  const samples = [[0, 0], [w - 8, 0], [0, h - 8], [w - 8, h - 8]].flatMap(([sx, sy]) => {
    const px = [];
    for (let y = sy; y < sy + 8 && y < h; y++) for (let x = sx; x < sx + 8 && x < w; x++) {
      const i = y * w + x;
      px.push([rgba[i*4], rgba[i*4+1], rgba[i*4+2]]);
    }
    return px;
  });
  const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[(s.length / 2) | 0]; };
  const BG = [med(samples.map(p => p[0])), med(samples.map(p => p[1])), med(samples.map(p => p[2]))];
  const isBgLike = (i) =>
    Math.abs(rgba[i*4] - BG[0]) + Math.abs(rgba[i*4+1] - BG[1]) + Math.abs(rgba[i*4+2] - BG[2]) < t;
  const mask = new Uint8Array(w * h);   // 1=背景
  // 中央保护区（--guard）：白衣角色的白与白底连通时，洪泛会漫进人物——
  // 立绘构图人物必居中，画面中央椭圆区域禁止判作背景（只挡洪泛，不挡边缘羽化）
  const guard = new Uint8Array(w * h);
  if (GUARD) {
    const cx = w / 2, cy = h * 0.52, rx = w * 0.30, ry = h * 0.44;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) guard[y * w + x] = 1;
    }
  }
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
  while (stack.length) {
    const idx = stack.pop();
    if (mask[idx]) continue;
    if (guard[idx]) continue;
    if (!isBgLike(idx)) continue;
    mask[idx] = 1;
    const x = idx % w, y = (idx / w) | 0;
    if (x > 0) stack.push(idx - 1);
    if (x < w - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - w);
    if (y < h - 1) stack.push(idx + w);
  }
  // —— choke：背景膨胀 N 圈，吞掉污染最重的贴边像素 ——
  const rounds = choke != null ? choke : 1;
  for (let r = 0; r < rounds; r++) {
    const grow = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) continue;
      if ((x > 0 && mask[i-1]) || (x < w-1 && mask[i+1]) || (y > 0 && mask[i-w]) || (y < h-1 && mask[i+w])) grow.push(i);
    }
    for (const i of grow) mask[i] = 1;
  }
  // 置透明
  let cleared = 0;
  for (let i = 0; i < w * h; i++) {
    if (mask[i]) { rgba[i*4+3] = 0; cleared++; }
  }
  // —— 双级羽化：距背景 1px=110、2px=200 ——
  const edge1 = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (mask[i]) continue;
    if ((x > 0 && mask[i-1]) || (x < w-1 && mask[i+1]) || (y > 0 && mask[i-w]) || (y < h-1 && mask[i+w])) edge1.push(i);
  }
  const e1set = new Uint8Array(w * h);
  for (const i of edge1) e1set[i] = 1;
  const edge2 = [];
  for (const i of edge1) {
    const x = i % w, y = (i / w) | 0;
    [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx,ny]) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const ni = ny * w + nx;
      if (!mask[ni] && !e1set[ni]) edge2.push(ni);
    });
  }
  for (const i of edge1) rgba[i*4+3] = Math.min(rgba[i*4+3], 110);
  for (const i of edge2) rgba[i*4+3] = Math.min(rgba[i*4+3], 200);
  // —— un-matte：对羽化带按背景色合成公式反解前景原色（把底色拆走）——
  const unmatte = (i) => {
    const a = rgba[i*4+3] / 255;
    if (a <= 0.02 || a >= 0.99) return;
    for (let c = 0; c < 3; c++) {
      const v = rgba[i*4+c];
      rgba[i*4+c] = Math.max(0, Math.min(255, Math.round((v - BG[c] * (1 - a)) / a)));
    }
  };
  for (const i of edge1) unmatte(i);
  for (const i of edge2) unmatte(i);
  return cleared / (w * h);
}

const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const flags = process.argv.slice(2).filter(a => a.startsWith("--"));
const [inp, outp, tolStr] = args;
const chokeFlag = flags.find(f => f.startsWith("--choke="));
const choke = chokeFlag ? parseInt(chokeFlag.split("=")[1], 10) : 1;
const GUARD = flags.includes("--guard");
if (!inp || !outp) { console.error("用法: node scripts/cutout.js <in.png> <out.png> [tol] [--choke=N]"); process.exit(1); }
const img = readPNG(fs.readFileSync(inp));
const ratio = cutout(img, tolStr ? parseInt(tolStr, 10) : 16, choke);
fs.writeFileSync(outp, writePNG(img.w, img.h, img.rgba));
console.log(`抠图完成 ${outp}  透明像素占比 ${(ratio*100).toFixed(1)}%  (${img.w}x${img.h}, choke=${choke})`);
