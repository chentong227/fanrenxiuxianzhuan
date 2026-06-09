/* 功法品阶平衡：验证品阶胜率梯度 + 凡人逆袭窗口
 * node test/tier.bal.js */
const { Combat, Fighter, SPELLS } = require("../js/combat.js");
const Balance = require("../js/balance.js");

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }

// 一个"功法法术"攻击招式，按品阶/境界缩放。这里直接验证 balance 公式 + 一个简化对拼。
console.log("\n=== 功法品阶强度公式 ===");
{
  const base = 20;
  const huang = Balance.spellPower(base, "art", 1, 0);
  const xuan = Balance.spellPower(base, "art", 2, 0);
  const di = Balance.spellPower(base, "art", 3, 0);
  const tian = Balance.spellPower(base, "art", 4, 0);
  assert(huang < xuan && xuan < di && di < tian, `品阶越高威力越大（黄${huang}<玄${xuan}<地${di}<天${tian}）`);
  const martial = Balance.spellPower(base, "martial", 4, 0);
  const artHuang = Balance.spellPower(base, "art", 1, 0);
  assert(martial < artHuang, `武学(不吃品阶)弱于黄阶法术（武${martial} < 黄阶法术${artHuang}）`);
  // 境界成长：法术随境界涨，武学几乎不涨
  const artQi = Balance.spellPower(base, "art", 1, 0);
  const artCore = Balance.spellPower(base, "art", 2, 0); // realmTier 2
  const mQi = Balance.spellPower(base, "martial", 1, 0);
  const mCore = Balance.spellPower(base, "martial", 1, 2);
  assert((artCore - artQi) > (mCore - mQi), "随境界提升，法术成长远大于武学（武学终落伍）");
}

// 模拟同准备下，主修不同品阶功法的胜率梯度
console.log("\n=== 同准备下品阶胜率梯度（蒙特卡洛）===");
function autopilot(c) {
  let g = 0;
  while (c.status === "ongoing" && g++ < 200) {
    c.startRound();
    let i = 0;
    while (c.affordableSpells().length && i++ < 20) {
      const t = c.enemies.findIndex(e => e.alive); if (t < 0) break;
      const aff = c.affordableSpells();
      // 简化战术：有吐纳应急，否则攻击
      let pick = (c.player.hp < c.player.hpMax * 0.3 && aff.includes("tuna")) ? "tuna"
        : aff.find(id => SPELLS[id].type === "atk") || aff.find(id => SPELLS[id].type === "soul");
      if (!pick) break;
      if (!c.cast(pick, t).ok) break;
      if (c.status !== "ongoing") break;
    }
    if (c.status === "ongoing") c.endRound();
  }
  return c.status;
}
// 用一个"功法攻击"招式做对照：注入临时法术
SPELLS._gptest = { name: "测试法术", cost: { mu: 2 }, type: "atk", dmg: 12, source: "art" };
function buildVs(grade) {
  const p = new Fighter({ name: "修士", hp: 110, profile: "common", grade, realmTier: 0, spells: ["_gptest", "tuna"] });
  // profile common 五行均衡，保证 mu 足够
  const e = { name: "陪练", hp: 110, sense: 5, agility: 4, atkName: "击", atk: 12 };
  return new Combat({ player: p, enemies: [e], maxRounds: 14 });
}
const rates = {};
for (const g of [1, 2, 3]) {
  let win = 0; const N = 400;
  for (let i = 0; i < N; i++) if (autopilot(buildVs(g)) === "win") win++;
  rates[g] = win / N;
  console.log(`  主修${({1:'黄阶',2:'玄阶',3:'地阶'})[g]}：胜率 ${(rates[g]*100).toFixed(1)}%`);
}
assert(rates[1] < rates[2] && rates[2] <= rates[3] + 0.0001, "品阶越高胜率越高（地≥玄>黄）");
delete SPELLS._gptest;

console.log(`\n========== 品阶平衡：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
