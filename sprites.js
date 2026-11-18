/* ============================================================
   蓝莓童话汇 · sprites.js
   像素精灵（蓝莓 / 橙子 / 星星 / 爱心 / 铅笔 / 书页 / 播放）
   以 viewBox 像素网格输出 SVG，由 CSS 控制显示尺寸
   ============================================================ */
(function () {
  var BB = (window.BB = window.BB || {});

  var ART = {
    blueberry: [
      "..1..1..1...",
      "..11.11.11..",
      "..11111111..",
      ".1222222221.",
      "122333333221",
      "123334433321",
      "123344433321",
      "123333333321",
      "123333333321",
      ".1233333321.",
      "..12222221..",
      "...111111..."
    ],
    orange: [
      "......6.....",
      ".....6.55...",
      "...665555...",
      "..11111111..",
      ".1222222221.",
      "122333333221",
      "123334433321",
      "123334433321",
      "123333333321",
      ".1223333221.",
      "..12222221..",
      "...111111..."
    ],
    sparkle: [
      "....2....",
      "....2....",
      "..2.2.2..",
      "...222...",
      "222222222",
      "...222...",
      "..2.2.2..",
      "....2....",
      "....2...."
    ],
    heart: [
      ".22...22.",
      "2332.2332",
      "233333332",
      "233333332",
      ".2333332.",
      "..23332..",
      "...232...",
      "....2...."
    ],
    pencil: [
      "..11111..",
      "..12221..",
      "..12221..",
      "..12221..",
      "..13331..",
      "..13431..",
      "...141...",
      "....1....",
      "........."
    ],
    doc: [
      ".1111111.",
      "133333331",
      "132222231",
      "133333331",
      "132222231",
      "133333331",
      "132222231",
      "133333331",
      ".1111111."
    ],
    play: [
      "2........",
      "22.......",
      "222......",
      "2222.....",
      "22222....",
      "2222.....",
      "222......",
      "22.......",
      "2........"
    ],
    book: [
      "11111111111",
      "12222222221",
      "12222222241",
      "12223322241",
      "12223322241",
      "12222222241",
      "12222222241",
      "11111111111"
    ]
  };

  var PALETTE = {
    blueberry: { 1: "#4f6ea8", 2: "#8fb6ef", 3: "#b9d5fa", 4: "#f0f8ff" },
    orange: { 1: "#cf8a3d", 2: "#ffb95f", 3: "#ffd79a", 4: "#fff4dc", 5: "#8fdcb0", 6: "#a4763f" },
    sparkle: { 2: "#f9c6dc" },
    heart: { 2: "#f7a8c6", 3: "#ffd6e6" },
    pencil: { 1: "#8b93b3", 2: "#ffd894", 3: "#f7cfae", 4: "#5a6288" },
    doc: { 1: "#7f9fd0", 2: "#cfe0f5", 3: "#ffffff" },
    play: { 2: "#8fb9ee" },
    book: { 1: "#7f9fd0", 2: "#f9b6d2", 3: "#ffffff", 4: "#eaf4ff" }
  };

  function build(name) {
    var rows = ART[name];
    if (!rows || !rows.length) return "";
    var pal = PALETTE[name] || {};
    var w = rows[0].length;
    var h = rows.length;
    var out = [];
    for (var y = 0; y < h; y++) {
      var row = rows[y];
      var x = 0;
      while (x < row.length) {
        var c = row.charAt(x);
        if (c === ".") {
          x++;
          continue;
        }
        var run = 1;
        while (x + run < row.length && row.charAt(x + run) === c) run++;
        out.push(
          '<rect x="' + x + '" y="' + y + '" width="' + run +
          '" height="1" fill="' + (pal[c] || "#8fb9ee") + '"/>'
        );
        x += run;
      }
    }
    return (
      '<svg class="px" viewBox="0 0 ' + w + " " + h +
      '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' +
      out.join("") +
      "</svg>"
    );
  }

  function hydrate(root) {
    var scope = root || document;
    var list = scope.querySelectorAll("[data-sprite]");
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.getAttribute("data-sprite-done") === "1") continue;
      var name = el.getAttribute("data-sprite");
      el.innerHTML = build(name);
      el.classList.add("px-box");
      el.setAttribute("data-sprite-done", "1");
    }
  }

  /** 生成漂浮装饰（开机动画用） */
  function floaters(host, names, count) {
    if (!host) return;
    host.innerHTML = "";
    var set = names && names.length ? names : ["blueberry", "orange", "sparkle"];
    for (var i = 0; i < count; i++) {
      var name = set[i % set.length];
      var size = 14 + Math.round(Math.random() * 20);
      var box = document.createElement("i");
      box.className = "px-box float";
      box.style.left = Math.round(Math.random() * 94) + "%";
      box.style.width = size + "px";
      box.style.height = size + "px";
      box.style.animationDuration = (5 + Math.random() * 6).toFixed(2) + "s";
      box.style.animationDelay = (-Math.random() * 8).toFixed(2) + "s";
      box.innerHTML = build(name);
      host.appendChild(box);
    }
  }

  BB.sprites = {
    names: Object.keys(ART),
    build: build,
    hydrate: hydrate,
    floaters: floaters
  };
})();
