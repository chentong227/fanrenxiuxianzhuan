/* ============================================================
 * 美术资产批量压缩：node scripts/compressart.js [--dry]
 * 2026-07-12 立（用户镜像实测"背景图只加载一部分"——2Mbps 网络拉 2.7MB 场景图要十几秒）。
 * 方案：PNG 调色板量化（sharp palette quality85 + dither0.9）——实测雾山渐变/立绘透明边/
 * 地图纸纹均无肉眼损失，体积降到原 18~39%。只在压后更小时才替换（幂等，二压无害）。
 * ⚠ 惯例：genart 生图落库后跑一遍本脚本再提交；跑完记得 bump js/art.js 的 ASSET_VER
 *（URL ?v= 变了客户端才会拉新图——sw.js 资产持久仓靠它隔离版本）。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const dry = process.argv.includes("--dry");
const dirs = ["assets"];

async function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.isFile() && /\.png$/i.test(e.name)) out.push(p);
  }
  return out;
}

(async () => {
  let files = [];
  for (const d of dirs) files.push(...await walk(path.join(root, d)));
  let saved = 0, done = 0, skipped = 0, failed = 0;
  const t0 = Date.now();
  for (const f of files) {
    const before = fs.statSync(f).size;
    if (before < 60 * 1024) { skipped++; continue; }   // 小图不折腾
    const tmp = f + ".cmp.tmp";
    try {
      await sharp(f).png({ palette: true, quality: 85, dither: 0.9, compressionLevel: 9 }).toFile(tmp);
      const after = fs.statSync(tmp).size;
      if (after < before * 0.92) {   // 至少省 8% 才替换（已压过的文件二跑自动跳过）
        if (!dry) fs.renameSync(tmp, f);
        else fs.unlinkSync(tmp);
        saved += before - after; done++;
      } else { fs.unlinkSync(tmp); skipped++; }
    } catch (e) { try { fs.unlinkSync(tmp); } catch (_) {} failed++; console.error("  ✗", path.relative(root, f), e.message); }
  }
  console.log(`[compressart] ${dry ? "(dry) " : ""}压缩 ${done} 张 / 跳过 ${skipped} / 失败 ${failed}，共省 ${(saved / 1048576).toFixed(0)} MB（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
  if (!dry && done) console.log("⚠ 记得 bump js/art.js 的 ASSET_VER，并跑 node scripts/mirror.js 同步镜像");
})();
