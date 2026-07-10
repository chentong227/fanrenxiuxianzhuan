/* 演出名称白名单校验：story.js 里 shot/amb/bgm/sfx 用了不存在的名字=写了等于没写（静默漏音/漏镜头）。
 * v314 立（历史伤：amb:"crowd"×3、sfx:"cast"×5、sfx:"splash"×4 静默了数版）。
 * 跑：node test/_staging_names_check.js —— 改 story.js 演出原语后必跑。 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../js/story.js"), "utf8");
const audio = fs.readFileSync(path.join(__dirname, "../js/audio.js"), "utf8");
const SHOTS = ["pushIn", "pullOut", "panLeft", "panRight", "tiltUp", "tiltDown", "trackLeft", "trackRight", "establish", "shock", "focusLeft", "focusRight", "reset"];
const AMBS = ["night", "firefly", "candle", "wind", "rain", "market"];
const BGMS = ["daily", "town", "journey", "fair", "combat", "combat_wild", "combat_secret", "boss", "tense", "sorrow", "triumph"];
const bad = [];
for (const m of src.matchAll(/\{\s*shot:\s*"(\w+)"/g)) if (!SHOTS.includes(m[1])) bad.push("shot:" + m[1]);
for (const m of src.matchAll(/\{\s*amb:\s*"(\w+)"/g)) if (!AMBS.includes(m[1])) bad.push("amb:" + m[1]);
for (const m of src.matchAll(/\{\s*bgm:\s*"(\w+)"/g)) if (!BGMS.includes(m[1])) bad.push("bgm(text):" + m[1]);
for (const m of src.matchAll(/^\s*bgm:\s*"(\w+)",/gm)) if (!BGMS.includes(m[1])) bad.push("bgm(node):" + m[1]);
for (const m of src.matchAll(/\{\s*sfx:\s*"(\w+)"/g)) {
  const name = m[1];
  // sfx 合法性：audio.js RECIPES 里存在同名配方函数（`name(c)` 定义）
  if (!new RegExp("\\b" + name + "\\(c\\)", "m").test(audio)) bad.push("sfx:" + name);
}
if (bad.length) { console.log("BAD: " + [...new Set(bad)].join(", ")); process.exit(1); }
console.log("ALL STAGING NAMES OK");
