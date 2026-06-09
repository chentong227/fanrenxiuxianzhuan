/* ============================================================
 * genportraits.js — 生成白底立绘并抠成透明 PNG，落地 assets/<id>.png
 * 用法：node scripts/genportraits.js <KEY> [id1 id2 ...]   不带 id 则全部人物
 * ============================================================ */
const { execFileSync } = require("child_process");
const path = require("path");

const KEY = process.argv[2];
if (!KEY) { console.error("用法: node scripts/genportraits.js <KEY> [ids...]"); process.exit(1); }
const only = process.argv.slice(3);

const PORTRAITS = ["hanli","modafu","lifeiyu","zhangtie","xiaosuanpan","jiatianlong","jinguang","nongfu","sanxiu","langzhong","biaoshi","langhao"];
const ids = only.length ? only : PORTRAITS;
const root = path.join(__dirname, "..");
const tmp = path.join(root, "test", "_p_raw.png");

for (const id of ids) {
  process.stdout.write(`生成 ${id} ... `);
  try {
    // 1) 生成白底图（genart 直接写 assets/<id>.png）
    execFileSync("node", [path.join(__dirname, "genart.js"), KEY, id], { stdio: "ignore" });
    const asset = path.join(root, "assets", id + ".png");
    require("fs").copyFileSync(asset, tmp);
    // 2) 抠图，覆盖回 assets/<id>.png
    execFileSync("node", [path.join(__dirname, "cutout.js"), tmp, asset, "18"], { stdio: "ignore" });
    console.log("✓ 已抠图");
  } catch (e) { console.log("✗", e.message); }
}
try { require("fs").unlinkSync(tmp); } catch (e) {}
console.log("完成。");
