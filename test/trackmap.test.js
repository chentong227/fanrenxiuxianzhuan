/* ============================================================
 * C3 切轨校验：核对"场景 → BGM 轨"的映射（audio-design §三表）。
 * 把 UI._bgmForLocation 在桩 State 下逐场景跑一遍，确认进城切 town、集市切 fair、
 * 密室切 tense、旅途切 journey、其余日常切 daily；且产出的轨名都在 audio.js 白名单内。
 * 用法：node test/trackmap.test.js
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("  ✓ " + msg); pass++; }
  else { console.log("  ✗ 失败: " + msg); fail++; }
}

// —— 桩环境：UI/audio 都是全局对象，加载即定义；_bgmForLocation 只读 State.data + loc.id ——
const sandbox = {
  console, Math, Date,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
  document: { getElementById: () => null, createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} } }), addEventListener() {}, body: { classList: { add() {}, remove() {} } } },
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
};
sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.root = sandbox;
const State = { data: {}, location() { return null; } };
sandbox.State = State;
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/audio.js"), "utf8"), ctx, { filename: "js/audio.js" });
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/ui.js"), "utf8"), ctx, { filename: "js/ui.js" });
const { UI, Sfx } = sandbox;

const at = (loc, journey) => { State.data = journey ? { journey: true } : {}; return UI._bgmForLocation(loc); };

console.log("== 1. 场景 → 轨：逐条核对（audio-design §三表）==");
const CASES = [
  ["town",         { id: "town" },          "town"],
  ["嘉元城",        { id: "jiayuan_city" },   "town"],
  ["太南集市",      { id: "tainan_fair" },    "fair"],
  ["密室/禁地",     { id: "miju" },           "tense"],
  ["药庐(默认)",    { id: "yaolu" },          "daily"],
  ["洞府(默认)",    { id: "dongfu" },         "daily"],
  ["无地点",        null,                     "daily"],
];
for (const [name, loc, want] of CASES) {
  const got = at(loc);
  assert(got === want, `${name} → ${want}（实得 ${got}）`);
}

console.log("== 2. 旅途态优先：journey 凌驾地点 ==");
{
  const got = at({ id: "town" }, true);   // 在旅途中即便 loc=town 也应走 journey
  assert(got === "journey", `journey 态 → journey（实得 ${got}）`);
}

console.log("== 3. 闭环校验：映射产出的轨名都在 audio.js 白名单内 ==");
{
  const produced = new Set();
  for (const [, loc] of CASES) produced.add(at(loc));
  produced.add(at({ id: "town" }, true));
  let allKnown = true;
  for (const t of produced) if (!Sfx.isTrack(t)) { allKnown = false; assert(false, `映射轨 ${t} 不在白名单`); }
  assert(allKnown, `所有映射轨均合法：${[...produced].join("/")}`);
}

console.log(`\n========== C3 切轨校验：${fail === 0 ? "全通 ✓" : fail + " 项败 ✗"}（${pass} 项）==========`);
process.exit(fail ? 1 : 0);
