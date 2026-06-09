/* ============================================================
 * 据点对话主题无头测试：node test/dialogue.test.js
 * 每个 NPC 有忠于身份的独特交互，条件正确，结算无异常
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
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, Engine, DIALOGUE, WORLD } = sandbox;

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }

console.log("\n=== 据点对话主题 ===");

// 1) 每个有主题的 NPC 都对应真实人物
{
  const ids = Object.keys(DIALOGUE.topics);
  const allValid = ids.every(id => !!WORLD.npcById(id));
  assert(allValid, "所有对话主题都挂在真实人物名册上");
  assert(ids.includes("lifeiyu") && ids.includes("xiaosuanpan"), "厉飞雨/小算盘有专属主题");
}

// 2) 厉飞雨：切磋增体魄、增交情、耗时
{
  State.create("韩立", "si");
  const s = State.data;
  const body0 = s.body, m0 = State.absMonth();
  Engine.dialogueTopic("lifeiyu", 0);   // spar
  assert(s.body === body0 + 1, "与厉飞雨切磋，体魄+1");
  assert(State.absMonth() > m0, "切磋消耗光阴");
}

// 3) 小算盘：买消息需灵石，足量时可买、扣灵石
{
  State.create("韩立", "si");
  const s = State.data;
  // 灵石不足时该主题不出现
  const noStone = DIALOGUE.forNpc("xiaosuanpan", s).some(t => t.id === "buy_rumor");
  assert(!noStone, "无灵石时「打探消息」不可选（条件门禁）");
  State.give("lingshi", 1);
  const canBuy = DIALOGUE.forNpc("xiaosuanpan", s).some(t => t.id === "buy_rumor");
  assert(canBuy, "有灵石时「打探消息」可选");
  const idx = DIALOGUE.forNpc("xiaosuanpan", s).findIndex(t => t.id === "buy_rumor");
  Engine.dialogueTopic("xiaosuanpan", idx);
  assert(State.count("lingshi") === 0, "打探消息扣除灵石");
}

// 4) 走方郎中：诊治回血
{
  State.create("韩立", "si");
  const s = State.data;
  s.hp = 20;
  Engine.dialogueTopic("langzhong", 0);
  assert(s.hp > 20, `郎中诊治回血（20 → ${s.hp}）`);
}

// 5) 条件门禁：贾天龙观察主题仅帮派战时出现
{
  State.create("韩立", "si");
  const s = State.data;
  assert(DIALOGUE.forNpc("jiatianlong", s).length === 0, "未到帮派之争，无贾天龙主题");
  s.flags.gang_war = true;
  assert(DIALOGUE.forNpc("jiatianlong", s).length > 0, "帮派之争起，可观察贾天龙");
}

// 6) 全主题结算无异常
{
  State.create("韩立", "si");
  const s = State.data;
  s.flags.gang_war = true; State.give("lingshi", 5);
  let ok = true;
  for (const id of Object.keys(DIALOGUE.topics)) {
    const topics = DIALOGUE.forNpc(id, s);
    topics.forEach((t, i) => { try { Engine.dialogueTopic(id, i); } catch (e) { ok = false; console.log("    异常:", id, e.message); } });
  }
  assert(ok, "所有可用对话主题结算无异常");
}

console.log(`\n========== 据点对话：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
