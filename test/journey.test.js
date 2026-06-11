/* ============================================================
 * 大陆旅途无头测试：node test/journey.test.js
 * 验证：启程→逐月走段→事件抉择→到达；探家剧情；gate 拦截；存档兼容。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = {};
const sandbox = {
  console, Math, Date, window: {},
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  setTimeout: () => 0, clearTimeout: () => {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.UI = new Proxy({}, { get() { return () => {}; } });
const ctx = vm.createContext(sandbox);

for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  const code = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  vm.runInContext(code, ctx, { filename: f });
}

const { State, Engine, WORLD } = sandbox;

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ 失败: " + msg); failures++; }
}

console.log("\n=== 1. 大陆层数据完备 ===");
{
  assert(WORLD.continent && WORLD.continent.nodes.length >= 5, `大陆节点 ≥5（${WORLD.continent.nodes.length}）`);
  const qn = WORLD.continent.nodes.find(n => n.id === "qingniu");
  assert(qn && qn.visit === "home", "青牛镇为探家事件节点");
  const hf = WORLD.continent.nodes.find(n => n.id === "huangfeng");
  assert(hf && typeof hf.gate === "function", "黄枫谷有道途门槛");
}

console.log("\n=== 2. gate 拦截：升仙令未得不可去黄枫谷 ===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.location = "yaolu";
  s.pendingEvent = null;   // 测试径：跳过开场剧情
  Engine.startJourney("huangfeng");
  assert(!s.journey, "无升仙令：旅途未启动（道途未通）");
}

console.log("\n=== 3. 回乡探家全程 ===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.location = "yaolu";
  s.pendingEvent = null;
  s.silver = 30;
  s.age = 18;
  const m0 = State.absMonth();
  Engine.startJourney("qingniu");
  assert(s.journey || Engine._pendingFortune || Engine._afterFortuneHook, "旅途已启动");
  // 模拟玩家：逢抉择选第一项；逢战斗速胜；直到旅途（含返程）结束
  let guard = 0;
  while ((s.journey || Engine._pendingFortune || Engine._afterFortuneHook) && guard++ < 40) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) {
      Engine._combat.enemies.forEach(e => { e.hp = 0; });
      Engine._combat._checkEnd();
      Engine._finishCombat();
      continue;
    }
    break;
  }
  assert(!s.journey && !Engine._pendingFortune, `旅途全程结束（${guard} 步模拟）`);
  assert(State.absMonth() > m0, `光阴真实流逝（${State.absMonth() - m0} 月）`);
  assert(s.location === "yaolu", `归程后回到药庐（实际 ${s.location}）`);
  assert((s.milestones || []).some(m => /回乡/.test(m.title)) || !s.ledger.home_visited_qixuan,
    "探家入年表（若选了陪伴径）");
}

console.log("\n=== 4. 存档兼容：旅途中断字段无损 ===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.journey = { to: "qingniu", toName: "青牛镇", leg: 0, total: 1 };
  State.save();
  State.load();
  assert(State.data.journey && State.data.journey.to === "qingniu", "journey 字段存档往返无损");
}

console.log("\n=== 5. 离门远行 · 嘉元城主线全链路 ===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.location = "yaolu";
  s.pendingEvent = null;
  s.storyStage = sandbox.STORY.findIndex(st => st.id === "mo_arrive");   // 直接对位嘉元城章节
  s.flags.arc1_complete = true;
  s.flags.han_du = true;
  s.realmIndex = 5; s.hp = 120; s.hpMax = 120; s.silver = 40;
  s.sideUnit = { id: "zhangtie_corpse", name: "铁奴·张铁", hp: 70, hpMax: 70, atk: 12,
                 atkName: "尸傀挥击", nature: "corpse", guard: 0.3, status: "ok", carry: true };
  // 启程嘉元城（旅途中事件全选第一项，战斗速胜）
  Engine.startJourney("jiayuan");
  let guard = 0;
  while ((s.journey || Engine._pendingFortune) && guard++ < 40) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) {
      Engine._combat.enemies.forEach(e => { e.hp = 0; });
      Engine._combat._checkEnd();
      Engine._finishCombat();
      continue;
    }
    break;
  }
  assert(s.location === "jiayuan_city", `到达嘉元城（实际 ${s.location}）`);
  // 到达即触发投信剧情（checkStory 在 passTime/行动后调度——手动触发对齐）
  Engine.checkStory();
  assert(s.pendingEvent === "mo_arrive", `投信剧情触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.mo_met, "投信完成（mo_met）");
  assert(s.metNpcs.includes("mocaihuan"), "墨彩环录入图鉴");
  // 客居一月 → 宵小夜探（考据修正：动漫线无欧阳飞天战——墨府之危是氛围与远线，五色门在京城篇兑现）
  Engine.passTime(1);
  Engine.checkStory();
  assert(s.pendingEvent === "mo_crisis", `客居月余，宵小夜探（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.mo_warned, "墨府之危已现（mo_warned）");
  // 宝玉解毒 + 曲魂留府（固定剧情：动漫线，铺曲魂夺舍/奇虫榜远线）
  Engine.checkStory();
  assert(s.pendingEvent === "mo_resolve", `暖阳宝玉一幕触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.han_du_cured, "寒毒得解");
  assert(State.count("nuanyang_yu") === 1, "暖阳宝玉入袋");
  assert(!s.sideUnit, "曲魂留墨府（固定剧情，侧位移交）");
  assert(s.ledger && s.ledger.quhun_left_mo, "因果账本记下曲魂之托");
}

console.log(`\n========== 大陆旅途：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
sandbox.process = undefined;
process.exit(failures === 0 ? 0 : 1);
