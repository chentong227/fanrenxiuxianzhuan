/* 箱庭探索 v3 · L1 舆图引擎无头测试 */
const EM = require("../js/exploremap.js");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ 失败: ${msg}`); }
}

console.log("== 1. 开图与基础结构 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  assert(x && x.stack.length === 1, "开图建栈");
  const f = EM.cur(x);
  assert(f.node === "rukou", "入口=血幕裂口");
  const ci = EM.clockInfo(x);
  assert(ci.day === 1 && ci.left === 30, `五日灾厄钟（day=${ci.day}, left=${ci.left}）`);
  const opts = EM.options(x);
  assert(opts.length === 2 && opts.every(o => o.kind === "gather"), `入口通向两片外环药圃（${opts.map(o => o.name).join("/")}）`);
}

console.log("== 2. 移动耗钟 + 巡逻者推进 + 杀气标注 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  const r = EM.travel(x, "waipu_d");
  assert(r.ok && EM.cur(x).node === "waipu_d", "移动到外环药圃·东");
  assert(EM.clockInfo(x).clock === 1, `移动耗钟（clock=${EM.clockInfo(x).clock}）`);
  assert(r.events.some(e => e.type === "note"), "路途见闻（移动演出）");
  assert(r.events.some(e => e.type === "arrive" && e.firstVisit), "到达事件+初访标记");
  const pat = EM.patrolAt(x);
  assert(pat && pat.node, `封岳巡逻位（${pat.node}→${pat.next}）`);
  const opts = EM.options(x);
  const toLiechang = opts.find(o => o.id === "liechang");
  assert(toLiechang && (toLiechang.risk === "killer" || toLiechang.risk === "shadow" || toLiechang.risk === "lair"),
    `猎场方向带风险标注（${toLiechang && toLiechang.risk}）`);
}

console.log("== 3. 采集入袋 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  EM.travel(x, "waipu_d");
  const r = EM.gather(x);
  assert(r.ok && x.bag.xueshi_zhuyao === 1, `采得主药（bag=${JSON.stringify(x.bag)}）`);
  assert(EM.cur(x).cleared.waipu_d, "节点已掏空");
  const r2 = EM.gather(x);
  assert(!r2.ok, "复采无所得");
}

console.log("== 4. 撞进巡逻者节点 = 遭遇战 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  // 封岳 route: [liechang, zhongtan, yanxue, zhongtan]，玩家每动他走一步
  // 走 rukou→waipu_d（封岳到 zhongtan）→ 踩进 zhongtan = 撞个正着
  EM.travel(x, "waipu_d");
  const r = EM.travel(x, "zhongtan");
  const enc = r.events.find(e => e.type === "encounter");
  assert(enc && enc.enemy === "fengyue", "中环药泽撞上封岳=遭遇战");
  assert(!enc.ambush, "无情报=不是伏击（他先看到你）");
}

console.log("== 5. 古阵情报 → 伏击资格 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  const f = EM.cur(x);
  f.node = "guzhen"; f.visited.guzhen = true;   // 直接置位（测 readLore 本体）
  const r = EM.readLore(x);
  assert(r.ok && f.intel.patrol_route, "读阵得巡逻路线情报");
  assert(EM.readLore(x).ok === false, "残阵只能读一次");
  // 有情报后撞封岳=伏击
  f.node = "liechang";
  f.patrolIdx = 3;   // 下一步推进到 route[0]=liechang
  const r2 = EM.stay(x, 1);
  const enc = r2.events.find(e => e.type === "encounter");
  assert(enc && enc.ambush === undefined || enc, "驻守时他撞进来（atRest 遭遇）");
  // travel 路径的伏击位：让封岳在 zhongtan，玩家从 yanxue 踩进去
  const y = EM.start("xueshi_l1", { flags: {} });
  const fy = EM.cur(y);
  fy.intel.patrol_route = true;
  fy.node = "yanxue"; fy.patrolIdx = 0;   // travel 后 patrolIdx→1 = zhongtan
  const r3 = EM.travel(y, "zhongtan");
  const enc3 = r3.events.find(e => e.type === "encounter");
  assert(enc3 && enc3.ambush === true, "有情报踩进他的格=伏击先手");
}

console.log("== 6. 杀掉巡逻者 → 杀气消散 ==");
{
  const ctx = { flags: {} };
  const x = EM.start("xueshi_l1", ctx);
  ctx.flags.fengyue_dead = true;   // 战斗钩子立 flag
  EM.travel(x, "waipu_d");
  assert(EM.patrolAt(x) === null, "封岳死后巡逻消失");
  const opts = EM.options(x);
  assert(opts.every(o => o.risk !== "killer" && o.risk !== "shadow"), "杀气标注清空");
}

console.log("== 7. 血幕收缩：关节点 + 强制驱离 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  const f = EM.cur(x);
  f.node = "waipu_x"; f.visited.waipu_x = true;
  f.clock = 17; x.stack[0].clock = 17;
  const r = EM.stay(x, 1);   // 钟到 18：外环关闭
  assert(r.events.some(e => e.type === "curfew"), "血幕收缩事件");
  assert(f.closed.waipu_d && f.closed.waipu_x, "外环两圃关闭");
  assert(f.node !== "waipu_x", `身处被吞节点→被逼到相邻开放节点（${f.node}）`);
  const r2 = EM.travel(x, "waipu_x");
  assert(!r2.ok, "关闭节点不可前往");
}

console.log("== 8. 钟尽强制传出 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  x.stack[0].clock = 29;
  const r = EM.travel(x, "waipu_d");
  assert(r.events.some(e => e.type === "timeup"), "五日之限：timeup 事件");
}

console.log("== 9. 嵌套栈：深潭洞口 → 墨蛟洞（L3 轴式）进出 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  const f = EM.cur(x);
  f.node = "shentan";
  const r = EM.enterSub(x);
  assert(r.ok && r.sub === "mojiao_cave" && r.snapshot, "入洞压栈+洞口印记标记");
  assert(x.stack.length === 2 && EM.cur(x).kind === "cave", "栈顶=cave 帧（轴式洞窟）");
  const cf = EM.cur(x);
  assert(cf.pos === 1 && EM.mapOf(cf).W === 27, `长轴洞窟（W=${EM.mapOf(cf).W}，起步格${cf.pos}）`);
  const r2 = EM.exitSub(x);
  assert(r2.ok && x.stack.length === 1 && EM.cur(x).node === "shentan", "弹栈回深潭洞口");
}

console.log("== 10. L3 轴式：走格/观战情报/热点近采/布置到格/惊动 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  EM.cur(x).node = "shentan";
  EM.enterSub(x);
  const f = EM.cur(x);
  // 走格与观战情报（走近战团 ≥17 触发）
  const rFar = EM.caveTake(x, "lingshi");
  assert(!rFar.ok, "隔太远采不到（空间化采集）");
  EM.caveMove(x, 3);
  const r1 = EM.caveTake(x, "guteng");   // pos4 的藤芯：邻格可采
  assert(r1.ok && x.bag.lingcao === 3, "走到跟前才采得到（邻格）");
  // 声纹梯度：跨进 14 格档先闻绫帛破空（远闻其声，近见其形）
  const rSnd = EM.caveMove(x, 10);
  assert(rSnd.events.some(e => e.type === "sound" && e.sfx === "farClash"), "走近一档：远处斗法声入耳");
  assert(!EM.caveMove(x, 11).events.some(e => e.type === "sound"), "同档不复鸣（跨档才触发）");
  const expBefore18 = f.expose || 0;
  let rIntel = EM.caveMove(x, 18);
  assert(rIntel.events.some(e => e.type === "sound" && e.sfx === "farRoar"), "再近一档：妖吼扑面（9 格档）");
  assert(rIntel.events.some(e => e.type === "intel") && f.intel.cave_watch, "走近战团：观战情报到手");
  // 近身惊动：落点距战团 4 格（6 格档）——这一步本身就有代价（+3 之外另有观战 +8）
  assert(rIntel.events.some(e => e.type === "near" && e.expose === 3), "贴近的每一步都在它耳边（近身惊动+3）");
  assert((f.expose || 0) === expBefore18 + 3 + 8, `这一步的总账（${expBefore18}+3近身+8观战=${f.expose}）`);
  assert(f.expose === (3 + 8) - 3 + 0 || f.expose > 0, `观战有代价（expose=${f.expose}）`);
  // 战团格不可踏入
  assert(!EM.caveMove(x, 22).ok && !EM.caveMove(x, 25).ok, "战团格不可踏入（绫光剑气未长眼）");
  // 布置到格：困足阵布在 16（自身两步内），伏火符须走近再布
  const rp1 = EM.cavePlace(x, "kunzu", 16);
  assert(rp1.ok && f.preps.kunzu === 16, "困足阵旗落位第17步");
  const rpFar = EM.cavePlace(x, "anfu", 23);
  assert(!rpFar.ok, "隔太远布不了（须自身两步内）");
  EM.caveMove(x, 20);
  const rp2 = EM.cavePlace(x, "anfu", 21);
  assert(rp2.ok && f.preps.anfu === 21, "伏火符埋于第22步（它的来路）");
  const rp3 = EM.cavePlace(x, "tienu", 19);
  assert(rp3.ok && f.preps.tienu === 19, "铁奴沉入第20步淤泥蛰伏");
  // 贪：潭心老株（21 格邻位可采）→ 暴露破限
  const rTan = EM.caveTake(x, "laozh");
  assert(rTan.ok, "潭心老株到手（最肥的一株）");
  assert(f.expose >= 50 === rTan.blown, `惊动判定一致（expose=${f.expose}, blown=${rTan.blown}）`);
  // 开战参数：站位/布置/情报全继承
  const info = EM.caveFightInfo(x);
  assert(info.W === 27 && info.playerPos === 20 && info.enemyPos === 25, `开战继承（W=${info.W}, 我${info.playerPos}, 敌${info.enemyPos}）`);
  assert(info.preps.kunzu === 16 && info.preps.anfu === 21 && info.preps.tienu === 19, "布置格全带入战场");
  assert(info.intel === true && info.takenCount === 2, `情报与战耗（intel=${info.intel}, taken=${info.takenCount}）`);
  // 同轴一体：没采完的热点带进战斗轴；惊动与否决定偷袭资格
  assert(info.hotspots.length === 3 && info.hotspots.every(h => h.id !== "guteng" && h.id !== "laozh"),
    `余下热点上轴（${info.hotspots.length} 处，已采的不再出现）`);
  assert(info.sneak === !info.blown, `偷袭资格=未惊动（sneak=${info.sneak}, blown=${info.blown}）`);
  assert(info.sceneBg === "xueshi_jindi", "战场底图继承洞窟（开战不换天地）");
}

console.log("== 11. 钟吾/菡云芝在场时间表 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  const map = EM.mapOf(EM.cur(x));
  const ji = map.nodes.jishi, hua = map.nodes.huapu;
  assert(ji.presence[0] === 4 && ji.presence[1] === 24, "钟吾：第一日下半~第四日在摊");
  assert(hua.presence[0] === 12, "菡云芝：第三日抵达花圃");
}

console.log("== 12. 后山 L1·战争迷雾：四态可见性 + 三揭法 + 传闻层 ==");
{
  // 12a. 入图整片覆雾，仅入口与四邻可见（邻接点亮）
  const x = EM.start("houshan_l1", { flags: {} });
  const map = EM.mapOf(EM.cur(x));
  assert(map.fog === true && EM.cur(x).node === "linkou", "后山入图（fog 图·入口=后山林口）");
  assert(EM.fogState(x, "linkou") === "visited", "入口=已至");
  assert(EM.fogState(x, "yaojing") === "glimpsed" && EM.fogState(x, "guteng") === "glimpsed", "入口四邻=窥见");
  assert(EM.fogState(x, "wanglang") === "unknown" && EM.fogState(x, "xuegu") === "unknown", "远处节点=未知（覆雾不可达）");
}
{
  // 12b. 远距感知梯度：入口处隐约血腥气（弱），逼近巢穴渐强（只报方位强弱）
  const x = EM.start("houshan_l1", { flags: {} });
  const sf0 = EM.senseField(x);
  assert(sf0 && sf0.level === 1 && /方$/.test(sf0.dir), `入口·弱感知（level=${sf0.level}, dir=${sf0.dir}）`);
  EM.travel(x, "yaojing"); EM.travel(x, "wanglang"); const r = EM.travel(x, "wulin");
  const sfN = EM.senseField(x);
  assert(sfN && sfN.level === 4, `逼近血食谷·感知最烈（level=${sfN.level}）`);
  assert(r.events.some(e => e.type === "sense"), "跨档触发感知鸣示（兽吼/血腥气）");
}
{
  // 12c. 登高揭片：望狼石一望，揭开山坳深处数处去处
  const x = EM.start("houshan_l1", { flags: {} });
  EM.travel(x, "yaojing");
  const r = EM.travel(x, "wanglang");
  const lk = r.events.find(e => e.type === "lookout");
  assert(lk && lk.reveals.includes("xuegu"), "望狼石登高=揭片事件（含血食谷）");
  assert(EM.fogState(x, "xuegu") === "glimpsed" && EM.fogState(x, "wulin") === "glimpsed", "登高后远处节点升为窥见");
}
{
  // 12d. 邻接点亮：走一步，新节点四邻随之显形
  const x = EM.start("houshan_l1", { flags: {} });
  assert(EM.fogState(x, "qixi") === "unknown", "栖息岩穴起初未知");
  EM.travel(x, "yaojing");
  assert(EM.fogState(x, "qixi") === "glimpsed", "抵采药小径后·栖息岩穴升为窥见");
}
{
  // 12e. 传闻层：只降雾、不增删世界——预亮巢穴为风闻 + 落情报红利（伏击资格）
  const x = EM.start("houshan_l1", { flags: {} });
  const res = EM.applyRumors(x, ["beast_chimu"]);
  assert(res.ok, "异闻在耳=可降雾");
  assert(EM.fogState(x, "xuegu") === "rumored", "巢穴预亮为风闻（知其所在，未亲至）");
  assert(EM.cur(x).intel.lair_route === true, "落情报红利=伏击资格（lair_route）");
  // 风闻不改世界：节点定义与战利原样
  assert(EM.mapOf(EM.cur(x)).nodes.xuegu.boss === true, "传闻层零增删（血食谷 boss 定义不变）");
}
{
  // 12f. 巢穴搜刮：血食谷最肥（rich），其余节点药薄
  const x = EM.start("houshan_l1", { flags: {} });
  EM.travel(x, "yaojing"); EM.travel(x, "wanglang"); EM.travel(x, "wulin"); EM.travel(x, "xuegu");
  const r = EM.gather(x);
  assert(r.ok && x.bag.lingshi === 3, `血食谷搜刮丰收（bag=${JSON.stringify(x.bag)}）`);
}
{
  // 12g. 零回归：非 fog 图（血色禁地）一切照旧——全显、无感知
  const x = EM.start("xueshi_l1", { flags: {} });
  assert(EM.fogState(x, "liechang") === "visited", "无雾图·fogState 恒为已至（不影响血色禁地）");
  assert(EM.senseField(x) === null, "无雾图·无远距感知（零回归）");
}

console.log(`\n========== 舆图引擎：${fail === 0 ? "全部通过 ✓" : fail + " 项失败 ✗"}（${pass} 项） ==========`);
process.exit(fail ? 1 : 0);
