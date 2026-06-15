/* ============================================================
 * genmusic.js — 用 OpenRouter Lyria 3 Clip 生成游戏 BGM（原创国风器乐）
 *
 * 用法：
 *   生成（需 KEY）：node scripts/genmusic.js <OPENROUTER_KEY> [--only daily,combat] [--n 3] [--force]
 *   仅质量门（免 KEY）：node scripts/genmusic.js --gate [--only daily]
 *   转正某候选（免 KEY）：node scripts/genmusic.js --promote <id> <k>   （归一化响度后落 assets/audio/bgm_<id>.mp3）
 *   就地重制响度（免 KEY）：node scripts/genmusic.js --remaster [--only ids]   （现有轨归一到 -20 LUFS/不削波，治「吵闹」；原始备份到 _cand/_orig/）
 *
 * 选项：
 *   --only ids    只处理这些轨（逗号分隔）；亦兼容旧式：第二个裸参数当单轨 id
 *   --n N         每轨生成 N 个候选（默认 3），落 assets/audio/_cand/bgm_<id>_c<k>.<ext>
 *   --force       重跑已存在的候选（默认断点续跑：已有候选跳过）
 *   --target-lufs X  响度归一目标（默认 -20 LUFS）
 *   --proxy URL   走代理（默认直连；亦可用环境变量 GEN_PROXY）
 *
 * 红线：原创器乐，气质参考国风仙侠（管弦/古琴/笛箫/战鼓），不复用任何既有曲目/OST，
 *       prompt 只描述乐器·调式·情绪·律动，不点名任何作品或曲名。
 * 验收：客观质量门（时长/响度/真峰/循环接缝）只作参考，最终以「用户耳朵点头」为准。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

// ---------- 参数解析 ----------
const argv = process.argv.slice(2);
const opts = { n: 3, force: false, gate: false, promote: null, remaster: false, only: null, targetLufs: -20, proxy: process.env.GEN_PROXY || "" };
let KEY = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--gate") opts.gate = true;
  else if (a === "--remaster") opts.remaster = true;
  else if (a === "--force") opts.force = true;
  else if (a === "--n") opts.n = Math.max(1, parseInt(argv[++i], 10) || 3);
  else if (a === "--only") opts.only = (argv[++i] || "").split(",").map(s => s.trim()).filter(Boolean);
  else if (a === "--target-lufs") opts.targetLufs = parseFloat(argv[++i]);
  else if (a === "--proxy") opts.proxy = argv[++i] || "";
  else if (a === "--promote") opts.promote = { id: argv[++i], k: parseInt(argv[++i], 10) };
  else if (!a.startsWith("--")) { if (!KEY) KEY = a; else if (!opts.only) opts.only = [a]; }  // 第一裸参=KEY，第二裸参=单轨（旧式兼容）
}

const MODEL = "google/lyria-3-clip-preview";
const OUT = path.join(__dirname, "..", "assets", "audio");
const CAND = path.join(OUT, "_cand");
const ORIG = path.join(CAND, "_orig");   // --remaster 原始备份（保真，便于回退/重归一）
const TMP = path.join(__dirname, "..", "test");
[OUT, CAND].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ---------- 结构化九轨 prompt（四要素：主奏编制 / 调式情绪+否定项 / 速度律动 / 循环友好）----------
const COMMON = "中国古风原创纯器乐，无人声无歌词，48kHz 高品质，动态干净不削波（峰值留足余量）";
const TRACKS = {
  // 日常修炼（药庐/洞府岁月）：夜读残卷的孤寂留白
  daily: {
    lead: "古琴独奏为主奏，箫声远远应和，偶有空灵磬音点缀",
    mood: "五声宫调式，孤寂苍凉中藏一丝坚韧，深夜独修的静气；无人声、无打击乐",
    tempo: "极慢，约 56 BPM，散板式呼吸感，长音绵延",
    loop: "约 30 秒，首尾以同一古琴长音收束，便于无缝循环",
  },
  // 市井集镇：人间烟火，热闹而不喧哗
  town: {
    lead: "琵琶与竹笛轻快对答，木鱼轻点节拍，偶有铃音",
    mood: "五声徵调式，市井烟火气，明朗温和，热闹而不喧哗；无人声、无铜管",
    tempo: "中速，约 96 BPM，轻巧的二拍律动",
    loop: "约 30 秒，乐句方整四小节一循环，结尾回到主音便于衔接",
  },
  // 旅途/舆图：风起天南的苍茫行旅
  journey: {
    lead: "竹笛悠扬主旋律，弦乐群与低音弦铺底，远处战鼓轻擂",
    mood: "羽调式，辽阔苍茫，山河万里的行旅感，大气中带一缕孤独；无人声",
    tempo: "中慢速，约 76 BPM，绵长推进的行进感",
    loop: "约 30 秒，弦乐持续音作底，首尾平滑过渡",
  },
  // 修仙集市（太南小会）：灵动神秘，仙气缭绕
  fair: {
    lead: "古筝快速琶音为骨，编钟与铃铎点缀，竹笛穿插短句",
    mood: "清乐音阶，灵动神秘，仙气缭绕的隐秘集市，好奇与机缘交织；无人声",
    tempo: "中速偏快，约 108 BPM，跳跃灵巧的律动",
    loop: "约 30 秒，琶音循环织体，首尾自然咬合",
  },
  // 普通战斗（降调裁决：日常斗法不轰烈，激昂只留给妖王/越级）：中速对峙拉锯
  combat: {
    lead: "古筝中速扫弦与轻快小鼓交替，箫声短句穿插试探",
    mood: "商调式，中速紧张的对峙拉锯，张弛有度不喧哗，武者过招的沉着；无唢呐、无铜管、无人声",
    tempo: "中速，约 112 BPM，克制的鼓点律动",
    loop: "约 30 秒，段落方整、强弱循环平滑，适合长时间反复",
  },
  // 决战/妖王/越级（boss）：压迫史诗——激昂只在这里
  boss: {
    lead: "重型太鼓与低音弦乐齐鸣，号角长鸣，钹镲点睛",
    mood: "小调式，压迫感极强的史诗决战，生死一线的宏大悲壮；无人声",
    tempo: "中速渐强，约 100 BPM，沉重有力的强拍",
    loop: "约 30 秒，以太鼓滚奏衔接首尾，循环不断张力",
  },
  // 阴谋/密室/禁地深处：阴冷悬疑
  tense: {
    lead: "低音持续音衬底，古筝泛音与钟琴水滴般稀疏点缀",
    mood: "无明确调中心的阴冷悬疑，黑暗中有什么在注视的寒意；无人声、无明显旋律",
    tempo: "极慢，约 60 BPM，近乎静止的氛围铺陈",
    loop: "约 30 秒，持续音长延，首尾几乎无缝",
  },
  // 离别/故人之死：哀而不伤
  sorrow: {
    lead: "二胡独奏如泣如诉，箫声低回，古琴轻拨作底",
    mood: "羽调式，哀而不伤，仙凡离别与故人长逝的怅惘，留白极多；无人声、无打击乐",
    tempo: "极慢，约 58 BPM，自由散板的呼吸",
    loop: "约 30 秒，尾句渐弱回到主音，柔和循环",
  },
  // 突破成功/扬名（短促上扬、不强求循环）：钟磬贺礼
  triumph: {
    lead: "古钟一击后管弦上扬，钟磬齐鸣，弦乐群推举",
    mood: "大调式，破关而出的昂扬与开阔，短促有力的凯旋；无人声",
    tempo: "中速上扬，约 92 BPM，递进的号召感",
    loop: "约 14 秒短曲，单次播放、结尾自然收束，无需循环",
  },
};
function buildPrompt(t) {
  return `${COMMON}。主奏与编制：${t.lead}。情绪与调式：${t.mood}。速度与律动：${t.tempo}。时长与循环：${t.loop}。`;
}

// ---------- 同步小睡（退避用，免依赖）----------
function sleep(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) { const e2 = Date.now() + ms; while (Date.now() < e2) {} } }

// ---------- 单次生成（SSE 流 → 拼接音频）----------
function genOnce(id, prompt) {
  const body = JSON.stringify({ model: MODEL, stream: true, modalities: ["audio", "text"], messages: [{ role: "user", content: prompt }] });
  const bodyFile = path.join(TMP, "_genmusic.body.json");
  const respFile = path.join(TMP, "_genmusic.sse.txt");
  fs.writeFileSync(bodyFile, body);
  const curlArgs = ["-s", "-N"];
  if (opts.proxy) curlArgs.push("-x", opts.proxy);
  curlArgs.push(
    "-X", "POST", "https://openrouter.ai/api/v1/chat/completions",
    "-H", "Authorization: Bearer " + KEY,
    "-H", "Content-Type: application/json",
    "-H", "X-Title: FanrenXiuxian",
    "--data", "@" + bodyFile, "-o", respFile, "--max-time", "300",
  );
  execFileSync("curl.exe", curlArgs, { stdio: "ignore" });
  const raw = fs.readFileSync(respFile, "utf8");
  if (raw.trim().startsWith("{")) {   // 非流式错误响应
    const j = JSON.parse(raw);
    const e = new Error(JSON.stringify(j.error || j).slice(0, 300));
    e.code = (j.error && (j.error.code || j.error.status)) || 0;
    throw e;
  }
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
    const slim = raw.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => l.length > 200 ? l.slice(0, 200) + "...[" + l.length + "]" : l).slice(0, 12).join("\n");
    fs.writeFileSync(path.join(TMP, "_genmusic.debug.txt"), slim || raw.slice(0, 2000));
    const e = new Error("SSE 流中未找到音频（样本存 test/_genmusic.debug.txt）");
    e.transient = true;
    throw e;
  }
  const buf = Buffer.concat(parts.map(p => Buffer.from(p, "base64")));
  const mm = mime || "audio/mp3";
  const ext = mm.includes("mpeg") || mm.includes("mp3") ? "mp3" : mm.includes("wav") ? "wav" : mm.includes("ogg") ? "ogg" : "mp3";
  try { fs.unlinkSync(bodyFile); fs.unlinkSync(respFile); } catch (e) {}
  return { buf, ext };
}

// 退避重试：429/5xx/超时/空流可重试；401/400 立即失败
function genWithRetry(id, prompt, maxTries = 4) {
  let wait = 4000;
  for (let attempt = 1; ; attempt++) {
    try { return genOnce(id, prompt); }
    catch (e) {
      const msg = String(e.message || "");
      const fatal = /401|invalid api key|no auth|unauthor|400|bad request/i.test(msg) && !e.transient;
      if (fatal || attempt >= maxTries) throw e;
      process.stdout.write(`  ↻ 重试(${attempt}/${maxTries - 1}) ${wait / 1000}s后… [${msg.slice(0, 80)}]\n`);
      sleep(wait); wait *= 2;
    }
  }
}

// ---------- 候选文件工具 ----------
function candPath(id, k, ext) { return path.join(CAND, `bgm_${id}_c${k}.${ext}`); }
function findCand(id, k) {
  const hit = fs.readdirSync(CAND).find(f => new RegExp(`^bgm_${id}_c${k}\\.`).test(f));
  return hit ? path.join(CAND, hit) : null;
}

// ---------- 质量门（ffmpeg/ffprobe）----------
function ffCombined(args) { const r = spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8", maxBuffer: 1 << 26 }); return (r.stdout || "") + (r.stderr || ""); }
function probeDur(file) { const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }); return parseFloat((r.stdout || "").trim()) || 0; }
function meanVol(args) { const out = ffCombined([...args, "-af", "volumedetect", "-f", "null", "-"]); const m = out.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/); return m ? parseFloat(m[1]) : NaN; }
function measure(file) {
  const dur = probeDur(file);
  const ld = ffCombined(["-i", file, "-af", `loudnorm=I=${opts.targetLufs}:TP=-1.0:LRA=11:print_format=json`, "-f", "null", "-"]);
  let lufs = NaN, tp = NaN;
  const jm = ld.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (jm) { try { const j = JSON.parse(jm[0]); lufs = parseFloat(j.input_i); tp = parseFloat(j.input_tp); } catch (e) {} }
  const head = meanVol(["-t", "0.25", "-i", file]);
  const tail = meanVol(["-sseof", "-0.25", "-i", file]);
  const seam = (isFinite(head) && isFinite(tail)) ? Math.abs(head - tail) : NaN;
  return { dur, lufs, tp, head, tail, seam };
}
function score(m, isTriumph) {
  let s = 0;
  const loD = isTriumph ? 8 : 26, hiD = isTriumph ? 20 : 34;   // triumph 短曲，时长窗不同
  if (!(m.dur >= loD && m.dur <= hiD)) s += 10;
  if (!(m.tp < -1.0)) s += 10;                                  // 削波（真峰过 -1dBFS）重罚
  if (isFinite(m.lufs)) s += Math.abs(m.lufs - opts.targetLufs) * 0.5;
  if (!isTriumph && isFinite(m.seam)) s += m.seam * 1.0;        // 循环接缝能量差（triumph 不循环不计）
  return s;
}
function fmt(x, d = 1) { return isFinite(x) ? x.toFixed(d) : "  ?"; }

// ---------- 转正：归一化响度后落库 ----------
function promote(id, k) {
  const src = findCand(id, k);
  if (!src) { console.error(`找不到候选 bgm_${id}_c${k}.*`); process.exit(1); }
  const dst = path.join(OUT, `bgm_${id}.mp3`);
  const r = spawnSync("ffmpeg", ["-hide_banner", "-y", "-i", src, "-af", `loudnorm=I=${opts.targetLufs}:TP=-1.0:LRA=11`, "-ar", "48000", "-b:a", "192k", dst], { encoding: "utf8" });
  if (r.status !== 0) { console.error("ffmpeg 归一化失败：\n" + (r.stderr || "").slice(-600)); process.exit(1); }
  const m = measure(dst);
  console.log(`✓ 转正 ${path.basename(src)} → ${path.basename(dst)}  [时长 ${fmt(m.dur)}s · 响度 ${fmt(m.lufs)} LUFS · 真峰 ${fmt(m.tp)} dBFS]`);
}

// ---------- 就地响度重制：现有轨归一到目标 LUFS / 不削波（治「吵闹」），从原始备份归一以保幂等 ----------
function remaster(id) {
  const dst = path.join(OUT, `bgm_${id}.mp3`);
  if (!fs.existsSync(dst)) { console.log(`  ${id.padEnd(9)} —（无现有轨，跳过）`); return; }
  if (!fs.existsSync(ORIG)) fs.mkdirSync(ORIG, { recursive: true });
  const bak = path.join(ORIG, `bgm_${id}.mp3`);
  if (!fs.existsSync(bak)) fs.copyFileSync(dst, bak);   // 只备一次，永远从真原归一（重跑不累积劣化）
  const before = measure(bak);
  const tmp = path.join(CAND, `_rm_${id}.mp3`);
  const r = spawnSync("ffmpeg", ["-hide_banner", "-y", "-i", bak, "-af", `loudnorm=I=${opts.targetLufs}:TP=-1.0:LRA=11`, "-ar", "48000", "-b:a", "192k", tmp], { encoding: "utf8" });
  if (r.status !== 0) { console.error(`  ${id}: ffmpeg 归一化失败\n` + (r.stderr || "").slice(-400)); return; }
  fs.copyFileSync(tmp, dst); try { fs.unlinkSync(tmp); } catch (e) {}
  const after = measure(dst);
  console.log(`  ${id.padEnd(9)} 响度 ${fmt(before.lufs).padStart(6)}→${fmt(after.lufs).padStart(6)} LUFS · 真峰 ${fmt(before.tp).padStart(5)}→${fmt(after.tp).padStart(5)} dBFS · 时长 ${fmt(after.dur)}s`);
}

// ---------- 主流程 ----------
const ids = (opts.only && opts.only.length ? opts.only : Object.keys(TRACKS)).filter(id => {
  if (!TRACKS[id]) { console.log(`跳过未知轨 ${id}`); return false; }
  return true;
});

function runGate() {
  const rows = [];
  console.log("\n候选质量门（参考——最终以耳朵为准）：");
  console.log("  轨道       候选  时长s  响度LUFS  真峰dB  接缝dB  评分(低优)");
  for (const id of ids) {
    const isT = id === "triumph";
    const cands = [];
    for (let k = 1; k <= 12; k++) { const f = findCand(id, k); if (f) cands.push({ k, f }); }
    if (!cands.length) { console.log(`  ${id.padEnd(9)} —  （无候选）`); continue; }
    let best = null;
    for (const c of cands) {
      const m = measure(c.f); const sc = score(m, isT);
      if (!best || sc < best.sc) best = { ...c, m, sc };
      rows.push({ id, k: c.k, m, sc });
      console.log(`  ${id.padEnd(9)} c${c.k}   ${fmt(m.dur).padStart(5)}  ${fmt(m.lufs).padStart(7)}  ${fmt(m.tp).padStart(6)}  ${fmt(m.seam).padStart(6)}  ${fmt(sc, 2).padStart(7)}`);
    }
    if (best) console.log(`  └─ ${id} 客观建议：c${best.k}（评分 ${fmt(best.sc, 2)}）  →  转正：node scripts/genmusic.js --promote ${id} ${best.k}`);
  }
  try { fs.writeFileSync(path.join(CAND, "_metrics.json"), JSON.stringify(rows, null, 2)); } catch (e) {}
  console.log("\n指标含义：时长≈30s（triumph 短）｜响度趋近目标 LUFS｜真峰 < -1dBFS 不削波｜接缝 dB 越小循环越平滑。");
}

(function main() {
  if (opts.promote) { promote(opts.promote.id, opts.promote.k); return; }
  if (opts.remaster) {
    console.log(`就地响度重制 → ${opts.targetLufs} LUFS / 真峰 -1dBFS（原始备份到 _cand/_orig/）：`);
    for (const id of ids) remaster(id);
    console.log("\n完成。如需回退：把 _cand/_orig/ 下文件拷回 assets/audio/。");
    return;
  }
  if (opts.gate) { runGate(); return; }
  if (!KEY) { console.error("生成需 KEY：node scripts/genmusic.js <OPENROUTER_KEY> [--only ids] [--n N] [--force]\n或仅质量门：node scripts/genmusic.js --gate"); process.exit(1); }

  console.log(`生成开始：${ids.length} 轨 × ${opts.n} 候选${opts.proxy ? "（代理 " + opts.proxy + "）" : "（直连）"}`);
  for (const id of ids) {
    const prompt = buildPrompt(TRACKS[id]);
    for (let k = 1; k <= opts.n; k++) {
      if (!opts.force && findCand(id, k)) { console.log(`· bgm_${id}_c${k} 已存在，跳过（--force 重跑）`); continue; }
      process.stdout.write(`生成 bgm_${id}_c${k} … `);
      try {
        const { buf, ext } = genWithRetry(id, prompt);
        const f = candPath(id, k, ext);
        fs.writeFileSync(f, buf);
        console.log(`✓ ${path.basename(f)} (${Math.round(buf.length / 1024)}KB)`);
      } catch (e) { console.log("✗ " + String(e.message).slice(0, 200)); }
    }
  }
  console.log("\n生成完成，跑质量门：");
  runGate();
  console.log("\n下一步：试听 _cand/ 下候选，挑顺耳的转正：node scripts/genmusic.js --promote <id> <k>");
})();
