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
  assert(a.loop === true && a.playing === true, "daily 轨 loop+play");
  assert(a.volume === 0, "起始音量 0（待淡入）");
  tick(600);
  assert(near(a.volume, 0.3), `600ms 后淡入到 0.3（实际 ${a.volume.toFixed(3)}）`);
}

console.log("== 2. 换轨：旧轨交叉淡出收掉、新轨淡入 ==");
Sfx.bgm("combat");
{
  const old = created[0], nw = created[1];
  assert(nw && /bgm_combat\.mp3$/.test(nw.src), "bgm('combat') 创建新轨");
  assert(nw.volume === 0, "新轨起始 0");
  tick(600);
  assert(near(old.volume, 0) && old.paused === true, "旧轨淡出到 0 并暂停");
  assert(near(nw.volume, 0.3), `新轨淡入到 0.3（实际 ${nw.volume.toFixed(3)}）`);
}

console.log("== 3. 关键 SFX 让路：thunder 触发→音乐瞬时 −6dB 再缓回 ==");
{
  const cur = created[1];                 // 当前 combat 轨，音量 0.3
  Sfx.play("thunder");
  tick(80);
  assert(near(cur.volume, 0.15), `落到 ×0.5≈0.15（实际 ${cur.volume.toFixed(3)}）`);
  tick(520);
  assert(near(cur.volume, 0.3), `缓回 0.3（实际 ${cur.volume.toFixed(3)}）`);
}

console.log("== 4. 环境床让位（duck）：起床压低 BGM、收床恢复 ==");
{
  const cur = created[1];
  Sfx.ambient("night");
  assert(created[2] && /amb_night\.mp3$/.test(created[2].src), "ambient('night') 起文件床");
  tick(240);
  assert(near(cur.volume, 0.3 * 0.16, 0.012), `床领奏→BGM 压到 ×0.16≈0.048（实际 ${cur.volume.toFixed(3)}）`);
  Sfx.ambient(null);
  tick(320);
  assert(near(cur.volume, 0.3), `收床→BGM 恢复 0.3（实际 ${cur.volume.toFixed(3)}）`);
}

console.log("== 5. 同轨幂等：重复 bgm(同轨) 不新建元素 ==");
{
  const n = created.length;
  Sfx.bgm("combat");
  assert(created.length === n, "bgm('combat') 同轨幂等，未新建元素");
}

console.log(`\n========== 音频 C2：${fail === 0 ? "全通 ✓" : fail + " 项败 ✗"}（${pass} 项）==========`);
process.exit(fail ? 1 : 0);
