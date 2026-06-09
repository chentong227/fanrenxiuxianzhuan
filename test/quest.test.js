/* ============================================================
 * 任务系统 / 时间线 无头测试：node test/quest.test.js
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
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/combat.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, Engine } = sandbox;

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }

console.log("\n=== 任务系统 ===");

// 1) 限期任务：期限内达成 → 成功结算
{
  State.create("韩立", "si");
  Engine.assignTask("modafu_deadline", 6);
  assert(Engine.hasTask("modafu_deadline"), "成功派发限期任务");
  const silver0 = State.data.silver;
  State.data.realmIndex = 2;
  Engine.passTime(1);
  assert(!Engine.hasTask("modafu_deadline"), "达成后任务移除");
  assert(State.data.silver === silver0 + 40, `达成赏银（${silver0} → ${State.data.silver}）`);
}

// 2) 限期任务：逾期未成 → 失败结算
{
  State.create("韩立", "si");
  Engine.assignTask("modafu_deadline", 6);
  const mood0 = State.data.mood;
  State.data.realmIndex = 0;
  Engine.passTime(7);
  assert(!Engine.hasTask("modafu_deadline"), "逾期后任务移除");
  assert(State.data.mood < mood0, `逾期失败有惩罚（心境 ${mood0} → ${State.data.mood}）`);
}

// 3) 时间线事件：到点触发
{
  State.create("韩立", "si");
  Engine.scheduleEvent("zhangtie_death", 3);
  Engine.passTime(2);
  assert(!State.flag("zhangtie_fated"), "未到期不触发");
  Engine.passTime(2);
  assert(State.flag("zhangtie_fated"), "到点触发时间线事件（张铁归期不至）");
}

// 4) 绝对月推进正确（跨年）
{
  State.create("韩立", "si");
  State.data.year = 1; State.data.month = 11;
  const before = State.absMonth();
  Engine.passTime(3);
  assert(State.absMonth() === before + 3, `绝对月推进正确（${before} → ${State.absMonth()}）`);
  assert(State.data.year === 2 && State.data.month === 2, `跨年进位正确（第${State.data.year}年${State.data.month}月）`);
}

// 5) 时间流速：6次闭关 = 6个月
{
  State.create("韩立", "si");
  const m0 = State.absMonth();
  for (let i = 0; i < 6; i++) Engine.cultivate(1);
  assert(State.absMonth() - m0 === 6, "6次闭关(各1月) = 6个月（节奏明快）");
}

console.log(`\n========== 任务/时间线：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
