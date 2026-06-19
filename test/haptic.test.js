/* ============================================================
 * §9-3 手机触觉反馈头测：Fx.haptic 能力/开关/reduced-motion 守卫 + 预设映射，
 * hit-stop 同步重震，以及 audio.js 关键 SFX（古钟/天雷）→ Fx.haptic 的接线。
 * 用桩 navigator.vibrate / matchMedia / Audio / AudioContext 在 node 里跑两个 IIFE。
 * 用法：node test/haptic.test.js
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("  ✓ " + msg); pass++; }
  else { console.log("  ✗ 失败: " + msg); fail++; }
}

// —— 桩：记录每次 vibrate 入参；matchMedia 可切 reduced-motion ——
const vibes = [];
let reducedMotion = false;
const store = {};
function FakeCtx() { this.currentTime = 0; this.destination = {}; this.state = "running"; }
FakeCtx.prototype.resume = function () {};
FakeCtx.prototype.createGain = () => ({ gain: { value: 1, setValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }, connect() {} });
FakeCtx.prototype.createOscillator = () => ({ frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} });
FakeCtx.prototype.createBuffer = (ch, len) => ({ getChannelData: () => new Float32Array(len || 1) });
FakeCtx.prototype.createBufferSource = () => ({ connect() {}, start() {} });
FakeCtx.prototype.createBiquadFilter = () => ({ frequency: { value: 0 }, Q: { value: 0 }, connect() {} });

const sandbox = {
  console, Math, Date, Promise, Float32Array,
  performance: { now: () => 0 },
  setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
  requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  navigator: { vibrate: (p) => { vibes.push(p); return true; } },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  matchMedia: (q) => ({ matches: /reduce/.test(q) ? reducedMotion : false, addEventListener() {}, addListener() {} }),
  document: { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, clearRect() {} }), style: {}, classList: { add() {}, remove() {}, toggle() {} }, width: 0, height: 0 }), getElementById: () => null, addEventListener() {} },
  AudioContext: FakeCtx,
};
sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.root = sandbox;
sandbox.window.Audio = function () { this.volume = 1; this.play = () => Promise.resolve(); this.pause = () => {}; };
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/fx.js"), "utf8"), ctx, { filename: "js/fx.js" });
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/audio.js"), "utf8"), ctx, { filename: "js/audio.js" });
const { Fx, Sfx } = sandbox;
const last = () => vibes[vibes.length - 1];

console.log("== 1. 预设映射：haptic(name) → navigator.vibrate(预设) ==");
{
  vibes.length = 0;
  Fx.haptic("bell");
  assert(JSON.stringify(last()) === JSON.stringify([12, 70, 12]), "bell → [12,70,12]");
  Fx.haptic("heavy");
  assert(JSON.stringify(last()) === JSON.stringify([18, 28, 40]), "heavy → [18,28,40]");
  Fx.haptic("tap");
  assert(last() === 10, "tap → 10（标量）");
  Fx.haptic([5, 5]);
  assert(JSON.stringify(last()) === JSON.stringify([5, 5]), "自定义 [5,5] 透传");
}

console.log("== 2. 未知预设名 → 不振动（p==null 跳过）==");
{
  const n = vibes.length;
  Fx.haptic("nope");
  assert(vibes.length === n, "未知预设：未调用 vibrate");
}

console.log("== 3. 开关：setHaptics(false) 静默、(true) 恢复、且持久化 ==");
{
  Fx.setHaptics(false);
  const n = vibes.length;
  Fx.haptic("hit");
  assert(vibes.length === n, "关闭后不振动");
  assert(store["fx_haptics"] === "off", "关闭已写入 localStorage");
  Fx.setHaptics(true);
  Fx.haptic("hit");
  assert(vibes.length === n + 1 && last() === 16, "重新开启后恢复振动（hit=16）");
}

console.log("== 4. reduced-motion：直接跳过（兼无障碍）==");
{
  reducedMotion = true;
  const n = vibes.length;
  Fx.haptic("bell");
  assert(vibes.length === n, "prefers-reduced-motion 下不振动");
  reducedMotion = false;
}

console.log("== 5. 能力缺失：无 navigator.vibrate → 不抛、no-op ==");
{
  const orig = sandbox.navigator.vibrate;
  sandbox.navigator.vibrate = undefined;
  let threw = false;
  try { Fx.haptic("hit"); } catch (e) { threw = true; }
  assert(!threw, "无 vibrate 能力时静默不抛");
  sandbox.navigator.vibrate = orig;
}

console.log("== 6. hit-stop 同步一记 heavy 重震（决定性一击）==");
{
  const n = vibes.length;
  Fx.hitStop(80);
  assert(vibes.length === n + 1 && JSON.stringify(last()) === JSON.stringify([18, 28, 40]), "hitStop → heavy 震");
}

console.log("== 7. 接线：Sfx.play('bell') 触发 Fx.haptic('bell') ==");
{
  const n = vibes.length;
  Sfx.play("bell");
  assert(vibes.length === n + 1 && JSON.stringify(last()) === JSON.stringify([12, 70, 12]), "古钟 SFX → bell 震");
  Sfx.play("thunder");
  assert(JSON.stringify(last()) === JSON.stringify([18, 28, 40]), "天雷 SFX → heavy 震");
}

console.log(`\n========== §9-3 触觉反馈：${fail === 0 ? "全通 ✓" : fail + " 项败 ✗"}（${pass} 项）==========`);
process.exit(fail ? 1 : 0);
