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

  // デプロイごとに更新するバージョン(キャッシュバスティング/HUD表示用)
  var ENH_VERSION = '20260828b';

  // ハンバーガーメニュー: 項目をタップしたら閉じる(CSSのチェックボックスを外す)。
  // 演出の有無に関係なく効かせたいので、reduced-motion の早期 return より前に置く
  var navToggle = document.getElementById('nav-toggle');
  if (navToggle) {
    var navLinks = document.querySelectorAll('.nav-links a');
    for (var ni = 0; ni < navLinks.length; ni++) {
      navLinks[ni].addEventListener('click', function () { navToggle.checked = false; });
    }
  }

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
  function captionHTML(bottom) {
    // ピクトグラム本体はキャプションの外(下の droneImg)。キャプションは
    // opacity アニメ+z-index でスタッキングコンテキストを作るため、内側に
    // 置くと mix-blend-mode が隔離されて背景と加算合成できない。ここには
    // レイアウト維持用のスペーサーだけを置く。
    return '<p class="enh-cap-title">逃げる者と追う者の移動戦略</p>' +
      '<p class="enh-cap-sub">生物のマルチタスク対処能力の解明に向けて</p>' +
      '<span class="enh-cap-drone-space"></span>' +
      '<p class="enh-cap-text">' + bottom + '</p>';
  }
  // 接続状態ピクトグラム: sticky 直下の独立 <img>(祖先に透明度アニメ要素を
  // 持たせない)。要素自身の opacity / mix-blend-mode は隔離されず背景と合成される。
  var droneImg = document.createElement('img');
  droneImg.className = 'enh-cap-drone-layer';
  droneImg.alt = '';
  // 切替時のちらつき防止: 接続中版を先読みしておく
  new Image().src = 'images/drone_connected.png?v=' + ENH_VERSION;
  function positionDrone() {
    var space = caption.querySelector('.enh-cap-drone-space');
    if (!space) return;
    var r = space.getBoundingClientRect();
    var s = sticky.getBoundingClientRect();
    droneImg.style.left = Math.round(r.left - s.left) + 'px';
    droneImg.style.top = Math.round(r.top - s.top) + 'px';
  }
  // 接続中ピクトグラムは missile.html の canvas 内で screen 合成して描く
  // (Safari は iframe 越しの mix-blend-mode を合成しないため)。
  // スペーサーの位置・大きさ・透明度・状態を iframe へ同期する。
  function syncBadge(mOp) {
    var w = missileFrame && missileFrame.contentWindow;
    if (!w || !w.__capBadge) return;
    var space = caption.querySelector('.enh-cap-drone-space');
    if (!space) return;
    var r = space.getBoundingClientRect();
    var f = missileFrame.getBoundingClientRect();
    w.__capBadge(r.left - f.left, r.top - f.top, r.width, r.height, mOp, dbg.bg);
  }
  function updateCaption() {
    caption.innerHTML = captionHTML(
      dbg.bg ? 'ドローンカメラ接続中' : '画面クリックでドローンカメラに接続'
    );
    if (dbg.bg) {
      // 接続中: DOM側は隠し、canvas内の screen 合成描画に任せる
      droneImg.style.visibility = 'hidden';
    } else {
      droneImg.src = 'images/drone_not_connected.png?v=' + ENH_VERSION;
      droneImg.className = 'enh-cap-drone-layer enh-cap-drone--off';
      droneImg.style.visibility = '';
    }
    positionDrone();
    syncBadge(dbg.mOp);
  }
  sticky.appendChild(caption);
  sticky.appendChild(droneImg);

  /* ---------- ミサイル iframe(遅延挿入・常時操作ON) ---------- */

  var missileFrame = null;
  var touchLayer = null;
  // タッチ端末では iframe のヒットテストを使わない(iOS の PE キャッシュバグ回避)
  var TOUCH_DEVICE = window.matchMedia('(pointer: coarse)').matches ||
    ('ontouchstart' in window) || /forcetouch=1/.test(location.search);

  // デバッグHUD: URL に ?debug=1 を付けると実機の内部状態を画面に表示する
  var DEBUG = /[?&]debug=1/.test(location.search);
  // 開発用の速度・加速度グラフ: ?graphs=1 の時だけ missile.html に表示させる
  var GRAPHS = /[?&]graphs=1/.test(location.search);
  var dbg = { relay: 0, lastDy: 0, pS1: 0, mOp: 0, fw: 0, fwX: 0, fwY: 0, lt: 0, cap: false, wd: 0, bg: false, ifr: null };
  updateCaption(); // 初期表示
  var hud = null;
  if (DEBUG) {
    hud = document.createElement('div');
    hud.className = 'enh-debug-hud';
    document.body.appendChild(hud);
    // ページ全域の受動計測(preventDefault等は一切しない・観測のみ)。
    // フリーズ時に「指は動いているのにスクロールが1pxも動かない」を数値で確定させる
    dbg.gTm = 0; dbg.gMove = 0; dbg.gScroll = 0;
    var gY = 0, gScrollY = 0;
    document.addEventListener('touchstart', function (e) {
      if (e.touches[0]) { gY = e.touches[0].clientY; gScrollY = window.pageYOffset; }
    }, { passive: true, capture: true });
    dbg.gPd = 0; dbg.gNc = 0;
    document.addEventListener('touchmove', function (e) {
      dbg.gTm++;
      if (e.defaultPrevented) dbg.gPd++;   // 誰かが preventDefault した move
      if (!e.cancelable) dbg.gNc++;        // ブラウザが既にスクロール専有した move
      if (e.touches[0]) {
        dbg.gMove = Math.round(gY - e.touches[0].clientY);
        dbg.gScroll = Math.round(window.pageYOffset - gScrollY);
      }
    }, { passive: true, capture: false });
    setInterval(function () {
      var f = dbg.ifr || {};
      var st = f.stat || {};
      hud.textContent =
        'v:' + ENH_VERSION +
        ' scrollY:' + Math.round(window.pageYOffset) +
        ' pS1:' + dbg.pS1.toFixed(2) + ' mOp:' + dbg.mOp.toFixed(2) +
        ' PE:' + (missileFrame ? missileFrame.style.pointerEvents : '-') +
        '\n親: relay受信:' + dbg.relay + ' lastDy:' + dbg.lastDy +
        ' 注入:' + dbg.fw + ' fw座標:' + (dbg.fwX || 0) + ',' + (dbg.fwY || 0) +
        ' 層受信:' + dbg.lt + ' 捕捉:' + dbg.cap +
        '\n診断: docH:' + Math.round(document.scrollingElement.scrollHeight) +
        ' iH:' + window.innerHeight +
        ' stageEnd:' + Math.round(stage.offsetTop + stage.offsetHeight) +
        ' WD:' + dbg.wd + ' カメラ:' + (dbg.bg ? 'ON' : 'off') +
        '\n全域: 移動:' + dbg.gTm + '回 PD:' + dbg.gPd + ' 非cancel:' + dbg.gNc +
        ' 直近指:' + dbg.gMove + 'px 直近scroll:' + dbg.gScroll + 'px' +
        '\niframe: ts:' + (st.ts || 0) + ' tm:' + (st.tm || 0) + ' pd:' + (st.pd || 0) +
        ' te:' + (st.te || 0) + ' relay送信:' + (st.relay || 0) + ' raf:' + (st.raf || 0) +
        '\nactive:' + f.active + ' ox:' + f.ox + ' oy:' + f.oy;
    }, 500);
  }

  function mountMissile() {
    if (missileFrame) return;
    missileFrame = document.createElement('iframe');
    missileFrame.className = 'enh-missile';
    missileFrame.src = 'missile.html?v=' + ENH_VERSION + (DEBUG ? '&debug=1' : '') + (GRAPHS ? '&graphs=1' : '');
    missileFrame.setAttribute('frameborder', '0');
    missileFrame.setAttribute('title', 'ミサイル演出');
    missileFrame.style.opacity = '0';
    missileFrame.style.pointerEvents = 'none';
    sticky.insertBefore(missileFrame, s1Inner);

    if (TOUCH_DEVICE) {
      // 親側の透明タッチ層。受けたタッチを missile.html へ関数呼び出しで注入する。
      // pointer-events は常時 auto(動的切替はしない)。ミサイル操作として捕捉
      // するかどうかは touchstart の瞬間に1回だけ決め、捕捉しないジェスチャには
      // 一切干渉しない=ネイティブスクロールが必ず通り、セクション1に閉じ込め
      // られることが構造的に起こらない。
      touchLayer = document.createElement('div');
      touchLayer.className = 'enh-touch-layer';
      sticky.appendChild(touchLayer);
      var gestureCapture = false;
      var gStartY = 0;      // ジェスチャ開始時のタッチY
      var gStartScroll = 0; // ジェスチャ開始時の scrollY
      var send = function (fn, t) {
        var w = missileFrame && missileFrame.contentWindow;
        if (w && w.__missileInput) { w.__missileInput[fn](t.clientX, t.clientY); dbg.fw++; }
      };
      touchLayer.addEventListener('touchstart', function (e) {
        dbg.lt++;
        // ミサイルが十分見えている間だけ、このジェスチャを操作として捕捉
        gestureCapture = dbg.mOp > 0.1 && dbg.pS1 < 0.92;
        dbg.cap = gestureCapture;
        if (e.touches[0]) {
          gStartY = e.touches[0].clientY;
          gStartScroll = window.pageYOffset;
          if (gestureCapture) send('down', e.touches[0]);
        }
      }, { passive: true });
      touchLayer.addEventListener('touchmove', function (e) {
        if (!gestureCapture) return; // 素通し: ネイティブスクロール
        if (e.cancelable) e.preventDefault();
        if (e.touches[0]) send('move', e.touches[0]);
      }, { passive: false });
      touchLayer.addEventListener('touchcancel', function () {
        // システムジェスチャ等で touchend が来ない場合の張り付き防止
        gestureCapture = false;
        dbg.cap = false;
      }, { passive: true });
      touchLayer.addEventListener('touchend', function (e) {
        var t = e.changedTouches && e.changedTouches[0];
        if (gestureCapture && t) send('up', t);
        // ウォッチドッグ: 素通しスワイプ(40px以上)なのにネイティブスクロールが
        // 1px も動いていなければ、原因が何であれ JS が代行スクロールして脱出させる
        if (!gestureCapture && t) {
          var swipe = gStartY - t.clientY; // 下方向スワイプ = 正
          if (Math.abs(swipe) > 40 && Math.abs(window.pageYOffset - gStartScroll) < 1) {
            dbg.wd++;
            onMissileScroll(swipe);
          }
        }
        gestureCapture = false;
        dbg.cap = false;
      }, { passive: true });
    } else {
      // PC もタッチと同じ「親で受けて注入」の一元アーキテクチャにする。
      // iframe は常時 pointer-events:none(生成時のまま)でヒットテスト対象外。
      // 実Safariは固定ナビの帯で iframe へのマウス配送を止める(親windowには
      // 届くことをHUDで実測済み)ため、iframe 直接受信は使わず親経由に統一。
      // capture:true は途中の stopPropagation に影響されないため。
      var interactiveSel = 'a, label, input, button, .enh-debug-hud';
      var onInteractive = function (e) {
        return !!(e.target && e.target.closest && e.target.closest(interactiveSel));
      };
      var inject = function (fn, e) {
        var w = missileFrame && missileFrame.contentWindow;
        if (!w || !w.__missileInput) return;
        var r = missileFrame.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        w.__missileInput[fn](x, y);
        dbg.fw++; dbg.fwX = Math.round(x); dbg.fwY = Math.round(y);
      };
      var forwardMove = function (e) {
        if (dbg.mOp > 0.1) inject('move', e); // リンク上でも照準は追従させる
      };
      window.addEventListener('mousemove', forwardMove, true);
      if (window.PointerEvent) window.addEventListener('pointermove', forwardMove, true);
      // クリック=カメラ切替(タップ判定はiframe側の down/up ロジックを流用)。
      // リンク等の操作要素上のクリックは切替に使わない。
      window.addEventListener('mousedown', function (e) {
        if (dbg.mOp > 0.1 && !onInteractive(e)) inject('down', e);
      }, true);
      window.addEventListener('mouseup', function (e) {
        if (dbg.mOp > 0.1 && !onInteractive(e)) inject('up', e);
      }, true);
    }
  }

  // スクロール中継ブリッジ: missile.html は照準が縦限界に達すると
  // {type:'missileScroll', deltaY} を送ってくる(全ジェスチャを iframe 側で
  // preventDefault しているため、ページスクロールへの引き継ぎはこれが唯一の経路)
  function onMissileScroll(deltaY) {
    if (typeof deltaY !== 'number' || !isFinite(deltaY)) return;
    var dy = Math.max(-600, Math.min(600, deltaY));
    // scroll-behavior は enhance.css で auto に固定済み(smooth + タッチ中の
    // プログラムスクロールは iOS のスクロール死を招くため)
    window.scrollBy(0, dy);
    dbg.relay++;
    dbg.lastDy = Math.round(dy);
  }
  window.addEventListener('message', function (e) {
    if (!missileFrame || e.source !== missileFrame.contentWindow) return;
    if (!e.data) return;
    if (e.data.type === 'missileScroll') onMissileScroll(e.data.deltaY);
    if (e.data.type === 'missileDebug') dbg.ifr = e.data;
    if (e.data.type === 'missileState') {
      dbg.bg = !!e.data.bg;
      updateCaption();
    }
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
    positionDrone(); // キャプション位置が変わりうるのでピクトグラム層も追随
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* ---------- 描画(scroll → rAF。transform / opacity のみ変更) ---------- */

  var ticking = false;
  var lastScrolled = null;

  // --- 背景ズーム(bg-zoomブランチ実験): スマホ系のみ ---
  // styles_noscript.css の transform: scale(var(--bgz,1)) を駆動する。
  // CSSタイムラインではなくJS駆動なのは、named view-timeline→fixed疑似要素が
  // 「計算値は進むが描画されない」故障をエンジン依存で起こすため(実測)。
  // 書き込みは transform に帰着する変数のみ・タッチ介入なし(設計規約1,3準拠)
  var BGZ_MAX = 0.12;  // 最大 1.12倍(1.08では知覚しづらかったため増量)
  var BGZ_RATE = 1.6;  // 進行の前倒し係数: 通過の約6割で最大到達(1画面あたりの
                       // 変化率を上げて知覚しやすくする。以降は1.12で保持)
  var bgzSections = (window.matchMedia('(max-width: 768px)').matches ||
                     window.matchMedia('(pointer: coarse)').matches)
    ? document.querySelectorAll('.parallax-section') : [];

  function renderBgZoom() {
    var vh = window.innerHeight;
    var rects = [];
    var bi;
    // 読み(getBoundingClientRect)と書き(setProperty)を分離してレイアウト
    // スラッシングを避ける
    for (bi = 0; bi < bgzSections.length; bi++) {
      rects.push(bgzSections[bi].getBoundingClientRect());
    }
    for (bi = 0; bi < bgzSections.length; bi++) {
      var r = rects[bi];
      if (r.bottom < 0 || r.top > vh) continue; // 画面外(窓に描画されない)は据え置き
      var bp = clamp01((vh - r.top) / (vh + r.height) * BGZ_RATE); // 通過進行 0→1(前倒し)
      bgzSections[bi].style.setProperty('--bgz', (1 + BGZ_MAX * bp).toFixed(4));
    }
  }

  function render(force) {
    ticking = false;
    var scrolled = -stage.getBoundingClientRect().top;
    if (!force && scrolled === lastScrolled) return;
    lastScrolled = scrolled;

    renderBgZoom();

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
    // フェードイン(pS1 0.30〜0.55)→ ステージ末尾でフェードアウト(0.90〜0.98)
    var mOp = clamp01((pS1 - 0.30) / 0.25) * (1 - clamp01((pS1 - 0.90) / 0.08));
    dbg.pS1 = pS1;
    dbg.mOp = mOp;
    if (missileFrame) {
      missileFrame.style.opacity = mOp;
      // 入力は PC/タッチとも親側で受けて注入するため、iframe の pointer-events
      // は常時 none のまま(動的切替は Safari の PE キャッシュ問題も踏む)。
      if (!TOUCH_DEVICE) {
        // missile.html は cursor:none で自前照準を描く。iframe が非ヒットに
        // なったぶん、演出中はステージ側でカーソルを消して挙動を引き継ぐ
        // (ナビのリンクは別要素なので矢印カーソルのまま)。
        sticky.style.cursor = (mOp > 0.1) ? 'none' : '';
      }
    }
    caption.style.opacity = mOp;
    droneImg.style.opacity = mOp;
    syncBadge(mOp);
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
  // loading="lazy" の画像・動画は load 後にも読み込まれてステージ高さを変える。
  // geo が古いままだと pS1 の対応が狂い、ミサイル演出が「不可視+入力ゲート閉」
  // で凍結する(読み込み順の競合で断続的に実発生)。寸法変化で自己修復する。
  if (window.ResizeObserver) {
    new ResizeObserver(function () { measure(); }).observe(stage);
  }

  // 検証用フック(自動テストから同期的に再計算・再描画を呼ぶため)
  window.__enh = { measure: measure, geo: geo, onMissileScroll: onMissileScroll };
})();
