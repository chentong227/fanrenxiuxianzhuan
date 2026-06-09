/* 决战平衡测试：准备（毒草/暗器底牌）多寡如何影响胜率
 * 目标梯度：充分准备 ≥80%，一般准备 40~60%，毫无准备 ≤15% */
const { Combat, Fighter, SPELLS } = require("../js/combat.js");

const KIT = ["tuna", "huti", "ningshen", "zhayan", "zhayan_lian", "weidu", "feizhen", "zhenhun"];

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
      // 战术：危急回血→镇魂(对元神)→喂毒→飞针爆发→眨眼连击→眨眼/护体
      if (c.player.hp < c.player.hpMax * 0.28 && aff.includes("tuna")) choice = "tuna";
      else if (e.soulOnly) choice = aff.find(id => SPELLS[id].type === "soul");
      else if (!e.immunePoison && !e.status.poison && aff.includes("weidu")) choice = "weidu";
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

function build(pouch) {
  const player = new Fighter({ name: "韩立", hp: 130, sense: 12, speed: 12, insight: 8, gongli: 45,
    profile: "hanli_si", spells: KIT, pouch, technique: "changchun", grade: 1, realmTier: 0 });
  const modafu = { name: "墨大夫", hp: 52, profile: "modafu", sense: 6, agility: 4, atkName: "毒掌", atk: 12 };
  const tienu  = { name: "铁奴", hp: 70, immunePoison: true, sense: 3, agility: 4, atkName: "重击", atk: 19, pierce: true };
  const yuhun  = { name: "余子童元神", hp: 48, soulOnly: true, sense: 18, agility: 8, gongli: 22, atkName: "夺舍", atk: 15 };
  return new Combat({ player, enemies: [modafu], waves: [[tienu], [yuhun]], maxRounds: 16 });
}

const cases = [
  ["充分准备(毒3 暗器4)", { duyao_cao: 3, anqi: 4 }],
  ["一般准备(毒1 暗器2)", { duyao_cao: 1, anqi: 2 }],
  ["毫无准备(空手)",      {}],
];
for (const [label, pouch] of cases) {
  let win = 0; const N = 600;
  for (let i = 0; i < N; i++) if (autopilot(build({ ...pouch })) === "win") win++;
  console.log(`${label}：胜率 ${(win / N * 100).toFixed(1)}%（${win}/${N}）`);
}
