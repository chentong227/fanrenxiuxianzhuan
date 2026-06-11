/* ============================================================
 * genart.js — 一次性生成第一章固定配图，存进仓库 assets/
 *
 * 用法（key 不写进代码，命令行临时传入；走代理）：
 *   $env:HTTPS_PROXY=""; node scripts/genart.js <OPENROUTER_KEY> [onlyId]
 *
 * 说明：
 *  - 通过 OpenRouter 的 gemini-2.5-flash-image 出图（国风水墨淡彩）。
 *  - 生成的 PNG 落地到 assets/<id>.png，提交进仓库（一劳永逸，玩家无需联网/不耗 key）。
 *  - 新人物/新场景的"实时生成 + localStorage 缓存"在 js/art.js，本脚本只管固定图。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const KEY = process.argv[2];
const ONLY = process.argv[3];
if (!KEY) { console.error("用法: node scripts/genart.js <OPENROUTER_KEY> [onlyId]"); process.exit(1); }

const MODEL = "google/gemini-2.5-flash-image";
const PROXY = process.env.GEN_PROXY || "http://127.0.0.1:7890";
const OUT = path.join(__dirname, "..", "assets");
const TMP = path.join(__dirname, "..", "test");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// 统一画风：忠于《凡人修仙传》动画剧版——3D 渲染电影质感、写实国风仙侠、
// 柔和暖调布光、半身像、神情含蓄克制。所有人物共享同一画风，保证整体协调、特征鲜明。
const STYLE_PORTRAIT = "《凡人修仙传》动画剧版同款画风，3D渲染电影级质感，写实国风仙侠人物半身像，精细面部与发丝，柔和影棚布光，气质沉静克制，竖构图，单人，纯白色背景#ffffff、人物与背景边界清晰分明、背景不含任何道具或纹理，无文字无水印无logo";
const STYLE_SCENE = "《凡人修仙传》动画剧版同款画风，3D渲染电影级场景，写实国风仙侠，光影氛围考究，意境悠远，横构图，画面铺满整个画幅、无黑边无边框无留白，无人物特写无文字无水印";
const STYLE_CG = "《凡人修仙传》动画剧版同款画风，3D渲染电影级剧情画面，写实国风仙侠，戏剧张力与光影氛围拉满，电影宽幅构图，画面铺满整个画幅、无黑边无边框无留白，无文字无水印无logo";

const DEFS = {
  // —— 主要人物立绘（剧版特征锚定，确保识别度）——
  hanli:    { kind: "portrait", prompt: "少年韩立，约十五岁，乌黑长发束成半扎发髻、余发垂肩，眉目清秀沉静，眼神坚毅内敛，身着橄榄黄绿色交领道袍、肩部有菱格暗纹，神情不动声色" },
  modafu:   { kind: "portrait", prompt: "墨大夫，一位清癯矍铄的银发老者，银白长发整齐梳向脑后，蓄花白山羊胡，面容清隽、神色沉静内敛，身着深褐色带金线团纹的医者长袍，手腕戴佛珠，气度不凡而暗藏深意" },
  lifeiyu:  { kind: "portrait", prompt: "少年厉飞雨，约十六岁，乌黑长发高束成顶髻、余发垂落肩背，剑眉星目、面容俊朗，神情沉静自信，身着青灰色交领道袍，身姿挺拔" },
  zhangtie: { kind: "portrait", prompt: "少年张铁，约十六岁，乌黑短发利落，浓眉、面容端正清朗，左脸颊有一道浅疤，神情憨厚温和、老实仗义，身着朴素的灰色粗布短打，体格结实" },
  // —— 次要/背景人物立绘 ——
  xiaosuanpan: { kind: "portrait", prompt: "门派管事弟子小算盘，约二十岁，精瘦机灵，眯缝眼、一脸精明算计的笑，束发，身着褐色短打弟子服，手里似拨着算盘" },
  jiatianlong: { kind: "portrait", prompt: "野狼帮帮主贾天龙，魁梧凶悍的壮年汉子，浓眉横肉、留络腮短须，眼神野心勃勃，身着深色劲装外披兽皮，气势粗豪" },
  jinguang:    { kind: "portrait", prompt: "金光上人，一个矮胖的中年和尚，光头、面圆，眉眼阴狠，身着土黄色僧袍、外罩袈裟，周身隐隐金光，神情倨傲" },
  nongfu:      { kind: "portrait", prompt: "采药老农，一位皮肤黝黑、布满皱纹的老山民，须发花白，头扎布巾，身着洗得发白的粗布衣，背着竹篓，神情质朴和善" },
  sanxiu:      { kind: "portrait", prompt: "云游散修，一个三十上下的漂泊修士，面色风霜、眼神桀骜，束发简陋，身着半旧的青灰色道袍，腰悬法器，神情眼高于顶" },
  langzhong:   { kind: "portrait", prompt: "走方郎中，一位精瘦的中年凡俗大夫，留短须，戴方巾，身着洗旧的灰蓝长衫，背着药箱，神情精明世故" },
  biaoshi:     { kind: "portrait", prompt: "镖局趟子手，一个结实剽悍的江湖汉子，短打劲装，腰挎单刀，面有风霜与刀疤，眼神警惕" },
  langhao:     { kind: "portrait", prompt: "野狼帮喽啰，一个凶相的壮年打手，乱发、横眉，身着杂乱的深色短打，手持狼牙棒，一脸蛮横" },
  // —— 新增立绘（剧情补全）——
  sanshu:   { kind: "portrait", prompt: "韩立的三叔，四十多岁的精明中年人，在仙门做杂事管事多年，圆脸微胖，蓄短须，笑容世故而不失亲切，身着体面的褐色绸面短褂，头戴方巾" },
  tienu:    { kind: "portrait", prompt: "被炼成傀儡的少年尸傀「铁奴」，肤色铁青毫无血色，双目空洞泛着浊白，乌黑短发散乱，左脸颊有一道浅疤，身着破败的灰色粗布短打，体格结实但姿态僵直，周身缠绕淡淡阴气，诡异悲凉" },
  // —— 场景 ——
  yaolu:    { kind: "scene", prompt: "古朴清幽的中药药庐内景，木质药柜林立、抽屉密布，铜药碾与丹炉，窗棂透入暖光，药香氤氲" },
  houshan:  { kind: "scene", prompt: "云雾缭绕的仙门后山，奇峰幽谷，灵草丛生，古木森森，溪涧幽深，深处隐有凶险气息" },
  town:     { kind: "scene", prompt: "山脚下被帮派阴影笼罩的凡俗古镇街景，青瓦土墙，市井街巷烟火气中透着压抑，街口立着插威风旗幡的帮派分舵，几条挎刀的彪悍汉子倚墙而立监视往来行人，商贩低头疾走，远处仙山隐现于云雾" },
  wuting:   { kind: "scene", prompt: "仙门演武厅内景，宽阔的木地演武场，两侧兵器架林立，梁柱庄严肃穆，天光斜入" },
  // —— 过场场景（开场剧情用）——
  qingniu:  { kind: "scene", prompt: "贫苦的北方小山村农家，低矮的土坯茅屋，柴门篱笆，几亩薄田，黄昏炊烟，清贫萧瑟" },
  road:     { kind: "scene", prompt: "通往仙门的迢迢山路，蜿蜒石径穿行于崇山峻岭，云雾缭绕，远处隐见巍峨仙山轮廓" },
  // 考据修正：七玄门是凡人武林帮派（江湖门派），不是修仙门派——山门须是武林山寨气派而非仙家殿宇
  shanmen:  { kind: "scene", prompt: "凡俗武林大派的山门，彩霞山腰间一座厚重的石砌寨门与木质牌楼，匾书门派之名，寨墙绵延，门前石阶宽阔，刀枪旗帜林立，往来皆是短打劲装的江湖武人，远山如黛，烟火人间气，无仙气无云海" },
  miju:     { kind: "scene", prompt: "墨大夫秘不示人的密室内景，幽暗压抑，石壁森森，案上摆着诡异的丹炉与瓶罐，阴气弥漫，烛光摇曳" },
  // —— 关键剧情 CG（assets/cg_<id>.png）——
  cg_bottle:    { kind: "cg", file: "cg_bottle", prompt: "一只古朴的暗绿色小瓶静静悬在少年掌心上方，瓶身流转着神秘的幽绿灵光，映亮少年清秀而震惊的脸，背景是昏暗的陋室，深夜烛光，神秘机缘降临的瞬间" },
  cg_duoshe:    { kind: "cg", file: "cg_duoshe", prompt: "深夜药庐中的生死对决：清瘦少年持短刃隐于阴影蓄势待发，对面银发老者周身泛着阴冷光芒、面容狰狞似被夺舍，烛火摇曳将两道身影拉长，药柜林立的房间里杀机四伏，决战一触即发" },
  cg_jinguang:  { kind: "cg", file: "cg_jinguang", prompt: "山林夜战：一个矮胖和尚周身金光大盛如金钟罩体，怒目狰狞，无数细小的暗器飞针破空袭来钉向金光，少年的身影半隐于林间黑暗中，以暗算破金刚，紧张凌厉的战斗瞬间" },
  cg_departure: { kind: "cg", file: "cg_departure", prompt: "清晨薄雾中，一个背着行囊的少年道袍身影独自走在下山的古道上，回望一眼巍峨仙门，前方群山苍茫云海翻涌，离别与新程交织的苍凉意境，大远景构图" },

  // —— 离门远行章（考据：lore-departure.md，动漫7~9集）——
  mocaihuan: { kind: "portrait", prompt: "少女墨彩环，约十五六岁，乌黑长发梳成俏皮的双髻、缀着红色发绳，杏眼圆亮、古灵精怪，笑容狡黠又娇憨，身着鹅黄色绣花襦裙、外罩浅碧色比甲，凡俗富家小姐装束，手里把玩着一只小药丸，神情活泼灵动" },
  // （考据修正 2026-06-11：动漫线嘉元城无欧阳飞天之战——墨府之敌是五色门，在京城篇兑现。
  //   原 ouyangfeitian 立绘已废弃删除，引以为戒：先考据后生图。）
  jiayuan_city: { kind: "scene", prompt: "古代南方大城的繁华街市与一座朱门宅院，青石长街车马如流、商铺林立旗幡招展，街角望去一座高墙朱门的大宅（门庭略显冷落、匾上漆色微剥），南方水乡富庶气象，黄昏暖光，市井烟火气浓郁，无仙气" },

  // —— 天南·越国大舆图（大陆层底图）——
  // 地理考据（凡人手册/原文）：镜州在越国西北（贫困，彩霞山=镜州第二大山，原名落凤山，
  // 传说五色彩凤化山）；建州在北部（第二大州，多山丘陵，西部太岳山脉连绵数千里，黄枫谷在焉，
  // 北接元武国）；岚州在南部（第二富足产粮大州，嘉元城为岚州第一城，最南广贵城三面环山一面靠湖，
  // 西四十里太南山）；越京居中为京城；东侧临海（乱星海远在海外）。
  tiannan_map: { kind: "scene", file: "tiannan_map", prompt: "中国古代水墨舆图风格的越国全境鸟瞰地图，宣纸米黄底色，写意山水画法：西北角群山连绵（其中一峰隐隐透出五色霞光），正北横亘一条雄浑绵长的大山脉（山势嵯峨连绵数千里），中部平原点缀城郭与阡陌，南部沃野千里河渠纵横（产粮富庶之地），最南端有湖泊与环山小城，东侧为蜿蜒海岸线与浩渺远海（海上墨色留白），山用披麻皴、水用留白法、城郭用简笔界画，淡彩晕染，古意盎然，俯瞰视角，绝对不含任何文字、地名、标记、印章、图例、罗盘", },
};

function genOne(id, def) {
  const style = def.kind === "portrait" ? STYLE_PORTRAIT : def.kind === "cg" ? STYLE_CG : STYLE_SCENE;
  const body = JSON.stringify({
    model: MODEL,
    modalities: ["image", "text"],
    messages: [{ role: "user", content: `${style}。画面内容：${def.prompt}。` }],
  });
  const bodyFile = path.join(TMP, "_genart.body.json");
  const respFile = path.join(TMP, "_genart.resp.json");
  fs.writeFileSync(bodyFile, body);
  // 用 curl.exe 走代理（本机已验证可直出图）
  execFileSync("curl.exe", [
    "-s", "-x", PROXY, "-X", "POST", "https://openrouter.ai/api/v1/chat/completions",
    "-H", "Authorization: Bearer " + KEY,
    "-H", "Content-Type: application/json",
    "-H", "X-Title: FanrenXiuxian",
    "--data", "@" + bodyFile,
    "-o", respFile,
  ], { stdio: "ignore" });
  const j = JSON.parse(fs.readFileSync(respFile, "utf8"));
  if (j.error) throw new Error(JSON.stringify(j.error));
  const m = j.choices && j.choices[0] && j.choices[0].message;
  const url = m && m.images && m.images[0] && m.images[0].image_url && m.images[0].image_url.url;
  if (!url) throw new Error("无图片返回: " + JSON.stringify(j).slice(0, 200));
  const b64 = url.split(",")[1];
  const outFile = path.join(OUT, (def.file || id) + ".png");
  fs.writeFileSync(outFile, Buffer.from(b64, "base64"));
  try { fs.unlinkSync(bodyFile); fs.unlinkSync(respFile); } catch (e) {}
  return outFile;
}

// 生成后自动后处理：立绘抠透明底；场景/CG 裁影院黑边
function postProcess(file, def) {
  try {
    if (def.kind === "portrait") {
      execFileSync("node", [path.join(__dirname, "cutout.js"), file, file], { stdio: "inherit" });
    } else {
      execFileSync("node", [path.join(__dirname, "cropbars.js"), file], { stdio: "inherit" });
    }
  } catch (e) { console.log("  后处理失败（图已保存，可手动处理）:", e.message); }
}

(async () => {
  const ids = ONLY ? [ONLY] : Object.keys(DEFS);
  for (const id of ids) {
    if (!DEFS[id]) { console.log("跳过未知 id:", id); continue; }
    process.stdout.write(`生成 ${id} ... `);
    try { const f = genOne(id, DEFS[id]); console.log("✓"); postProcess(f, DEFS[id]); }
    catch (e) { console.log("✗", e.message); }
  }
  console.log("完成。");
})();
