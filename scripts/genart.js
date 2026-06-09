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

// 统一画风：忠于《凡人修仙传》动画剧版——3D 渲染电影质感、写实国风仙侠、
// 柔和暖调布光、半身像、神情含蓄克制。所有人物共享同一画风，保证整体协调、特征鲜明。
const STYLE_PORTRAIT = "《凡人修仙传》动画剧版同款画风，3D渲染电影级质感，写实国风仙侠人物半身像，精细面部与发丝，柔和暖调布光，景深虚化背景，气质沉静克制，竖构图，单人，无文字无水印无logo";
const STYLE_SCENE = "《凡人修仙传》动画剧版同款画风，3D渲染电影级场景，写实国风仙侠，光影氛围考究，意境悠远，横构图，无人物特写无文字无水印";

const DEFS = {
  // —— 人物立绘（剧版特征锚定，确保识别度）——
  hanli:    { kind: "portrait", prompt: "少年韩立，约十五岁，乌黑长发束成半扎发髻、余发垂肩，眉目清秀沉静，眼神坚毅内敛，身着橄榄黄绿色交领道袍、肩部有菱格暗纹，神情不动声色" },
  modafu:   { kind: "portrait", prompt: "墨大夫，一位清癯矍铄的银发老者，银白长发整齐梳向脑后，蓄花白山羊胡，面容清隽、神色沉静内敛，身着深褐色带金线团纹的医者长袍，手腕戴佛珠，气度不凡而暗藏深意" },
  lifeiyu:  { kind: "portrait", prompt: "少年厉飞雨，约十六岁，乌黑长发高束成顶髻、余发垂落肩背，剑眉星目、面容俊朗，神情沉静自信，身着青灰色交领道袍，身姿挺拔" },
  zhangtie: { kind: "portrait", prompt: "少年张铁，约十六岁，乌黑短发利落，浓眉、面容端正清朗，左脸颊有一道浅疤，神情憨厚温和、老实仗义，身着朴素的灰色粗布短打，体格结实" },
  // —— 场景 ——
  yaolu:    { kind: "scene", prompt: "古朴清幽的中药药庐内景，木质药柜林立、抽屉密布，铜药碾与丹炉，窗棂透入暖光，药香氤氲" },
  houshan:  { kind: "scene", prompt: "云雾缭绕的仙门后山，奇峰幽谷，灵草丛生，古木森森，溪涧幽深，深处隐有凶险气息" },
  town:     { kind: "scene", prompt: "山脚下的凡俗古镇街景，青瓦土墙，市井街巷，行人商贩，远处仙山隐现于云雾" },
  wuting:   { kind: "scene", prompt: "仙门演武厅内景，宽阔的木地演武场，两侧兵器架林立，梁柱庄严肃穆，天光斜入" },
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
