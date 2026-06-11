/* ============================================================
 * art.js — 配图层（全预生成，无实时生成）
 *
 * 资产分类目录（2026-06-11 重构）：
 *   assets/portraits/<id>.png           人物立绘（基础表情）
 *   assets/portraits/<id>_<emo>.png     人物表情变体（smile/cold/sad/angry…）
 *   assets/scenes/<id>.png              场景（横版）
 *   assets/scenes/<id>_p.png            场景（竖版——手机竖屏专用，杜绝 cover 放大糊化）
 *   assets/cg/cg_<id>.png / cg_<id>_p.png  剧情 CG（横/竖双版）
 *   assets/maps/<id>.png                舆图
 *
 * 竖屏（orientation: portrait）自动优先取 _p 版；无 _p 时回退横版。
 * 表情：取 <id>_<emo>.png，未生成该表情则回退基础立绘。
 * ============================================================ */
(function (root) {

  // 人物立绘（基础版必有；EMOS 列出已生成的表情变体）
  const PORTRAITS = {
    hanli: 1, modafu: 1, lifeiyu: 1, zhangtie: 1,
    xiaosuanpan: 1, jiatianlong: 1, jinguang: 1,
    nongfu: 1, sanxiu: 1, langzhong: 1, biaoshi: 1, langhao: 1,
    sanshu: 1, tienu: 1, mocaihuan: 1, wanxiaoshan: 1,
  };
  // 已生成的表情变体：{ 人物id: { 表情名: 1 } }
  const EMOS = {
    hanli: { cold: 1, smile: 1 },
    mocaihuan: { sad: 1, scheme: 1 },
    lifeiyu: { laugh: 1 },
    modafu: { sinister: 1 },
    wanxiaoshan: { panic: 1 },
  };

  // 场景（p:1 = 竖版已生成，竖屏自动启用）
  const SCENES = {
    yaolu: { p: 1 }, houshan: { p: 1 }, town: { p: 1 }, wuting: { p: 1 },
    qingniu: { p: 1 }, road: { p: 1 }, shanmen: { p: 1 }, miju: { p: 1 },
    jiayuan_city: { p: 1 }, tainan_fair: { p: 1 }, huangfeng_gate: { p: 1 },
  };

  // 剧情 CG（p:1 = 竖版已生成）
  const CG = { bottle: { p: 1 }, duoshe: { p: 1 }, jinguang: { p: 1 }, departure: { p: 1 } };

  // 舆图
  const MAPS = { tiannan_map: 1 };

  // 竖用图判定：视口高>宽（真机竖屏）或窄视口（桌面窄窗）——决定因素是画幅而非设备方向
  const isPortraitScreen = () =>
    (typeof window !== "undefined")
      ? (window.innerHeight > window.innerWidth || window.innerWidth <= 520)
      : false;

  const Art = {
    // 仓库图更新后 bump，强制浏览器重新拉取（避免旧缓存）。
    ASSET_VER: 9,

    _v(p) { return p + "?v=" + this.ASSET_VER; },

    // 人物立绘：emo 可选（无该表情变体则回退基础版）
    url(id, emo) {
      if (id && PORTRAITS[id]) {
        if (emo && EMOS[id] && EMOS[id][emo]) return this._v(`assets/portraits/${id}_${emo}.png`);
        return this._v(`assets/portraits/${id}.png`);
      }
      // 兼容旧调用：场景/舆图 id 也可经 url() 取
      if (id && SCENES[id]) return this.sceneUrl(id);
      if (id && MAPS[id]) return this._v(`assets/maps/${id}.png`);
      return null;
    },
    has(id) { return !!(PORTRAITS[id] || SCENES[id] || MAPS[id]); },

    // 场景图：竖屏优先竖版
    sceneUrl(id) {
      const def = SCENES[id];
      if (!def) return null;
      if (def.p && isPortraitScreen()) return this._v(`assets/scenes/${id}_p.png`);
      return this._v(`assets/scenes/${id}.png`);
    },

    // 地点配图：直接按地点 id 取图
    locUrl(loc) { return loc ? this.sceneUrl(loc.id) : null; },

    // 关键剧情 CG：竖屏优先竖版；未入库返回 null（演出回退到地点场景图）
    cgUrl(id) {
      const def = CG[id];
      if (!def) return null;
      if (def.p && isPortraitScreen()) return this._v(`assets/cg/cg_${id}_p.png`);
      return this._v(`assets/cg/cg_${id}.png`);
    },

    // —— 以下为兼容旧调用的空操作（已无实时生成）——
    genEnabled() { return false; },
    ensure() {},
    ensureNpc() {},
    ensureLocation() {},
    onUpdate() {},

    _PORTRAITS: PORTRAITS, _EMOS: EMOS, _SCENES: SCENES, _CG: CG, _MAPS: MAPS,
  };

  root.Art = Art;
  if (typeof module !== "undefined" && module.exports) module.exports = Art;

})(typeof window !== "undefined" ? window : globalThis);
