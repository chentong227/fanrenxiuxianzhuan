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

console.log("\n=== 1. 五行灵气生成（韩立四灵根：缺土、木旺、底蕴随境界成长）===");
{
  // 灵气总量 = 灵根底蕴(4) + 练气层数（境界即底蕴：一层5 → 六层10）
  const mk = (layer) => {
    const player = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, qiLayer: layer, spells: ["zhayan", "tuna"] });
    const enemy = new Fighter({ name: "木桩", hp: 50 });
    const c = new Combat({ player, enemies: [enemy], rng: seqRng([0.99, 0.5, 0.9, 0.3, 0.7]) });
    c.startRound();
    return Object.values(c.qi).reduce((a, b) => a + b, 0);
  };
  const t1 = mk(1), t6 = mk(6);
  assert(t1 === 5, `练气一层灵气总量为5（实际 ${t1}）`);
  assert(t6 === 10, `练气六层灵气总量为10（实际 ${t6}）——底蕴随境界成长`);
  assert(t6 > t1, `灵气底蕴随层数增长（${t1} → ${t6}）`);
  const player = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, qiLayer: 6, spells: ["zhayan", "tuna"] });
  const c = new Combat({ player, enemies: [new Fighter({ name: "木桩", hp: 50 })], rng: seqRng([0.99, 0.5, 0.9, 0.3, 0.7]) });
  c.startRound();
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

  // 凝神蓄气：每回合限一次，且受上限约束，不能靠反复蓄力无限聚气
  const p2 = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, realmTier: 0, spells: ["ningshen"] });
  const c2 = new Combat({ player: p2, enemies: [{ name: "木桩", hp: 999 }], rng: seqRng([0.99]) });
  c2.startRound();
  let okCasts = 0;
  for (let i = 0; i < 10; i++) { if (c2.cast("ningshen").ok) okCasts++; }
  assert(okCasts === 1, `凝神静气每回合限用一次（实际成功 ${okCasts} 次）`);
  assert(p2.nextQiBonus <= cap0, `凝神蓄气受上限约束（蓄 ${p2.nextQiBonus} ≤ ${cap0}）`);
}

console.log("\n=== 1.6 护体不可逐回合无限囤积（杜绝龟缩无敌）===");
{
  // 玩家每回合只放护体(huti)+吐纳(tuna)龟缩，面对会破甲的强敌最终应被破防，而非永远无敌
  const player = new Fighter({ name: "韩立", hp: 60, profile: "hanli_si", insight: 0, technique: "changchun", realmTier: 0, spells: ["huti", "tuna"] });
  const enemy = new Fighter({ name: "凶修", hp: 9999, sense: 5, agility: 0, atkName: "破甲重击", atk: 16, pierce: true });
  const c = new Combat({ player, enemies: [enemy], maxRounds: 60, rng: () => 0.99 });
  // 自动"龟缩流"：每回合尽量先护体、血低则吐纳
  let guard = 0;
  while (c.status === "ongoing" && guard++ < 60) {
    c.startRound();
    let inner = 0;
    while (c.affordableSpells().length && inner++ < 10) {
      const aff = c.affordableSpells();
      let pick = null;
      if (player.hp < player.hpMax * 0.6 && aff.includes("tuna")) pick = "tuna";
      else if (aff.includes("huti")) pick = "huti";
      else if (aff.includes("tuna")) pick = "tuna";
      if (!pick) break;
      if (!c.cast(pick, 0).ok) break;
    }
    if (c.status === "ongoing") c.endRound();
  }
  assert(c.status === "lose", `纯龟缩(护体+吐纳)无法无限续命，终被破防（结果 ${c.status}，撑了 ${c.round} 回合）`);
  // 护体确有缓冲价值：撑过若干回合而非秒倒
  assert(c.round >= 3, `护体仍有价值，能撑数回合（${c.round} 回合）`);
}

console.log("\n=== 2. 连招：一回合内连续施法直到灵气耗尽 ===");
{
  const player = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, qiLayer: 4, spells: ["zhayan", "tuna", "ningshen"] });
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
    // 决战人设：暗修至练气六层（灵气底蕴10，对应旧版平衡基准）
    const player = new Fighter({ name: "韩立", hp: 130, sense: 12, speed: 12, insight: 8, gongli: 45, qiLayer: 6,
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
  // 武学：基础(11+势2×5=21) × 武学系数0.8 ≈ 17（成本重定价后连击 11 基伤）
  const expect = Math.round((11 + 2 * 5) * 0.8);
  assert(dealt === expect, `眨眼连击随剑势增伤、按武学系数结算（期望${expect}，实际${dealt}）`);
  assert(p.momentum === 0, "眨眼连击后剑势清零");

  // 长春功增益：木系吐纳回元更多
  const p2 = new Fighter({ name: "甲", hp: 100, profile: "hanli_si", technique: "changchun", spells: ["tuna"] });
  p2.hp = 50;
  const c2 = new Combat({ player: p2, enemies: [new Fighter({ name: "x", hp: 50 })], rng: seqRng([0.99]) });
  c2.startRound(); c2.qi.mu += 5;
  c2.cast("tuna", 0);
  assert(p2.hp === 50 + Math.round(6 * 1.4), `长春功者吐纳回元更多（回${Math.round(6 * 1.4)}，基础6×长春1.4）`);
}

console.log("\n=== 8.5 克制系统：灵技×道基 / 特攻 / 符箓 / 侧位单位 ===");
{
  // 火弹术(火) 克 金行道基 ×1.25；被克 ×0.8
  const mkP = (spells, pouch) => new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, qiLayer: 9, elem: "mu", spells, pouch: pouch || {} });
  const hitOnce = (defElem, spellId, pouch) => {
    const p = mkP([spellId], pouch);
    const e = new Fighter({ name: "试敌", hp: 500, elem: defElem, agility: 0 });
    const c = new Combat({ player: p, enemies: [e], rng: seqRng([0.99, 0.6, 0.8, 0.7, 0.5]) });
    c.startRound();
    // 保证灵气足够（直接注入）
    c.qi = { jin: 9, mu: 9, shui: 9, huo: 9, tu: 9 };
    const before = e.hp;
    const r = c.cast(spellId, 0);
    return r.ok ? before - e.hp : -1;
  };
  const vsJin = hitOnce("jin", "huodan");     // 火克金
  const vsNone = hitOnce(null, "huodan");     // 无道基（凡人）
  const vsShui = hitOnce("shui", "huodan");   // 水克火（被克）
  assert(vsJin > vsNone && vsNone > vsShui, `火弹术：克金${vsJin} > 无属${vsNone} > 被水克${vsShui}`);
  assert(vsJin === Math.round(vsNone * 1.25) || Math.abs(vsJin - vsNone * 1.25) <= 1, `克制约+25%（${vsNone}→${vsJin}）`);

  // 武学无行属：眨眼剑法对金行敌不吃克制（用户裁决：凡人武学不入轴）
  const swordVsJin = hitOnce("jin", "zhayan");
  const swordVsNone = hitOnce(null, "zhayan");
  assert(swordVsJin === swordVsNone, `武学不参与五行克制（${swordVsJin}=${swordVsNone}）`);

  // 符箓：any 灵气即可点燃，消耗实物
  const p2 = mkP(["huoshe_fu"], { huoshe_fu: 1 });
  const e2 = new Fighter({ name: "金行妖", hp: 500, elem: "jin", agility: 0 });
  const c2 = new Combat({ player: p2, enemies: [e2], rng: seqRng([0.99, 0.6, 0.8]) });
  c2.startRound();
  assert(c2.canAfford("huoshe_fu"), "火蛇符：一点任意灵气即可点燃");
  c2.cast("huoshe_fu", 0);
  assert(p2.pouch.huoshe_fu === 0, "火蛇符消耗实物（用一张少一张）");
  assert(!c2.canAfford("huoshe_fu"), "符尽则不可再施");

  // 特攻：镇魂 slays ghost ×1.5（辟邪神雷克鬼魔的同一张表）
  const pG = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, qiLayer: 9, gongli: 40, spells: ["zhenhun"] });
  const ghost = new Fighter({ name: "怨魂", hp: 200, nature: "ghost", gongli: 20, agility: 0 });
  const cG = new Combat({ player: pG, enemies: [ghost], rng: seqRng([0.99, 0.6]) });
  cG.startRound(); cG.qi = { jin: 9, mu: 9, shui: 9, huo: 9, tu: 9 };
  const bG = ghost.hp; cG.cast("zhenhun", 0);
  const pH = new Fighter({ name: "韩立", hp: 100, profile: "hanli_si", insight: 0, qiLayer: 9, gongli: 40, spells: ["zhenhun"] });
  const soul2 = new Fighter({ name: "残魂", hp: 200, soulOnly: true, gongli: 20, agility: 0 });   // 旧字段：无 nature
  const cH = new Combat({ player: pH, enemies: [soul2], rng: seqRng([0.99, 0.6]) });
  cH.startRound(); cH.qi = { jin: 9, mu: 9, shui: 9, huo: 9, tu: 9 };
  const bH = soul2.hp; cH.cast("zhenhun", 0);
  assert((bG - ghost.hp) > (bH - soul2.hp), `镇魂对 ghost 特攻×1.5（${bG - ghost.hp} > ${bH - soul2.hp}）`);

  // nature=corpse：毒免疫（尸无血脉——一致感）
  const pC = mkP(["weidu"], { duyao_cao: 2 });
  const corpse = new Fighter({ name: "尸傀", hp: 200, nature: "corpse", agility: 0 });
  const cC = new Combat({ player: pC, enemies: [corpse], rng: seqRng([0.99, 0.6]) });
  cC.startRound(); cC.qi = { jin: 9, mu: 9, shui: 9, huo: 9, tu: 9 };
  cC.cast("weidu", 0);
  assert(!corpse.status.poison, "尸傀百毒不侵（nature=corpse 自动毒免疫）");

  // 侧位单位：自动出击 + 挡刀 + 倒地不判负
  const pS = mkP(["zhayan"]);
  const eS = new Fighter({ name: "悍匪", hp: 60, agility: 0, atkName: "刀劈", atk: 10 });
  const cS = new Combat({ player: pS, enemies: [eS], rng: seqRng([0.99, 0.6, 0.8, 0.7]),
    side: { id: "zt", name: "铁奴·张铁", hp: 70, hpMax: 70, atk: 12, atkName: "尸傀挥击", nature: "corpse", guard: 1 } });
  cS.startRound();
  const beforeS = eS.hp;
  cS.endRound();   // 侧位自动出手 + guard=1 必挡刀
  assert(eS.hp < beforeS, `侧位单位自动出击（敌血 ${beforeS}→${eS.hp}）`);
  assert(cS.player.hp === 100, `侧位单位必挡刀时主人无损（hp=${cS.player.hp}）`);
  assert(cS.side.hp < 70, `挡刀伤在侧位身上（${cS.side.hp}/70）`);
  // 侧位倒地：不判负、战斗继续
  cS.side.hp = 0;
  cS.endRound();
  assert(cS.status === "ongoing" || cS.status === "win", `侧位倒地不判负（${cS.status}）`);
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
