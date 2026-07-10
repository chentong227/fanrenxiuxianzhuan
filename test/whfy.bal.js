// 外海风云篇·全战斗冒烟+平衡取样（S6）：真引擎装配整章六战，autoResolve 多局取样。
// 断言：每战无死局（贪婪地板胜率>0 且带 fail-forward）；夺翅 survive 与凡人战斗模式跑通。
// autoResolve 是悲观地板——真人手操（集火疗魔/省底牌/走位）远高于此。
const G = require("./_loadgame.js");
const { State, Engine, DATA } = G;
const STORY = global.STORY || [];

function setupJiedan() {
  State.create("韩立", DATA.fixedRootId);
  const s = State.data;
  s.realmIndex = 20; s.activeChapter = "waihaifengyun";
  s.hpMax = 460; s.hp = 460;
  s.spirit = (DATA.realms[20] || {}).spMax || 500;
  s.technique = "changchun";
  s.spells = ["tuna", "huti", "ningshen", "zhayan", "weidu", "huodan", "zimu_ren"];
  State.give("qingzhu_fengyun_jian", 1);
  State.give("shijinchong", 1);
  State.give("jinguang_zhuan", 1); State.give("jinguang_zhuan_charge", 2);
  State.give("huixue_dan", 2); State.give("huiyuan_dan", 2); State.give("dingshen_fu", 3);
  State.setFlag("dayan_learned"); State.setFlag("dayan_layer3");
  s.storyStage = STORY.length;
  return s;
}

function sample(name, boot, n, opts = {}) {
  let wins = 0, rounds = 0;
  for (let i = 0; i < n; i++) {
    const s = setupJiedan();
    (opts.flags || []).forEach(f => State.setFlag(f));
    if (opts.mortal) { State.give("duyao_cao", 4); State.give("anqi", 4); State.give("jinchuang_yao", 2); }
    boot();
    const c = Engine._combat;
    c.autoResolve(c.maxRounds);
    if (c.status === "win") wins++;
    rounds += c.round;
    Engine._combat = null; State.data.combat = false;
  }
  const wr = Math.round(wins / n * 100);
  console.log(`  ${name}：胜率 ${wr}%（${wins}/${n}）· 平均回合 ${(rounds / n).toFixed(1)}`);
  return wr;
}

console.log("\n========== 外海风云篇·全战斗冒烟（贪婪地板） ==========\n");
let fails = 0;
const check = (name, wr, min, max) => {
  const ok = wr >= min && wr <= max;
  if (!ok) { fails++; console.error(`  ✗ ${name} 胜率 ${wr}% 出带（期望 ${min}~${max}%）`); }
};

const wr1 = sample("幕一·鹰鸢兽×2", () => Engine.startWhfyYingyuanFight(), 30);
check("鹰鸢兽", wr1, 55, 100);
const wr2 = sample("幕一·云天啸立威", () => Engine.startWhfyYuntFight(), 30);
check("云天啸（碾压战）", wr2, 65, 100);
const wr3 = sample("幕二·夺翅逃亡（全掺·survive）", () => Engine.startWhfyDuoyiFight(), 30, { flags: ["whfy_duji_full", "whfy_saved_gongsun"] });
check("夺翅逃亡", wr3, 25, 100);
const wr4 = sample("幕三·护法波次（铁桶阵）", () => Engine.startWhfyHufaFight(), 30, { flags: ["whfy_hufa_zhen"] });
check("护法波次", wr4, 35, 100);
const wr5 = sample("幕三·温天仁六魔战（story·双向推进）", () => Engine.startWentianrenFight(true), 20);
console.log("    （六魔战正典 fail-forward：胜负皆被鬼雾打断推进，无胜率下限要求）");
const wr6 = sample("幕四·阴冥村灰蜮×3（凡人模式）", () => Engine.startWhfyCunzhanFight(), 30, { mortal: true });
check("灰蜮群（凡人）", wr6, 30, 100);
const wr7 = sample("幕四·温天仁凡人终结战", () => Engine.startWhfyMortalFight(), 30, { mortal: true });
check("凡人终结战", wr7, 20, 95);

if (fails) { console.error(`\n========== FAIL：${fails} 战胜率出带 ==========\n`); process.exit(1); }
console.log("\n========== 外海风云篇战斗冒烟：全部在带 ✓ ==========\n");
