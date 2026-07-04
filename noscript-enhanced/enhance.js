/* ==========================================================================
   enhance.js — noscript版への漸進強化(トップ+セクション1のみ)
   設計規約:
     1. スクロール処理は passive リスナー1本 + rAF、書き換えは transform/opacity のみ
     2. fixed 多層を使わず sticky 1層 + 子要素 transform で表現
     3. ページ側で preventDefault しない(スクロールは常にネイティブ)
     4. ミサイル iframe は遅延挿入 + 常時 pointer-events:none。
        タッチ追従・360度パノラマは「演出を操作する」ボタンの明示切替時のみ有効
     5. JS が動かない環境では noscript 版がそのまま表示される
   ========================================================================== */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var top = document.getElementById('top');
  var s1 = document.getElementById('section-1');
  if (!top || !s1) return;

  document.documentElement.classList.add('enh');

  /* ---------- DOM 再構成(初期化時に1回だけ、描画前に実行) ---------- */

  // ヒーロー: sticky ステージ化
  var heroInner = top.querySelector('.section-inner');
  var heroSticky = document.createElement('div');
  heroSticky.className = 'enh-hero-sticky';
  top.appendChild(heroSticky);
  heroSticky.appendChild(heroInner);

  var grid = heroInner.querySelector('.top-grid');
  var heroText = document.createElement('div');
  heroText.className = 'enh-hero-text';
  Array.prototype.slice.call(heroInner.children).forEach(function (el) {
    if (el !== grid) heroText.appendChild(el);
  });

  var overlay = document.createElement('div');
  overlay.className = 'enh-hero-overlay';
  heroInner.appendChild(overlay);
  heroInner.appendChild(heroText);

  var indicator = document.createElement('div');
  indicator.className = 'enh-scroll-indicator';
  indicator.textContent = 'SCROLL';
  heroSticky.appendChild(indicator);

  var tiles = Array.prototype.slice.call(grid.querySelectorAll('.img-wrap'));
  var mainTile = tiles[0]; // 写真1(pigeon) = セクション1背景へ拡大

  // セクション1: sticky ステージ化
  var s1Inner = s1.querySelector('.section-inner');
  var s1Sticky = document.createElement('div');
  s1Sticky.className = 'enh-s1-sticky';
  s1.appendChild(s1Sticky);
  s1Sticky.appendChild(s1Inner);

  var caption = document.createElement('div');
  caption.className = 'enh-missile-caption';
  caption.innerHTML =
    '<p class="enh-cap-title">逃げる者と追う者の移動戦略</p>' +
    '<p class="enh-cap-text">画面クリックでドローンカメラに接続</p>';
  s1Sticky.appendChild(caption);

  var modeBtn = document.createElement('button');
  modeBtn.className = 'enh-mode-btn';
  modeBtn.type = 'button';
  modeBtn.textContent = '✦ 演出を操作する';
  s1Sticky.appendChild(modeBtn);

  /* ---------- ミサイル iframe(遅延挿入・明示切替でのみ操作可) ---------- */

  var missileFrame = null;
  var interactive = false;

  function mountMissile() {
    if (missileFrame) return;
    missileFrame = document.createElement('iframe');
    missileFrame.className = 'enh-missile';
    missileFrame.src = 'missile.html';
    missileFrame.setAttribute('frameborder', '0');
    missileFrame.setAttribute('title', 'ミサイル演出');
    missileFrame.style.opacity = '0';
    s1Sticky.insertBefore(missileFrame, s1Inner);
  }

  modeBtn.addEventListener('click', function () {
    interactive = !interactive;
    if (missileFrame) missileFrame.style.pointerEvents = interactive ? 'auto' : 'none';
    modeBtn.textContent = interactive ? '✕ 操作を終了' : '✦ 演出を操作する';
    s1Sticky.classList.toggle('enh-interactive', interactive);
  });

  /* ---------- 幾何計測(transform を外した状態で計測) ---------- */

  var geo = { tx: 0, ty: 0, scale: 1, heroRange: 1, s1Range: 1 };
  var lastWidth = window.innerWidth;

  function measure() {
    tiles.forEach(function (t) { t.style.transform = ''; });
    var vh = window.innerHeight;
    var sr = heroSticky.getBoundingClientRect();
    var tr = mainTile.getBoundingClientRect();
    // 写真1の中心 → ステージ中心へ移動し、cover になる倍率まで拡大(FLIP)
    geo.tx = sr.width / 2 - (tr.left - sr.left + tr.width / 2);
    geo.ty = sr.height / 2 - (tr.top - sr.top + tr.height / 2);
    geo.scale = Math.max(sr.width / tr.width, sr.height / tr.height) * 1.02;
    geo.heroRange = Math.max(1, top.offsetHeight - vh);
    geo.s1Range = Math.max(1, s1.offsetHeight - vh);
    render(true);
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* ---------- 描画(scroll → rAF。transform / opacity のみ変更) ---------- */

  var ticking = false;
  var lastHeroP = -1;
  var lastS1P = -1;

  function render(force) {
    ticking = false;
    var heroP = clamp01(-top.getBoundingClientRect().top / geo.heroRange);
    var s1P = clamp01(-s1.getBoundingClientRect().top / geo.s1Range);
    if (!force && heroP === lastHeroP && s1P === lastS1P) return;
    lastHeroP = heroP;
    lastS1P = s1P;

    // --- ヒーロー: 写真1拡大・他タイル/タイトルのフェード ---
    var e = easeInOut(clamp01(heroP / 0.85));
    mainTile.style.transform =
      'translate(' + geo.tx * e + 'px,' + geo.ty * e + 'px) scale(' + (1 + (geo.scale - 1) * e) + ')';
    var tileFade = 1 - clamp01(heroP / 0.4);
    for (var i = 1; i < tiles.length; i++) tiles[i].style.opacity = tileFade;
    heroText.style.opacity = 1 - clamp01((heroP - 0.5) / 0.3);
    overlay.style.opacity = 1 - clamp01((heroP - 0.5) / 0.35);
    heroSticky.classList.toggle('enh-hero-started', heroP > 0.05);
    grid.classList.toggle('enh-no-click', heroP > 0.3);

    // --- セクション1: テキスト出現 → ミサイル演出フェードイン ---
    var tOp = clamp01((s1P - 0.04) / 0.18);
    s1Inner.style.opacity = tOp;
    s1Inner.style.transform = 'translateY(' + (1 - tOp) * 40 + 'px)';
    if (s1P > 0.2) mountMissile();
    var mOp = clamp01((s1P - 0.32) / 0.25);
    if (missileFrame) missileFrame.style.opacity = mOp;
    caption.style.opacity = mOp;
    s1Sticky.classList.toggle('enh-missile-on', mOp > 0.15);
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () { render(false); });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  window.addEventListener('resize', function () {
    // 幅が変わらない resize(モバイルのアドレスバー開閉)は無視してジャンプを防ぐ
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    measure();
  });

  measure();
  // 画像読み込み完了でタイル寸法が変わるため再計測
  window.addEventListener('load', measure);

  // 検証用フック(自動テストから同期的に再計算・再描画を呼ぶため)
  window.__enh = { measure: measure, geo: geo };
})();
