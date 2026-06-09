/* ============================================================
 * 战斗引擎无头测试：node test/combat.test.js
 * 法术严格限于七玄门篇真实手段；神识为比较型；运功镇魂以功力伤元神
 * ============================================================ */
const { Combat, Fighter, SPELLS } = require("../js/combat.js");
const Balance = require("../js/balance.js");

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ 失败: " + msg); failures++; }
}
function seqRng(seq) { let i = 0; return () => seq[(i++) % seq.length]; }

const FULL_KIT = ["tuna", "huti", "ningshen", "zhayan", "zhayan_lian", "weidu", "feizhen", "zhenhun"];

console.log("\n=== 0. 法术库严格限于七玄门篇真实手段 ===");
{
  const banned = ["huoqiu", "huolong", "hanbing", "yujian", "shuidun", "mujia", "tushan", "shenshi", "shenshi_qiang"];
  const present = banned.filter(id => SPELLS[id]);
  assert(present.length === 0, `无杜撰/旧法术（误含：${present.join(",") || "无"}）`);
  assert(!!SPELLS.zhayan && !!SPELLS.weidu && !!SPELLS.zhenhun && !!SPELLS.tuna, "保留：眨眼剑法/喂毒/运功镇魂/长春吐纳");
}

console.log("\n=== 1. 五行灵气生成（韩立四灵根：缺土、木旺、总量10）===");
{
  const player = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, spells: ["zhayan", "tuna"] });
  const enemy = new Fighter({ name: "木桩", hp: 50 });
  const c = new Combat({ player, enemies: [enemy], rng: seqRng([0.99, 0.5, 0.9, 0.3, 0.7]) });
  c.startRound();
  const total = Object.values(c.qi).reduce((a, b) => a + b, 0);
  assert(total === 10, `灵气总量为10（实际 ${total}）`);
  assert(c.qi.tu === 0, `「土」灵气为0（四灵根缺土）`);
  assert(c.qi.mu >= c.qi.huo, `「木」不少于「火」（木属性最旺）`);
}

console.log("\n=== 1.5 灵气不可无限囤积（结转有上限，随境界放宽）===");
{
  // 练气期(realmTier 0)：回合结余灵气仅能结转少量，杜绝越囤越多
  const cap0 = Balance.qiCarryCap(0);
  const player = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, realmTier: 0, spells: ["ningshen"] });
  const c = new Combat({ player, enemies: [{ name: "木桩", hp: 999 }], rng: seqRng([0.99]) });
  // 连续多回合完全不耗灵气，观察是否会无限累积
  let peak = 0;
  for (let r = 0; r < 6; r++) {
    c.startRound();
    const total = Object.values(c.qi).reduce((a, b) => a + b, 0);
    peak = Math.max(peak, total);
    c.endRound();
  }
  const prof = c.player.profile;
  // 单回合产出 10，加上结转上限 cap0，封顶应为 10 + cap0（不会逐回合膨胀）
  assert(peak <= 10 + cap0 + 2, `灵气不会无限累积（峰值 ${peak} ≤ 单回合产出+结转上限 ${10 + cap0}(+顿悟2)）`);
  assert(Balance.qiCarryCap(3) > cap0, `高阶修士结转上限更高（练气${cap0} < 结丹${Balance.qiCarryCap(3)}）`);

  // 凝神蓄气也受同一上限约束，不能靠反复蓄力无限聚气
  const p2 = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, realmTier: 0, spells: ["ningshen"] });
  const c2 = new Combat({ player: p2, enemies: [{ name: "木桩", hp: 999 }], rng: seqRng([0.99]) });
  c2.startRound();
  for (let i = 0; i < 10; i++) { if (c2.canAfford("ningshen")) c2.cast("ningshen"); }
  assert(p2.nextQiBonus <= cap0, `凝神蓄气受上限约束（蓄 ${p2.nextQiBonus} ≤ ${cap0}）`);
}

console.log("\n=== 2. 连招：一回合内连续施法直到灵气耗尽 ===");
{
  const player = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, spells: ["zhayan", "tuna", "ningshen"] });
  const enemy = new Fighter({ name: "敌修", hp: 60, agility: 0 });
  const c = new Combat({ player, enemies: [enemy], rng: seqRng([0.99]) });
  c.startRound();
  let casts = 0, guard = 0;
  while (c.affordableSpells().length && guard++ < 20) { if (c.cast(c.affordableSpells()[0]).ok) casts++; }
  assert(casts >= 2, `单回合连放了 ${casts} 个法术`);
  assert(c.affordableSpells().length === 0, `灵气耗尽后再无可施法术`);
}

console.log("\n=== 3. 喂毒消耗底牌、可叠加、持续掉血；死物免疫毒 ===");
{
  const player = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, spells: ["weidu"], pouch: { duyao_cao: 2 } });
  const enemy = new Fighter({ name: "墨大夫", hp: 40 });
  const c = new Combat({ player, enemies: [enemy], rng: seqRng([0.99]) });
  c.startRound(); c.qi.jin += 2;
  c.cast("weidu", 0);
  const stack1 = enemy.status.poison.dmg;
  assert(player.pouch.duyao_cao === 1, `喂毒消耗一份毒草底牌（剩 ${player.pouch.duyao_cao}）`);
  c.cast("weidu", 0);
  assert(enemy.status.poison.dmg === stack1 * 2, `毒可叠加（${stack1} → ${enemy.status.poison.dmg}）`);
  assert(!c.canAfford("weidu"), "底牌用尽后喂毒不可施放（准备内化进战斗）");
  const hpBefore = enemy.hp; c.endRound();
  assert(enemy.hp < hpBefore, `回合结束毒发掉血（${hpBefore} → ${enemy.hp}）`);

  const tienu = new Fighter({ name: "铁奴", hp: 50, immunePoison: true });
  const c2 = new Combat({ player: new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", spells: ["weidu"], pouch: { duyao_cao: 1 } }), enemies: [tienu], rng: seqRng([0.99]) });
  c2.startRound(); c2.qi.jin += 2; c2.cast("weidu", 0);
  assert(!tienu.status.poison, "铁奴（死物）免疫中毒");
}

console.log("\n=== 4. 暗器飞针：消耗底牌、无视部分闪避、破护体 ===");
{
  const player = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", sense: 5, insight: 0, spells: ["feizhen"], pouch: { anqi: 2 } });
  const enemy = new Fighter({ name: "高闪避敌", hp: 60, sense: 5, agility: 50 });
  enemy.shield = 5;
  const c = new Combat({ player, enemies: [enemy], rng: seqRng([0.4]) });
  c.startRound(); c.qi.jin += 1;
  const before = enemy.hp;
  c.cast("feizhen", 0);
  assert(player.pouch.anqi === 1, "飞针消耗一支暗器");
  assert(enemy.hp < before, `飞针无视高闪避命中（${before} → ${enemy.hp}）`);
}

console.log("\n=== 5. 神魂目标：唯运功镇魂可伤，剑法/毒无效；伤害随功力 ===");
{
  const soul = new Fighter({ name: "余子童元神", hp: 30, soulOnly: true, gongli: 20 });
  const player = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", gongli: 40, insight: 0, spells: ["zhayan", "zhenhun"] });
  const c = new Combat({ player, enemies: [soul], rng: seqRng([0.99]) });
  c.startRound(); c.qi.jin += 2;
  c.cast("zhayan", 0);
  assert(soul.hp === 30, "眨眼剑法对元神无效");
  c.qi.mu += 2; c.qi.shui += 2;
  c.cast("zhenhun", 0);
  assert(soul.hp < 30, `运功镇魂对元神有效（→ ${soul.hp}）`);
  // 功力高则镇魂更狠
  const d1 = Balance.soulSuppressDamage(40, 20), d2 = Balance.soulSuppressDamage(20, 20);
  assert(d1 > d2, `功力越高镇魂伤害越大（${d2} → ${d1}）`);
}

console.log("\n=== 6. 神识比较型：高神识看穿意图 + 命中加成 ===");
{
  const adv = Balance.senseAdvantage(20, 5);
  assert(adv.seeIntent, "神识远高于敌→看穿其意图(底牌)");
  assert(adv.hitBonus > 0, "神识优势→命中加成");
  const dis = Balance.senseAdvantage(5, 20);
  assert(!dis.seeIntent && dis.hitBonus < 0, "神识劣势→被看穿、命中下降");
  // 敌人意图可被读取
  const player = new Fighter({ name: "韩立", hp: 100, sense: 20, profile: "hanli_si", spells: ["zhayan"] });
  const enemy = new Fighter({ name: "敌", hp: 50, sense: 5, atkName: "凶斩", atk: 12 });
  const c = new Combat({ player, enemies: [enemy], rng: seqRng([0.5]) });
  c.startRound();
  assert(enemy.intent && enemy.intent.name === "凶斩", "敌人本回合意图可被读取（供UI显示）");
}

console.log("\n=== 7. 遁速 → 大世界赶路耗时；先手 ===");
{
  assert(Balance.travelTimeFactor(20) < Balance.travelTimeFactor(5), "遁速越高，赶路耗时系数越小");
  const fast = Balance.initiative(25, 5, seqRng([0.5]));
  assert(fast.playerFirst, "遁速高→先手");
}

console.log("\n=== 8. 决战墨大夫：三阶段波次通关 ===");
{
  function makeShowdown() {
    const player = new Fighter({ name: "韩立", hp: 130, sense: 12, speed: 12, insight: 8, gongli: 45,
      profile: "hanli_si", technique: "changchun", grade: 1, realmTier: 0, spells: FULL_KIT, pouch: { duyao_cao: 3, anqi: 4 } });
    return new Combat({
      player,
      enemies: [{ name: "墨大夫", hp: 52, profile: "modafu", sense: 6, agility: 4, atkName: "毒掌", atk: 12 }],
      waves: [
        [{ name: "铁奴", hp: 70, immunePoison: true, sense: 3, agility: 4, atkName: "重击", atk: 19, pierce: true }],
        [{ name: "余子童元神", hp: 48, soulOnly: true, sense: 18, agility: 8, gongli: 22, atkName: "夺舍", atk: 15 }],
      ],
      maxRounds: 16,
    });
  }
  // 集成校验（非平衡校验）：充分准备下多次尝试应能取胜；平衡梯度由 showdown.bal.js 蒙特卡洛保证
  let won = false;
  for (let i = 0; i < 30 && !won; i++) won = autopilot(makeShowdown()) === "win";
  assert(won, `三阶段决战可通关（充分准备下多次尝试取胜）`);
}

console.log("\n=== 8.5 战斗深化：剑势连携 + 长春功增益 ===");
{
  // 剑势：眨眼剑法积势，眨眼连击随势增伤
  const p = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, technique: "changchun", spells: ["zhayan", "zhayan_lian"] });
  const e = new Fighter({ name: "桩", hp: 200, agility: 0 });
  const c = new Combat({ player: p, enemies: [e], rng: seqRng([0.99]) });
  c.startRound(); c.qi.jin += 20;
  c.cast("zhayan", 0); c.cast("zhayan", 0);
  assert(p.momentum === 2, `眨眼剑法积累剑势（势=${p.momentum}）`);
  const hpBefore = e.hp;
  c.cast("zhayan_lian", 0);
  const dealt = hpBefore - e.hp;
  // 武学：基础(13+势2×5=23) × 武学系数0.8 = 18
  const expect = Math.round((13 + 2 * 5) * 0.8);
  assert(dealt === expect, `眨眼连击随剑势增伤、按武学系数结算（期望${expect}，实际${dealt}）`);
  assert(p.momentum === 0, "眨眼连击后剑势清零");

  // 长春功增益：木系吐纳回元更多
  const p2 = new Fighter({ name: "甲", hp: 100, profile: "hanli_si", technique: "changchun", spells: ["tuna"] });
  p2.hp = 50;
  const c2 = new Combat({ player: p2, enemies: [new Fighter({ name: "x", hp: 50 })], rng: seqRng([0.99]) });
  c2.startRound(); c2.qi.mu += 5;
  c2.cast("tuna", 0);
  assert(p2.hp === 50 + Math.round(9 * 1.4), `长春功者吐纳回元更多（回${Math.round(9 * 1.4)}）`);
}

console.log("\n=== 9. 突破=复用战斗：充分准备成功；准备不足失败 ===");
{
  const p1 = new Fighter({ name: "道心", hp: 80, profile: "hanli_si", insight: 10, gongli: 40, spells: FULL_KIT, pouch: { duyao_cao: 2, anqi: 2 } });
  const c1 = new Combat({ player: p1, enemies: [{ name: "瓶颈心魔", hp: 55, sense: 5, agility: 0, atkName: "反噬", atk: 9 }], maxRounds: 12, mode: "breakthrough", rng: seqRng([0.9, 0.4, 0.7]) });
  assert(autopilot(c1) === "win", `准备充分突破成功（${c1.status}）`);

  const p2 = new Fighter({ name: "道心", hp: 50, profile: "hanli_si", insight: 0, spells: ["zhayan"] });
  const c2 = new Combat({ player: p2, enemies: [{ name: "筑基大瓶颈", hp: 999, sense: 5, agility: 0, atkName: "反噬", atk: 4 }], maxRounds: 5, mode: "breakthrough", rng: seqRng([0.99]) });
  assert(autopilot(c2) === "lose", `准备不足突破必败（${c2.status}，回合 ${c2.round}）`);
}

// ---- 自动战术 ----
function autopilot(c) {
  let guard = 0;
  while (c.status === "ongoing" && guard++ < 300) {
    c.startRound();
    let inner = 0;
    while (c.affordableSpells().length && inner++ < 20) {
      const t = c.enemies.findIndex(e => e.alive);
      if (t < 0) break;
      const e = c.enemies[t];
      const aff = c.affordableSpells();
      let choice = null;
      if (c.player.hp < c.player.hpMax * 0.28 && aff.includes("tuna")) choice = "tuna";
      else if (e.soulOnly) choice = aff.find(id => SPELLS[id].type === "soul");
      else if (!e.immunePoison && !e.soulOnly && !e.status.poison && aff.includes("weidu")) choice = "weidu";
      else if (aff.includes("feizhen")) choice = "feizhen";
      else if (aff.includes("zhayan_lian")) choice = "zhayan_lian";
      else choice = aff.find(id => SPELLS[id].type === "atk") || aff.find(id => SPELLS[id].type === "def");
      if (!choice) break;
      if (!c.cast(choice, t).ok) break;
      if (c.status !== "ongoing") break;
    }
    if (c.status === "ongoing") c.endRound();
  }
  return c.status;
}

console.log(`\n========== 战斗系统：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
