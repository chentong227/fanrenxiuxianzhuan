/* ============================================================
 * trimfeet.js — 裁掉战斗立绘底部的透明留白（贴地校正）
 *
 * 抠图后的 battler 底部常留若干全透明行，导致单位"爪子悬空"踩不实地。
 * 本脚本扫描底部连续全透明行并裁除（顶部/左右不动），原地覆写。
 * 用法：node scripts/trimfeet.js            # 处理 assets/battlers/*.png
 *       node scripts/trimfeet.js bt_wolf    # 只处理指定 id
 * ============================================================ */
const fs = require("fs");
const path = require("path");

// 复用 cutout.js 的无依赖 PNG 编解码
const src = fs.readFileSync(path.join(__dirname, "cutout.js"), "utf8");
const body = src.slice(0, src.indexOf("const args = process.argv"));
const fn = new Function("require", "Buffer", "Math", body + "\nreturn {readPNG, writePNG};");
const { readPNG, writePNG } = fn(require, Buffer, Math);

const dir = path.join(__dirname, "..", "assets", "battlers");
const only = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f => f.endsWith(".png"))
  .filter(f => !only.length || only.includes(f.replace(".png", "")));

const ALPHA_EPS = 8;     // 近全透明视作空行
const KEEP = 2;          // 底部保留 2px 余量（防裁到脚尖反走样）

files.forEach(f => {
  const p = path.join(dir, f);
  let img;
  try { img = readPNG(fs.readFileSync(p)); }
  catch (e) { console.log(`${f}  跳过（${e.message}）`); return; }
  const { w, h, rgba } = img;
  let emptyRows = 0;
  for (let y = h - 1; y >= 0; y--) {
    let rowEmpty = true;
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > ALPHA_EPS) { rowEmpty = false; break; }
    }
    if (!rowEmpty) break;
    emptyRows++;
  }
  const cut = Math.max(0, emptyRows - KEEP);
  if (cut <= 0) { console.log(`${f}  底部无留白，跳过`); return; }
  const nh = h - cut;
  const out = Buffer.alloc(w * nh * 4);
  rgba.copy(out, 0, 0, w * nh * 4);
  fs.writeFileSync(p, writePNG(w, nh, out));
  console.log(`${f}  裁底 ${cut}px（${h}→${nh}）`);
});
console.log("trimfeet 完成。");
