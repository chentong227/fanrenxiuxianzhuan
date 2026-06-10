/* 版本号统一提升：node scripts/bump.js <新版本号>
 * 同步更新 index.html 的 ?v=、meta build、build vN 标识与 ver.txt（自动更新检测源）。 */
const fs = require("fs");
const path = require("path");
const ver = process.argv[2];
if (!ver || !/^\d+$/.test(ver)) { console.error("用法: node scripts/bump.js <数字版本号>"); process.exit(1); }
const idx = path.join(__dirname, "..", "index.html");
let h = fs.readFileSync(idx, "utf8");
const cur = (h.match(/meta name="build" content="(\d+)"/) || [])[1];
if (!cur) { console.error("找不到 meta build"); process.exit(1); }
h = h.split("?v=" + cur).join("?v=" + ver);
h = h.replace(`meta name="build" content="${cur}"`, `meta name="build" content="${ver}"`);
h = h.replace("build v" + cur, "build v" + ver);
fs.writeFileSync(idx, h);
fs.writeFileSync(path.join(__dirname, "..", "ver.txt"), ver);
console.log(`版本 ${cur} → ${ver}（index.html + ver.txt 已同步）`);
