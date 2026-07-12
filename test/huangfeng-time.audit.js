/* ============================================================
 * 黄枫谷时间预算审计：node test/huangfeng-time.audit.js
 * polish-huangfeng A1（GPT P0-1）——守三条线：
 *   a) 「百药园差事 × 小绿瓶嗑药 × 闭关」三管齐下的勤奋玩家，
 *      练气七层 → 练气十一层 ≤ 48 游戏月（修为墙不再是十余年）；
 *   b) ≥ 30 游戏月（不能快成无肝——大比日历锚 +30 月要有意义）；
 *   c) 长闭关分段推进世界：36 月闭关 _tickWorld 至少跑 12 拍
 *      （ambient/涟漪/NPC 命途的月度钩子逐段真跑，非一拍带过）。
 * 真引擎驱动（journey.test 同源 vm 沙箱）+ 种子化 RNG（结果可复现）。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const VERBOSE = process.argv.includes("-v");

// —— 种子化 RNG（LCG）：审计结果可复现，不随 Math.random 漂移 ——
let _seed = 1;
function rng() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; }
const seededMath = Object.create(Math);
seededMath.random = rng;

const store = {};
const sandbox = {
  console, Math: seededMath, Date,
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

for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/exploremap.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  const code = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  vm.runInContext(code, ctx, { filename: f });
}
const { State, Engine, Loadout, STORY, DATA } = sandbox;

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ 失败: " + msg); failures++; }
}

/* —— 黄枫谷入谷存档态（练气七层·百药园差事已领·小绿瓶在手）—— */
function makeEntrySave() {
  State.create("韩立", "si");                        // 四灵根（韩立资质档）
  const s = State.data;
  s.pendingEvent = null;
  s.realmIndex = 6; s.cultivation = 0;               // 练气七层·层内清零
  s.sense = 23; s.body = 20;                         // 六次小突破（+3/+2）后的合理面板
  s.hpMax = 190; s.hp = 190;
  s.spirit = State.realm().spMax;
  s.mood = 100; s.moodMax = 100; s.demon = 0;
  s.activeChapter = "huangfeng";
  s.unlockedChapters = ["qixuan", "huangfeng"];
  s.location = "huangfeng_gate";
  Object.assign(s.flags, {
    arc1_complete: true, departure_complete: true, huangfeng_entered: true,
    hf_arrived: true, yaoyuan_started: true,
  });
  s.flags.xueshi_due = State.absMonth() + 30;        // 血色禁地日历锚（hf_yaoyuan onArrive 同款）
  s.storyStage = STORY.findIndex(st => st.id === "jindi_meeting");
  State.give("changchun_houpian", 1);
  Loadout.learnTechnique(s, "changchun_full");        // 冲八层的大件门槛（太南小会已购）
  s.bottle.unlocked = true;
  Engine._ensurePlots();
  State.give("lingcao", 2);
  s.skills.alchemy = 8;                              // 七玄门篇采药/行医攒下的底子
  return s;
}

function drainPopups(s) {
  let g = 0;
  while (g++ < 8) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) {                // 心战等：勤奋玩家打赢（境界战力随修为）
      Engine._combat.enemies.forEach(e => { e.hp = 0; });
      Engine._combat._checkEnd();
      Engine._finishCombat();
      continue;
    }
    break;
  }
}

/* —— 勤奋玩家策略：药园攒种 × 小绿瓶滴灌嗑丹 × 长闭关，修满即冲关 —— */
function runDiligent(seed) {
  _seed = seed >>> 0;
  const s = makeEntrySave();
  const m0 = State.absMonth();
  const cap = 120;
  let acts = { yaoyuan: 0, cultivate: 0, rest: 0, breakthrough: 0 };
  let guard = 0;
  while (s.realmIndex < 10 && State.absMonth() - m0 < cap && guard++ < 900) {
    drainPopups(s);
    if (s.realmIndex >= 10) break;
    // 小绿瓶勤打理：熟即收且就地嗑丹；有种即栽
    (s.bottle.plots || []).forEach((p, i) => { if (p.crop && p.growth >= 100) Engine.harvestCrop(i, true); });
    (s.bottle.plots || []).forEach((p, i) => { if (!p.crop && State.count("lingcao") > 0) Engine.plantCrop(i, "lingcao"); });
    while (State.count("lingyao_dan") > 0 && s.realmIndex < 10) Engine.useItem("lingyao_dan");
    drainPopups(s);
    if (s.realmIndex >= 10) break;
    const realm = State.realm();
    // 修满即冲关（灵力/心魔先调到冲关状态——准备越足越稳）
    if (s.cultivation >= realm.culMax && Engine.canBreakthrough().ok) {
      if (s.spirit < realm.spMax * 0.85 || s.demon > 30) { Engine.rest(true); acts.rest++; continue; }
      acts.breakthrough++;
      Engine.attemptBreakthrough();
      drainPopups(s);
      continue;
    }
    // 种子告罄 → 去百药园干一月本分（例钱+灵草+药理）
    const freePlots = (s.bottle.plots || []).filter(p => !p.crop).length;
    if (State.count("lingcao") < 1 && freePlots > 0) {
      acts.yaoyuan++;
      Engine.yaoyuanWork();
      drainPopups(s);
      continue;
    }
    // 其余月份：闭关吐纳（半年一程·瓶中自动滴灌）
    acts.cultivate++;
    Engine.doCultivate(6);
    drainPopups(s);
  }
  return { months: State.absMonth() - m0, reached: s.realmIndex >= 10, acts, s };
}

console.log("\n=== 1. 修为曲线：练气七层 → 练气十一层（勤奋玩家·五种子）===");
{
  const SEEDS = [7, 42, 137, 1009, 20260712, 314159, 8888];
  const runs = SEEDS.map(sd => runDiligent(sd));
  runs.forEach((r, i) => {
    console.log(`    种子 ${SEEDS[i]}：${r.reached ? r.months + " 月" : "120 月未达（失败）"}` +
      `（闭关程 ${r.acts.cultivate}·药园 ${r.acts.yaoyuan}·冲关 ${r.acts.breakthrough}）`);
  });
  // 中位数（月数升序取中）——校准锚是"中位玩家 30~48 月"，个别种子的连败长尾由宽带兜
  const months = runs.map(r => r.months).sort((a, b) => a - b);
  const median = months[Math.floor(months.length / 2)];
  assert(runs.every(r => r.reached), "七种子全部修至练气十一层（无卡死）");
  assert(median <= 48, `中位耗时 ≤48 月（实测 ${median} 月）`);
  assert(median >= 30, `中位耗时 ≥30 月——不能快成无肝（实测 ${median} 月）`);
  // 最坏种子＝连吃冲关失败的欧皇反面——宽带守"不至于翻倍"（种子轨迹对代码改动敏感，勿卡死值）
  assert(months[months.length - 1] <= 72, `最坏种子 ≤72 月（实测 ${months[months.length - 1]} 月）`);
  // 主动行动数不为零：勤奋玩家的月份花在真行动上（药园/闭关/冲关都算）
  const acts0 = runs[0].acts;
  assert(acts0.yaoyuan > 0 && acts0.cultivate > 0 && acts0.breakthrough >= 4,
    `行动构成健康（药园 ${acts0.yaoyuan}·闭关程 ${acts0.cultivate}·冲关 ${acts0.breakthrough}≥4）`);
}

console.log("\n=== 2. 长闭关分段推进世界（A1②）===");
{
  _seed = 99;
  const s = makeEntrySave();
  let ticks = 0;
  const origTick = Engine._tickWorld;
  Engine._tickWorld = function (months) { ticks++; return origTick.call(this, months); };
  const m0 = State.absMonth();
  const newsBefore = (s.worldNews || []).length;
  Engine.doCultivate(36);
  drainPopups(s);
  Engine._tickWorld = origTick;
  const passed = State.absMonth() - m0;
  assert(passed >= 36, `36 月闭关光阴如实流逝（含途中调息共 ${passed} 月）`);
  assert(ticks >= Math.floor(passed / 3), `世界按 ≤3 月分段推进（${passed} 月里 tick 了 ${ticks} 拍，≥${Math.floor(passed / 3)}）`);
  const newsAfter = (s.worldNews || []).length;
  assert(newsAfter > newsBefore, `闭关期间世界仍在发生（风云录 +${newsAfter - newsBefore} 条——事件密度不为零）`);
}

console.log("\n=== 3. 名额大会日历锚（A1①）===");
{
  _seed = 5;
  const s = makeEntrySave();
  s.realmIndex = 10;                                  // 修为先到：等大比时节
  Engine.checkStory();
  assert(s.pendingEvent !== "jindi_meeting", "时节未至：名额大会不随到随开");
  while (State.absMonth() < s.flags.xueshi_due) Engine.passTime(1);
  Engine.checkStory();
  assert(s.pendingEvent === "jindi_meeting", `时节+修为齐备：名额大会开（${s.pendingEvent}）`);
}

console.log(failures ? `\n✗ ${failures} 项失败` : "\n✓ 黄枫谷时间预算审计全绿");
process.exit(failures ? 1 : 0);
