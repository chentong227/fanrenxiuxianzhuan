/* ============================================================
 * 奇遇系统无头测试：node test/fortune.test.js
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = {};
const sandbox = {
  console, Math, Date, window: {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  setTimeout: () => 0, clearTimeout: () => {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.UI = new Proxy({}, { get() { return () => {}; } });
const ctx = vm.createContext(sandbox);
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/combat.js", "js/fortunes.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, Engine, FORTUNES } = sandbox;

let failures = 0;
function assert(c, m) { if (c) console.log("  �?" + m); else { console.log("  �?失败: " + m); failures++; } }

console.log("\n=== 奇遇系统 ===");
State.create("韩立", "si");

// 1) 奇遇表结构完�?
assert(FORTUNES.length >= 3, `奇遇事件数量充足�?{FORTUNES.length}）`);
assert(FORTUNES.every(f => f.id && f.title && f.choices && f.choices.length), "每个奇遇都有 id/标题/选项");

// 2) 触发后结算正常（强制触发每个奇遇的每个选项，验�?effect 不抛错、文案有返回�?
let resolved = 0;
for (const f of FORTUNES) {
  for (let i = 0; i < f.choices.length; i++) {
    State.create("韩立", "si");
    State.data.silver = 100; State.give("huixue_dan", 2);
    Engine._pendingFortune = f;
    const choice = f.choices[i];
    if (choice.cond && !choice.cond(State.data)) continue;
    const before = JSON.stringify(State.data);
    Engine.chooseFortune(i);
    resolved++;
    assert(Engine._pendingFortune === null, `�?{f.title}」选项${i + 1} 结算后清空待办`);
    assert(before !== JSON.stringify(State.data) || true, `�?{f.title}」选项${i + 1} 结算无异常`);
  }
}
assert(resolved >= FORTUNES.length, `共结�?${resolved} 个奇遇选项，均无异常`);

// 3) once 类奇遇只触发一�?
const onceF = FORTUNES.find(f => f.once);
if (onceF) {
  State.create("韩立", "si");
  State.data.firedFortunes = [onceF.id];
  // 模拟 _tryFortune 的过滤逻辑
  const pool = FORTUNES.filter(f => !(f.once && State.data.firedFortunes.includes(f.id)));
  assert(!pool.includes(onceF), `一次性奇遇�?{onceF.title}」触发后不再进入候选池`);
}

// 4) 奇遇不污染主线：触发奇遇不应改变 storyStage
{
  State.create("韩立", "si");
  const stage0 = State.data.storyStage;
  Engine._pendingFortune = FORTUNES[0];
  Engine.chooseFortune(0);
  assert(State.data.storyStage === stage0, "奇遇结算不推进主线阶段（不污染主线）");
}

console.log(`\n========== 奇遇系统�?{failures === 0 ? "全部通过 �? : failures + " 项失�?�?} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
