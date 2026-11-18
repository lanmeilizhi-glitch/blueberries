/* ============================================================
   蓝莓童话汇 · editor.js
   写作编辑器：章节目录 / 自动保存 / 写作过程录制 / 导出
   ============================================================ */
(function () {
  var BB = (window.BB = window.BB || {});
  var store = BB.store;

  var dom = {};
  var cur = { bookId: null, chId: null, dirty: false, recTimer: 0, saveTimer: 0 };
  var bound = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setState(text, on) {
    if (!dom.state) return;
    dom.state.textContent = text;
    dom.state.classList.toggle("on", !!on);
  }

  function applyStyle() {
    var s = store.settings();
    dom.area.style.fontSize = s.fontSize + "px";
    dom.area.style.lineHeight = String(s.lineHeight);
  }

  function update() {
    var b = store.book(cur.bookId);
    if (!b) return;
    var ch = store.chapter(cur.bookId, cur.chId);
    var w = store.words(dom.area.value);
    dom.bookTitle.textContent = b.title;
    dom.chTitle.textContent = (ch ? ch.title : "") + " · 全书 " + store.fmtNum(store.bookWords(b)) + " 字";
    dom.count.textContent = store.fmtNum(w) + " 字 · " + store.paras(dom.area.value) + " 段";
    var goal = b.goal > 0 ? b.goal : store.settings().dailyGoal;
    var base = b.goal > 0 ? store.bookWords(b) : w;
    var pct = goal > 0 ? Math.min(100, Math.round((base / goal) * 100)) : 0;
    dom.bar.style.width = pct + "%";
  }

  function save(manual) {
    if (!cur.bookId) return;
    var text = dom.area.value;
    store.setContent(cur.bookId, cur.chId, text);
    store.recordFrame(text);
    cur.dirty = false;
    setState("已保存 ✓", true);
    update();
    if (manual) BB.toast("已保存，写作过程已记录", "ok");
  }

  function scheduleSave() {
    window.clearTimeout(cur.saveTimer);
    cur.saveTimer = window.setTimeout(function () {
      if (cur.dirty) save(false);
    }, 1500);
  }

  function tick() {
    if (!cur.bookId) return;
    var ch = store.chapter(cur.bookId, cur.chId);
    if (!ch) return;
    if (dom.area.value !== ch.content) {
      setState("记录中 ●", true);
      save(false);
    }
  }

  function startTimers() {
    window.clearInterval(cur.recTimer);
    cur.recTimer = window.setInterval(tick, 1200);
  }

  /* ---------------- 章节目录 ---------------- */
  function closeDrawer(node) {
    if (!node) return;
    if (node.mask && node.mask.parentNode) node.mask.parentNode.removeChild(node.mask);
    if (node.box && node.box.parentNode) node.box.parentNode.removeChild(node.box);
  }

  function openToc() {
    var b = store.book(cur.bookId);
    if (!b) return;
    var mask = document.createElement("div");
    mask.className = "ed-mask";
    var box = document.createElement("div");
    box.className = "ed-drawer";
    var node = { mask: mask, box: box };

    function render() {
      var book = store.book(cur.bookId);
      if (!book) return;
      var rows = "";
      for (var i = 0; i < book.chapters.length; i++) {
        var ch = book.chapters[i];
        var on = ch.id === cur.chId;
        rows +=
          '<div class="ch-item' + (on ? " on" : "") + '" data-ch="' + ch.id + '">' +
          '<div class="ch-main"><div class="ch-name">' + esc(ch.title) + "</div>" +
          '<div class="ch-meta">' + store.fmtNum(store.words(ch.content)) + " 字</div></div>" +
          '<div class="ch-act">' +
          '<button class="ch-dot" type="button" data-ca="up" data-id="' + ch.id + '" aria-label="上移">↑</button>' +
          '<button class="ch-dot" type="button" data-ca="down" data-id="' + ch.id + '" aria-label="下移">↓</button>' +
          '<button class="ch-dot" type="button" data-ca="name" data-id="' + ch.id + '" aria-label="改名">✎</button>' +
          (book.chapters.length > 1
            ? '<button class="ch-dot" type="button" data-ca="del" data-id="' + ch.id + '" aria-label="删除">×</button>'
            : "") +
          "</div></div>";
      }
      box.innerHTML =
        '<div class="card-h"><div><p class="cap">CHAPTERS</p>' +
        '<div class="card-title">' + esc(book.title) + " · " + book.chapters.length + " 章</div></div>" +
        '<span class="chip">' + store.fmtNum(store.bookWords(book)) + " 字</span></div>" +
        '<div class="drawer-list">' + rows + "</div>" +
        '<div class="row"><button class="btn grow" type="button" data-ta="add">+ 新建章节</button>' +
        '<button class="btn primary" type="button" data-ta="done">完成</button></div>';
      BB.sprites.hydrate(box);
    }

    box.addEventListener("click", function (e) {
      var act = e.target.closest("[data-ta]");
      if (act) {
        var kind = act.getAttribute("data-ta");
        if (kind === "add") {
          save(false);
          var ch = store.addChapter(cur.bookId);
          switchChapter(ch.id);
          render();
          BB.toast("已新建 " + ch.title, "ok");
        } else {
          closeDrawer(node);
        }
        return;
      }
      var ca = e.target.closest("[data-ca]");
      if (ca) {
        var op = ca.getAttribute("data-ca");
        var id = ca.getAttribute("data-id");
        if (op === "up" || op === "down") {
          save(false);
          store.moveChapter(cur.bookId, id, op === "up" ? -1 : 1);
          render();
        } else if (op === "name") {
          var old = store.chapter(cur.bookId, id);
          askText("章节改名", "章节标题", old ? old.title : "", function (v) {
            store.renameChapter(cur.bookId, id, v);
            render();
            update();
          });
        } else if (op === "del") {
          BB.modal.confirm({
            title: "删除这一章？",
            html: "<p>该章节正文会被移除，删除后无法恢复。</p>",
            okText: "删除",
            danger: true,
            onOk: function () {
              save(false);
              var isCur = id === cur.chId;
              store.deleteChapter(cur.bookId, id);
              if (isCur) {
                var b2 = store.book(cur.bookId);
                if (b2 && b2.chapters[0]) switchChapter(b2.chapters[0].id);
              }
              render();
              update();
            }
          });
        }
        return;
      }
      var row = e.target.closest("[data-ch]");
      if (row) {
        switchChapter(row.getAttribute("data-ch"));
        closeDrawer(node);
      }
    });

    render();
    document.body.appendChild(mask);
    document.body.appendChild(box);
    mask.addEventListener("click", function () { closeDrawer(node); });
  }

  function switchChapter(chId) {
    var ch = store.chapter(cur.bookId, chId);
    if (!ch) return;
    save(false);
    store.recordFrame(dom.area.value);
    store.endSession();
    cur.chId = ch.id;
    dom.area.value = ch.content || "";
    store.startSession(cur.bookId, ch.id, dom.area.value);
    startTimers();
    update();
    dom.area.scrollTop = 0;
    setState("记录中 ●", true);
  }

  /* ---------------- 小工具 ---------------- */
  function askText(title, label, value, onOk) {
    var m = BB.modal.open({
      kicker: "INPUT",
      title: title,
      html:
        '<div class="field"><label>' + esc(label) + "</label>" +
        '<input id="ask-in" type="text" maxlength="30" value="' + esc(value) + '"></div>',
      actions: [
        { text: "取消", kind: "ghost", fn: function (mm) { mm.close(); } },
        {
          text: "确定",
          kind: "primary",
          fn: function (mm) {
            var v = mm.body.querySelector("#ask-in").value.trim();
            if (!v) {
              BB.toast("内容不能为空", "err");
              return;
            }
            mm.close();
            onOk(v);
          }
        }
      ],
      onOpen: function (mm) {
        var i = mm.body.querySelector("#ask-in");
        window.setTimeout(function () { i.focus(); }, 60);
      }
    });
    return m;
  }

  function fullText(b) {
    var out = b.title + "\n";
    if (b.author) out += "作者：" + b.author + "\n";
    if (b.intro) out += "简介：" + b.intro + "\n";
    out += "\n";
    for (var i = 0; i < b.chapters.length; i++) {
      out += b.chapters[i].title + "\n\n" + (b.chapters[i].content || "") + "\n\n";
    }
    return out;
  }

  function copyText(text) {
    var ok = false;
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-999px";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      ok = document.execCommand ? document.execCommand("copy") : false;
      document.body.removeChild(ta);
    } catch (e) {
      ok = false;
    }
    BB.toast(ok ? "全文已复制到剪贴板" : "复制失败，请改用导出", ok ? "ok" : "err");
  }

  function exportTxt(b) {
    try {
      var blob = new Blob([fullText(b)], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = (b.title || "作品") + ".txt";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      window.setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
      BB.toast("已导出 " + a.download, "ok");
    } catch (e) {
      copyText(fullText(b));
    }
  }

  /* ---------------- 工具面板 ---------------- */
  function openTools() {
    var b = store.book(cur.bookId);
    if (!b) return;
    var goalTxt = b.goal > 0 ? store.fmtNum(b.goal) + " 字" : "未设置";
    var m = BB.modal.open({
      kicker: "TOOLS",
      title: "写作工具",
      html:
        '<div class="menu">' +
        item("pencil", "书籍信息", b.title + " / " + (b.author || "未署名"), "meta") +
        item("doc", "本书目标", goalTxt, "goal") +
        item("sparkle", "导出 TXT", "保存到本地", "export") +
        item("orange", "复制全文", store.fmtNum(store.bookWords(b)) + " 字", "copy") +
        item("play", "看写作回放", "跳到回放屏", "replay") +
        item("heart", "字号与行距", b.chapters.length + " 章", "style") +
        "</div>",
      actions: [
        {
          text: "删除本书",
          kind: "danger",
          fn: function (mm) {
            mm.close();
            BB.modal.confirm({
              title: "删除《" + b.title + "》？",
              html: "<p>正文与写作过程记录都会一起删除，无法恢复。</p>",
              okText: "确认删除",
              danger: true,
              onOk: function () {
                BB.editor.close();
                store.deleteBook(b.id);
                BB.toast("已删除", "ok");
                if (BB.editor.onClose) BB.editor.onClose(b.id);
              }
            });
          }
        },
        { text: "关闭", kind: "ghost", fn: function (mm) { mm.close(); } }
      ],
      onOpen: function (mm) {
        mm.body.addEventListener("click", function (e) {
          var t = e.target.closest("[data-t]");
          if (!t) return;
          var kind = t.getAttribute("data-t");
          mm.close();
          tool(kind);
        });
      }
    });
    return m;
  }

  function item(sprite, name, val, kind) {
    return (
      '<div class="menu-item" data-t="' + kind + '">' +
      '<span class="px-box menu-ico" data-sprite="' + sprite + '"></span>' + name +
      '<span class="menu-val">' + esc(val) + "</span></div>"
    );
  }

  function tool(kind) {
    var b = store.book(cur.bookId);
    if (!b) return;
    if (kind === "export") exportTxt(b);
    else if (kind === "copy") copyText(fullText(b));
    else if (kind === "replay") {
      BB.editor.close();
      if (BB.editor.onReplay) BB.editor.onReplay(b.id);
    } else if (kind === "style") {
      BB.modal.open({
        kicker: "STYLE",
        title: "字号与行距",
        html:
          '<div class="row" style="gap:8px">' +
          '<button class="btn grow" type="button" data-s="minus">A−</button>' +
          '<span class="chip grow" style="text-align:center" id="st-size">' +
          store.settings().fontSize + " px</span>" +
          '<button class="btn grow" type="button" data-s="plus">A+</button></div>' +
          '<div class="row" style="gap:8px;margin-top:10px">' +
          '<button class="btn grow" type="button" data-s="lh">行距 ' +
          store.settings().lineHeight + "</button></div>",
        actions: [{ text: "好了", kind: "primary", fn: function (mm) { mm.close(); } }],
        onOpen: function (mm) {
          mm.body.addEventListener("click", function (e) {
            var t = e.target.closest("[data-s]");
            if (!t) return;
            var s = store.settings();
            var op = t.getAttribute("data-s");
            if (op === "minus") s.fontSize = Math.max(14, s.fontSize - 1);
            if (op === "plus") s.fontSize = Math.min(26, s.fontSize + 1);
            if (op === "lh") {
              var l = [1.7, 1.95, 2.2, 2.5];
              var i = l.indexOf(s.lineHeight);
              s.lineHeight = l[(i + 1) % l.length];
            }
            store.setSettings({ fontSize: s.fontSize, lineHeight: s.lineHeight });
            applyStyle();
            mm.close();
            tool("style");
          });
        }
      });
    } else if (kind === "goal") {
      askText("本书目标", "目标字数（0 为不设置）", b.goal ? String(b.goal) : "0", function (v) {
        var n = parseInt(v.replace(/[^0-9]/g, ""), 10) || 0;
        store.updateBook(b.id, { goal: n });
        update();
        BB.toast(n ? "目标已设为 " + n + " 字" : "已取消目标", "ok");
      });
    } else if (kind === "meta") {
      editMeta(b);
    }
  }

  function editMeta(b) {
    var covers = ["blue", "pink", "mint", "lemon"];
    var sw = "";
    for (var i = 0; i < covers.length; i++) {
      sw += '<div class="swatch ' + covers[i] + (b.cover === covers[i] ? " on" : "") +
        '" data-c="' + covers[i] + '"></div>';
    }
    var picked = b.cover;
    BB.modal.open({
      kicker: "BOOK INFO",
      title: "书籍信息",
      html:
        '<div class="field"><label>书名</label><input id="m-title" maxlength="24" value="' + esc(b.title) + '"></div>' +
        '<div class="field"><label>作者</label><input id="m-author" maxlength="16" value="' + esc(b.author || "") + '"></div>' +
        '<div class="field"><label>类型</label><input id="m-genre" maxlength="10" value="' + esc(b.genre || "") + '"></div>' +
        '<div class="field"><label>简介</label><textarea id="m-intro" maxlength="200">' + esc(b.intro || "") + "</textarea></div>" +
        '<div class="field"><label>封面色系</label><div class="swatches">' + sw + "</div></div>",
      actions: [
        { text: "取消", kind: "ghost", fn: function (m) { m.close(); } },
        {
          text: "保存",
          kind: "primary",
          fn: function (m) {
            var t = m.body.querySelector("#m-title").value.trim();
            if (!t) {
              BB.toast("书名不能为空", "err");
              return;
            }
            store.updateBook(b.id, {
              title: t,
              author: m.body.querySelector("#m-author").value.trim(),
              genre: m.body.querySelector("#m-genre").value.trim() || "童话",
              intro: m.body.querySelector("#m-intro").value.trim(),
              cover: picked
            });
            m.close();
            update();
            BB.toast("信息已更新", "ok");
          }
        }
      ],
      onOpen: function (m) {
        m.body.addEventListener("click", function (e) {
          var s = e.target.closest("[data-c]");
          if (!s) return;
          picked = s.getAttribute("data-c");
          var all = m.body.querySelectorAll(".swatch");
          for (var i = 0; i < all.length; i++) {
            all[i].classList.toggle("on", all[i].getAttribute("data-c") === picked);
          }
        });
      }
    });
  }

  /* ---------------- 生命周期 ---------------- */
  BB.editor = {
    onClose: null,

    init: function () {
      if (bound) return;
      dom.root = document.getElementById("editor");
      dom.area = document.getElementById("ed-area");
      dom.back = document.getElementById("ed-back");
      dom.toc = document.getElementById("ed-chapters");
      dom.tools = document.getElementById("ed-tools");
      dom.bookTitle = document.getElementById("ed-book-title");
      dom.chTitle = document.getElementById("ed-ch-title");
      dom.bar = document.getElementById("ed-bar");
      dom.count = document.getElementById("ed-count");
      dom.state = document.getElementById("ed-state");
      dom.exit = document.getElementById("ed-exit");
      if (!dom.root) return;

      dom.area.addEventListener("input", function () {
        cur.dirty = true;
        setState("输入中…", false);
        update();
        scheduleSave();
      });

      dom.back.addEventListener("click", function () { BB.editor.close(); });
      dom.toc.addEventListener("click", function () { save(false); openToc(); });
      dom.tools.addEventListener("click", function () { save(false); openTools(); });
      dom.exit.addEventListener("click", function () {
        dom.root.classList.remove("immersive");
      });

      dom.root.addEventListener("click", function (e) {
        var t = e.target.closest("[data-ed]");
        if (!t) return;
        var op = t.getAttribute("data-ed");
        if (op === "save") save(true);
        else if (op === "toc") { save(false); openToc(); }
        else if (op === "more") { save(false); openTools(); }
        else if (op === "focus") dom.root.classList.toggle("immersive");
        else if (op === "minus" || op === "plus") {
          var s = store.settings();
          s.fontSize = Math.max(14, Math.min(26, s.fontSize + (op === "plus" ? 1 : -1)));
          store.setSettings({ fontSize: s.fontSize });
          applyStyle();
          BB.toast("字号 " + s.fontSize + "px");
        }
      });

      bound = true;
    },

    open: function (bookId, chId) {
      BB.editor.init();
      var b = store.book(bookId);
      if (!b) {
        BB.toast("作品不存在", "err");
        return;
      }
      /* 本地导入的书籍只读：转到阅读器，不进编辑器 */
      if (store.isReadonly(b)) {
        if (BB.reader) {
          BB.reader.open(bookId, chId);
          BB.toast("《" + b.title + "》是导入的书，只能阅读", "ok");
        } else {
          BB.toast("本地导入的书只能阅读", "err");
        }
        return;
      }
      var ch = chId ? store.chapter(bookId, chId) : b.chapters[0];
      if (!ch) {
        BB.toast("章节不存在", "err");
        return;
      }
      cur.bookId = bookId;
      cur.chId = ch.id;
      cur.dirty = false;
      var d = store.data();
      d.activeBookId = bookId;
      d.activeChapterId = ch.id;
      dom.area.value = ch.content || "";
      applyStyle();
      dom.root.classList.remove("hidden");
      dom.root.classList.remove("immersive");
      store.startSession(bookId, ch.id, dom.area.value);
      startTimers();
      update();
      setState("记录中 ●", true);
      dom.area.scrollTop = 0;
    },

    saveNow: function () {
      if (cur.bookId) save(false);
    },

    close: function () {
      if (!cur.bookId) {
        dom.root.classList.add("hidden");
        return;
      }
      save(false);
      store.recordFrame(dom.area.value);
      store.endSession();
      window.clearInterval(cur.recTimer);
      window.clearTimeout(cur.saveTimer);
      var id = cur.bookId;
      cur.bookId = null;
      cur.chId = null;
      dom.root.classList.add("hidden");
      if (BB.editor.onClose) BB.editor.onClose(id);
    },

    isOpen: function () {
      return !!cur.bookId;
    },

    currentBook: function () {
      return cur.bookId;
    },

    flush: function () {
      if (!cur.bookId) return;
      save(false);
      store.recordFrame(dom.area.value);
      store.endSession();
      window.clearInterval(cur.recTimer);
    }
  };
})();