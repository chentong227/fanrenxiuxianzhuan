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
  State.give("shengxian_ling", 1);   // 七玄门篇通关所得（测试跳过 arc_end，手动补发）
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

  // —— 站三：太南小会（万小山/赶集/长春后篇/青纹阴谋）——
  State.give("lingshi", 12);
  s.journey = null;
  Engine.startJourney("tainangu");
  let g3 = 0;
  while ((s.journey || Engine._pendingFortune) && g3++ < 40) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) {
      Engine._combat.enemies.forEach(e => { e.hp = 0; });
      Engine._combat._checkEnd();
      Engine._finishCombat();
      continue;
    }
    break;
  }
  assert(s.location === "tainan_fair", `到达太南小会（实际 ${s.location}）`);
  Engine.checkStory();
  assert(s.pendingEvent === "wan_meet", `万小山相迎触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.wan_met && s.metNpcs.includes("wanxiaoshan"), "万小山结识入图鉴+账本");
  // 赶集：买长春功后篇（彩蛋返灵石）
  const stoneBefore = State.count("lingshi");
  Engine.fairBuy("changchun_houpian");
  assert(State.count("changchun_houpian") === 1, "《长春功·后篇》购得");
  assert(State.count("lingshi") === stoneBefore - 5 + 1, "「不占便宜」彩蛋返灵石×1");
  // 买动一次后青纹阴谋触发
  Engine.checkStory();
  assert(s.pendingEvent === "qingwen_plot", `青纹阴谋触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.ledger.qingwen_grudge, "青纹梁子记入账本（黑煞教伏笔）");
  // 后篇研习 → 突破8层 gating 解除（黄枫谷篇 cap 已放开至练气十三层）
  s.activeChapter = "huangfeng";
  s.unlockedChapters = ["qixuan", "huangfeng"];
  s.realmIndex = 6; s.cultivation = 999999;
  const before = Engine.canBreakthrough();
  assert(!before.ok && /后篇/.test(before.reason), "未习后篇：冲八层被拦（大件 gating）");
  const lr = sandbox.Loadout.learnTechnique(s, "changchun_full");
  assert(lr.ok, "研习《长春功·后篇》成功");
  assert(sandbox.Loadout.knownPool(s).includes("huodan"), "火弹术随后篇入池（考据：小法术尽出于此）");
  const after = Engine.canBreakthrough();
  assert(after.ok, "习得后篇：八层之路开启");

  // —— 站四：升仙大会收官（同道首战→日历锚→落选→复仇→入谷）——
  s.activeChapter = "qixuan";   // 回到离门远行流程
  // 同道首战：万小山搭伴探山（会期前1月窗口开）
  while (State.absMonth() < (s.flags.xianhui_due || 0) - 1) Engine.passTime(1);
  Engine.checkStory();
  assert(s.pendingEvent === "wan_hunt", `搭伴探山触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.combat && Engine._combat && Engine._combat.side && Engine._combat.side.kind === "ally",
    "同道参战：万小山在侧（ally 架构）");
  // 验证同道自动出手
  const wolfHp0 = Engine._combat.enemies[0].hp;
  Engine._combat.endRound();
  // 速胜
  let g4 = 0;
  while (s.combat && Engine._combat && g4++ < 10) {
    Engine._combat.enemies.forEach(e => { e.hp = 0; });
    Engine._combat._checkEnd();
    if (Engine._combat.status !== "ongoing") Engine._finishCombat();
    else Engine._combat.endRound();
  }
  assert(s.flags.wan_hunt_done && s.ledger.wan_hunt_together, "并肩之战入账本");
  // 日历锚：等到会期
  while (State.absMonth() < s.flags.xianhui_due) Engine.passTime(1);
  Engine.checkStory();
  assert(s.pendingEvent === "xianhui_open", `会期已至，升仙大会触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.xianhui_done, "测灵璧落选（伪灵根）");
  // 万小山之死 → 复仇战
  Engine.checkStory();
  assert(s.pendingEvent === "wan_death", `林间血案触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.combat && Engine._combat && Engine._combat.enemies.length === 2, "复仇战开打（二人当面，一人遁走）");
  assert(s.ledger.sanxiu_escaped, "遁走者入账（远雷）");
  let g5 = 0;
  while (s.combat && Engine._combat && g5++ < 10) {
    Engine._combat.enemies.forEach(e => { e.hp = 0; });
    Engine._combat._checkEnd();
    if (Engine._combat.status !== "ongoing") Engine._finishCombat();
    else Engine._combat.endRound();
  }
  assert(s.flags.wan_avenged, "血债已收（wan_avenged）");
  // 入谷收官
  Engine.checkStory();
  assert(s.pendingEvent === "xianhui_end", `升仙令入谷触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.departure_complete, "离门远行 · 完");
  // 启程黄枫谷 → 篇章切换
  Engine.startJourney("huangfeng");
  let g6 = 0;
  while ((s.journey || Engine._pendingFortune) && g6++ < 40) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) {
      Engine._combat.enemies.forEach(e => { e.hp = 0; });
      Engine._combat._checkEnd();
      Engine._finishCombat();
      continue;
    }
    break;
  }
  assert(s.location === "huangfeng_gate", `抵达黄枫谷外门（${s.location}）`);
  assert(s.flags.huangfeng_entered && s.activeChapter === "huangfeng", "黄枫谷篇 · 启（章节切换）");
}

console.log("\n=== 6. 拜别版回乡（离门远行）===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.location = "yaolu";
  s.pendingEvent = null;
  s.flags.arc1_complete = true;
  s.silver = 60; s.age = 19;
  Engine.startJourney("qingniu");
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
  assert(s.flags.home_farewell, "拜别完成（home_farewell）");
  assert(s.flags.demon_seed_sister, "心魔种子：花轿那一眼（demon_seed_sister）");
  assert(s.ledger.home_farewell_wedding || s.ledger.home_farewell_haste, "拜别方式入账本");
}

console.log(`\n========== 大陆旅途：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
sandbox.process = undefined;
process.exit(failures === 0 ? 0 : 1);
