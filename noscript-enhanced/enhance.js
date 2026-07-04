/* ==========================================================================
   enhance.js — noscript版への漸進強化(トップ+セクション1を単一ステージで連続演出)
   設計規約:
     1. スクロール処理は passive リスナー1本 + rAF、書き換えは transform/opacity のみ
     2. fixed 多層を使わず sticky 1層 + 子要素 transform で表現
     3. ページ側で preventDefault しない(スクロールは常にネイティブ)
     4. ミサイル iframe は遅延挿入。操作は常時ON(missile.html 側が全ジェスチャを
        preventDefault で受け、縦限界時のみ postMessage ブリッジで親をスクロール)
     5. JS が動かない環境では noscript 版がそのまま表示される
   ステージ構成(シームレス化の要):
     ヒーローとセクション1を1枚の sticky で覆い、拡大したタイル写真1がその
     ままセクション1の背景になる。レイヤー交代が存在しないため、大きさ・
     トリミング・明るさの連続性が構造的に保証される。
   ========================================================================== */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var top = document.getElementById('top');
  var s1 = document.getElementById('section-1');
  if (!top || !s1) return;

  document.documentElement.classList.add('enh');

  /* ---------- DOM 再構成(初期化時に1回だけ、描画前に実行) ---------- */

  // 統合ステージ: #top と #section-1 の合計スクロール量を1枚の sticky で覆う。
  // #top / #section-1 自体は高さ確保とアンカー用のマーカーとして残す。
  var stage = document.createElement('div');
  stage.className = 'enh-stage';
  top.parentNode.insertBefore(stage, top);

  var sticky = document.createElement('div');
  sticky.className = 'enh-stage-sticky';
  stage.appendChild(sticky);
  stage.appendChild(top);
  stage.appendChild(s1);

  // ヒーロー層(タイルグリッド+タイトル)を sticky へ移設
  var heroInner = top.querySelector('.section-inner');
  heroInner.classList.add('enh-hero-inner');
  sticky.appendChild(heroInner);

  var grid = heroInner.querySelector('.top-grid');
  var heroText = document.createElement('div');
  heroText.className = 'enh-hero-text';
  Array.prototype.slice.call(heroInner.children).forEach(function (el) {
    if (el !== grid) heroText.appendChild(el);
  });

  // 明るさの連続遷移用オーバーレイ2枚:
  //   A = ヒーロー用グラデ(0.35→0.65) / B = セクション1用の一様 0.65
  // 拡大完了に合わせて A→B をクロスフェードし、明るさの段差を無くす
  var overlayA = document.createElement('div');
  overlayA.className = 'enh-overlay-hero';
  var overlayB = document.createElement('div');
  overlayB.className = 'enh-overlay-s1';
  heroInner.appendChild(overlayA);
  heroInner.appendChild(overlayB);
  heroInner.appendChild(heroText);

  var indicator = document.createElement('div');
  indicator.className = 'enh-scroll-indicator';
  indicator.textContent = 'SCROLL';
  sticky.appendChild(indicator);

  var tiles = Array.prototype.slice.call(grid.querySelectorAll('.img-wrap'));
  var mainTile = tiles[0]; // 写真1(pigeon) = 拡大してそのままセクション1背景になる

  // セクション1のテキスト層を sticky へ移設
  var s1Inner = s1.querySelector('.section-inner');
  s1Inner.classList.add('enh-s1-inner');
  sticky.appendChild(s1Inner);

  var caption = document.createElement('div');
  caption.className = 'enh-missile-caption';
  caption.innerHTML =
    '<p class="enh-cap-title">逃げる者と追う者の移動戦略</p>' +
    '<p class="enh-cap-text">画面クリックでドローンカメラに接続</p>';
  sticky.appendChild(caption);

  /* ---------- ミサイル iframe(遅延挿入・常時操作ON) ---------- */

  var missileFrame = null;

  // デバッグHUD: URL に ?debug=1 を付けると実機の内部状態を画面に表示する
  var DEBUG = /[?&]debug=1/.test(location.search);
  var dbg = { relay: 0, lastDy: 0, pS1: 0, mOp: 0, ifr: null };
  var hud = null;
  if (DEBUG) {
    hud = document.createElement('div');
    hud.className = 'enh-debug-hud';
    document.body.appendChild(hud);
    setInterval(function () {
      var f = dbg.ifr || {};
      var st = f.stat || {};
      hud.textContent =
        'scrollY:' + Math.round(window.pageYOffset) +
        ' pS1:' + dbg.pS1.toFixed(2) + ' mOp:' + dbg.mOp.toFixed(2) +
        ' PE:' + (missileFrame ? missileFrame.style.pointerEvents : '-') +
        '\n親: relay受信:' + dbg.relay + ' lastDy:' + dbg.lastDy +
        '\niframe: ts:' + (st.ts || 0) + ' tm:' + (st.tm || 0) + ' pd:' + (st.pd || 0) +
        ' te:' + (st.te || 0) + ' relay送信:' + (st.relay || 0) + ' raf:' + (st.raf || 0) +
        '\nactive:' + f.active + ' ox:' + f.ox + ' oy:' + f.oy;
    }, 500);
  }

  function mountMissile() {
    if (missileFrame) return;
    missileFrame = document.createElement('iframe');
    missileFrame.className = 'enh-missile';
    missileFrame.src = 'missile.html' + (DEBUG ? '?debug=1' : '');
    missileFrame.setAttribute('frameborder', '0');
    missileFrame.setAttribute('title', 'ミサイル演出');
    missileFrame.style.opacity = '0';
    missileFrame.style.pointerEvents = 'none';
    sticky.insertBefore(missileFrame, s1Inner);
  }

  // スクロール中継ブリッジ: missile.html は照準が縦限界に達すると
  // {type:'missileScroll', deltaY} を送ってくる(全ジェスチャを iframe 側で
  // preventDefault しているため、ページスクロールへの引き継ぎはこれが唯一の経路)
  function onMissileScroll(deltaY) {
    if (typeof deltaY !== 'number' || !isFinite(deltaY)) return;
    var dy = Math.max(-200, Math.min(200, deltaY));
    // 'instant' は Safari の一部で未知の列挙値として TypeError になるため使わない。
    // 代わりに html の scroll-behavior:smooth を一瞬だけ無効化して即時スクロール。
    var rootStyle = document.documentElement.style;
    var prev = rootStyle.scrollBehavior;
    rootStyle.scrollBehavior = 'auto';
    window.scrollBy(0, dy);
    rootStyle.scrollBehavior = prev;
    dbg.relay++;
    dbg.lastDy = Math.round(dy);
  }
  window.addEventListener('message', function (e) {
    if (!missileFrame || e.source !== missileFrame.contentWindow) return;
    if (!e.data) return;
    if (e.data.type === 'missileScroll') onMissileScroll(e.data.deltaY);
    if (e.data.type === 'missileDebug') dbg.ifr = e.data;
  });

  /* ---------- 幾何計測(transform を外した状態で計測) ---------- */

  var geo = { tx: 0, ty: 0, scale: 1, heroRange: 1, s1Range: 1 };
  var lastWidth = window.innerWidth;

  function measure() {
    tiles.forEach(function (t) { t.style.transform = ''; });
    var vh = window.innerHeight;
    var sr = sticky.getBoundingClientRect();
    var tr = mainTile.getBoundingClientRect();
    // 写真1の中心 → ステージ中心へ移動し、cover になる倍率まで拡大(FLIP)
    geo.tx = sr.width / 2 - (tr.left - sr.left + tr.width / 2);
    geo.ty = sr.height / 2 - (tr.top - sr.top + tr.height / 2);
    geo.scale = Math.max(sr.width / tr.width, sr.height / tr.height) * 1.02;
    // ヒーロー区間 = ステージ先頭〜 #section-1 マーカーが画面上端に届くまで
    geo.heroRange = Math.max(1, s1.offsetTop - vh);
    geo.s1Range = Math.max(1, stage.offsetHeight - vh - geo.heroRange);
    render(true);
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* ---------- 描画(scroll → rAF。transform / opacity のみ変更) ---------- */

  var ticking = false;
  var lastScrolled = null;

  function render(force) {
    ticking = false;
    var scrolled = -stage.getBoundingClientRect().top;
    if (!force && scrolled === lastScrolled) return;
    lastScrolled = scrolled;

    var pHero = clamp01(scrolled / geo.heroRange);
    var pS1 = clamp01((scrolled - geo.heroRange) / geo.s1Range);

    // --- ヒーロー: 写真1拡大・他タイル/タイトルのフェード ---
    var e = easeInOut(clamp01(pHero / 0.85));
    mainTile.style.transform =
      'translate(' + geo.tx * e + 'px,' + geo.ty * e + 'px) scale(' + (1 + (geo.scale - 1) * e) + ')';
    var tileFade = 1 - clamp01(pHero / 0.4);
    for (var i = 1; i < tiles.length; i++) tiles[i].style.opacity = tileFade;
    heroText.style.opacity = 1 - clamp01((pHero - 0.5) / 0.3);

    // 明るさの連続遷移: グラデ(0.35→0.65) → 一様0.65 へクロスフェード
    var xfade = clamp01((pHero - 0.55) / 0.35);
    overlayA.style.opacity = 1 - xfade;
    overlayB.style.opacity = xfade;

    sticky.classList.toggle('enh-hero-started', pHero > 0.05);
    grid.classList.toggle('enh-no-click', pHero > 0.3);

    // --- セクション1: テキスト出現 → ミサイル演出フェードイン(常時操作ON) ---
    var tOp = clamp01((pS1 - 0.04) / 0.18);
    s1Inner.style.opacity = tOp;
    s1Inner.style.transform = 'translateY(' + (1 - tOp) * 40 + 'px)';

    if (scrolled > geo.heroRange * 0.8) mountMissile();
    // フェードイン(pS1 0.30〜0.55)→ ステージ末尾でフェードアウト(0.90〜0.98)。
    // iframe は position:fixed のため、消しておかないと次セクションに被る
    var mOp = clamp01((pS1 - 0.30) / 0.25) * (1 - clamp01((pS1 - 0.90) / 0.08));
    dbg.pS1 = pS1;
    dbg.mOp = mOp;
    if (missileFrame) {
      missileFrame.style.opacity = mOp;
      // 表示され始めたらタッチ/クリックを iframe に渡す(フル版と同じ opacity>0.1 基準)
      missileFrame.style.pointerEvents = (mOp > 0.1) ? 'auto' : 'none';
    }
    caption.style.opacity = mOp;
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
  window.__enh = { measure: measure, geo: geo, onMissileScroll: onMissileScroll };
})();
