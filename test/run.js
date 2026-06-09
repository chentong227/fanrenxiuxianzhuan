/* ============================================================
 * 无头全流程测试：在 node 里模拟一局完整游玩，验证三幕剧情跑通。
 * 用法：node test/run.js
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

for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  const code = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  vm.runInContext(code, ctx, { filename: f });
}

const { State, Engine, STORY, DATA, Chapters } = sandbox;

// ---- 战斗自动驾驶 ----
function autopilotCombat() {
  let guard = 0;
  while (State.data.combat && guard++ < 300) {
    const cc = Engine._combat;
    if (!cc) break;
    const aff = cc.affordableSpells();
    if (aff.length) {
      const target = cc.enemies.findIndex(e => e.alive);
      const enemy = target >= 0 ? cc.enemies[target] : null;
      let choice = null;
      if (enemy) {
        const SP = sandbox.CombatAPI.SPELLS;
        if (cc.player.hp < cc.player.hpMax * 0.3 && aff.includes("tuna")) choice = "tuna";
        else if (enemy.soulOnly) choice = aff.find(id => SP[id].type === "soul") || null;
        else if (!enemy.immunePoison && !enemy.soulOnly && !enemy.status.poison && aff.includes("weidu")) choice = "weidu";
        else if (aff.includes("feizhen")) choice = "feizhen";
        else choice = aff.find(id => SP[id].type === "atk");
      }
      if (choice) { Engine.combatCast(choice, target); continue; }
    }
    Engine.combatEndRound();
  }
}

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("  ✓ " + msg); }
  else { console.log("  ✗ 失败: " + msg); failures++; }
}
function realm() { return DATA.realms[State.data.realmIndex]; }

console.log("\n=== 1. 建号（韩立·四灵根）===");
State.create("韩立", "si");
assert(State.data.name === "韩立", "道号为韩立");
assert(State.root().id === "si", "灵根为四灵根");
assert(State.data.realmIndex === 0, "起始练气一层");

console.log("\n=== 2. 开场剧情触发（第一幕·入门）===");
Engine.checkStory();
assert(State.data.pendingEvent === "village", "开场触发『青牛镇·韩家』");
let aguard = 0;
while (State.data.pendingEvent && !State.flag("met_modafu") && aguard++ < 8) {
  const st = STORY.find(x => x.id === State.data.pendingEvent);
  Engine.chooseStory(st, 0);
}
assert(State.flag("joined_sect"), "通过入门选拔");
assert(State.flag("met_modafu"), "已拜入墨大夫门下");

console.log("\n=== 3. 全流程模拟（闭关/历练/突破/小绿瓶/剧情）===");
const milestones = [];
function note(m) { if (!milestones.includes(m)) { milestones.push(m); console.log("    · " + m); } }

let guard = 0;
const MAX = 4000;
while (guard++ < MAX) {
  const s = State.data;
  if (s.flags.arc1_complete) break;
  if (s.combat) { autopilotCombat(); continue; }

  // NPC 主动来访：自动选第一个可用选项
  if (Engine._pendingInteraction || s._pendingInteraction) {
    const it = s._pendingInteraction;
    const built = sandbox.INTERACTIONS.build(it, s);
    let idx = built.choices.findIndex(c => !c.cond || c.cond(s));
    if (idx < 0) idx = built.choices.length - 1;
    Engine.chooseInteraction(idx);
    continue;
  }

  if (Engine._pendingFortune) {
    const f = Engine._pendingFortune;
    let idx = f.choices.findIndex(c => !c.cond || c.cond(s));
    if (idx < 0) idx = 0;
    Engine.chooseFortune(idx);
    continue;
  }

  // 开放世界导航：下一段主线条件已足但需特定地点，则前往
  if (!s.pendingEvent) {
    const next = STORY[s.storyStage];
    if (next && (!next.cond || next.cond(s)) && next.where && next.where !== s.location) {
      Engine.travelTo(next.where);
      continue;
    }
  }

  if (s.pendingEvent) {
    const stage = STORY.find(st => st.id === s.pendingEvent);
    note("剧情：" + stage.title);
    if (stage.id === "showdown" || stage.id === "jinguang_fight") {
      // 备足底牌（毒、暗器）再决战
      if (State.count("duyao_cao") < 3) { s.location = "houshan"; Engine.gather(); if (s.combat) autopilotCombat(); continue; }
      Engine.chooseStory(stage, 0);
      if (s.combat) autopilotCombat();
      continue;
    }
    Engine.chooseStory(stage, 0);
    continue;
  }

  // 灵力低 -> 调息
  if (s.spirit < realm().spMax * 0.5) { Engine.rest(true); Engine.checkStory(); continue; }

  // 临近突破：拉满状态再冲关
  const canBT = Engine.canBreakthrough();
  if (canBT.ok && s.cultivation >= realm().culMax * 0.95) {
    if (s.spirit < realm().spMax * 0.8) { Engine.rest(true); continue; }
    if (s.demon > 30) { Engine.rest(true); continue; }
    Engine.attemptBreakthrough();
    if (s.combat) autopilotCombat();
    note("尝试突破 -> " + realm().name);
    continue;
  }

  // 小绿瓶：种灵草催熟成灵药服食
  if (s.bottle.unlocked) {
    const empty = s.bottle.plots.findIndex(p => !p.crop);
    const ripe = s.bottle.plots.findIndex(p => p.crop && p.growth >= 100);
    if (ripe >= 0) { Engine.harvestCrop(ripe); continue; }
    if (empty >= 0 && State.count("lingcao") >= 1) { Engine.plantCrop(empty, "lingcao"); continue; }
    const growing = s.bottle.plots.some(p => p.crop && p.growth < 100);
    if (growing) { Engine.tendBottle(); continue; }
    if (State.count("lingyao_dan") >= 1) { Engine.useItem("lingyao_dan"); note("服食灵药精进"); continue; }
  }

  if (s.flags.showdown_ready && State.count("duyao_cao") < 1) { Engine.adventure(); if (s.combat) autopilotCombat(); continue; }

  if (guard % 4 === 0) { Engine.adventure(); if (s.combat) autopilotCombat(); }
  else Engine.cultivate(1);
  Engine.checkStory();
}

console.log("\n=== 4. 结局校验 ===");
assert(guard < MAX, `流程在 ${guard} 步内完成（未死循环）`);
assert(State.flag("modafu_dead"), "墨大夫已被反杀");
assert(State.flag("got_quhun"), "收服张铁尸傀（曲魂）");
assert(State.flag("jinguang_dead"), "击杀金光上人");
assert(State.flag("arc1_complete"), "七玄门篇通关");
assert(State.count("shengxian_ling") >= 1, "夺得升仙令");
assert(Chapters.isUnlocked("huangfeng"), "通关后解锁黄枫谷篇");
assert(State.data.realmIndex >= 3, `韩立达到练气四层以上（实际索引 ${State.data.realmIndex}）`);
assert(State.data.realmIndex <= Chapters.realmCap(), `境界封顶练气期（cap=${Chapters.realmCap()}, 实际=${State.data.realmIndex}）`);

console.log("\n=== 5. 边界：封顶后禁止继续突破 ===");
State.data.realmIndex = Chapters.realmCap();
State.data.cultivation = realm().culMax * 2;
assert(!Engine.canBreakthrough().ok, "达到本章封顶后，突破被拦截");

console.log("\n=== 存档/读档 ===");
State.save();
const before = JSON.stringify(State.data);
State.data = null;
State.load();
assert(JSON.stringify(State.data) === before, "存档读档数据一致");

console.log(`\n========== 结果：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
