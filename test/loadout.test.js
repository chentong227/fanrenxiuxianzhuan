/* ============================================================
 * 功法配装无头测试：node test/loadout.test.js
 * 习得/主修/辅修/技能槽(随境界)/辅修打折
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
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/combat.js", "js/explore.js", "js/loadout.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, Engine, Loadout, Balance, DATA, Chapters, CombatAPI } = sandbox;

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }

console.log("\n=== 1. 起始配装：主修长春功，技能已装备 ===");
{
  State.create("韩立", "si");
  const s = State.data;
  assert(s.technique === "changchun", "主修为长春功");
  assert((s.learnedTechniques || []).includes("changchun"), "已习得长春功");
  assert(s.spells.length > 0, "起始有出战技能");
  assert(Loadout.knownPool(s).includes("zhayan"), "技能池含眨眼剑法");
}

console.log("\n=== 2. 法术槽恒8 / 辅修槽随境界增多 ===");
{
  assert(Balance.skillSlots() === 8, `出战法术槽恒 8（${Balance.skillSlots()}）——v103 用户裁决：单屏 4×2、取舍即构筑、不随境界膨胀`);
  assert(Balance.secondaryTechniqueSlots(0) < Balance.secondaryTechniqueSlots(2), "辅修槽随境界增多");
}

console.log("\n=== 3. 习得新功法 → 可设主修/辅修 ===");
{
  State.create("韩立", "si");
  const s = State.data;
  // 解锁一个测试用功法（直接学，绕过锁定）
  DATA.techniques.qingyuan_sword.locked = false;
  const r = Loadout.learnTechnique(s, "qingyuan_sword");
  assert(r.ok, "可习得已解锁的功法");
  assert(Loadout.isLearned(s, "qingyuan_sword"), "习得记录正确");
  const r2 = Loadout.addAux(s, "qingyuan_sword");
  assert(r2.ok, "可设为辅修");
  assert((s.auxTechniques || []).includes("qingyuan_sword"), "辅修记录正确");
  // 设为主修后，旧主修转辅修
  Loadout.setMain(s, "qingyuan_sword");
  assert(s.technique === "qingyuan_sword", "新主修生效");
  assert(!(s.auxTechniques || []).includes("qingyuan_sword"), "主修不在辅修列");
  DATA.techniques.qingyuan_sword.locked = true; // 还原
}

console.log("\n=== 4. 辅修槽位上限约束 ===");
{
  State.create("韩立", "si");
  const s = State.data;
  // 伪造若干已习功法
  s.learnedTechniques = ["changchun", "t_a", "t_b", "t_c"];
  DATA.techniques.t_a = { name: "甲诀", grade: 1, grantSpells: [] };
  DATA.techniques.t_b = { name: "乙诀", grade: 1, grantSpells: [] };
  DATA.techniques.t_c = { name: "丙诀", grade: 1, grantSpells: [] };
  const cap = Loadout.auxCap(s);
  let added = 0;
  ["t_a", "t_b", "t_c"].forEach(t => { if (Loadout.addAux(s, t).ok) added++; });
  assert(added === cap, `辅修数量受上限约束（上限 ${cap}，成功加 ${added}）`);
  delete DATA.techniques.t_a; delete DATA.techniques.t_b; delete DATA.techniques.t_c;
}

console.log("\n=== 5. 技能槽上限：装满后不可再装 ===");
{
  State.create("韩立", "si");
  const s = State.data;
  const cap = Loadout.skillCap(s);
  // 清空再逐一装备技能池
  s.spells = [];
  const pool = Loadout.knownPool(s);
  let on = 0;
  pool.forEach(sk => { if (Loadout.equipSkill(s, sk).ok) on++; });
  assert(on <= cap, `装备数不超过技能槽上限（${on} ≤ ${cap}）`);
  assert(s.spells.length === on, "出战技能数与装备数一致");
}

console.log("\n=== 6. 辅修技能战斗打折（×auxMul）===");
{
  State.create("韩立", "si");
  const s = State.data;
  // 构造：眨眼剑法作为"辅修技能"，比较有/无 auxSkills 的伤害
  const SP = CombatAPI.SPELLS;
  const mk = (aux) => new CombatAPI.Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0,
    spells: ["zhayan"], grade: 1, realmTier: 0, auxSkills: aux ? ["zhayan"] : [] });
  function hit(fighter) {
    const c = new CombatAPI.Combat({ player: fighter, enemies: [{ name: "桩", hp: 9999, agility: 0, speed: 10, mp: 0 }], rng: () => 0.99 });
    c.startRound();
    // v87 法力池：旧 c.qi.jin 已废（眨眼剑法 mp:0 武学，给满灵力无副作用）；
    // 对阵轴 v2：贴身武学需排进射程——眨眼剑法 range[1,1]，故置距 1
    c.player.mp = c.player.mpMax; c.player.pos = 2; c.enemies[0].pos = 3;
    const hp0 = c.enemies[0].hp;
    c.cast("zhayan", 0);
    return hp0 - c.enemies[0].hp;
  }
  const full = hit(mk(false));
  const auxed = hit(mk(true));
  assert(auxed < full, `辅修技能伤害被打折（主修 ${full} > 辅修 ${auxed}）`);
}

console.log("\n=== 7. 研习功法消耗时间并入库 ===");
{
  State.create("韩立", "si");
  const s = State.data;
  DATA.techniques.qingyuan_sword.locked = false;
  DATA.techniques.qingyuan_sword.book = "qy_book";
  State.give("qy_book", 1);
  const m0 = State.absMonth();
  Engine.studyTechnique("qingyuan_sword");
  assert(Loadout.isLearned(s, "qingyuan_sword"), "研习后习得功法");
  assert(State.absMonth() > m0, "研习消耗了光阴");
  DATA.techniques.qingyuan_sword.locked = true; delete DATA.techniques.qingyuan_sword.book;
}

console.log(`\n========== 功法配装：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
