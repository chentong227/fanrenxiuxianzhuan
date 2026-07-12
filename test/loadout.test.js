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

console.log("\n=== 8. 跨境界法器驱使门槛：筑基后仍能驭练气十一层顶阶法器 ===");
{
  State.create("韩立", "si");
  const s = State.data;
  const qiTop = DATA.realms.findIndex(r => r.tier === "qi" && r.layer === 11);
  const fdIdx = DATA.realms.findIndex(r => r.tier && r.tier !== "qi");
  assert(qiTop >= 0 && fdIdx >= 0, "存在练气十一层与筑基境界节点");
  // 练气十一层：gateLayer = 该层层数，可驭 minLayer 11 法器
  s.realmIndex = qiTop;
  assert(State.gateLayer() === 11, `练气十一层 gateLayer=层数（${State.gateLayer()}）`);
  State.give("jinfuzi_ren", 1);
  Engine.equipGear("jinfuzi_ren");
  assert(s.gear.weapon === "jinfuzi_ren", "练气十一层可装备万宝楼顶阶法器");
  // 筑基初期：layer 归 1，但 gateLayer 视作远超练气全层，法器不应失效
  s.realmIndex = fdIdx;
  assert((DATA.realms[fdIdx].layer || 1) < 11, "筑基节点 layer 已归 1（正是历史误判之源）");
  assert(State.gateLayer() >= 11, `筑基 gateLayer 远超练气门槛（${State.gateLayer()}）`);
  assert(!!State.gearOf("weapon"), "筑基后已装法器仍可驱使（gearOf 不返回 null）");
  Engine.unequipGear("weapon", true);
  Engine.equipGear("jinfuzi_ren");
  assert(s.gear.weapon === "jinfuzi_ren", "筑基后亦可重新装备练气十一层法器");
}

console.log("\n=== 9. 黄枫谷入谷起步法器：外门铁剑（练气即可驭 + grantSpell 入战斗手牌）===");
{
  // 9a. 数据完整性
  const gear = DATA.gear.waimen_tiejian;
  assert(!!gear && gear.slot === "weapon", "DATA.gear.waimen_tiejian 存在且为主攻位");
  assert(gear && gear.minLayer === 1, `外门铁剑 minLayer=1（练气期即可驭，实为 ${gear && gear.minLayer}）`);
  assert(gear && (gear.grantSpells || []).includes("tiejian_ci"), "外门铁剑 grantSpells 含「御剑刺」tiejian_ci");
  assert(!!DATA.items.waimen_tiejian, "DATA.items.waimen_tiejian 道具条目存在");
  assert(!!CombatAPI.SPELLS.tiejian_ci, "combat.js SPELLS 定义了「御剑刺」tiejian_ci");

  // 9b. 练气七层装备 → grantSpell 进战斗手牌
  State.create("韩立", "si");
  const s = State.data;
  const qi7 = DATA.realms.findIndex(r => r.tier === "qi" && r.layer === 7);
  assert(qi7 >= 0, "存在练气七层境界节点");
  s.realmIndex = qi7;
  assert(State.gateLayer() >= 1, `练气七层 gateLayer≥1，足以驭 minLayer-1 法器（${State.gateLayer()}）`);
  State.give("waimen_tiejian", 1);
  Engine.equipGear("waimen_tiejian");
  assert(s.gear.weapon === "waimen_tiejian", "练气七层可装备外门铁剑");
  assert(Engine.playerFighter().spells.includes("tiejian_ci"), "外门铁剑授予的「御剑刺」进入战斗手牌");

  // 9c. 入谷剧情点 hf_arrive 自动发放：青叶法器(flight) + 外门铁剑(战斗) 一并到手并装备
  State.create("韩立", "si");
  const s2 = State.data;
  const hf = sandbox.STORY.find(p => p.id === "hf_arrive");
  assert(!!hf && typeof hf.onArrive === "function", "story.js 存在 hf_arrive 且有 onArrive");
  hf.onArrive(s2);
  assert(s2.flightId === "qingye_fazhan", "入谷自动发放飞行法器·青叶法器（s.flightId）");
  assert(State.count("waimen_tiejian") > 0, "入谷自动发放战斗法器·外门铁剑（入库）");
  assert(s2.gear.weapon === "waimen_tiejian", "外门铁剑入谷自动装上空置的主攻位");
}

console.log("\n=== 10. 元武国·齐云霄代工（增量C：一炉三件大件发放 + 增量B 立项守护）===");
{
  // 10a. 乌龙夺：DATA.items + DATA.gear + combat SPELLS 三件套齐备（继金蚨子母刃后的筑基主战）
  assert(!!DATA.items.wulong_duo && DATA.items.wulong_duo.type === "gear", "DATA.items.wulong_duo 道具条目存在（type:gear）");
  const wg = DATA.gear.wulong_duo;
  assert(!!wg && wg.slot === "weapon" && (wg.grantSpells || []).includes("wulong_zhua"), "DATA.gear.wulong_duo 主攻位且 grantSpells 含「乌龙夺」(spell id: wulong_zhua)");
  const ws = CombatAPI.SPELLS.wulong_zhua;
  assert(!!ws && ws.source === "treasure" && ws.type === "atk", "combat.js SPELLS 定义「乌龙夺」（御物·攻击）");
  // 非本命（本命=青竹蜂云剑）；练气十一层即可驱使（minLayer:11），无 driveRealm 门槛
  assert(ws && !ws.natal, "乌龙夺非本命（本命=青竹蜂云剑）");
  // 10b. 颠倒五行阵基础版：齐云霄千年灵草线（魔道篇加强为完整版）
  assert(!!DATA.items.wuxing_zhen, "DATA.items.wuxing_zhen 颠倒五行阵图（基础版）道具条目存在");
  // 10c. 代工 story 节点：一炉三件实发 + 墨蛟料/千年灵草实扣 + 首访不遇辛如音（增量C）
  const node = sandbox.STORY.find(x => x.id === "qiyunxiao_daigong");
  assert(!!node && node.where === "yuanwu", 'story 节点 qiyunxiao_daigong 存在且 where:"yuanwu"（地点门禁）');
  {
    State.create("韩立", "si");
    const s3 = State.data;
    s3.flags.dongfu_done = true;
    State.give("mojiao_jiao", 1); State.give("mojiao_pi", 1); State.give("mojiao_lin", 1); State.give("qiannian_lingcao", 1);
    node.onArrive(s3);
    assert((s3.metNpcs || []).includes("qiyunxiao"), "代工·onArrive 录入齐云霄（人物图鉴）");
    assert(!(s3.metNpcs || []).includes("xinruyin"), "代工·首访不遇辛如音（未录入 xinruyin）");
    node.choices[0].effect(s3);
    assert(State.count("wulong_duo") === 1, "代工发放·乌龙夺×1");
    assert(s3.flightId === "shen_feng_zhou", "代工发放·神风舟（s.flightId=shen_feng_zhou）");
    assert(State.count("wuxing_zhen") === 1, "代工发放·颠倒五行阵图基础版×1");
    assert(State.count("mojiao_jiao") === 0 && State.count("mojiao_pi") === 0, "墨蛟之角/皮实扣（乌龙夺·神风舟料）");
    assert(State.count("qiannian_lingcao") === 0, "千年灵草实扣（颠倒五行阵引）");
    assert(s3.flags.daigong_done, "代工完成置 daigong_done");
  }
}

console.log("\n=== 11. 燕家堡之战·王蝉（增量D·2026-07-09 考据勘误：鬼灵门少主·血灵大法）===");
{
  // 11a. 魔道争锋篇章容器：realmCap 抬进筑基（realmTier 1 / realmCapIndex 15——polish-modao A2：
  //   旧值 13=入章即顶格·帆段闭关颗粒无收；设计稿"篇末筑基中期→后期"）
  const modao = Chapters.list.find(c => c.id === "modao");
  assert(!!modao && modao.realmTier === 1 && modao.realmCapIndex === 15, "chapters.js 存在 modao 篇章（realmTier1·realmCap=筑基后期·A2）");
  assert(modao.startLocation === "yanjiabao", "modao 起始地=燕家堡（强制进场）");
  const hf = Chapters.list.find(c => c.id === "huangfeng");
  assert(hf && hf.nextChapter === "modao", "黄枫谷篇 nextChapter 接 modao");
  // 11b. 王蝉=逃逸式大BOSS：护甲厚、不可逃、无掉落、范围/破甲/追击俱全，本战不诛杀
  const zw = sandbox.WORLD.enemies.zhanwangchan;
  assert(!!zw && zw.boss && zw.canFlee === false, "WORLD.enemies.zhanwangchan 大BOSS·不可逃（撑过血线收口）");
  assert(zw.name === "王蝉" && zw.nature === "human", "王蝉=鬼灵门少主·人修（考据勘误：非虫妖'战王蝉'）");
  assert(zw.elem === "huo" && zw.armor >= 8, "王蝉行火（血煞邪焰）·护甲厚（血灵大法·对韩立的硬仗）");
  assert(zw.reward == null && zw.namedLoot == null, "逃逸式BOSS：无奖励/无具名掉落（非诛杀）");
  assert((zw.attacks || []).some(a => a.kind === "pierce") && (zw.attacks || []).some(a => a.aim === "zone") && (zw.attacks || []).some(a => a.kind === "charge"), "招式带破甲/范围/冲撞追击（不靠裸+N堆数值）");
  // 11c. 燕家堡过场地点 + 前线待命营（home）落位
  const yjb = sandbox.WORLD.locations.find(l => l.id === "yanjiabao");
  assert(!!yjb && yjb.scene === true, "燕家堡=过场地点（scene:true·不入旅行清单）");
  const mf = sandbox.WORLD.locations.find(l => l.id === "modao_front");
  assert(!!mf && mf.home === true && !mf.scene, "前线待命营=home（可闭关/调息·非过场）");
  // 11d. 战王蝉 resolve 触发战斗（chooseStory 分发）
  const bossNode = sandbox.STORY.find(x => x.id === "yanjia_boss");
  assert(!!bossNode && (bossNode.choices || []).some(c => c.resolve === "zhanwangchan_fight"), "yanjia_boss 节点带 resolve:zhanwangchan_fight（触发临战准备）");
}

console.log(`\n========== 功法配装：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
