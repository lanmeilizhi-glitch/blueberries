/* ============================================================
   蓝莓童话汇 · app.js
   启动流程 / 四屏路由 / 创建新书 / 本地导入 / 我的
   ============================================================ */
(function () {
  var BB = (window.BB = window.BB || {});
  var store = BB.store;

  var tab = "write";
  var ui = {};

  function esc(s) {
	return String(s == null ? "" : s)
	  .replace(/&/g, "&amp;")
	  .replace(/</g, "&lt;")
	  .replace(/>/g, "&gt;")
	  .replace(/"/g, "&quot;");
  }

  var TITLES = { write: "写作", shelf: "书架", replay: "写作回放", me: "我的" };

  /* ---------------- 公共片段 ---------------- */
  function bookCard(b) {
	var w = store.bookWords(b);
	var goal = b.goal > 0 ? Math.min(100, Math.round((w / b.goal) * 100)) : 0;
	var sprite = b.source === "import" ? "doc" : b.cover === "pink" ? "heart" : b.cover === "lemon" ? "orange" : "blueberry";
	var n = (b.sessions || []).length;
	var ro = store.isReadonly(b);
	return (
	  '<div class="book-card" data-act="open-book" data-id="' + b.id + '">' +
	  '<div class="cover ' + esc(b.cover) + '">' +
	  '<span class="px-box cover-mark" data-sprite="' + sprite + '"></span>' +
	  '<span class="cover-name">' + esc(b.title) + "</span></div>" +
	  '<div class="book-info"><div class="book-name">' + esc(b.title) + "</div>" +
	  '<div class="book-meta"><span>' + esc(b.genre || "童话") + "</span><span>" + b.chapters.length +
	  " 章</span><span>" + store.fmtNum(w) + " 字</span></div>" +
	  '<div class="book-meta"><span>' + (b.source === "import" ? "本地导入 · " : "") +
	  store.fmtTime(b.updatedAt) + "</span></div>" +
	  '<div class="book-foot"><div class="bar"><i style="width:' + goal + '%"></i></div>' +
	  '<span class="tag' + (ro ? " mint" : "") + '">' +
	  (ro ? "只读 READ" : n ? n + " 条记录" : "NEW") + "</span></div></div>" +
	  '<div class="book-act">' +
	  (ro
		? '<button class="btn sm primary" type="button" data-act="read-book" data-id="' + b.id + '">阅读</button>' +
		  '<button class="btn sm ghost" type="button" data-act="del-book" data-id="' + b.id + '">删除</button>'
		: '<button class="btn sm primary" type="button" data-act="open-book" data-id="' + b.id + '">写作</button>' +
		  '<button class="btn sm ghost" type="button" data-act="replay-book" data-id="' + b.id + '">回放</button>') +
	  "</div></div>"
	);
  }

  function emptyBox(sprite, text) {
	return (
	  '<div class="empty"><span class="px-box empty-ico" data-sprite="' + sprite + '"></span>' +
	  text + "</div>"
	);
  }

  /* ---------------- 写作屏：创建新书 ---------------- */
  function renderWrite() {
	var st = store.stats();
	var books = store.books();
	var last = store.book(store.data().activeBookId) || books[0];
	var pct = st.dailyGoal ? Math.min(100, Math.round((st.todayAdded / st.dailyGoal) * 100)) : 0;

	var html =
	  '<div class="hero"><div class="hero-deco">' +
	  '<span class="px-box d1" data-sprite="blueberry"></span>' +
	  '<span class="px-box d2" data-sprite="orange"></span>' +
	  '<span class="px-box d3" data-sprite="sparkle"></span></div>' +
	  '<div class="hero-kicker"><p class="cap">NEW STORY</p><span class="tag pink">像素童话工作台</span></div>' +
	  '<h2 class="hero-title">写一本新的蓝莓童话</h2>' +
	  '<p class="hero-text">「写作」就是创建新书。建好之后随时回来续写，每一次落笔都会被记下来，可以在「回放」里逐字看回去。</p>' +
	  '<div class="hero-actions">' +
	  '<button class="btn primary" type="button" data-act="new-book">+ 创建新书</button>' +
	  (last
		? '<button class="btn" type="button" data-act="open-book" data-id="' + last.id + '">继续写作</button>'
		: "") +
	  "</div></div>" +
	  '<div class="strip">' +
	  '<div class="strip-item"><div class="strip-num">' + st.todayAdded + '</div><div class="strip-label">今日字</div></div>' +
	  '<div class="strip-item"><div class="strip-num">' + store.fmtNum(st.words) + '</div><div class="strip-label">总字数</div></div>' +
	  '<div class="strip-item"><div class="strip-num">' + st.streak + '</div><div class="strip-label">连续天</div></div>' +
	  "</div>" +
	  '<div class="card"><div class="card-h"><div><p class="cap">DAILY GOAL</p>' +
	  '<div class="card-title">今日目标 ' + st.todayAdded + " / " + st.dailyGoal + " 字</div></div>" +
	  '<button class="btn sm ghost" type="button" data-act="set-goal">调整</button></div>' +
	  '<div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
	  '<div class="card"><div class="card-h"><div><p class="cap">MY WORKS</p>' +
	  '<div class="card-title">我的作品 · ' + books.length + "</div></div>" +
	  '<span class="chip">' + st.chapters + " 章</span></div>" +
	  (books.length
		? '<div class="books">' + books.map(bookCard).join("") + "</div>"
		: emptyBox("blueberry", "还没有作品<br>点上面的「创建新书」开始第一本，或去「书架」导入本地文档")) +
	  "</div>";

	ui.write.innerHTML = html;
	BB.sprites.hydrate(ui.write);
  }

  /* ---------------- 书架屏：仅本地导入 ---------------- */
  function renderShelf() {
	var books = store.books().filter(function (b) {
	  return b.source === "import";
	});
	var html =
	  '<div class="drop" data-act="import">' +
	  '<span class="px-box drop-ico" data-sprite="doc"></span>' +
	  '<div class="drop-title">导入本地文档</div>' +
	  '<p class="drop-text">支持 .txt / .md 纯文本，可多选<br>自动按「第 X 章」拆分，导入后只能阅读</p>' +
	  '<button class="btn pink sm" type="button" data-act="import">选择手机里的文档</button>' +
	  "</div>" +
	  '<div class="note"><span>✦</span><span>书架只用于导入本地文档，导入的书为只读小说，只能看不能编辑；想写新故事请去「写作」创建新书。</span></div>' +
	  '<div class="card"><div class="card-h"><div><p class="cap">LOCAL SHELF</p>' +
	  '<div class="card-title">已导入 · ' + books.length + "</div></div>" +
	  '<span class="chip mint">只读 · 本地来源</span></div>' +
	  (books.length
		? '<div class="books">' + books.map(bookCard).join("") + "</div>"
		: emptyBox("orange", "书架还是空的<br>挑一本手机里的 txt，把它搬进童话汇")) +
	  "</div>";

	ui.shelf.innerHTML = html;
	BB.sprites.hydrate(ui.shelf);
  }

  /* ---------------- 我的 ---------------- */
  function renderMe() {
	var st = store.stats();
	var upd = BB.update;
	var curV = upd ? upd.current() : "1.0.0";
	var pend = upd ? upd.pending() : false;
	var autoOn = store.settings().autoUpdate !== false;
	var html =
	  '<div class="me-head"><span class="px-box me-avatar" data-sprite="blueberry"></span>' +
	  '<div class="grow"><div class="me-name">蓝莓写手</div>' +
	  '<div class="me-sub">已坚持写作 ' + st.streak + " 天 · 累计敲下 " + store.fmtNum(st.totalTyped) + " 字</div></div>" +
	  '<span class="tag' + (pend ? " pink" : "") + '">v' + curV + "</span></div>" +
	  '<div class="me-grid">' +
	  cell(st.books, "作品") + cell(st.chapters, "章节") +
	  cell(store.fmtNum(st.words), "总字数") + cell(st.sessions, "回放记录") +
	  "</div>" +
	  '<div class="card"><div class="card-h"><div><p class="cap">TODAY</p>' +
	  '<div class="card-title">今日进度 ' + st.todayAdded + " / " + st.dailyGoal + "</div></div>" +
	  '<span class="chip pink">' + st.minutes + " 分钟</span></div>" +
	  '<div class="bar"><i style="width:' +
	  (st.dailyGoal ? Math.min(100, Math.round((st.todayAdded / st.dailyGoal) * 100)) : 0) +
	  '%"></i></div></div>' +
	  '<div class="card"><div class="card-h"><div><p class="cap">SOFTWARE UPDATE</p>' +
	  '<div class="card-title">软件更新</div></div>' +
	  (pend ? '<span class="chip pink">发现新版本</span>' : '<span class="chip">已是最新</span>') +
	  "</div><div class=\"menu\">" +
	  menu("sparkle", "检查更新", pend ? "更新到 v" + upd.latestVersion() : "v" + curV, "check-update") +
	  menu("blueberry", "自动接收更新", autoOn ? "已开启" : "已关闭", "toggle-auto") +
	  menu("doc", "更新日志", "查看历史版本", "upd-history") +
	  "</div></div>" +
	  '<div class="card"><div class="card-h"><div><p class="cap">SETTINGS</p>' +
	  '<div class="card-title">设置与数据</div></div></div><div class="menu">' +
	  menu("pencil", "今日目标字数", st.dailyGoal + " 字", "set-goal") +
	  menu("sparkle", "清除回放记录", "保留正文", "clear-replay") +
	  menu("orange", "立即锁屏", "密码 1006", "lock") +
	  menu("heart", "清空全部数据", "不可恢复", "clear-all") +
	  "</div></div>" +
	  '<div class="card"><div class="card-h"><div><p class="cap">ABOUT</p>' +
	  '<div class="card-title">蓝莓童话汇</div></div></div>' +
	  '<ul class="about-list">' +
	  li("写作即创建新书，支持多书多章、自动保存、字数与段落统计、沉浸模式、导出 TXT。") +
	  li("书架只导入本地 txt / md 文档，自动识别章节标题；导入的书只读，只能看不能改。") +
	  li("读导入的书可以用小说式设置：主题、字号、行距、字体、字距、亮度、自动阅读与进度记忆。") +
	  li("写作过程全程录制，可在「回放」里逐字重看，支持倍速与拖动。") +
	  li("数据保存在本机，开机密码 1006。") +
	  li("这边发布新版本后，软件启动会弹窗提醒，可一键更新或查看更新日志。") +
	  "</ul></div>";

	ui.me.innerHTML = html;
	BB.sprites.hydrate(ui.me);
  }

  function cell(num, label) {
	return (
	  '<div class="me-cell"><div class="me-num">' + num + '</div><div class="me-label">' +
	  label + "</div></div>"
	);
  }

  function menu(sprite, name, val, act) {
	return (
	  '<div class="menu-item" data-act="' + act + '"><span class="px-box menu-ico" data-sprite="' +
	  sprite + '"></span>' + name + '<span class="menu-val">' + esc(val) + "</span></div>"
	);
  }

  function li(text) {
	return "<li><i>◆</i><span>" + text + "</span></li>";
  }

  /* ---------------- 路由 ---------------- */
  function switchTab(name) {
	if (!TITLES[name]) name = "write";
	tab = name;
	store.setSettings({ lastTab: name });
	var screens = ["write", "shelf", "replay", "me"];
	for (var i = 0; i < screens.length; i++) {
	  ui[screens[i]].classList.toggle("hidden", screens[i] !== name);
	}
	var tabs = document.querySelectorAll(".tabbar .tab");
	for (var k = 0; k < tabs.length; k++) {
	  tabs[k].classList.toggle("on", tabs[k].getAttribute("data-tab") === name);
	}
	ui.title.textContent = TITLES[name];
	if (name === "write") renderWrite();
	else if (name === "shelf") renderShelf();
	else if (name === "me") renderMe();
	else if (name === "replay") BB.replay.mount(ui.replay);
	updateChip();
  }

  function updateChip() {
	var st = store.stats();
	ui.chip.textContent = "今日 " + st.todayAdded + " 字";
	updateDot();
  }

  /* 有新版本时，底部「我的」标签亮红点 */
  function updateDot() {
	var d = document.getElementById("dot-me");
	if (!d) return;
	var pend = BB.update ? BB.update.pending() : false;
	d.classList.toggle("hidden", !pend);
  }

  /* ---------------- 创建新书 ---------------- */
  function newBook() {
	var covers = ["blue", "pink", "mint", "lemon"];
	var sw = "";
	for (var i = 0; i < covers.length; i++) {
	  sw += '<div class="swatch ' + covers[i] + (i === 0 ? " on" : "") + '" data-c="' + covers[i] + '"></div>';
	}
	var picked = "blue";
	BB.modal.open({
	  kicker: "NEW BOOK",
	  title: "创建新书",
	  html:
		'<div class="field"><label>书名 *</label><input id="n-title" maxlength="24" placeholder="例如：蓝莓星球来信"></div>' +
		'<div class="field"><label>作者</label><input id="n-author" maxlength="16" placeholder="你的笔名"></div>' +
		'<div class="field"><label>类型</label><input id="n-genre" maxlength="10" value="童话"></div>' +
		'<div class="field"><label>一句话简介</label><textarea id="n-intro" maxlength="200" placeholder="写给谁、讲什么"></textarea></div>' +
		'<div class="field"><label>封面色系</label><div class="swatches">' + sw + "</div></div>",
	  actions: [
		{ text: "取消", kind: "ghost", fn: function (m) { m.close(); } },
		{
		  text: "创建并开写",
		  kind: "primary",
		  fn: function (m) {
			var t = m.body.querySelector("#n-title").value.trim();
			if (!t) {
			  BB.toast("先给新书起个名字", "err");
			  return;
			}
			var b = store.createBook({
			  title: t,
			  author: m.body.querySelector("#n-author").value.trim(),
			  genre: m.body.querySelector("#n-genre").value.trim() || "童话",
			  intro: m.body.querySelector("#n-intro").value.trim(),
			  cover: picked,
			  firstChapter: "第一章",
			  source: "create"
			});
			m.close();
			BB.toast("《" + b.title + "》已创建", "ok");
			BB.editor.open(b.id);
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

  /* ---------------- 本地导入 ---------------- */
  function pickFile() {
	if (!ui.file) {
	  BB.toast("当前环境不支持文件选择", "err");
	  return;
	}
	ui.file.value = "";
	ui.file.click();
  }

  function importFiles(files) {
	var list = Array.prototype.slice.call(files || []);
	if (!list.length) return;
	BB.toast("正在导入 " + list.length + " 个文档…");
	var i = 0;
	var ok = 0;
	var bad = 0;

	function next() {
	  if (i >= list.length) {
		renderShelf();
		updateChip();
		if (ok) BB.toast("已导入 " + ok + " 本作品", "ok");
		if (bad) BB.toast(bad + " 个文件无法读取（仅支持 txt/md 纯文本）", "err");
		return;
	  }
	  var f = list[i++];
	  if (!f || f.size > 3 * 1024 * 1024) {
		bad++;
		next();
		return;
	  }
	  var r = new FileReader();
	  r.onerror = function () {
		bad++;
		next();
	  };
	  r.onload = function () {
		var text = String(r.result || "");
		if (!text.replace(/\s/g, "") || text.indexOf("\u0000") >= 0) {
		  bad++;
		  next();
		  return;
		}
		var title = String(f.name || "导入作品").replace(/\.[^.]*$/, "").slice(0, 24) || "导入作品";
		store.importBook({ title: title, text: text, cover: "mint" });
		ok++;
		next();
	  };
	  r.readAsText(f, "utf-8");
	}
	next();
  }

  /* ---------------- 目标 ---------------- */
  function setGoal() {
	var cur = store.settings().dailyGoal;
	BB.modal.open({
	  kicker: "GOAL",
	  title: "今日目标字数",
	  html:
		'<div class="field"><label>每天写多少字</label>' +
		'<input id="g-in" type="text" inputmode="numeric" value="' + cur + '"></div>' +
		'<div class="row wrap">' +
		[200, 500, 1000, 2000].map(function (n) {
		  return '<button class="btn sm" type="button" data-g="' + n + '">' + n + " 字</button>";
		}).join("") +
		"</div>",
	  actions: [
		{ text: "取消", kind: "ghost", fn: function (m) { m.close(); } },
		{
		  text: "保存",
		  kind: "primary",
		  fn: function (m) {
			var n = parseInt(m.body.querySelector("#g-in").value.replace(/[^0-9]/g, ""), 10) || 0;
			if (n < 10 || n > 50000) {
			  BB.toast("请输入 10 - 50000 之间的数字", "err");
			  return;
			}
			store.setSettings({ dailyGoal: n });
			m.close();
			BB.toast("目标已更新", "ok");
			switchTab(tab);
		  }
		}
	  ],
	  onOpen: function (m) {
		m.body.addEventListener("click", function (e) {
		  var t = e.target.closest("[data-g]");
		  if (!t) return;
		  m.body.querySelector("#g-in").value = t.getAttribute("data-g");
		});
	  }
	});
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
	ui.app = document.getElementById("app");
	ui.write = document.getElementById("screen-write");
	ui.shelf = document.getElementById("screen-shelf");
	ui.replay = document.getElementById("screen-replay");
	ui.me = document.getElementById("screen-me");
	ui.title = document.getElementById("top-title");
	ui.chip = document.getElementById("top-words");
	ui.file = document.getElementById("import-input");

	document.querySelector(".tabbar").addEventListener("click", function (e) {
	  var t = e.target.closest("[data-tab]");
	  if (t) switchTab(t.getAttribute("data-tab"));
	});

	document.getElementById("btn-lock").addEventListener("click", function () {
	  if (BB.editor.isOpen()) BB.editor.close();
	  BB.lock.show();
	});

	if (ui.file) {
	  ui.file.addEventListener("change", function () {
		importFiles(ui.file.files);
	  });
	}

	document.body.addEventListener("click", function (e) {
	  var t = e.target.closest("[data-act]");
	  if (!t) return;
	  var act = t.getAttribute("data-act");
	  var id = t.getAttribute("data-id");
	  if (act === "new-book") newBook();
	  else if (act === "open-book") BB.editor.open(id);
	  else if (act === "replay-book") {
		switchTab("replay");
		BB.replay.openBook(id);
	  } else if (act === "import") pickFile();
	  else if (act === "set-goal") setGoal();
	  else if (act === "lock") {
		if (BB.editor.isOpen()) BB.editor.close();
		BB.lock.show();
	  } else if (act === "check-update") {
		if (BB.update) BB.update.check(true);
	  } else if (act === "upd-history") {
		if (BB.update) BB.update.showHistory();
	  } else if (act === "toggle-auto") {
		if (BB.update) BB.update.setAuto(store.settings().autoUpdate === false);
		switchTab(tab);
	  } else if (act === "clear-replay") {
		BB.modal.confirm({
		  title: "清除全部回放记录？",
		  html: "<p>作品正文会保留，只删除写作过程回放。</p>",
		  okText: "清除",
		  danger: true,
		  onOk: function () {
			store.clearSessions(null);
			BB.toast("回放记录已清除", "ok");
			switchTab(tab);
		  }
		});
	  } else if (act === "clear-all") {
		BB.modal.confirm({
		  title: "清空全部数据？",
		  html: "<p>所有作品、章节与写作过程都会被删除，且无法恢复。</p>",
		  okText: "全部清空",
		  danger: true,
		  onOk: function () {
			store.clearAll();
			BB.toast("已清空，重新开始", "ok");
			switchTab("write");
		  }
		});
	  }
	});

	BB.editor.onClose = function (bookId, go) {
	  if (go === "replay") {
		switchTab("replay");
		BB.replay.openBook(bookId);
	  } else {
		switchTab(tab);
	  }
	};

	BB.editor.onReplay = function (bookId) {
	  switchTab("replay");
	  BB.replay.openBook(bookId);
	};

	window.addEventListener("visibilitychange", function () {
	  if (document.hidden && BB.editor.isOpen()) BB.editor.flush();
	});
	window.addEventListener("pagehide", function () {
	  if (BB.editor.isOpen()) BB.editor.flush();
	  store.save();
	});
  }

  /* ---------------- 启动 ---------------- */
  function start() {
	ui.app.classList.remove("hidden");
	switchTab(store.settings().lastTab || "write");
	if (BB.update) {
	  BB.update.onUpdated = function () {
		switchTab(tab);
		updateDot();
	  };
	  window.setTimeout(function () {
		BB.update.onBoot();
		updateDot();
	  }, 700);
	}
  }

  function init() {
	BB.sprites.hydrate(document);
	BB.editor.init();
	bind();
	BB.lock.show();
	BB.boot.run(function () {
	  BB.lock.onUnlock = start;
	});
  }

  if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
  } else {
	init();
  }
})();