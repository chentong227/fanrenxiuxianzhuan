/* 据点节点图（嘉元城打样）· 无头测试 —— exploremap 引擎和平据点 + flavor 复访变迁纯函数
 * 跑：node test/stronghold.test.js  —— 纯逻辑、无 DOM/无 State，验"无钟无巡逻+复访见变迁"。 */
const EM = require("../js/exploremap.js");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ 失: ${msg}`); }
}

console.log("== 1. 据点地图加载与入口（和平·无灾厄钟）==");
{
  const map = EM.MAPS.jiayuan_city_l1;
  assert(!!map && map.kind === "field", "jiayuan_city_l1 是 field 图");
  assert(map.peaceful === true, "peaceful=true（据点和平标记）");
  assert(!map.clockMax, "无 clockMax（据点无灾厄钟）");
  assert(!map.patrol, "无 patrol（据点无巡逻杀局）");
  assert(map.entry === "mofu", "入口=墨府");
  const x = EM.start("jiayuan_city_l1", { flags: { mo_met: true } });
  assert(x && x.stack.length === 1, "start 建栈底帧");
  const f = EM.cur(x);
  assert(f.node === "mofu" && f.visited.mofu === true, "落脚在墨府且已访");
  const ci = EM.clockInfo(x);
  assert(ci.max === 0, "clockInfo.max=0（不显血幕倒计时）");
  assert(EM.patrolAt(x) === null, "patrolAt=null（无杀气棋子）");
}

console.log("== 2. flavor 复访变迁（纯函数·最进展者优先）==");
{
  const mofu = EM.MAPS.jiayuan_city_l1.nodes.mofu;
  const board = EM.MAPS.jiayuan_city_l1.nodes.chengmen;
  assert(EM.flavor(mofu, {}) === null, "无 flag → null（用基础风物）");
  assert(EM.flavor(mofu, { mo_met: true }) === null, "仅 mo_met → 墨府用基础风物");
  assert(EM.flavor(mofu, { mo_warned: true }).desc.indexOf("退了几拨探子") >= 0, "mo_warned → 退敌后风物");
  // 寒毒已解：即便 mo_warned 也在，最进展者(han_du_cured)优先命中
  const f3 = EM.flavor(mofu, { mo_warned: true, han_du_cured: true });
  assert(f3.desc.indexOf("寒毒已解") >= 0, "han_du_cured 压过 mo_warned（列表顺序=优先级）");
  // 告示板按进展换榜文
  assert(EM.flavor(board, { mo_warned: true }).read.indexOf("易主") >= 0, "告示板 mo_warned → 商铺易主红榜");
  assert(EM.flavor(board, { han_du_cured: true }).read.indexOf("太南小会") >= 0, "告示板 han_du_cured → 太南小会榜文");
  assert(EM.flavor({ name: "无变体" }, { mo_warned: true }) === null, "无 flavors 字段 → null");
}

console.log("== 3. 信步移动（不耗月·无巡逻·永无强战）==");
{
  const x = EM.start("jiayuan_city_l1", { flags: { mo_met: true } });
  const r = EM.travel(x, "changjie");
  assert(r.ok === true, "墨府→长街坊市 可达");
  assert(EM.cur(x).node === "changjie", "已移动到长街坊市");
  const arrive = r.events.find(e => e.type === "arrive");
  assert(!!arrive && arrive.firstVisit === true, "产生 arrive 事件（首访）");
  assert(!r.events.some(e => e.type === "encounter"), "据点移动永不触发强战");
  assert(!r.events.some(e => e.type === "curfew" || e.type === "timeup"), "无血幕收缩/无时限");
  assert(EM.clockInfo(x).clock === 0, "钟未走（信步不耗月）");
}

console.log("== 4. 邻接选项与非法移动 ==");
{
  const x = EM.start("jiayuan_city_l1", { flags: { mo_met: true } });
  const opts = EM.options(x).map(o => o.id).sort();
  assert(opts.includes("changjie") && opts.includes("chengmen"), "墨府邻接含长街/城门");
  assert(!opts.includes("tangkou"), "墨府不直达城南堂口（需经长街/城门）");
  const bad = EM.travel(x, "tangkou");
  assert(bad.ok === false, "直奔非邻接地标 → 失败（无路可达）");
  // 复访 firstVisit=false
  EM.travel(x, "chengmen");
  const back = EM.travel(x, "mofu");
  assert(back.ok === true && back.events.find(e => e.type === "arrive").firstVisit === false, "复访墨府 firstVisit=false");
}

console.log("== 5. 地标风味字段齐备（地方感=各异的地标）==");
{
  const nodes = EM.MAPS.jiayuan_city_l1.nodes;
  const ids = Object.keys(nodes);
  assert(ids.length >= 4, "至少 4 个地标（墨府/长街/城门/堂口）");
  ids.forEach(id => {
    const n = nodes[id];
    assert(!!n.name && !!n.icon && !!n.desc, `${id} 有名/图标/风物 desc`);
  });
  assert(nodes.mofu.act === "rest", "墨府→歇脚（rest）");
  assert(nodes.changjie.act === "market", "长街坊市→采买（market）");
  assert(nodes.chengmen.act === "board" && !!nodes.chengmen.read, "城门→告示（board，有 read 文）");
  assert(nodes.tangkou.act === "rumor" && !!nodes.tangkou.read, "城南堂口→探听（rumor，有 read 文）");
  // 风物互异：不会两个地标共用同一句 desc
  const descs = ids.map(id => nodes[id].desc);
  assert(new Set(descs).size === descs.length, "各地标 desc 互不雷同（一眼分得出在哪）");
}

console.log(`\n========== 据点节点图：${fail === 0 ? "全通 ✓" : fail + " 项败 ✗"}（${pass} 项）==========`);
process.exit(fail === 0 ? 0 : 1);
