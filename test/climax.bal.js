/* 高潮越阶战·一致感锚点蒙特卡洛：node test/climax.bal.js
 *
 * 立项依据：docs/playtest-fullrun-2026-06-30.md「全篇章高潮越阶战·一致感审计」。
 * 守的三条律（写新内容/改战斗数值后必跑绿）：
 *  1. 一致感：剧情许诺"凶险/越阶恶战"的战斗，数值上必须真凶险——不能末血 90%+ 毫发无伤。
 *  2. 越阶生存公理（pacing-design §五）：同阶碾压；越阶恶战赢不轻松、且一定见血。
 *  3. 爽文契约：输在准备、不输得莫名其妙——fail-forward（败有所得，非死锁）。
 *
 * ★ 方法（与 encounter.bal.js 的纸面副本不同·零漂移）：
 *   通过 test/_loadgame.js 在 node 下用 window/document 垫片**加载真实游戏引擎**
 *   （data/world/state/combat/story/chapters/engine 全真），再读**真实存档**、调**真实战斗装配**
 *   （Engine.startXxxFight——含真同道/真阵法/真站位/真 loadout），autoResolve 蒙特卡洛。
 *   ——量的就是玩家在那个剧情节点的真实战斗体验，不是重新构造的近似。
 *   覆盖：黄枫谷（墨蛟/封岳/陆云风）· 魔道（战王蝉/化茧铁罗）· 初入星海（婴鲤兽 v269）。
 *
 * ⚠ 口径：AI autoResolve≈高水位手操（走位/抓趁虚/抢秒），末血是乐观估计；真人无视预警更低。
 *   胜率含同道佐助＝真实玩家口径（非剥离的本体下限）。
 */
const fs = require("fs");
const path = require("path");
const G = require("./_loadgame.js");
const { State, Engine } = G;

let failures = 0;
function assert(c, m) { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } }
const pct = (x) => (x * 100).toFixed(0) + "%";

function loadSave(file) {
  const raw = fs.readFileSync(path.join(__dirname, "..", "playtest", file), "utf8");
  global.localStorage.setItem("frxxz_save_v1", raw);
  if (!State.load()) throw new Error("存档读取失败: " + file);
}

// 跑一场真实战斗 N 次（setup 负责装配并把战斗挂到 Engine._combat）
// addTrumps：可选，给玩家补"备战底牌"——验证越阶/恶战的底牌路径（爽文契约·输在准备）
function montecarlo(save, setup, N, addTrumps) {
  N = N || 120;
  loadSave(save);                       // 每场重置到存档初态（loadout/inventory/flags 真实）
  const baseFlags = JSON.stringify(State.data.flags);
  const baseInv = JSON.stringify(State.data.inventory || {});
  const baseSpells = JSON.stringify(State.data.spells || []);
  let wins = 0, hpSum = 0, rounds = 0, lose = 0, shareSum = 0, shareN = 0;
  for (let i = 0; i < N; i++) {
    State.data.flags = JSON.parse(baseFlags);
    State.data.inventory = JSON.parse(baseInv);
    State.data.spells = JSON.parse(baseSpells);
    if (addTrumps) {
      const inv = State.data.inventory;
      ["huoshe_fu", "hanbing_fu", "dingshen_fu", "anqi", "duyao_cao", "huixue_dan", "huiyuan_dan"].forEach(k => inv[k] = (inv[k] || 0) + 3);
      ["weidu", "feizhen", "huoshe_fu", "hanbing_fu", "dingshen_fu"].forEach(sp => { if (!State.data.spells.includes(sp)) State.data.spells.push(sp); });
    }
    State.data.pendingEvent = null; State.data.combat = false; State.data.exmap = null;
    State.data.hp = State.data.hpMax;
    setup();
    const c = Engine._combat;
    if (!c) throw new Error("战斗未装配");
    const st = c.autoResolve(40);
    if (st === "win") { wins++; hpSum += Math.max(0, c.player.hp / c.player.hpMax); }
    else lose++;
    rounds += c.round;
    // 玩家伤害占比（polish-huangfeng D1 门禁）：combat.dealtBy 分账——玩家亲手 vs 侧位同道
    const db = c.dealtBy || { player: 0, side: 0 };
    if (db.player + db.side > 0) { shareSum += db.player / (db.player + db.side); shareN++; }
  }
  return { win: wins / N, endHp: wins ? hpSum / wins : 0, rounds: rounds / N, lose: lose / N,
           playerShare: shareN ? shareSum / shareN : 1 };
}

console.log("\n=== 高潮越阶战·一致感锚点（真引擎·真存档·真战斗装配·含同道佐助） ===\n");

// —— 黄枫谷·墨蛟（越阶高潮·南宫婉同道·剧情=数值范本）——
// 锚点选 win-rate 恶战带（最稳健的"凶险"信号）：本体 loadout 下 30~85%＝赢不轻松、也非死局。
const mj = montecarlo("save-huangfeng-jindi.json", () => {
  Engine._nextFightType = "mojiao";
  Engine._sideOverride = Engine._nangongwanAlly ? Engine._nangongwanAlly() : null;
  Engine.startEncounterFight("mojiao");
});
console.log(`  · 墨蛟（练气11·南宫婉并肩）：胜率 ${pct(mj.win)} / 末血 ${pct(mj.endHp)} / ${mj.rounds.toFixed(1)}回合 / 玩家伤害占比 ${pct(mj.playerShare)}`);
assert(mj.win >= 0.30 && mj.win <= 0.85, `墨蛟胜率落在越阶恶战带 30~85%（${pct(mj.win)}）——赢不轻松、也非死局（一致感·防 boss 滑向无牙或死局）`);
// polish-huangfeng D1（GPT P1-5）：同道代打门禁——南宫婉改控场（月华绫·缚）后，这场高潮战
// 必须是玩家亲手打赢的：玩家（法术/法宝/毒）伤害占比 ≥35%，防止未来数值漂移让同道重新喧宾夺主。
assert(mj.playerShare >= 0.35, `墨蛟·玩家伤害占比 ≥35%（${pct(mj.playerShare)}）——同道牵制递局、玩家收口，仗得自己打（防同道代打回潮）`);

// —— 黄枫谷·封岳（狙杀者·越阶·底牌路径）：本体难胜，备底牌则可期（爽文契约·输在准备）——
const fyBare = montecarlo("save-huangfeng-jindi.json", () => {
  Engine._nextFightType = "fengyue"; Engine.startEncounterFight("fengyue");
});
const fyTrump = montecarlo("save-huangfeng-jindi.json", () => {
  Engine._nextFightType = "fengyue"; Engine.startEncounterFight("fengyue");
}, 120, true);
console.log(`  · 封岳（练气11·狙杀者）：本体 ${pct(fyBare.win)} → 备底牌 ${pct(fyTrump.win)}/末血${pct(fyTrump.endHp)}`);
assert(fyBare.win <= 0.55, `封岳·本体不轻取（≤55%·${pct(fyBare.win)}）——越阶靠底牌咬`);
assert(fyTrump.win - fyBare.win >= 0.10, `封岳·底牌路径成立：备底牌胜率显著回升（+${Math.round((fyTrump.win - fyBare.win) * 100)}pt）——输在准备、备则可期`);

// —— 黄枫谷·陆云风（同阶恶战·死局你不躲·底牌路径）——
const lyTrump = montecarlo("save-huangfeng-jindi.json", () => {
  Engine.startLuyunfengFight();
}, 120, true);
console.log(`  · 陆云风（同阶恶战·备底牌）：胜率 ${pct(lyTrump.win)} / 末血 ${pct(lyTrump.endHp)} / ${lyTrump.rounds.toFixed(1)}回合`);
assert(lyTrump.win >= 0.60, `陆云风·备底牌可胜（≥60%·${pct(lyTrump.win)}）——同阶恶战·准备到位则赢`);
assert(lyTrump.endHp <= 0.85, `陆云风·赢也有损耗：末血≤85%（${pct(lyTrump.endHp)}）——同阶恶战非无伤`);

// —— 初入星海·斩婴鲤兽（越阶高潮·v269 加蓄力杀招后·三人围杀）——
const yl = montecarlo("save-starsea-kuixing.json", () => {
  Engine.startStarseaYingliFight();
});
console.log(`  · 婴鲤兽（金丹大成·三人围杀·v269 蓄力杀招）：胜率 ${pct(yl.win)} / 末血 ${pct(yl.endHp)} / ${yl.rounds.toFixed(1)}回合`);
assert(yl.win >= 0.80, `婴鲤兽·三人阵高胜率（≥80%·${pct(yl.win)}）——越阶靠准备/同道，赢得漂亮`);
assert(yl.endHp <= 0.90, `婴鲤兽·蓄力杀招见牙：末血≤90%（${pct(yl.endHp)}）——v269 一致感修不被回滚（防再次滑成毫发无伤）`);

// —— 魔道·燕家堡战王蝉（撑血线大BOSS·剧情"货真价实的硬仗"）——
// 本体口径：撑血线即撤的逃逸式 boss，本体非稳赢、且赢也惨烈，印证剧情凶险。
const zwc = montecarlo("save-yanjiabao.json", () => {
  Engine._nextFightType = "zhanwangchan"; Engine.startEncounterFight("zhanwangchan");
});
console.log(`  · 战王蝉（筑基初·燕家堡大BOSS·本体）：胜率 ${pct(zwc.win)} / 末血 ${pct(zwc.endHp)} / ${zwc.rounds.toFixed(1)}回合`);
assert(zwc.win <= 0.80, `战王蝉·本体非稳赢（≤80%·${pct(zwc.win)}）——魔道巨擘·货真价实的硬仗`);
assert(zwc.endHp <= 0.80, `战王蝉·赢也惨烈：末血≤80%（${pct(zwc.endHp)}）——剧情凶险=数值凶险`);

// —— 魔道·化茧铁罗（二阶段搏命·跨场宿敌）——
const tl = montecarlo("save-modao-e3.json", () => {
  Engine._nextFightType = "tieluo_mao"; Engine.startEncounterFight("tieluo_mao");
});
console.log(`  · 化茧铁罗（筑基初·二阶段搏命）：胜率 ${pct(tl.win)} / 末血 ${pct(tl.endHp)} / ${tl.rounds.toFixed(1)}回合`);
assert(tl.endHp <= 0.82, `化茧铁罗·搏命见血：末血≤82%（${pct(tl.endHp)}）——化茧二阶段·不是无伤通过`);

// —— 魔道·五色门主（报仇高潮·polish-modao D3）：改前 100%/6回合无伤感→抬进恶战带 ——
const ws = montecarlo("save-modao-e3.json", () => {
  Engine._nextFightType = "wuse_menzhu"; Engine.startEncounterFight("wuse_menzhu");
});
console.log(`  · 五色门主（筑基初·报仇高潮）：胜率 ${pct(ws.win)} / 末血 ${pct(ws.endHp)} / ${ws.rounds.toFixed(1)}回合`);
assert(ws.win >= 0.60 && ws.win <= 0.92, `五色门主·报仇高潮落恶战带 60~92%（${pct(ws.win)}）——校准锚 ~85%·带宽容采样抖动±5pt（fail-forward 在，非死局）`);
assert(ws.endHp <= 0.85, `五色门主·报仇见血：末血≤85%（${pct(ws.endHp)}）——高潮不是无伤通过`);

// —— 魔道·胥王决战双分支（polish-modao D1·GPT P1-2）——
// 口径：save-modao-e3（筑基初期 ri13·真存档）+ autoResolve 悲观地板。fieldManual 六相 autoResolve
// 从不激活（真人手操另有合计 ≈28~41% hpMax 的阵法压制），故此处胜率均为深度悲观下限；
// 两线皆带 fail-forward（losses_xuwang +8%×3），永非死局。改前断崖：殁线 1.5% vs 存线 86.5%（85pt）。
// 改后：殁线宋蒙哀兵补位+平天尺底牌 → 地板 ≈35%；存线刘靖 aggr 8→6+减伤 → ≈82%/玩家占比 ≈67%。
const xwDie = montecarlo("save-modao-e3.json", () => {
  delete State.data.flags.liujing_survived;
  Engine.startXuwangFight();
});
console.log(`  · 胥王决战·殁线（宋蒙哀兵）：胜率 ${pct(xwDie.win)} / 末血 ${pct(xwDie.endHp)} / ${xwDie.rounds.toFixed(1)}回合 / 玩家占比 ${pct(xwDie.playerShare)}`);
assert(xwDie.win >= 0.25, `胥王·殁线地板 ≥25%（${pct(xwDie.win)}）——多数玩家线不再是 1.5% 断崖（哀兵补位+平天尺·真人手操六相更高）`);
assert(xwDie.win <= 0.60, `胥王·殁线仍是全章最陡 ≤60%（${pct(xwDie.win)}）——刘师兄的代价不能被补偿抹平`);
const xwLive = montecarlo("save-modao-e3.json", () => {
  State.data.flags.liujing_survived = true;
  Engine.startXuwangFight();
});
console.log(`  · 胥王决战·存线（刘靖并肩）：胜率 ${pct(xwLive.win)} / 末血 ${pct(xwLive.endHp)} / ${xwLive.rounds.toFixed(1)}回合 / 玩家占比 ${pct(xwLive.playerShare)}`);
assert(xwLive.win <= 0.92, `胥王·存线不躺赢 ≤92%（${pct(xwLive.win)}）——改命是奖励，不是免战牌`);
assert(xwLive.win >= xwDie.win + 0.15, `胥王·存线显著优于殁线（+${Math.round((xwLive.win - xwDie.win) * 100)}pt ≥15pt）——情报救人的因果仍有分量`);
assert(xwLive.playerShare >= 0.35, `胥王·存线玩家伤害占比 ≥35%（${pct(xwLive.playerShare)}）——刘靖 aggr 8→6 后仗得自己打（防同道代打回潮）`);
// —— polish-modao D7 配置断言：阵图升级线（六相是 fieldManual 真人手操·autoResolve 测不出差异，
//    故断言配置本身）：无 wuxing_zhen_full → 万象星河被裁（fieldCycle 6→5 相）；有 → 全量六相。
{
  loadSave("save-modao-e3.json");
  State.data.pendingEvent = null; State.data.combat = false; State.data.hp = State.data.hpMax;
  delete State.data.flags.wuxing_zhen_full;
  Engine.startXuwangFight();
  const fcBase = Engine._combat.fieldCycle || [];
  State.data.pendingEvent = null; State.data.combat = false; State.data.hp = State.data.hpMax;
  State.data.flags.wuxing_zhen_full = true;
  Engine.startXuwangFight();
  const fcFull = Engine._combat.fieldCycle || [];
  assert(fcBase.length === 5 && !fcBase.some(ph => /万象星河/.test(ph.name)),
    `胥王·无完整版阵图=六相缺万象星河（${fcBase.length}相）——齐云霄拍卖会的"准备苦"被看见`);
  assert(fcFull.length === 6 && /万象星河/.test(fcFull[5].name) && fcFull[5].suppress >= 0.13,
    `胥王·完整版阵图=全量六相含万象星河 climax（${fcFull.length}相·suppress ${fcFull[5] ? fcFull[5].suppress : "?"}）`);
}

// —— 魔道·皇宫四线群架（polish-modao D3·GPT P2-2）：占比观察行（演出性质群架·不设门禁只打印）——
const st3 = montecarlo("save-modao-e3.json", () => { Engine.startSantuanFight(); });
console.log(`  · 皇宫四线群架（观察行·不设门禁）：胜率 ${pct(st3.win)} / 玩家占比 ${pct(st3.playerShare)}（冰妖 hp170+同袍-10% 后锚 ~36%·35% 代打线上）`);

console.log(`\n========== 高潮战一致感锚点：${failures === 0 ? "全部通过 \u2713" : failures + " 项失败 \u2717"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
