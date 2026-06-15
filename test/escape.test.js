/* ============================================================
 * 逃遁→击杀闭环（阶段8·用户钦定重点）无头测试：node test/escape.test.js
 * 覆盖：撤离口收窄(最前排 lane0 最右格) / 堵口=封逃 / 境界加权遁意阈值 / 雷遁封口击杀闭环
 * 见 docs/balance-master-design.md §九、js/balance.js fleeProfile
 * ============================================================ */
const { Combat, Fighter, SPELLS } = require("../js/combat.js");
const Balance = require("../js/balance.js");

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ 失败: " + msg); failures++; }
}
const noCrit = () => 0.99;   // 永不暴击/不闪避/不触发概率事件
function mkHan(extra) {
  return new Fighter(Object.assign({
    name: "韩立", hp: 100, mp: 90, qiLayer: 11, team: "player", move: 1, speed: 12,
    spells: ["tuna", "huti", "ningshen", "zhayan"],
  }, extra || {}));
}
function runner(extra) {
  return Object.assign({ name: "怯敌", hp: 100, agility: 0, speed: 8, atk: 8, atkName: "斩",
    mp: 40, canFlee: true, move: 2, attacks: [{ name: "斩", dmg: 8, kind: "normal" }] }, extra || {});
}

console.log("\n=== 1. 撤离口收窄：只能从最前排(lane0)最右那一格离场 ===");
{
  const c = new Combat({ player: mkHan(), enemies: [runner()], rng: noCrit });
  c.startRound();
  const e = c.enemies[0], exitPos = c.W - 1;
  assert(e.pos === exitPos && (e.lane || 0) === 0, `开局敌即在撤离口（pos${e.pos}/lane${e.lane || 0}，撤离口=${exitPos}）`);
  e.hp = 5; e.intent = { name: "遁走", kind: "flee" };
  c._enemyAct(e);
  assert(e.escaped === true, "敌抵最前排最右格、撤离口畅通 → 遁出战圈（escaped）");
}

console.log("\n=== 2. 堵口=封逃：己方占住撤离口 → 无合法撤离格、遁走落空滞留受死 ===");
{
  const c = new Combat({ player: mkHan(), enemies: [runner()], rng: noCrit });
  c.startRound();
  const e = c.enemies[0], exitPos = c.W - 1;
  c.player.pos = exitPos; c.player.lane = 0; c.player.alt = 0;   // 韩立（雷遁/疾行）抢占撤离口
  e.pos = exitPos - 1;                                           // 敌被逼在口内一格
  e.hp = 5; e.intent = { name: "遁走", kind: "flee" };
  c._enemyAct(e);
  assert(e.escaped !== true, "撤离口被韩立封住 → 遁走落空（未 escaped）");
  assert(e.pos < exitPos && e.alive, `敌滞留口内、束手待死（pos${e.pos} < 撤离口${exitPos}）`);
}

console.log("\n=== 3. 堵口=封逃：同道侧位占口也算封死（己方泛指）===");
{
  const c = new Combat({ player: mkHan(), enemies: [runner()], sides: [{ name: "南宫婉", hp: 80, kind: "ally", atk: 10 }], rng: noCrit });
  c.startRound();
  const e = c.enemies[0], exitPos = c.W - 1;
  const ally = c.sides[0];
  ally.pos = exitPos; ally.lane = 0; ally.alt = 0;              // 同道封口
  e.pos = exitPos - 1; e.hp = 5; e.intent = { name: "遁走", kind: "flee" };
  c._enemyAct(e);
  assert(e.escaped !== true && e.pos < exitPos, "同道占住撤离口 → 敌同样逃不脱（己方泛指：本体/同道/驭使之物）");
}

console.log("\n=== 4. 击杀闭环：雷遁封口 → 补刀，敌走不脱 ===");
{
  assert(SPELLS.leidun && SPELLS.leidun.blinkMove === true, "雷遁=blinkMove 瞬移技（抢占/封死撤离口的本钱）");
  const c = new Combat({ player: mkHan(), enemies: [runner({ hp: 100 })], rng: noCrit });
  c.startRound();
  const e = c.enemies[0], exitPos = c.W - 1;
  c.player.pos = exitPos;                          // 雷遁抢占撤离口的效果（瞬移到最右格）
  e.pos = exitPos - 1; e.hp = 5; e.intent = { name: "遁走", kind: "flee" };
  c._enemyAct(e);
  assert(e.alive && !e.escaped, "敌被封口滞留（未逃脱）");
  e.hp = 0; c._checkEnd();                         // 够狠够快——在逃离前补刀打死
  assert(c.status === "win" && !e.escaped, "封口补刀 → 击杀闭环达成（win，非走脱）");
}

console.log("\n=== 5. 遁意阈值随境界/越阶加权（元婴尤甚；练气不动既有平衡）===");
{
  const qi = Balance.fleeProfile(0, 0);            // 练气 vs 练气
  assert(qi.hpThresh === 0.10 && Math.abs(qi.prob - 0.55) < 1e-9,
    `练气沿用旧值（血阈${qi.hpThresh}/概率${qi.prob}）——别动辄就跑`);
  const nascent = Balance.fleeProfile(3, 0);       // 元婴越阶压玩家（练气）
  assert(nascent.hpThresh > qi.hpThresh && nascent.prob > qi.prob,
    `元婴起遁更早更果断（血阈${nascent.hpThresh.toFixed(2)}>${qi.hpThresh}、概率${nascent.prob.toFixed(2)}>${qi.prob}）`);
  let mono = true, prev = Balance.fleeProfile(0, 0);
  for (let t = 1; t <= 4; t++) { const cur = Balance.fleeProfile(t, t); if (cur.hpThresh < prev.hpThresh || cur.prob < prev.prob) mono = false; prev = cur; }
  assert(mono, "同阶下血阈/概率随境界单调不降（境界越高越惜命）");
  const even = Balance.fleeProfile(3, 3), over = Balance.fleeProfile(3, 1);
  assert(over.prob >= even.prob && over.hpThresh >= even.hpThresh, "越阶（敌高于我）再加权：更早更果断遁逃");
  assert(qi.hpThresh >= 0.08 && nascent.prob <= 0.97, "阈值有上下夹断（不至于必逃/永不逃）");
}

console.log("\n=== 6. 端到端：练气重伤敌仍循旧阈起遁、并能从撤离口走脱 ===");
{
  const c = new Combat({ player: mkHan(), enemies: [runner({ move: 2 })], rng: () => 0.0 });
  c.startRound();
  c.enemies[0].hp = 5;                             // 血一成下（练气血阈 0.10）
  c._rollEnemyIntents();
  assert(c.enemies[0].intent.kind === "flee", "练气敌命悬一线起遁意（rng0 必触发）");
  for (let i = 0; i < 5 && c.status === "ongoing"; i++) { c.cast("ningshen", 0); c.endRound(); c.startRound(); }
  assert(c.status === "win" && c.enemies[0].escaped, "撤离口畅通（韩立未封）→ 敌走脱、战斗以胜收场");
}

console.log(`\n========== 逃遁→击杀闭环：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
if (typeof process !== "undefined" && process.exit) process.exit(failures === 0 ? 0 : 1);
