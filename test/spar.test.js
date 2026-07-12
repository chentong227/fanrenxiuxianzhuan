/* 登门切磋·真引擎冒烟：node test/spar.test.js
 * 覆盖：闭关自动调息续闭（不再心绪中断赶人）/ 切磋真战斗全链路（发起→打完→点到即止结算）。
 * 用 _loadgame 垫片加载真实引擎（与浏览器同源，零纸面副本）。 */
const G = require("./_loadgame.js");
const { State, Engine, WORLD } = G;

let failures = 0;
function assert(c, m) { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } }

// —— 开档到七玄门中期（有 npcFates 的最小可用局）——
State.create("测试子", "four");
const s = State.data;
s.realmIndex = 3;                 // 练气四层
s.storyStage = 99; s.pendingEvent = null;   // 掐断主线派发（只测系统）
s.flags.is_modafu = true;         // 交互解锁条件
s.location = "yaolu";
const NPCSIM = global.NPCSIM || (global.NPCSIM = require("../js/npcsim.js"));
if (!global.INTERACTIONS) global.INTERACTIONS = require("../js/interactions.js");
NPCSIM.init(s);

console.log("\n=== 1. 闭关：心浮自动停功调息，不再中断赶人 ===");
{
  s.mood = 10; s.moodMax = 100; s.spirit = 100; s.demon = 0;
  const m0 = State.absMonth();
  const cul0 = s.cultivation;
  Engine.doCultivate(6);
  const r = Engine._retreatSettle || {};   // 可能已被 flush；直接看账
  const spent = State.absMonth() - m0;
  assert(s.cultivation > cul0, `修为确有精进（+${s.cultivation - cul0}）`);
  assert(spent >= 6, `低心境闭关自动补调息月数（计划6月·实耗${spent}月）`);
  // 中断只剩「静室生变」一种（事件/战斗接管）——心境不再是赶人理由
  if (!s.combat && !s.pendingEvent) {
    assert((Engine._retreatResume == null) || (Engine._retreatResume.months > 0), "无事件时不留无意义的续闭快捷");
  } else {
    console.log("  ·（本次闭关触发了插曲事件——静室生变路径，跳过断言）");
    s.pendingEvent = null; s.combat = false; Engine._combat = null; Engine._combatMeta = null;
  }
}

console.log("\n=== 2. 切磋真战斗：发起→速决→点到即止结算 ===");
{
  const f = (s.npcFates || []).find(x => x.status === "alive");
  assert(!!f, `有活着的背景修士（${f && f.name}）`);
  f.realm = 2;   // 后进来讨教——玩家练气四层稳赢，速决可用
  s.hp = s.hpMax; s.spirit = 300;
  const rel0 = (s.relations && s.relations[f.id]) || 0;
  const body0 = s.body;
  Engine.startSparFight({ npcId: f.id, npcName: f.name });
  assert(!!Engine._combat && s.combat, "战斗会话已开（对手站上对阵轴）");
  assert(Engine._combatMeta.type === "spar", "战斗类型=spar");
  assert(Engine._combat.sides.length === 0, "演武无侧位——曲魂这等秘密不上台面");
  const foe = Engine._combat.enemies[0];
  assert(foe.name === f.name && foe.qiLayer === 2, `对手按其境界生成（${foe.name}·练气${foe.qiLayer}层）`);
  // 速决打完（碾压局白给）
  Engine._combat.autoResolve(Engine._combat.maxRounds);
  const won = Engine._combat.status === "win";
  Engine._finishCombat();
  assert(!s.combat && !Engine._combat, "战斗收场、会话清空");
  if (won) {
    assert(((s.relations && s.relations[f.id]) || 0) > rel0, `胜后交情上涨（${rel0}→${s.relations[f.id]}）`);
  } else {
    assert(s.hp >= Math.round(s.hpMax * 0.35), "败也点到即止——气血保底35%不重伤");
  }
  assert(s.body === body0 + 1, "切磋长体魄（+1）");
}

console.log("\n=== 3. 败局点到即止：不重伤、不长心魔 ===");
{
  const f = (s.npcFates || []).find(x => x.status === "alive");
  f.realm = 13;   // 找练气十三层前辈硬打——必败
  s.hp = s.hpMax; s.spirit = 300;
  const demon0 = s.demon;
  Engine.startSparFight({ npcId: f.id, npcName: f.name });
  Engine._combat.autoResolve(Engine._combat.maxRounds);
  const lost = Engine._combat.status !== "win";
  Engine._finishCombat();
  if (lost) {
    assert(s.hp >= Math.round(s.hpMax * 0.35), `败后气血保底（${s.hp}/${s.hpMax}≥35%）——演武非仇杀`);
    assert(s.demon <= demon0, `心魔不因演武落败滋长（${demon0}→${s.demon}）`);
  } else {
    console.log("  ·（AI 越13层打赢了？罕见——跳过败局断言）");
  }
}

console.log("\n=== 4. 风云榜·夺名比斗：胜则扬名+藏拙代价 / 败则名声受挫 / 复胜不新鲜 ===");
{
  const f = (s.npcFates || []).find(x => x.status === "alive");
  f.realm = 2;                       // 弱手——玩家练气四层稳赢
  s.hp = s.hpMax; s.spirit = 300;
  s.fame = 0;
  // 去抖：碾压局偶发「全身而退」勋章首解 +4 名望污染扬名断言（约 4% 抖动）——
  // 预置勋章计数至 3/5/10 里程碑之外，名望增量只剩比斗本身
  s.medals = { unscathed: 6, poison_master: 6, giant_slayer: 6 };
  s.revealedRealm = 0;               // 深藏：示人练气一层
  delete s.flags[`duel_won_${f.id}`];
  if (s.npcCd) delete s.npcCd[f.id];
  Engine.startFameDuel(f.id);
  assert(!!Engine._combat && Engine._combatMeta.type === "fame_duel", "夺名比斗开场（类型=fame_duel）");
  Engine._combat.autoResolve(Engine._combat.maxRounds);
  const won = Engine._combat.status === "win";
  Engine._finishCombat();
  if (won) {
    assert(s.fame === f.realm * 3 + 4, `首胜扬名（fame=${s.fame}=层数×3+4）`);
    assert(!!s.flags[`duel_won_${f.id}`], "胜绩入档（duel_won flag）");
    assert(s.revealedRealm === Math.min(s.realmIndex, f.realm - 1), `公开比斗抬示人境界（藏拙代价：revealedRealm=${s.revealedRealm}）`);
    // 复胜：不再新鲜（+2）
    if (s.npcCd) delete s.npcCd[f.id];
    const fame1 = s.fame;
    Engine.startFameDuel(f.id);
    Engine._combat.autoResolve(Engine._combat.maxRounds);
    const won2 = Engine._combat.status === "win";
    Engine._finishCombat();
    if (won2) assert(s.fame === fame1 + 2, `复胜只+2（${fame1}→${s.fame}）——旧闻不再新鲜`);
    else console.log("  ·（复胜局 AI 翻车——跳过复胜断言）");
  } else {
    console.log("  ·（AI 对低2层翻车？罕见——跳过胜局断言）");
  }
  // 败局：找练气十三层挨打
  const g = (s.npcFates || []).find(x => x.status === "alive" && x.id !== f.id) || f;
  g.realm = 13;
  if (s.npcCd) delete s.npcCd[g.id];
  s.hp = s.hpMax; s.spirit = 300;
  const fameBefore = s.fame;
  Engine.startFameDuel(g.id);
  Engine._combat.autoResolve(Engine._combat.maxRounds);
  const lost = Engine._combat.status !== "win";
  Engine._finishCombat();
  if (lost) {
    assert(s.fame === Math.max(0, fameBefore - 4), `当众落败名声受挫（${fameBefore}→${s.fame}）`);
    assert(s.hp >= Math.round(s.hpMax * 0.35), "比斗留手：败不重伤");
  } else {
    console.log("  ·（AI 越13层打赢了？罕见——跳过败局断言）");
  }
  // 远行后赛道关闭
  s.flags.arc1_complete = true;
  s.combat = false;
  Engine.startFameDuel(f.id);
  assert(!s.combat, "离了彩霞山：夺名赛道关闭（旧座次与你无关）");
  s.flags.arc1_complete = false;
}

console.log(failures ? `\n========== ${failures} 项未过 ==========\n` : "\n========== 切磋冒烟：全部通过 ✓ ==========\n");
process.exit(failures ? 1 : 0);
