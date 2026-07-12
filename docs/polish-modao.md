# 魔道争锋篇（含燕家堡前置+京城篇）· 打磨清单（双审合并版 · 2026-07-12）

> 巡礼第 3 站。Fable 5 审戏（`_review-modao-fable.md`）+ GPT 5.6 审机器（`_review-modao-gpt.md`），结论高度互锚：
> **锚链完整无死链、演出密度全作最高、跨章账本是全作标杆——但这是一条 6 个月跑穿的纯轨道**。
> 全章钉死在只有闭关按钮的单据点（京城两幕人在京城、地在矿场）、涟漪 0 条、经济冻结、
> 境界 cap 入章即顶格连闭关都没回报；本章最重的抉择（京城情报）免费送；
> 阵法 Build 的生产回路（制符台）在**全游戏层面**就是断的（跨章 bug）。
> 时长现状：主线 1.5~2.5h 不踩红线，但游戏内仅 6 月、帆时长=零。
> **新系统节拍判定（#9）**：达标且豪华（四战线群架/survive拾旗/fieldCycle 六相/boss 逃逸跨场仇恨），
> 病在分布——全堆第四幕末三节点，前 70% 章程战斗决策与上章无异。
> **上一站账全绿**：mojiao_oath 炒栗子拍/lify 捎酒兜底/dongfu 双线/凤凰符跨三章双清/dayan 中途回响——双审一致点名"这一块不要动"。

---

## ✅ Bug 批（客观缺陷·已即时修复 2026-07-12）

| # | 项 | 修法 | 出处 |
|---|------|------|------|
| B① | **制符台整个 UI 无入口（跨章 bug·全作阵法 Build 生产回路断裂）**——lianfu 管线俱全但全库无一处注入，买了制符笔+符谱也永远开不了炉，build.bal 阵法档在测空气 | renderActions/dock 双路径注入 `lianfu`（持制符台+≥1 符谱才现·labels 补「闭关制符 ✎」——v83 媒体查询同型教训双处都改） | GPT P0-3 |
| B② | **考据残留（v302 漏网）**：王蝉战情报兑现 log 仍写「振翅冲撞之后，翼根旧伤」——虫妖文案，与 story 侧种账「血遁突袭之后气门微滞」自相矛盾 | engine.js 兑现文案改血遁口径 | Fable P0-2 |
| B③ | **施工脚手架演给玩家**：e4_xuwang 尾拍「（皇宫决战·下篇·待续……增量H下篇实装中。）」——过时注记+剧透后三节点 | 删拍 | Fable P0-3 |
| B④ | **谎报掉落×2**：e1_fortune「找到灵矿碎屑」实际仅 mood+2；yanjia_reunion 陈家「递来一囊疗伤丹药」零入袋 | ①give lingshi×2 ②give huixue_dan×1（黄枫谷 E① 并案现行犯） | 双审同锚 |
| B⑤ | **反向谎报**：yanjia_scout 药房「按市价留下银钱」不扣钱 | 文案改虚（乱局里掌柜早跑了） | Fable P2-7 |
| B⑥ | **e2_muster 前 2 月等待=天命栏黑洞**（本章四段时锚唯一没 objTitle 的） | 补「金鼓原调令」双态 objTitle/objHint 倒计时 | Fable P2-6 |
| B⑦ | **atRealmCap 文案还是练气期旧话**：筑基玩家撞 cap 看到「本篇封顶练气期。筑基乃后话……黄枫谷篇再续」 | 文案按 Chapters.active() 动态 | GPT P0-1 附带 |

## A · 帆段重建（本章最大结构病·双审 P0 同锚）

| # | 项 | 改法 | 出处 | 工程 |
|---|------|------|------|------|
| A1 ①②④✅v319（③=spar 分支另行） | **全章帆段真空**：单据点（modao_front 只有闭关/调息/小瓶/炼药）+涟漪 0 条+经济冻结（战利灵石无处花）+京城两幕地点错位（人在京城、主界面还叫"魔道前线·待命营"、底图还是矿道）+四段时锚 6 月纯空转 | 已落：①**京城真地点** world.js `jingcheng_ke`（越京·秦府客居·home 全套闭关/调息/小瓶/炼药 + 朱雀长街 openMarket + 万宝楼京城分号 openWanbao〔灵石经济出口〕+ 蒙山五友请托=fangshiBoard 复用〔jc 文案变体·同一单池〕）；e3_rujing onArrive 迁入；离京**无需手动迁**（已核：zaibie_open 的 Chapters.enter("zaibie") 落 jiayuan_city）；场景底=LOC_CG 复用 cg_jingcheng 横竖（**专属场景图待生图·可选**）；where 补三处（e2_muster/e3_rujing=modao_front、e4_shenxun=jingcheng_ke——均为时锚等待后的自由段收口节点，强制链未加，天命栏自动缀"去处"）；**取舍：战时物价+10% 未做**（openWanbao/wanbaoBuy 双处同步成本 vs B1 情报已是灵石出口——纯复用）。②**前线巡逻月行动** `Engine.startXunluoPatrol`（xunluo·labels 双路径+doAction+world actions；moxiu_zu×2 快仗 66%/带 moxiu_toumu 硬仗 34%·血±15%；胜=军功灵石 2~3+30% 加 1、硬仗 40% 傀儡残件/25% 符纸；败=fail-forward 负伤回营 40% 血+心境-2 不重开；passTime(1)；武炫/钟卫娘低配 side 轮值=简令位〔E 池并案〕；门禁 modao_conscripted&&!e3_rujing_done·入京自动下架）。④**涟漪×2**：厉飞雨背锅链（e2_muster/e3_rujing onArrive 各一条 worldNews·第二条"哪个王八蛋用老子的名字在外面结仇"）+ 战线风声 `Engine._tickWarNews`（5 条池·时锚等待期 25%/月·同文不连发·半数浮出——最小战争潮） | Fable P0-1 + GPT P0-4/P1-5/P1-13 + Fable P1-7 | 中 |
| A2 ✅v319 | **境界 cap 与设计稿矛盾**：cap=13 筑基初期=入章即顶格，闭关很快颗粒无收；设计稿明写"篇末筑基中期→后期"（ep27 考据表同） | 已落：modao realmCapIndex 13→15（中期真突破+后期篇末冲刺）；zaibie 13→15 跟随（cap 倒挂防出戏）；atRealmCap 文案已动态化（B⑦）；journey.test cap 断言 13→15 同步 | GPT P0-1 | 小 |
| A3 ✅v319 | **modao_front 无地图锚+征调期离队零后果**：journey.from=null；军令在身回黄枫谷全程无反应 | 已落：①continent 新节点 `qianxian`（魔道前线·pos 40,6 北境·locs=[modao_front]·**节点 hidden(s) 新机制**=仅魔道章征军在籍上图〔章前不剧透/章后裁撤〕+gate 双保险；路线 qianxian↔huangfeng/yuejing 随隐；ui.js 双地图渲染路径 pins+routes 四处过滤）——真引擎实测 journey.from=qianxian；jingcheng_ke 同刀挂 yuejing.locs（unlock 限魔道三幕后·`_journeyArrive` 改按 loc.unlock 择落点=章外云游越京行为不变）；②离队轻后果：startJourney 离前线记 modao_awol+一条"回营再算"log，归营（travelTo/_journeyArrive → `_modaoAwolCheck`）军法申斥+mood-3 销账（不禁止·世界有反应）；③where 三处见 A1① | GPT P1-5 | 小~中 |

## B · 京城查案重做（本章最重抉择=假选择·双审 P0 同锚）

| # | 项 | 改法 | 出处 | 工程 |
|---|------|------|------|------|
| B1 ✅v319 | **「花重金」零灵石零耗月且严格占优**；intel 三档只有 ≥2 有读点（=1 与 =0 全库同义）；objHint 许诺"情报量决定皇宫决战难度"但三场决战无一处读 intel | 已落（并入 B2 多轮结构）：①蒙山五友门路=灵石8/次不耗月（买不起=置灰选项+hint 引导巡逻军功/回谷变现）、茶楼蹲点/翠儿追踪各真耗 1 月（passTime）；②intel 四档全有读点：≥1=santuan 开局我方全体护体+6（settle modao_shizong 战报点名）/ ≥2=刘靖示警改命线（原读点不动）+『教主真身』线报入风云录 / =3=胥王决战开局敌 exposed 一拍（「查案·满档」点名）/ =0 硬闯=santuan 开局气血-8%（「硬闯·无备」点名）；③jingcheng_xueshi_intel 死写已删（与 intel≥2 同义） | Fable P0-5 + GPT P0-2/P1-7 + GPT P2-5 | 小~中 |
| B2 ✅v319 | **查案玩法退化**：燕家堡 5 选 3 是亮点，体量更大的京城反而缩成一次性三选一 | 已落：shizong 改 choice.stay 多轮侦察（模板照抄 yanjia_scout·text/choices 双函数+驻留重掷）——三线可反复投入攒 intel（上限3·比旧版多一档），茶楼 40% 概率额外风味见闻（3 条池入风云录）、翠儿线首次投入触发爷爷病情小拍（凡人视角·呼应仙凡有别）；「收网动身」intel≥1 才亮（hint 实时写明当前档位效果），intel=0 只剩硬闯；journey.test 5.9 已适配多轮驱动（发灵石→买门路→蹲茶楼→翠儿→收网·真扣灵石/真耗月断言） | Fable P1-8 | 中 |

## C · 账本与命途（种了不收的）

| # | 项 | 改法 | 出处 | 工程 |
|---|------|------|------|------|
| C1 ✅v319（兜底） | **陈巧倩 remember 线白菊山之约=空头支票**：baiju_appt/白菊山节点全库不存在、chen_front_reunion 零读点；zaibie 注释把没实装的戏当前情。她还凭空出现在决战终结拍（不在集结/任何 sides，突然持赤虹剑齐轰），且 forgot/remember 在这一拍零差异 | 已落（兜底）：①e4_shenxun 集结点名双版（forgot="押丹药的那位陈姓女修也在——她不认得你，却认得魔道的血债"/remember=隔人群一眼欲言又止·握紧赤虹剑站进战阵）；②finale 双版本"三符宝齐轰"改"自集结夜便按剑随行的陈巧倩"（铺垫成立）；③likjing 离京拍 remember 线：陈巧倩托宋蒙捎话"白菊山春时花开……"+writeLedger `baiju_appt`（label 带"日后/远线"·ledger.audit H 类合法留账）。**长线：白菊山道别节点真兑现→再别天南/重返天南站立案**（见下方跨站立案栏） | Fable P0-4 + P1-1 | 小（兜底）/中（跨站） |
| C2 ✅v319 | **秦家护持断头**：李化元亲托的私债（modao_rujing）只记不结，秦家入府后全章再无一字 | 已落：likjing 城门秦家谢仪送行拍（give lingshi×5·老门房深揖）+settle modao_rujing 点名"师兄的人情，你替师父还上了——京城之难随黑煞教覆灭而解，秦府上下全须全尾"；ledger.baseline 已删该存量债 | Fable P1-2 | 小 |
| C3 ✅v319 | **萧翠儿线无收尾**：救了爷爷没有谢恩拍，"仙凡有别"主题起两个头一个都没收 | 已落：likjing 城门送行拍——翠儿挎花篮谢恩（爷爷身子渐好）+韩立留一册手抄凡俗吐纳法（"凡人有凡人的福气"——正面回应"凡人是不是没福气"）；另 B2 翠儿追踪线首次投入有爷爷病情小拍 | Fable P1-3 | 小 |
| C4 ✅v319 | **傀儡残件哑账**：文本明示"等着回响"，kuilei_canjian 全库零消费 | 已落：e4b_tuoshi 开场点名拍（残件+阴纹图纸塞给宋蒙参照御傀）+onArrive settle modao_patrol_won（"那场练兵的缴获，没有白拿"）；ledger.baseline 已删该存量债 | Fable P1-4 | 小 |
| C5 ⏳ 立案星海站 | **灵宠线无孵化拍**：lingchong_line 零 settle，白玉蜘蛛两章后蝎岛凭空在身畔 | 星海站立案：小寰岛闭关窗补孵化拍+settle（本站只立案·不改代码） | Fable P1-5 | 跨站小~中 |
| C6 ⏳ 立案星海站 | **金银书页死钩（稳守线）**：封岳遁走线永无金页——合璧线死、yinse_shuye_got 永挂 | 星海站立案：炼剑拍加分支文案+settle（"另半页终究没等到——以神识补全残式"·账诚实收掉）；或虚天殿给一页获取窗（本站只立案·不改代码） | Fable P1-6 | 小~中 |
| C7 ✅v319 | **死 flag 批 ×17**：yanjia_protect_mocaihuan/modao_e4_chase/hold/tangle…全库仅写零读（本章已有 4 处 recordTemperament 正确先例没跟上） | 已落：14 个有心性色彩的改 recordTemperament（stoic×7：ask_lvtianmeng/chen_remember_restrain/e2_humble/e2_jingcheng_alert/e3_cautious_revenge/e4_hold/e4_defensive；sentiment×7：yanjia_protect_mocaihuan/chen_forgot_murmur/e2_dongxuaner_rage/nangongwan_reciprocal/e3_comfort_doorkeeper/e4_chase/e4_tangle）·hint 统一「——铸入心性」；2 个纯告别拍删 flag 只留 mood/文案（yanjia_lookback/mocaihuan_extra_farewell）；第 17 个 modao_e1_extra_search 主控 Bug 批已处理 | Fable P1-12 + GPT P1-4 | 小 |
| C8 ✅v319 | 蒙山五友"自有交代"无交代；凤凰符"那是后话了"死钩 | 已落：likjing 蒙山五友团揖讨账拍（改行护院·静候灵兽山收编·两不耽误——名头笑话留给后续篇章）；liujing_die 凤凰符句删"那是后话了"改"化作赤金流光没入虚空，追之不及"（收敛无承诺） | Fable P2-2/3 | 极小 |

> **跨站立案（v319·A1④ 埋糖的收口）**：**重返天南站——厉飞雨背锅对质拍**。本站已种两条 worldNews 风声
> （e2_muster「鬼灵门重金悬赏『厉飞雨』」/ e3_rujing「厉首座托人带话：哪个王八蛋用老子的名字在外面结仇」），
> 重返天南与厉飞雨重逢时须有当面对质拍（他追问燕家堡报他名的"王八蛋"——韩立认账或再赖一次，双向皆糖）。设计重返天南站时勿漏。
>
> **跨站立案（v319·C1 白菊山之约真兑现）**：baiju_appt 已在 likjing 落地成账（remember 线·宋蒙捎话·H 类远线）——
> **再别天南/重返天南站须补白菊山道别节点真兑现**（读 chen_front_reunion / baiju_appt；forgot 线无此账、自然无此节点）。
> C5 灵宠孵化拍、C6 金银书页稳守线收窗——**星海站清账**（见上表 ⏳ 行）。

## D · 战斗与演出

| # | 项 | 改法 | 出处 | 工程 |
|---|------|------|------|------|
| D1 | **胥王决战分支断崖 85pt**：刘靖殁线 1.5%（非死局·fail-forward+六相手操救得回）vs 存线 86.5%（同道抬着赢 57% 占比）——多数玩家拿最陡一战、改命玩家躺赢 | ✅v319 殁线哀兵：宋蒙低配 side（hp70·珠10/13·aggr5·"刘师弟的这一剑我替他补上"·钟卫娘独力维阵）；存线刘靖 aggr 8→6 且剑 22/28→17/22。**改前→改后（save-modao-e3·ri13·N200）：殁线 1.5%→35~42%（+平天尺共同拉抬）/存线 86.5%→82%（占比 57%→67%）**；断崖 85pt→~45pt（存线仍显著优、情报救人有分量）。climax.bal 四断言：殁线 25~60%/存线 ≤92% 且 ≥殁线+15pt/占比 ≥35% | GPT P1-2 | 小~中 |
| D2 | **拖时布阵战零张力**：survive 首演 100%/末血 96%——傀儡吸满仇恨可挂机，拾旗无动机 | ✅v319 `_afterEnemyTick` 血煞递增压力：第 N 回合我方全体 4+2N 穿甲直扣（傀儡/刘靖同吃·同规则），log 播报"血煞越压越沉·拾旗才是止损"。**改前→改后：站桩打满末血 96%→61%（50~70 带✓）；拾旗速通模拟 100% 稳（速胜省掉最重的尾拍压力·末血 ~70%）** | GPT P1-1 | 小 |
| D3 | **中段五连战同质化偏软**：宣乐/蛛/铁罗/血茧/五色门 88~100%，"报仇高潮"6 回合无伤感 | ✅v319 五色门主 hp 285→430/armor 5→6/攻 +30%（37/33/46/24）/加 enrage turn3×1.35——**100%·5.8回合·末血85% → 84.7%（N600）·10回合·末血73%**（70~85 恶战带✓）；santuan 冰妖 hp 140→170+三同袍 moves -10%（冰妖变厚后同袍跨线驰援反摊薄占比，双刀齐下）——**玩家占比 34.7%→36%**（35% 线上·climax.bal 观察行）。血茧铁罗 88.5% 维持不动；宣乐/蛛/铁罗一阶段偏软**判定为前期热身刻意为之，不动**（介绍性战斗+旧账 fail-forward 都在，抬硬只会拖慢中段节奏） | GPT P2-1/2 | 小 |
| D4 ✅v319 | **刘靖之死演出裸奔**：本章情感最重锤无 sfx/无 fx/无 amb 骤停，死亡拍紧跟括号教学「——若你前期挖到线报本可…」一秒切成攻略 | 已落：致命拍前 amb:null 骤停+白闪（fx flash #fff 200ms）+danger 骤响，尾部静默拍收「恭送正道楷模」；教学句移出戏文（onArrive 落 Engine.log sys 条目）；live 线同病教学句改叙事化（"线报值回本钱"）；清教学型括号旁白×3——e4b_tuoshi 机制说明删（fight guard hint 承载）/e4b_zhencheng 机制说明删（选项 hint 承载）/likjing"下一篇章预告"aside 删（guide 承载） | Fable P1-9 + P2-5 | 小 |
| D5 | **三符宝旁白代打**：finale「你与宋蒙、陈巧倩三件符宝齐轰」但平天尺是 material、战斗中零手段 | ✅v319 新瞬发底牌**平天尺·镇**（combat.js `pingtian_chi_zhen`：dmg22 pierce+命中镇身1拍·金光砖 18 的 ×1.22·mp6·tier1 同档无越阶折扣，走金光砖同款 consume 管线=瞬发栏自动显示）；充能 `pingtian_chi_charge` 仅 startXuwangFight 发放×1、win 结算清余量（败北重试线保留）；atk 带镇=combat 通用新钩（`sp.dingshen` 命中生效·与击落同源）；fx 复用金光砖凌空镇落。TALISMANS/TRUMPS/pouch 双表/fx/data 五处接线 | GPT P2-6 | 小~中 |
| D6 | **剑道战力线（黄枫谷遗留账·本章剑意源又断供）**：swordMastery 两个读点全喂濒临退役的贴身武学，30 月剑意投入直接战力回报=0 | **候选 A（GPT 推荐·最小）**：swordMastery=剑系（mu）法术乘区 ×1.10（"凡人剑里悟出的剑心喂回御剑"·乘性合规）；候选 B：剑势通用化（剑系法术命中攒势/巨剑术可 spendMomentum）；候选 C：解锁参研 10 层（回报太远不推荐）。切磋断供由 A1③ 一并解决 | GPT P1-6 | A 小/B 中 |
| D7 | **阵图升级线缺失**：wuxing_zhen 全章零读点、齐云霄拍卖会（"准备苦"+灭付家暗线起点）未实装，真·颠倒五行阵凭空而来 | ✅v319 新节点 `modao_qiyunxiao`（数组位=e2_jingcheng 与 e3_rujing 之间·cond=act2_done+act3_due 到期+未入京·skipIf=已完成非阻塞）：抵京当日万宝拍卖行外重逢齐云霄→付家强人强买其炉艺图卷→二择解围（出手震慑=stoic/花灵石5平事=sentiment·recordTemperament 双路）→赠完整版阵图（`wuxing_zhen_full`）。**⚠ ledger id=`fujia_grudge_start`（含"远线"承诺词）——`fujia_grudge` 已被再别天南「齐云霄之死=付家所害」占用，同链不同拍：拍卖会结怨=因、之死=果，重返天南总清算须两账齐读**。startXuwangFight 读 flag：无完整版=fieldCycle 裁去万象星河相（6→5·合计 suppress 0.41→0.28·log"阵图残缺威能折半"）；climax.bal 配置断言双态（fieldManual 手操 autoResolve 测不出体验差·断配置）；backbone/journey 全绿 | GPT P1-3 + Fable P2-1 | 中 |
| D8 ✅v319 | **e4_shenxun「稳进」严格占优**：回满血零代价 vs 一鼓作气扣血 | 已落（两头都给·startSantuanFight 开局注入段与 B1 同处）：稳进=回满血但暗哨传警（敌方开局护体+8·「暗哨传警」战报点名）；一鼓作气=扣血 8% 但开局剑势+1（momentum 注入·「一鼓作气」点名）——hint 双向写明真代价 | Fable P1-10 | 小 |

## E · P2 池（顺手做）

✅v319 e2_jingcheng 复用离乡 CG 画面错位（已换 kuangchang·竖版在库）｜✅v319 刘靖生还线零余韵（likjing 养伤道别拍"这条命是你喝回来的"+zaibie_open worldNews"刘靖伤愈归谷·出关立新剑"）｜combat-sweep harness 口径 ✅v319（modao 段 realmIndex 12→13〔法力池 351→178 虚高修正〕+星海物品挪至 chapMap 切档发放〔ss 段发噬金虫/xh·whfy 段发结丹兵器谱九件·切档拍重建 player 连 spells/charges/pouch 一并换新〕。**影响面**：魔道/再别段全线去 harness 光环——santuan 100%→70%、xuwang_final 100%→0%〔=裸建号+六相不吃的深度悲观地板·阵法+fail-forward 双豁免非死局，真存档口径以 climax.bal 双分支带为准，已在 sweep 文件头重标口径注释〕、ss_leitai 100%→60%；zb_*/xh_*/whfy_* 无实质变化；**新旧口径均零真死局**）｜新系统节拍前移预演 ✅v319 **复核结论：主线巡逻战（startPatrolFight）武炫本就是 mastery=1 低配 side（两招·受简令 cycleSideStance）——审查稿此条系误报，引擎未动**；预演密度由 A1② 巡逻月行动补强（每月轮值武炫/钟卫娘简令位·第四幕前可反复练"简令支援"决策）。

---

## 拍板项（其余默认按清单实装）

1. **A1 帆段重建三件套+A2 cap 放开+A3 地图锚**——本章结构病一揽子（京城真地点+巡逻月行动+同袍切磋+2 涟漪+筑基中期真突破）。工程量中，是本站主菜。确认？
2. **B1 查案真成本 vs B2 多轮侦察升级**——B1 是最小修（扣钱扣月+三档真读点）；B2 是玩法升级（照抄燕家堡 choice.stay 多轮）。**建议 B1+B2 都做**（B2 含 B1 的成本设计），只做 B1 也能救假选择。选哪档？
3. **D6 剑道战力线**——黄枫谷站遗留账。GPT 推荐候选 A（swordMastery=剑系法术 ×1.10，一处判断+三套 bal 回归）。批 A？还是 B（剑势通用化·战斗节奏会变）？
4. **D7 阵图升级线**（齐云霄拍卖会节点+六相读 flag）——补设计稿承诺，工程量中。这轮做还是记再别天南站？
5. **C1 陈巧倩兜底**——本站做短线兜底（集结点名+离京捎话），白菊山真节点立案再别天南站。确认？
6. Bug 批七项已修（客观缺陷不占拍板）；A/B/C/D/E 其余默认全做，有不要的点名。

*实装完成后：全量回归 + climax.bal 胥王双分支带 + 430×932 实测，然后巡礼下一站再别天南。*
