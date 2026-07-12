/* ============================================================
 * 大陆旅途无头测试：node test/journey.test.js
 * 验证：启程→逐月走段→事件抉择→到达；探家剧情；gate 拦截；存档兼容。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = {};
const sandbox = {
  console, Math, Date, window: {},
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  setTimeout: () => 0, clearTimeout: () => {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.UI = new Proxy({}, { get() { return () => {}; } });
const ctx = vm.createContext(sandbox);

for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/exploremap.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  const code = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  vm.runInContext(code, ctx, { filename: f });
}

const { State, Engine, WORLD, Balance } = sandbox;

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ 失败: " + msg); failures++; }
}

console.log("\n=== 1. 大陆层数据完备 ===");
{
  assert(WORLD.continent && WORLD.continent.nodes.length >= 5, `大陆节点 ≥5（${WORLD.continent.nodes.length}）`);
  const qn = WORLD.continent.nodes.find(n => n.id === "qingniu");
  assert(qn && qn.visit === "home", "青牛镇为探家事件节点");
  const hf = WORLD.continent.nodes.find(n => n.id === "huangfeng");
  assert(hf && typeof hf.gate === "function", "黄枫谷有道途门槛");
  // 元武国·永久可进（黄枫谷篇起）：旅行节点 + 据点 + 道途门槛随洞府开通 + L2 去剪影
  const yw = WORLD.continent.nodes.find(n => n.id === "yuanwu");
  assert(yw && yw.locs && yw.locs.includes("yuanwu") && typeof yw.gate === "function", "元武国为可旅行节点（齐云霄百艺坊）");
  assert(yw.gate({ flags: {} }) && !yw.gate({ flags: { dongfu_done: true } }), "元武国道途随洞府落定开通（洞府前锁·洞府后通）");
  const ywLoc = WORLD.locations.find(l => l.id === "yuanwu");
  assert(ywLoc && ywLoc.arc === "huangfeng" && Array.isArray(ywLoc.actions), "元武国据点已立（黄枫谷篇）");
  const ywAtlas = WORLD.atlas.levels.tiannan.nodes.find(n => n.id === "yuanwuguo");
  assert(ywAtlas && !ywAtlas.silhouette && !ywAtlas.unlock({ flags: {} }) && !!ywAtlas.unlock({ flags: { dongfu_done: true } }), "L2 元武国去剪影·洞府落定后点亮");
}

console.log("\n=== 2. gate 拦截：升仙令未得不可去黄枫谷 ===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.location = "yaolu";
  s.pendingEvent = null;   // 测试径：跳过开场剧情
  Engine.startJourney("huangfeng");
  assert(!s.journey, "无升仙令：旅途未启动（道途未通）");
}

console.log("\n=== 3. 回乡探家全程 ===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.location = "yaolu";
  s.pendingEvent = null;
  s.silver = 30;
  s.age = 18;
  const m0 = State.absMonth();
  Engine.startJourney("qingniu");
  assert(s.journey || Engine._pendingFortune || Engine._afterFortuneHook, "旅途已启动");
  // 模拟玩家：逢抉择选第一项；逢战斗速胜；直到旅途（含返程）结束
  let guard = 0;
  while ((s.journey || Engine._pendingFortune || Engine._afterFortuneHook) && guard++ < 40) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) {
      Engine._combat.enemies.forEach(e => { e.hp = 0; });
      Engine._combat._checkEnd();
      Engine._finishCombat();
      continue;
    }
    break;
  }
  assert(!s.journey && !Engine._pendingFortune, `旅途全程结束（${guard} 步模拟）`);
  assert(State.absMonth() > m0, `光阴真实流逝（${State.absMonth() - m0} 月）`);
  assert(s.location === "yaolu", `归程后回到药庐（实际 ${s.location}）`);
  assert((s.milestones || []).some(m => /回乡/.test(m.title)) || !s.ledger.home_visited_qixuan,
    "探家入年表（若选了陪伴径）");
}

console.log("\n=== 4. 存档兼容：旅途中断字段无损 ===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.journey = { to: "qingniu", toName: "青牛镇", leg: 0, total: 1 };
  State.save();
  State.load();
  assert(State.data.journey && State.data.journey.to === "qingniu", "journey 字段存档往返无损");
}

console.log("\n=== 5. 离门远行 · 嘉元城主线全链路 ===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.location = "yaolu";
  s.pendingEvent = null;
  s.storyStage = sandbox.STORY.findIndex(st => st.id === "mo_arrive");   // 直接对位嘉元城章节
  s.flags.arc1_complete = true;
  s.flags.han_du = true;
  State.give("shengxian_ling", 1);   // 七玄门篇通关所得（测试跳过 arc_end，手动补发）
  s.realmIndex = 5; s.hp = 120; s.hpMax = 120; s.silver = 40;
  s.sideUnit = { id: "zhangtie_corpse", name: "铁奴·张铁", hp: 70, hpMax: 70, atk: 12,
                 atkName: "尸傀挥击", nature: "corpse", guard: 0.3, status: "ok", carry: true };
  // 启程嘉元城（旅途中事件全选第一项，战斗速胜）
  Engine.startJourney("jiayuan");
  let guard = 0;
  while ((s.journey || Engine._pendingFortune) && guard++ < 40) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) {
      Engine._combat.enemies.forEach(e => { e.hp = 0; });
      Engine._combat._checkEnd();
      Engine._finishCombat();
      continue;
    }
    break;
  }
  assert(s.location === "jiayuan_city", `到达嘉元城（实际 ${s.location}）`);
  // 到达即触发投信剧情（checkStory 在 passTime/行动后调度——手动触发对齐）
  Engine.checkStory();
  assert(s.pendingEvent === "mo_arrive", `投信剧情触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.mo_met, "投信完成（mo_met）");
  assert(s.metNpcs.includes("mocaihuan"), "墨彩环录入图鉴");
  // 客居一月 → 宵小夜探（考据修正：动漫线无欧阳飞天战——墨府之危是氛围与远线，五色门在京城篇兑现）
  Engine.passTime(1);
  Engine.checkStory();
  assert(s.pendingEvent === "mo_crisis", `客居月余，宵小夜探（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.mo_warned, "墨府之危已现（mo_warned）");
  // 宝玉解毒 + 曲魂留府（固定剧情：动漫线，铺曲魂夺舍/奇虫榜远线）
  Engine.checkStory();
  assert(s.pendingEvent === "mo_resolve", `暖阳宝玉一幕触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.han_du_cured, "寒毒得解");
  assert(State.count("nuanyang_yu") === 1, "暖阳宝玉入袋");
  assert(!s.sideUnit, "曲魂留墨府（固定剧情，侧位移交）");
  assert(s.ledger && s.ledger.quhun_left_mo, "因果账本记下曲魂之托");

  // —— 站三：太南小会（万小山/赶集/长春后篇/青纹阴谋）——
  State.give("lingshi", 12);
  s.journey = null;
  Engine.startJourney("tainangu");
  let g3 = 0;
  while ((s.journey || Engine._pendingFortune) && g3++ < 40) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) {
      Engine._combat.enemies.forEach(e => { e.hp = 0; });
      Engine._combat._checkEnd();
      Engine._finishCombat();
      continue;
    }
    break;
  }
  assert(s.location === "tainan_fair", `到达太南小会（实际 ${s.location}）`);
  Engine.checkStory();
  assert(s.pendingEvent === "wan_meet", `万小山相迎触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.wan_met && s.metNpcs.includes("wanxiaoshan"), "万小山结识入图鉴+账本");
  // 赶集：买长春功后篇（彩蛋返灵石）
  const stoneBefore = State.count("lingshi");
  Engine.fairBuy("changchun_houpian");
  assert(State.count("changchun_houpian") === 1, "《长春功·后篇》购得");
  assert(State.count("lingshi") === stoneBefore - 5 + 1, "「不占便宜」彩蛋返灵石×1");
  // 买动一次后青纹阴谋触发
  Engine.checkStory();
  assert(s.pendingEvent === "qingwen_plot", `青纹阴谋触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.ledger.qingwen_grudge, "青纹梁子记入账本（黑煞教伏笔）");
  // 后篇研习 → 突破8层 gating 解除（黄枫谷篇 cap 已放开至练气十三层）
  s.activeChapter = "huangfeng";
  s.unlockedChapters = ["qixuan", "huangfeng"];
  s.realmIndex = 6; s.cultivation = 999999;
  const before = Engine.canBreakthrough();
  assert(!before.ok && /后篇/.test(before.reason), "未习后篇：冲八层被拦（大件 gating）");
  const lr = sandbox.Loadout.learnTechnique(s, "changchun_full");
  assert(lr.ok, "研习《长春功·后篇》成功");
  assert(sandbox.Loadout.knownPool(s).includes("huodan"), "火弹术随后篇入池（考据：小法术尽出于此）");
  const after = Engine.canBreakthrough();
  assert(after.ok, "习得后篇：八层之路开启");

  // —— 站四：升仙大会收官（同道首战→日历锚→落选→复仇→入谷）——
  s.activeChapter = "qixuan";   // 回到离门远行流程
  // 同道首战：万小山搭伴探山（会期前1月窗口开）
  while (State.absMonth() < (s.flags.xianhui_due || 0) - 1) Engine.passTime(1);
  Engine.checkStory();
  assert(s.pendingEvent === "wan_hunt", `搭伴探山触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.combat && Engine._combat && Engine._combat.side && Engine._combat.side.kind === "ally",
    "同道参战：万小山在侧（ally 架构）");
  // 验证同道自动出手
  const wolfHp0 = Engine._combat.enemies[0].hp;
  Engine._combat.endRound();
  // 速胜
  let g4 = 0;
  while (s.combat && Engine._combat && g4++ < 10) {
    Engine._combat.enemies.forEach(e => { e.hp = 0; });
    Engine._combat._checkEnd();
    if (Engine._combat.status !== "ongoing") Engine._finishCombat();
    else Engine._combat.endRound();
  }
  assert(s.flags.wan_hunt_done && s.ledger.wan_hunt_together, "并肩之战入账本");
  // 日历锚：等到会期
  while (State.absMonth() < s.flags.xianhui_due) Engine.passTime(1);
  Engine.checkStory();
  assert(s.pendingEvent === "xianhui_open", `会期已至，升仙大会触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.xianhui_done, "测灵璧落选（伪灵根）");
  // 万小山之死 → 复仇战
  Engine.checkStory();
  assert(s.pendingEvent === "wan_death", `林间血案触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.combat && Engine._combat && Engine._combat.enemies.length === 2, "复仇战开打（二人当面，一人遁走）");
  assert(s.ledger.sanxiu_escaped, "遁走者入账（远雷）");
  let g5 = 0;
  while (s.combat && Engine._combat && g5++ < 10) {
    Engine._combat.enemies.forEach(e => { e.hp = 0; });
    Engine._combat._checkEnd();
    if (Engine._combat.status !== "ongoing") Engine._finishCombat();
    else Engine._combat.endRound();
  }
  assert(s.flags.wan_avenged, "血债已收（wan_avenged）");
  // 入谷收官
  Engine.checkStory();
  assert(s.pendingEvent === "xianhui_end", `升仙令入谷触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.departure_complete, "离门远行 · 完");
  // 启程黄枫谷 → 篇章切换
  Engine.startJourney("huangfeng");
  let g6 = 0;
  while ((s.journey || Engine._pendingFortune) && g6++ < 40) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) {
      Engine._combat.enemies.forEach(e => { e.hp = 0; });
      Engine._combat._checkEnd();
      Engine._finishCombat();
      continue;
    }
    break;
  }
  assert(s.location === "huangfeng_gate", `抵达黄枫谷外门（${s.location}）`);
  assert(s.flags.huangfeng_entered && s.activeChapter === "huangfeng", "黄枫谷篇 · 启（章节切换）");

  // —— 黄枫谷 · 入谷四连（吴师叔→夺丹→掌门→百药园）——
  Engine.checkStory();
  assert(s.pendingEvent === "hf_arrive", `吴师叔领入谷触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.hf_arrived && s.metNpcs.includes("wushishu") && s.ledger.wu_kindness, "吴师叔提点之恩入册");
  Engine.checkStory();
  assert(s.pendingEvent === "hf_duodan", `夺丹一幕触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.zhuji_dan_stolen && s.ledger.zhuji_dan_grudge, "筑基丹得而复失（恨点入账）");
  assert(s.metNpcs.includes("luyunfeng") && s.metNpcs.includes("yeshishu"), "陆云风/叶师叔入图鉴");
  Engine.checkStory();
  assert(s.pendingEvent === "hf_zhangmen", `掌门殿一幕触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.zhangmen_seen && s.ledger.zhangmen_no_justice, "掌门无公道入账");
  Engine.checkStory();
  assert(s.pendingEvent === "hf_yaoyuan", `百药园一幕触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.flags.yaoyuan_started && s.ledger.ma_approval, "百药园差事开启+马师伯认可");
  // 药园差事一轮（本分打理）
  const alchBefore = (s.skills && s.skills.alchemy) || 0;
  Engine.yaoyuanWork();
  assert(!!Engine._pendingFortune, "差事抉择弹出");
  Engine.chooseFortune(0);
  assert(((s.skills && s.skills.alchemy) || 0) === alchBefore + 1, "本分打理：药理+1（嗑瓜子产出）");
  assert(s.flags.xueshi_due > 0, "血色禁地日历锚已立（天命栏倒计时）");

  // —— 坊市归途：杀陆云风救陈巧倩（条件锚：十一层+坊市购物）——
  s.realmIndex = 10;   // 练气十一层
  State.give("lingshi", 5);
  Engine.wanbaoBuy("huixue_dan");
  Engine.checkStory();
  assert(s.pendingEvent === "chen_rescue", `坊市归途剧情触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 0);
  assert(s.combat && Engine._combat && Engine._combat.enemies[0].name === "陆云风", "陆云风之战开打（同阶恶战）");
  let g7 = 0;
  while (s.combat && Engine._combat && g7++ < 10) {
    Engine._combat.enemies.forEach(e => { e.hp = 0; });
    Engine._combat._checkEnd();
    if (Engine._combat.status !== "ongoing") Engine._finishCombat();
    else Engine._combat.endRound();
  }
  assert(s.flags.luyunfeng_dead, "陆云风伏诛");
  assert(State.count("zhuji_dan") === 2, "夺回筑基丹×2（恨账收一半利息）");
  assert(s.metNpcs.includes("chenqiaoqian"), "陈巧倩入图鉴");
  // 忘尘丹之择：选「不喂」（改命起点）
  Engine.checkStory();
  assert(s.pendingEvent === "chen_after", `林中事了一幕触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY[s.storyStage], 1);
  assert(s.ledger.chen_remember && !s.ledger.chen_wangchen, "不喂忘尘丹：她记得你（命途道岔写账）");
  // polish-huangfeng A1①：名额大会=日历锚+修为双门槛（xianhui_due 同构）——修为先到者等大比时节开锣。
  assert(s.pendingEvent !== "jindi_meeting", "时节未至：名额大会不随到随开（日历锚是真门槛）");
  while (State.absMonth() < s.flags.xueshi_due) Engine.passTime(1);
  Engine.checkStory();
  assert(s.pendingEvent === "jindi_meeting", `大比时节已至+练气十一层：名额大会触发（${s.pendingEvent}）`);
  assert(s.flags.xueshi_opened, "名额 onArrive 已置 xueshi_opened");
  assert(s.metNpcs.includes("nangongwan") && s.metNpcs.includes("lihuayuan"), "南宫婉/李化元入图鉴");
  s.pendingEvent = null;   // 名额已开；下面先验法器装备系统，稍后再“踏入血幕”

  // —— 法器装备系统：千年灵草变现 → 万宝楼买金蚨子母刃 → 装备（属性+技能+特性）——
  assert(s.flightId === "qingye_fazhan", "入谷已领青叶法器（第一件飞行法器）");
  State.give("qiannian_lingcao", 2);
  Engine.wanbaoSell("qiannian_lingcao");
  Engine.wanbaoSell("qiannian_lingcao");
  assert(State.count("lingshi") >= 44, `千年灵草×2变现44灵石（现 ${State.count("lingshi")}）`);
  const senseBeforeBuy = s.sense;
  Engine.wanbaoBuy("jinfuzi_ren");
  assert(State.count("jinfuzi_ren") === 1, "金蚨子母刃购得（小绿瓶的奇迹=法器的本钱）");
  assert(s.gear.weapon === "jinfuzi_ren", "武器槽已装备");
  assert(s.sense === senseBeforeBuy + 2, "属性即时结算（神识+2）");
  const pf = Engine.playerFighter();
  assert(pf.spells.includes("zimu_ren"), "战斗技「子母双刃」入战（装备授予）");
  // 玄铁巨盾：hpMax+特性
  State.give("xuantie_dun", 1);
  const hpMaxBefore = s.hpMax;
  Engine.equipGear("xuantie_dun");
  assert(s.hpMax === hpMaxBefore + 30, "玄铁巨盾：气血上限+30");
  const pf2 = Engine.playerFighter();
  assert(pf2.chargeResist === 0.3, "特性「山岳之御」入战（蓄力重击减伤30%）");
  // 越阶催动：低修为也能装备（灵力消耗倍增，不设硬门槛）
  s.realmIndex = 5;
  Engine.unequipGear("weapon");
  Engine.equipGear("jinfuzi_ren");
  assert(s.gear.weapon === "jinfuzi_ren", "练气六层越阶催动顶阶法器（不拦截装备）");
  const mpMul = Balance.gearLayerMpMul(6, 11);
  assert(mpMul > 1, `越阶催动灵力消耗倍增（×${mpMul.toFixed(1)}）`);
  s.realmIndex = 10;
}

console.log("\n=== 5.5 血色试炼 → 筑基 → 青元剑诀 → 黄枫谷篇收口 ===");
{
  const s = State.data;
  s.realmIndex = 10;
  // 名额大会已在大比时节+练气十一层双门槛齐备后开启（A1① 日历锚）——名额到手后先过「临行三月备战」互斥窗口，再踏入血幕。
  assert(s.flags.xueshi_opened, "名额已开（日历锚+修为双门槛齐备）");
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "jindi_meeting"), 0);
  // —— 时间窗口互斥·首例：血色禁地临行三月三选一（修为/底牌/丹药）——
  assert(s.pendingEvent === "jindi_prep", "名额到手→临行三月备战互斥窗口（jindi_prep）");
  const prepHpStock = State.count("huoshe_fu");
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "jindi_prep"), 1);   // 选「坊市备底牌」
  assert(s.flags.jindi_prep_done && s.flags.jindi_prep_stock, "备战窗口：选了坊市备底牌（互斥·已锁定）");
  assert(State.count("huoshe_fu") === prepHpStock + 2, "备底牌：火蛇符×2 入袋");
  // —— 五日禁地（v3 舆图）：备战毕→踏入血幕开 L1 ——
  assert(s.exmap && s.exmap.stack.length === 1, "踏入血幕：L1 舆图已开（exmap 会话）");
  const EM = sandbox.ExploreMap;
  assert(EM.cur(s.exmap).node === "rukou", "起点=血幕裂口");
  // 外环采药（东圃）
  Engine.exmapTravel("waipu_d");
  Engine.exmapGather();
  assert((s.exmap.bag.xueshi_zhuyao || 0) >= 1, `外环主药入袋（${s.exmap.bag.xueshi_zhuyao}）`);
  // 踩进中环——封岳巡逻撞个正着（route: liechang→zhongtan→yanxue→zhongtan）
  Engine.exmapTravel("zhongtan");
  assert(s.combat && Engine._combat && Engine._combat.enemies[0].name === "封岳", "中环撞上封岳=遭遇战");
  Engine._combat.enemies.forEach(e => { e.hp = 0; });
  Engine._combat._checkEnd();
  Engine._finishCombat();
  assert(s.flags.fengyue_dead && s.flags.jindi_mid_done, "封岳伏诛（狙杀者反被猎）");
  assert(State.count("tayun_xue") === 1, "踏云靴到手（杀手的脚程归你）");
  assert(s.exmap && EM.patrolAt(s.exmap) === null, "封岳死后：禁地杀气消散（巡逻清除）");
  // 中环厚药 + 古阵读图
  Engine.exmapGather();
  assert((s.exmap.bag.xueshi_zhuyao || 0) >= 4, `中环厚药入袋（共 ${s.exmap.bag.xueshi_zhuyao}）`);
  Engine.exmapTravel("guzhen");
  Engine.exmapReadLore();
  assert(EM.cur(s.exmap).intel.patrol_route, "古阵残纹：全图+路线情报");
  // 踏云靴=swift 特性：装备后战斗移动力+1
  s.realmIndex = 12;   // 练气十三层（驱使门槛11层）
  Engine.equipGear("tayun_xue");
  assert(s.gear.accessory === "tayun_xue", "踏云靴已装备（饰物槽）");
  const pfSwift = Engine.playerFighter();
  assert(pfSwift.move === 2, "足下生云：战斗移动力 2（雷遁拉扯的前身）");
  // —— 深潭洞口 → L3 墨蛟洞（洞口印记+轴式洞窟：探索格=战斗格）——
  Engine.exmapTravel("shentan");
  Engine.exmapEnterSub();
  assert(!!Engine._pendingFortune, "洞口临渊确认弹出");
  Engine.chooseFortune(0);   // 立印记入洞
  assert(s.exmap.stack.length === 2 && EM.cur(s.exmap).kind === "cave", "压栈入洞（L3 轴式 cave 帧）");
  assert(!!s._caveSnap, "洞口印记已立（败退可重来）");
  // 走格采集（空间化：走到跟前才能采）——稳手只采一株，把惊动留给布置
  Engine.exmapCaveMove(7);
  Engine.exmapCaveTake("zhuyao1");   // pos 8 邻格
  Engine.exmapCaveMove(17);          // 走近战团（≥17 触发观战）
  assert((s.exmap.bag.xueshi_zhuyao || 0) >= 6, `主药凑足（共 ${s.exmap.bag.xueshi_zhuyao}）`);
  const cf = EM.cur(s.exmap);
  assert(cf.intel.cave_watch, "走近战团：观战得情报（决战先机）");
  assert((cf.expose || 0) < 50, `稳手未惊动（expose=${cf.expose}）`);
  // —— 战前布置到格（韩立式谋定后动：诱敌入阵的物理语义）——
  State.give("zhenqi_kunzu", 1); State.give("huoshe_fu", 2);
  Engine.exmapCavePlace("kunzu", 16);
  Engine.exmapCaveMove(19);
  Engine.exmapCavePlace("anfu", 21);
  assert(cf.preps.kunzu === 16 && cf.preps.anfu === 21, "困足阵+伏火符落位到格");
  assert(State.count("zhenqi_kunzu") === 0, "阵旗实扣（布置即消耗）");
  // —— 出手即开战：攻击常驻但射程是真尺——隔太远打不出，走近了第一招就是宣战 ——
  const farHand = Engine.cavePlayerSpells();
  const farFu = farHand.find(h => h.id === "huoshe_fu");
  assert(farFu && !farFu.ok, `距6格火蛇符还够不着（${farFu && farFu.why}）`);
  Engine.exmapCaveMove(21);   // 贴到4格：火蛇符射程内（近身惊动+6，仍未破限）
  const hand2 = Engine.cavePlayerSpells();
  assert(hand2.find(h => h.id === "huoshe_fu" && h.ok), "走近4格：火蛇符够得着了（射程=同一把尺）");
  assert((EM.cur(s.exmap).expose || 0) < 50, `贴近的代价已付仍未惊动（expose=${EM.cur(s.exmap).expose}）`);
  Engine.exmapCaveStrike("huoshe_fu");
  const cc = Engine._combat;
  assert(s.combat && cc && cc.enemies[0].name === "墨蛟", "墨蛟之战开打（第一招即宣战）");
  assert(cc.enemies[0].hp < cc.enemies[0].hpMax, `开战第一击已落（墨蛟 ${cc.enemies[0].hp}/${cc.enemies[0].hpMax}）`);
  assert(cc._pQuickUsed, "火蛇符是瞬发开局——主行动还在手里");
  assert(cc.W === 27, `战场=探索轴（W=${cc.W}，27 格长轴战）`);
  assert(cc.player.pos === 21 && cc.enemies[0].pos === 25, `站位无缝继承（我${cc.player.pos}，敌${cc.enemies[0].pos}）`);
  assert(cc.side && cc.side.name === "南宫婉", "南宫婉从观战位原地参战（同道侧位）");
  assert((cc.enemies[0].exposed || 0) >= 1, "观战先机兑现：墨蛟开局破绽大开");
  assert((cc.enemies[0].status.dingshen || 0) >= 1, "偷袭得手：未惊动开战=墨蛟首拍措手不及（攻击常驻的先机）");
  assert(cc.zones.some(z => z.type === "kunzu" && z.from === 15 && z.team === "player"), "困足阵原格预铺（第16~18步）");
  assert(cc.mines.some(m => m.kind === "anfu" && m.cell === 21), "伏火符埋设原格（第22步）");
  // 同轴一体：没采完的热点原格在战斗轴上，战中走到跟前花一个主行动照采
  assert((cc.hotspots || []).some(h => h.id === "laozh" && h.pos === 21), "余下热点带进战斗轴（21步老株还在）");
  const bagBefore = s.exmap.bag.xueshi_zhuyao || 0;
  Engine.combatTake("laozh");   // 玩家21，老株21：同格（瞬发开局没占主行动——还摘得动）
  assert((s.exmap.bag.xueshi_zhuyao || 0) === bagBefore + 2, "战中采得主药×2（一边打一边贪）");
  assert(cc._pActsUsed >= 1, "战中采集吃掉主行动（蹲下去摘的那一拍不打人）");
  assert(EM.cur(s.exmap).taken.laozh, "战中采过，洞窟帐面同步（探索/战斗一本账）");
  // 地雷实弹：把墨蛟挪到伏火符格验证触发
  const mj = cc.enemies[0];
  const hpBefore = mj.hp;
  mj.pos = 21; cc._checkMine(mj);
  assert(mj.hp < hpBefore, `墨蛟踩雷（-${hpBefore - mj.hp}）——诱敌入局兑现`);
  Engine._combat.enemies.forEach(e => { e.hp = 0; });
  Engine._combat._checkEnd();
  Engine._finishCombat();
  assert(s.flags.mojiao_slain, "墨蛟伏诛");
  assert(State.count("mojiao_jiao") >= 1 && State.count("mojiao_lin") >= 1, "墨蛟角鳞到手（乌龙夺/神风舟的料）");
  assert(!s.exmap && s.flags.jindi_left, "决战告捷：出洞出图（五日血色收官）");
  assert(State.count("xueshi_zhuyao") >= 6, `主药并入行囊（${State.count("xueshi_zhuyao")}）`);
  if (!s.pendingEvent) Engine.checkStory();
  assert(s.pendingEvent === "mojiao_after", `潭边一幕触发（${s.pendingEvent}）`);
  const hornBefore = State.count("mojiao_jiao");   // 炼乌龙夺前的蛟角数（拜师后炼器节点会消耗一只）
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "mojiao_after"), 0);
  assert(s.flags.mojiao_resolved, "拜入李化元门下（记名弟子）");
  assert(s.ledger.mojiao_neidan, "「内丹」入账（来路日后见分晓）");
  // —— 妖材成器：齐云霄代炼乌龙夺（四爪毒法宝，妖材→法宝链首件落地，拜师后紧接自动触发）——
  // 节点 onArrive 在触发即结算（playStage）：消蛟角、得乌龙夺、置 flag——故此处已成既定事实
  if (!s.pendingEvent) Engine.checkStory();
  assert(s.pendingEvent === "wulong_forge", `蛟角成器一幕触发（${s.pendingEvent}）`);
  assert(s.flags.wulong_forged, "乌龙夺已炼成（flag）");
  assert(State.count("wulong_duo") === 1, `乌龙夺入囊（${State.count("wulong_duo")}）`);
  assert(State.count("mojiao_jiao") === hornBefore - 1, "炼器消耗一只蛟角");
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "wulong_forge"), 0);   // 推进过该节点
  Engine.equipGear("wulong_duo");
  assert(s.gear.weapon === "wulong_duo", "乌龙夺佩为主攻位（四爪毒法宝）");
  assert(Engine.playerFighter().spells.includes("wulong_zhua"), "乌龙夺授予战斗技「乌龙夺」(wulong_zhua) 入战");
  // —— 地火炼丹：筑基丹满匣 ——
  s.location = "huangfeng_gate";
  State.give("lingcao", 6);
  Engine.lianZhujiDan();
  assert(State.count("zhuji_dan") >= 14, `筑基丹满匣（实际 ${State.count("zhuji_dan")}）`);
  assert(s.flags.zhuji_lian_done, "炼丹已成（图鉴空位闭合）");
  // —— 狂嗑筑基（大境界突破：四层->十三层->筑基）——
  s.pendingEvent = null;
  s.realmIndex = 12;
  s.cultivation = State.realm().culMax;
  s.spirit = State.realm().spMax;
  s.mood = s.moodMax; s.demon = 0;
  let tries = 0;
  while (State.realm().tier !== "foundation" && tries++ < 30) {
    Engine.attemptBreakthrough();
    if (s.combat && Engine._combat) {   // 心魔劫：直接打赢（含多阶段波次）
      // 杀完所有波次（大境界心魔劫=三阶段）
      let guard = 0;
      while (Engine._combat && Engine._combat.status === "ongoing" && guard++ < 10) {
        Engine._combat.enemies.forEach(e => { e.hp = 0; });
        Engine._combat._checkEnd();
        // 若有波次待刷，手动触发刷波
        if (Engine._combat.status === "ongoing" && Engine._combat._pendingEnemyWaves && Engine._combat._pendingEnemyWaves.length > 0) {
          Engine._combat._maybeSpawnWave();
        }
      }
      Engine._finishCombat();
    }
    s.cultivation = State.realm().culMax;
    s.spirit = State.realm().spMax;
    s.mood = s.moodMax; s.demon = 0;
    if (!State.count("zhuji_dan")) State.give("zhuji_dan", 1);   // 兜底：丹耗尽补一颗（19败1成的真实）
  }
  assert(State.realm().tier === "foundation", `筑基成功（${State.realm().name}，历 ${tries} 次冲关）`);
  assert((s.poolBonus || 0) > 0, `突破水准刻进气海（poolBonus=${s.poolBonus}）`);
  // —— 青元剑诀（主修换代）：突破结算时已自动触发（onArrive 即换）——
  if (s.pendingEvent === "qingyuan_gift") Engine.chooseStory(sandbox.STORY.find(x => x.id === "qingyuan_gift"), 0);
  assert(s.flags.qingyuan_given, "李化元赠诀已发生（qingyuan_given）");
  assert(s.technique === "qingyuan_sword", "主修已换《青元剑诀》");
  assert(s.spells.includes("qingyuan_jianmang"), "青元剑芒入战");
  const pfQy = Engine.playerFighter();
  assert(pfQy.grade === 3, "玄阶功法品阶生效（灵力池随之上涨）");
  // —— 洞府选址 ——
  if (!s.pendingEvent) Engine.checkStory();
  assert(s.pendingEvent === "dongfu_pick", `洞府选址触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "dongfu_pick"), 0);
  assert(s.flags.dongfu_type === "lingquan", "灵泉眼洞府落成（修炼+15%）");
  // —— 赴元武国代工（增量C：齐云霄一炉三件·首访不遇辛如音）——
  assert(!s.pendingEvent, "洞府落定后挂在「赴元武国」地点门禁（未就地触发叶师叔）");
  if (State.count("mojiao_pi") < 1) State.give("mojiao_pi", 1);     // 兜底：神风舟料在手
  if (State.count("mojiao_jiao") < 1) State.give("mojiao_jiao", 1); // 兜底：乌龙夺料在手
  State.give("qiannian_lingcao", 1);                                // 玩家此前已售，补一株以验消耗路径
  const matBefore = { jiao: State.count("mojiao_jiao"), pi: State.count("mojiao_pi"), qnc: State.count("qiannian_lingcao") };
  s.location = "yuanwu";
  Engine.checkStory();
  assert(s.pendingEvent === "qiyunxiao_daigong", `元武国代工触发（${s.pendingEvent}）`);
  assert(s.metNpcs.includes("qiyunxiao"), "齐云霄入图鉴");
  assert(!s.metNpcs.includes("xinruyin"), "首访不遇辛如音（留再别天南）");
  // M3 取舍：三选一「首炼精工」——idx0=先炼乌龙夺（三件皆得，精工那件带永久乘性微增益）
  const daigongNode = sandbox.STORY.find(x => x.id === "qiyunxiao_daigong");
  assert(daigongNode.choices.length === 3, `代工首炼三选一（${daigongNode.choices.length}）`);
  Engine.chooseStory(daigongNode, 0);
  assert(s.flags.daigong_fine_wulong, "首炼精工=乌龙夺（互斥取舍已锁定）");
  assert(State.count("wulong_duo") === 1, "乌龙夺到手（御物·破甲水攻法宝）");
  assert(s.flightId === "shen_feng_zhou", "神风舟到手（御风提速）");
  assert(State.count("wuxing_zhen") === 1, "颠倒五行阵图·基础版到手");
  assert(State.count("mojiao_jiao") === matBefore.jiao, "墨蛟之角已在炼器前消耗（wulong_forge 已扣，代工不再扣）");
  assert(State.count("mojiao_pi") === matBefore.pi - 1, "墨蛟之皮实扣（神风舟料）");
  assert(State.count("qiannian_lingcao") === matBefore.qnc - 1, "千年灵草实扣（颠倒五行阵引）");
  assert(s.flags.daigong_done, "代工完成（daigong_done）");
  // —— 叶师叔之报（黄枫谷篇收口·回山门触发）——
  s.location = "huangfeng_gate";
  if (!s.pendingEvent) Engine.checkStory();
  assert(s.pendingEvent === "ye_finale", `叶师叔之报触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "ye_finale"), 0);
  assert(s.flags.huangfeng_complete, "黄枫谷篇 · 完（huangfeng_complete）");
  assert(s.ledger.dayan_clue, "大衍诀残卷线索入账（魔道争锋篇的钩子）");

  // —— 5.5b 篇终帆段 + 厉飞雨回访（polish-huangfeng B2/C1·v318）——
  // 调令延后 3 月（安家修行帆段）；帆段内赴彩霞山演武厅=回访兑现窗（三笔远雷账在此 settle）
  if (!s.pendingEvent) Engine.checkStory();
  assert(!s.pendingEvent, `帆段起点：调令未至（延后 3 月·当前 pending=${s.pendingEvent}）`);
  s.location = "wuting";
  Engine.checkStory();
  assert(s.pendingEvent === "lify_revisit", `彩霞山回访触发（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "lify_revisit"), 1);   // 选叙旧路（战斗路另有引擎冒烟）
  assert(s.flags.lify_revisit_done, "回访节点收口（lify_revisit_done）");
  assert(s.flags.lify_ledgers_settled, "厉飞雨三账结算标记（lify_ledgers_settled）");
  // —— 5.6 魔道争锋篇·前置：燕家堡之战（增量D·李化元强制进场→重逢→战王蝉大BOSS→逃出强征入伍）——
  // 同一个韩立续战：篇末调令延时 3 月后自动演出（无 where，靠 flag+时间门禁顺序触发）
  Engine.passTime(3);
  Engine.checkStory();
  assert(s.pendingEvent === "yanjia_summon", `燕家堡调令链式触发（${s.pendingEvent}）`);
  assert(s.activeChapter === "modao", "魔道争锋篇章容器已开（activeChapter=modao）");
  assert(sandbox.Chapters.realmTier() === 1, `realmCap 抬进筑基（realmTier=${sandbox.Chapters.realmTier()}）`);
  assert(sandbox.Chapters.realmCap() === 13, `本篇境界上限=筑基初期（realmCap=${sandbox.Chapters.realmCap()}）`);
  assert(s.location === "yanjiabao", `强制进场燕家堡（location=${s.location}）`);
  assert(s.unlockedChapters && s.unlockedChapters.includes("modao"), "modao 篇章已解锁入档");
  // 调令 → 重逢
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "yanjia_summon"), 0);
  assert(s.pendingEvent === "yanjia_reunion", `北上即重逢（${s.pendingEvent}）`);
  assert(s.metNpcs.includes("mocaihuan"), "重逢墨彩环（入图鉴）");
  assert(s.metNpcs.includes("dongxuaner"), "结识董萱儿（入图鉴）");
  assert(s.flags.yanjia_reunion_done && s.flags.mocaihuan_reunion, "重逢节点收口（reunion_done）");
  // 重逢 → 临战三日（侦察玩法：5 选 3 互斥取舍——篇章动词「侦察」落地）
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "yanjia_reunion"), 0);
  assert(s.pendingEvent === "yanjia_scout", `临战三日触发（${s.pendingEvent}）`);
  const scoutNode = sandbox.STORY.find(x => x.id === "yanjia_scout");
  assert(scoutNode.choices(s).length === 6, `五处可探+收束共6项（${scoutNode.choices(s).length}）`);
  Engine.chooseStory(scoutNode, 2);   // 望塔（idx2）
  assert(s.pendingEvent === "yanjia_scout" && s.flags.yanjia_scout_tower, "望塔已探（驻留·卡未推进）");
  assert(s.ledger.yanjia_scout_tower, "望塔先机入账本");
  Engine.chooseStory(scoutNode, 2);   // 董萱儿（望塔摘除后顶上 idx2）
  assert(s.flags.yanjia_scout_dong && s.ledger.yanjia_scout_dong, "董萱儿弱点情报已探+入账");
  Engine.chooseStory(scoutNode, 2);   // 墨彩环（再顶上 idx2）
  assert(s.flags.yanjia_scout_mo && sandbox.State.count("qingyuan_dan") >= 2, "墨彩环家眷已安置（养元丹+2）");
  assert((s.flags.yanjia_scout_n || 0) === 3, `三日走满（n=${s.flags.yanjia_scout_n}）`);
  assert(scoutNode.choices(s).length === 1, "三日尽——只剩列阵一途（5选3互斥）");
  Engine.chooseStory(scoutNode, 0);   // 列阵赴堡墙
  assert(s.flags.yanjia_scout_done, "临战三日收口（yanjia_scout_done）");
  // 侦察 → 大BOSS（王蝉·鬼灵门少主——2026-07-09 考据勘误：非虫妖"战王蝉"）
  assert(s.pendingEvent === "yanjia_boss", `血祭大阵起·王蝉现身（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "yanjia_boss"), 0);
  const zc = Engine._combat;
  assert(zc && zc.enemies[0].name === "王蝉", "王蝉大BOSS入战（鬼灵门少主·人修）");
  // 侦察兑现：望塔=开局护体10 / 董萱儿=伤害+8%（准备越充分，决战越轻松）
  assert((zc.player.shield || 0) >= 10, `望塔先机兑现（开局护体=${zc.player.shield}）`);
  assert((zc.player.dmgBonus || 1) > 1.05, `董萱儿情报兑现（dmgBonus=${(zc.player.dmgBonus || 1).toFixed(2)}）`);
  assert(zc.enemies[0].boss && !zc.enemies[0].canFlee, "BOSS·不可逃（撑过血线收口，非诛杀）");
  assert(WORLD.enemies.zhanwangchan.armor >= 8 && WORLD.enemies.zhanwangchan.reward == null, "王蝉护甲厚·无掉落（逃逸式BOSS·内部id保留存档兼容）");
  // 撑过血线（打到溃退）= 剧情撤离
  Engine._combat.enemies.forEach(e => { e.hp = 0; });
  Engine._combat._checkEnd();
  Engine._finishCombat();
  assert(s.flags.yanjia_boss_done, "力挫王蝉（yanjia_boss_done）");
  assert(s.ledger.zhanwangchan_grudge, "不死不休之仇入账本（zhanwangchan_grudge）");
  assert(!s.flags.zhanwangchan_slain, "本战不诛杀王蝉（他日再别天南重现）");
  assert(s.metNpcs.includes("zhanwangchan"), "王蝉入「人物图鉴」（宿敌codex）");
  // 大BOSS → 逃出强征入伍
  if (!s.pendingEvent) Engine.checkStory();
  assert(s.pendingEvent === "yanjia_escape", `逃出生天（${s.pendingEvent}）`);
  assert(s.flags.yanjia_done && s.flags.modao_conscripted, "逃出燕家堡·被七派强征入伍");
  assert(s.location === "modao_front", `退守前线待命营（location=${s.location}）`);
  assert(s.ledger.modao_conscript, "强征入伍入账本（增量E·烽火征调的钩子）");
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "yanjia_escape"), 0);
  assert(!s.pendingEvent, "燕家堡之战·完（主线挂在待命营·候增量E）");
  assert(s.flags.modao_call_due > sandbox.State.absMonth(), "征调时锚已埋（modao_call_due=absMonth+2，未到不弹）");

  // —— 5.7 魔道争锋·第一幕·烽火征调（增量E·矿道箱庭：征调→黑吃黑·阴手宣乐→血玉蜘蛛 boss→机缘房→陈巧倩读档分支）——
  // 强制征调时锚到期（玩家闭关度月的等效），主线链式自动演出
  s.flags.modao_call_due = 0;
  Engine.checkStory();
  assert(s.pendingEvent === "modao_e1_conscript", `征调令下·矿场守备（${s.pendingEvent}）`);
  assert(s.metNpcs.includes("lvtianmeng"), "初识队官吕天蒙（入图鉴）");
  assert(s.ledger.modao_conscript_post, "拨守黑风岭矿场入账本（亲见弃子战术）");
  // 征调 → 矿洞黑吃黑（阴手宣乐现形，吕天蒙临死塞来平天尺）
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e1_conscript"), 0);
  assert(s.pendingEvent === "modao_e1_betray", `矿洞黑吃黑·阴手现形（${s.pendingEvent}）`);
  assert(State.count("pingtian_chi") === 1, "吕天蒙遗物·平天尺入手（×1，遗物长线）");
  // 黑吃黑 → 反杀宣乐（阴手敌型首演）
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e1_betray"), 0);
  const xc = Engine._combat;
  assert(xc && xc.enemies[0].name === "宣乐", "宣乐入战（阴手敌型首演）");
  assert(WORLD.enemies.xuanle.tactics === "cunning" && WORLD.enemies.xuanle.canFlee === false, "宣乐·阴诡战术·不可逃（识破偷袭→反杀）");
  Engine._combat.enemies.forEach(e => { e.hp = 0; });
  Engine._combat._checkEnd();
  Engine._finishCombat();
  assert(s.flags.xuanle_slain && s.flags.modao_e1_betray_done, "诛杀宣乐（xuanle_slain + 节点收口）");
  assert(State.count("yinling_sha") === 1, "宣乐遗物·隐灵纱自动入袋（namedLoot ×1）");
  assert(s.metNpcs.includes("xuanle"), "宣乐入「人物图鉴」（阴手codex）");
  assert(s.ledger.xuanle_slain, "黑吃黑·反杀阴手入账本");
  // 反杀宣乐 → 血玉蜘蛛 boss（矿洞最深处·封印松脱狂化·单形态）
  assert(s.pendingEvent === "modao_e1_spider", `矿洞最深处·血玉蜘蛛（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e1_spider"), 0);
  const sc = Engine._combat;
  assert(sc && sc.enemies[0].name === "血玉蜘蛛", "血玉蜘蛛入战");
  assert(sc.enemies[0].boss && !sc.enemies[0].canFlee, "血玉蜘蛛·boss·不可逃（单形态正面硬战）");
  assert(WORLD.enemies.xueyu_zhizhu.elem === "tu", "血玉蜘蛛·土属（韩立木行克之，可胜）");
  Engine._combat.enemies.forEach(e => { e.hp = 0; });
  Engine._combat._checkEnd();
  Engine._finishCombat();
  assert(s.flags.xueyu_zhizhu_slain && s.flags.modao_e1_spider_done, "诛杀血玉蜘蛛（xueyu_zhizhu_slain + 节点收口）");
  assert(State.count("zhuluan") === 2, "剖腹得白玉蛛卵×2（namedLoot·开灵宠长线）");
  assert(State.count("xueyu_sijin") === 1, "血玉蛛丝入袋（namedLoot ×1）");
  assert(s.metNpcs.includes("xueyu_zhizhu"), "血玉蜘蛛入「人物图鉴」");
  assert(s.ledger.xueyu_slain, "矿洞伏诛四级妖入账本");
  // 血玉蜘蛛 → 机缘房（机缘 onArrive 已结算：大挪移令+补天丹+开灵宠线）
  assert(s.pendingEvent === "modao_e1_fortune", `矿洞密室·机缘（${s.pendingEvent}）`);
  assert(State.count("dayi_ling") === 1, "大挪移令入手（×1·乱星海长线钥匙）");
  assert(s.flags.butian_used, "补天丹·服下（butian_used→修炼速度乘性永久+10%）");
  assert(s.flags.lingchong_line_open, "灵宠长线立项（lingchong_line_open）");
  assert(s.ledger.dayi_ling_got && s.ledger.lingchong_line, "大挪移令+灵宠线入账本");
  // 机缘 → 陈巧倩读档分支（喂过忘尘丹=她不识你；force chen_wangchen 锁定「故人不识」线）
  s.ledger.chen_wangchen = "（测试·喂过忘尘丹·她已不识）";
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e1_fortune"), 0);
  assert(s.pendingEvent === "modao_e1_chen_forgot", `读档分支·故人不识（${s.pendingEvent}）`);
  assert(s.flags.modao_act1_done, "魔道争锋·第一幕收口（modao_act1_done）");
  assert(s.ledger.chen_qiaoqian_forgot, "前线再遇陈巧倩·平淡道别入账本");
  // 两条陈巧倩节点都须存在（未喂线为占位草稿·待用户亲笔，结构先就位）
  assert(sandbox.STORY.find(x => x.id === "modao_e1_chen_remember"), "陈巧倩·未喂忘尘丹线节点已就位（占位草稿）");
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e1_chen_forgot"), 0);
  assert(!s.pendingEvent, "魔道争锋·第一幕·烽火征调·完（主线挂在矿场前线·候第二幕）");
  assert(s.flags.modao_act2_due > sandbox.State.absMonth(), "第二幕时锚已埋（modao_act2_due=absMonth+2，未到不弹）");

  // —— 5.8 魔道争锋·第二幕·金鼓原前线相持（增量F：前哨集结→巡逻 pack 遭遇战→董萱儿被掳暗线→南宫婉吃醋告别→赴京）——
  // 强制第二幕时锚到期（前线度月的等效），主线链式自动演出
  s.flags.modao_act2_due = 0;
  Engine.checkStory();
  assert(s.pendingEvent === "modao_e2_muster", `金鼓原前哨集结（${s.pendingEvent}）`);
  assert(s.metNpcs.includes("liujing") && s.metNpcs.includes("songmeng")
         && s.metNpcs.includes("zhongweiniang") && s.metNpcs.includes("wuxuan"),
         "结识刘靖/宋蒙/钟卫娘/武炫（四同袍入图鉴）");
  assert(s.ledger.modao_muster, "前哨集结·同袍并肩入账本");
  // 集结 → 巡逻遭遇战（魔修小队 pack 阵型：擒贼先擒王）
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e2_muster"), 0);
  assert(s.pendingEvent === "modao_e2_patrol", `金鼓原巡逻遭遇战（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e2_patrol"), 0);
  const pc = Engine._combat;
  assert(pc && pc.enemies.length >= 2, `魔修小队群战入战（敌数=${pc ? pc.enemies.length : 0}）`);
  assert(pc.enemies.some(e => e.leader && e.formation === "pack"), "魔修头目·pack 阵型领队（领队死=士气崩）");
  assert(pc.enemies.filter(e => e.formation === "pack" && !e.leader).length >= 1, "魔修喽啰·pack 从者随队成网");
  assert(WORLD.enemies.moxiu_toumu.elem === "tu", "魔修头目·土煞（韩立木行克之，练兵可胜）");
  Engine._combat.enemies.forEach(e => { e.hp = 0; });
  Engine._combat._checkEnd();
  Engine._finishCombat();
  assert(s.flags.modao_e2_patrol_done, "巡逻遭遇战告捷（modao_e2_patrol_done）");
  assert(State.count("kuilei_canjian") >= 1, "缴获傀儡残件入袋（傀儡线引子·缴获包装【修#5】）");
  assert(s.ledger.modao_patrol_won, "金鼓原巡逻告捷入账本");
  // 巡逻 → 董萱儿被掳暗线（无战斗·线报归账·再别天南显影）
  assert(s.pendingEvent === "modao_e2_dongxuaner", `董萱儿被掳暗线（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e2_dongxuaner"), 0);
  assert(s.ledger.dongxuaner_captured, "董萱儿被掳·暗线入账本（再别天南伏笔）");
  // 董萱儿暗线 → 南宫婉吃醋告别（轻糖克制·一枚炒栗子·【修#6】）
  assert(s.pendingEvent === "modao_e2_nangongwan", `南宫婉吃醋告别（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e2_nangongwan"), 0);
  assert(s.ledger.nangongwan_chestnut, "南宫婉含栗吃醋·金鼓原一别入账本");
  assert(s.flags.nangongwan_jingcheng_farewell, "正宫线·金鼓原一别窗口（nangongwan_jingcheng_farewell）");
  // 告别 → 赴京（第二幕收口·挂第三幕京城暗流·待实装）
  assert(s.pendingEvent === "modao_e2_jingcheng", `拔营赴京（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e2_jingcheng"), 0);
  assert(s.flags.modao_act2_done, "魔道争锋·第二幕收口（modao_act2_done）");
  assert(s.flags.modao_act3_due > sandbox.State.absMonth(), "第三幕时锚已埋（modao_act3_due，候京城暗流实装）");
  assert(!s.pendingEvent, "魔道争锋·第二幕·金鼓原前线相持·完（主线挂在赴京途中·候第三幕）");

  // —— 5.9 魔道争锋·第三幕·京城暗流（增量G：入京·萧翠儿→连环失踪案·情报面纱→馨王府墨彩环重逢→铁罗血茧遁走→五色门收口杀王管事）——
  // 强制第三幕时锚到期（赴京途中度月的等效），主线链式自动演出
  s.flags.modao_act3_due = 0;
  Engine.checkStory();
  assert(s.pendingEvent === "modao_e3_rujing", `入京·天子脚下（${s.pendingEvent}）`);
  assert(s.metNpcs.includes("xiaocui"), "市井偶遇萧翠儿（入图鉴）");
  assert(s.ledger.modao_rujing, "入京·秦府门房哭戏入账本");
  // 入京 → 连环失踪案（蒙山五友登场·情报面纱·翠儿求救）
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e3_rujing"), 0);
  assert(s.pendingEvent === "modao_e3_shizong", `连环失踪案（${s.pendingEvent}）`);
  assert(s.metNpcs.includes("mengshan_wuyou"), "结识蒙山五友（散修线人入图鉴）");
  assert(s.ledger.modao_shizong, "京城连环失踪案入账本");
  // 情报面纱·京城版：选「情报最全」档 → jingcheng_intel=2（复用 story 选项的乘法设计，第四幕据此调难度）
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e3_shizong"), 0);
  assert(s.flags.jingcheng_intel === 2, `情报面纱·查得最全（jingcheng_intel=${s.flags.jingcheng_intel}）`);
  // 失踪案 → 馨王府夜宴·墨彩环重逢（修#2·情感落点占位待亲笔）
  assert(s.pendingEvent === "modao_e3_yanhui", `馨王府夜宴·墨彩环重逢（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e3_yanhui"), 0);
  assert(s.metNpcs.includes("mocaihuan"), "馨王府重逢易容墨彩环（入图鉴·燕家堡因果第二章）");
  assert(s.ledger.modao_yanhui, "馨王府夜宴重逢入账本");
  // 夜宴 → 血池·血侍铁罗·一阶段（硬战→断臂→化血茧·二阶段演出·一）
  assert(s.pendingEvent === "modao_e3_tieluo", `血池·血侍铁罗·一阶段（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e3_tieluo"), 0);
  const tc = Engine._combat;
  assert(tc && tc.enemies[0].name === "铁罗", "铁罗入战（血侍·一阶段）");
  assert(WORLD.enemies.tieluo.canFlee === false && WORLD.enemies.tieluo.boss === true, "铁罗·不可逃 boss（一阶段·遁走改为脚本化二阶段演出）");
  assert(WORLD.enemies.tieluo.elem === "huo", "铁罗·火属（木生火·韩立讨不到相克便宜=硬仗）");
  Engine._combat.enemies.forEach(e => { e.hp = 0; });
  Engine._combat._checkEnd();
  Engine._finishCombat();
  assert(s.flags.modao_e3_tieluo_p1_done && !s.flags.modao_e3_tieluo_done, "一阶段告捷·断臂化血茧（modao_e3_tieluo_p1_done，未遁走）");
  // 一阶段 → 血池·血茧铁罗·二阶段（化茧狂暴大战→败后蜕茧遁走·仇恨账本跨场）
  assert(s.pendingEvent === "modao_e3_tieluo2", `血池·化茧·血茧铁罗·二阶段（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e3_tieluo2"), 0);
  const tc2 = Engine._combat;
  assert(tc2 && tc2.enemies[0].name === "血茧铁罗", "血茧铁罗入战（化茧·二阶段·独臂狂暴）");
  assert(WORLD.enemies.tieluo_mao.boss === true && WORLD.enemies.tieluo_mao.canFlee === false, "血茧铁罗·不可逃 boss（脚本化蜕茧遁走）");
  assert(WORLD.enemies.tieluo_mao.hp > WORLD.enemies.tieluo.hp, "血茧铁罗·血量较一阶段暴涨（化茧搏命）");
  Engine._combat.enemies.forEach(e => { e.hp = 0; });
  Engine._combat._checkEnd();
  Engine._finishCombat();
  assert(s.flags.modao_e3_tieluo_done && s.flags.tieluo_escaped, "血茧铁罗败→蜕茧遁走（modao_e3_tieluo_done + tieluo_escaped）");
  assert(s.metNpcs.includes("tieluo"), "铁罗入「人物图鉴」（黑煞教血侍·断臂化茧）");
  assert(s.ledger.tieluo_escaped, "断臂铁罗·跨场血仇入账本（皇宫决战再算）");
  // 血茧铁罗遁走 → 五色门收口（妖化王管事·为墨彩环报仇·墨府之祸总兑现）
  assert(s.pendingEvent === "modao_e3_wuse", `五色门收口（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e3_wuse"), 0);
  const wc = Engine._combat;
  assert(wc && wc.enemies[0].name === "王管事", "王管事入战（妖化门主）");
  assert(WORLD.enemies.wuse_menzhu.boss === true && WORLD.enemies.wuse_menzhu.canFlee === false, "王管事·boss·不可逃（妖化正面收口）");
  assert(WORLD.enemies.wuse_menzhu.elem === "tu", "王管事·土属（韩立木行克之，可胜）");
  Engine._combat.enemies.forEach(e => { e.hp = 0; });
  Engine._combat._checkEnd();
  Engine._finishCombat();
  assert(s.flags.modao_e3_wuse_done && s.flags.mofu_avenged, "诛王管事（modao_e3_wuse_done + mofu_avenged·为墨彩环报仇）");
  assert(s.metNpcs.includes("wuse_menzhu"), "王管事入「人物图鉴」（墨府之祸真凶）");
  assert(s.ledger.mofu_avenged, "五色门收口·了结墨家血债入账本");
  // 五色门收口 → 京城·长街晨别（墨彩环·不遗憾的结局·第三幕收束·onArrive 自动接上）
  assert(s.pendingEvent === "modao_e3_farewell", `京城·长街晨别·墨彩环（${s.pendingEvent}）`);
  Engine.chooseStory(sandbox.STORY.find(x => x.id === "modao_e3_farewell"), 0);
  assert(s.flags.modao_e3_farewell_done && s.flags.modao_act3_done, "墨彩环放下仇恨·悬壶济世·无憾而别（farewell_done + 第三幕收口 modao_act3_done）");
  assert(s.ledger.mocaihuan_farewell, "墨彩环长街晨别·不遗憾的结局入账本");
  assert(s.flags.modao_act4_due > sandbox.State.absMonth(), "第四幕时锚已埋（modao_act4_due，候黑煞覆灭·皇宫决战实装）");
  assert(!s.pendingEvent, "魔道争锋·第三幕·京城暗流·完（主线挂在京城·候第四幕）");
}

console.log("\n=== 6. 拜别版回乡（离门远行）===");
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.location = "yaolu";
  s.pendingEvent = null;
  s.flags.arc1_complete = true;
  s.silver = 60; s.age = 19;
  Engine.startJourney("qingniu");
  let guard = 0;
  while ((s.journey || Engine._pendingFortune || Engine._afterFortuneHook) && guard++ < 40) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) {
      Engine._combat.enemies.forEach(e => { e.hp = 0; });
      Engine._combat._checkEnd();
      Engine._finishCombat();
      continue;
    }
    break;
  }
  assert(s.flags.home_farewell, "拜别完成（home_farewell）");
  assert(s.flags.demon_seed_sister, "心魔种子：花轿那一眼（demon_seed_sister）");
  assert(s.ledger.home_farewell_wedding || s.ledger.home_farewell_haste, "拜别方式入账本");
}

console.log(`\n========== 大陆旅途：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
sandbox.process = undefined;
process.exit(failures === 0 ? 0 : 1);
