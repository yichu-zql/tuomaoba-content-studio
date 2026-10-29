/* 创意生成器
   - 本地规则引擎：任何地方都能用（包括 GitHub Pages），按“想法 + 形式 + 卖点 + 档期”拼出完整创意
   - 在 claude.ai 里打开时，可以改用 Claude 生成（window.claude 的 sample 能力），失败自动退回本地引擎 */
(function () {
  'use strict';

  function pick(arr, seed, off) { return arr[(seed + (off || 0)) % arr.length]; }
  function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) : s; }

  var SCENES = [
    { re: /午休|中午|午饭/, name: '午休', who: '在附近上班、午休有空的人' },
    { re: /下班|加班|通勤/, name: '下班路上', who: '下班会路过{商场}的上班族' },
    { re: /逛街|商场|购物|看电影|吃饭/, name: '逛街', who: '周末来{商场}逛街吃饭的人' },
    { re: /宿舍|开学|学校|大学|学生|下课|校园/, name: '下课后', who: '附近学校的学生' },
    { re: /健身|瑜伽|运动|游泳|跑步/, name: '健身前后', who: '有健身、游泳习惯的人' },
    { re: /约会|见面|男朋友|女朋友|对象/, name: '约会前', who: '有约会、见面计划的人' },
    { re: /旅行|旅游|度假|海边|出游/, name: '旅行前', who: '计划出去玩、要穿短袖的人' },
    { re: /过年|回家|春节|年货/, name: '过年回家前', who: '年前想收拾一下自己的人' },
    { re: /闺蜜|朋友|同事|室友|姐妹/, name: '约上朋友', who: '喜欢和朋友结伴的女生' },
    { re: /夏天|短袖|露/, name: '夏天前', who: '每年夏天才想起脱毛的人' },
    { re: /冬天|冬季|长袖/, name: '冬天', who: '想趁冬天开始脱毛的人' }
  ];
  var DEFAULT_SCENE = { name: '逛街', who: '门店周边 3–5 公里、会路过{商场}的人' };

  var POINTS = {
    '价格反差': {
      hooks: ['美容院一次几百，这里 {新人价} 一次', '{八次卡} 块 8 次，一次不到 10 块', '一次 {新人价}，奶茶钱就能脱个毛'],
      lines: ['新人腋下+手臂 {新人价} 元一次，8 次卡 {八次卡} 元，折合每次 {八次单次}', '按次付费，不用一次办几千的卡'],
      cover: ['{新人价} 元\n脱一次', '一次\n不到 10 块'], slots: ['S9', 'S5']
    },
    '没人推销': {
      hooks: ['全程没人跟你推销的脱毛店', '不用和人尬聊的脱毛店', '一个人进去、一个人做完'],
      lines: ['无人值守，独立隔间，门能锁，扫码开机有语音指引', '自己扫码、自己操作，做完就走，没人劝你办卡'],
      cover: ['没人推销的\n脱毛店', '一个人的\n脱毛隔间'], slots: ['S5', 'S7']
    },
    '顺路就做': {
      hooks: ['{scene}顺路就把毛脱了', '{scene}多走几步，去脱个毛', '不用预约，{scene}路过就进'],
      lines: ['店就在{商场}{位置}，{scene}顺路就能做', '不用预约，到店扫码就开始'],
      cover: ['{scene}\n顺路脱个毛', '不用预约\n路过就进'], slots: ['S1', 'S3']
    },
    '看得见的干净': {
      hooks: ['无人店干不干净？把隔间拍给你看', '进门先把台面擦一遍', '一人一间的脱毛隔间长这样'],
      lines: ['隔间里备有消毒用品，台面、座椅、设备用前都能自己再擦一遍', '独立隔间，一人一间，门能锁'],
      cover: ['干不干净\n拍给你看', '隔间\n长这样'], slots: ['S8', 'S5']
    },
    '先试再买': {
      hooks: ['想买脱毛仪又怕吃灰？先去店里试一次', '店里用的就是 Ulike 的设备', '买机器之前，先花 {新人价} 试试'],
      lines: ['店里用的是 Ulike 的设备，先体验，再决定买不买', '体验后买 Ulike 脱毛仪立减 {购机立减} 元'],
      cover: ['先试\n再买', 'Ulike 设备\n先体验'], slots: ['S6', 'S5']
    }
  };
  var THEME_POINTS = {
    '门店体验': ['没人推销', '顺路就做'], '活动介绍': ['价格反差'], '真实反馈和打卡': ['没人推销'],
    '项目背书': ['先试再买'], '门店指引和点位': ['顺路就做'], '科普答疑': ['没人推销', '价格反差'], '福利与拉新': ['价格反差']
  };

  var OCC = {
    '常规': { period: '常规', line: '新人腋下+手臂 {新人价} 元一次', short: '新人 {新人价} 一次', when: '即日起', refs: [] },
    '冬日打卡季 · 28 天打卡': { period: '冬日打卡季', activity: '打卡', line: '第一次到店核销后自动开启 28 天光滑打卡，4 周 8 次，周周有礼，第 4 周毕业抽奖', short: '28 天打卡 周周有礼', dead: '冬日打卡季到 {打卡季截止}', when: '11/14 打卡上线后', refs: ['打卡_01_新人未开启', '打卡_02_打卡进行中', '打卡_04_周礼包晒小红书'] },
    '冬季 20 次卡': { period: '冬日打卡季', line: '冬季 20 次卡：腋下+手臂 {冬季20次} 元，大腿+小腿 {冬季20次腿} 元', short: '{冬季20次} 元 20 次', dead: '冬日打卡季到 {打卡季截止}', when: '即日起至 {打卡季截止}', refs: [] },
    '11.11 购机': { period: '11.11 购机', line: '到店体验后买 Ulike 脱毛仪立减 {购机立减} 元，保价双十一', short: '先试再买 立减 {购机立减}', dead: '活动到 {购机截止}', when: '即日起至 {购机截止}', refs: ['小程序_00_首页现状'] },
    '邀好友到店': { period: '冬日打卡季', activity: '邀友', line: '好友第一次到店，你抽 1 次奖，人人有奖；好友得一张面部单次券；满 3 位加送芦荟胶，满 5 位加送 8 次脱毛卡', short: '好友到店 双方有礼', when: '11/28 邀友上线后', refs: ['邀友_02_邀好友到店页', '邀友_03_好友打开邀请卡', '邀友_04_好友到店抽奖'] },
    '视频号集赞': { period: '冬日打卡季', activity: '集赞', line: '给官方视频号点赞、转发朋友圈，集满 5 个赞上传截图就能抽奖，人人有奖', short: '集 5 个赞 人人有奖', when: '12/19 集赞上线后', refs: ['集赞_01_首页入口', '集赞_02_集赞任务页', '集赞_03_抽奖结果'] },
    '双12 / 跨年 · 双人卡': { period: '双12 / 跨年', line: '闺蜜双人卡 {双人卡} 元，两个人各用一个隔间', short: '闺蜜双人卡 {双人卡}', when: '12 月', refs: [] },
    '年货节': { period: '年货节', line: '年货节全身 {全身新人价} 元，还送 Ulike 购机券', short: '全身 {全身新人价} 送购机券', dead: '活动 1/4–2/5', when: '1/4–2/5', refs: [] },
    '情人节': { period: '情人节', line: '情人节双人卡，约上闺蜜或另一半一起来，价格看店铺页', short: '情人节 双人卡', when: '2/14 前', refs: [] },
    '女神节': { period: '女神节', line: '女神节专享 6 次全身卡，价格看店铺页', short: '女神节专享', dead: '活动 3/1–3/10', when: '3/1–3/10', refs: [] }
  };

  /* 问答合集用：像店员本人在答，说具体细节，不用统一标准答案 */
  var QA = [
    ['疼不疼？', '说实话看部位。手臂基本就是热一下，腋下敏感的会有点刺，档位自己调，第一次先开低档。'],
    ['要做几次？', '一次是试感觉的。想看变化就跟着小程序的 28 天打卡来，4 周 8 次，每个人情况不一样。'],
    ['两次隔多久？', '至少隔 2 天。小程序会提醒你哪天该来，不用自己记。'],
    ['要准备什么？', '来之前把毛刮干净（这步别偷懒），带上手机就行，其他店里都有。'],
    ['卫生吗？', '一人一间，台面上有消毒湿巾。我自己去也是先擦一遍再用，一两分钟的事。'],
    ['和家用仪有什么不一样？', '店里用的就是 Ulike 的设备。区别是不用自己买、不怕吃灰，顺路做一次付一次。']
  ];
  function cta(p, acct, spoken) {
    if (p === 'sph') return '点下方链接，看离你最近的门店👇';
    if (p === 'pyq') return acct === '老客' ? '想去的私我，我发你邀请卡～' : '想试的点卡片，或者找我拿本店优惠码～';
    if (acct === '门店号') return spoken ? '{商场}{位置}，搜 Ulike脱毛吧 就能找到' : '📍{商场}{位置}｜搜「Ulike脱毛吧 {商场}」';
    return spoken ? '搜 Ulike脱毛吧，看离你最近的店' : '搜「Ulike脱毛吧＋商圈名」看离你最近的店～';
  }

  /* 评论区回复：按卖点挑问题，从回复库轮换说法；门店号用店主口吻 */
  function replies(acct, seed, pts) {
    var who = acct === '门店号' ? 'dian' : 'guan', keys = ['where', 'pain', 'price'];
    if (pts && pts.indexOf('看得见的干净') >= 0) keys[1] = 'clean';
    if (pts && pts.indexOf('没人推销') >= 0) keys[2] = 'sell';
    return keys.map(function (k, j) { return RP(k, seed + j, who); }).join('\n\n');
  }

  function slotsFor(form, pts, theme) {
    var s = [];
    pts.forEach(function (k) { (POINTS[k].slots || []).forEach(function (x) { s.push(x); }); });
    if (/路线|指引|门店合集/.test(form) || theme === '门店指引和点位') s = ['S10', 'S2', 'S3', 'S1'].concat(s);
    if (/九宫格/.test(form)) s = ['S1', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S2', 'S10'];
    if (/vlog|探店|第一视角/.test(form)) s = s.concat(['S1', 'S5', 'S7']);
    return s.filter(function (x, i) { return s.indexOf(x) === i; }).slice(0, 9);
  }

  function scriptFor(form, c) {
    return scriptRaw(form, c).map(function (r) { return r.map(function (x) { return x.replace(/\{sceneName\}/g, c.sceneName); }); });
  }
  function scriptRaw(form, c) {
    var R = function (a, b, d) { return [a, b, d]; };
    switch (form) {
      case '剧情':
        return [R('0–3s', 'A 拉住 B（{sceneName}，商场里）', 'A：' + c.hook), R('3–9s', '两人边走边聊，看导视找店', 'B：自助的？没人推销吧？ A：没有，自己扫码'), R('9–16s', '两个隔间门先后关上', '字幕：' + c.line1), R('16–22s', '出门后 A 看手机', 'A：' + c.occShort), R('22–28s', '两人在门头前', '字幕：' + c.cta)];
      case '价格字卡':
        return [R('0–3s', '手机计算器 / 价格大字', '字幕：' + c.hook), R('3–9s', '美容院、家用仪示意字卡', '口播：美容院单次几百，家用仪一两千，买回去还怕吃灰'), R('9–16s', '门店隔间、扫码开机', '口播：' + c.line1), R('16–22s', '价格字卡', '字幕：' + c.occLine), R('22–26s', '门头', '口播：' + c.cta)];
      case '对比测评':
        return [R('0–3s', '三分屏字卡', '字幕：' + c.hook), R('3–10s', '“美容院”示意字卡', '口播：有人帮你做，单次价格偏高，还要提前约'), R('10–16s', '家用仪在桌上', '口播：一次投入，适合能坚持在家做的人'), R('16–23s', '自助店隔间', '口播：' + c.line1), R('23–28s', '总结字卡', '口播：还没想好的，先去店里试一次。' + c.cta)];
      case '路线实拍':
        return [R('0–3s', '{商场}外立面或大门', '字幕：' + c.hook), R('3–7s', '进门、导视牌', '字幕：{位置}'), R('7–11s', '走到店门口，门头', '口播：就是这家 Ulike脱毛吧'), R('11–15s', '推门进隔间、扫码开机', '字幕：' + c.cta)];
      case '口播讲解':
        return [R('0–3s', '出镜人半身，背景是门头', '口播：' + c.hook), R('3–10s', '插入隔间空镜', '口播：' + c.line1), R('10–17s', '插入扫码开机画面', '口播：' + c.line2), R('17–23s', '字卡', '字幕：' + c.occLine), R('23–27s', '门头', '口播：' + c.cta)];
      case '门店合集':
        return [R('0–3s', '{城市}门店地图卡', '字幕：' + c.hook), R('3–15s', '各门店门头快切，每家 2 秒', '字幕：门店名 + 位置'), R('15–20s', '小程序自动定位画面', '口播：点链接，自动找到离你最近的店'), R('20–24s', '价格字卡', '字幕：' + c.occShort)];
      case '活动讲解':
        return [R('0–3s', '活动主视觉 / 小程序活动页', '字幕：' + c.hook), R('3–10s', '小程序录屏', '口播：' + c.occLine), R('10–17s', '门店隔间空镜', '口播：' + c.line1), R('17–23s', '礼品、积分画面', '字幕：' + (c.occDead || c.occShort)), R('23–27s', '门店空镜', '字幕：' + c.cta)];
      default: /* 第一视角 vlog / 逛店 vlog */
        return [R('0–3s', '{sceneName}出发，镜头跟着走进{商场}', '字幕：' + c.hook), R('3–8s', '走到店门口，推门', '口播：' + c.line1), R('8–15s', '扫码开机，设备放在小臂上（只拍手臂）', '口播：' + c.line2), R('15–21s', '隔间全景 + 字卡', '字幕：' + c.occShort), R('21–26s', '出门继续逛，门头', '口播：' + c.cta)];
    }
  }

  function xhsBody(form, c, theme, acct) {
    var lines;
    if (form === '晒单模板') {
      return '【写一句你为什么来】\n店在{商场}{位置}，' + c.line1 + '。\n我的感受：【写你自己的真实感受】\n' + (c.occ.activity === '打卡' ? '已打卡【N】/8 次，下周继续～' : '下次还来～');
    }
    if (form === '问答合集') {
      return c.hook + '，评论区问得多的统一回答👇\n\n' + QA.slice(0, 5).map(function (q, i) { return (i + 1) + '️⃣ ' + q[0] + '\n' + q[1]; }).join('\n\n') + '\n\n💰 ' + c.occLine + '\n📍 ' + c.cta;
    }
    if (form === '对比图') {
      return c.hook + '👇\n\n💰 美容院\n有人帮你做，单次价格偏高，一般要提前预约。\n\n🏠 家用脱毛仪\n一次投入，适合能坚持在家自己做的人。\n\n🚪 自助脱毛店\n' + c.line1 + '。\n\n我的结论：怕麻烦、想先试试的，先去自助店。\n\n' + c.cta;
    }
    if (form === '清单合集') {
      lines = c.allLines.map(function (l, i) { return ['①', '②', '③', '④', '⑤'][i] + ' ' + l; });
      return c.hook + '，适合这几种人👇\n\n' + lines.join('\n') + '\n\n' + c.occLine + (c.occDead ? '，' + c.occDead : '') + '。\n\n' + c.cta;
    }
    if (form === '图文攻略') {
      return c.hook + '，第一次去的照着做👇\n\n1️⃣ 找店：{商场}{位置}\n2️⃣ 开机：打开 Ulike 小程序扫码，跟着语音提示做\n3️⃣ 准备：来之前把毛发刮干净\n4️⃣ 价格：' + c.occLine + '\n\n' + c.line1 + '。\n\n' + c.cta;
    }
    /* 探店笔记 */
    return c.hook + '👇\n\n🚪 店里长啥样\n' + c.line1 + '。\n\n📱 第一次怎么用\n下单新人体验 → 到店打开 Ulike 小程序扫码开机 → 跟着语音做。\n\n💰 ' + c.occLine + (c.occDead ? '，' + c.occDead : '') + '\n\n' + (acct === '门店号' ? '🍜 做完顺路：{周边}\n\n' : '') + c.cta;
  }

  function pyqTexts(form, c, acct) {
    var place = '{商场}';
    switch (form) {
      case '九宫格': return { v1: place + '{位置}的 Ulike自助脱毛吧，' + c.line1 + '。' + c.occShort + '，路过可以进来看看～', v2: c.hook + '。店在' + place + '，' + c.cta, pics: '九宫格：门头 / 店门口 / 隔间全景 / 设备上手 / 扫码开机 / 清洁消毒 / 门口立牌 / 导视 / 周边地标；评论区补本店小程序卡片' };
      case '转发视频号': return { v1: c.hook + '，' + place + '就有。' + c.occShort + '👇', v2: c.line1 + '，想试的点视频下面的链接看看。', v3: (c.occDead ? c.occDead + '，' : '') + '店在' + place + '{位置}。', pics: '转发官号当周视频号视频；评论区补本店小程序卡片' };
      case '群公告': return { v1: '【' + place + '·自助脱毛】' + c.occLine + '。位置：' + place + '{位置}。' + (c.occDead ? c.occDead + '。' : '') + '想试的私我拿本店优惠码～', v2: '有在' + place + '附近的姐妹吗？' + c.hook + '，' + c.occShort + '。', pics: '可附 1 张门头照或本店小程序卡片；先征得群主同意，每周不超过 2 次' };
      case '群聊天': return { v1: '（有人聊到脱毛时接一句）' + c.line1 + '，就在' + place + '。', v2: c.occShort + '，我这有本店优惠码，要的说一声。', pics: '等有人提到再接话，配 1 张门头照' };
      case '私聊话术': return { v1: acct === '老客' ? '闺蜜版：' + c.hook + '，我常去的，你第一次去还有礼物，陪我呗' : '熟人版：' + place + '有家自助脱毛，' + c.line1 + '。' + c.occShort + '，要的话我发你本店卡片。', v2: acct === '老客' ? '同事版：楼下' + place + '有家自助脱毛，午休就能去，我发你个邀请卡。' : '问价版：' + c.occLine + '，到店用小程序扫码就能用。', pics: acct === '老客' ? '发小程序邀请卡' : '发本店小程序卡片' };
      default: return { v1: c.hook + '。' + c.occShort + (c.occDead ? '，' + c.occDead : '') + '，' + cta('pyq', acct), v2: c.line1 + '，店在' + place + '{位置}。', pics: '配 1–3 张门店图，附本店小程序卡片' };
    }
  }

  /* 本地引擎主函数 */
  function generateLocal(input, seed) {
    seed = seed || 0;
    var P = window.TMB_PLATFORMS[input.p];
    var idea = String(input.idea || '').trim();
    var scene = DEFAULT_SCENE;
    for (var i = 0; i < SCENES.length; i++) if (SCENES[i].re.test(idea)) { scene = SCENES[i]; break; }
    var pts = (input.points && input.points.length ? input.points : THEME_POINTS[input.theme] || ['没人推销']).slice(0, 3);
    var occ = OCC[input.occasion] || OCC['常规'];
    var acct = input.acct || P.accts[0];
    var form = input.form || P.forms[0];
    var sub = function (s) { return String(s).replace(/\{scene\}/g, scene.name); };
    var p0 = POINTS[pts[0]], p1 = POINTS[pts[1] || pts[0]];
    var hook = sub(pick(p0.hooks, seed));
    if (input.theme === '科普答疑') hook = pick(['无人脱毛店的几个问题，一次说清', '第一次去自助脱毛前，先看这几条', '疼不疼、几次、怎么用，都在这'], seed);
    if (input.theme === '项目背书') hook = pick(['做家用脱毛仪的 Ulike，开了线下自助店', '店里用的就是 Ulike 的设备', 'Ulike 的自助脱毛店长这样'], seed);
    if (input.theme === '门店指引和点位') hook = pick(['15 秒找到{商场}这家自助脱毛店', '{商场}的自助脱毛店在{位置}', '按图走，不会找不到店'], seed);
    if (input.theme === '福利与拉新' && occ.activity !== '集赞') hook = pick(['带朋友去，两个人都有礼', '约闺蜜一起，一人一个隔间', '好友到店 1 位，你抽 1 次'], seed);
    if (occ.activity === '打卡' && input.theme === '真实反馈和打卡') hook = pick(['28 天光滑打卡，第 N 次', '打卡第 2 周，记录一下', '坚持打卡的第 14 天'], seed);
    var line1 = sub(pick(p0.lines, seed)), line2 = sub(pick(p1.lines, seed, 1));
    if (line2 === line1) line2 = '从进门、扫码到做完，全程自己来';
    var allLines = pts.map(function (k, j) { return sub(POINTS[k].lines[(seed + j) % POINTS[k].lines.length]); });
    var c = { hook: hook, line1: line1, line2: line2, allLines: allLines, occ: occ, occLine: occ.line, occShort: occ.short, occDead: occ.dead, cta: cta(input.p, acct, true), sceneName: scene.name };
    var styles = ['red', 'navy', 'cream', 'mint', 'blue'];
    var coverMain = input.theme === '活动介绍' || input.theme === '福利与拉新' ? occ.short.replace(' ', '\n') : sub(pick(p0.cover, seed));
    var item = {
      id: 'my' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      custom: true, p: input.p, acct: acct, type: input.theme, form: form,
      act: input.p === 'sph' ? (occ.activity === '集赞' ? 'C' : 'B') : input.p === 'pyq' ? (acct === '老客' ? 'C' : 'B') : (form === '晒单模板' || acct === '打卡用户' || acct === '星推官' ? 'C' : 'A'),
      period: occ.period, activity: occ.activity, when: occ.when, freq: '按需',
      title: clip(hook, 26),
      angle: idea ? '你的想法：' + clip(idea, 80) : '按“' + pts.join('、') + '”生成',
      cover: { main: coverMain, sub: clip(occ.short === coverMain.replace('\n', ' ') ? scene.name + '顺路就做' : occ.short, 16), style: styles[seed % styles.length] },
      brief: {
        who: input.who || scene.who,
        hook: hook,
        msg: allLines.join('；') + '；' + occ.line,
        must: input.p === 'douyin' || input.p === 'xhs' ? '带门店地点或 POI；正文不写“美团”；结尾引导搜店名' : input.p === 'sph' ? '挂小程序卡片 + 公众号文章' : '附本店小程序卡片或优惠码；像本人说话',
        shoot: /vlog|第一视角|探店/.test(form) ? '第一视角竖拍，只拍手和小臂；门头、隔间、扫码开机各 1 段' : /剧情/.test(form) ? '两位员工出镜演剧情；隔间只拍关门' : /字卡|对比/.test(form) ? '字卡为主，插入隔间空镜' : /路线|指引/.test(form) ? '按路线拍，每个转弯处 1 段，每段 3 秒' : '用门店图位里的照片',
        kpi: input.p === 'sph' ? '小程序访问、视频号转发' : input.p === 'pyq' ? '咨询数、本店渠道码核销' : '店名搜索、门店页访问'
      },
      f: {},
      slots: slotsFor(form, pts, input.theme),
      refs: (occ.refs || []).slice()
    };
    var dead = occ.dead ? '，' + occ.dead : '';
    if (input.p === 'douyin') {
      item.f.post = hook + '\n' + line1 + '。\n' + occ.line + dead + '。\n' + cta('douyin', acct);
      item.f.script = scriptFor(form, c);
      item.f.tags = '#自助脱毛 #脱毛 #Ulike脱毛吧 #{城市}探店 #' + scene.name.replace(/\s/g, '');
      if (acct === '门店号') item.f.pin = '📍{商场}{位置}｜营业时间 {营业时间}｜搜「Ulike脱毛吧 {商场}」';
      else { item.f.pinA = '某团搜「Ulike脱毛吧」，' + occ.short + dead + '👇'; item.f.pinB = PIN_B; }
      item.f.replies = replies(acct, seed, pts);
    } else if (input.p === 'xhs') {
      item.f.title = form === '晒单模板' ? '可选标题（三选一）：\n' + hook + '\n{商场}的自助脱毛店\n' + pick(['一个人的脱毛隔间', '打卡记录', '没人推销的脱毛店'], seed) : clip(hook, 20);
      item.f.body = xhsBody(form, c, input.theme, acct);
      item.f.tags = '#自助脱毛 #脱毛 #Ulike脱毛吧 #{城市}探店 #{区域}' + (occ.activity === '打卡' ? ' #28天光滑打卡' : '');
      if (acct === '门店号') item.f.pin = '📍{商场}{位置}｜营业时间 {营业时间}｜搜「Ulike脱毛吧 {商场}」';
      else if (acct === '官号') { item.f.pinA = '某团搜「Ulike脱毛吧」，' + occ.short + dead; item.f.pinB = PIN_B; }
      item.f.replies = form === '晒单模板' ? '晒单页提示：带门店地点和 #Ulike自助脱毛吧，发布后回到小程序晒单页提交。' : replies(acct, seed, pts);
    } else if (input.p === 'sph') {
      if (acct === '公众号' || form === '公众号文章') {
        item.acct = '公众号'; item.form = '公众号文章';
        item.f.title = clip(hook, 22) + '｜{城市}门店和新人优惠码';
        item.f.summary = line1 + '。' + occ.short + '，每家店的位置和优惠码都在文章里。';
        item.f.body = '【开头】' + hook + '。\n\n【为什么值得去】\n' + allLines.map(function (l) { return '· ' + l; }).join('\n') + '\n\n【活动】\n' + occ.line + dead + '。\n\n【{城市}门店】\n门店名｜位置｜新人优惠码\n{简称}｜{商场}{位置}｜【填本店优惠码】\n\n【怎么用】\n① 点下方小程序卡片，自动定位最近门店\n② 点“去美团买新人价”，用本店优惠码下单\n③ 到店用小程序“美团码核销”开机';
        item.f.mount = '文章内插入：小程序卡片「Ulike脱毛吧｜看离你最近的门店」';
      } else {
        item.f.post = hook + '\n' + line1 + '。' + occ.line + dead + '。\n' + cta('sph', acct);
        item.f.script = scriptFor(form, c);
        item.f.mount = '小程序卡片：Ulike脱毛吧｜看离你最近的门店';
        item.f.article = '公众号文章：《' + clip(occ.short, 14) + '｜{城市}门店和新人优惠码》';
        item.f.tags = '#自助脱毛 #Ulike脱毛吧 #{城市}';
        if (occ.activity === '集赞') item.f.forward = '给转发用户的朋友圈文案：\n① ' + hook + '，附近的姐妹可以去试试～\n② 逛街顺路做了个脱毛，没人推销，做完继续逛。\n③ 这家在{商场}，冬天开始做，夏天不着急。';
      }
    } else {
      var t = pyqTexts(form, c, acct);
      item.f.v1 = t.v1; item.f.v2 = t.v2; if (t.v3) item.f.v3 = t.v3; item.f.pics = t.pics;
      item.f.timing = form === '群公告' ? '工作日中午或晚饭后，每周不超过 2 次' : '周二、周四、周六晚 8 点前后';
      item.slots = form === '九宫格' ? item.slots : item.slots.slice(0, 3);
    }
    return item;
  }

  /* ---------- 快速生成：从积累的创意里找最接近的几条，按你的想法改写 ---------- */
  var POINT_KW = {
    '价格反差': /价格|便宜|划算|奶茶|省钱|性价比|一次不到|拆账|美容院|几百/g,
    '没人推销': /推销|尴尬|尬聊|社恐|无人|没人|一个人/g,
    '顺路就做': /顺路|午休|下班|逛街|路过|楼下|通勤|预约/g,
    '看得见的干净': /干净|卫生|消毒|清洁/g,
    '先试再买': /脱毛仪|买机|购机|吃灰|先试|试一次/g
  };
  function kwCount(k, t) { var m = String(t).match(POINT_KW[k]); return m ? m.length : 0; }
  function kwHit(k, t) { return kwCount(k, t) > 0; }
  var OCC_KW = [
    [/双\s?11|11\.11|双十一|购机|买机|保价/, '11.11 购机'],
    [/20 ?次|冬季卡|次卡/, '冬季 20 次卡'],
    [/打卡|28 ?天|毕业|周礼包|晒单/, '冬日打卡季 · 28 天打卡'],
    [/邀请|邀友|拉人|带朋友|好友到店|朋友第一次到店|面部券/, '邀好友到店'],
    [/集赞|点赞|转发抽奖/, '视频号集赞'],
    [/双\s?12|跨年|双人卡/, '双12 / 跨年 · 双人卡'],
    [/年货|过年|春节/, '年货节'],
    [/情人节|520|七夕/, '情人节'],
    [/女神节|妇女节|三八/, '女神节']
  ];
  /* 合规改写用 compliance.js 的同一份词表 */
  function fixText(s) { return window.TMB_RULES.fix(s); }
  function fixItem(it) {
    it.title = fixText(it.title);
    it.cover.main = fixText(it.cover.main); it.cover.sub = fixText(it.cover.sub);
    Object.keys(it.f).forEach(function (k) { var v = it.f[k]; it.f[k] = Array.isArray(v) ? v.map(function (r) { return r.map(fixText); }) : fixText(v); });
    (it.frames || []).forEach(function (f) { f.main = fixText(f.main); f.sub = fixText(f.sub); f.note = fixText(f.note); });
    return it;
  }
  function grams(s) { s = String(s || '').replace(/\{[^}]*\}|[\s，。、！？“”「」：；（）,.!?:;()#\-—|·]/g, ''); var g = {}; for (var i = 0; i < s.length - 1; i++) g[s.substr(i, 2)] = 1; return g; }
  function overlap(a, b) { var n = 0; for (var k in a) if (b[k]) n++; return n; }
  function docText(t) { return [t.title, t.angle, t.form, t.cover.main, t.cover.sub, t.brief.hook, t.brief.msg, t.f.post || t.f.body || t.f.v1 || ''].join(' '); }

  /* 按想法找参考：同主题优先，再看账号、形式、档期、卖点和文字相似度 */
  function rank(input, pool) {
    var ig = grams(input.idea), occ = OCC[input.occasion] || OCC['常规'];
    var same = pool.filter(function (t) { return t.p === input.p && t.type === input.theme; });
    if (same.length < 2) same = pool.filter(function (t) { return t.p === input.p; });
    return same.map(function (t) {
      var s = overlap(ig, grams(docText(t))) * 1.5;
      if (t.acct === input.acct) s += 4;
      if (t.form === input.form) s += 5;
      /* 档期要对得上：选了活动就优先同档期；没选就少用节日专属的模板 */
      if (input.occasion !== '常规') { if (t.period === occ.period || (occ.activity && t.activity === occ.activity)) s += 8; else if (t.period !== '常规') s -= 6; }
      else if (['年货节', '情人节', '女神节', '双12 / 跨年', '11.11 购机'].indexOf(t.period) >= 0) s -= 4;
      /* 没选活动时，不拿打卡 / 邀友 / 集赞这类活动专属模板当骨架，否则正文会讲一个没选的活动 */
      if (input.occasion === '常规' && t.activity) s -= 10;
      (input.points || []).forEach(function (k, j) { if (POINT_KW[k]) s += Math.min(3, kwCount(k, docText(t))) * (j ? 1 : 2); });
      if (t.edited) s += 1.5;
      /* 自己生成、还没改过的创意参考权重低一些；内容太短的不拿来做骨架 */
      if (t.custom && !t.edited) s -= 3;
      if ((t.f.script && t.f.script.length < 3) || String(t.f.post || t.f.body || t.f.v1 || '').length < 20) s -= 12;
      return { t: t, s: s };
    }).sort(function (a, b) { return b.s - a.s; });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function quoted(idea) { var m = String(idea || '').match(/[“"「『]([^”"」』]{2,24})[”"」』]/); return m ? m[1].trim() : ''; }

  function generateSmart(input, seed, pool) {
    seed = seed || 0;
    input = clone(input);
    var idea = String(input.idea || '').trim();
    /* 想法里提到的卖点和活动，没选也自动带上 */
    if (!input.points || !input.points.length) input.points = Object.keys(POINT_KW).filter(function (k) { return kwHit(k, idea); }).slice(0, 3);
    if (!input.occasion || input.occasion === '常规') for (var i = 0; i < OCC_KW.length; i++) if (OCC_KW[i][0].test(idea)) { input.occasion = OCC_KW[i][1]; break; }
    var ranked = rank(input, pool || []);
    var rule = generateLocal(input, seed);
    if (!ranked.length) return fixItem(rule);
    var top = ranked[seed % Math.min(3, ranked.length)].t;
    var refs = ranked.slice(0, 3).map(function (r) { return r.t; });
    var it = clone(top), occ = OCC[input.occasion] || OCC['常规'];
    var q = quoted(idea);
    var hook = q || (idea && idea.length <= 16 && !/[，,。；]/.test(idea) ? idea : '');
    var PBt = (window.TMB_PLAYBOOK || {})[input.p] && window.TMB_PLAYBOOK[input.p][input.theme];
    var pbTitle = '';
    if (!hook && PBt && PBt.gen && PBt.gen.hooks && PBt.gen.hooks.length) {
      /* 没有现成钩子：用本模块爆款公式里的开头和标题模板 */
      var sc0 = DEFAULT_SCENE; for (var s0 = 0; s0 < SCENES.length; s0++) if (SCENES[s0].re.test(idea)) { sc0 = SCENES[s0]; break; }
      hook = pick(PBt.gen.hooks, seed).replace(/\{scene\}/g, sc0.name);
      if (PBt.gen.titles && PBt.gen.titles.length) pbTitle = pick(PBt.gen.titles, seed).replace(/\{scene\}/g, sc0.name);
    }
    if (!hook) {
      /* 没有现成钩子：按参考模板讲的卖点来起标题，标题和正文说的是一件事 */
      var tTxt = JSON.stringify(top.f) + top.title + top.angle;
      var kp = input.points.filter(function (k) { return kwHit(k, tTxt); })[0] || Object.keys(POINT_KW).sort(function (x, y) { return kwCount(y, tTxt) - kwCount(x, tTxt); }).filter(function (k) { return kwHit(k, tTxt); })[0];
      var sc = DEFAULT_SCENE; for (var si = 0; si < SCENES.length; si++) if (SCENES[si].re.test(idea)) { sc = SCENES[si]; break; }
      hook = kp && ['活动介绍', '门店体验'].indexOf(input.theme) >= 0 ? pick(POINTS[kp].hooks, seed).replace(/\{scene\}/g, sc.name) : rule.title;
    }
    var occ0 = OCC[input.occasion] || OCC['常规'];
    var pointLine = input.occasion !== '常规' && input.points[0] === '价格反差' ? occ0.line : rule.brief.msg.split('；')[0];

    it.id = rule.id; it.custom = true; it.edited = false; delete it.ai; delete it.input; delete it.seed;
    it.acct = input.acct || it.acct; it.form = input.form || it.form; it.type = input.theme;
    it.act = rule.act; it.freq = '按需';
    if (input.occasion !== '常规') { it.period = occ.period; it.activity = occ.activity; it.when = occ.when; }
    it.title = clip(pbTitle || hook, 26);
    it.formula = (PBt && PBt.content && PBt.content.formula) || top.formula || '';
    it.angle = (idea ? '你的想法：' + clip(idea, 70) : '按“' + (input.points.join('、') || input.theme) + '”生成') + '。主要参考《' + top.title + '》的结构和说法。';
    it.basedOn = [top.id].concat(refs.filter(function (r) { return r.id !== top.id; }).map(function (r) { return r.id; })).slice(0, 3);
    it.cover.main = q && q.length <= 12 ? q.replace(/[，,]/, '\n') : (input.occasion !== '常规' || seed % 2 ? rule.cover.main : it.cover.main);
    it.cover.sub = input.occasion !== '常规' && it.period !== top.period ? rule.cover.sub : it.cover.sub;
    it.cover.style = ['red', 'navy', 'cream', 'mint', 'blue'][(['red', 'navy', 'cream', 'mint', 'blue'].indexOf(top.cover.style) + 1 + seed) % 5];
    it.brief.who = input.who || it.brief.who;
    it.brief.hook = hook;
    var needOcc = input.occasion !== '常规' && JSON.stringify(top.f).indexOf(occ.short.split(' ')[0]) < 0;
    var occTxt = occ.line + (occ.dead ? '，' + occ.dead : '');
    /* 模板已经讲到这个卖点，就不再重复插入 */
    var topTxt = JSON.stringify(top.f) + top.title;
    var needPoint = input.points.length && !(POINT_KW[input.points[0]] && kwHit(input.points[0], topTxt)) && topTxt.indexOf(pointLine.slice(0, 6)) < 0;
    if (needPoint) it.brief.msg = pointLine + '；' + it.brief.msg;
    var f = it.f, p = input.p;

    var formChanged = !!(f.script && top.form !== it.form);
    if (f.script) {
      if (formChanged) f.script = rule.f.script;
      else {
        f.script[0][2] = '字幕：' + hook;
        if (needPoint && f.script.length > 2) f.script[1][2] = '口播：' + pointLine;
        if (needOcc && f.script.length > 3) f.script[f.script.length - 2][2] = '字幕：' + occ.short;
      }
    }
    if (f.post) {
      var pl = f.post.split('\n'); pl[0] = hook;
      if (needPoint) pl.splice(1, 0, pointLine + '。');
      if (needOcc) pl.splice(pl.length - 1, 0, occTxt + '。');
      f.post = pl.join('\n');
    }
    if (p === 'xhs' && f.body) {
      if (!/^可选标题/.test(f.title || '')) f.title = clip(hook, 20);
      else f.title = '可选标题（三选一）：\n' + clip(hook, 20) + '\n' + f.title.split('\n').slice(1, 3).join('\n');
      var paras = f.body.split('\n\n');
      if (!/【/.test(paras[0])) paras[0] = hook + '👇';
      if (needPoint) paras.splice(1, 0, '💡 ' + pointLine + '。');
      if (needOcc) paras.splice(paras.length - 1, 0, '🎁 ' + occTxt + '。');
      f.body = paras.join('\n\n');
    }
    if (p === 'sph' && it.acct === '公众号' && f.body) {
      f.title = clip(hook, 22) + (f.title && f.title.indexOf('｜') > 0 ? '｜' + f.title.split('｜').slice(1).join('｜') : '');
      if (needOcc) f.body = f.body.replace(/(【[^】]*活动[^】]*】\n?)/, '$1' + occTxt + '。\n');
    }
    if (p === 'pyq') {
      var first = String(f.v1 || '').split(/[。！!]/)[0];
      f.v3 = f.v2 || f.v3; f.v2 = f.v1;
      f.v1 = hook + '。' + (needOcc || !f.v2 ? occ.short + (occ.dead ? '，' + occ.dead : '') + '，' : '') + (input.acct === '老客' ? '想去的私我～' : '想试的点卡片，或找我拿本店优惠码～');
      if (!first) f.v2 = rule.f.v2;
    }
    if (p === 'douyin' || p === 'xhs') {
      if (it.acct === '门店号') { delete f.pinA; delete f.pinB; f.pin = f.pin || rule.f.pin || '📍{商场}{位置}｜搜「Ulike脱毛吧 {商场}」'; }
      else if (it.acct === '官号') { delete f.pin; f.pinA = rule.f.pinA || f.pinA; f.pinB = f.pinB || PIN_B; }
    }
    var slots = (it.slots || []).concat(rule.slots || []);
    it.slots = slots.filter(function (x, j) { return slots.indexOf(x) === j; }).slice(0, it.p === 'pyq' && /九宫格/.test(it.form) ? 9 : 6);
    var rf = (it.refs || []).concat(occ.refs || []);
    it.refs = rf.filter(function (x, j) { return rf.indexOf(x) === j; }).slice(0, 5);
    /* 多张图：沿用参考模板的分页规划，封面换成新的封面文字 */
    if (formChanged) {
      /* 换了形式：分镜是新写的，画面也按新分镜重排，不沿用参考模板的画面 */
      it.frames = f.script.map(function (r, i) {
        var words = String(r[2]).replace(/^[^：]{1,4}：/, '').split(/[，。｜]/)[0];
        return { role: (i ? '关键帧' + (i + 1) : '封面帧') + ' · ' + r[0], main: i ? clip(words, 12) : it.cover.main, sub: i ? '' : it.cover.sub, note: r[2], layout: r[1], style: '', formula: '', slot: (it.slots || [])[i] || '', ref: '' };
      });
    } else if (Array.isArray(it.frames) && it.frames.length) {
      it.frames[0].main = it.cover.main; it.frames[0].sub = it.cover.sub;
    } else if (PBt && PBt.frames && PBt.frames.plan) {
      it.frames = PBt.frames.plan.map(function (r, i) { return { role: r[0], main: i ? r[1] : it.cover.main, sub: i ? '' : it.cover.sub, note: '', layout: r[2], style: '', formula: r[1], slot: (it.slots || [])[i] || '', ref: '' }; });
    }
    return fixItem(it);
  }

  /* Claude 生成（仅在 claude.ai 打开时可用） */
  var samplePromise = null;
  function getSample() {
    if (!samplePromise) {
      samplePromise = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('sample').catch(function () { return null; }) : Promise.resolve(null);
    }
    return samplePromise;
  }
  function fieldSpec(p, acct) {
    if (p === 'douyin') return '"f": {"post": "发布文案3-5行", "script": [["0–3s","画面","口播：…或字幕：…"], …4-6行], "tags": "#话题 …", ' + (acct === '门店号' ? '"pin": "置顶评论：店名+位置"' : '"pinA": "置顶评论A，可写“某团搜…”", "pinB": "置顶评论B：店名合集"') + ', "replies": "3组 Q：…\\nA：…"}';
    if (p === 'xhs') return '"f": {"title": "笔记标题≤20字", "body": "正文300-500字，短段落，适量emoji", "tags": "#话题 5-7个", ' + (acct === '门店号' ? '"pin": "置顶评论"' : '"pinA": "置顶评论A，可写“某团搜…”", "pinB": "置顶评论B：店名合集"') + ', "replies": "3组 Q/A"}';
    if (p === 'sph') return acct === '公众号' ? '"f": {"title": "文章标题", "summary": "摘要", "body": "正文结构，用【】标段落", "mount": "文章内插入的小程序卡片"}' : '"f": {"post": "视频描述，结尾引导点下方链接", "script": [["0–3s","画面","口播/字幕"], …], "mount": "小程序卡片：…", "article": "公众号文章：《…》", "tags": "#话题"}';
    return '"f": {"v1": "朋友圈文案1（1-3句，像本人说话）", "v2": "文案2", "v3": "文案3", "pics": "配图说明", "timing": "发布时间建议"}';
  }
  function generateAI(input, pool, onText) {
    return getSample().then(function (sample) {
      if (!sample) throw { code: 'unavailable' };
      var refs = rank(input, pool || []).slice(0, 3).map(function (r) { return r.t; });
      var P = window.TMB_PLATFORMS[input.p];
      var prompt = [
        '你是 Ulike脱毛吧 的内容策划。Ulike脱毛吧是 Ulike（家用脱毛仪品牌）开在商场、园区、学校附近的无人值守自助脱毛店：独立隔间，用 Ulike 小程序扫码开机，设备有语音指引，合作商运营；用户在美团买新人体验后到店核销。',
        '请为【' + P.name + ' · ' + input.acct + '】的主题【' + input.theme + '】写 1 条创意，形式：' + input.form + '。',
        '使用者的想法：' + (input.idea || '（未填写）'),
        '主打卖点：' + (input.points.join('、') || '自定'),
        '档期/活动：' + input.occasion + '（' + (OCC[input.occasion] || OCC['常规']).line + '）',
        '规则：1) 价格、店名、位置等用变量，原样写花括号：{新人价}{全身新人价}{八次卡}{八次单次}{冬季20次}{冬季20次腿}{双人卡}{购机立减}{打卡季截止}{购机截止}{店名}{简称}{城市}{区域}{商场}{位置}{营业时间}{周边}{门店数}。2) 禁用：永久、根治、治疗、疗效、医用、无痛、不痛、100%、绝对、顶级、首选、全网最低、保证效果，以及“最”（“最近”除外）、“第一”（“第一次”除外）。体感说具体部位和真实感受（如“手臂基本就是热一下，腋下会有点刺”），不要统一的标准答案。3) 抖音和小红书的正文、标题、话题、分镜里不能出现：美团、微信、私信、二维码、链接（只有置顶评论A可写“某团”）；结尾引导“搜 Ulike脱毛吧＋商圈名”。4) 不贬低其他品牌，不拍身体特写，用户体验类用【写你自己的真实感受】留空。5) 要有活人感：像店员或店主本人在说话，口语、短句、具体细节，敢说小缺点；不要客服腔和官话（不要“放心～”“多数人反馈”“亲”“哦～”这类套话），评论区回复也一样；不冒充顾客写好评。6) 钩子具体、有场景，让人想停下来看、想评论、想转给朋友。',
        '团队已经积累的同类创意（学它们的结构、语气和细节，但不要照抄标题和钩子）：\n' + refs.map(function (e, i) { return '【参考' + (i + 1) + '】' + e.title + '（' + e.acct + ' · ' + e.form + '）\n' + (i === 0 ? JSON.stringify(e.f).slice(0, 3200) : e.angle); }).join('\n\n'),
        '只输出一个 JSON 对象，格式：{"title": "创意标题≤26字", "angle": "一句话创意说明", "cover": {"main": "封面大字≤12字，可用\\n换行", "sub": "封面小字≤16字"}, "brief": {"who": "给谁看", "hook": "钩子", "msg": "要说清楚的点", "must": "必须带", "shoot": "怎么拍", "kpi": "看什么数"}, ' + fieldSpec(input.p, input.acct) + ', "slots": ["S1".."S10" 里选 2-6 个门店图位：S1门头 S2导视 S3路线 S4店门口 S5隔间 S6设备上手 S7扫码开机 S8清洁 S9立牌 S10周边地标]}'
      ].join('\n\n');
      return sample.json(prompt, { onText: onText, cache: false }).then(function (j) {
        var base = generateSmart(input, 0, pool);
        if (!j || typeof j !== 'object') throw { code: 'invalid_json' };
        base.title = clip(j.title || base.title, 26);
        base.angle = (input.idea ? '你的想法：' + clip(input.idea, 60) + '。' : '') + (j.angle || '');
        if (j.cover && j.cover.main) { base.cover.main = String(j.cover.main); base.cover.sub = clip(j.cover.sub || base.cover.sub, 16); }
        if (j.brief) Object.keys(base.brief).forEach(function (k) { if (j.brief[k]) base.brief[k] = String(j.brief[k]); });
        if (j.f && typeof j.f === 'object') {
          var nf = {};
          Object.keys(j.f).forEach(function (k) {
            var v = j.f[k];
            if (k === 'script') { if (Array.isArray(v)) nf.script = v.filter(Array.isArray).map(function (r) { return [String(r[0] || ''), String(r[1] || ''), String(r[2] || '')]; }); }
            else if (v != null) nf[k] = Array.isArray(v) ? v.join('\n') : String(v);
          });
          if (Object.keys(nf).length) base.f = nf;
        }
        if (Array.isArray(j.slots)) { var ok = j.slots.filter(function (s) { return window.TMB_SLOTS[s]; }); if (ok.length) base.slots = ok; }
        base.ai = true;
        base.basedOn = refs.map(function (r) { return r.id; });
        return fixItem(base);
      });
    });
  }

  function occOf(t) { for (var i = 0; i < OCC_KW.length; i++) if (OCC_KW[i][0].test(t)) return OCC_KW[i][1]; return '常规'; }
  /* 一句话属于哪个档期（看活动词和价格变量），用来避免把别的活动的钩子推给这条 */
  function periodOf(t) {
    t = String(t || '');
    if (/\{全身新人价\}/.test(t)) return '年货节';
    if (/\{冬季20次|\{打卡季截止\}/.test(t)) return '冬日打卡季';
    if (/\{双人卡\}/.test(t)) return '双12 / 跨年';
    if (/\{购机立减\}|\{购机截止\}/.test(t)) return '11.11 购机';
    return OCC[occOf(t)].period;
  }
  function sceneOf(t, strict) { for (var i = 0; i < SCENES.length; i++) if (SCENES[i].re.test(t)) return SCENES[i].name; return strict ? null : DEFAULT_SCENE.name; }

  window.TMB_GEN = { local: generateLocal, smart: generateSmart, ai: generateAI, sample: getSample, occasions: Object.keys(OCC), points: Object.keys(POINTS), occOf: occOf, sceneOf: sceneOf, fix: fixText, periodOf: periodOf };
})();
