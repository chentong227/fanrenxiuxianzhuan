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
    lvtianmeng: 1, xuanle: 1, xueyu_zhizhu: 1, baiyu_zhizhu: 1,
    // 增量G·魔道争锋第三幕·京城暗流
    xiaocui: 1, mengshan_wuyou: 1,
    // 再别天南篇·辛如音（阵法大家·赴乱星海之钥）
    xinruyin: 1,
    // 初入星海篇·全量补绘：魁星岛旧识/妙音门/六连殿/逆星盟/妖修/星宫
    wen_qiang: 1, wang_ning: 1, feng_sanniang: 1, gu_family: 1,
    miaoyin_zhangmen: 1, wuchou: 1, fengxi: 1, jinkui: 1,
  };
  // 已生成的表情变体：{ 人物id: { 表情名: 1 } }
  const EMOS = {
    hanli: { cold: 1, smile: 1 },
    mocaihuan: { sad: 1, scheme: 1 },
    lifeiyu: { laugh: 1 },
    modafu: { sinister: 1 },
    wanxiaoshan: { panic: 1 },
    chenqiaoqian: { sad: 1 },
    // 初入星海篇·汪凝（小紫灵）失怙泪眼
    wang_ning: { sad: 1 },
  };

  // 场景（p:1 = 竖版已生成，竖屏自动启用）
  const SCENES = {
    yaolu: { p: 1 }, houshan: { p: 1 }, town: { p: 1 }, wuting: { p: 1 },
    qingniu: { p: 1 }, road: { p: 1 }, shanmen: { p: 1 }, miju: { p: 1 },
    jiayuan_city: { p: 1 }, tainan_fair: { p: 1 }, huangfeng_gate: { p: 1 },
    baiyao_yuan: { p: 1 },
    // 战斗场景底图（对阵轴战场：下半幅开阔地面，横版专用；v90 起为舞台盒构图——
    // 两翼近景收口环抱+中央开阔，"人被环境包住"）
    bt_forest: {}, bt_road: {}, bt_valley: {}, bt_night: {},
    // 增量H·魔道争锋第四幕·皇宫决战战场底图（夜·皇城宫门广场；非 bt_ 前缀→中性 biome 无色偏）
    huanggong: {},
    // 前景遮挡条带（v90）：近景失焦草石（透明 PNG），压在全部单位之前——最快视差层。
    // 分场景配色：前景与底图地面同色才像"长在地里"（fg_combat=通用回退）
    fg_combat: {}, fg_forest: {}, fg_road: {}, fg_night: {},
    // 三层分级制（v88）：_far=无立物远景层；_mid=中景物件透明条带（人物身后独立视差）
    bt_road_far: {}, bt_road_mid: {},
    // 血色禁地与地火之屋
    xueshi_jindi: { p: 1 }, dihuo_wu: { p: 1 },
    // 长卷全景（21:9 横向卷轴底图——镜头横移时背景跟着退，探索轴/战斗轴共用）
    pano_dongku: {}, pano_xueshi: {},
    // 增量E·矿道箱庭：矿洞 L3 战斗轴横移长背景
    pano_kuangdong: {},
    // 初入星海篇·地点（横版底 + 竖版 _p）：魁星岛/小寰岛/外星海猎场/天星城/极阴岛/内外星海通道
    kuixing_island: { p: 1 }, xiaohuan_island: { p: 1 }, waixinghai: { p: 1 },
    tianxing_city: { p: 1 }, jiyin_island: { p: 1 }, xinghai_tongdao: { p: 1 },
  };

  // 战斗全身立绘（battlers/：轴上单位图——妖兽/人形敌/剧情人物战斗姿态）
  // 战斗全身立绘注册：face = 素材朝向（l/r/c）——渲染层按"面向对手"决定是否镜像
  // v83 逐张目检校准：兽类素材头朝右(r)；正面构图(c)永不镜像；南宫婉原生朝左(l)。
  // _fly=凌空飞姿变体（v87，airborne 时自动换用——双脚离地前后错开、衣袂后卷）
  const BATTLERS = {
    bt_wolf: { face: "r" }, bt_chimu: { face: "r" }, bt_baihu: { face: "r" }, bt_wugong: { face: "r" },
    bt_bandit: { face: "c" }, bt_wuren: { face: "l" }, bt_sanxiu: { face: "c" },
    bt_yelang: { face: "r" }, bt_yuzitong: { face: "c" },   // 野狼帮打手头偏画右(r)；余子童元神正面对称(c)永不镜像
    bt_hanli: { face: "r" }, bt_hanli_fly: { face: "r" },
    bt_luyunfeng: { face: "c" }, bt_jinguang: { face: "c" },
    bt_modafu: { face: "c" }, bt_tienu: { face: "c" }, bt_wanxiaoshan: { face: "c" },
    bt_mojiao: { face: "l" }, bt_nangongwan: { face: "l" },   // 南宫婉飞姿=复用站姿（用户裁决：v2 与站姿无异+抠图白圈，弃）
    bt_dujiao: { face: "l" },
    // 增量E：宣乐（阴手·正面对称永不镜像）、血玉蜘蛛（蛛形对称 c）；灵宠白玉蜘蛛·小白（蛛形对称 c）
    bt_xuanle: { face: "c" }, bt_xueyu_zhizhu: { face: "c" }, bt_baiyu_zhizhu: { face: "c" },
    // 增量G·京城暗流：血侍铁罗（一阶段）+ 血茧铁罗（化茧狂暴独臂形态·二阶段）+ 妖化王管事
    bt_tieluo: { face: "c" }, bt_tieluo_mao: { face: "c" }, bt_wuse: { face: "c" },
    // 增量H·皇宫决战：黄枫谷同袍刘靖/宋蒙/钟卫娘（正面对称 c）+ 黑煞教低阶血侍 mook
    // 血侍三变体（palace-battle-fixme 问题A·非克隆）：甲魁梧斧奴 / 乙枯瘦刺奴 / 丙精悍链奴；bt_xueshi 留作回退
    bt_liujing: { face: "c" }, bt_songmeng: { face: "c" }, bt_zhongweiniang: { face: "c" }, bt_xueshi: { face: "c" },
    bt_xueshi_a: { face: "c" }, bt_xueshi_b: { face: "c" }, bt_xueshi_c: { face: "c" },
    // 初入星海篇·妖兽/人形敌（正面对称构图，永不镜像）；雷鹏=奇观演出走 CG·非可战敌·无战姿
    bt_yingli: { face: "c" }, bt_waihai: { face: "c" }, bt_guzhanglao: { face: "c" },
  };

  // 剧情 CG（p:1 = 竖版已生成）
  const CG = { bottle: { p: 1 }, duoshe: { p: 1 }, jinguang: { p: 1 }, departure: { p: 1 }, mojiao: {},
    // 增量E·矿道箱庭演出 CG（横版底 + 竖版 _p）
    kuangchang: { p: 1 }, kuangdong: { p: 1 }, jiyuan_shi: { p: 1 },
    // 增量G·魔道争锋第三幕·京城暗流演出 CG（横版底 + 竖版 _p 已生成）
    jingcheng: { p: 1 }, wangfu_yan: { p: 1 },
    // 再别天南篇·章末定格·首见乱星海（横版底 + 竖版 _p）
    luanxinghai: { p: 1 },
    // 初入星海篇·全量补绘演出 CG（横版底 + 竖版 _p）
    kuixing_land: { p: 1 }, xiaohuan_dongfu: { p: 1 }, sanzhuan: { p: 1 },
    doushouchang: { p: 1 }, leipeng_pofeng: { p: 1 }, jiu_ziling: { p: 1 },
    waihai_lie: { p: 1 }, jindan: { p: 1 } };

  // 舆图
  const MAPS = { tiannan_map: 1, renjie_map: 1, tiannan_atlas: 1 };

  // 竖用图判定：视口高>宽（真机竖屏）或窄视口（桌面窄窗）——决定因素是画幅而非设备方向
  const isPortraitScreen = () =>
    (typeof window !== "undefined")
      ? (window.innerHeight > window.innerWidth || window.innerWidth <= 520)
      : false;

  const Art = {
    // 仓库图更新后 bump，强制浏览器重新拉取（避免旧缓存）。
    ASSET_VER: 26,

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

    // —— 预加载（v149）：消除「新人物/新地图刚出现时慢慢浮现、像手机卡了」的观感 ——
    // 根因＝立绘/场景/舆图都是按需 fetch+decode，首次显示要等网络+解码；淡入动画又把这段
    // 延迟显形成「慢慢出现」。解法：进游戏后趁空闲把全部静态资产逐张预取并 decode 进缓存，
    // 之后任何立绘/场景/舆图都是「秒显」，淡入只是锦上添花而非遮丑。
    // 手机性能红线：逐张串行（不并发轰带宽）、用 requestIdleCallback 让位主线程、decode 异步。
    _preloaded: false,
    preloadAll() {
      if (this._preloaded || typeof window === "undefined" || typeof Image === "undefined") return;
      this._preloaded = true;
      const urls = [];
      // 1) 舆图最先（直接治「地图加载缓慢」）
      Object.keys(MAPS).forEach(id => urls.push(this._v(`assets/maps/${id}.png`)));
      // 2) 人物立绘 + 表情变体（治「新人物慢慢出现」）
      Object.keys(PORTRAITS).forEach(id => {
        urls.push(this._v(`assets/portraits/${id}.png`));
        const e = EMOS[id];
        if (e) Object.keys(e).forEach(emo => urls.push(this._v(`assets/portraits/${id}_${emo}.png`)));
      });
      // 3) 场景（按当前画幅优先取要用到的那一版，竖屏先竖版）
      const portraitScreen = isPortraitScreen();
      Object.keys(SCENES).forEach(id => {
        const def = SCENES[id];
        if (def && def.p && portraitScreen) {
          urls.push(this._v(`assets/scenes/${id}_p.png`));
        } else {
          urls.push(this._v(`assets/scenes/${id}.png`));
        }
      });
      // 4) 剧情 CG
      Object.keys(CG).forEach(id => {
        const def = CG[id];
        if (def && def.p && portraitScreen) urls.push(this._v(`assets/cg/cg_${id}_p.png`));
        else urls.push(this._v(`assets/cg/cg_${id}.png`));
      });
      // 5) 战斗立绘（最重，放最后——战斗另有自己的临战预热，这里只是兜底暖缓存）
      Object.keys(BATTLERS).forEach(id => urls.push(this._v(`assets/battlers/${id}.png`)));
      this._warm(urls);
    },
    // 串行暖缓存：逐张 new Image()+decode，每张完成后让位空闲再取下一张（不阻塞交互）。
    _warm(urls) {
      const idle = window.requestIdleCallback
        ? (cb) => window.requestIdleCallback(cb, { timeout: 1500 })
        : (cb) => setTimeout(cb, 180);
      let i = 0;
      const step = () => {
        if (i >= urls.length) return;
        const url = urls[i++];
        const img = new Image();
        img.decoding = "async";
        try { img.src = url; } catch (e) { return idle(step); }
        const next = () => idle(step);
        if (img.decode) img.decode().then(next).catch(next);
        else { img.onload = next; img.onerror = next; }
      };
      idle(step);
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
