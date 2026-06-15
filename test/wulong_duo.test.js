/* ============================================================
 * 乌龙夺无头测试：node test/wulong_duo.test.js
 * 妖材→法宝链首件落地：墨蛟双角 → 元武国巧匠齐云霄代炼的四爪毒法宝
 * 覆盖：物品/法器/战斗技/攻击带毒/四段/毒免疫/大件链拆分/炼器剧情节点/装备授技
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

for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/exploremap.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}

const { State, Engine, WORLD, DATA, STORY, CombatAPI } = sandbox;
const { Fighter, Combat, SPELLS } = CombatAPI;

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ 失败: " + msg); failures++; }
}
const noCrit = () => 0.99;   // 永不暴击/不闪避
function mkHan(extra) {
  return new Fighter(Object.assign({
    name: "韩立", hp: 120, mp: 99, qiLayer: 11, team: "player", move: 1, speed: 12,
    insight: 0, agility: 0, spells: ["wulong_zhua"],
  }, extra || {}));
}
function dummy(extra) {
  return Object.assign({ name: "木桩", hp: 300, agility: 0, speed: 10, atk: 0, atkName: "发呆", mp: 60 }, extra || {});
}

console.log("\n=== 1. 物品 & 法器落地（墨蛟双角 → 四爪毒法宝）===");
{
  const it = DATA.items.wulong_duo;
  assert(it && it.type === "gear" && it.rarity === "epic", "DATA.items.wulong_duo 为 epic 法器物品");
  const g = DATA.gear.wulong_duo;
  assert(g && g.slot === "weapon", "DATA.gear.wulong_duo 占主攻位（weapon）");
  assert(g.minLayer === 11, "驱使门槛练气十一层（minLayer 11）");
  assert(Array.isArray(g.grantSpells) && g.grantSpells.includes("wulong_zhua"), "装备授予战斗技 wulong_zhua");
  assert(Array.isArray(g.traits) && g.traits.some(t => t.id === "venom_claw"), "带「墨蛟毒爪」特性（venom_claw）");
}

console.log("\n=== 2. 战斗技 wulong_zhua 配置（四爪·带毒·御物）===");
{
  const sp = SPELLS.wulong_zhua;
  assert(sp && sp.type === "atk", "乌龙夺为攻击技");
  assert(sp.fixedSegs === 4, "四爪连抓：固定四段（fixedSegs 4）");
  assert(sp.poison && sp.poison.dmg === 8 && sp.poison.turns === 3, "爪尖淬毒：命中上中毒(8/回合×3)");
  assert(sp.source === "treasure", "御物之技（source treasure）");
  assert(sp.elem === "shui", "墨蛟水行妖力（elem shui）");
  assert(!sp.pierce, "非破甲（与巨剑斩破甲区分）");
}

console.log("\n=== 3. 攻击带毒：四爪命中即上毒（通用 rider）===");
{
  const c = new Combat({ player: mkHan(), enemies: [dummy()], rng: noCrit });
  c.startRound();
  c.player.pos = 2; c.enemies[0].pos = 4;   // 距2：程[1,3]内、非贴身
  const hp0 = c.enemies[0].hp;
  const r = c.cast("wulong_zhua", 0);
  assert(r.ok, "乌龙夺施放成功");
  assert(hp0 - c.enemies[0].hp > 0, `造成伤害（-${hp0 - c.enemies[0].hp}）`);
  const p = c.enemies[0].status.poison;
  assert(p && p.dmg === 8 && p.turns === 3, "命中后敌中毒(8/回合×3)——攻击带毒兑现");
}

console.log("\n=== 4. 毒免疫：死物百毒不侵 / 元神无形 ===");
{
  const c1 = new Combat({ player: mkHan(), enemies: [dummy({ name: "尸傀", nature: "corpse" })], rng: noCrit });
  c1.startRound(); c1.player.pos = 2; c1.enemies[0].pos = 4;
  c1.cast("wulong_zhua", 0);
  assert(!c1.enemies[0].status.poison, "死物（corpse）百毒不侵：乌龙夺之毒不上身");
  const c2 = new Combat({ player: mkHan(), enemies: [dummy({ name: "阴魂", nature: "ghost", hp: 200 })], rng: noCrit });
  c2.startRound(); c2.player.pos = 2; c2.enemies[0].pos = 4;
  c2.cast("wulong_zhua", 0);
  assert(!c2.enemies[0].status.poison, "元神无形（ghost）：毒物无处着力");
}

console.log("\n=== 5. 大件链拆分（乌龙夺即取 / 神风舟同期落地·非 far）===");
{
  const wl = WORLD.bigitems.find(b => b.id === "wulongduo");
  assert(wl && !wl.far && wl.cat === "fabao", "乌龙夺为非 far 法宝大件（血色禁地即可炼）");
  const sf = WORLD.bigitems.find(b => b.id === "shenfengzhou");
  assert(sf && !sf.far && sf.name === "神风舟" && sf.cat === "fabao", "神风舟已由 far 转可炼（非 far·同出墨蛟一身）");
  assert(typeof sf.stat === "function", "神风舟带可达性 stat 追踪器（非占位 unheard）");
}

console.log("\n=== 6. 炼器剧情节点 wulong_forge：非阻塞铁律（skipIf ≡ !cond）===");
{
  const node = STORY.find(x => x.id === "wulong_forge");
  assert(!!node, "STORY 含 wulong_forge 节点");
  // 顺序流非阻塞：任何状态下都不能出现 skipIf=false 且 cond=false（否则卡死主线）
  let allComplementary = true;
  const realCount = State.count;
  for (const forged of [false, true]) for (const slain of [false, true]) for (const horn of [0, 1, 2]) {
    const s = { flags: { wulong_forged: forged, mojiao_slain: slain } };
    State.count = (id) => (id === "mojiao_jiao" ? horn : 0);
    const skip = node.skipIf(s), can = node.cond(s);
    if (skip === can) allComplementary = false;   // 应当永远互补
  }
  State.count = realCount;
  assert(allComplementary, "skipIf 与 cond 严格互补 → 永不卡死顺序流");
}

console.log("\n=== 7. 炼器+装备授技：消蛟角 → 得乌龙夺 → 佩之授「乌龙夺」===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.pendingEvent = null;
  s.realmIndex = 12;   // 练气十三层（驱使门槛 11 层达标）
  State.setFlag("mojiao_slain");
  State.give("mojiao_jiao", 2);
  const node = STORY.find(x => x.id === "wulong_forge");
  assert(node.skipIf(s) === false && node.cond(s) === true, "蛟角在手且未炼：节点应触发");
  const hornBefore = State.count("mojiao_jiao");
  node.onArrive(s);
  assert(s.flags.wulong_forged, "炼成 flag 置位（wulong_forged）");
  assert(State.count("wulong_duo") === 1, `乌龙夺入囊（${State.count("wulong_duo")}）`);
  assert(State.count("mojiao_jiao") === hornBefore - 1, "炼器消耗一只蛟角");
  Engine.equipGear("wulong_duo");
  assert(s.gear.weapon === "wulong_duo", "乌龙夺佩为主攻位");
  assert(Engine.playerFighter().spells.includes("wulong_zhua"), "装备授予战斗技「乌龙夺」入战");
}

console.log("\n=== 8. 神风舟炼器节点 shenfengzhou_forge：非阻塞铁律（skipIf ≡ !cond）===");
{
  const node = STORY.find(x => x.id === "shenfengzhou_forge");
  assert(!!node, "STORY 含 shenfengzhou_forge 节点（神风舟落地）");
  // 顺序流非阻塞：任何状态下都不能出现 skipIf=false 且 cond=false（否则卡死主线）
  let allComplementary = true;
  const realCount = State.count;
  for (const forged of [false, true]) for (const slain of [false, true]) for (const pi of [0, 1]) for (const lin of [0, 1, 3]) {
    const s = { flags: { shenfengzhou_forged: forged, mojiao_slain: slain } };
    State.count = (id) => (id === "mojiao_pi" ? pi : id === "mojiao_lin" ? lin : 0);
    if (node.skipIf(s) === node.cond(s)) allComplementary = false;   // 应当永远互补
  }
  State.count = realCount;
  assert(allComplementary, "skipIf 与 cond 严格互补 → 永不卡死顺序流");
}

console.log("\n=== 9. 神风舟炼器+授舟：消蛟皮·鳞 → 给神风舟（飞行法器）→ 结识齐云霄 ===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.pendingEvent = null;
  s.realmIndex = 3;   // 练气期（神风舟仅旅途载具，不限驱使境界；战斗飞行另由筑基后解锁）
  State.setFlag("mojiao_slain");
  State.give("mojiao_pi", 1);
  State.give("mojiao_lin", 3);
  const node = STORY.find(x => x.id === "shenfengzhou_forge");
  assert(node.skipIf(s) === false && node.cond(s) === true, "蛟皮·鳞在手且未炼：节点应触发");
  const piBefore = State.count("mojiao_pi"), linBefore = State.count("mojiao_lin");
  node.onArrive(s);
  assert(s.flightId === "shen_feng_zhou", `神风舟入手并换乘（flightId=${s.flightId}）`);
  assert(s.flags.shenfengzhou_forged === true, "炼成 flag 置位（shenfengzhou_forged）");
  assert(s.flags.met_qiyunxiao === true, "结识齐云霄 flag 置位（met_qiyunxiao·两件法宝共用这场结识）");
  assert(State.count("mojiao_pi") === piBefore - 1 && State.count("mojiao_lin") === linBefore - 1, "炼器消耗墨蛟皮×1、鳞×1");
  assert(State.flightTreasure().name === "神风舟" && State.flightTreasure().speedBonus === 30, "神风舟生效：遁速+30（飞行法器）");
  const sf = WORLD.bigitems.find(b => b.id === "shenfengzhou");
  assert(sf.stat(s).state === "got", "图鉴可达性：神风舟标记为「已炼成」");
}

console.log("\n=== 10. flight-ladder：神风舟为旅途载具，练气期不参战（无战斗飞行）===");
{
  // 飞行法宝只影响遁速（overworld），战斗飞行另由 s.flags.fly_unlocked / gearTrait('fly') 闸门
  const sfz = DATA.flightTreasures.shen_feng_zhou;
  assert(sfz && !(sfz.traits || []).some(t => t.id === "fly"), "神风舟不带 fly 战斗飞行特性（练气期仅旅途、不参战）");
}

console.log(`\n========== 乌龙夺·神风舟：${failures === 0 ? "全通 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
