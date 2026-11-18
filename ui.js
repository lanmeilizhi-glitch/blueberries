/* ============================================================
   蓝莓童话汇 · ui.js
   开机动画 / 开机密码（1006）/ Toast / 通用弹窗
   ============================================================ */
(function () {
  var BB = (window.BB = window.BB || {});
  var PASSCODE = "1006";

  /* ---------------- Toast ---------------- */
  BB.toast = function (msg, kind) {
    var root = document.getElementById("toast-root");
    if (!root) return;
    var el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    root.appendChild(el);
    window.setTimeout(function () {
      el.classList.add("out");
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 260);
    }, 1700);
    while (root.children.length > 3) root.removeChild(root.firstChild);
  };

  /* ---------------- 弹窗 ---------------- */
  var modalStack = [];

  function closeModal(inst) {
    if (!inst || !inst.mask.parentNode) return;
    inst.mask.parentNode.removeChild(inst.mask);
    modalStack = modalStack.filter(function (m) { return m !== inst; });
  }

  BB.modal = {
    open: function (cfg) {
      var root = document.getElementById("modal-root");
      var mask = document.createElement("div");
      mask.className = "modal-mask";
      var box = document.createElement("div");
      box.className = "modal";

      var head = document.createElement("div");
      head.className = "modal-h";
      head.innerHTML =
        '<div><p class="cap">' + (cfg.kicker || "BLUEBERRY STUDIO") +
        '</p><h3>' + (cfg.title || "") + "</h3></div>";
      var x = document.createElement("button");
      x.className = "icon-btn";
      x.type = "button";
      x.setAttribute("aria-label", "关闭");
      x.textContent = "×";
      head.appendChild(x);

      var body = document.createElement("div");
      body.className = "modal-b";
      body.innerHTML = cfg.html || "";

      box.appendChild(head);
      box.appendChild(body);

      var inst = { mask: mask, body: body, close: function () { closeModal(inst); } };

      var actions = cfg.actions || [];
      if (actions.length) {
        var foot = document.createElement("div");
        foot.className = "modal-f";
        actions.forEach(function (a) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "btn" + (a.kind ? " " + a.kind : "");
          b.textContent = a.text;
          b.addEventListener("click", function () {
            if (a.fn) a.fn(inst);
            else closeModal(inst);
          });
          foot.appendChild(b);
        });
        box.appendChild(foot);
      }

      mask.appendChild(box);
      x.addEventListener("click", function () { closeModal(inst); });
      mask.addEventListener("click", function (e) {
        if (e.target === mask) closeModal(inst);
      });
      root.appendChild(mask);
      modalStack.push(inst);
      if (cfg.onOpen) cfg.onOpen(inst);
      return inst;
    },
    confirm: function (cfg) {
      return BB.modal.open({
        kicker: cfg.kicker || "CONFIRM",
        title: cfg.title,
        html: cfg.html,
        actions: [
          { text: "取消", kind: "ghost", fn: function (m) { m.close(); } },
          {
            text: cfg.okText || "确定",
            kind: cfg.danger ? "danger" : "primary",
            fn: function (m) {
              m.close();
              if (cfg.onOk) cfg.onOk();
            }
          }
        ]
      });
    },
    closeAll: function () {
      modalStack.slice().forEach(closeModal);
    }
  };

  /* ---------------- 开机动画 ---------------- */
  var bootDone = false;

  BB.boot = {
    run: function (done) {
      var boot = document.getElementById("boot");
      var sky = document.getElementById("boot-sky");
      var fill = document.getElementById("boot-bar-fill");
      var tip = document.getElementById("boot-tip");
      if (!boot) {
        if (done) done();
        return;
      }
      if (BB.sprites && sky) {
        BB.sprites.floaters(sky, ["blueberry", "orange", "sparkle", "heart"], 16);
      }
      var reduce =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var total = reduce ? 800 : 2700;
      var tips = reduce
        ? ["正在准备…"]
        : ["正在点亮蓝莓灯…", "正在榨一杯橙子汽水…", "正在铺开稿纸…", "童话汇即将开门…"];

      var timers = [];
      var finished = false;

      function finish() {
        if (finished) return;
        finished = true;
        timers.forEach(function (t) { window.clearTimeout(t); });
        if (fill) fill.style.width = "100%";
        boot.classList.add("out");
        bootDone = true;
        window.setTimeout(function () {
          boot.classList.add("hidden");
          if (done) done();
        }, reduce ? 60 : 420);
      }

      tips.forEach(function (t, i) {
        timers.push(
          window.setTimeout(function () {
            if (tip) tip.textContent = t;
            if (fill) {
              fill.style.width = Math.round(((i + 1) / tips.length) * 96) + "%";
            }
          }, (total / (tips.length + 1)) * (i + 1) * 0.86)
        );
      });
      timers.push(window.setTimeout(finish, total));

      boot.addEventListener("click", function (e) {
        if (bootDone) return;
        e.preventDefault();
        finish();
      });
    }
  };

  /* ---------------- 密码锁 ---------------- */
  var input = "";
  var locked = false;

  function renderDots() {
    var dots = document.querySelectorAll("#lock-dots i");
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle("on", i < input.length);
    }
  }

  function msg(text, isErr) {
    var el = document.getElementById("lock-msg");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("err", !!isErr);
  }

  /* 密码提示小折叠 */
  var hintOpen = false;
  var hintBound = false;

  function setHint(open, pulse) {
    var panel = document.getElementById("lock-hint");
    var btn = document.getElementById("lock-hint-btn");
    if (!panel) return;
    hintOpen = !!open;
    panel.classList.toggle("open", hintOpen);
    if (btn) btn.setAttribute("aria-expanded", hintOpen ? "true" : "false");
    panel.classList.remove("pulse");
    if (pulse && hintOpen) {
      window.setTimeout(function () {
        panel.classList.add("pulse");
      }, 30);
      window.setTimeout(function () {
        panel.classList.remove("pulse");
      }, 640);
    }
  }

  function bindHint() {
    var btn = document.getElementById("lock-hint-btn");
    if (!btn || hintBound) return;
    hintBound = true;
    btn.addEventListener("click", function () {
      setHint(!hintOpen, false);
    });
  }

  function press(key) {
    var card = document.getElementById("lock-card");
    if (key === "del") {
      input = input.slice(0, -1);
      renderDots();
      msg("输入开机密码", false);
      return;
    }
    if (key === "clr") {
      input = "";
      renderDots();
      msg("已清空", false);
      return;
    }
    if (input.length >= 4) return;
    input += key;
    renderDots();
    if (input.length < 4) {
      msg("输入开机密码", false);
      return;
    }
    if (input === PASSCODE) {
      msg("密码正确，欢迎回来 ✦", false);
      if (card) card.classList.add("ok");
      window.setTimeout(function () {
        input = "";
        renderDots();
        if (card) card.classList.remove("ok");
        BB.lock.hide();
        if (BB.lock.onUnlock) BB.lock.onUnlock();
      }, 520);
    } else {
      msg("密码不对，再试一次", true);
      setHint(true, true);
      if (card) {
        card.classList.add("shake");
        window.setTimeout(function () { card.classList.remove("shake"); }, 420);
      }
      window.setTimeout(function () {
        input = "";
        renderDots();
        msg("输入开机密码", false);
      }, 560);
    }
  }

  function buildPad() {
    var pad = document.getElementById("lock-pad");
    if (!pad || pad.childNodes.length) return;
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clr", "0", "del"];
    keys.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pad-btn" + (k === "clr" || k === "del" ? " fn" : "");
      b.textContent = k === "clr" ? "清空" : k === "del" ? "删除" : k;
      b.addEventListener("click", function () { press(k); });
      pad.appendChild(b);
    });
  }

  BB.lock = {
    onUnlock: null,
    show: function () {
      var lock = document.getElementById("lock");
      var app = document.getElementById("app");
      var editor = document.getElementById("editor");
      input = "";
      buildPad();
      bindHint();
      setHint(false, false);
      renderDots();
      msg("输入开机密码", false);
      if (editor) editor.classList.add("hidden");
      if (app) app.classList.add("hidden");
      if (lock) {
        lock.classList.remove("hidden");
        lock.classList.remove("out");
      }
      BB.modal.closeAll();
      locked = true;
    },
    hide: function () {
      var lock = document.getElementById("lock");
      if (lock) lock.classList.add("hidden");
      locked = false;
    },
    isLocked: function () {
      return locked;
    }
  };
})();