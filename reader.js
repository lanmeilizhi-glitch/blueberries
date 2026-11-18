/* ===================================================================
   蓝莓童话汇 · reader.js
   只读阅读器：本地导入的书籍只能看不能改
   小说软件常见设置：主题 / 字号 / 行距 / 字体 / 字距 / 亮度 /
   自动阅读 / 屏幕常亮 / 章节目录 / 进度跳转 / 进度记忆
   =================================================================== */
(function () {
  var BB = (window.BB = window.BB || {});
  var store = BB.store;

  var dom = {};
  var cur = { bookId: null, chId: null };
  var bound = false;
  var auto = { on: false, timer: 0 };
  var saveTimer = 0;
  var wake = null;

  var THEMES = [
    { k: "berry", n: "蓝粉" },
    { k: "paper", n: "护眼" },
    { k: "day", n: "纯白" },
    { k: "night", n: "夜间" }
  ];
  var LINES = [{ k: 1.7, n: "紧凑" }, { k: 2, n: "标准" }, { k: 2.3, n: "宽松" }, { k: 2.7, n: "超大" }];
  var FONTS = [
    { k: "sans", n: "黑体", css: '-apple-system, "PingFang SC", "Noto Sans CJK SC", sans-serif' },
    { k: "serif", n: "宋体", css: '"Songti SC", "Noto Serif CJK SC", "SimSun", serif' },
    { k: "mono", n: "等宽", css: '"Courier New", ui-monospace, monospace' }
  ];
  var SPACES = [{ k: 0, n: "标准" }, { k: 0.06, n: "宽松" }, { k: 0.12, n: "超大" }];
  var SPEEDS = [0.6, 1.1, 1.8, 2.8, 4];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function set() {
    return store.settings();
  }

  function themeClass() {
    var s = set();
    var ok = false;
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].k === s.rdTheme) ok = true;
    return ok ? s.rdTheme : "berry";
  }

  function fontCss() {
    var s = set();
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].k === s.rdFont) return FONTS[i].css;
    return FONTS[0].css;
  }

  /* ---------------- 样式应用 ---------------- */
  function applyStyle() {
    if (!dom.root) return;
    var s = set();
    dom.root.classList.remove("t-berry", "t-paper", "t-day", "t-night");
    dom.root.classList.add("t-" + themeClass());
    dom.body.style.fontSize = s.rdFontSize + "px";
    dom.body.style.lineHeight = String(s.rdLineHeight);
    dom.body.style.fontFamily = fontCss();
    dom.body.style.letterSpacing = (s.rdSpacing || 0) + "em";
    var b = Math.max(0.35, Math.min(1, s.rdBrightness == null ? 1 : s.rdBrightness));
    dom.dim.style.opacity = String(Math.round((1 - b) * 0.72 * 100) / 100);
  }

  /* ---------------- 章节渲染 ---------------- */
  function chapters() {
    var b = store.book(cur.bookId);
    return b && b.chapters ? b.chapters : [];
  }

  function index() {
    var list = chapters();
    for (var i = 0; i < list.length; i++) if (list[i].id === cur.chId) return i;
    return 0;
  }

  function render(top) {
    var b = store.book(cur.bookId);
    var list = chapters();
    if (!b || !list.length) return;
    var ch = store.chapter(cur.bookId, cur.chId) || list[0];
    cur.chId = ch.id;

    dom.bookTitle.textContent = b.title;
    dom.chTitle.textContent = "只读 · 第 " + (index() + 1) + " / " + list.length + " 章";

    var raw = String(ch.content || "").replace(/\r\n/g, "\n").split(/\n+/);
    var html = '<h3 class="rd-ch-h">' + esc(ch.title) + "</h3>";
    var n = 0;
    for (var i = 0; i < raw.length; i++) {
      var t = raw[i].trim();
      if (!t) continue;
      html += '<p class="rd-p">' + esc(t) + "</p>";
      n++;
    }
    if (!n) html += '<p class="rd-p rd-none">这一章还没有内容。</p>';
    dom.body.innerHTML = html;
    dom.scroll.scrollTop = top || 0;
    dom.pos.textContent = ch.title.length > 12 ? ch.title.slice(0, 12) + "…" : ch.title;
    syncRange();
  }

  function go(chId, top) {
    var ch = store.chapter(cur.bookId, chId);
    if (!ch) return;
    cur.chId = ch.id;
    render(top || 0);
    savePos();
  }

  function step(dir) {
    var list = chapters();
    var i = index() + dir;
    if (i < 0) {
      BB.toast("已经是第一章了");
      return;
    }
    if (i >= list.length) {
      BB.toast("已经读到最后啦", "ok");
      return;
    }
    stopAuto();
    go(list[i].id, 0);
  }

  /* ---------------- 进度 ---------------- */
  function frac() {
    var el = dom.scroll;
    var max = el.scrollHeight - el.clientHeight;
    if (max <= 4) return 1;
    return Math.max(0, Math.min(1, el.scrollTop / max));
  }

  function overall() {
    var list = chapters();
    if (!list.length) return 0;
    return (index() + frac()) / list.length;
  }

  function syncRange() {
    var p = overall();
    if (dom.range) dom.range.value = String(Math.round(p * 1000));
    if (dom.pct) dom.pct.textContent = Math.round(p * 100) + "%";
  }

  function jump(v) {
    var list = chapters();
    if (!list.length) return;
    var target = (v / 1000) * list.length;
    var i = Math.floor(target);
    if (i >= list.length) i = list.length - 1;
    var part = target - i;
    if (list[i].id !== cur.chId) {
      cur.chId = list[i].id;
      render(0);
    }
    var max = dom.scroll.scrollHeight - dom.scroll.clientHeight;
    dom.scroll.scrollTop = Math.round(max * part);
    syncRange();
  }

  function savePos() {
    var b = store.book(cur.bookId);
    if (!b) return;
    store.updateBook(b.id, { readPos: { ch: cur.chId, top: Math.round(dom.scroll.scrollTop) } });
  }

  /* ---------------- 自动阅读 ---------------- */
  function startAuto() {
    var s = set();
    var stepPx = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (s.rdAutoSpeed || 2) - 1))];
    auto.on = true;
    auto.timer = window.setInterval(function () {
      var el = dom.scroll;
      var max = el.scrollHeight - el.clientHeight;
      if (el.scrollTop >= max - 1) {
        stopAuto();
        BB.toast("本章读完，可点「下一章」");
        return;
      }
      el.scrollTop += stepPx;
      syncRange();
    }, 50);
    dom.auto.textContent = "■ 停止阅读";
    dom.root.classList.add("clean");
  }

  function stopAuto() {
    if (!auto.on) return;
    auto.on = false;
    window.clearInterval(auto.timer);
    if (dom.auto) dom.auto.textContent = "▶ 自动阅读";
    if (dom.root) dom.root.classList.remove("clean");
  }

  /* ---------------- 屏幕常亮 ---------------- */
  function keepOn(on) {
    try {
      if (on) {
        if (navigator.wakeLock && navigator.wakeLock.request) {
          navigator.wakeLock
            .request("screen")
            .then(function (lock) {
              wake = lock;
            })
            .catch(function () {
              BB.toast("系统未允许屏幕常亮", "err");
            });
        } else {
          BB.toast("当前系统不支持屏幕常亮", "err");
        }
      } else if (wake) {
        wake.release();
        wake = null;
      }
    } catch (e) {
      BB.toast("当前系统不支持屏幕常亮", "err");
    }
  }

  /* ---------------- 设置面板 ---------------- */
  function seg(items, activeKey, attr) {
    var s = "";
    for (var i = 0; i < items.length; i++) {
      s +=
        '<button class="rd-seg-btn' + (items[i].k === activeKey ? " on" : "") + '" type="button" ' +
        attr + '="' + items[i].k + '">' + items[i].n + "</button>";
    }
    return s;
  }

  function renderPanel() {
    var s = set();
    dom.panel.innerHTML =
      '<div class="rd-panel-h"><div><p class="cap">READER SETTING</p><div class="card-title">阅读设置</div></div>' +
      '<button class="icon-btn" type="button" data-rs="close" aria-label="关闭">×</button></div>' +
      '<div class="rd-row"><span class="rd-label">主题</span><div class="rd-seg">' +
      seg(THEMES, themeClass(), "data-rs-theme") + "</div></div>" +
      '<div class="rd-row"><span class="rd-label">字号</span><div class="rd-seg">' +
      '<button class="rd-seg-btn" type="button" data-rs="fs-">A−</button>' +
      '<span class="rd-val" id="rd-fs">' + s.rdFontSize + " px</span>" +
      '<button class="rd-seg-btn" type="button" data-rs="fs+">A+</button></div></div>' +
      '<div class="rd-row"><span class="rd-label">行距</span><div class="rd-seg">' +
      seg(LINES, s.rdLineHeight, "data-rs-line") + "</div></div>" +
      '<div class="rd-row"><span class="rd-label">字体</span><div class="rd-seg">' +
      seg(FONTS, s.rdFont, "data-rs-font") + "</div></div>" +
      '<div class="rd-row"><span class="rd-label">字距</span><div class="rd-seg">' +
      seg(SPACES, s.rdSpacing, "data-rs-space") + "</div></div>" +
      '<div class="rd-row"><span class="rd-label">亮度</span>' +
      '<input class="rd-range bright" id="rd-bright" type="range" min="35" max="100" value="' +
      Math.round((s.rdBrightness == null ? 1 : s.rdBrightness) * 100) + '" aria-label="亮度">' +
      '<span class="rd-val" id="rd-bv">' + Math.round((s.rdBrightness == null ? 1 : s.rdBrightness) * 100) + "%</span></div>" +
      '<div class="rd-row"><span class="rd-label">自动阅读</span><div class="rd-seg">' +
      seg([{ k: 1, n: "很慢" }, { k: 2, n: "慢" }, { k: 3, n: "中" }, { k: 4, n: "快" }, { k: 5, n: "很快" }],
        s.rdAutoSpeed, "data-rs-speed") + "</div></div>" +
      '<div class="rd-row"><span class="rd-label">屏幕常亮</span><div class="rd-seg">' +
      '<button class="rd-seg-btn" type="button" data-rs="keep">开 / 关</button>' +
      '<button class="rd-seg-btn wide" type="button" data-rs="reset">恢复默认</button></div></div>';
  }

  function panel(on) {
    if (!dom.panel) return;
    if (on) {
      renderPanel();
      dom.panel.classList.remove("hidden");
      dom.mask.classList.remove("hidden");
    } else {
      dom.panel.classList.add("hidden");
      dom.mask.classList.add("hidden");
    }
  }

  function panelClick(e) {
    var t = e.target.closest("[data-rs], [data-rs-theme], [data-rs-line], [data-rs-font], [data-rs-space], [data-rs-speed]");
    if (!t) return;
    var s = set();

    if (t.hasAttribute("data-rs-theme")) {
      store.setSettings({ rdTheme: t.getAttribute("data-rs-theme") });
    } else if (t.hasAttribute("data-rs-line")) {
      store.setSettings({ rdLineHeight: parseFloat(t.getAttribute("data-rs-line")) });
    } else if (t.hasAttribute("data-rs-font")) {
      store.setSettings({ rdFont: t.getAttribute("data-rs-font") });
    } else if (t.hasAttribute("data-rs-space")) {
      store.setSettings({ rdSpacing: parseFloat(t.getAttribute("data-rs-space")) });
    } else if (t.hasAttribute("data-rs-speed")) {
      var sp = parseInt(t.getAttribute("data-rs-speed"), 10);
      store.setSettings({ rdAutoSpeed: sp });
      if (auto.on) {
        stopAuto();
        startAuto();
      }
    } else {
      var op = t.getAttribute("data-rs");
      if (op === "close") {
        panel(false);
        return;
      }
      if (op === "fs-") store.setSettings({ rdFontSize: Math.max(13, s.rdFontSize - 1) });
      else if (op === "fs+") store.setSettings({ rdFontSize: Math.min(32, s.rdFontSize + 1) });
      else if (op === "keep") {
        keepOn(true);
        BB.toast("已申请屏幕常亮", "ok");
        return;
      } else if (op === "reset") {
        store.setSettings({
          rdTheme: "berry",
          rdFontSize: 18,
          rdLineHeight: 2,
          rdFont: "sans",
          rdSpacing: 0,
          rdBrightness: 1,
          rdAutoSpeed: 2
        });
        applyStyle();
        renderPanel();
        BB.toast("已恢复默认阅读设置", "ok");
        return;
      }
    }
    applyStyle();
    renderPanel();
  }

  /* ---------------- 章节目录 ---------------- */
  function openToc() {
    var b = store.book(cur.bookId);
    if (!b) return;
    var rows = "";
    for (var i = 0; i < b.chapters.length; i++) {
      var ch = b.chapters[i];
      rows +=
        '<div class="ch-item' + (ch.id === cur.chId ? " on" : "") + '" data-rc="' + ch.id + '">' +
        '<div class="ch-main"><div class="ch-name">' + esc(ch.title) + "</div>" +
        '<div class="ch-meta">' + store.fmtNum(store.words(ch.content)) + " 字</div></div>" +
        '<span class="badge">' + (i + 1) + "</span></div>";
    }
    BB.modal.open({
      kicker: "CHAPTERS",
      title: b.title + " · " + b.chapters.length + " 章",
      html: '<div class="drawer-list">' + rows + "</div>",
      actions: [{ text: "关闭", kind: "ghost", fn: function (m) { m.close(); } }],
      onOpen: function (m) {
        m.body.addEventListener("click", function (e) {
          var row = e.target.closest("[data-rc]");
          if (!row) return;
          m.close();
          stopAuto();
          go(row.getAttribute("data-rc"), 0);
        });
      }
    });
  }

  /* ---------------- 生命周期 ---------------- */
  function bind() {
    if (bound) return;
    dom.root = document.getElementById("reader");
    dom.scroll = document.getElementById("rd-scroll");
    dom.body = document.getElementById("rd-body");
    dom.bookTitle = document.getElementById("rd-book-title");
    dom.chTitle = document.getElementById("rd-ch-title");
    dom.back = document.getElementById("rd-back");
    dom.toc = document.getElementById("rd-toc");
    dom.setBtn = document.getElementById("rd-set");
    dom.prev = document.getElementById("rd-prev");
    dom.next = document.getElementById("rd-next");
    dom.range = document.getElementById("rd-range");
    dom.pos = document.getElementById("rd-pos");
    dom.pct = document.getElementById("rd-pct");
    dom.auto = document.getElementById("rd-auto");
    dom.panel = document.getElementById("rd-panel");
    dom.mask = document.getElementById("rd-mask");
    dom.dim = document.getElementById("rd-dim");
    dom.exit = document.getElementById("rd-exit");
    if (!dom.root) return;

    dom.back.addEventListener("click", function () { BB.reader.close(); });
    dom.toc.addEventListener("click", openToc);
    dom.setBtn.addEventListener("click", function () { panel(true); });
    dom.mask.addEventListener("click", function () { panel(false); });
    dom.prev.addEventListener("click", function () { step(-1); });
    dom.next.addEventListener("click", function () { step(1); });
    dom.range.addEventListener("input", function () {
      stopAuto();
      jump(parseInt(dom.range.value, 10) || 0);
    });
    dom.auto.addEventListener("click", function () {
      if (auto.on) stopAuto();
      else startAuto();
    });
    dom.exit.addEventListener("click", function () {
      dom.root.classList.remove("clean");
    });

    dom.panel.addEventListener("click", panelClick);
    dom.panel.addEventListener("input", function (e) {
      if (e.target && e.target.id === "rd-bright") {
        var v = (parseInt(e.target.value, 10) || 100) / 100;
        store.setSettings({ rdBrightness: v });
        applyStyle();
        var bv = document.getElementById("rd-bv");
        if (bv) bv.textContent = Math.round(v * 100) + "%";
      }
    });

    dom.scroll.addEventListener("scroll", function () {
      syncRange();
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(savePos, 600);
    });

    dom.scroll.addEventListener("click", function () {
      dom.root.classList.toggle("clean");
    });

    bound = true;
  }

  BB.reader = {
    onClose: null,

    open: function (bookId, chId) {
      bind();
      if (!dom.root) return;
      var b = store.book(bookId);
      if (!b) {
        BB.toast("作品不存在", "err");
        return;
      }
      cur.bookId = bookId;
      var list = b.chapters || [];
      var want = chId || (b.readPos && b.readPos.ch) || (list[0] && list[0].id);
      var ch = store.chapter(bookId, want) || list[0];
      if (!ch) {
        BB.toast("这本书没有可读内容", "err");
        return;
      }
      cur.chId = ch.id;
      applyStyle();
      dom.root.classList.remove("hidden");
      dom.root.classList.remove("clean");
      panel(false);
      render(chId ? 0 : (b.readPos && b.readPos.top) || 0);
      if (chId) BB.toast("已打开 " + ch.title);
    },

    close: function () {
      if (!dom.root) return;
      stopAuto();
      savePos();
      window.clearTimeout(saveTimer);
      keepOn(false);
      panel(false);
      dom.root.classList.add("hidden");
      var id = cur.bookId;
      cur.bookId = null;
      cur.chId = null;
      if (BB.reader.onClose) BB.reader.onClose(id);
    },

    isOpen: function () {
      return !!cur.bookId;
    },

    currentBook: function () {
      return cur.bookId;
    },

    flush: function () {
      if (!cur.bookId) return;
      stopAuto();
      savePos();
    }
  };
})();