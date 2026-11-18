/* ============================================================
   蓝莓童话汇 · store.js
   localStorage 数据层：作品 / 章节 / 字数统计 / 写作过程记录
   写作过程以「前缀 + 删除 + 插入」增量帧保存，便于逐字回放
   ============================================================ */
(function () {
  var BB = (window.BB = window.BB || {});
  var KEY = "bbth_studio_v1";
  var MAX_FRAMES = 700;
  var MAX_SESSIONS = 40;
  var MAX_LOG = 180;

  var data = null;
  var rec = null;

  function uid(p) {
    return (p || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function dayKey(ts) {
    var d = new Date(ts);
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
  }

  function blank() {
    return {
      version: 1,
      settings: {
        dailyGoal: 500,
        fontSize: 17,
        lineHeight: 1.95,
        lastTab: "write",
        /* 软件版本：本机已安装版本 + 是否自动接收更新 */
        appVersion: "1.0.0",
        seenVersion: "",
        autoUpdate: true,
        /* 阅读器偏好（看小说的设置） */
        rdTheme: "berry",
        rdFontSize: 18,
        rdLineHeight: 2,
        rdFont: "sans",
        rdSpacing: 0,
        rdBrightness: 1,
        rdAutoSpeed: 2
      },
      books: [],
      activeBookId: null,
      activeChapterId: null,
      log: []
    };
  }

  function load() {
    if (data) return data;
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) {
      data = null;
    }
    if (!data || !data.books || !data.books.length === 0) {
      if (!data || !data.books) data = blank();
    }
    var base = blank();
    data.settings = Object.assign(base.settings, data.settings || {});
    if (!data.log) data.log = [];
    return data;
  }

  /** 容量不足时逐步丢弃最老的回放记录，保证正文优先保存 */
  function dropOldestSession(d) {
    for (var i = d.books.length - 1; i >= 0; i--) {
      var s = d.books[i].sessions;
      if (s && s.length > 0) {
        s.shift();
        return true;
      }
    }
    if (d.log && d.log.length > 1) {
      d.log.shift();
      return true;
    }
    return false;
  }

  function save() {
    var d = load();
    for (var i = 0; i < 4; i++) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(d));
        return true;
      } catch (e) {
        if (!dropOldestSession(d)) break;
      }
    }
    return false;
  }

  /* ---------------- 基础工具 ---------------- */
  function words(text) {
    if (!text) return 0;
    return String(text).replace(/\s+/g, "").length;
  }

  function paras(text) {
    if (!text) return 0;
    var arr = String(text).split(/\n+/);
    var n = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i].trim()) n++;
    return n;
  }

  function fmtNum(n) {
    n = n || 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + "w";
    return String(n);
  }

  function fmtDur(ms) {
    ms = Math.max(0, ms || 0);
    var s = Math.round(ms / 1000);
    var m = Math.floor(s / 60);
    var h = Math.floor(m / 60);
    s = s % 60;
    if (h) return h + "h" + (m % 60) + "m";
    if (m) return m + "m" + (s < 10 ? "0" + s : s) + "s";
    return s + "s";
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    var p = function (v) { return v < 10 ? "0" + v : "" + v; };
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* ---------------- 书籍 ---------------- */
  function bookWords(book) {
    var n = 0;
    if (!book || !book.chapters) return 0;
    for (var i = 0; i < book.chapters.length; i++) n += words(book.chapters[i].content);
    return n;
  }

  function createBook(o) {
    var d = load();
    var now = Date.now();
    var book = {
      id: uid("bk"),
      title: (o.title || "未命名作品").slice(0, 24),
      author: (o.author || "").slice(0, 16),
      genre: o.genre || "童话",
      intro: (o.intro || "").slice(0, 200),
      cover: o.cover || "blue",
      source: o.source || "create",
      goal: o.goal || 0,
      createdAt: now,
      updatedAt: now,
      chapters: [
        { id: uid("ch"), title: o.firstChapter || "第一章", content: o.content || "", updatedAt: now }
      ],
      sessions: []
    };
    d.books.unshift(book);
    d.activeBookId = book.id;
    d.activeChapterId = book.chapters[0].id;
    save();
    return book;
  }

  /** 按「第X章 / 回 / 节 / 篇 / 卷」拆分导入文本 */
  function splitChapters(text) {
    var src = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var re = /^[ \t]*(第[ \t]*[0-9零一二三四五六七八九十百千两]+[ \t]*[章回节篇卷][^\n]*)$/gm;
    var marks = [];
    var m;
    while ((m = re.exec(src)) !== null) {
      marks.push({ at: m.index, len: m[0].length, title: m[1].trim() });
      if (marks.length > 400) break;
    }
    var now = Date.now();
    var out = [];
    if (!marks.length) {
      var body = src.trim();
      return [{ id: uid("ch"), title: "正文", content: body, updatedAt: now }];
    }
    if (marks[0].at > 0) {
      var head = src.slice(0, marks[0].at).trim();
      if (head) out.push({ id: uid("ch"), title: "楔子", content: head, updatedAt: now });
    }
    for (var i = 0; i < marks.length; i++) {
      var start = marks[i].at + marks[i].len;
      var end = i + 1 < marks.length ? marks[i + 1].at : src.length;
      out.push({
        id: uid("ch"),
        title: marks[i].title.slice(0, 30),
        content: src.slice(start, end).trim(),
        updatedAt: now
      });
    }
    return out;
  }

  function importBook(o) {
    var book = createBook({
      title: o.title,
      author: o.author || "",
      genre: "本地导入",
      intro: "从本地文档导入",
      cover: o.cover || "mint",
      source: "import"
    });
    book.chapters = splitChapters(o.text || "");
    if (!book.chapters.length) {
      book.chapters = [{ id: uid("ch"), title: "正文", content: "", updatedAt: Date.now() }];
    }
    book.readonly = true;
    book.updatedAt = Date.now();
    save();
    return book;
  }

  function book(id) {
    var d = load();
    for (var i = 0; i < d.books.length; i++) if (d.books[i].id === id) return d.books[i];
    return null;
  }

  /** 本地导入的书籍只读：只能看，不能编辑 */
  function isReadonly(b) {
    if (!b) return false;
    return b.readonly === true || b.source === "import";
  }

  function deleteBook(id) {
    var d = load();
    for (var i = 0; i < d.books.length; i++) {
      if (d.books[i].id === id) {
        d.books.splice(i, 1);
        if (d.activeBookId === id) d.activeBookId = null;
        save();
        return true;
      }
    }
    return false;
  }

  function updateBook(id, patch) {
    var b = book(id);
    if (!b) return null;
    Object.assign(b, patch);
    b.updatedAt = Date.now();
    save();
    return b;
  }

  /* ---------------- 章节 ---------------- */
  function chapter(bookId, chId) {
    var b = book(bookId);
    if (!b) return null;
    for (var i = 0; i < b.chapters.length; i++) if (b.chapters[i].id === chId) return b.chapters[i];
    return b.chapters[0] || null;
  }

  function addChapter(bookId, title) {
    var b = book(bookId);
    if (!b) return null;
    var ch = {
      id: uid("ch"),
      title: (title || "第" + (b.chapters.length + 1) + "章").slice(0, 30),
      content: "",
      updatedAt: Date.now()
    };
    b.chapters.push(ch);
    b.updatedAt = Date.now();
    save();
    return ch;
  }

  function renameChapter(bookId, chId, title) {
    var ch = chapter(bookId, chId);
    if (!ch) return false;
    ch.title = String(title || ch.title).slice(0, 30);
    save();
    return true;
  }

  function deleteChapter(bookId, chId) {
    var b = book(bookId);
    if (!b || b.chapters.length <= 1) return false;
    for (var i = 0; i < b.chapters.length; i++) {
      if (b.chapters[i].id === chId) {
        b.chapters.splice(i, 1);
        save();
        return true;
      }
    }
    return false;
  }

  function moveChapter(bookId, chId, dir) {
    var b = book(bookId);
    if (!b) return false;
    var i = -1;
    for (var k = 0; k < b.chapters.length; k++) if (b.chapters[k].id === chId) i = k;
    var j = i + dir;
    if (i < 0 || j < 0 || j >= b.chapters.length) return false;
    var tmp = b.chapters[i];
    b.chapters[i] = b.chapters[j];
    b.chapters[j] = tmp;
    save();
    return true;
  }

  function setContent(bookId, chId, text) {
    var ch = chapter(bookId, chId);
    if (!ch) return false;
    ch.content = text;
    ch.updatedAt = Date.now();
    var b = book(bookId);
    if (b) b.updatedAt = Date.now();
    return save();
  }

  /* ---------------- 写作过程记录 ---------------- */
  function encodeFrame(prev, next) {
    var max = Math.min(prev.length, next.length);
    var p = 0;
    while (p < max && prev.charAt(p) === next.charAt(p)) p++;
    var rp = prev.length;
    var rn = next.length;
    while (rp > p && rn > p && prev.charAt(rp - 1) === next.charAt(rn - 1)) {
      rp--;
      rn--;
    }
    return { p: p, del: prev.slice(p, rp), ins: next.slice(p, rn) };
  }

  function decodeFrame(prev, f) {
    return prev.slice(0, f.p) + f.ins + prev.slice(f.p + f.del.length);
  }

  function startSession(bookId, chId, text) {
    endSession();
    rec = {
      id: uid("ss"),
      bookId: bookId,
      chapterId: chId,
      startedAt: Date.now(),
      frames: [{ t: 0, p: 0, del: "", ins: text || "" }],
      last: text || "",
      added: 0,
      removed: 0
    };
    return rec;
  }

  function recordFrame(text) {
    if (!rec || rec.last === text) return null;
    if (rec.frames.length >= MAX_FRAMES) {
      rec.last = text;
      return null;
    }
    var f = encodeFrame(rec.last, text);
    f.t = Date.now() - rec.startedAt;
    rec.frames.push(f);
    rec.added += f.ins.length;
    rec.removed += f.del.length;
    rec.last = text;
    return f;
  }

  function endSession() {
    if (!rec) return null;
    var r = rec;
    rec = null;
    if (r.frames.length < 2) return null;
    var d = load();
    var b = book(r.bookId);
    if (!b) return null;
    var ch = chapter(r.bookId, r.chapterId);
    var ended = Date.now();
    if (!b.sessions) b.sessions = [];
    b.sessions.push({
      id: r.id,
      chapterId: r.chapterId,
      chapterTitle: ch ? ch.title : "章节",
      startedAt: r.startedAt,
      endedAt: ended,
      duration: ended - r.startedAt,
      added: r.added,
      removed: r.removed,
      frames: r.frames
    });
    while (b.sessions.length > MAX_SESSIONS) b.sessions.shift();
    var key = dayKey(r.startedAt);
    var row = null;
    for (var i = 0; i < d.log.length; i++) if (d.log[i].d === key) row = d.log[i];
    if (!row) {
      row = { d: key, added: 0, removed: 0, ms: 0 };
      d.log.push(row);
    }
    row.added += r.added;
    row.removed += r.removed;
    row.ms += ended - r.startedAt;
    while (d.log.length > MAX_LOG) d.log.shift();
    save();
    return r;
  }

  /* ---------------- 统计 ---------------- */
  function stats() {
    var d = load();
    var totalChapters = 0;
    var totalWords = 0;
    var sessions = 0;
    for (var i = 0; i < d.books.length; i++) {
      var b = d.books[i];
      totalChapters += b.chapters.length;
      totalWords += bookWords(b);
      sessions += b.sessions ? b.sessions.length : 0;
    }
    var today = dayKey(Date.now());
    var todayAdded = 0;
    var totalTyped = 0;
    var ms = 0;
    for (var k = 0; k < d.log.length; k++) {
      totalTyped += d.log[k].added;
      ms += d.log[k].ms;
      if (d.log[k].d === today) todayAdded += d.log[k].added;
    }
    var days = {};
    for (var q = 0; q < d.log.length; q++) if (d.log[q].added > 0) days[d.log[q].d] = 1;
    var streak = 0;
    var cursor = new Date();
    for (var w = 0; w < 400; w++) {
      var key = dayKey(cursor.getTime());
      if (days[key]) {
        streak++;
      } else if (w > 0) {
        break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      books: d.books.length,
      chapters: totalChapters,
      words: totalWords,
      sessions: sessions,
      todayAdded: todayAdded,
      totalTyped: totalTyped,
      minutes: Math.round(ms / 60000),
      streak: streak,
      dailyGoal: d.settings.dailyGoal
    };
  }

  function clearSessions(bookId) {
    var list = bookId ? [book(bookId)] : load().books.slice();
    for (var i = 0; i < list.length; i++) if (list[i]) list[i].sessions = [];
    save();
  }

  function clearAll() {
    data = blank();
    save();
  }

  BB.store = {
    data: load,
    save: save,
    uid: uid,
    words: words,
    paras: paras,
    fmtNum: fmtNum,
    fmtDur: fmtDur,
    fmtTime: fmtTime,
    dayKey: dayKey,
    bookWords: bookWords,
    settings: function () { return load().settings; },
    setSettings: function (patch) {
      Object.assign(load().settings, patch);
      save();
    },
    books: function () { return load().books; },
    book: book,
    isReadonly: isReadonly,
    createBook: createBook,
    importBook: importBook,
    updateBook: updateBook,
    deleteBook: deleteBook,
    chapter: chapter,
    addChapter: addChapter,
    renameChapter: renameChapter,
    deleteChapter: deleteChapter,
    moveChapter: moveChapter,
    setContent: setContent,
    startSession: startSession,
    recordFrame: recordFrame,
    endSession: endSession,
    recording: function () { return !!rec; },
    decodeFrame: decodeFrame,
    stats: stats,
    clearSessions: clearSessions,
    clearAll: clearAll
  };
})();