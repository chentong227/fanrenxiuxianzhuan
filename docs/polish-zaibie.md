# 再别天南篇 · 打磨清单（双审合并版 · 2026-07-12）

> 巡礼第 4 站。Fable 5 审戏（`_review-zaibie-fable.md`）+ GPT 5.6 审机器（`_review-zaibie-gpt.md`）。
> **共识**：本章设计定位=「衔接为主、自由度适当低的过场大章」——帆薄/涟漪 0/一本道不立案；
> story.js 侧 v315 五勘正执行干净（护道反转/碎丹赌约/辛如音不死/化身移小寰岛逐条复核全对）；
> 李化元殉道一场演出密度全章最佳（**双审同令：不要动**）；上一站账响得齐（董萱儿卖破绽/曲魂留府/王蝉追兵/大挪移令）。
> **病灶**：①正典曲魂留府线把夺舍战压到 **1.5%**、带走线 100%——98.5pt 断崖是全作之最；
> ②两段"帆窗"落在 `scene:true, actions:[]` 的地点=**没有门的房间**（行动层软锁）；
> ③engine/world 的收尾文案没跟上 v315 勘正——**李化元在玩家眼前死两次**；
> ④核心物品链断裂（黑煞血刃从未入袋/大挪移令用后不消耗/30 灵石承诺是阵能实际进钱包）；
> ⑤**白菊山之约（魔道站钦点立案项）确认失约**——本章无一字陈巧倩，forgot/remember 双线差异=零。
> 时长：手操 1.0~1.7h（正典线被夺舍战重试拖长）；游戏内仅 3 月、有效自由月 0。
> **新系统节拍（#9）判定达标**：保护型 survive（敌扑最弱/毁阵偏置）+曲魂常驻侧位首发，与魔道站间隔 1 章。
> 门禁盲区实锤：combat-sweep 默认无 `quhun_stay_jiayuan` 永走 easy 线；backbone 清零 `_due` 测不到帆窗软锁。

---

## ✅ Bug 批（客观缺陷·即修不占拍板）

| # | 项 | 修法 | 出处 |
|---|------|------|------|
| B① | **李化元死两次**：zb_hushan 胜利结算 ledger/milestone/log 三件+world.js 金鼓原 desc 还是勘正前旧稿"燃命布阵殉道"——守阵胜利先播他死、下一张卡他活着立碎丹赌约再死一次，年表躺两条殉道 | 4 处纯文案改"催阵大耗、犹自撑着"；殉道只留 a2_lihuayuan 一处 | Fable P0-1 |
| B② | **zb_jingu 账本写错同伴**："与李化元、南宫婉并肩斩魔"——canon-Z6 勘正后此战是宋蒙/钟卫娘（战斗编排已对，账本在说谎） | win ledger+败北 log 两处改名 | Fable P0-2 |
| B③ | **夺剑"顺手取储物袋"双向谎报**：zaibie_greedy 全库零读——承诺的额外掠取不入袋、威胁的"追兵更快"无读点 | zb_duoshe win 读 greedy 补发（lingshi+5/材料×1 点名）+ zb_kuangdong 读 greedy 多一名追兵（威胁成真） | Fable P0-5 + GPT 6.2 |
| B④ | **物品链断裂×2**：黑煞血刃全库无 give（附傀凭空武装）；大挪移令"应手而碎"后仍在背包 | 胥王战结算真实 give heisha_xueren+附傀检查持有；cut1 传送拍 State.take("dayi_ling") | GPT P0-4 |
| B⑤ | **跌境卡教学括号**：名场面正中央挂系统说明+剧透"一举踏入结丹"（modao D4 同款病） | 括号段移 sys log；剧透删 | Fable P1-1 |
| B⑥ | **辛如音玉简凭空出现+立绘在库不用**：a3 只赠图纸、cut1 却引用"托付的玉简"（xinruyin_letter 在 cut1 才 give）；xinruyin 半身像注册了全场不请 | give+叮嘱移进 a3（加 actor 拍）；cut1 只作引用 | Fable P1-3 |
| B⑦ | **arc3_complete 从未写**：chapters.js 声明的魔道 completeFlag 全库零写点 | modao_e4b_likjing onArrive 补写 | GPT P1-6 |
| B⑧ | 矿洞口"海风叹息"（内陆无海）；30 灵石账面"助催古阵"实际进钱包 | "夜风"；cut1 阵启拍加"灵石尽数嵌入阵眼化作齑粉"（或改文案"疗复盘缠"——选前者，承诺兑现） | Fable P2-3 + P1-2③ |

## A · 曲魂断崖与战斗档（本站最大数值病）

| # | 项 | 改法 | 出处 | 工程 |
|---|------|------|------|------|
| A1 ✅v320 | **夺舍战双线断崖 98.5pt**：正典留府线 1.5%（前两战无 side）vs 带走线 100%；连败刷条（3 败后仍仅 40%）——情感分支决定 boss 是近死局还是白给 | 已落（engine.js startDuosheFight·数据=真存档 N=200 贪婪地板）：**留府线 1.5%→≈57~60% / 带走线 100%→≈86~88%，断崖 98.5pt→≈28pt**。①留府线=夺舍者强占的正是曲魂躯壳（p1 hp×0.9"契合不全"）——碎茧拍战中注入曲魂侧位反戈（`_maybeSpawnWave` 包裹+`_makeSideFighter`+sides.push=噬金虫召唤同款管线·**引擎原生支持战中入 side**·血刃未附故用空手尸傀招式 hp190）；②带走线微削=此战曲魂副本 ×0.65/承伤×0.6（`_quhunSideScaled` 深拷贝 moves·不动 s.sideUnit）+敌 slays corpse ×1.6（驭尸行家专拆傀身）+夺傀偏置（敌集火曲魂）+**真实赌注**：敌在场时傀身碎=夺傀而遁=判负（lose 分支曲魂就地修复+专属败词=fail-forward 不留 broken 死螺旋；另加"金背战破损→临战修傀"防 1.5% 单人墙回潮）；③温养/强催真差异：温养=曲魂在场拍护主替挡（护体+16）、强催=此战招式×1.12；④连败补偿 +8%×3 保留 | GPT P0-1 | 中 |
| A2 ✅v320 | **护山"守李化元"目标是假的**：side 未钉桩（move 自由）、敌无毁阵偏置、他 hp=0 不判败——保护战名不副实 | 已落：李化元 move:0 钉桩+`_enemyTargetBias`（≤4 格锁向他·hudao/kuangdong 同款保护管线）+hp≤0 **无论死因立即 lose**（旧 hook 对他死亡直接 return）+deathCause 点名+败局分流文案（阵眼失守="曲魂拼死拖回·他还有气"）。改后：胜率 100%→≈98%（守住结丹长老仍是常态）、**他的胜局末血 99.6%→≈55~58%（真的会被打）**，hp≤0→lose 确定性断言入门禁 | GPT P0-3 | 小 |
| A3 ✅v320 | **三战白给**：金鼓原/护山/矿洞 100% 胜率、末血≈满、玩家伤害占比 17%/24%/26%（曲魂+同袍代打）——survive 首演零张力三连发 | 已落：曲魂群战副本缩放（金鼓原×0.5/护山×0.65/矿洞×0.6·`_quhunSideScaled` 只动本场拷贝）+宋蒙钟卫娘招式下调（20/16/18/22→10/8/10/12·钟卫娘 aggr 8→5"分神照应弟子"）+矿洞毁阵偏置 3→5 格（阵枢承压：末血 77%→≈65%）。**玩家占比 17%/24%/26%→≈38%/35%/38%**（胜率 100/98/97%——survive 保护战守住是常态·张力在保护对象身上）。矿洞追兵换皮**鬼灵门执事/鬼灵门修士**（王蝉的人·燕家堡背锅旧账·introNote/开战播报重写·主控 extraChaser 同步换皮·数值 elem 全沿用不动平衡·ui.js 补 /鬼灵门/→bt_moxiu 映射）。**判断记档：金背妖螂入场战 100%/末血 86%（留府独力）偏软可接受**——险在留府线末血打到 86% 且是章首定调战，不再加压 | GPT P1-3 + Fable P1-4 | 中 |
| A4 ✅v320 | **新门禁**：sweep 永走 easy 线/backbone 清零 due——本站问题全在工具盲区 | 已落三件：①`test/zaibie.bal.js`（真引擎+save-modao-e3·六战蒙特卡洛：夺舍双线带 25~70%/≤90%·三战占比 ≥30%·护山李化元 hp≤0→lose 确定性断言+末血 35~92% 带·矿洞换皮断言·六战 fail-forward 全查）；②`test/zaibie-time.audit.js`（两帆窗地点 actions 非空含耗月行动+非 scene+kuangdong where 锚+两 due 时锚存在+repairZhenwen/rest 真耗月——依赖帆窗组 B1 已落地·全绿）；③combat-sweep 曲魂双线各半采样（`runOnce(stayLine)`+zb_jinbei/zb_duoshe 分桶 @stay/@take·fail-forward 查表剥后缀·头注记 zb_duoshe@stay 裸号 0%=预期地板非死局） | GPT P1-8 | 中 |

## B · 帆窗与白菊山（结构修）

| # | 项 | 改法 | 出处 | 工程 |
|---|------|------|------|------|
| B1 ✅v320 | **两段帆窗=没有门的房间**：jinguyuan（+2月）/yuekuang（+1月）均 scene:true+actions:[]——无调息无闭关无倒计时，唯一耗月手段是出门云游；kuangdong 窗自相矛盾（objHint 说"你在矿洞补阵纹"，人却必须离开矿洞；节点无 where 会在任何地方弹卡瞬移） | 已落全档：①两地点去 scene 化（场景底走 LOC_CG 兜底 jingu_yuan/chuansong_zhen 不依赖 scene 标记）——jinguyuan 加 rest（actionLabels「残营调息」·desc 补"残军暂驻"）；yuekuang 加 rest+专属月行动 `xiuzhen`「修补阵纹 ⚙」（Engine.repairZhenwen：passTime(1)+三条文案池轮换见闻+flags.zhenwen_repaired 计数=objHint"这一个月补全阵纹"的承诺兑现；yuekuang desc 顺删"追兵已踏碎洞口"——帆窗月追兵未至）；②currentObjective 补两 due 倒计时分支（残营喘息 N 月/矿洞补阵纹 N 月·xianhui_due 同构）；③a4_kuangdong 补 where:"yuekuang"（天命栏自动缀去处）；④ui.js labels×2 已挂 | Fable P0-4 + GPT P0-2 | 小~中 |
| B2 ✅v320 | **白菊山之约（跨站钦点·本站主菜）**：baiju_appt 零读零 settle、本章零陈巧倩、remember/forgot 双线差异=零；Act2"战报→群战→守阵→殉道"一路下坠无温情谷——动漫把这场道别放在金鼓原开打前夜，戏就该在这儿 | 已落：a1_after 与 a2_jingu 之间插 `zaibie_baiju`（cond=readLedger(baiju_appt)‖chen_front_reunion 旧档兜底·skipIf 无账自然越过=forgot 线零痕迹）：越京郊白菊山半日、《落英》旧曲、她知战至而不拦、"结丹归来再来看花"、settle baiju_appt+写远账 `baiju_rehui`（H 类·重返天南读）、心性双拍（摘菊别剑穗 sentiment/记调子入心 stoic）、节点尾金鼓原血色狼烟拽人走=Act2 跳板；**取舍（档案记）**：①ep50 百药园温情并入她口讯一句（马师伯念叨参苗——本作萧翠儿线已在京城 likjing 收束，不再另拍）②where 不设（南返路过顺序流自弹）③场景底复用 tainan_lin（白菊山专属 CG 可入生图批）。remember 线全链已无头驱动验证（节点弹出/两账落地/章末可达） | 双审 P0 同锚 | 中 |

## C · 账本与演出

| # | 项 | 改法 | 出处 | 工程 |
|---|------|------|------|------|
| C1 ✅v320 | **承诺已兑现账不销×2**：quhun_huashen 带走线（starsea 小寰岛实际炼成只写新账不销旧）/diejing（小寰岛拾回修为拍不 settle+两章归因口径漂移） | 小寰岛闭关节点补两 settle；"落海暂虚"改双因并提（她吸走的+落海再虚的） | Fable P1-2 | 小 |
| C2 ✅v320 | **cut1 离开天南缺拍**：题眼台词"总有一天我会回来的"无静默留白；宿敌王蝉只活在 aside（bt_zhanwangchan 在库不用）；誓言后无 pullOut | 追兵拍加 actor 王蝉+一句被光柱吞没的嘶吼（⚠实装喊「厉飞雨！——」非"韩立"——认脸不认名勘注锁死，见 D 项）；誓言前 amb:null+wait、后 pullOut | Fable P1-5 | 小 |
| C3 ✅v320 | **cut2 乱星海缺拍**：首见海全程无声床；定格 zoom 推近人——设计钦定大远景空镜收向海平线 | 落水后 amb:"wind"（duck:false）；末拍改 pullOut 收海平线+wait 拉长+guide 前静默一拍 | Fable P1-6 | 小 |
| C4 ✅v320 | **章末告别清单缺位**：此去几十年，对凡人牵挂零回望（fate-design §三写给这个位置） | cut1"最后回望"选项结果文案按 flag 具名（墨彩环/厉飞雨/陈巧倩各一句剪影回想——选项本来就在，只是望见的全是山不是人） | Fable P1-7 | 小 |
| C5 ✅v320 | **四敌字牌裸奔**：金背妖螂/夺舍者/童老/鬼老无战斗立绘无映射 | 短期：夺舍者→bt_sanxiu、童老/鬼老→bt_moxiu、金背妖螂→bt_wugong 占位映射已落；真身 DEFS+红拂/云露半身像已立案（见下生图批栏）；殉道场 meetNpc hongfu/yunlu+图鉴条目已落 | Fable P1-8 + P2-4 | 映射极小 |
| C6 ✅v320 | **大件到手不诚实**：绿煌剑无整备窗（到手即被三场白给淹没）；图纸/令牌矿洞 cond 不检查持有 | 夺舍战报后一拍法宝阁整备提示；kuangdong 走**叙事诚实**（text 开头 aside 点名双钥缺一不可）——硬 cond 持有检查实测会把 backbone 无头驱动（不经 modao e1 机缘房）误判成死链、且异常档缺物=永久软锁，故弃 | GPT P1-5 | 小 |
| C7 ✅v320 | 假选择清理：星夜/调息×2（世界侧承诺零读点）/hold_realm/accept_drop/calm 死旗 | 已落（选文案收敛档·省事诚实）：①open/a1_after 两组"星夜 vs 调息"——hint+结果文案删"御灵宗更近/战局恶化"空头威胁只留气血代价，zaibie_rush/rest/rush_jingu/rest_jingu 四死旗删；②diejing hold_realm/accept_drop 死旗改 recordTemperament（stoic/sentiment·hint 缀「铸入心性」·mood-5/hp 满的真实差异保留）；③cut2 豪气/冷静——zaibie_calm 死旗删、双路 recordTemperament（sentiment/stoic·mood±5 保留）；④quhun_safe_refine **保留不删**——曲魂战斗组 A1 已接读点（engine.js 温养=护主替挡一拍护体+16），prot+3 机制本真 | GPT 6.2 + Fable P2-1/2 | 小 |
| C8 ✅v320 | worldNews 补 Act2 崩盘质感：浮云子陨落/婉拒掩月宗/拜别吕蒙卫娘各一条；modao_awol 章切清旗；旧档 quhun done 无 side 自愈 invariant | 已落：①浮云子陨落挂 a2_jingu（ep52 红粉/骷髅"恭送"·world 条）；②婉拒掩月宗招揽挂 a4_lingshi（ep58 冯师妹·rumor 条）；③拜别宋蒙/钟卫娘挂 a2_lihuayuan（ep58"拜别吕蒙卫娘"·本作对应此二人·rumor 条）；④章首自愈：zaibie_open onArrive 补"quhun_done 且无 sideUnit 且无 pending→补 zaibie_quhun_pending"（a1_after 兑现点重新附刃归位）；modao_awol 清旗主控已落（B 批） | Fable P2-6 + GPT P2-2/§7.2 | 小 |

## D · 跨站立案（本站不实装）

- **王蝉认脸不认名勘注** ✅v320 已落——zaibie-tiannan-design.md 头部勘注段已加（ep53"知真名"不实装=有意取舍·cut1 嘶吼拍按「厉飞雨」口径实装）；重返天南对质拍读（chongfantiannan-design §幕Ⅲ·15 背锅独白拍已挂）。〔Fable P2-5〕
- **guzhen_tuzhi 阵法线下游** ✅v320 已立案——chongfantiannan-design §幕Ⅲ·12（cf_a3_yicang 辛如音阵法传承）记"须读图纸一次做台词点名"；本站不实装。〔Fable P2-7〕

### 生图批立案（scripts/genart.js Z1_DEFS 已写好·待跑）

- `bt_jinbei`（金背妖螂战姿·鎏金硬甲巨螂）/ `bt_duoshezhe`（御灵宗夺舍者·青灰袍阴鸷修士持绿煌剑）/
  `hongfu`（红拂半身像·白衣风云幡结丹女修）/ `yunlu`（云露老魔半身像·慵懒绛紫华袍元婴魔修）。
  跑：`node scripts/genart.js bt_jinbei bt_duoshezhe hongfu yunlu` → trimfeet + 目检朝向注册 art.js →
  ui.js `_battlerByName` 把占位映射（妖螂→bt_wugong / 夺舍者→bt_sanxiu）替换为专属 id。〔C5 后续〕
- **经济联审**（v319 后入章身家 91+ 灵石且本章零消费）——初入星海站联审物价。〔GPT P1-9〕
- **Build 三路本章乘法点**（六战不读剑/丹/阵任何熟练）——若 B1 帆窗落地后仍无经营感，星海站回看。〔GPT P1-2〕

---

## 拍板项（其余默认按清单实装）

1. **A1 曲魂断崖修法**——推荐"留府线二阶段曲魂认主回身"（正典自洽+机制救崖）：留府冷开拉到 35~65%、带走线压到 ≤85%。确认？
2. **B1 帆窗档位**——推荐全做（两地点补行动+倒计时+where+due 分支）；最省版=删 kuangdong_due（1 月喘息无内容=纯堵门）。选哪档？
3. **B2 白菊山节点**——本站主菜（跨站立案兑现·一个节点+双态文案+两笔账·无战斗）。确认？
4. **A3 三战白给校准**——动曲魂/同袍数值（玩家占比拉 ≥35%）+矿洞追兵换皮鬼灵门，跑新门禁 A4。确认？
5. Bug 批八项即修（客观缺陷不占拍板）；C 组+A2/A4 默认全做，有不要的点名。

*实装完成后：全量回归 + zaibie.bal/zaibie-time.audit 新门禁 + 430×932 实测，然后巡礼下一站初入星海。*
