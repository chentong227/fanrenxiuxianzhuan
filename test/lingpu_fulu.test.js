/* ============================================================
 * 周期7 阶段5 无头测试：随身灵圃 v2(D) + 符箓自制(C)
 *   node test/lingpu_fulu.test.js
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
function withRng(v, fn) { const o = Math.random; Math.random = () => v; try { fn(); } finally { Math.random = o; } }

console.log("\n=== D 随身灵圃 v2：多灵草谱 + 境界迁移 ===");
{
  // 数据层：旧三谱仍在，新增凝神/回元谱，且皆带 minRealmIdx
  const c = DATA.bottle.crops;
  assert(!!c.lingcao && c.lingcao.matureItem === "lingyao_dan", "灵草→灵药谱保留（autopilot 依赖）");
  assert(!!c.duyao_cao && !!c.qiannian, "毒草谱 / 千年灵草谱保留");
  assert(!!c.anshen && c.anshen.matureItem === "ningshen_dan", "新增谱：灵草→凝神丹（复用既有丹）");
  assert(!!c.huiyuan && c.huiyuan.matureItem === "huiyuan_dan", "新增谱：灵草→回元丹（战内底牌）");
  assert(Object.values(c).every(x => typeof x.minRealmIdx === "number"), "每谱皆有 minRealmIdx 境界门");
  assert((c.huiyuan.minRealmIdx || 0) > 0, "回元丹谱境界迁移：需更高境界方解");
}

// plantCrop：境界门——回元谱低境界种不下，达标可种
{
  State.create("韩立", "si");
  const s = State.data;
  Engine.unlockBottle();
  s.bottle.unlocked = true;
  s.realmIndex = 0;
  State.give("lingcao", 5);
  const before = State.count("lingcao");
  Engine.plantCrop(0, "huiyuan");
  assert(!s.bottle.plots[0].crop && State.count("lingcao") === before, "境界未到：回元谱无法种植，原料不扣");
  s.realmIndex = DATA.bottle.crops.huiyuan.minRealmIdx;
  Engine.plantCrop(0, "huiyuan");
  assert(s.bottle.plots[0].crop === "huiyuan" && State.count("lingcao") === before - 1, "境界达标：回元谱可种，扣灵草×1");
}

// 种—催—收全链（autopilot 依赖的 lingcao→lingyao_dan 仍工作）
{
  State.create("韩立", "si");
  const s = State.data;
  Engine.unlockBottle();
  s.bottle.unlocked = true;
  State.give("lingcao", 3);
  Engine.plantCrop(0, "lingcao");
  for (let i = 0; i < 5 && s.bottle.plots[0].growth < 100; i++) Engine.tendBottle();
  const yao0 = State.count("lingyao_dan");
  Engine.harvestCrop(0);
  assert(State.count("lingyao_dan") === yao0 + DATA.bottle.crops.lingcao.yield, "灵草谱：催熟满后收获灵乳灵药");
  assert(!s.bottle.plots[0].crop, "收获后地块清空");
}

// 凝神谱：灵草→凝神丹（gateFlag：须丹道里程碑「自炼凝神丹」参透后方可种）
{
  State.create("韩立", "si");
  const s = State.data;
  Engine.unlockBottle();
  s.bottle.unlocked = true;
  State.give("lingcao", 2);
  Engine.plantCrop(0, "anshen");
  assert(!s.bottle.plots[0].crop, "凝神谱未参透（gateFlag）：种不下");
  s.flags.dan_ms_anshen = true;   // 丹道熟练度 40 里程碑：参透凝神丹火候
  Engine.plantCrop(0, "anshen");
  for (let i = 0; i < 6 && s.bottle.plots[0].growth < 100; i++) Engine.tendBottle();
  const dan0 = State.count("ningshen_dan");
  Engine.harvestCrop(0);
  assert(State.count("ningshen_dan") === dan0 + 1, "凝神谱：催熟满后收获凝神丹");
}

console.log("\n=== C 符箓自制：方案 + 制符台 ===");
{
  assert(Object.keys(DATA.fuluPlans).length >= 3, "存在 ≥3 份符箓方案");
  assert(DATA.fuluPlans.dingshen_fu && DATA.fuluPlans.dingshen_fu.result === "dingshen_fu", "定身符方案→产定身符（既有底牌道具）");
  assert(Object.values(DATA.fuluPlans).every(p => DATA.items[p.result] && DATA.items[p.paper]), "方案的产物/符纸皆为既有道具（无凭空造物）");
}

// 建号即有空 fuluPlans + skills.fulu（不破存档）
{
  State.create("韩立", "si");
  assert(Array.isArray(State.data.fuluPlans) && State.data.fuluPlans.length === 0, "建号即有空 fuluPlans 列表");
  assert(State.data.skills && State.data.skills.fulu === 0, "建号即有 制符术熟练度=0");
}

// learnFuluPlan：解锁 + 去重
{
  State.create("韩立", "si");
  assert(Engine.learnFuluPlan("huoshe_fu") === true, "首次解锁火蛇符方案返回 true");
  assert(State.data.fuluPlans.includes("huoshe_fu"), "方案已记入 fuluPlans");
  assert(Engine.learnFuluPlan("huoshe_fu") === false, "重复解锁返回 false（去重）");
  assert((State.data.milestones || []).some(m => /火蛇符方案/.test(m.title)), "解锁方案写入道途年表");
}

// makeFulu：需制符笔；有方案+符纸+灵力即成（控 RNG 验成/败）
{
  State.create("韩立", "si");
  const s = State.data;
  Engine.learnFuluPlan("huoshe_fu");
  State.give("fu_zhi", 3);
  s.spirit = State.realm().spMax;
  // 无制符笔：制符台开不得
  const fu0 = State.count("huoshe_fu");
  Engine.makeFulu("huoshe_fu");
  assert(State.count("huoshe_fu") === fu0 && State.count("fu_zhi") === 3, "无制符笔：不可制符，不扣料");
  // 备制符笔后：强制 RNG 成功
  State.give("zhifu_bi", 1);
  const paper0 = State.count("fu_zhi"), sp0 = s.spirit, skill0 = s.skills.fulu;
  withRng(0, () => Engine.makeFulu("huoshe_fu"));
  assert(State.count("huoshe_fu") >= fu0 + 1, "成符：背包得火蛇符");
  assert(State.count("fu_zhi") === paper0 - 1, "成符：耗符纸×1");
  assert(s.spirit < sp0, "成符：耗灵力");
  assert(s.skills.fulu === skill0 + 2, "制符术熟练度+2");
  // 强制 RNG 失败：扣符纸、不得符
  const fuA = State.count("huoshe_fu"), paperA = State.count("fu_zhi");
  withRng(0.999, () => Engine.makeFulu("huoshe_fu"));
  assert(State.count("huoshe_fu") === fuA, "失败：不得符");
  assert(State.count("fu_zhi") === paperA - 1, "失败：符纸照样作废");
}

console.log("\n=== C 解锁源：购买 / 图鉴 ===");
{
  // 太南小会购符谱：花灵石、解锁方案、非入袋
  State.create("韩立", "si");
  const s = State.data;
  const g = Engine.FAIR_GOODS.find(x => x.plan === "huoshe_fu");
  assert(!!g && g.once, "太南小会上架火蛇符符谱（once）");
  State.give("lingshi", g.price);
  Engine.fairBuy(g.id);
  assert(s.fuluPlans.includes("huoshe_fu"), "购符谱即解锁方案");
  assert(State.count("huoshe_fu") === 0, "购符谱不入背包（方案≠成品符）");
  // 现成符仍可买（成品符照旧）
  const gd = Engine.FAIR_GOODS.find(x => x.buy === "huoshe_fu");
  assert(!!gd, "现成火蛇符仍在售（既有买符照旧）");
  State.give("lingshi", gd.price);
  const fu0 = State.count("huoshe_fu");
  Engine.fairBuy(gd.id);
  assert(State.count("huoshe_fu") === fu0 + 1, "购现成符：入背包");
}

// 大件图鉴：符箓类 + 每方案一条目 + 制符台锚点
{
  assert(WORLD.bigitemCats.some(c => c.id === "fulu"), "大件图鉴新增「符箓·方案」类");
  assert(WORLD.bigitems.some(b => b.id === "zhifu" && b.cat === "fulu"), "图鉴含制符台锚点条目");
  Object.keys(DATA.fuluPlans).forEach(id => {
    assert(WORLD.bigitems.some(b => b.id === "plan_" + id), `图鉴含方案条目：${id}`);
  });
  // 方案条目状态随解锁点亮
  State.create("韩立", "si");
  const entry = WORLD.bigitems.find(b => b.id === "plan_huoshe_fu");
  assert(entry.stat(State.data).state === "unheard", "未解锁：方案条目=未闻");
  Engine.learnFuluPlan("huoshe_fu");
  assert(entry.stat(State.data).state === "got", "解锁后：方案条目=已得");
}

console.log("\n=== 不破存档：老档惰性兜底 ===");
{
  // 模拟无 bottle / 无 fuluPlans / skills 缺 fulu 的老档
  State.create("韩立", "si");
  delete State.data.bottle;
  delete State.data.fuluPlans;
  State.data.skills = { alchemy: 4, scouting: 2 };
  State._migrate();
  assert(State.data.bottle && Array.isArray(State.data.bottle.plots), "老档补出 bottle 结构");
  assert(Array.isArray(State.data.fuluPlans), "老档补出 fuluPlans");
  assert(State.data.skills.fulu === 0, "老档补出 制符术熟练度");
  assert(State.data.skills.alchemy === 4, "既有熟练度不被覆盖");
}

console.log(`\n========== 阶段5 灵圃/符箓：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
