/* ===================================================================
   蓝莓童话汇 · update.js
   软件更新中心：发布清单 → 启动比对 → 更新弹窗 → 落版本
   「这边」发布新版本 = 在 RELEASES 数组最前面加一条记录，
   应用下次启动就会自动比对并弹窗，点「立即更新」后本机版本号同步。
   =================================================================== */
(function () {
  var BB = (window.BB = window.BB || {});
  var store = BB.store;

  /* ---------------- 发布清单（最新的放最前面） ---------------- */
  var RELEASES = [
    {
      v: "1.3.0",
      date: "07月01日",
      size: "138 KB",
      notes: [
        "更新中心全面接通：解锁后自动检查，发现新版本立即弹窗提醒",
        "「我的 · 软件更新」三个入口全部可用：检查更新 / 自动接收更新 / 更新日志",
        "底部「我的」新增新版本红点，更新完成后版本号与页面统计即时同步",
        "开机密码页新增「密码提示」小折叠：红线缠绕 我们相遇"
      ]
    },
    {
      v: "1.2.0",
      date: "06月18日",
      size: "132 KB",
      notes: [
        "新增软件更新中心：有新版本会弹窗提醒，可一键更新",
        "书架导入的书籍改为只读，只能看小说，不能编辑",
        "新增小说阅读器：主题 / 字号 / 行距 / 字体 / 亮度 / 自动阅读",
        "阅读进度自动记忆，可从章节目录一键跳转任意章节"
      ]
    },
    {
      v: "1.1.0",
      date: "06月09日",
      size: "126 KB",
      notes: ["书架只保留本地文档导入，写作即创建新书", "开机加入「蓝莓童话汇」动画与 4 位密码锁", "界面整体换成浅蓝浅粉的 ins 像素风"]
    },
    {
      v: "1.0.0",
      date: "06月01日",
      size: "118 KB",
      notes: ["首个版本：多书多章写作、自动保存、导出 TXT", "写作过程逐字录制，可倍速回放"]
    }
  ];

  /* ---------------- 版本工具 ---------------- */
  function num(v) {
    var p = String(v || "0").split(".");
    return [(parseInt(p[0], 10) || 0), (parseInt(p[1], 10) || 0), (parseInt(p[2], 10) || 0)];
  }

  function cmp(a, b) {
    var x = num(a);
    var y = num(b);
    for (var i = 0; i < 3; i++) {
      if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
    }
    return 0;
  }

  function installed() {
    return store.settings().appVersion || "1.0.0";
  }

  function latest() {
    return RELEASES[0];
  }

  function pending() {
    return cmp(latest().v, installed()) > 0;
  }

  function between(from, to) {
    var out = [];
    for (var i = 0; i < RELEASES.length; i++) {
      if (cmp(RELEASES[i].v, to) <= 0 && cmp(RELEASES[i].v, from) > 0) out.push(RELEASES[i]);
    }
    return out;
  }

  /* ---------------- 片段 ---------------- */
  function notesList(notes) {
    var s = '<ul class="upd-list">';
    for (var i = 0; i < notes.length; i++) {
      s += '<li><i>◆</i><span>' + notes[i] + "</span></li>";
    }
    return s + "</ul>";
  }

  function head(rel, badge) {
    return (
      '<div class="upd-top">' +
      '<span class="px-box upd-ico" data-sprite="blueberry"></span>' +
      '<div class="upd-word"><div class="upd-ver">v' + rel.v + "</div>" +
      '<div class="upd-sub">BLUEBERRY FAIRY TALES · ' + rel.date + "</div></div>" +
      '<span class="tag ' + (badge === "旧" ? "" : "pink") + '">' + (badge || "最新版本") + "</span>" +
      "</div>" +
      '<div class="upd-meta"><span class="chip">安装包 ' + rel.size + "</span>" +
      '<span class="chip pink">当前 v' + installed() + "</span></div>"
    );
  }

  /* ---------------- 执行更新（本地模拟下载安装） ---------------- */
  function install(rel, inst) {
    var wrap = inst.body.querySelector("#upd-run");
    var fill = inst.body.querySelector("#upd-fill");
    var pct = inst.body.querySelector("#upd-pct");
    var btns = inst.mask.querySelectorAll(".modal-f .btn");
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute("disabled", "disabled");
    if (wrap) wrap.classList.remove("hidden");

    var p = 0;
    var timer = window.setInterval(function () {
      p += 7 + Math.round(Math.random() * 11);
      if (p >= 100) p = 100;
      if (fill) fill.style.width = p + "%";
      if (pct) pct.textContent = p < 60 ? "正在下载更新包…" : p < 92 ? "正在校验并安装…" : "正在整理书架…";
      if (p >= 100) {
        window.clearInterval(timer);
        window.setTimeout(function () {
          store.setSettings({ appVersion: rel.v, seenVersion: rel.v });
          inst.close();
          BB.toast("已更新到 v" + rel.v + " ✦", "ok");
          if (BB.update.onUpdated) BB.update.onUpdated(rel.v);
        }, 380);
      }
    }, 210);
  }

  /* ---------------- 更新弹窗 ---------------- */
  function showUpdate() {
    var rel = latest();
    var list = between(installed(), rel.v);
    var body = list.length ? list : [rel];
    var notes = "";
    for (var i = 0; i < body.length; i++) {
      notes +=
        '<div class="upd-rel"><span class="upd-rel-v">v' + body[i].v + "</span>" +
        '<span class="upd-rel-d">' + body[i].date + "</span></div>" + notesList(body[i].notes);
    }

    BB.modal.open({
      kicker: "SOFTWARE UPDATE",
      title: "发现新版本 v" + rel.v,
      html:
        head(rel) +
        '<p class="upd-tip">这次更新会带来：</p>' +
        notes +
        '<div class="upd-run hidden" id="upd-run">' +
        '<div class="bar"><i id="upd-fill"></i></div>' +
        '<p class="upd-pct" id="upd-pct">正在准备…</p></div>' +
        '<p class="upd-note">更新只升级程序，作品正文与写作记录都会保留。</p>',
      actions: [
        {
          text: "稍后再说",
          kind: "ghost",
          fn: function (m) {
            store.setSettings({ seenVersion: rel.v });
            m.close();
          }
        },
        {
          text: "立即更新",
          kind: "primary",
          fn: function (m) {
            install(rel, m);
          }
        }
      ],
      onOpen: function (m) {
        BB.sprites.hydrate(m.body);
      }
    });
  }

  /* ---------------- 更新日志 ---------------- */
  function showHistory() {
    var s = "";
    for (var i = 0; i < RELEASES.length; i++) {
      var r = RELEASES[i];
      var now = r.v === installed();
      s +=
        '<div class="upd-rel"><span class="upd-rel-v">v' + r.v + "</span>" +
        '<span class="upd-rel-d">' + r.date + " · " + r.size +
        (now ? " · 当前版本" : "") + "</span></div>" + notesList(r.notes);
    }
    BB.modal.open({
      kicker: "CHANGELOG",
      title: "更新日志",
      html: s,
      actions: [{ text: "关闭", kind: "primary", fn: function (m) { m.close(); } }]
    });
  }

  /* ---------------- 检查更新 ---------------- */
  function check(manual) {
    if (pending()) {
      showUpdate();
      return true;
    }
    if (manual) {
      BB.modal.open({
        kicker: "UP TO DATE",
        title: "已经是最新版本",
        html:
          head(latest(), "已是最新") +
          '<p class="upd-tip">最近一次更新内容：</p>' + notesList(latest().notes) +
          '<p class="upd-note">当前版本 v' + installed() + "，数据全部保存在本机。</p>",
        actions: [
          { text: "看更新日志", kind: "ghost", fn: function (m) { m.close(); showHistory(); } },
          { text: "好了", kind: "primary", fn: function (m) { m.close(); } }
        ],
        onOpen: function (m) { BB.sprites.hydrate(m.body); }
      });
    }
    return false;
  }

  BB.update = {
    onUpdated: null,
    releases: RELEASES,
    current: installed,
    latestVersion: function () { return latest().v; },
    pending: pending,
    check: check,
    showUpdate: showUpdate,
    showHistory: showHistory,
    setAuto: function (on) {
      store.setSettings({ autoUpdate: !!on });
      BB.toast(on ? "已开启自动接收更新" : "已关闭自动接收更新", "ok");
    },
    /** 解锁后调用：每个新版本只自动弹窗一次 */
    onBoot: function () {
      var s = store.settings();
      if (!pending()) return false;
      if (s.autoUpdate === false) return false;
      if (s.seenVersion === latest().v) return false;
      showUpdate();
      return true;
    }
  };
})();