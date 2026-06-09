/* ============================================================
 * genart.js — 一次性生成第一章固定配图，存进仓库 assets/
 *
 * 用法（key 不写进代码，命令行临时传入；走代理）：
 *   $env:HTTPS_PROXY=""; node scripts/genart.js <OPENROUTER_KEY> [onlyId]
 *
 * 说明：
 *  - 通过 OpenRouter 的 gemini-2.5-flash-image 出图（国风水墨淡彩）。
 *  - 生成的 PNG 落地到 assets/<id>.png，提交进仓库（一劳永逸，玩家无需联网/不耗 key）。
 *  - 新人物/新场景的"实时生成 + localStorage 缓存"在 js/art.js，本脚本只管固定图。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const KEY = process.argv[2];
const ONLY = process.argv[3];
if (!KEY) { console.error("用法: node scripts/genart.js <OPENROUTER_KEY> [onlyId]"); process.exit(1); }

const MODEL = "google/gemini-2.5-flash-image";
const PROXY = process.env.GEN_PROXY || "http://127.0.0.1:7890";
const OUT = path.join(__dirname, "..", "assets");
const TMP = path.join(__dirname, "..", "test");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// 统一画风前缀：忠于《凡人修仙传》动漫——国风水墨淡彩、写意仙侠、含蓄克制
const STYLE_PORTRAIT = "中国风水墨淡彩人物立绘，写意仙侠动画风格，半身像，柔和留白背景，工笔淡彩，气质含蓄克制，竖构图，无文字无水印";
const STYLE_SCENE = "中国风水墨淡彩场景插画，写意仙侠动画风格，意境悠远，淡雅设色，横构图，无人物特写无文字无水印";

const DEFS = {
  // —— 人物立绘 ——
  hanli:    { kind: "portrait", prompt: "一位清瘦沉静的少年修士，约十四岁，青灰布道袍，眉目平凡而眼神坚毅内敛，神情不动声色" },
  modafu:   { kind: "portrait", prompt: "一位衰朽阴郁的老大夫，灰白须发，浑浊眼底偶现精光，深色旧袍，背后隐约药柜药香，气息神秘莫测" },
  lifeiyu:  { kind: "portrait", prompt: "一位爽朗英气的少年武者，约十五岁，劲装束袖，体格健朗，眉宇间一股豪爽不羁之气，似在大笑" },
  zhangtie: { kind: "portrait", prompt: "一位憨厚壮实的少年，粗布短打，体格结实，面相老实仗义，带着乡间少年的朴拙" },
  // —— 场景 ——
  yaolu:    { kind: "scene", prompt: "一间古朴清幽的中药药庐，木质药柜林立，铜药碾与丹炉，窗外竹影，药香氤氲" },
  houshan:  { kind: "scene", prompt: "云雾缭绕的仙门后山，奇峰幽谷，灵草丛生，古木森森，深处隐有凶险气息" },
  town:     { kind: "scene", prompt: "山脚下的凡俗古镇，青瓦土墙，市井街巷，行人商贩，远处仙山隐现" },
  wuting:   { kind: "scene", prompt: "仙门演武厅，宽阔的木地演武场，兵器架列于两侧，庄严肃穆" },
};

function genOne(id, def) {
  const style = def.kind === "portrait" ? STYLE_PORTRAIT : STYLE_SCENE;
  const body = JSON.stringify({
    model: MODEL,
    modalities: ["image", "text"],
    messages: [{ role: "user", content: `${style}。画面内容：${def.prompt}。` }],
  });
  const bodyFile = path.join(TMP, "_genart.body.json");
  const respFile = path.join(TMP, "_genart.resp.json");
  fs.writeFileSync(bodyFile, body);
  // 用 curl.exe 走代理（本机已验证可直出图）
  execFileSync("curl.exe", [
    "-s", "-x", PROXY, "-X", "POST", "https://openrouter.ai/api/v1/chat/completions",
    "-H", "Authorization: Bearer " + KEY,
    "-H", "Content-Type: application/json",
    "-H", "X-Title: FanrenXiuxian",
    "--data", "@" + bodyFile,
    "-o", respFile,
  ], { stdio: "ignore" });
  const j = JSON.parse(fs.readFileSync(respFile, "utf8"));
  if (j.error) throw new Error(JSON.stringify(j.error));
  const m = j.choices && j.choices[0] && j.choices[0].message;
  const url = m && m.images && m.images[0] && m.images[0].image_url && m.images[0].image_url.url;
  if (!url) throw new Error("无图片返回: " + JSON.stringify(j).slice(0, 200));
  const b64 = url.split(",")[1];
  fs.writeFileSync(path.join(OUT, id + ".png"), Buffer.from(b64, "base64"));
  try { fs.unlinkSync(bodyFile); fs.unlinkSync(respFile); } catch (e) {}
}

(async () => {
  const ids = ONLY ? [ONLY] : Object.keys(DEFS);
  for (const id of ids) {
    if (!DEFS[id]) { console.log("跳过未知 id:", id); continue; }
    process.stdout.write(`生成 ${id} ... `);
    try { genOne(id, DEFS[id]); console.log("✓"); }
    catch (e) { console.log("✗", e.message); }
  }
  console.log("完成。");
})();
