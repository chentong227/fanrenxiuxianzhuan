/* ============================================================
 * 大件依赖图守恒 + 妖王客观恒在 无头测试：node test/bigitem_depgraph.test.js
 *  (1) docs/lore-大件依赖图.md 主表 id 集合 ≡ WORLD.bigitems id 集合（双向守恒）
 *  (2) 每件大件 guide（第一链如何触发）非空
 *  (3) 客观恒在：beastHabitat 栖地无异闻也可遇妖王；异闻=名实一致+预知；slain 排除；非栖地不受牵动
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
const { State, Engine, WORLD, DATA } = sandbox;

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }

// —— 取本次探索的"最深一格(妖王位)"敌人 ——
function bossEnemy(expl) {
  if (!expl) return null;
  if (expl.farMark) { const c = expl.cells[expl.farMark.y * expl.w + expl.farMark.x]; return c ? (c.enemy || null) : null; }
  const bc = expl.cells.find(c => c && c.content === "boss");
  return bc ? (bc.enemy || null) : null;
}
function foreknownLog(expl) { return !!(expl && expl.log && expl.log.some(l => l.includes("异闻在耳"))); }

console.log("\n=== 1. 依赖图 ↔ WORLD.bigitems 守恒 ===");
{
  const doc = fs.readFileSync(path.join(__dirname, "..", "docs", "lore-大件依赖图.md"), "utf8");
  const docIds = new Set();
  for (const line of doc.split(/\r?\n/)) {
    const m = line.match(/^\|\s*`([a-z_]+)`\s*\|/);
    if (m) docIds.add(m[1]);
  }
  const codeIds = new Set(WORLD.bigitems.map(b => b.id));
  const missingInDoc = [...codeIds].filter(id => !docIds.has(id));
  const extraInDoc = [...docIds].filter(id => !codeIds.has(id));
  assert(missingInDoc.length === 0, "WORLD.bigitems 每件都在依赖图主表（漏：" + (missingInDoc.join("、") || "无") + "）");
  assert(extraInDoc.length === 0, "依赖图主表无多余 id（多：" + (extraInDoc.join("、") || "无") + "）");
  assert(docIds.size === codeIds.size, "主表 id 数量与 WORLD.bigitems 一致（doc=" + docIds.size + " code=" + codeIds.size + "，在途件单列〔一·附〕不计）");
}

console.log("\n=== 2. 每件大件 guide（第一链入口引导）非空 ===");
{
  const empty = WORLD.bigitems.filter(b => !b.guide || !String(b.guide).trim()).map(b => b.id);
  assert(empty.length === 0, "每件大件 guide 非空（空：" + (empty.join("、") || "无") + "）");
}

console.log("\n=== 3. 妖王客观恒在（engine.enterExplore）===");
{
  const beastIds = WORLD.beastRumors.map(r => r.id);
  const site = DATA.exploreSites.houshan_explore;
  assert(site && site.beastHabitat === true, "houshan_explore 标记为妖王栖地 beastHabitat");

  const origChance = site.beastHabitatChance;

  // 3a. 无异闻 + 栖地必出(chance=1)：深处 boss = 客观盘踞的某头异闻妖王（撞见即知，无预知语）
  site.beastHabitatChance = 1;
  let allBeast = true, anyForeknown = false;
  for (let i = 0; i < 24; i++) {
    State.create("韩立", "si");
    State.data.beastRumor = null; State.data.slainBeasts = [];
    Engine.enterExplore("houshan_explore");
    const be = bossEnemy(State.data.explore);
    if (!beastIds.includes(be)) allBeast = false;
    if (foreknownLog(State.data.explore)) anyForeknown = true;
  }
  assert(allBeast, "无异闻·栖地必出 → 深处即客观盘踞的异闻妖王（24/24）");
  assert(!anyForeknown, "无异闻 → 不弹「异闻在耳」预知语（撞见即知）");

  // 3b. 无异闻 + 栖地不出(chance=0)：深处仍是寻常散修 rogue_cultivator
  site.beastHabitatChance = 0;
  let allRogue = true;
  for (let i = 0; i < 24; i++) {
    State.create("韩立", "si");
    State.data.beastRumor = null; State.data.slainBeasts = [];
    Engine.enterExplore("houshan_explore");
    if (bossEnemy(State.data.explore) !== "rogue_cultivator") allRogue = false;
  }
  assert(allRogue, "无异闻·未撞见 → 深处寻常散修（24/24 rogue_cultivator）");

  // 3c. 身负异闻：名实一致（深处必是异闻那一头）+ 预知语
  site.beastHabitatChance = 0; // 即便撞见概率为0，异闻在身仍名实一致
  let nameMatch = true, foreknownOK = true;
  for (let i = 0; i < 12; i++) {
    State.create("韩立", "si");
    State.data.slainBeasts = [];
    State.data.beastRumor = "beast_chimu";
    Engine.enterExplore("houshan_explore");
    if (bossEnemy(State.data.explore) !== "beast_chimu") nameMatch = false;
    if (!foreknownLog(State.data.explore)) foreknownOK = false;
  }
  assert(nameMatch, "身负异闻 → 深处名实一致（即 beast_chimu）");
  assert(foreknownOK, "身负异闻 → 弹「异闻在耳」预知语");

  // 3d. 已伏诛排除：三头皆 slain（含当前异闻那头）→ 池空 → 退回寻常散修，无预知语
  site.beastHabitatChance = 1;
  let slainExcluded = true, noForeknown = true;
  for (let i = 0; i < 24; i++) {
    State.create("韩立", "si");
    State.data.slainBeasts = beastIds.slice();
    State.data.beastRumor = "beast_baihu"; // 已伏诛者即便挂在异闻位也不再名实一致
    Engine.enterExplore("houshan_explore");
    if (bossEnemy(State.data.explore) !== "rogue_cultivator") slainExcluded = false;
    if (foreknownLog(State.data.explore)) noForeknown = false;
  }
  assert(slainExcluded, "已伏诛妖王退出栖地池（24/24 退回散修）");
  assert(noForeknown, "已伏诛者不再触发预知语");

  site.beastHabitatChance = origChance;

  // 3e. 非栖地点不受异闻牵动：血色禁地自带 boss=mojiao，异闻在身也不会被顶替
  let mojiaoKept = true, jindiNoForeknown = true;
  for (let i = 0; i < 12; i++) {
    State.create("韩立", "si");
    State.data.slainBeasts = [];
    State.data.beastRumor = "beast_chimu"; // 异闻在身
    Engine.enterExplore("xueshi_jindi");
    if (bossEnemy(State.data.explore) !== "mojiao") mojiaoKept = false;
    if (foreknownLog(State.data.explore)) jindiNoForeknown = false;
  }
  assert(mojiaoKept, "非栖地（血色禁地）保留自带 boss=mojiao，不被异闻顶替");
  assert(jindiNoForeknown, "非栖地不弹栖地预知语");
}

console.log(`\n========== 大件依赖图守恒 + 客观恒在：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
