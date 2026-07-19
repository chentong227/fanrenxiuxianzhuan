/* ============================================================
 * audio.js 头测：C2 换轨交叉淡化 + ducking（环境床让位 / 关键 SFX 让路）。
 * 用桩件替掉 Audio / AudioContext / 定时器（可控时钟），在 node 里跑 audio.js 的 IIFE。
 * 用法：node test/audio.test.js
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("  ✓ " + msg); pass++; }
  else { console.log("  ✗ 失败: " + msg); fail++; }
}
const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
// BGM 默认音量（audio.js BGM_VOL：源已 -20 LUFS 归一后降至 0.26 抑吵闹）——测试基准随之对齐
const BGM_V = 0.26;

// —— 可控时钟 + 假定时器 ——
let clock = 0;
let seq = 0;
const intervals = new Map();
function tick(ms) {
  clock += ms;
  for (const fn of [...intervals.values()]) { try { fn(); } catch (e) {} }
}

// —— 假 Audio 元素（记录创建顺序 / 音量 / 播放暂停）——
const created = [];
class FakeAudio {
  constructor(src) {
    this.src = src; this.volume = 1; this.loop = false;
    this.paused = true; this.playing = false;
    this.onerror = null; this.onended = null;
    created.push(this);
  }
  play() { this.paused = false; this.playing = true; return Promise.resolve(); }
  pause() { this.paused = true; }
}

// —— 假 AudioContext（够 RECIPES 跑不抛即可；play() 内部 try/catch 兜底）——
function gainNode() {
  return { gain: { value: 1, setValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {}, exponentialRampToValueAtTime() {} }, connect() {} };
}
function FakeCtx() { this.currentTime = 0; this.sampleRate = 44100; this.state = "running"; this.destination = {}; }
FakeCtx.prototype.resume = function () {};
FakeCtx.prototype.createGain = gainNode;
FakeCtx.prototype.createOscillator = () => ({ type: "", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} });
FakeCtx.prototype.createBuffer = (ch, len) => ({ getChannelData: () => new Float32Array(len) });
FakeCtx.prototype.createBufferSource = () => ({ buffer: null, connect() {}, start() {} });
FakeCtx.prototype.createBiquadFilter = () => ({ type: "", frequency: { value: 0 }, Q: { value: 0 }, connect() {} });
const panners = [];   // §7：记录每次 createStereoPanner 的 pan 值
FakeCtx.prototype.createStereoPanner = () => { const p = { pan: { value: 0 }, connect() {} }; panners.push(p); return p; };
// v312 SFX 母链桩件（软饱和→压缩→干湿混响）：缺这些桩会让 tone() 在 panOut→bus() 处抛错，
// 心跳计数只剩 1（第二记 tone 永远到不了）——§9-5 三项假红的根因
FakeCtx.prototype.createWaveShaper = () => ({ curve: null, oversample: "", connect() {} });
FakeCtx.prototype.createDynamicsCompressor = () => ({
  threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 },
  attack: { value: 0 }, release: { value: 0 }, connect() {},
});
FakeCtx.prototype.createConvolver = () => ({ buffer: null, connect() {} });

const sandbox = {
  console, Math, Date, Promise, Float32Array,
  performance: { now: () => clock },
  setInterval: (fn) => { const id = ++seq; intervals.set(id, fn); return id; },
  clearInterval: (id) => { intervals.delete(id); },
  setTimeout: () => 0, clearTimeout: () => {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  AudioContext: FakeCtx,
};
sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.root = sandbox;
sandbox.window.Audio = FakeAudio;
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/audio.js"), "utf8"), ctx, { filename: "js/audio.js" });
const Sfx = sandbox.Sfx;

console.log("== 1. 换轨交叉淡化：新轨从 0 淡入到目标音量 ==");
Sfx.bgm("daily");
{
  const a = created[0];
  assert(a && /bgm_daily\.mp3$/.test(a.src), "bgm('daily') 创建 daily 文件轨");
  assert(a.playing === true, "daily 轨在播（自管交叉淡化循环：loop=false 但持续播）");
  assert(a.volume === 0, "起始音量 0（待淡入）");
  tick(600);
  assert(near(a.volume, BGM_V), `600ms 后淡入到 ${BGM_V}（实际 ${a.volume.toFixed(3)}）`);
}

console.log("== 2. 换轨：旧轨交叉淡出收掉、新轨淡入 ==");
Sfx.bgm("combat");
{
  const old = created[0], nw = created[1];
  assert(nw && /bgm_combat\.mp3$/.test(nw.src), "bgm('combat') 创建新轨");
  assert(nw.volume === 0, "新轨起始 0");
  tick(600);
  assert(near(old.volume, 0) && old.paused === true, "旧轨淡出到 0 并暂停");
  assert(near(nw.volume, BGM_V), `新轨淡入到 ${BGM_V}（实际 ${nw.volume.toFixed(3)}）`);
}

console.log("== 3. 关键 SFX 让路：thunder 触发→音乐瞬时 −6dB 再缓回 ==");
{
  const cur = created[1];                 // 当前 combat 轨，音量 BGM_V
  Sfx.play("thunder");
  tick(80);
  assert(near(cur.volume, BGM_V * 0.5), `落到 ×0.5≈${(BGM_V*0.5).toFixed(3)}（实际 ${cur.volume.toFixed(3)}）`);
  tick(520);
  assert(near(cur.volume, BGM_V), `缓回 ${BGM_V}（实际 ${cur.volume.toFixed(3)}）`);
}

console.log("== 4. 环境床让位（duck）：起床压低 BGM、收床恢复 ==");
{
  const cur = created[1];
  Sfx.ambient("night");
  assert(created[2] && /amb_night\.mp3$/.test(created[2].src), "ambient('night') 起文件床");
  tick(240);
  assert(near(cur.volume, BGM_V * 0.16, 0.012), `床领奏→BGM 压到 ×0.16≈${(BGM_V*0.16).toFixed(3)}（实际 ${cur.volume.toFixed(3)}）`);
  Sfx.ambient(null);
  tick(320);
  assert(near(cur.volume, BGM_V), `收床→BGM 恢复 ${BGM_V}（实际 ${cur.volume.toFixed(3)}）`);
}

console.log("== 5. 同轨幂等：重复 bgm(同轨) 不新建元素 ==");
{
  const n = created.length;
  Sfx.bgm("combat");
  assert(created.length === n, "bgm('combat') 同轨幂等，未新建元素");
}

console.log("== 6. C3 切轨校验：未知轨名一律拒绝、不扰动当前播放 ==");
{
  assert(typeof Sfx.isTrack === "function" && Sfx.isTrack("boss") && !Sfx.isTrack("nope"),
    "isTrack：合法轨真、非法轨假");
  assert(Sfx.tracks().length === 11, "tracks()：十一轨白名单（daily/town/journey/fair/combat/combat_wild/combat_secret/boss/tense/sorrow/triumph）");
  const n = created.length, cur = Sfx.curBgm();   // 当前应为 combat
  const warns = [];
  const origWarn = console.warn; console.warn = (m) => warns.push(m);
  Sfx.bgm("bos");          // typo
  Sfx.bgm("");             // 空串
  Sfx.bgm(undefined);      // 漏传
  console.warn = origWarn;
  assert(created.length === n, "未知轨：未新建任何音轨元素");
  assert(Sfx.curBgm() === cur, "未知轨：当前轨名未被改写（不切没）");
  assert(warns.filter(w => /未知 BGM 轨/.test(w)).length === 2, "typo/空串各告警一次，漏传(null/undefined)静默");
}

console.log("== 7. §9-5 危局氛围：心跳低鼓控制器（起/收/幂等/分档/静音空转）==");
{
  // 计数振荡器创建：一记心跳=2 个 tone（lub-dub）
  let oscN = 0;
  const origOsc = FakeCtx.prototype.createOscillator;
  FakeCtx.prototype.createOscillator = function () { oscN++; return origOsc.call(this); };

  assert(typeof Sfx.peril === "function" && Sfx.perilState() === 0, "初始 perilState=0、peril 可调用");

  oscN = 0;
  Sfx.peril(1);
  assert(Sfx.perilState() === 1, "peril(1)→危局档");
  assert(oscN === 2, `进入即刻一记心跳（2 振荡器，实际 ${oscN}）`);
  oscN = 0; tick(1);
  assert(oscN === 2, `循环到点再跳一记（实际 ${oscN}）`);

  oscN = 0; Sfx.peril(1);
  assert(Sfx.perilState() === 1 && oscN === 0, "同档幂等：不重起、不补跳");

  oscN = 0; Sfx.peril(2);
  assert(Sfx.perilState() === 2 && oscN === 2, "升档濒死：切档并即刻一记");

  oscN = 0; Sfx.peril(0);
  assert(Sfx.perilState() === 0, "peril(0)→收");
  tick(1);
  assert(oscN === 0, "收档后循环不再发声");

  // 静音空转：mute 下进入危局，循环仍在但不出声
  Sfx.toggle();                 // → muted
  oscN = 0; Sfx.peril(2); tick(1);
  assert(Sfx.perilState() === 2 && oscN === 0, "静音时心跳空转（perilState 仍记档、零振荡器）");
  Sfx.toggle();                 // 还原
  Sfx.peril(0);
  FakeCtx.prototype.createOscillator = origOsc;
}

console.log("== 9(v324). 让位期间换轨：新轨淡入目标吃 duck 系数，不弹回全音量 ==");
{
  // 起环境床（duck）→ 换轨 → 新轨应淡入到 BGM_V×0.16，而非全音量 BGM_V
  Sfx.ambient("night");
  tick(240);
  const n0 = created.length;
  Sfx.bgm("town");
  const nw = created[n0];
  assert(nw && /bgm_town\.mp3$/.test(nw.src), "让位中 bgm('town') 创建新轨");
  tick(600);
  assert(near(nw.volume, BGM_V * 0.16, 0.012),
    `新轨淡入到让位音量 ×0.16≈${(BGM_V * 0.16).toFixed(3)}（实际 ${nw.volume.toFixed(3)}）——不再冲到全音量与旧轨叠响`);
  // 收床 → 恢复全音量（unduck 按 _vol 恢复）
  Sfx.ambient(null);
  tick(320);
  assert(near(nw.volume, BGM_V), `收床→恢复 ${BGM_V}（实际 ${nw.volume.toFixed(3)}）`);
  // 还原：回 combat 轨（后续段落假设）
  Sfx.bgm("combat"); tick(600);
}

console.log("== 8. §7 空间音/声相：play(name,{pan}) 经 StereoPanner 偏左右 ==");
{
  // 确保未静音（前面 peril 段已还原，这里防御性确认）
  if (!Sfx.enabled()) Sfx.toggle();
  panners.length = 0;
  Sfx.play("type", { pan: -0.45 });
  assert(panners.length >= 1 && near(panners[0].pan.value, -0.45), "pan:-0.45→建 StereoPanner、值≈-0.45（NPC 在左）");
  panners.length = 0;
  Sfx.play("click", { pan: 0.45 });   // 换音名避开 70ms 去抖
  assert(panners.length >= 1 && near(panners[0].pan.value, 0.45), "pan:+0.45→偏右（韩立在右）");
  panners.length = 0;
  Sfx.play("page");                    // 无 pan：直连、不建 panner
  assert(panners.length === 0, "无 pan→不建 StereoPanner（居中直连）");
  panners.length = 0;
  Sfx.play("heal", { pan: 9 });        // 越界钳到 [-1,1]
  assert(panners.length >= 1 && near(panners[0].pan.value, 1), "pan 越界→钳到 1");
}

console.log(`\n========== 音频 C2/C3 + §9-5 + §7：${fail === 0 ? "全通 ✓" : fail + " 项败 ✗"}（${pass} 项）==========`);
process.exit(fail ? 1 : 0);
