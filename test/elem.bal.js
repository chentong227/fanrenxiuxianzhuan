/* 一次性校验：克制/符箓/侧位的实战价值（不入测试套）*/
const { Combat, Fighter, SPELLS } = require("../js/combat.js");

const KIT = ["tuna", "huti", "ningshen", "zhayan", "zhayan_lian", "weidu", "feizhen", "huodan"];
function mkJinguang() {
  return {
    name: "金光上人", hp: 120, profile: "common", sense: 14, speed: 13, agility: 10,
    tactics: "guarded", qiLayer: 7, elem: "jin",
    guardMove: { name: "金钟罩·重聚", shield: 16 },
    attacks: [
      { name: "金符破空", dmg: 15, kind: "normal", weight: 12, elem: "jin" },
      { name: "剑符斩", dmg: 18, pierce: true, kind: "pierce", weight: 7, elem: "jin" },
      { name: "金刚伏魔", dmg: 20, kind: "charge", weight: 5, elem: "jin" },
    ],
  };
}
function mkPlayer(extra) {
  // 紧备置：毒1、无暗器、练气五层——逼出符箓/尸傀的真实增量
  return new Fighter(Object.assign({
    name: "韩立", hp: 100, profile: "hanli_si", sense: 10, insight: 6, gongli: 30,
    agility: 6, qiLayer: 5, elem: "mu", spells: KIT.slice(),
    pouch: { duyao_cao: 1, anqi: 0 },
  }, extra));
}
function autopilot(c) {
  let guard = 0;
  while (c.status === "ongoing" && guard++ < 200) {
    let inner = 0;
    while (c.affordableSpells().length && inner++ < 20) {
      const t = c.enemies.findIndex(e => e.alive);
      if (t < 0) break;
      const e = c.enemies[t];
      const aff = c.affordableSpells();
      let choice = null;
      if (c.player.hp < c.player.hpMax * 0.3 && aff.includes("tuna")) choice = "tuna";
      else if (!e.immunePoison && !e.soulOnly && !e.status.poison && aff.includes("weidu")) choice = "weidu";
      else if (aff.includes("jinguang_zhuan")) choice = "jinguang_zhuan";
      else if (aff.includes("huoshe_fu")) choice = "huoshe_fu";
      else if (aff.includes("feizhen")) choice = "feizhen";
      else if (aff.includes("huodan") && e.elem === "jin") choice = "huodan";
      else if (aff.includes("zhayan_lian") && c.player.momentum >= 3) choice = "zhayan_lian";
      else choice = aff.find(id => SPELLS[id].type === "atk");
      if (!choice) break;
      if (!c.cast(choice, t).ok) break;
      if (c.status !== "ongoing") break;
    }
    if (c.status === "ongoing") { c.endRound(); if (c.status === "ongoing") c.startRound(); }
  }
  return c.status;
}
function rate(mk) {
  let w = 0; const N = 400;
  for (let i = 0; i < N; i++) {
    const c = mk();
    c.enemies[0].shield = 40; c.enemies[0]._fixedShield = true;
    c.startRound();
    if (autopilot(c) === "win") w++;
  }
  return Math.round(w / N * 100);
}

const base = rate(() => new Combat({ player: mkPlayer(), enemies: [new Fighter(mkJinguang())], maxRounds: 18 }));
const fu = rate(() => new Combat({ player: mkPlayer({ pouch: { duyao_cao: 1, anqi: 0, huoshe_fu: 2 }, spells: KIT.concat(["huoshe_fu"]) }), enemies: [new Fighter(mkJinguang())], maxRounds: 18 }));
const side = rate(() => new Combat({ player: mkPlayer(), enemies: [new Fighter(mkJinguang())], maxRounds: 18,
  side: { id: "zt", name: "铁奴", hp: 70, hpMax: 70, atk: 12, atkName: "尸傀挥击", nature: "corpse", guard: 0.3 } }));
const all = rate(() => new Combat({ player: mkPlayer({ pouch: { duyao_cao: 1, anqi: 0, huoshe_fu: 2 }, spells: KIT.concat(["huoshe_fu"]) }), enemies: [new Fighter(mkJinguang())], maxRounds: 18,
  side: { id: "zt", name: "铁奴", hp: 70, hpMax: 70, atk: 12, atkName: "尸傀挥击", nature: "corpse", guard: 0.3 } }));

console.log(`金光上人战（练气五层·紧备置：毒1、无暗器）：
  裸装（无符无尸傀）        胜率 ${base}%
  +火蛇符×2（做功课买符）   胜率 ${fu}%
  +尸傀随行（曲魂幡）       胜率 ${side}%
  +符+尸傀（全备置）        胜率 ${all}%`);

/* 防回归断言：备置梯度必须真实存在（克制/侧位的实战价值可测量） */
let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ 失败: " + msg); failures++; }
}
assert(base >= 55 && base <= 88, `紧备置基线在险胜区间 55~88%（实际 ${base}%）`);
assert(fu >= base + 8, `火蛇符带来可感知的提升 ≥8pt（${base}% → ${fu}%）`);
assert(side >= base + 10, `尸傀随行带来显著提升 ≥10pt（${base}% → ${side}%）`);
assert(all >= fu && all >= side, `全备置不弱于任何单项（${all}%）`);
console.log(failures === 0 ? "\n克制梯度：全部通过 ✓" : `\n克制梯度：${failures} 项失败 ✗`);
process.exit(failures === 0 ? 0 : 1);
