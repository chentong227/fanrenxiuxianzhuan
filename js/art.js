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
    wushishu: 1, luyunfeng: 1, yeshishu: 1, mashibo: 1, chenqiaoqian: 1,
    nangongwan: 1, lihuayuan: 1, fengyue: 1, zhongwu: 1, hanyunzhi: 1,
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
    baiyao_yuan: {},
    // 战斗场景底图（对阵轴战场：下半幅开阔地面，横版专用；v90 起为舞台盒构图——
    // 两翼近景收口环抱+中央开阔，"人被环境包住"）
    bt_forest: {}, bt_road: {}, bt_valley: {}, bt_night: {},
    // 前景遮挡条带（v90）：近景失焦草石（透明 PNG），压在全部单位之前——最快视差层。
    // 分场景配色：前景与底图地面同色才像"长在地里"（fg_combat=通用回退）
    fg_combat: {}, fg_forest: {}, fg_road: {}, fg_night: {},
    // 三层分级制（v88）：_far=无立物远景层；_mid=中景物件透明条带（人物身后独立视差）
    bt_road_far: {}, bt_road_mid: {},
    // 血色禁地与地火之屋
    xueshi_jindi: {}, dihuo_wu: {},
    // 长卷全景（21:9 横向卷轴底图——镜头横移时背景跟着退，探索轴/战斗轴共用）
    pano_dongku: {}, pano_xueshi: {},
  };

  // 战斗全身立绘（battlers/：轴上单位图——妖兽/人形敌/剧情人物战斗姿态）
  // 战斗全身立绘注册：face = 素材朝向（l/r/c）——渲染层按"面向对手"决定是否镜像
  // v83 逐张目检校准：兽类素材头朝右(r)；正面构图(c)永不镜像；南宫婉原生朝左(l)。
  // _fly=凌空飞姿变体（v87，airborne 时自动换用——双脚离地前后错开、衣袂后卷）
  const BATTLERS = {
    bt_wolf: { face: "r" }, bt_chimu: { face: "r" }, bt_baihu: { face: "r" }, bt_wugong: { face: "r" },
    bt_bandit: { face: "c" }, bt_wuren: { face: "l" }, bt_sanxiu: { face: "c" },
    bt_hanli: { face: "r" }, bt_hanli_fly: { face: "r" },
    bt_luyunfeng: { face: "c" }, bt_jinguang: { face: "c" },
    bt_modafu: { face: "c" }, bt_tienu: { face: "c" }, bt_wanxiaoshan: { face: "c" },
    bt_mojiao: { face: "l" }, bt_nangongwan: { face: "l" },   // 南宫婉飞姿=复用站姿（用户裁决：v2 与站姿无异+抠图白圈，弃）
    bt_dujiao: { face: "l" },
  };

  // 剧情 CG（p:1 = 竖版已生成）
  const CG = { bottle: { p: 1 }, duoshe: { p: 1 }, jinguang: { p: 1 }, departure: { p: 1 }, mojiao: {} };

  // 舆图
  const MAPS = { tiannan_map: 1 };

  // 竖用图判定：视口高>宽（真机竖屏）或窄视口（桌面窄窗）——决定因素是画幅而非设备方向
  const isPortraitScreen = () =>
    (typeof window !== "undefined")
      ? (window.innerHeight > window.innerWidth || window.innerWidth <= 520)
      : false;

  const Art = {
    // 仓库图更新后 bump，强制浏览器重新拉取（避免旧缓存）。
    ASSET_VER: 15,

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

    // 场景图：竖屏优先竖版；opts.landscape=true 强制横版（战斗轴是横向战场，横图才铺得开）
    sceneUrl(id, opts) {
      const def = SCENES[id];
      if (!def) return null;
      if (def.p && isPortraitScreen() && !(opts && opts.landscape)) return this._v(`assets/scenes/${id}_p.png`);
      return this._v(`assets/scenes/${id}.png`);
    },

    // 地点配图：直接按地点 id 取图
    locUrl(loc, opts) { return loc ? this.sceneUrl(loc.id, opts) : null; },

    // 战斗全身立绘（对阵轴单位图）
    battlerUrl(id) { return BATTLERS[id] ? this._v(`assets/battlers/${id}.png`) : null; },
    hasBattler(id) { return !!BATTLERS[id]; },
    // 素材朝向（l/r/c）：渲染层按"面向对手"决定是否 scaleX(-1) 镜像
    battlerFace(id) { return (BATTLERS[id] && BATTLERS[id].face) || "l"; },

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
