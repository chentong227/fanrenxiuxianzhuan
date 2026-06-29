/* L2 楼阁层测试 */
const EM = require("../js/exploremap.js");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ 失败: ${msg}`); }
}

console.log("== 1. 开图与基础结构 ==");
{
  const x = EM.start("test_tower_l2", { flags: {} });
  assert(x && x.stack.length === 1, "开图建栈");
  const f = EM.cur(x);
  assert(f.node === "entrance", "入口=殿门");
  const fi = EM.floorInfo(x);
  assert(fi && fi.floor === 0 && fi.total === 3, `楼层信息（floor=${fi && fi.floor}, total=${fi && fi.total}）`);
  const opts = EM.options(x);
  assert(opts.length === 1 && opts[0].id === "main_hall", `入口通向正殿（${opts.map(o => o.name).join("/")}）`);
}

console.log("== 2. 楼层内移动 + 采集 ==");
{
  const x = EM.start("test_tower_l2", { flags: {} });
  EM.travel(x, "main_hall");
  EM.travel(x, "side_room");
  const r = EM.gather(x);
  assert(r.ok && x.bag.lingshi === 3, `偏室采集得灵石（bag=${JSON.stringify(x.bag)}）`);
  assert(EM.cur(x).cleared.side_room, "偏室已采空");
}

console.log("== 3. 楼梯事件 ==");
{
  const x = EM.start("test_tower_l2", { flags: {} });
  EM.travel(x, "main_hall");
  const r = EM.travel(x, "stairs_up");
  assert(r.ok, "走到楼梯节点");
  assert(r.events.some(e => e.type === "stairs" && e.direction === "up"), "触发 stairs 事件（up）");
}

console.log("== 4. 楼层切换：一层→二层 ==");
{
  const x = EM.start("test_tower_l2", { flags: {} });
  EM.travel(x, "main_hall");
  EM.travel(x, "stairs_up");
  const r = EM.floorChange(x, "up");
  assert(r.ok, "上楼成功");
  const f = EM.cur(x);
  assert(f.floor === 1, `当前楼层=1（${f.floor}）`);
  assert(f.node === "stairs_down", `新层入口=楼梯下来（${f.node}）`);
  assert(r.events.some(e => e.type === "floorChange" && e.floor === 1), "楼层切换事件");
  assert(r.events.some(e => e.type === "note" && e.text.includes("灵压")), "新层 intro 提示");
  const fi = EM.floorInfo(x);
  assert(fi.name === "二层·藏宝阁", `楼层名=${fi.name}`);
}

console.log("== 5. 二层探索 + 再上楼 ==");
{
  const x = EM.start("test_tower_l2", { flags: {} });
  EM.travel(x, "main_hall");
  EM.travel(x, "stairs_up");
  EM.floorChange(x, "up");
  // 二层：stairs_down → corridor → treasure
  EM.travel(x, "corridor");
  EM.travel(x, "treasure");
  const r = EM.gather(x);
  assert(r.ok && x.bag.lingshi === 5, `藏宝阁采集（lingshi=${x.bag.lingshi}）`);
  // 回走廊，上顶层
  EM.travel(x, "corridor");
  EM.travel(x, "stairs_up2");
  const r2 = EM.floorChange(x, "up");
  assert(r2.ok && EM.cur(x).floor === 2, "上到顶层（floor=2）");
  const fi = EM.floorInfo(x);
  assert(fi.name === "顶层·阵眼", `顶层名=${fi.name}`);
}

console.log("== 6. 下楼 ==");
{
  const x = EM.start("test_tower_l2", { flags: {} });
  EM.travel(x, "main_hall");
  EM.travel(x, "stairs_up");
  EM.floorChange(x, "up");   // → 二层
  EM.floorChange(x, "down"); // → 一层
  const f = EM.cur(x);
  assert(f.floor === 0, `下楼回到一层（floor=${f.floor}）`);
  assert(f.node === "stairs_up", `下楼入口=楼梯上（${f.node}）`);
}

console.log("== 7. 边界：不能超出楼层范围 ==");
{
  const x = EM.start("test_tower_l2", { flags: {} });
  const r = EM.floorChange(x, "down");
  assert(!r.ok, "一层不能往下（边界保护）");
  // 上到顶
  EM.travel(x, "main_hall");
  EM.travel(x, "stairs_up");
  EM.floorChange(x, "up");
  EM.travel(x, "corridor");
  EM.travel(x, "stairs_up2");
  EM.floorChange(x, "up");
  const r2 = EM.floorChange(x, "up");
  assert(!r2.ok, "顶层不能往上（边界保护）");
}

console.log("== 8. 顶层 enter 子图入口 ==");
{
  const x = EM.start("test_tower_l2", { flags: {} });
  EM.travel(x, "main_hall");
  EM.travel(x, "stairs_up");
  EM.floorChange(x, "up");
  EM.travel(x, "corridor");
  EM.travel(x, "stairs_up2");
  EM.floorChange(x, "up");
  EM.travel(x, "array_eye");
  const opts = EM.options(x);
  const fr = opts.find(o => o.id === "final_room");
  assert(fr && fr.risk === "boss", "内室入口标注 boss 风险");
  EM.travel(x, "final_room");
  const r = EM.enterSub(x);
  assert(r.ok, "进入子图（L3 深窟）");
  assert(x.stack.length === 2, "栈深度=2（L2→L3）");
  EM.exitSub(x);
  assert(x.stack.length === 1, "退出子图回到 L2");
  assert(EM.cur(x).floor === 2, "仍在顶层");
}

console.log("== 9. 回归：L1 地图不受影响 ==");
{
  const x = EM.start("xueshi_l1", { flags: {} });
  assert(x && EM.cur(x).node === "rukou", "L1 血色禁地正常开图");
  const fi = EM.floorInfo(x);
  assert(fi === null, "L1 地图 floorInfo 返回 null");
  const r = EM.floorChange(x, "up");
  assert(!r.ok, "L1 地图 floorChange 无效");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
