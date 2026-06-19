/* ============================================================
 * genambient.js — 用 OpenRouter Lyria 3 Clip 生成环境床（30s 无缝循环）
 *
 * 用法：node scripts/genambient.js <OPENROUTER_KEY> [onlyId]
 * 输出：assets/audio/amb_<id>.mp3（引擎按 .mp3 文件优先，缺失则程序合成兜底）
 *
 * 环境床 = "景"不是"曲"：夜虫/萤火/烛火/夜风/檐雨/市集远喧，
 * 无明显旋律无节拍、极简留白、垫底环境声，演出/夜景里它领奏、BGM 自动退位。
 * 与 genmusic.js 同构（同模型/同 SSE 解析/同代理约定）。
 *
 * ⚠ 实测结论（R2，2026-06）：google/lyria-3-clip 本质是生乐模型，即便下方提示词写满
 *   no melody/no beat/field-recording 的硬否定，产出仍残留低频旋律线 + 规律节拍（频谱图
 *   见 docs/audio-design.md §七）。因此引擎当前不采用本脚本产物——audio.js 的 AMB_FILES
 *   置空、环境床全部走程序合成（纯噪声床+短噪事件，结构上无旋律无节拍）。
 *   本脚本保留备用：若日后接入真正的环境音/SFX 模型，改 MODEL 重生即可恢复"文件优先"。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const KEY = process.argv[2] || process.env.OPENROUTER_KEY;
const ONLY = process.argv[3];
if (!KEY) { console.error("用法: node scripts/genambient.js <OPENROUTER_KEY|env OPENROUTER_KEY> [onlyId]"); process.exit(1); }

const MODEL = "google/lyria-3-clip-preview";
// 跨平台 curl：Windows 用 curl.exe，Linux/macOS（云机）用 curl
const CURL = process.platform === "win32" ? "curl.exe" : "curl";
// 代理：默认走本机 clash(7890)；无代理环境（CI/云机）显式传 GEN_PROXY="" 或 GEN_PROXY=none 直连
const PROXY = (process.env.GEN_PROXY != null) ? process.env.GEN_PROXY : "http://127.0.0.1:7890";
const USE_PROXY = PROXY && PROXY !== "none";
const OUT = path.join(__dirname, "..", "assets", "audio");
const TMP = path.join(__dirname, "..", "test");
// 候选产出：OUT_SUBDIR=_cand 落候选目录，CAND_SUFFIX=_c1 给文件名加后缀（择优前不覆盖正轨）
const OUT_SUBDIR = process.env.OUT_SUBDIR || "";
const SUFFIX = process.env.CAND_SUFFIX || "";
const OUTDIR = OUT_SUBDIR ? path.join(OUT, OUT_SUBDIR) : OUT;
if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });

// 硬否定（英文更易被模型当约束吃进去）：禁一切音乐性要素，只要纯自然环境声。
const COMMON = "Pure environmental SOUND EFFECT / field recording, absolutely NOT music. "
  + "No melody, no musical notes, no pitched tones, no bassline, no chords, no harmony, "
  + "no rhythm, no beat, no percussion, no drums, no instruments, no synth pads, no drone. "
  + "Just raw natural ambience. Seamless 30-second loop, very quiet, minimal low dynamics, 48kHz. "
  + "环境氛围声景：无旋律、无节拍、无乐器，极简留白只作场景底噪。内容：";

const TRACKS = {
  // 夜虫（夜晚感主床）：韩立入门/深夜剧情
  night:   "夏夜山野旷外的环境声：此起彼伏的夜虫鸣叫（蟋蟀、纺织娘、蝈蝈）层层叠叠为主体，偶有远处一两声蛙鸣，微风拂过草木的细碎沙沙，幽静深远、墨色夜空下的孤寂，纯环境声无任何音乐",
  // 萤火（更空灵的静夜）
  firefly: "盛夏静夜萤火虫飞舞的空灵氛围：极轻柔稀疏的夜虫细鸣垫底，水边偶有零星蛙声与草叶轻响，气息空旷梦幻、仿佛点点流萤在暗夜里明灭，极安静极克制，纯环境声无旋律无节拍",
  // 烛火（室内夺舍/密室夜）
  candle:  "深夜室内烛火摇曳的环境声：烛芯燃烧的细微噼啪声与偶尔的蜡油轻爆为主，室内极度安静，窗外隐约透入几声夜虫，温暖昏黄又孤寂、密室独处的幽闭氛围，纯环境声无任何音乐",
  // 夜风（旷野/山间，留待天气系统）
  wind:    "山间旷野夜风的环境声：持续的风掠过松林与竹叶的低沉呼啸与沙沙，时强时弱、空旷苍茫，纯环境声无旋律无节拍无乐器",
  // 檐雨（雨天，留待天气系统）
  rain:    "古宅屋檐夜雨的环境声：连绵均匀的雨声与檐下滴水点滴，偶有远处一两声闷雷，潮湿幽静，纯环境声无音乐无旋律",
  // 市集远喧（据点演出，留待据点系统）
  market:  "古代集镇市集的远景环境声：模糊的人群攒动喧闹、隐约叫卖吆喝、脚步与器物碰撞混成一片远远的市井烟火气，听不清具体词句，纯环境声无清晰旋律无配乐",
};

function genOne(id, prompt) {
  // Lyria 音频输出要求 stream:true（SSE）——收流后逐行解析 data: 块，拼接音频分片
  const body = JSON.stringify({
    model: MODEL,
    stream: true,
    modalities: ["audio", "text"],
    messages: [{ role: "user", content: `${COMMON}${prompt}` }],
  });
  const bodyFile = path.join(TMP, "_genamb.body.json");
  const respFile = path.join(TMP, "_genamb.sse.txt");
  fs.writeFileSync(bodyFile, body);
  const curlArgs = ["-s", "-N"];
  if (USE_PROXY) curlArgs.push("-x", PROXY);
  curlArgs.push(
    "-X", "POST", "https://openrouter.ai/api/v1/chat/completions",
    "-H", "Authorization: Bearer " + KEY,
    "-H", "Content-Type: application/json",
    "-H", "X-Title: FanrenXiuxian",
    "--data", "@" + bodyFile,
    "-o", respFile,
    "--max-time", "300",
  );
  execFileSync(CURL, curlArgs, { stdio: "ignore" });
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
    fs.writeFileSync(path.join(TMP, "_genamb.debug.txt"), slim || raw.slice(0, 2000));
    throw new Error("SSE 流中未找到音频（样本已存 test/_genamb.debug.txt）");
  }
  const buf = Buffer.concat(parts.map(p => Buffer.from(p, "base64")));
  const mm = mime || "audio/mp3";
  // 引擎按 amb_<id>.mp3 文件优先；Lyria 返回 audio/mpeg→mp3。非 mpeg 则提示（避免误存）。
  if (!/mpeg|mp3/i.test(mm)) console.warn(`  ⚠ 返回 mime=${mm}（非 mp3）；引擎只认 .mp3，请确认`);
  const outFile = path.join(OUTDIR, `amb_${id}${SUFFIX}.mp3`);
  fs.writeFileSync(outFile, buf);
  try { fs.unlinkSync(bodyFile); fs.unlinkSync(respFile); } catch (e) {}
  return outFile;
}

(async () => {
  const ids = ONLY ? ONLY.split(",").map(s => s.trim()).filter(Boolean) : Object.keys(TRACKS);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  for (const id of ids) {
    if (!TRACKS[id]) { console.log(`跳过未知床 ${id}`); continue; }
    process.stdout.write(`生成 amb_${id}${SUFFIX} ... `);
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const f = genOne(id, TRACKS[id]);
        const kb = Math.round(fs.statSync(f).size / 1024);
        console.log(`✓ ${path.basename(f)} (${kb}KB)`);
        ok = true;
      } catch (e) {
        const msg = e.message.slice(0, 200);
        if (attempt < 3 && /429|rate|timeout|limit|503|502/i.test(msg)) {
          const back = attempt * 8;
          process.stdout.write(`(限流重试 ${attempt}/2，等 ${back}s) `);
          await sleep(back * 1000);
        } else {
          console.log("✗ " + msg);
        }
      }
    }
  }
  console.log("完成。");
})();
