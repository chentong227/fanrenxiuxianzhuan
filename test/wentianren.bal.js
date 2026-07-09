// 温天仁·六极真魔功战 冒烟+平衡（S4 骨架·docs/action-fx-design.md §四）：
// 真引擎装配 ?demo=wentianren 同款满配韩立，autoResolve 多局取样——
// 断言：祭魔阶段必触发（≥1 局起即 FAIL 视为死链）。胜率为贪婪 AI 悲观地板（实测 ~18%，
// 真人按正典解法「先诛疗魔+神雷克魔」远高于此；demo 败有 fail-forward 非死局）。
const G = require("./_loadgame.js");
const { State, Engine, DATA } = G;
const STORY = global.STORY || [];

function setup() {
  State.create("韩立", DATA.fixedRootId);
  const s = State.data;
  s.realmIndex = 19; s.activeChapter = "xinghaifeichi"; s.hpMax = 420; s.hp = 420;
  s.spirit = (DATA.realms[19] || {}).spMax || 400;
  s.technique = "changchun";
  s.spells = ["tuna", "huti", "ningshen", "zhayan", "weidu", "huodan", "zimu_ren", "ruyi_hualan"];
  State.give("qingzhu_fengyun_jian", 1);
  State.give("shijinchong", 1);
  State.give("jinguang_zhuan", 1); State.give("jinguang_zhuan_charge", 2);
  State.give("huixue_dan", 2); State.give("huiyuan_dan", 2); State.give("dingshen_fu", 3);
  State.setFlag("dayan_learned"); State.setFlag("dayan_layer3");
  s.storyStage = STORY.length;
}

let wins = 0, liumoSeen = 0, rounds = [];
const N = 40;
for (let i = 0; i < N; i++) {
  setup();
  Engine.startWentianrenFight();
  const c = Engine._combat;
  c.autoResolve(30);
  if (c._liumoUp) liumoSeen++;
  if (c.status === "win") wins++;
  rounds.push(c.round);
  // 清战斗态（不走 finishCombat 的 UI 路径）
  Engine._combat = null; State.data.combat = false;
}
console.log(`温天仁战冒烟：${N} 局 | 胜率 ${(wins / N * 100).toFixed(0)}% | 祭魔触发 ${liumoSeen}/${N} | 平均回合 ${(rounds.reduce((a, b) => a + b, 0) / N).toFixed(1)}`);
if (liumoSeen === 0) { console.error("FAIL：六魔阶段从未触发"); process.exit(1); }
console.log("冒烟通过 ✓（autoResolve 是贪婪地板，真人手操会更高）");
