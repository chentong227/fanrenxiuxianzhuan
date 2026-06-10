/* ============================================================
 * art.js — 配图层（全预生成，无实时生成）
 *
 * 七玄门篇的人物与场景完全可枚举，全部已预生成入库 assets/<id>.png。
 * 因此本模块只做一件事：把 id 映射到仓库内的固定图路径。
 *  - 不联网、不调用任何生图 API、不占用 localStorage / IndexedDB。
 *  - 这样既消除了"图片撑爆浏览器存储导致存档/密钥存不下"的隐患，也无首次出场延迟。
 *  - 图只是"皮"，不改任何数值/主线/因果。
 *
 * 如需新增人物/场景图：用 scripts/genart.js 预生成放进 assets/，并在 FIXED 里登记 id，
 * 然后 bump ASSET_VER 强制浏览器刷新缓存。
 * ============================================================ */
(function (root) {

  // 七玄门篇全部固定图 id（人物 + 场景，含过场地点）
  const FIXED = {
    // 人物
    hanli: 1, modafu: 1, lifeiyu: 1, zhangtie: 1,
    xiaosuanpan: 1, jiatianlong: 1, jinguang: 1,
    nongfu: 1, sanxiu: 1, langzhong: 1, biaoshi: 1, langhao: 1,
    sanshu: 1, tienu: 1,
    // 场景（含过场地点）
    yaolu: 1, houshan: 1, town: 1, wuting: 1,
    qingniu: 1, road: 1, shanmen: 1, miju: 1,
  };

  // 关键剧情 CG 大图（assets/cg_<id>.png）：生成入库后在此登记
  const CG = { bottle: 1, duoshe: 1, jinguang: 1, departure: 1 };

  const Art = {
    // 仓库图更新后 bump，强制浏览器重新拉取（避免旧缓存）。
    ASSET_VER: 6,

    // id → 仓库图路径（无图返回 null，调用方回退 emoji 占位）
    url(id) {
      if (id && FIXED[id]) return "assets/" + id + ".png?v=" + this.ASSET_VER;
      return null;
    },
    has(id) { return !!this.url(id); },

    // 地点配图：直接按地点 id 取图
    locUrl(loc) { return loc ? this.url(loc.id) : null; },

    // 关键剧情 CG：未入库时返回 null（演出回退到地点场景图）
    cgUrl(id) {
      if (id && CG[id]) return "assets/cg_" + id + ".png?v=" + this.ASSET_VER;
      return null;
    },

    // —— 以下为兼容旧调用的空操作（已无实时生成）——
    genEnabled() { return false; },
    ensure() {},
    ensureNpc() {},
    ensureLocation() {},
    onUpdate() {},
  };

  root.Art = Art;
  if (typeof module !== "undefined" && module.exports) module.exports = Art;

})(typeof window !== "undefined" ? window : globalThis);
