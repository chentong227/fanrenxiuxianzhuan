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
const { State, Engine, DIALOGUE, WORLD, STORY } = sandbox;

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

// 4) 走方郎中：诊治回血（受伤时）
{
  State.create("韩立", "si");
  const s = State.data;
  s.hp = 20;
  Engine.dialogueTopic("langzhong", 0);
  assert(s.hp > 20, `郎中诊治回血（20 → ${s.hp}）`);
}

// 4.5) 一次性主题：谈过即不再出现（杜绝无限刷道具/属性）
{
  State.create("韩立", "si");
  const s = State.data;
  s.storyStage = STORY.length;   // 避免 checkStory 触发开场剧情占用 pendingEvent
  const ins0 = s.insight;
  // 散修「请教见识」是 once，给悟性
  let topics = DIALOGUE.forNpc("sanxiu", s);
  const idx = topics.findIndex(t => t.id === "cultivation_talk");
  assert(idx >= 0, "散修见识主题初次可见");
  Engine.dialogueTopic("sanxiu", idx);
  assert(s.insight === ins0 + 1, "首次请教，悟性+1");
  // 再看，已不在可用列表
  assert(!DIALOGUE.forNpc("sanxiu", s).some(t => t.id === "cultivation_talk"), "一次性主题谈过即消失（不可重复刷悟性）");
  // 即便强行再调用，也不再加属性
  const ins1 = s.insight;
  Engine.dialogueTopic("sanxiu", 0);
  assert(s.insight === ins1, "强行重复调用也不再给悟性");

  // 老农赠灵草同样是一次性
  const lc0 = State.count("lingcao");
  const nidx = DIALOGUE.forNpc("nongfu", s).findIndex(t => t.id === "herb_tip");
  Engine.dialogueTopic("nongfu", nidx);
  assert(State.count("lingcao") > lc0, "首次讨教，得灵草");
  assert(!DIALOGUE.forNpc("nongfu", s).some(t => t.id === "herb_tip"), "老农赠草一次性，不可重复刷");
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
