/* 一次性：生成一张空白 9:16 竖版画布 _refs/canvas_916.png，
 * 作为 genart 出竖版 CG 时的「画幅比例参考图」（nano-banana 输出比例贴合参考图）。 */
const fs = require("fs"), zlib = require("zlib"), path = require("path");
const W = 720, H = 1280;   // 9:16
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
const row = Buffer.alloc(1 + W * 3);
for (let x = 0; x < W; x++) { row[1 + x * 3] = 40; row[1 + x * 3 + 1] = 40; row[1 + x * 3 + 2] = 46; }
const raw = Buffer.concat(Array.from({ length: H }, () => row));
const idat = zlib.deflateSync(raw);
const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
const out = path.join(__dirname, "..", "_refs", "canvas_916.png");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log("canvas", W + "x" + H, "->", out, png.length, "bytes");
