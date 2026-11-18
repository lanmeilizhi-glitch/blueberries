/* ============================================================
   蓝莓童话汇 · replay.js
   写作过程回放：把增量帧还原成逐字打字动画
   ============================================================ */
(function () {
  var BB = (window.BB = window.BB || {});
  var SPEEDS = [1, 2, 4, 8];

  var host = null;
  var el = {};
  var mounted = false;

  var state = {
    bookId: null,
    session: null,
    steps: [],
    first: "",
    total: 1,
    pos: 0,
    stepIdx: -1,
    playing: false,
    speedIdx: 0,
    clock: 0,
    raf: 0
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function now() {
    return window.performance && window.performance.now
      ? window.performance.now()
      : Date.now();
  }

  function clock(ms) {
    ms = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(ms / 60);
    var s = ms % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  /* ---------------- 时间轴重建 ---------------- */
  function buildTimeline(session) {
    var frames = (session && session.frames) || [];
    var first = frames.length ? frames[0].ins || "" : "";
    var segs = [];
    var prev = first;
    for (var i = 1; i < frames.length; i++) {
      var f = frames[i];
      var del = f.del || "";
      var ins = f.ins || "";
      var p = f.p || 0;
      segs.push({
        p: p,
        del: del,
        ins: ins,
        prev: prev,
        suffix: prev.slice(p + del.length),
        dur: Math.max(90, Math.min(2600, (f.t || 0) - (frames[i - 1].t || 0)))
      });
      prev = BB.store.decodeFrame(prev, f);
    }

    var steps = [];
    var acc = 0;
    var typed = 0;
    var wiped = 0;
    for (var s = 0; s < segs.length; s++) {
      var seg = segs[s];
      var chars = seg.del.length + seg.ins.length;
      if (!chars) continue;
      var per = seg.dur / chars;
      for (var k = 0; k < seg.del.length; k++) {
        acc += per;
        wiped++;
        steps.push({ seg: seg, kind: "del", k: k + 1, time: acc, typed: typed, wiped: wiped });
      }
      for (var j = 0; j < seg.ins.length; j++) {
        acc += per;
        typed++;
        steps.push({ seg: seg, kind: "ins", k: j + 1, time: acc, typed: typed, wiped: wiped });
      }
    }
    state.steps = steps;
    state.first = first;
    state.total = Math.max(1, acc);
    state.stepIdx = -1;
    state.pos = 0;
  }

  function textAt(step) {
    if (!step) return { text: state.first, caret: state.first.length };
    var seg = step.seg;
    var prefix = seg.prev.slice(0, seg.p);
    if (step.kind === "del") {
      var keep = seg.del.slice(0, seg.del.length - step.k);
      return { text: prefix + keep + seg.suffix, caret: prefix.length + keep.length };
    }
    var typed = seg.ins.slice(0, step.k);
    return { text: prefix + typed + seg.suffix, caret: prefix.length + typed.length };
  }

  function findStep(pos) {
    var lo = 0;
    var hi = state.steps.length - 1;
    var res = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (state.steps[mid].time <= pos) {
        res = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return res;
  }

  var WINDOW = 2400;

  function paint(step) {
    var t = textAt(step);
    var text = t.text;
    var caret = Math.max(0, Math.min(text.length, t.caret));
    var start = 0;
    var end = text.length;
    if (text.length > WINDOW) {
      start = Math.max(0, caret - Math.floor(WINDOW / 2));
      end = Math.min(text.length, start + WINDOW);
      if (end - start < WINDOW) start = Math.max(0, end - WINDOW);
      caret = Math.max(start, Math.min(end, caret));
    }
    var html =
      (start > 0 ? "…" : "") +
      esc(text.slice(start, caret)) +
      '<i class="rp-caret"></i>' +
      esc(text.slice(caret, end)) +
      (end < text.length ? "…" : "");
    el.text.innerHTML = html;

    if (state.playing) {
      var c = el.text.querySelector(".rp-caret");
      if (c) {
        var top = c.offsetTop;
        var h = el.text.clientHeight;
        if (top < el.text.scrollTop + 16 || top > el.text.scrollTop + h - 52) {
          el.text.scrollTop = Math.max(0, top - h * 0.55);
        }
      }
    }

    var st = step || { typed: 0, wiped: 0 };
    el.typed.textContent = st.typed;
    el.wiped.textContent = st.wiped;
    var secs = Math.round(state.pos / 1000);
    var wpm = secs > 4 ? Math.round((st.typed / secs) * 60 * SPEEDS[state.speedIdx]) : 0;
    el.speed.textContent = wpm;
    el.cur.textContent = clock(state.pos);
  }

  function render(pos) {
    state.pos = Math.max(0, Math.min(state.total, pos));
    if (el.range.value !== String(Math.round(state.pos))) {
      el.range.value = String(Math.round(state.pos));
    }
    var idx = findStep(state.pos);
    if (idx === state.stepIdx) return;
    state.stepIdx = idx;
    paint(idx < 0 ? null : state.steps[idx]);
  }

  /* ---------------- 播放控制 ---------------- */
  function stopRaf() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  function loop() {
    if (!state.playing) return;
    var pos = state.pos + (now() - state.clock) * SPEEDS[state.speedIdx];
    state.clock = now();
    if (pos >= state.total) {
      render(state.total);
      pause();
      el.state.textContent = "回放完成";
      el.play.innerHTML = "↺ 重播";
      return;
    }
    render(pos);
    state.raf = requestAnimationFrame(loop);
  }

  function play() {
    if (!state.session || !state.steps.length) {
      BB.toast("这条记录没有可回放的输入过程", "err");
      return;
    }
    if (state.pos >= state.total) {
      state.pos = 0;
      state.stepIdx = -1;
    }
    state.playing = true;
    state.clock = now();
    el.play.innerHTML = "‖ 暂停";
    el.state.textContent = "回放中";
    stopRaf();
    state.raf = requestAnimationFrame(loop);
  }

  function pause() {
    state.playing = false;
    stopRaf();
    el.play.innerHTML = "▶ 播放";
    if (el.state.textContent === "回放中") el.state.textContent = "已暂停";
  }

  /* ---------------- 列表渲染 ---------------- */
  function sessionItem(s, on) {
    return (
      '<div class="sess-item' + (on ? " on" : "") + '" data-act="rp-sess" data-id="' + s.id + '">' +
      '<span class="px-box sess-ico" data-sprite="' + (on ? "play" : "sparkle") + '"></span>' +
      '<div class="sess-main"><div class="sess-title">' + esc(s.chapterTitle || "章节") + "</div>" +
      '<div class="sess-meta">' + BB.store.fmtTime(s.startedAt) + " · " + BB.store.fmtDur(s.duration) +
      " · +" + (s.added || 0) + "/-" + (s.removed || 0) + "</div></div></div>"
    );
  }

  function renderSessions() {
    var book = BB.store.book(state.bookId);
    if (!book) {
      el.sessions.innerHTML =
        '<div class="empty"><span class="px-box empty-ico" data-sprite="doc"></span>' +
        "还没有作品，先去「写作」创建一本新书吧</div>";
      BB.sprites.hydrate(el.sessions);
      return;
    }
    var list = (book.sessions || []).slice().reverse();
    if (!list.length) {
      el.sessions.innerHTML =
        '<div class="empty"><span class="px-box empty-ico" data-sprite="blueberry"></span>' +
        "这本书还没有写作记录<br>在编辑器里写一段并保存，就会自动生成回放</div>";
      BB.sprites.hydrate(el.sessions);
      return;
    }
    var html = "";
    for (var i = 0; i < list.length; i++) {
      html += sessionItem(list[i], state.session && list[i].id === state.session.id);
    }
    el.sessions.innerHTML = html;
    BB.sprites.hydrate(el.sessions);
  }

  function pickSession(id) {
    var book = BB.store.book(state.bookId);
    if (!book) return;
    var list = book.sessions || [];
    var found = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) found = list[i];
    if (!found) return;
    pause();
    state.session = found;
    buildTimeline(found);
    el.tag.textContent = (found.chapterTitle || "章节") + " · " + BB.store.fmtDur(found.duration);
    el.range.max = String(Math.round(state.total));
    el.total.textContent = clock(state.total);
    el.state.textContent = "待机";
    el.sessions.innerHTML = "";
    renderSessions();
    render(0);
  }

  function renderBooks(selected) {
    var books = BB.store.books();
    if (!books.length) {
      el.book.innerHTML = '<option value="">暂无作品</option>';
      state.bookId = null;
      renderSessions();
      return;
    }
    var html = "";
    for (var i = 0; i < books.length; i++) {
      var b = books[i];
      var n = (b.sessions || []).length;
      html +=
        '<option value="' + b.id + '">' +
        esc(b.title) + "（" + n + " 条记录）</option>";
    }
    el.book.innerHTML = html;
    state.bookId = selected || books[0].id;
    el.book.value = state.bookId;
    state.session = null;
    renderSessions();
  }

  /* ---------------- 挂载 ---------------- */
  BB.replay = {
    mount: function (node) {
      host = node;
      if (!host || mounted) {
        if (host) BB.replay.refresh();
        return;
      }
      host.innerHTML =
        '<div class="card tint">' +
        '<div class="card-h"><div><p class="cap">WRITING REPLAY</p>' +
        '<div class="card-title">写作过程回放</div></div>' +
        '<span class="chip pink" id="rp-state">待机</span></div>' +
        '<div class="rp-pick"><div class="field"><label>选择作品</label>' +
        '<select id="rp-book"></select></div></div>' +
        '<div class="drawer-list" id="rp-sessions"></div>' +
        "</div>" +
        '<div class="rp-stage"><span class="tag rp-tag" id="rp-tag">选择一条记录</span>' +
        '<div class="rp-text" id="rp-text"></div></div>' +
        '<div class="rp-stats">' +
        '<div class="rp-stat"><b id="rp-typed">0</b><span>已敲下</span></div>' +
        '<div class="rp-stat"><b id="rp-wiped">0</b><span>已删改</span></div>' +
        '<div class="rp-stat"><b id="rp-speed">0</b><span>字/分钟</span></div>' +
        '<div class="rp-stat"><b id="rp-cur">00:00</b><span>回放进度</span></div>' +
        "</div>" +
        '<div class="card"><input type="range" class="rp-range" id="rp-range" min="0" max="1" value="0" step="10">' +
        '<div class="row spread" style="margin-top:6px">' +
        '<span class="rp-time" id="rp-cur2">00:00</span>' +
        '<span class="rp-time" id="rp-total">00:00</span></div>' +
        '<div class="rp-ctrl" style="margin-top:10px">' +
        '<button class="rp-btn" id="rp-restart" type="button">↺</button>' +
        '<button class="rp-btn main" id="rp-play" type="button">▶ 播放</button>' +
        '<button class="rp-btn" id="rp-speed-btn" type="button">1×</button>' +
        "</div></div>";

      el = {
        book: host.querySelector("#rp-book"),
        sessions: host.querySelector("#rp-sessions"),
        text: host.querySelector("#rp-text"),
        tag: host.querySelector("#rp-tag"),
        state: host.querySelector("#rp-state"),
        typed: host.querySelector("#rp-typed"),
        wiped: host.querySelector("#rp-wiped"),
        speed: host.querySelector("#rp-speed"),
        cur: host.querySelector("#rp-cur"),
        cur2: host.querySelector("#rp-cur2"),
        total: host.querySelector("#rp-total"),
        range: host.querySelector("#rp-range"),
        play: host.querySelector("#rp-play"),
        restart: host.querySelector("#rp-restart"),
        speedBtn: host.querySelector("#rp-speed-btn")
      };
      el.text.style.position = "relative";
      el.text.innerHTML =
        '<div class="empty"><span class="px-box empty-ico" data-sprite="orange"></span>' +
        "选一条写作记录，看看这些字是怎么一个个长出来的</div>";
      BB.sprites.hydrate(el.text);

      el.book.addEventListener("change", function () {
        pause();
        state.session = null;
        state.bookId = el.book.value;
        el.tag.textContent = "选择一条记录";
        renderSessions();
      });

      el.sessions.addEventListener("click", function (e) {
        var row = e.target.closest("[data-act='rp-sess']");
        if (!row) return;
        pickSession(row.getAttribute("data-id"));
      });

      el.play.addEventListener("click", function () {
        if (state.playing) pause();
        else play();
      });

      el.restart.addEventListener("click", function () {
        pause();
        state.stepIdx = -1;
        render(0);
        el.state.textContent = "已重置";
      });

      el.speedBtn.addEventListener("click", function () {
        state.speedIdx = (state.speedIdx + 1) % SPEEDS.length;
        el.speedBtn.textContent = SPEEDS[state.speedIdx] + "×";
        state.clock = now();
      });

      function onSeek() {
        state.clock = now();
        render(parseFloat(el.range.value) || 0);
        el.cur2.textContent = clock(state.pos);
      }
      el.range.addEventListener("input", onSeek);
      el.range.addEventListener("change", onSeek);

      mounted = true;
      BB.replay.refresh();
    },

    refresh: function (bookId) {
      if (!mounted) return;
      pause();
      state.session = null;
      renderBooks(bookId || state.bookId);
      el.range.max = "1";
      el.range.value = "0";
      el.total.textContent = "00:00";
      el.cur2.textContent = "00:00";
      el.state.textContent = "待机";
      el.tag.textContent = "选择一条记录";
    },

    openBook: function (bookId) {
      if (!mounted) return;
      BB.replay.refresh(bookId);
    },

    stop: function () {
      pause();
    }
  };
})();
