/* ============================================================
 * genmusic.js — 用 OpenRouter Lyria 3 Clip 生成游戏 BGM（30s 循环）
 *
 * 用法：node scripts/genmusic.js <OPENROUTER_KEY> [onlyId]
 * 输出：assets/audio/bgm_<id>.<ext>（按返回 mime 定扩展名）
 *
 * 轨道设计参考《凡人修仙传》动画配乐气质：大气国风管弦+古琴笛箫+战鼓急弦。
 * 全部纯器乐（无人声）、可循环（首尾平滑）。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const KEY = process.argv[2];
const ONLY = process.argv[3];
if (!KEY) { console.error("用法: node scripts/genmusic.js <OPENROUTER_KEY> [onlyId]"); process.exit(1); }

const MODEL = "google/lyria-3-clip-preview";
const PROXY = process.env.GEN_PROXY || "http://127.0.0.1:7890";
const OUT = path.join(__dirname, "..", "assets", "audio");
const TMP = path.join(__dirname, "..", "test");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const COMMON = "中国古风纯器乐游戏背景音乐，无人声无歌词，30秒无缝循环（首尾衔接平滑），48kHz高品质";

const TRACKS = {
  // 日常修炼（药庐/洞府岁月）：夜读残卷的孤寂
  daily:   "古琴独奏为主、箫声远远应和，缓慢沉静，孤寂苍凉中带一丝坚韧，深夜药庐独自修行的氛围，极简留白",
  // 市井集镇：人间烟火
  town:    "琵琶与竹笛轻快对答，市井烟火气，热闹而不喧哗，古代集镇街市漫步的轻松氛围，中速",
  // 旅途/舆图：风起天南的苍茫行旅
  journey: "竹笛悠扬主旋律、弦乐群铺底，辽阔苍茫，山河万里的行旅感，大气而略带孤独，史诗国风",
  // 修仙集市（太南小会）：灵动神秘
  fair:    "古筝快速琶音与编钟铃音点缀，灵动神秘，仙气缭绕的隐秘集市，好奇与机缘交织的氛围",
  // 普通战斗（2026-06-12 用户裁决：降调——日常斗法不该轰轰烈烈，激昂只留给妖王与越级）：
  // 中速拉锯、鼓点克制、无铜管唢呐，强调"对峙与试探"，首尾平滑适合长时间循环
  combat:  "中速紧张的对峙氛围，轻快的小鼓点与古筝中速扫弦交替，箫声短句穿插试探感，张弛有度不喧哗，无唢呐无铜管，武者过招的沉着拉锯，循环平滑耐听",
  // 决战/妖王/越级（boss）：压迫史诗——激昂只在这里
  boss:    "重型太鼓与低音弦乐齐鸣，号角长鸣，压迫感极强的史诗决战，生死一线的宏大悲壮，渐进增强",
  // 阴谋/密室/探索深处：悬疑阴冷
  tense:   "低音持续音衬底、古筝泛音稀疏点缀，阴冷悬疑，黑暗中有什么在注视，密室与阴谋的寒意，极慢",
  // 离别/故人之死：哀而不伤
  sorrow:  "二胡独奏如泣如诉、箫声低回，哀而不伤，仙凡离别与故人长逝的怅惘，留白极多，极慢",
  // 突破成功/扬名（短促上扬，可不循环）：钟磬贺礼
  triumph: "古钟一响后管弦上扬，钟磬齐鸣，破关而出的昂扬与开阔，短促有力的凯旋感",
};

function genOne(id, prompt) {
  // Lyria 音频输出要求 stream:true（SSE）——收流后逐行解析 data: 块，拼接音频分片
  const body = JSON.stringify({
    model: MODEL,
    stream: true,
    modalities: ["audio", "text"],
    messages: [{ role: "user", content: `${COMMON}。曲风：${prompt}。` }],
  });
  const bodyFile = path.join(TMP, "_genmusic.body.json");
  const respFile = path.join(TMP, "_genmusic.sse.txt");
  fs.writeFileSync(bodyFile, body);
  execFileSync("curl.exe", [
    "-s", "-N", "-x", PROXY, "-X", "POST", "https://openrouter.ai/api/v1/chat/completions",
    "-H", "Authorization: Bearer " + KEY,
    "-H", "Content-Type: application/json",
    "-H", "X-Title: FanrenXiuxian",
    "--data", "@" + bodyFile,
    "-o", respFile,
    "--max-time", "300",
  ], { stdio: "ignore" });
  const raw = fs.readFileSync(respFile, "utf8");
  if (raw.trim().startsWith("{")) {   // 非流式错误响应
    const j = JSON.parse(raw);
    throw new Error(JSON.stringify(j.error || j).slice(0, 300));
  }

  // 解析 SSE：收集所有音频 base64 片段与 mime
  const parts = [];
  let mime = null;
  const pull = (o) => {
    if (o == null) return;
    if (typeof o === "string") {
      const m = o.match(/^data:(audio\/[a-z0-9.+-]+);base64,(.+)$/i);
      if (m) { mime = mime || m[1]; parts.push(m[2]); }
      return;
    }
    if (typeof o === "object") {
      if (o.audio && typeof o.audio === "object" && (o.audio.data || o.audio.b64)) {
        parts.push(o.audio.data || o.audio.b64);
        if (o.audio.format) mime = mime || ("audio/" + o.audio.format);
        return;
      }
      for (const k of Object.keys(o)) pull(o[k]);
    }
  };
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try { pull(JSON.parse(payload)); } catch (e) {}
  }
  if (!parts.length) {
    const slim = raw.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l =>
      l.length > 200 ? l.slice(0, 200) + "...[" + l.length + "]" : l).slice(0, 12).join("\n");
    fs.writeFileSync(path.join(TMP, "_genmusic.debug.txt"), slim || raw.slice(0, 2000));
    throw new Error("SSE 流中未找到音频（样本已存 test/_genmusic.debug.txt）");
  }
  const buf = Buffer.concat(parts.map(p => Buffer.from(p, "base64")));
  const mm = mime || "audio/mp3";
  const ext = mm.includes("mpeg") || mm.includes("mp3") ? "mp3"
            : mm.includes("wav") ? "wav"
            : mm.includes("ogg") ? "ogg" : "mp3";
  const outFile = path.join(OUT, `bgm_${id}.${ext}`);
  fs.writeFileSync(outFile, buf);
  try { fs.unlinkSync(bodyFile); fs.unlinkSync(respFile); } catch (e) {}
  return outFile;
}

(async () => {
  const ids = ONLY ? [ONLY] : Object.keys(TRACKS);
  for (const id of ids) {
    if (!TRACKS[id]) { console.log(`跳过未知轨 ${id}`); continue; }
    process.stdout.write(`生成 bgm_${id} ... `);
    try {
      const f = genOne(id, TRACKS[id]);
      const kb = Math.round(fs.statSync(f).size / 1024);
      console.log(`✓ ${path.basename(f)} (${kb}KB)`);
    } catch (e) {
      console.log("✗ " + e.message.slice(0, 200));
    }
  }
  console.log("完成。");
})();
