// スクロールアニメーション
document.addEventListener('DOMContentLoaded', function() {

    // Helper: Detect Mobile & Reduced Motion
    const isMobileViewport = () => window.innerWidth < 769;
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Cache window height to prevent jumps on scroll when address bar is hidden
    let cachedWindowHeight = window.innerHeight;

    const isIOSDevice = () => {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    };

    function getViewportHeight() {
        return window.visualViewport ? window.visualViewport.height : window.innerHeight;
    }

    function getContactSection() {
        return document.querySelector('#contact') ||
            document.querySelector('.contact-section') ||
            document.querySelector('.contact');
    }

    function isNearPageEnd() {
        const contactSection = getContactSection();
        if (!contactSection) return false;

        const viewportHeight = getViewportHeight();
        const rect = contactSection.getBoundingClientRect();

        return rect.top < viewportHeight * 1.2;
    }

    function shouldUseSafeEndMode() {
        return isIOSDevice() && isNearPageEnd();
    }

    function disableHeavyEndEffects() {
        const mainTile = tiles[0];
        if (mainTile) {
            mainTile.style.clipPath = 'none';
            mainTile.style.transform = 'none';
            mainTile.style.opacity = '0'; // iOS bleed fix: hide underlying tile
        }

        const bgLayers = document.querySelectorAll('.section-bg-layer');
        bgLayers.forEach((el, index) => {
            el.style.clipPath = 'none';
            el.style.transform = 'none';
            el.style.willChange = 'auto';
            if (index < bgLayers.length - 1) {
                el.style.opacity = '0'; // iOS bleed fix: hide inactive layers
            } else {
                el.style.opacity = '1';
            }
        });

        const fixedBgs = document.querySelectorAll('.fixed-background img');
        fixedBgs.forEach((el, index) => {
            el.style.clipPath = 'none';
            el.style.transform = 'none';
            el.style.willChange = 'auto';
            if (index < fixedBgs.length - 1) {
                el.style.opacity = '0'; // iOS bleed fix: hide inactive layers
            } else {
                el.style.opacity = '1';
            }
        });

        document.querySelectorAll('.zoom-on-scroll').forEach(img => {
            img.style.transform = 'none';
        });

        document.querySelectorAll('.parallax').forEach(el => {
            el.style.transform = 'none';
        });

        const hero = document.querySelector('.hero-image');
        if (hero) {
            hero.style.transform = 'none';
        }

        if (missileBackground) {
            missileBackground.style.clipPath = 'none';
        }
    }

    function shouldSkipResize() {
        const newWidth = window.innerWidth;
        if (isMobileViewport() && newWidth === lastResizeWidth) {
            return true;
        }
        lastResizeWidth = newWidth;
        cachedWindowHeight = window.innerHeight; // Update cached height
        return false;
    }

    // ページ読み込み時は必ずトップに戻す（スクロール位置の復元を防止）
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // ダイナミックタイルグリッドのスクロールアニメーション
    const heroSection = document.querySelector('.hero-dynamic');
    const tileGrid = document.getElementById('tileGrid');
    const tiles = document.querySelectorAll('.tile');
    const heroContent = document.querySelector('.hero-content-dynamic');
    const titleElement = document.querySelector('.hero-title-dynamic');

    // タイトルのフォントサイズを自動調整
    function adjustTitleSize() {
        if (!titleElement) return;

        const viewportWidth = window.innerWidth;
        const containerPadding = 80; // 左右のパディング
        const availableWidth = viewportWidth - containerPadding;

        // letter-spacingを一旦0にして測定
        titleElement.style.letterSpacing = '0px';

        // 二分探索で最適なフォントサイズを見つける
        let minSize = 10;
        let maxSize = 500;
        let optimalSize = minSize;

        while (maxSize - minSize > 1) {
            const testSize = Math.floor((minSize + maxSize) / 2);
            titleElement.style.fontSize = testSize + 'px';

            const actualWidth = titleElement.scrollWidth;

            if (actualWidth <= availableWidth) {
                optimalSize = testSize;
                minSize = testSize;
            } else {
                maxSize = testSize;
            }
        }

        titleElement.style.fontSize = optimalSize + 'px';

        // letter-spacingを少し追加
        const letterSpacing = optimalSize * 0.01;
        titleElement.style.letterSpacing = letterSpacing + 'px';
    }

    // タイトル枠の位置を調整して、中央線を赤線に合わせる
    function updateTitleCenterLine() {
        const centerLine = document.querySelector('.title-center-line');
        const tileCenterLine = document.querySelector('.tile-center-line');
        if (!titleElement || !centerLine || !tileCenterLine || !heroContent) return;

        // タイル中央線の位置を取得
        const tileCenterRect = tileCenterLine.getBoundingClientRect();
        const tileCenterY = tileCenterRect.top + window.scrollY;

        // タイトル要素の現在の位置と高さを取得
        const titleRect = titleElement.getBoundingClientRect();
        const titleCurrentCenter = titleRect.top + window.scrollY + titleRect.height / 2;

        // ずれを計算
        const offset = tileCenterY - titleCurrentCenter;

        // hero-content-dynamicの現在のtop値を取得して調整
        const computedStyle = getComputedStyle(heroContent);
        const currentTop = heroContent.offsetTop;
        heroContent.style.top = (currentTop + offset) + 'px';

        // 緑線をタイル中央線と同じ位置に設定
        centerLine.style.top = tileCenterY + 'px';
    }

    // 初回調整
    adjustTitleSize();
    updateTitleCenterLine();

    // ウィンドウリサイズ時に再調整
    window.addEventListener('resize', function() {
        if (shouldSkipResize()) return;
        adjustTitleSize();
        updateTitleCenterLine();

        if (shouldUseSafeEndMode()) {
            disableHeavyEndEffects();
        }
    });
    
    // 初期位置を保存（ページ読み込み時に一度だけ取得）
    let initialPositions = [];

    // 仮想スクロール位置（拡大アニメーション用）
    let virtualScroll = 0;
    let isExpanding = true; // 拡大中フラグ
    let expansionComplete = false; // 拡大完了フラグ
    const expansionScrollAmount = 800; // 拡大完了までのスクロール量（ピクセル）
    let userNavigatedAway = false; // ユーザーが手動でセクションに移動したかどうか
    let autoWipeSystemInitialized = false;
    let autoWipeInitTimer = null;
    let autoWipeScrollHandler = null;

    // 固定背景画像の管理（拡大完了後に使用）
    const textSections = document.querySelectorAll('.text-overlay-section');
    const fixedBgContainer = document.createElement('div');
    fixedBgContainer.className = 'fixed-background';
    fixedBgContainer.style.display = 'none'; // 初期は非表示
    document.body.appendChild(fixedBgContainer);

    const bgImages = [];
    const sectionToBgMap = new Map(); // セクションインデックスと背景画像の対応
    const missileBackground = document.querySelector('.missile-background'); // ミサイル背景要素

    // ミサイルグラフィックスのpointer-events制御
    // opacity > 0.1の時だけiframeをマウスイベントに反応させる（カーソルを消す）
    function shouldEnableMainMissilePointerEvents(opacity) {
        const section1 = document.querySelector('#section-1');
        if (!section1) return false;
        const scrollY = window.pageYOffset;
        const sectionStart = section1.offsetTop;
        const sectionEnd = section1.offsetTop + section1.offsetHeight;
        return opacity > 0.1 && scrollY >= sectionStart && scrollY <= sectionEnd;
    }

    function updateMissilePointerEvents() {
        if (!missileBackground) return;
        const opacity = parseFloat(window.getComputedStyle(missileBackground).opacity) || 0;
        missileBackground.style.pointerEvents = shouldEnableMainMissilePointerEvents(opacity) ? 'auto' : 'none';
    }

    // スクロール時にpointer-eventsを更新
    window.addEventListener('scroll', updateMissilePointerEvents);

    // 初回実行
    updateMissilePointerEvents();

    textSections.forEach((section, index) => {
        const bgUrl = section.getAttribute('data-bg');
        if (bgUrl) {
            const img = document.createElement('img');
            img.src = bgUrl;
            img.setAttribute('data-section-index', index);
            fixedBgContainer.appendChild(img);
            bgImages.push(img);
            sectionToBgMap.set(index, img); // セクションインデックスと画像を紐付け
        }
    });

    function saveInitialPositions() {
        if (!tileGrid || tiles.length === 0) return;

        // スクロール位置が0であることを確認
        if (window.pageYOffset !== 0 || virtualScroll !== 0) {
            return;
        }

        tiles.forEach((tile, index) => {
            const rect = tile.getBoundingClientRect();
            initialPositions[index] = {
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top
            };
        });

        // 初期位置が保存されたらページを表示
        if (initialPositions.length > 0) {
            document.body.classList.remove('loading');
            document.body.classList.add('loaded');
        }
    }

    const section1El = document.querySelector('#section-1');
    if (section1El) {
        const s1Text = section1El.querySelector('.text-content');
        if (s1Text) {
            s1Text.style.transition = 'none';
            s1Text.style.opacity = '0';
            s1Text.style.position = 'fixed';
            s1Text.style.top = '110vh';
            s1Text.style.paddingTop = '0';
        }
    }
    // ページ読み込み後に初期位置を保存
    // ページが完全にトップにあることを確認
    window.scrollTo(0, 0);
    virtualScroll = 0;

    setTimeout(saveInitialPositions, 100);
    setTimeout(saveInitialPositions, 300);
    setTimeout(saveInitialPositions, 500);

    // 画像読み込み完了後にも保存
    window.addEventListener('load', function() {
        window.scrollTo(0, 0);
        virtualScroll = 0;
        setTimeout(saveInitialPositions, 100);
    });

    // ウィンドウリサイズ時に初期位置を再保存（トップにいる時のみ）
    window.addEventListener('resize', function() {
        if (shouldSkipResize()) return;
        if (window.pageYOffset === 0 && virtualScroll === 0) {
            saveInitialPositions();
        }
    });

    function updateTileGrid() {
        if (!heroSection || initialPositions.length === 0) return;

        // 仮想スクロール量を使用（0から1の進捗）
        const totalProgress = Math.min(Math.max(virtualScroll / expansionScrollAmount, 0), 1);

        // タイトル・サブタイトル・説明文の要素を取得
        const titleElement = heroContent.querySelector('.hero-title-dynamic');
        const subtitle = heroContent.querySelector('.hero-subtitle-dynamic');
        const description = heroContent.querySelector('.hero-description');

        // 初期状態（progress ≈ 0）の場合はすべて表示
        if (totalProgress <= 0.001) {
            // タイトルの文字をすべて表示
            const titleChars = titleElement.querySelectorAll('span');
            titleChars.forEach(char => {
                char.style.opacity = '1';
            });

            // サブタイトルの文字をすべて表示
            if (subtitle) {
                subtitle.style.animation = ''; // アニメーションを復元
                const subtitleChars = subtitle.querySelectorAll('span');
                subtitleChars.forEach(char => {
                    char.style.opacity = '1';
                });
            }

            // 説明文の文字をすべて表示
            if (description) {
                description.style.animation = ''; // アニメーションを復元
                const descriptionChars = description.querySelectorAll('span');
                descriptionChars.forEach(char => {
                    char.style.opacity = '1';
                });
            }
        } else {
            // スクロール中（progress > 0）の場合は一文字ずつフェードアウト

            // タイトルの文字を一文字ずつ左から右へ消す
            const titleChars = titleElement.querySelectorAll('span');
            const totalChars = titleChars.length;

            titleChars.forEach((char, index) => {
                // 各文字が消え始めるタイミング（0から1.0の間で均等配分）
                // 最後の文字が拡大完了時（progress=1.0）にちょうど消え終わるように調整
                const fadeStartProgress = (index / totalChars) * 0.85; // 0から0.85まで
                const fadeEndProgress = ((index + 1) / totalChars) * 0.85 + 0.15; // 0.15から1.0まで

                if (totalProgress < fadeStartProgress) {
                    char.style.opacity = '1';
                } else if (totalProgress >= fadeStartProgress && totalProgress < fadeEndProgress) {
                    const fadeProgress = (totalProgress - fadeStartProgress) / (fadeEndProgress - fadeStartProgress);
                    char.style.opacity = (1 - fadeProgress).toString();
                } else {
                    char.style.opacity = '0';
                }
            });

            // スクロール開始時にアニメーションを無効化
            if (subtitle) subtitle.style.animation = 'none';
            if (description) description.style.animation = 'none';

            // サブタイトル（動物行動戦略研究室）を一文字ずつフェードアウト
            const subtitleChars = subtitle.querySelectorAll('span');
            const subtitleCharCount = subtitleChars.length;

            subtitleChars.forEach((char, index) => {
                const fadeStartProgress = (index / subtitleCharCount) * 0.85;
                const fadeEndProgress = ((index + 1) / subtitleCharCount) * 0.85 + 0.15;

                if (totalProgress < fadeStartProgress) {
                    char.style.opacity = '1';
                } else if (totalProgress >= fadeStartProgress && totalProgress < fadeEndProgress) {
                    const fadeProgress = (totalProgress - fadeStartProgress) / (fadeEndProgress - fadeStartProgress);
                    char.style.opacity = (1 - fadeProgress).toString();
                } else {
                    char.style.opacity = '0';
                }
            });

            // 説明文（新潟大学大学院自然科学研究科 / 創生学部）を一文字ずつフェードアウト
            const descriptionChars = description.querySelectorAll('span');
            const descriptionCharCount = descriptionChars.length;

            descriptionChars.forEach((char, index) => {
                const fadeStartProgress = (index / descriptionCharCount) * 0.85;
                const fadeEndProgress = ((index + 1) / descriptionCharCount) * 0.85 + 0.15;

                if (totalProgress < fadeStartProgress) {
                    char.style.opacity = '1';
                } else if (totalProgress >= fadeStartProgress && totalProgress < fadeEndProgress) {
                    const fadeProgress = (totalProgress - fadeStartProgress) / (fadeEndProgress - fadeStartProgress);
                    char.style.opacity = (1 - fadeProgress).toString();
                } else {
                    char.style.opacity = '0';
                }
            });
        }

        const mainTile = tiles[0];
        if (!mainTile) return;

        // 初期位置とサイズ
        const initialRect = initialPositions[0];

        // ターゲット（全画面）
        const targetRect = {
            width: window.innerWidth,
            height: window.innerHeight,
            left: 0,
            top: 0
        };

        // 0-100%で拡大（フェードアウトなし）
        const expandProgress = Math.min(totalProgress, 1);

        if (totalProgress > 0.001) {
            // すべてのタイルを即座に固定位置に（チラツキ防止）
            tiles.forEach((tile, index) => {
                const rect = initialPositions[index];
                if (tile.style.position !== 'fixed') {
                    tile.style.position = 'fixed';
                    tile.style.width = rect.width + 'px';
                    tile.style.height = rect.height + 'px';
                    tile.style.left = rect.left + 'px';
                    tile.style.top = rect.top + 'px';
                    tile.style.zIndex = (index === 0) ? '100' : '10';
                }
            });

            // メインタイルの拡大アニメーション
            mainTile.style.display = 'block';

            // 位置とサイズを滑らかに補間（仮想スクロール量と完全同期）
            const currentWidth = initialRect.width + (targetRect.width - initialRect.width) * expandProgress;
            const currentHeight = initialRect.height + (targetRect.height - initialRect.height) * expandProgress;
            const currentLeft = initialRect.left + (targetRect.left - initialRect.left) * expandProgress;
            const currentTop = initialRect.top + (targetRect.top - initialRect.top) * expandProgress;

            mainTile.style.width = currentWidth + 'px';
            mainTile.style.height = currentHeight + 'px';
            mainTile.style.left = currentLeft + 'px';
            mainTile.style.top = currentTop + 'px';

            // ボーダー半径を滑らかに0に
            const borderRadius = 8 * (1 - expandProgress);
            mainTile.style.borderRadius = borderRadius + 'px';

            // 拡大アニメーション中は画像のスケールを固定（スクロールズームとの競合を防ぐ）
            const mainTileImg = mainTile.querySelector('img');
            if (mainTileImg && !expansionComplete) {
                mainTileImg.style.transform = 'scale(1)';
            }

            // フェードアウトなし（常に表示）
            mainTile.style.opacity = 1;

            // 他のタイルの表示制御（80%以降は徐々にフェードアウト）
            tiles.forEach((tile, index) => {
                if (index !== 0) {
                    if (totalProgress > 0.8) {
                        // 80%〜100%の間でフェードアウト
                        const fadeProgress = (totalProgress - 0.8) / 0.2; // 0→1
                        const opacity = 1 - fadeProgress;
                        tile.style.opacity = Math.max(0, opacity);

                        // 完全に消えたら非表示
                        if (totalProgress >= 1) {
                            tile.style.display = 'none';
                        } else {
                            tile.style.display = 'block';
                        }
                    } else {
                        tile.style.opacity = '1';
                        tile.style.display = 'block';
                    }
                }
            });

        } else {
            // 初期状態に戻す
            tiles.forEach((tile, index) => {
                tile.style.position = 'relative';
                tile.style.width = 'auto';
                tile.style.height = 'auto';
                tile.style.left = 'auto';
                tile.style.top = 'auto';
                tile.style.zIndex = 'auto';
                tile.style.opacity = '1';
                tile.style.borderRadius = '8px';
                tile.style.display = 'block'; // 再表示
                const img = tile.querySelector('img');
                if (img) {
                    img.style.transform = ''; // インラインスタイルを削除してCSSのhoverを有効化
                }
            });

            // 拡大完了フラグをリセット（逆スクロール時）
            if (expansionComplete) {
                expansionComplete = false;
                isExpanding = true;
            }
        }

        // 拡大完了判定
        if (totalProgress >= 1 && !expansionComplete) {
            expansionComplete = true;
            isExpanding = false;

            // 固定背景画像コンテナを表示
            fixedBgContainer.style.display = 'block';

            // 「そよ風」セクション通過後、メインタイルをスクロールに応じてワイプアウト
            // 初期状態ではclip-pathをリセット（完全表示）
            mainTile.style.clipPath = 'inset(0% 0 0 0)';

            // 画像のスケールをリセット（スクロールズームの開始点を1.0にする）
            const mainTileImg = mainTile.querySelector('img');
            if (mainTileImg) {
                mainTileImg.style.transform = 'scale(1)';
            }

            // タイルは常にクリック可能にする（ナビゲーションとして機能）
            tiles.forEach((tile, index) => {
                tile.style.pointerEvents = 'auto';
            });

            if (autoWipeSystemInitialized) {
                return;
            }
            autoWipeSystemInitialized = true;

            if (autoWipeInitTimer) {
                clearTimeout(autoWipeInitTimer);
                autoWipeInitTimer = null;
            }

            autoWipeInitTimer = setTimeout(() => {
                autoWipeInitTimer = null;
                // 背景レイヤーを持つ全セクションを収集（mainTileも含む）
                const sectionsWithBg = [];

                // セクション1（#section-1）: mainTileを使用
                const purposeSection = document.querySelector('#section-1');
                if (purposeSection && mainTile) {
                    sectionsWithBg.push({
                        section: purposeSection,
                        bgElement: mainTile,
                        textElement: purposeSection.querySelector('.text-content'),
                        isMainTile: true
                    });
                }

                // .section-bg-layerを持つ全セクションを追加
                document.querySelectorAll('.section-bg-layer').forEach((bgLayer, index) => {
                    const sectionId = bgLayer.getAttribute('data-section-id');
                    if (sectionId) {
                        const section = document.getElementById(sectionId);
                        if (section) {
                            // z-indexを自動計算: 後方のセクションほど大きく（注: オーバーラップ方式ではclipPathで制御するため、z-index順序は動作に影響しない）
                            const autoZIndex = 101 + index;
                            bgLayer.style.zIndex = autoZIndex;

                            // 初期状態を設定: 完全に隠す（ワイプイン用）
                            bgLayer.style.opacity = '0';
                            bgLayer.style.clipPath = 'inset(100% 0 0 0)';

                            sectionsWithBg.push({
                                section: section,
                                bgElement: bgLayer,
                                textElement: section.querySelector('.text-content'),
                                isMainTile: false
                            });
                        }
                    }
                });

                // 自動ワイプエフェクトシステム
                let lastAutoWipeScrollY = window.pageYOffset;
                const wipeProgressHighWaterBySectionId = new Map();
                function updateAutoWipeEffects() {
                    const windowHeight = window.innerHeight;
                    const triggerStart = windowHeight;
                    const triggerEnd = windowHeight * 0.2;
                    const currentAutoWipeScrollY = window.pageYOffset;
                    const isScrollingUp = currentAutoWipeScrollY < lastAutoWipeScrollY;
                    const WIPE_REVERSE_JITTER_EPSILON = 0.02;
                    const WIPE_MAX_REVERSE_STEP = 0.035;

                    function applyWipeHighWater(sectionId, nextRect, rawProgress) {
                        const protectedIds = new Set(['section-2-topics', 'section-3', 'section-4', 'section-5', 'section-6', 'section-7']);
                        if (!protectedIds.has(sectionId)) return rawProgress;

                        if (nextRect.top >= windowHeight) {
                            wipeProgressHighWaterBySectionId.set(sectionId, 0);
                            return 0;
                        }

                        const prevMax = wipeProgressHighWaterBySectionId.get(sectionId) || 0;
                        const isCreditsSection = sectionId === 'section-7';
                        const reverseJitterEpsilon = isCreditsSection ? 0.04 : WIPE_REVERSE_JITTER_EPSILON;
                        const maxReverseStep = isCreditsSection ? 0.02 : WIPE_MAX_REVERSE_STEP;
                        if (!isScrollingUp) {
                            const nextMax = Math.max(prevMax, rawProgress);
                            wipeProgressHighWaterBySectionId.set(sectionId, nextMax);
                            return nextMax;
                        }

                        // 微小な逆方向入力（モバイル慣性）だけ吸収し、
                        // しっかり逆スクロールしたら高水位を解除して前の背景を再表示する
                        if (rawProgress >= prevMax - reverseJitterEpsilon) {
                            return prevMax;
                        }

                        // クレジット初回到達時は慣性の揺り戻しで最背面が見えやすい。
                        // ほぼ表示完了している間は、十分に上へ戻るまで高水位を保持する。
                        if (isCreditsSection && prevMax > 0.9 && nextRect.top < windowHeight * 0.6) {
                            return prevMax;
                        }

                        // クレジット到達直後は慣性の揺り戻しが出やすいので、上端付近では解除を遅らせる
                        if (isCreditsSection && nextRect.top < windowHeight * 0.2) {
                            return prevMax;
                        }

                        // 逆スクロール時は一気に解除せず段階的に戻す（カクつき防止）
                        const releasedProgress = Math.max(rawProgress, prevMax - maxReverseStep);
                        wipeProgressHighWaterBySectionId.set(sectionId, releasedProgress);
                        return releasedProgress;
                    }

                    // 隣接するセクション間でワイプエフェクトを適用
                    for (let i = 0; i < sectionsWithBg.length - 1; i++) {
                        const currentItem = sectionsWithBg[i];
                        const nextItem = sectionsWithBg[i + 1];

                        // セクション2→3の特別処理: 黄色枠の下端を基準にワイプ
                        if (nextItem.section.id === 'section-3' && currentItem.section.id === 'section-2') {
                            const section2 = currentItem.section;
                            const yellowBox = section2.querySelector('.yellow-box');
                            const nextRect = nextItem.section.getBoundingClientRect();

                            let wipeProgress = 0;

                            if (yellowBox) {
                                // 黄色枠の下端位置を取得
                                const yellowBoxRect = yellowBox.getBoundingClientRect();
                                const yellowBoxBottom = yellowBoxRect.bottom;

                                // 黄色枠の下端に15vhのオフセットを加える
                                const buffer = windowHeight * 0.15;  // 15vhのバッファ
                                const adjustedBottom = yellowBoxBottom + buffer;  // 15vh下に余裕を持たせる

                                // 調整後の位置を基準にワイプ進行度を計算（画面下端100vh → 画面上端0vhで完了）
                                const customTriggerStart = windowHeight;  // 100vh (画面下端)
                                const customTriggerEnd = 0;                // 0vh (画面上端)

                                if (adjustedBottom <= customTriggerStart && adjustedBottom >= customTriggerEnd) {
                                    wipeProgress = (customTriggerStart - adjustedBottom) / (customTriggerStart - customTriggerEnd);
                                    wipeProgress = Math.max(0, Math.min(1, wipeProgress));
                                } else if (adjustedBottom < customTriggerEnd) {
                                    wipeProgress = 1;
                                } else if (adjustedBottom > customTriggerStart) {
                                    wipeProgress = 0;
                                }
                            } else {
                                // フォールバック: 黄色枠が見つからない場合は従来方式
                                if (nextRect.top <= triggerStart && nextRect.top >= triggerEnd) {
                                    wipeProgress = (triggerStart - nextRect.top) / (triggerStart - triggerEnd);
                                    wipeProgress = Math.max(0, Math.min(1, wipeProgress));
                                } else if (nextRect.top < triggerEnd) {
                                    wipeProgress = 1;
                                } else if (nextRect.top > triggerStart) {
                                    wipeProgress = 0;
                                }
                            }

                            wipeProgress = applyWipeHighWater(nextItem.section.id, nextRect, wipeProgress);
                            const clipValue = wipeProgress * 100;
                            const wipeInClipValue = 100 - clipValue;

                            if (wipeProgress >= 0 && nextItem.bgElement) {
                                nextItem.bgElement.style.opacity = '1';
                                nextItem.bgElement.style.clipPath = `inset(${wipeInClipValue}% 0 0 0)`;
                            }

                        } else if ((nextItem.section.id === 'section-4' && currentItem.section.id === 'section-3') ||
                                   (nextItem.section.id === 'section-5' && currentItem.section.id === 'section-4') ||
                                   (nextItem.section.id === 'section-6' && currentItem.section.id === 'section-5') ||
                                   (nextItem.section.id === 'section-7' && currentItem.section.id === 'section-6')) {
                            // 後半セクションは next セクション自身の位置基準でワイプ
                            // （前セクション本文下端依存だと文字量/端末差でズレやジャンプが起きやすい）
                            let wipeProgress = 0;
                            const nextRect = nextItem.section.getBoundingClientRect();
                            const customTriggerStart = windowHeight;
                            const customTriggerEnd = 0;

                            if (nextRect.top <= customTriggerStart && nextRect.top >= customTriggerEnd) {
                                wipeProgress = (customTriggerStart - nextRect.top) / (customTriggerStart - customTriggerEnd);
                                wipeProgress = Math.max(0, Math.min(1, wipeProgress));
                            } else if (nextRect.top < customTriggerEnd) {
                                wipeProgress = 1;
                            } else if (nextRect.top > customTriggerStart) {
                                wipeProgress = 0;
                            }

                            // 後半セクションのモバイルちらつき対策（高水位ヒステリシス）
                            wipeProgress = applyWipeHighWater(nextItem.section.id, nextRect, wipeProgress);

                            const clipValue = wipeProgress * 100;
                            const wipeInClipValue = 100 - clipValue;

                            if (wipeProgress >= 0 && nextItem.bgElement) {
                                nextItem.bgElement.style.opacity = '1';
                                nextItem.bgElement.style.clipPath = `inset(${wipeInClipValue}% 0 0 0)`;
                            }

                        } else {
                            // 通常のワイプ処理（他のセクション遷移）
                            const nextRect = nextItem.section.getBoundingClientRect();

                            // ワイプ進行度の計算
                            let wipeProgress = 0;
                            if (nextRect.top <= triggerStart && nextRect.top >= triggerEnd) {
                                wipeProgress = (triggerStart - nextRect.top) / (triggerStart - triggerEnd);
                                wipeProgress = Math.max(0, Math.min(1, wipeProgress));
                            } else if (nextRect.top < triggerEnd) {
                                wipeProgress = 1;
                            } else if (nextRect.top > triggerStart) {
                                // 画面外下方に出た場合、完全非表示にする
                                wipeProgress = 0;
                            }

                            wipeProgress = applyWipeHighWater(nextItem.section.id, nextRect, wipeProgress);
                            const clipValue = wipeProgress * 100;
                            const wipeInClipValue = 100 - clipValue;

                            // wipeProgress >= 0の時に適用（wipeProgress = 0の時も確実に100%非表示にする）
                            if (wipeProgress >= 0) {
                                // オーバーラップ方式: 次のセクションのワイプインのみ（前のセクションはワイプアウトしない）
                                if (nextItem.bgElement) {
                                    // opacity制御
                                    nextItem.bgElement.style.opacity = '1';

                                    // ワイプイン: 下から上へ
                                    nextItem.bgElement.style.clipPath = `inset(${wipeInClipValue}% 0 0 0)`;
                                }
                            }
                        }
                    }

                    // ズームエフェクト処理（全セクション独立）
                    for (let i = 0; i < sectionsWithBg.length; i++) {
                        if (isMobileViewport() || reduceMotionQuery.matches) break;
                        const item = sectionsWithBg[i];
                        const itemRect = item.section.getBoundingClientRect();

                        if (itemRect.bottom > 0 && itemRect.top < windowHeight) {
                            const sectionProgress = Math.max(0, Math.min(1,
                                (windowHeight - itemRect.top) / (windowHeight + itemRect.height)
                            ));
                            const scale = 1.0 + (sectionProgress * 0.2); // 1.0 → 1.2 ズームイン

                            if (item.isMainTile) {
                                // 先頭ヒーローは拡大演出自体があるため、背景ワイプ側のズームは重ねない
                                const mainTileImg = mainTile.querySelector('img');
                                if (mainTileImg) {
                                    mainTileImg.style.transform = 'scale(1)';
                                }
                            } else if (item.bgElement) {
                                item.bgElement.style.transform = `scale(${scale})`;
                                item.bgElement.style.transformOrigin = 'center center';
                            }
                        }
                    }

                    lastAutoWipeScrollY = currentAutoWipeScrollY;
                }

                let autoWipeRAFPending = false;
                if (autoWipeScrollHandler) {
                    window.removeEventListener('scroll', autoWipeScrollHandler);
                }
                autoWipeScrollHandler = function() {
                    if (!autoWipeRAFPending) {
                        autoWipeRAFPending = true;
                        requestAnimationFrame(() => { updateAutoWipeEffects(); autoWipeRAFPending = false; });
                    }
                };
                window.addEventListener('scroll', autoWipeScrollHandler);
                updateAutoWipeEffects(); // 初期実行

                // リサイズイベント: 拡大完了後のタイルサイズを更新（幅変更時のみ）
                let lastTileResizeWidth = window.innerWidth;
                window.addEventListener('resize', () => {
                    const newWidth = window.innerWidth;
                    if (newWidth === lastTileResizeWidth) return;
                    lastTileResizeWidth = newWidth;

                    if (expansionComplete && mainTile) {
                        mainTile.style.width = window.innerWidth + 'px';
                        mainTile.style.height = cachedWindowHeight + 'px'; // Use cached height
                        mainTile.style.left = '0px';
                        mainTile.style.top = '0px';
                    }
                });
            }, 100);
        }
    }

    // ホイールイベント（拡大/縮小のスクロール制御）
    let lastWheelTime = 0;
    window.addEventListener('wheel', function(e) {
        // 拡大完了後、ヒーローより下にいる場合は即座にreturn
        // （passive:falseハンドラーのため、メインスレッドブロックを最小化）
        // scrollY===0の場合は逆スクロールによる再拡大の可能性があるため除外
        if (expansionComplete && !isExpanding && window.pageYOffset > 0) return;

        const now = Date.now();
        const scrollY = window.pageYOffset;
        const heroExitY = heroSection ? Math.max(0, heroSection.offsetHeight - window.innerHeight) : 0;

        // ヒーロー通過後は拡大用ホイール制御を強制終了して通常スクロールを優先
        if (scrollY > heroExitY) {
            if (!expansionComplete) {
                virtualScroll = expansionScrollAmount;
                isExpanding = false;
                updateTileGrid();
                if (virtualScroll >= expansionScrollAmount) {
                    expansionComplete = true;
                }
            }
            return;
        }

        // トップに戻ってきた場合、userNavigatedAwayをリセット
        if (userNavigatedAway && scrollY === 0) {
            userNavigatedAway = false;
        }

        // ユーザーが手動でセクションに移動した後は、拡大エフェクトを無効化
        if (userNavigatedAway) {
            return;
        }

        // 拡大中または拡大完了後の上スクロール
        if ((isExpanding && virtualScroll < expansionScrollAmount) ||
            (!isExpanding && virtualScroll > 0 && e.deltaY < 0 && scrollY === 0)) {

            console.warn('[HERO-WHEEL] *** e.preventDefault() CALLED ***',
                'isExpanding:', isExpanding, 'virtualScroll:', virtualScroll, 'deltaY:', e.deltaY);
            // 実際のスクロールを防止
            e.preventDefault();

            // 仮想スクロール量を更新（デルタ値を累積、双方向）
            const prevVirtualScroll = virtualScroll;
            virtualScroll += e.deltaY;
            virtualScroll = Math.max(0, Math.min(virtualScroll, expansionScrollAmount));

            // virtualScrollが0に到達した場合、タイトルの不透明度をリセット
            if (virtualScroll === 0 && prevVirtualScroll > 0) {
                updateTileGrid();
            }

            // 逆スクロールで拡大モードに戻る
            if (!isExpanding && virtualScroll < expansionScrollAmount && e.deltaY < 0) {
                isExpanding = true;
                expansionComplete = false;
            }

            // アニメーション更新
            updateTileGrid();

            // 同一入力で完了した場合に即座に通常スクロールへ移る（2回目のズーム感を防ぐ）
            if (virtualScroll >= expansionScrollAmount) {
                isExpanding = false;
                expansionComplete = true;
            }

        } else if (virtualScroll >= expansionScrollAmount && e.deltaY > 0) {
            // 拡大完了：下スクロールで通常スクロールを許可
            isExpanding = false;
        }

        lastWheelTime = now;
    }, { passive: false });

    // タッチスクロール対応（慣性スクロール付き）
    let touchStartY = 0;
    let touchCurrentY = 0;
    let touchVelocity = 0;
    let inertiaAnimationId = null;
    let lastTouchTime = 0;
    let lastTouchMoveAt = 0;
    let touchRAFPending = false;
    const useCustomTouchExpansion = false;

    window.addEventListener('touchstart', function(e) {
        if (!useCustomTouchExpansion) return;
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        touchVelocity = 0;
        lastTouchTime = Date.now();
        lastTouchMoveAt = 0;

        // 慣性スクロールを停止
        if (inertiaAnimationId) {
            cancelAnimationFrame(inertiaAnimationId);
            inertiaAnimationId = null;
        }
    }, { passive: true });

    window.addEventListener('touchmove', function(e) {
        if (!useCustomTouchExpansion) return;
        const scrollY = window.pageYOffset;
        const heroExitY = heroSection ? Math.max(0, heroSection.offsetHeight - window.innerHeight) : 0;
        const prevY = touchCurrentY;
        touchCurrentY = e.touches[0].clientY;
        const instantDelta = prevY - touchCurrentY;
        const isSwipingUp = instantDelta > 0;
        const isSwipingDown = instantDelta < 0;

        // ヒーロー通過後は拡大用タッチ制御を強制終了して通常スクロールを優先
        if (scrollY > heroExitY) {
            if (!expansionComplete) {
                virtualScroll = expansionScrollAmount;
                isExpanding = false;
                updateTileGrid();
                if (virtualScroll >= expansionScrollAmount) {
                    expansionComplete = true;
                }
            }
            return;
        }

        // 拡大中または拡大完了後の上スワイプ
        if ((isExpanding && virtualScroll < expansionScrollAmount) ||
            (!isExpanding && virtualScroll > 0 && isSwipingDown && scrollY <= 1)) {

            e.preventDefault();

            virtualScroll += instantDelta * 2.5; // タッチは感度を上げる（モバイル最適化）
            virtualScroll = Math.max(0, Math.min(virtualScroll, expansionScrollAmount));

            // 速度を記録（慣性用）
            const now = Date.now();
            const timeDelta = now - lastTouchTime;
            if (timeDelta > 0 && timeDelta < 100) { // 直近移動のみ慣性速度として採用
                touchVelocity = instantDelta * 2.5; // フレームごとの移動量
                lastTouchMoveAt = now;
            } else {
                // 古い速度を持ち越すと逆方向切り返し時に一瞬ジャンプするため破棄
                touchVelocity = 0;
                lastTouchMoveAt = 0;
            }
            lastTouchTime = now;

            // 逆スワイプで拡大モードに戻る
            if (!isExpanding && virtualScroll < expansionScrollAmount && isSwipingDown) {
                isExpanding = true;
                expansionComplete = false;
            }

            if (!touchRAFPending) {
                touchRAFPending = true;
                requestAnimationFrame(() => { updateTileGrid(); touchRAFPending = false; });
            }

        } else if (virtualScroll >= expansionScrollAmount && isSwipingUp) {
            isExpanding = false;
        }
    }, { passive: true });

    window.addEventListener('touchend', function() {
        if (!useCustomTouchExpansion) {
            lastTouchMoveAt = 0;
            return;
        }
        const now = Date.now();
        const isRecentMove = lastTouchMoveAt > 0 && (now - lastTouchMoveAt) < 80;
        // 慣性スクロールを開始
        if (isRecentMove && Math.abs(touchVelocity) > 1 && isExpanding && virtualScroll < expansionScrollAmount) {
            const startInertia = () => {
                if (Math.abs(touchVelocity) < 0.5) {
                    inertiaAnimationId = null;
                    return;
                }

                virtualScroll += touchVelocity;
                virtualScroll = Math.max(0, Math.min(virtualScroll, expansionScrollAmount));

                // 減衰
                touchVelocity *= 0.95;

                updateTileGrid();

                if (virtualScroll < expansionScrollAmount && Math.abs(touchVelocity) >= 0.5) {
                    inertiaAnimationId = requestAnimationFrame(startInertia);
                } else {
                    inertiaAnimationId = null;
                }
            };
            inertiaAnimationId = requestAnimationFrame(startInertia);
        }
        lastTouchMoveAt = 0;
    }, { passive: true });

    // Safari判定（必要時のブラウザ差分対応用）
    const ua = navigator.userAgent || '';
    const isSafariBrowser = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg\//.test(ua);
    if (isSafariBrowser) {
        document.body.classList.add('safari-browser');
    }

    // 通常のスクロールイベント（拡大完了後）
    let ticking = false;
    let lastScrollY = 0;
    let isResetting = false;

    window.addEventListener('scroll', function() {
        const scrollY = window.pageYOffset;
        const heroExitY = heroSection ? Math.max(0, heroSection.offsetHeight - window.innerHeight) : 0;

        // タッチ/ドラッグ主体の環境では wheel/touch の独自拡大制御を通らないため、
        // ヒーロー通過時にスクロールイベント側でも拡大完了と背景ワイプ初期化を保証する。
        if (scrollY > heroExitY && !expansionComplete && !isResetting) {
            virtualScroll = expansionScrollAmount;
            isExpanding = false;
            updateTileGrid();
            if (virtualScroll >= expansionScrollAmount) {
                expansionComplete = true;
            }
        }

        // トップに戻ったときに拡大エフェクトをリセット
        // 拡大完了直後（scrollY=0のまま）に即リセットして二重ズームになるのを防ぐ。
        // 一度でも実スクロールで下へ移動した後にトップへ戻った場合のみリセットする。
        if (scrollY === 0 && lastScrollY > 0 && expansionComplete && virtualScroll > 0 && !isResetting) {
            isResetting = true;
            virtualScroll = 0;
            isExpanding = true;
            expansionComplete = false;
            initialPositions = [];
            autoWipeSystemInitialized = false;
            if (autoWipeInitTimer) {
                clearTimeout(autoWipeInitTimer);
                autoWipeInitTimer = null;
            }

            // タイルを初期状態に戻す
            tiles.forEach((tile) => {
                tile.style.position = 'relative';
                tile.style.width = 'auto';
                tile.style.height = 'auto';
                tile.style.left = 'auto';
                tile.style.top = 'auto';
                tile.style.zIndex = 'auto';
                tile.style.opacity = '1';
                tile.style.borderRadius = '8px';
                tile.style.display = 'block';
                const img = tile.querySelector('img');
                if (img) img.style.transform = '';
            });

            if (autoWipeScrollHandler) {
                window.removeEventListener('scroll', autoWipeScrollHandler);
                autoWipeScrollHandler = null;
            }

            // タイトル表示を復元（virtualScroll = 0 になったので updateTileGrid を呼ぶ）
            updateTileGrid();

            // DOM更新後に初期位置を保存
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (window.pageYOffset !== 0) window.scrollTo(0, 0);
                    tiles.forEach((tile, index) => {
                        const rect = tile.getBoundingClientRect();
                        initialPositions[index] = {
                            width: rect.width,
                            height: rect.height,
                            left: rect.left,
                            top: rect.top
                        };
                    });
                    // 初期位置を再取得できた後にヒーロー文言の表示状態も復元する
                    updateTileGrid();
                    isResetting = false;
                    lastScrollY = 0;
                });
            });
        }

        // スクロールによる拡大エフェクト（ホイール以外の入力対応、双方向対応）
        if (isExpanding && scrollY > 0 && scrollY <= heroExitY && virtualScroll < expansionScrollAmount &&
            initialPositions.length > 0 && !isResetting) {
            const deltaScroll = scrollY - lastScrollY;
            virtualScroll += deltaScroll;
            virtualScroll = Math.max(0, Math.min(virtualScroll, expansionScrollAmount));
            updateTileGrid();
            if (virtualScroll >= expansionScrollAmount) {
                isExpanding = false;
                expansionComplete = true;
            }
        }

        lastScrollY = scrollY;

        if (!isExpanding && !ticking) {
            window.requestAnimationFrame(function() {
                // 拡大完了後のスクロール処理
                ticking = false;
            });
            ticking = true;
        }
    });

    // 初期実行
    updateTileGrid();

    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.2,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // 全てのコンテンツセクションを監視
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        observer.observe(section);
    });

    // 画像ズームアップ効果（スクロールに連動）
    const zoomImages = document.querySelectorAll('.zoom-on-scroll');
    
    window.addEventListener('scroll', function() {

        if (shouldUseSafeEndMode()) {
            document.querySelectorAll('.zoom-on-scroll').forEach(img => {
                img.style.transform = 'none';
            });
            return;
        }

        zoomImages.forEach(img => {
            const rect = img.getBoundingClientRect();
            const windowHeight = cachedWindowHeight;

            // 画面内に入ったときの計算
            if (rect.top < windowHeight && rect.bottom > 0) {
                const scrollProgress = (windowHeight - rect.top) / (windowHeight + rect.height);
                const scale = 1 + (scrollProgress * 0.3); // 最大1.3倍まで拡大

                img.style.transform = `scale(${Math.min(scale, 1.3)})`;
            }
        });
    });

    // パララックス効果
    const parallaxElements = document.querySelectorAll('.parallax');

    window.addEventListener('scroll', function() {
        if (isMobileViewport() || reduceMotionQuery.matches) return;

        if (shouldUseSafeEndMode()) {
            parallaxElements.forEach(element => {
                element.style.transform = 'none';
            });
            return;
        }

        const scrolled = window.pageYOffset;

        parallaxElements.forEach(element => {
            const speed = element.dataset.speed || 0.5;
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    });

    // ヘッダーの背景変化
    const header = document.querySelector('.header');
    const nav = document.querySelector('.main-nav');

    if (header && nav) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 100) {
                header.classList.add('scrolled');
                nav.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
                nav.classList.remove('scrolled');
            }
        });
    }

    // スムーススクロール
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));

            if (target) {
                const headerOffset = 140;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 画像の遅延読み込み完了後のフェードイン
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');

    lazyImages.forEach(img => {
        img.addEventListener('load', function() {
            this.classList.add('loaded');
        });
    });

    // テキストアニメーション（文字を一つずつ表示）
    const animatedTexts = document.querySelectorAll('.animated-text');

    const textObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                textObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    animatedTexts.forEach(text => {
        textObserver.observe(text);
    });

    // ホバーエフェクト強化
    const mediaContainers = document.querySelectorAll('.section-media');

    mediaContainers.forEach(container => {
        container.addEventListener('mouseenter', function() {
            this.querySelector('.media-placeholder, img')?.classList.add('hovered');
        });

        container.addEventListener('mouseleave', function() {
            this.querySelector('.media-placeholder, img')?.classList.remove('hovered');
        });
    });

    // ヒーローセクションのパララックス
    const hero = document.querySelector('.hero-image');

    if (hero) {
        window.addEventListener('scroll', function() {
            if (isMobileViewport() || reduceMotionQuery.matches) return;

            if (shouldUseSafeEndMode()) {
                hero.style.transform = 'none';
                return;
            }

            const scrolled = window.pageYOffset;
            const parallax = scrolled * 0.5;
            hero.style.transform = `translateY(${parallax}px)`;
        });
    }

    // スクロール進捗インジケーター（オプション）
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', function() {
        const windowHeight = cachedWindowHeight; // Use cached height
        const documentHeight = document.documentElement.scrollHeight - windowHeight;
        const scrolled = (window.pageYOffset / documentHeight) * 100;
        progressBar.style.width = scrolled + '%';
    });

    let lastTextMotionScrollY = window.pageYOffset;
    const lastSectionTopById = new Map();
    const section2TimelineCache = new WeakMap();

    function stabilizeSectionTop(sectionId, proposedTopVh, currentScrollY) {
        const prevTop = lastSectionTopById.get(sectionId);
        const scrollDelta = currentScrollY - lastTextMotionScrollY;
        let nextTop = proposedTopVh;

        if (typeof prevTop === 'number') {
            // 下スクロール中に要素が下方向へ戻る/上スクロール中に上方向へ進む逆流を抑止
            if (scrollDelta > 0 && nextTop > prevTop) nextTop = prevTop;
            if (scrollDelta < 0 && nextTop < prevTop) nextTop = prevTop;
        }

        lastSectionTopById.set(sectionId, nextTop);
        return nextTop;
    }

    function resetSectionTop(sectionId) {
        lastSectionTopById.delete(sectionId);
    }

    function pinSectionTop(sectionId, topVh) {
        lastSectionTopById.set(sectionId, topVh);
    }

    function getSection2TimelineConfig(section) {
        let cached = section2TimelineCache.get(section);
        if (cached) return cached;

        const events = [];
        for (const key in section.dataset) {
            if (!key.startsWith('timeline')) continue;

            const coeff = parseFloat(section.dataset[key]);
            if (!Number.isFinite(coeff)) continue;

            const eventName = key.replace('timeline', '');
            const kebabName = eventName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
            events.push({
                name: kebabName,
                coeff,
                nextIndex: -1,
                layer: null,
                isLayerEvent: false,
                usesEffectProgress: false
            });
        }
        events.sort((a, b) => a.coeff - b.coeff);

        for (let i = 0; i < events.length; i++) {
            for (let j = i + 1; j < events.length; j++) {
                if (events[j].coeff > events[i].coeff) {
                    events[i].nextIndex = j;
                    break;
                }
            }
        }

        const animatedLayerMap = new Map();
        section.querySelectorAll('.cyber-layer-animated').forEach((layer) => {
            const layerId = (layer.alt || '').replace('レイヤー', '');
            if (layerId) animatedLayerMap.set(layerId, layer);
        });

        events.forEach((event) => {
            if (/^\d+-\d+$/.test(event.name)) {
                event.isLayerEvent = true;
                event.layer = animatedLayerMap.get(event.name) || null;
                if (event.layer) {
                    const order = parseInt(event.layer.dataset.order, 10);
                    event.usesEffectProgress = order >= 1 && order <= 12;
                }
            }
        });

        const keyEventIndices = {
            textStart: -1,
            titleStop: -1,
            resumeStart: -1
        };
        events.forEach((event, index) => {
            if (event.name === 'text-start') keyEventIndices.textStart = index;
            else if (event.name === 'title-stop') keyEventIndices.titleStop = index;
            else if (event.name === 'resume-start') keyEventIndices.resumeStart = index;
        });

        cached = {
            events,
            keyEventIndices,
            blueVioletBox: section.querySelector('.blue-violet-box'),
            section3: document.getElementById('section-3'),
            runtimeEvents: events.map((event) => ({
                name: event.name,
                coeff: event.coeff,
                nextIndex: event.nextIndex,
                layer: event.layer,
                isLayerEvent: event.isLayerEvent,
                usesEffectProgress: event.usesEffectProgress,
                scrollPos: 0
            }))
        };
        section2TimelineCache.set(section, cached);
        return cached;
    }

    function applyNormalFlowText(sectionText, sectionId) {
        if (!sectionText) return;
        sectionText.style.opacity = '1';
        sectionText.style.position = 'relative';
        sectionText.style.top = 'auto';
        sectionText.style.left = 'auto';
        sectionText.style.transform = 'none';
        sectionText.style.height = 'auto';
        sectionText.style.paddingTop = '';
        resetSectionTop(sectionId);
    }

    function applyStickyFlowText(sectionText, sectionId, windowHeight, sectionRect) {
        if (!sectionText) return;
        const isVisible = sectionRect.bottom > 0 && sectionRect.top < windowHeight;
        sectionText.style.opacity = isVisible ? '1' : '0';
        sectionText.style.position = 'sticky';
        sectionText.style.top = '10vh';
        sectionText.style.left = 'auto';
        sectionText.style.transform = 'none';
        sectionText.style.height = 'auto';
        sectionText.style.paddingTop = '';
        resetSectionTop(sectionId);
    }

    function getSection2BlueVioletCenterTopVh(sectionText, blueVioletBoxRect, windowHeight, fallbackTopVh) {
        if (!sectionText || !blueVioletBoxRect) return fallbackTopVh;
        const textContentRect = sectionText.getBoundingClientRect();
        const wrapperCenterRelativeToText =
            ((blueVioletBoxRect.top + blueVioletBoxRect.bottom) / 2 - textContentRect.top) / windowHeight * 100;
        return 50 - wrapperCenterRelativeToText;
    }

    const staticFadeSectionIds = new Set(['section-3', 'section-4', 'section-5', 'section-6', 'section-7']);
    function isStaticFadeSection(sectionId) {
        return staticFadeSectionIds.has(sectionId);
    }

    function updateSectionParagraphFade(section, rect, windowHeight) {
        const textParagraphs = section.querySelectorAll('.content-with-images > p');
        if (textParagraphs.length === 0) return;

        if (isStaticFadeSection(section.id)) {
            textParagraphs.forEach((p) => {
                p.classList.remove('fade-hidden');
                p.classList.add('fade-visible');
            });
            return;
        }

        const textTrigger = windowHeight * 0.7;
        const isInViewport = rect.top <= textTrigger && rect.bottom > windowHeight * 0.3;

        textParagraphs.forEach((p) => {
            if (isInViewport) {
                p.classList.remove('fade-hidden');
                p.classList.add('fade-visible');
            } else {
                p.classList.remove('fade-visible');
                p.classList.add('fade-hidden');
            }
        });
    }

    function updateSectionTitleFade(section, rect, windowHeight) {
        const sectionTitle = section.querySelector('.section-title-animated');
        if (!sectionTitle) return;

        if (isStaticFadeSection(section.id)) {
            const titleChars = sectionTitle.querySelectorAll('span');
            titleChars.forEach(char => {
                char.classList.remove('fade-hidden');
                char.classList.add('fade-visible');
            });
            return;
        }

        const titleChars = sectionTitle.querySelectorAll('span');
        const titleTrigger = windowHeight * 0.8;

        if (rect.top <= titleTrigger) {
            const scrollDistance = titleTrigger - rect.top;
            const totalDistance = windowHeight * 0.8;
            const titleProgress = Math.max(0, Math.min(1, scrollDistance / totalDistance));

            titleChars.forEach((char, index) => {
                const charThreshold = index / titleChars.length;
                if (titleProgress >= charThreshold) {
                    char.classList.remove('fade-hidden');
                    char.classList.add('fade-visible');
                } else {
                    char.classList.remove('fade-visible');
                    char.classList.add('fade-hidden');
                }
            });
        } else {
            titleChars.forEach(char => {
                char.classList.remove('fade-visible');
                char.classList.add('fade-hidden');
            });
        }
    }

    function applyLateMissileFadeSectionTextFlow(section, sectionText, currentScroll, windowHeight) {
        if (!sectionText) return false;

        if (section.id === 'section-2-topics') {
            applyNormalFlowText(sectionText, section.id);
            return true;
        }

        if (section.id === 'section-3') {
            const sectionRect = section.getBoundingClientRect();
            applyStickyFlowText(sectionText, section.id, windowHeight, sectionRect);
            return true;
        }

        if (section.id === 'section-4' || section.id === 'section-5' ||
            section.id === 'section-6' || section.id === 'section-7') {
            applyNormalFlowText(sectionText, section.id);
            return true;
        }

        return false;
    }

    function updateMissileFadeSectionBackground(section, sectionOffsetTop, currentScroll, windowHeight) {
        const sectionMissile = section.querySelector('.missile-background');
        if (!sectionMissile) return;

        let missileOpacity = 0;
        const missileStart = sectionOffsetTop + windowHeight * 0.1;
        const missileEnd = sectionOffsetTop + windowHeight * 0.5;

        if (currentScroll < missileStart) {
            missileOpacity = 0;
        } else if (currentScroll >= missileStart && currentScroll <= missileEnd) {
            const progress = (currentScroll - missileStart) / (missileEnd - missileStart);
            missileOpacity = Math.max(0, Math.min(1.0, progress * 1.0));
        } else {
            missileOpacity = 1.0;
        }

        sectionMissile.style.opacity = missileOpacity;
        sectionMissile.style.pointerEvents = 'none';
    }

    function updateSection1Timeline(section, currentScroll, windowHeight) {
        const heroHeight = windowHeight * 1.8;
        const textStartCoeff = parseFloat(
        section.dataset.timelineTextStart || "1.0",
        );
        const missileStartCoeff = parseFloat(
        section.dataset.timelineMissileStart || "2.0",
        );
        const missileEndCoeff = parseFloat(
        section.dataset.timelineMissileEnd || "3.0",
        );
        const wipeStartCoeff = parseFloat(
        section.dataset.timelineWipeStart || "4.0",
        );

        const timeline = {
        textStart: heroHeight * textStartCoeff,
        missileStart: heroHeight * missileStartCoeff,
        missileEnd: heroHeight * missileEndCoeff,
        wipeStart: heroHeight * wipeStartCoeff,
        };

        const sectionPhase =
        currentScroll < timeline.textStart
            ? 0
            : currentScroll < timeline.missileStart
            ? 1
            : currentScroll < timeline.missileEnd
                ? 2
                : currentScroll < timeline.wipeStart
                ? 3
                : 4;

        const purposeText = section.querySelector(".text-content");
        if (purposeText) {
        const MOVE_SPEED_RATIO = 112.5;
        switch (sectionPhase) {
            case 0:
            purposeText.style.transition = "none";
            purposeText.style.visibility = "hidden";
            purposeText.style.opacity = "0";
            purposeText.style.position = "fixed";
            purposeText.style.top = "110vh";
            purposeText.style.paddingTop = "0";
            break;
            case 1: {
            purposeText.style.transition = "none";
            purposeText.style.visibility = "visible";
            purposeText.style.transition = "none";
            const fadeProgress = Math.min(
                1,
                (currentScroll - timeline.textStart) / (windowHeight * 0.2),
            );
            purposeText.style.opacity = String(fadeProgress);
            purposeText.style.position = "fixed";
            const scrollDistance =
                (currentScroll - timeline.textStart) / windowHeight;
            const minTop = window.innerWidth <= 768 ? 3 : 10;
            let topPosition = 100 - scrollDistance * MOVE_SPEED_RATIO;
            if (topPosition < minTop) topPosition = minTop;
            purposeText.style.top = `${topPosition}vh`;
            purposeText.style.paddingTop = "0";
            break;
            }
            default:
            purposeText.style.transition = "none";
            purposeText.style.position = "fixed";
            purposeText.style.top = window.innerWidth <= 768 ? "3vh" : "10vh";
            purposeText.style.paddingTop = "0";
            if (sectionPhase >= 4) {
                // Phase 4: wipe has started — fade the text out as user scrolls into next section
                const fadeOutDuration = windowHeight * 0.3;
                const fadeOutProgress = Math.min(1, (currentScroll - timeline.wipeStart) / fadeOutDuration);
                const opacity = Math.max(0, 1 - fadeOutProgress);
                purposeText.style.opacity = String(opacity);
                purposeText.style.visibility = opacity > 0 ? "visible" : "hidden";
            } else {
                purposeText.style.visibility = "visible";
                purposeText.style.opacity = "1";
            }
            break;
        }
        }

        if (missileBackground) {
        switch (sectionPhase) {
            case 0:
            case 1:
            missileBackground.style.opacity = "0";
            break;
            case 2: {
            const progress =
                (currentScroll - timeline.missileStart) /
                (timeline.missileEnd - timeline.missileStart);
            const missileOpacity = Math.max(0, Math.min(1.0, progress));
            missileBackground.style.opacity = String(missileOpacity);
            break;
            }
            default:
            missileBackground.style.opacity = "1.0";
            break;
        }

        const missileOpacityValue =
            parseFloat(missileBackground.style.opacity) || 0;
        missileBackground.style.pointerEvents =
            shouldEnableMainMissilePointerEvents(missileOpacityValue)
            ? "auto"
            : "none";
        }

        const missileCaption = document.getElementById("section1-missile-caption");
        if (missileCaption) {
        switch (sectionPhase) {
            case 0:
            case 1:
            missileCaption.style.opacity = "0";
            break;
            case 2: {
            const progress =
                (currentScroll - timeline.missileStart) /
                (timeline.missileEnd - timeline.missileStart);
            missileCaption.style.opacity = String(
                Math.max(0, Math.min(1, progress)),
            );
            break;
            }
            default:
            missileCaption.style.opacity = "1";
            break;
        }
        }
    }

    function updateMissileFadeSectionTextFlow(section, sectionText, currentScroll, sectionOffsetTop, heroHeight, windowHeight, sectionRectsById) {
        if (!sectionText) return;

        if (section.id === 'section-2') {
            const MOVE_SPEED_RATIO = 112.5;
            const config = getSection2TimelineConfig(section);
            const timelineEvents = config.runtimeEvents;
            for (let i = 0; i < timelineEvents.length; i++) {
                timelineEvents[i].scrollPos = sectionOffsetTop + heroHeight * timelineEvents[i].coeff - windowHeight;
            }

            timelineEvents.forEach(event => {
                const isActive = currentScroll >= event.scrollPos;
                if (!event.isLayerEvent) return;
                const targetLayer = event.layer;
                if (!targetLayer) return;

                if (event.usesEffectProgress) {
                    const nextEvent = event.nextIndex >= 0 ? timelineEvents[event.nextIndex] : null;
                    const nextScrollPos = nextEvent ? nextEvent.scrollPos : event.scrollPos + windowHeight;
                    const distance = nextScrollPos - event.scrollPos;
                    const progress = distance > 0 ? Math.max(0, Math.min(1,
                        (currentScroll - event.scrollPos) / distance
                    )) : 1;
                    targetLayer.style.setProperty('--effect-progress', progress);
                }

                if (isActive) targetLayer.classList.add('active');
                else targetLayer.classList.remove('active');
            });

            const textStart = config.keyEventIndices.textStart >= 0 ? timelineEvents[config.keyEventIndices.textStart] : null;
            const titleStop = config.keyEventIndices.titleStop >= 0 ? timelineEvents[config.keyEventIndices.titleStop] : null;
            const resumeStart = config.keyEventIndices.resumeStart >= 0 ? timelineEvents[config.keyEventIndices.resumeStart] : null;
            const blueVioletBox = config.blueVioletBox;
            const blueVioletBoxRect = blueVioletBox ? blueVioletBox.getBoundingClientRect() : null;

            if (currentScroll < (textStart ? textStart.scrollPos : 0)) {
                sectionText.style.opacity = '0';
                sectionText.style.position = 'fixed';
                sectionText.style.top = '100vh';
                sectionText.style.paddingTop = '0';
                resetSectionTop(section.id);
            } else if (currentScroll < (titleStop ? titleStop.scrollPos : Infinity)) {
                const textStartPos = textStart ? textStart.scrollPos : 0;
                const fadeProgress1 = Math.min(1, (currentScroll - textStartPos) / (windowHeight * 0.2));
                sectionText.style.opacity = String(fadeProgress1);
                sectionText.style.position = 'fixed';

                const scrollDistance1 = (currentScroll - textStartPos) / windowHeight;
                let top1 = 100 - (scrollDistance1 * MOVE_SPEED_RATIO);

                if (blueVioletBoxRect) {
                    const maxTop = getSection2BlueVioletCenterTopVh(sectionText, blueVioletBoxRect, windowHeight, 10);
                    if (top1 < maxTop) top1 = maxTop;
                }

                const stableTop1 = stabilizeSectionTop(section.id, top1, currentScroll);
                sectionText.style.top = `${stableTop1}vh`;
                sectionText.style.paddingTop = '0';
            } else if (currentScroll < (resumeStart ? resumeStart.scrollPos : Infinity)) {
                sectionText.style.opacity = '1';
                sectionText.style.position = 'fixed';

                let titleStopPosition = 10;
                titleStopPosition = getSection2BlueVioletCenterTopVh(sectionText, blueVioletBoxRect, windowHeight, 10);

                const stableTitleStopPosition = stabilizeSectionTop(section.id, titleStopPosition, currentScroll);
                sectionText.style.top = `${stableTitleStopPosition}vh`;
                sectionText.style.paddingTop = '0';
            } else {
                sectionText.style.opacity = '1';
                sectionText.style.position = 'fixed';

                let titleStopPosition3 = 10;
                titleStopPosition3 = getSection2BlueVioletCenterTopVh(sectionText, blueVioletBoxRect, windowHeight, 10);

                const resumeStartPos = resumeStart ? resumeStart.scrollPos : 0;
                const scrollDistance3 = (currentScroll - resumeStartPos) / windowHeight;
                const top3 = titleStopPosition3 - (scrollDistance3 * MOVE_SPEED_RATIO);
                const stableTop3 = stabilizeSectionTop(section.id, top3, currentScroll);
                sectionText.style.top = `${stableTop3}vh`;
                sectionText.style.paddingTop = '0';
            }

            const section2TopicsRect = sectionRectsById ? sectionRectsById.get('section-2-topics') : null;
            const section3Rect = sectionRectsById ? sectionRectsById.get('section-3') : null;
            const handoffTargetRect = section2TopicsRect || section3Rect;
            if (handoffTargetRect) {
                const fadeStart = windowHeight * 0.95;
                const fadeEnd = windowHeight * 0.35;
                const handoffProgress = Math.max(0, Math.min(1,
                    (fadeStart - handoffTargetRect.top) / (fadeStart - fadeEnd)
                ));

                if (handoffProgress > 0) {
                    const currentOpacity = parseFloat(sectionText.style.opacity || '1');
                    sectionText.style.opacity = String(Math.max(0, currentOpacity * (1 - handoffProgress)));
                    if (handoffProgress > 0.98) {
                        sectionText.style.top = '-20vh';
                    }
                }
            }
            return;
        }

        if (applyLateMissileFadeSectionTextFlow(section, sectionText, currentScroll, windowHeight)) {
            return;
        }

        const MOVE_SPEED_RATIO = 112.5;
        const textStartCoeff = parseFloat(section.dataset.timelineTextStart || '0.0');
        const wipeStartCoeff = parseFloat(section.dataset.timelineWipeStart || '3.0');
        const timeline = {
            textStart: sectionOffsetTop + heroHeight * textStartCoeff - windowHeight,
            wipeStart: sectionOffsetTop + heroHeight * wipeStartCoeff - windowHeight
        };

        const sectionPhase =
            currentScroll < timeline.textStart ? 0 :
            currentScroll < timeline.wipeStart ? 1 :
            2;

        switch (sectionPhase) {
            case 0:
                sectionText.style.opacity = '0';
                sectionText.style.position = 'fixed';
                sectionText.style.top = '100vh';
                sectionText.style.paddingTop = '0';
                resetSectionTop(section.id);
                break;
            case 1: {
                const fadeProgress1 = Math.min(1, (currentScroll - timeline.textStart) / (windowHeight * 0.2));
                sectionText.style.opacity = String(fadeProgress1);
                sectionText.style.position = 'fixed';
                const scrollDistance1 = (currentScroll - timeline.textStart) / windowHeight;
                let topPosition1 = 100 - (scrollDistance1 * MOVE_SPEED_RATIO);
                if (topPosition1 < 10) topPosition1 = 10;
                const stableTopPosition1 = stabilizeSectionTop(section.id, topPosition1, currentScroll);
                sectionText.style.top = `${stableTopPosition1}vh`;
                sectionText.style.paddingTop = '0';
                break;
            }
            default:
                sectionText.style.opacity = '1';
                sectionText.style.position = 'fixed';
                sectionText.style.top = '10vh';
                sectionText.style.paddingTop = '0';
                pinSectionTop(section.id, 10);
                break;
        }
    }

    // section-2..7 text flow is resolved in one place from absolute scroll positions.
    // This avoids conflicting per-section overrides and cross-section dependency glitches.
    function applyUnifiedSectionTextFlow(scrollY, windowHeight) {
        const flowIds = ['section-2'];
        const flowItems = flowIds
            .map(id => document.getElementById(id))
            .filter(Boolean)
            .map(section => ({
                section,
                text: section.querySelector('.text-content')
            }))
            .filter(item => item.text);

        for (let i = 0; i < flowItems.length; i++) {
            const item = flowItems[i];
            const next = flowItems[i + 1];
            const start = item.section.offsetTop - windowHeight;
            const settle = start + windowHeight * 0.9; // 100vh -> 10vh
            let nextStart = next ? (next.section.offsetTop - windowHeight) : Number.POSITIVE_INFINITY;

            // This prevents fixed text/animations persisting after scrolling past

            if (!next) {
                const nextSiblingSection = item.section.nextElementSibling;
                if (nextSiblingSection) {
                    nextStart = nextSiblingSection.offsetTop - windowHeight;
                }
            }
            // section-3 は section-4 開始で確実に退場させる（後続セクションへの重なり防止）
            if (item.section.id === 'section-3') {
                const section4 = document.getElementById('section-4');
                if (section4) {
                    nextStart = section4.offsetTop - windowHeight;
                }
            }
            const fadeOutStart = nextStart - windowHeight * 0.15;
            const fadeOutEnd = nextStart + windowHeight * 0.05;

            if (scrollY < start - windowHeight * 0.1) {
                item.text.style.opacity = '0';
                item.text.style.position = 'fixed';
                item.text.style.top = '100vh';
                item.text.style.paddingTop = '0';
                continue;
            }

            const inProgress = Math.max(0, Math.min(1, (scrollY - start) / (settle - start)));
            const slideRange = window.innerWidth <= 768 ? 97 : 90;
            const baseTop = 100 - (inProgress * slideRange);
            const baseOpacity = Math.min(1, inProgress / 0.22);

            let fadeOutProgress = 0;
            if (Number.isFinite(nextStart)) {
                fadeOutProgress = Math.max(0, Math.min(1, (scrollY - fadeOutStart) / (fadeOutEnd - fadeOutStart)));
            }

            const topVh = baseTop - (fadeOutProgress * 35);
            const opacity = baseOpacity * (1 - fadeOutProgress);

            item.text.style.opacity = String(Math.max(0, opacity));
            item.text.style.position = 'fixed';
            item.text.style.top = `${topVh}vh`;
            item.text.style.paddingTop = '0';
        }
    }

    // 埋め込みメディアのポインターイベント制御
    // 非表示セクションのiframeが後続セクションのスクロールを奪うのを防ぐ
    function updateEmbeddedMediaPointerEvents(windowHeight, scrollY) {
        const mediaSections = [
            { id: 'section-3', nextId: 'section-4' },
            { id: 'section-6', nextId: 'section-7' }
        ];
        mediaSections.forEach(({ id, nextId }) => {
            const section = document.getElementById(id);
            if (!section) return;

            const rect = section.getBoundingClientRect();
            const text = section.querySelector('.text-content');
            const textOpacity = text ? (parseFloat(text.style.opacity || '0') || 0) : 0;
            const inView = rect.top < windowHeight * 0.9 && rect.bottom > windowHeight * 0.1;
            const nextSection = nextId ? document.getElementById(nextId) : null;
            const nextEntered = nextSection ? (nextSection.getBoundingClientRect().top < windowHeight * 0.95) : false;
            const beforeNextSection = nextSection ? (scrollY < (nextSection.offsetTop - windowHeight * 0.05)) : true;
            const allowPointer = inView && textOpacity > 0.25 && !nextEntered && beforeNextSection;

            section.querySelectorAll('iframe').forEach((iframe) => {
                iframe.style.pointerEvents = allowPointer ? 'auto' : 'none';
            });
        });
    }

    function updatePurposeMissileBackgroundWipe(windowHeight) {
        if (!missileBackground) return;

        if (textSections[1]) {
            const section2Rect = textSections[1].getBoundingClientRect();
            const triggerStart = windowHeight;
            const triggerEnd = windowHeight * 0.2;

            let wipeProgress = 0;
            if (section2Rect.top <= triggerStart && section2Rect.top >= triggerEnd) {
                wipeProgress = (triggerStart - section2Rect.top) / (triggerStart - triggerEnd);
                wipeProgress = Math.max(0, Math.min(1, wipeProgress));
            } else if (section2Rect.top < triggerEnd) {
                wipeProgress = 1;
            }

            const clipValue = wipeProgress * 100;
            missileBackground.style.clipPath = `inset(0 0 ${clipValue}% 0)`;
        } else {
            missileBackground.style.clipPath = 'inset(0 0 0 0)';
        }
    }

    function updateSectionBackgroundLayer(section, sectionIndex, rect, img, scrollY, windowHeight) {
        if (!img) return;

        const currentRect = (sectionIndex === 1 && textSections[1]) ? textSections[1].getBoundingClientRect() : rect;
        const offset = (sectionIndex === 1) ? 20 : 0;
        const triggerStart = windowHeight + offset;
        const triggerEnd = windowHeight * 0.2;

        let progress = 0;
        const isBgScrollingUp = scrollY < lastTextMotionScrollY;

        if (currentRect.top <= triggerStart && currentRect.top >= triggerEnd) {
            progress = (triggerStart - currentRect.top) / (triggerStart - triggerEnd);
            progress = Math.max(0, Math.min(1, progress));
        } else if (currentRect.top < triggerEnd) {
            progress = 1;
        }

        // モバイルの慣性中は微小な逆方向入力が発生しやすい。
        // section-7 背景は完全に画面外へ戻るまでは進行度を急に0へ戻さない。
        if (section.id === 'section-7' && isBgScrollingUp && currentRect.top >= windowHeight) {
            progress = 0;
        }

        const clipValue = 100 - (progress * 100);
        img.style.clipPath = `inset(${clipValue}% 0 0 0)`;

        if (progress > 0.1) {
            img.classList.add('active');
        } else {
            img.classList.remove('active');
        }

        if (rect.bottom > 0 && rect.top < windowHeight) {
            const sectionProgress = Math.max(0, Math.min(1,
                (windowHeight - rect.top) / (windowHeight + rect.height)
            ));
            const scale = 1.0 + (sectionProgress * 0.2);
            img.style.transform = `scale(${scale})`;
        }
    }

    function updateTextSectionVisualState(section, sectionIndex, rect, img, scrollY, viewportHeight, heroDynamicHeight, currentScroll, sectionRectsById) {
        // purposeセクション（index=0）のミサイル背景のワイプ制御
        if (sectionIndex === 0 && missileBackground) {
            updatePurposeMissileBackgroundWipe(viewportHeight);
        }

        // 背景画像
        updateSectionBackgroundLayer(section, sectionIndex, rect, img, scrollY, viewportHeight);

        // 本文フェード
        updateSectionParagraphFade(section, rect, viewportHeight);

        if (sectionIndex === 0) {
            updateSection1Timeline(section, currentScroll, viewportHeight);
        }

        // ミサイルフェードセクション本文 + ミサイル背景
        if (section.classList.contains('missile-fade-section')) {
            const sectionOffsetTop = section.offsetTop;
            const sectionText = section.querySelector('.text-content');
            updateMissileFadeSectionTextFlow(
                section,
                sectionText,
                currentScroll,
                sectionOffsetTop,
                heroDynamicHeight,
                viewportHeight,
                sectionRectsById
            );
            updateMissileFadeSectionBackground(section, sectionOffsetTop, currentScroll, viewportHeight);
        }

        // タイトルアニメーション
        updateSectionTitleFade(section, rect, viewportHeight);
    }

    function collectTextSectionRects() {
        const sectionRectsById = new Map();
        const sectionRects = Array.from(textSections, (section) => {
            const rect = section.getBoundingClientRect();
            sectionRectsById.set(section.id, rect);
            return rect;
        });
        return { sectionRects, sectionRectsById };
    }

    function updateAllTextSectionVisualStates(scrollY, viewportHeight, missileFadeHeroHeight, currentScroll, sectionRects, sectionRectsById) {
        textSections.forEach((section, sectionIndex) => {
            const rect = sectionRects[sectionIndex];
            const img = sectionToBgMap.get(sectionIndex);
            updateTextSectionVisualState(
                section,
                sectionIndex,
                rect,
                img,
                scrollY,
                viewportHeight,
                missileFadeHeroHeight,
                currentScroll,
                sectionRectsById
            );
        });
    }

    function finalizeBackgroundScrollFrame(scrollY, viewportHeight) {
        applyUnifiedSectionTextFlow(scrollY, viewportHeight);
        updateEmbeddedMediaPointerEvents(viewportHeight, scrollY);
        lastTextMotionScrollY = scrollY;
    }

    // スクロールで背景画像を切り替え
    function updateBackgroundOnScroll() {

        if (shouldUseSafeEndMode()) {
            disableHeavyEndEffects();
            return;
        }
        
        document.querySelectorAll('.fixed-background img').forEach(img => {
            img.style.opacity = '1';
        });

        const scrollY = window.pageYOffset;
        const heroDynamic = document.querySelector('.hero-dynamic');
        if (!heroDynamic) return;
        const heroHeight = heroDynamic.offsetHeight;

        // ヒーローセクションを通過していない場合は何もしない
        if (scrollY < heroHeight - 200) {
            lastTextMotionScrollY = scrollY;
            return;
        }

        const windowHeight = window.innerHeight;
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        const missileFadeHeroHeight = windowHeight * 1.8; // hero-dynamicの高さ（180vh）
        const { sectionRects, sectionRectsById } = collectTextSectionRects();

        updateAllTextSectionVisualStates(
            scrollY,
            windowHeight,
            missileFadeHeroHeight,
            currentScroll,
            sectionRects,
            sectionRectsById
        );
        finalizeBackgroundScrollFrame(scrollY, windowHeight);
    }


    function hideFixedBgNearFooter() {
        const footer = document.querySelector(".footer");
        if (!footer) return;

        const footerRect = footer.getBoundingClientRect();
        const windowHeight = cachedWindowHeight;
        const missileCaption = document.getElementById("section1-missile-caption");

        if (footerRect.top < windowHeight + 50) {
        document.querySelectorAll(".section-bg-layer").forEach((el) => {
            el.style.visibility = "hidden";
        });
        document.querySelectorAll(".fixed-background img").forEach((el) => {
            el.style.visibility = "hidden";
        });
        if (expansionComplete && tiles[0]) {
            tiles[0].style.visibility = "hidden";
        }
        if (missileBackground) {
            missileBackground.style.visibility = "hidden";
        }
        if (missileCaption) {
            missileCaption.style.visibility = "hidden";
        }
        const section1Text = document.querySelector('#section-1 .text-content');
        if (section1Text) {
            section1Text.style.visibility = "hidden";
        }
        } else {
        document.querySelectorAll(".section-bg-layer").forEach((el) => {
            el.style.visibility = "visible";
        });
        document.querySelectorAll(".fixed-background img").forEach((el) => {
            el.style.visibility = "visible";
        });
        if (expansionComplete && tiles[0]) {
            tiles[0].style.visibility = "visible";
        }
        if (missileBackground) {
            missileBackground.style.visibility = "visible";
        }
        if (missileCaption) {
            missileCaption.style.visibility = "visible";
        }
        }
    }

    // Call on every scroll frame
    window.addEventListener('scroll', function() {
        if (!isIOSDevice()) return;
        requestAnimationFrame(hideFixedBgNearFooter);
    });
    // スクロールイベントリスナー
    let bgScrollTicking = false;
    window.addEventListener('scroll', function() {
        if (!bgScrollTicking) {
            window.requestAnimationFrame(function() {
                updateBackgroundOnScroll();
                bgScrollTicking = false;
            });
            bgScrollTicking = true;
        }
    });

    // loadingクラスを削除してアニメーションを有効化
    setTimeout(() => {
        document.body.classList.remove('loading');
    }, 100);

    // 全セクションの高さを動的に設定
    // 各セクションの最終フェーズ（transition）の開始位置に基づいて高さを計算
    function setAllSectionHeights() {
        const windowHeight = cachedWindowHeight; // Use cached height
        const heroHeight = windowHeight * 1.8; // hero-dynamicの高さ（180vh）

        // 全セクションの高さ設定をdata属性から自動計算
        const allSections = [
            document.querySelector('#section-1'),
            document.querySelector('#section-2'),
            document.querySelector('#section-3'),
            document.querySelector('#section-4')
        ];

        allSections.forEach((section) => {
            if (!section) return;

            // data属性からwipeStart係数を読み取り
            const wipeStartCoeff = parseFloat(section.dataset.timelineWipeStart);
            if (isNaN(wipeStartCoeff)) {
                return;
            }

            let requiredHeight;
            if (section.id === 'section-1') {
                // Section 1は特殊計算: wipeStart - heroHeight
                requiredHeight = heroHeight * wipeStartCoeff - heroHeight;
            } else {
                // Section 2, 3, 4: wipeStart - windowHeight
                requiredHeight = heroHeight * wipeStartCoeff - windowHeight;
            }

            const heightInVh = (requiredHeight / windowHeight) * 100;
            section.style.minHeight = `${heightInVh}vh`;
        });
    }

    // 初回実行
    setAllSectionHeights();

    // ウィンドウリサイズ時に再計算（モバイルのアドレスバー表示/非表示による小さな変更を無視）
    let lastResizeWidth = window.innerWidth;
    window.addEventListener('resize', function() {
        const newWidth = window.innerWidth;
        // 幅が変わらない場合はアドレスバーの表示/非表示と判断してスキップ
        if (newWidth === lastResizeWidth) return;
        lastResizeWidth = newWidth;

        setAllSectionHeights();
        updateBackgroundOnScroll(); // テキスト位置も再計算

        // タイルグリッドの状態も更新（重要！）
        updateTileGrid();
    });


    // 初期状態を設定：すべてのテキストとタイトルをfade-hiddenにする
    textSections.forEach((section) => {
        const textParagraphs = section.querySelectorAll('.content-with-images p');
        textParagraphs.forEach(p => {
            p.classList.add('fade-hidden');
            p.classList.remove('fade-visible');
        });

        const sectionTitle = section.querySelector('.section-title-animated');
        if (sectionTitle) {
            const titleChars = sectionTitle.querySelectorAll('span');
            titleChars.forEach(char => {
                char.classList.add('fade-hidden');
                char.classList.remove('fade-visible');
            });
        }
    });

    // 初回実行（即座に）- トランジションなしで初期状態を設定
    // トランジションを一時的に無効化
    document.body.style.setProperty('--fade-transition-time', '0s');
    updateBackgroundOnScroll();

    // 次のフレームでトランジションを有効化
    const fadeTime = window.innerWidth <= 768 ? '1.5s' : '3s';
    requestAnimationFrame(() => {
        document.body.style.setProperty('--fade-transition-time', fadeTime);
        updateBackgroundOnScroll();
    });

    // 遅延実行で確実にチェック（統合）
    setTimeout(updateBackgroundOnScroll, 100);
    setTimeout(updateBackgroundOnScroll, 500);

    // 自動スクロール関数（タイルとナビゲーションで共通使用）
    function autoScrollToSection(sectionIndex) {
        const targetSection = textSections[sectionIndex];

        if (targetSection) {
            const currentScrollY = window.pageYOffset;
            const heroHeight = heroSection.offsetHeight;
            const windowHeight = window.innerHeight;
            let sectionOffset = targetSection.offsetTop;

            // セクション1: textStart = heroHeight なので offsetTop ではテキストが100vh位置
            // 0.8 * windowHeight 追加でテキストを10vhまでスライドイン
            if (sectionIndex === 0) {
                sectionOffset += windowHeight * 0.8;
            }

            // ナビゲーション完了時: content-bottom方式セクションのテキスト位置を強制設定
            function forceTextAfterNav() {
                // 現在は通常フロー/ sticky 中心のため、強制fixed化は行わない
                // ナビ到達後に状態更新だけ実行して表示を同期する
                updateBackgroundOnScroll();
                requestAnimationFrame(updateBackgroundOnScroll);
            }

            // 既にヒーローセクションを通過している場合
            if (currentScrollY >= heroHeight) {
                // タイルと同じ速度でスクロール
                userNavigatedAway = true;

                const startScroll = currentScrollY;
                const distance = sectionOffset - startScroll;
                const isMobileDevice = window.innerWidth <= 768;
                const scrollSpeed = isMobileDevice ? 300 : 150; // モバイルは高速化
                const scrollDirection = distance > 0 ? 1 : -1;
                let currentScroll = startScroll;

                function animateScroll() {
                    const remaining = Math.abs(sectionOffset - currentScroll);

                    if (remaining > scrollSpeed) {
                        currentScroll += scrollSpeed * scrollDirection;
                        window.scrollTo(0, currentScroll);
                        updateBackgroundOnScroll();
                        requestAnimationFrame(animateScroll);
                    } else {
                        // 最後の調整
                        window.scrollTo(0, sectionOffset);
                        updateBackgroundOnScroll();
                        forceTextAfterNav();
                    }
                }

                requestAnimationFrame(animateScroll);
            } else {
                // ヒーローセクション内にいる場合、ホイールイベントをシミュレート
                // 拡大エフェクトを経由してセクションまでスクロール

                const totalDistance = sectionOffset;
                const isMobileNav = window.innerWidth <= 768;
                const scrollSpeed = isMobileNav ? 300 : 150; // モバイルは高速化
                let currentVirtualScroll = virtualScroll;
                let currentRealScroll = currentScrollY;

                function simulateScroll() {
                    // まず拡大エフェクトを完了させる
                    if (currentVirtualScroll < expansionScrollAmount) {
                        currentVirtualScroll += scrollSpeed * 3; // 拡大エフェクトは150*3=450ピクセル/フレーム
                        currentVirtualScroll = Math.min(currentVirtualScroll, expansionScrollAmount);

                        // 仮想スクロールを更新
                        virtualScroll = currentVirtualScroll;
                        updateTileGrid();

                        requestAnimationFrame(simulateScroll);
                    } else {
                        // 拡大完了後、実際のスクロールを開始
                        if (!expansionComplete) {
                            expansionComplete = true;
                            isExpanding = false;
                            fixedBgContainer.style.display = 'block';
                        }

                        if (currentRealScroll < totalDistance) {
                            currentRealScroll += scrollSpeed;
                            currentRealScroll = Math.min(currentRealScroll, totalDistance);

                            window.scrollTo(0, currentRealScroll);
                            updateBackgroundOnScroll();

                            requestAnimationFrame(simulateScroll);
                        } else {
                            // スクロール完了
                            userNavigatedAway = true;
                            forceTextAfterNav();
                        }
                    }
                }

                simulateScroll();
            }
        }
    }

    // タイルクリックで該当セクションへスクロール
    tiles.forEach((tile, index) => {
        tile.addEventListener('click', function(e) {
            e.preventDefault();
            autoScrollToSection(index);
        });
    });

    // ナビゲーションリンククリックで該当セクションへスクロール
    const navLinks = document.querySelectorAll('.main-nav a');
    navLinks.forEach((link) => {
        link.addEventListener('click', function(e) {
            const sectionIndex = parseInt(this.getAttribute('data-section'), 10);
            if (Number.isFinite(sectionIndex)) {
                e.preventDefault();
                autoScrollToSection(sectionIndex);
                return;
            }

            const targetId = this.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                const targetEl = document.querySelector(targetId);
                if (targetEl) {
                    e.preventDefault();
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    // スライドショー機能
    const slideshows = document.querySelectorAll('.slideshow');
    slideshows.forEach((slideshow) => {
        const images = slideshow.querySelectorAll('.slideshow-image');
        let currentIndex = 0;

        if (images.length > 1) {
            setInterval(() => {
                images[currentIndex].classList.remove('active');
                currentIndex = (currentIndex + 1) % images.length;
                images[currentIndex].classList.add('active');
            }, 3000); // 3秒ごとに切り替え
        }
    });
});

// ページ読み込み時のアニメーション（初期位置保存時に実行されるため削除）


// ========================================
// 4トピック: 青枠テキストのフォントサイズ自動調整
// ========================================
function adjustTopicTextSize() {
    const topicTexts = document.querySelectorAll('.blue-box');
    if (topicTexts.length === 0) return;

    // 基準サイズを最初の青枠から取得（初回のみ計算）
    if (!adjustTopicTextSize.referenceArea) {
        const firstBox = topicTexts[0];
        if (firstBox) {
            const refWidth = firstBox.clientWidth;
            const refHeight = firstBox.clientHeight;
            const computedStyle = window.getComputedStyle(firstBox);
            const paddingH = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
            const paddingV = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);
            adjustTopicTextSize.referenceArea = (refWidth - paddingH) * (refHeight - paddingV);
            adjustTopicTextSize.baseFontSize = 18; // 基準フォントサイズ（px）
        }
    }

    const referenceArea = adjustTopicTextSize.referenceArea;
    const baseFontSize = adjustTopicTextSize.baseFontSize;
    const MIN_FONT_SIZE = 10;
    const MAX_FONT_SIZE = 24;

    // ステップ1: 各青枠で収まる最大フォントサイズを計算
    const fontSizes = [];

    topicTexts.forEach(textBox => {
        // テキストが空の場合はスキップ
        const text = textBox.textContent.trim();
        if (!text) {
            fontSizes.push(MAX_FONT_SIZE);
            return;
        }

        const containerWidth = textBox.clientWidth;
        const containerHeight = textBox.clientHeight;

        // パディングを考慮した実際の利用可能スペース
        const computedStyle = window.getComputedStyle(textBox);
        const paddingTop = parseFloat(computedStyle.paddingTop);
        const paddingBottom = parseFloat(computedStyle.paddingBottom);
        const paddingLeft = parseFloat(computedStyle.paddingLeft);
        const paddingRight = parseFloat(computedStyle.paddingRight);

        const availableWidth = containerWidth - paddingLeft - paddingRight;
        const availableHeight = containerHeight - paddingTop - paddingBottom;

        if (availableWidth <= 0 || availableHeight <= 0) {
            fontSizes.push(MIN_FONT_SIZE);
            return;
        }

        // 現在の面積を計算
        const currentArea = availableWidth * availableHeight;

        // 面積比の平方根でフォントサイズをスケーリング（二次元的にバランスを取る）
        const areaRatio = currentArea / referenceArea;
        const scaleFactor = Math.sqrt(areaRatio);
        let targetFontSize = baseFontSize * scaleFactor;

        // 最小・最大フォントサイズの制限
        targetFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, targetFontSize));

        // 実際にテキストが収まるか確認
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.visibility = 'hidden';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        tempDiv.style.width = availableWidth + 'px';
        tempDiv.style.lineHeight = '1.6';
        tempDiv.style.margin = '0';
        tempDiv.style.padding = '0';
        tempDiv.style.border = 'none';
        tempDiv.style.boxSizing = 'border-box';
        tempDiv.style.whiteSpace = 'normal';
        tempDiv.style.wordWrap = 'break-word';
        tempDiv.style.overflowWrap = 'break-word';
        tempDiv.style.fontSize = targetFontSize + 'px';
        tempDiv.textContent = text;
        document.body.appendChild(tempDiv);

        const textHeight = tempDiv.offsetHeight;

        // 収まらない場合は縮小
        if (textHeight > availableHeight) {
            let minSize = MIN_FONT_SIZE;
            let maxSize = targetFontSize;
            let optimalSize = minSize;

            while (maxSize - minSize > 0.5) {
                const testSize = (minSize + maxSize) / 2;
                tempDiv.style.fontSize = testSize + 'px';

                const testHeight = tempDiv.offsetHeight;

                if (testHeight <= availableHeight) {
                    optimalSize = testSize;
                    minSize = testSize;
                } else {
                    maxSize = testSize;
                }
            }
            targetFontSize = optimalSize;
        }

        document.body.removeChild(tempDiv);
        fontSizes.push(targetFontSize);
    });

    // ステップ2: 最小のフォントサイズを全ての青枠に適用
    const uniformFontSize = Math.floor(Math.min(...fontSizes));

    topicTexts.forEach(textBox => {
        textBox.style.fontSize = uniformFontSize + 'px';
    });
}

// ========================================
// セクション2: シアン枠のサイズ調整
// ========================================
function adjustCyanBoxSize() {
    const section2 = document.querySelector('#section-2');
    if (!section2) return;

    const contentWithImages = section2.querySelector('.content-with-images');
    if (!contentWithImages) return;

    const redBox = contentWithImages.querySelector('.red-box');
    const cyanBox = contentWithImages.querySelector('.cyan-box');

    if (!redBox || !cyanBox) return;

    // PC版かどうかを判定（1025px以上）
    const isPC = window.matchMedia('(min-width: 1025px)').matches;

    if (isPC) {
        // PC版: 横並び、赤枠1/3、シアン枠は中央配置
        const containerWidth = contentWithImages.offsetWidth;
        const redBoxWidth = containerWidth / 3; // ページ横幅の1/3
        const windowHeight = window.innerHeight; // ページ縦幅
        const aspectRatio = 1000.000 / 477.118; // シアン枠のアスペクト比

        // シアン枠の高さの上限：ページ縦幅の1/2
        const maxCyanHeight = windowHeight * 1 / 2;

        // 残りのスペースを計算（赤枠の幅を除いた部分）
        const remainingWidth = containerWidth - redBoxWidth;

        // 幅の制約から計算した場合の高さ
        const heightFromWidth = remainingWidth / aspectRatio;

        // 高さの上限とアスペクト比から計算した高さの小さい方を採用
        const cyanHeight = Math.min(maxCyanHeight, heightFromWidth);

        // アスペクト比を維持した幅を計算
        const cyanWidth = cyanHeight * aspectRatio;

        // gapを計算（残りスペースからシアン枠を引いて、2で割る）
        const totalGap = remainingWidth - cyanWidth;
        const gap = totalGap / 2;

        // シアン枠のサイズとマージンを設定（左右のgapを均等に）
        cyanBox.style.width = cyanWidth + 'px';
        cyanBox.style.height = cyanHeight + 'px';
        cyanBox.style.marginLeft = gap + 'px';
        cyanBox.style.marginRight = gap + 'px';
    } else {
        // タブレット・スマホ版: スタイルをリセット（CSSに任せる）
        cyanBox.style.width = '';
        cyanBox.style.height = '';
        cyanBox.style.marginLeft = '';
        cyanBox.style.marginRight = '';
    }
}

// ========================================
// セクション3: グレー枠のサイズ調整
// ========================================
function adjustGrayBoxSize() {
    // セクション3とセクション6のグレー枠を処理
    const sections = ['#section-3', '#section-6'];

    sections.forEach(sectionId => {
        const section = document.querySelector(sectionId);
        if (!section) return;

        const contentWithImages = section.querySelector('.content-with-images');
        if (!contentWithImages) return;

        const redBox = contentWithImages.querySelector('.red-box');
        const grayBox = contentWithImages.querySelector('.gray-box');

        if (!redBox || !grayBox) return;

        // PC・タブレット版かどうかを判定（769px以上）
        const isPC = window.matchMedia('(min-width: 769px)').matches;

        // data-fixed-aspect属性でアスペクト比固定かどうかを判定
        const isFixedAspect = grayBox.dataset.fixedAspect === 'true';

        if (isPC) {
            const containerWidth = contentWithImages.offsetWidth;

            if (isFixedAspect) {
                // アスペクト比固定（セクション3: YouTube動画）
                // 赤枠33.333%, 残り66.667%を使用
                const redBoxWidth = containerWidth / 3;
                const remainingWidth = containerWidth - redBoxWidth;

                const windowHeight = window.innerHeight;
                const aspectRatio = 16 / 9;
                const maxGrayHeight = windowHeight * 1 / 2;
                const heightFromWidth = remainingWidth / aspectRatio;
                const grayHeight = Math.min(maxGrayHeight, heightFromWidth);
                const grayWidth = grayHeight * aspectRatio;
                const totalGap = remainingWidth - grayWidth;
                const gap = totalGap / 2;

                grayBox.style.flex = 'none';
                grayBox.style.width = grayWidth + 'px';
                grayBox.style.height = grayHeight + 'px';
                grayBox.style.marginLeft = gap + 'px';
                grayBox.style.marginRight = gap + 'px';
            } else {
                // アスペクト比可変（セクション6: Google Map、赤枠と同じ高さ）
                // 赤枠は「■研究相談／研究室訪問はこちらまで」が改行しない最小幅
                // 配分: 赤枠(auto) + グレー枠（残り幅100%、gap0%）
                const redBoxWidth = redBox.offsetWidth; // 実際の赤枠幅を取得
                const remainingWidth = containerWidth - redBoxWidth;

                // グレー枠は残り幅の100%、gap0%
                const grayWidth = remainingWidth;

                const redBoxHeight = redBox.offsetHeight;

                grayBox.style.flex = 'none';
                grayBox.style.width = grayWidth + 'px';
                grayBox.style.height = redBoxHeight + 'px';
                grayBox.style.marginLeft = '0px';
                grayBox.style.marginRight = '0px';
            }
        } else {
            // タブレット・スマホ版: スタイルをリセット（CSSに任せる）
            grayBox.style.flex = '';
            grayBox.style.width = '';
            grayBox.style.height = '';
            grayBox.style.marginLeft = '';
            grayBox.style.marginRight = '';
        }
    });
}

// ========================================
// セクション2&3: 赤枠のテキストフォントサイズ調整
// ========================================
function adjustRedBoxTextSize() {
    // セクション2と3の両方を処理
    ['#section-2', '#section-3'].forEach(sectionId => {
        const section = document.querySelector(sectionId);
        if (!section) return;

        const contentWithImages = section.querySelector('.content-with-images');
        if (!contentWithImages) return;

        const redBox = contentWithImages.querySelector('.red-box');
        if (!redBox) return;

        adjustSingleRedBox(redBox);
    });
}

function adjustSingleRedBox(redBox) {

    const redBoxWidth = redBox.offsetWidth;
    const redBoxHeight = redBox.offsetHeight;

    // パディングを考慮
    const computedStyle = window.getComputedStyle(redBox);
    const paddingLeft = parseFloat(computedStyle.paddingLeft);
    const paddingRight = parseFloat(computedStyle.paddingRight);
    const paddingTop = parseFloat(computedStyle.paddingTop);
    const paddingBottom = parseFloat(computedStyle.paddingBottom);

    const availableWidth = redBoxWidth - paddingLeft - paddingRight;
    const availableHeight = redBoxHeight - paddingTop - paddingBottom;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const text = redBox.textContent.trim();
    if (!text) return;

    const MAX_FONT_SIZE = 18;
    const MIN_FONT_SIZE = 10;

    // 二分探索で最適なフォントサイズを見つける
    let minSize = MIN_FONT_SIZE;
    let maxSize = MAX_FONT_SIZE;
    let optimalSize = minSize;

    // テキストコンテンツを一時的な要素で測定
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.style.width = availableWidth + 'px';
    tempDiv.style.lineHeight = '1.6';
    tempDiv.style.margin = '0';
    tempDiv.style.padding = '0';
    tempDiv.style.border = 'none';
    tempDiv.style.boxSizing = 'border-box';
    tempDiv.style.whiteSpace = 'normal';
    tempDiv.style.wordWrap = 'break-word';
    tempDiv.style.overflowWrap = 'break-word';
    tempDiv.textContent = text;
    document.body.appendChild(tempDiv);

    while (maxSize - minSize > 0.5) {
        const testSize = (minSize + maxSize) / 2;
        tempDiv.style.fontSize = testSize + 'px';

        const testHeight = tempDiv.offsetHeight;

        if (testHeight <= availableHeight) {
            optimalSize = testSize;
            minSize = testSize;
        } else {
            maxSize = testSize;
        }
    }

    document.body.removeChild(tempDiv);

    // フォントサイズを適用
    redBox.style.fontSize = Math.floor(optimalSize) + 'px';
}

// 初回ロード時にログ出力とフォントサイズ調整
document.addEventListener('DOMContentLoaded', function() {
    // 少し遅延させてレイアウトが確定してから実行
    setTimeout(() => {
        adjustTopicTextSize();
        adjustCyanBoxSize();
        adjustGrayBoxSize();
        adjustRedBoxTextSize();

        // セクション3の赤枠内リンクのクリック処理を強制的に有効化
        const section3Link = document.querySelector('#section-3 .red-box a');
        if (section3Link) {
            // リンクとその親要素にpointer-eventsを強制的に設定
            section3Link.style.pointerEvents = 'auto';
            section3Link.parentElement.style.pointerEvents = 'auto';

            // 画像要素にもpointer-eventsを設定
            const linkImg = section3Link.querySelector('img');
            if (linkImg) {
                linkImg.style.pointerEvents = 'auto';
            }
        }
    }, 500);
});

// リサイズ時にもフォントサイズ調整（リアルタイム処理）
window.addEventListener('resize', () => {
    adjustTopicTextSize();
    adjustCyanBoxSize();
    adjustGrayBoxSize();
    adjustRedBoxTextSize();
});


// ========================================
// Section 2 スライドショー制御
// ========================================
function initSlideshow() {
    const slideshowContainers = document.querySelectorAll('.slideshow-container');

    slideshowContainers.forEach(container => {
        const images = container.querySelectorAll('.slideshow-image');
        if (images.length <= 1) return; // 画像が1枚以下ならスライドショー不要

        let currentIndex = 0;

        // 3秒ごとに次の画像に切り替え
        setInterval(() => {
            images[currentIndex].classList.remove('active');
            currentIndex = (currentIndex + 1) % images.length;
            images[currentIndex].classList.add('active');
        }, 3000); // 3秒ごとに切り替え
    });
}

// DOMロード時にスライドショーを初期化
document.addEventListener('DOMContentLoaded', initSlideshow);


// ========================================
// Section 3 アニメーション制御 (アニメーション1)
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    const section = document.querySelector('#section-3');
    if (!section) return;

    const animatedLayers = section.querySelectorAll('.section-3-layer-animated');
    if (animatedLayers.length === 0) return;

    // 初期状態: 全レイヤーを非表示
    animatedLayers.forEach(layer => {
        layer.classList.remove('active');
    });

    // スクロール監視
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // セクションが表示されたら順次レイヤーを表示
                animatedLayers.forEach((layer, index) => {
                    setTimeout(() => {
                        layer.classList.add('active');
                    }, index * 200); // 200ms間隔で順次表示
                });
            } else {
                // セクションが非表示になったら全レイヤーを非表示
                animatedLayers.forEach(layer => {
                    layer.classList.remove('active');
                });
            }
        });
    }, {
        threshold: 0.3 // セクションの30%が表示されたらトリガー
    });

    observer.observe(section);
});

// ハンバーガーメニュー開閉
document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mainNav = document.querySelector('.main-nav');

    if (hamburgerBtn && mainNav) {
        // ハンバーガーボタンで開閉トグル
        hamburgerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            mainNav.classList.toggle('open');
        });

        // ナビリンククリック時にメニューを閉じる
        mainNav.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                mainNav.classList.remove('open');
            });
        });

        // メニュー外クリックで閉じる
        document.addEventListener('click', function(e) {
            if (!mainNav.contains(e.target)) {
                mainNav.classList.remove('open');
            }
        });
    }
});

// 枠線トグル機能
document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggle-borders');
    let bordersVisible = false;

    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            bordersVisible = !bordersVisible;

            if (bordersVisible) {
                document.body.classList.remove('hide-borders');
                toggleButton.textContent = '枠線OFF';
            } else {
                document.body.classList.add('hide-borders');
                toggleButton.textContent = '枠線ON';
            }
        });
    }
});

// ========================================
// セクション3: details展開時の高さ動的調整
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const section3 = document.getElementById('section-3');
    if (!section3) return;

    const details = section3.querySelector('details');
    if (!details) return;

    function updateSection3MinHeight() {
        requestAnimationFrame(function() {
            const textContent = section3.querySelector('.text-content');
            if (!textContent) return;

            if (details.open) {
                const contentHeight = textContent.scrollHeight;
                const windowHeight = window.innerHeight;
                const minHeightVh = Math.max(150, Math.ceil(contentHeight / windowHeight * 100) + 10);
                section3.style.minHeight = minHeightVh + 'vh';
            } else {
                section3.style.minHeight = '';
            }
            window.dispatchEvent(new Event('scroll'));
        });
    }

    details.addEventListener('toggle', updateSection3MinHeight);
});

// ミサイルiframeからのスクロール要求を処理
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'missileScroll') {
        window.scrollBy({
            top: event.data.deltaY,
            behavior: 'auto'  // スムーズではなく即座にスクロール
        });
    }
});

// ========================================
// デバッグ: スクロールブロッキング診断 v2
// ========================================
(function() {
    let lastDebugLog = 0;
    let prevScrollY = window.pageYOffset;
    let stuckCount = 0;

    // キャプチャフェーズで全wheelイベントを監視（セクション制限なし）
    window.addEventListener('wheel', function(e) {
        const now = Date.now();
        if (now - lastDebugLog < 300) return;
        lastDebugLog = now;

        const scrollY = window.pageYOffset;
        const isStuck = (scrollY === prevScrollY);
        if (isStuck) stuckCount++; else stuckCount = 0;

        const target = e.target;
        const closestSection = target.closest ? target.closest('[id]') : null;

        // スクロールが停止した場合に詳細ログ出力
        if (isStuck && stuckCount >= 1) {
            console.group('[STUCK] scrollY=' + scrollY + ' (stuck ' + stuckCount + ' times)');
            console.log('deltaY:', e.deltaY, 'defaultPrevented:', e.defaultPrevented);
            console.log('target:', target.tagName + (target.id ? '#' + target.id : '') + '.' + (typeof target.className === 'string' ? target.className.replace(/\s+/g, '.') : ''));
            console.log('section:', closestSection ? closestSection.id : 'none');

            // マウス位置の要素スタック（pointer-events:none要素も含めて全レイヤー確認）
            const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
            const layerInfo = elementsAtPoint.slice(0, 10).map(el => {
                const cs = getComputedStyle(el);
                return {
                    tag: el.tagName,
                    id: el.id || '',
                    class: (typeof el.className === 'string' ? el.className.substring(0, 30) : ''),
                    pointerEvents: cs.pointerEvents,
                    position: cs.position,
                    overflow: cs.overflow,
                    overflowY: cs.overflowY,
                    zIndex: cs.zIndex,
                    height: el.offsetHeight
                };
            });
            console.log('Elements at cursor (top to bottom):');
            console.table(layerInfo);

            // scrollTopを直接操作してテスト（scroll-behavior:smoothの影響を回避）
            const se = document.scrollingElement;
            const beforeTest = se.scrollTop;
            se.scrollTop = beforeTest + 1;
            const afterTest = se.scrollTop;
            se.scrollTop = beforeTest; // 戻す
            console.log('scrollTop direct test: before=' + beforeTest + ' after=' + afterTest +
                (afterTest === beforeTest ? ' *** SCROLL TRULY BLOCKED ***' : ' (scrollTop works - smooth was hiding it)'));

            // scrollHeight/clientHeight確認
            console.log('scrollHeight:', se.scrollHeight,
                'clientHeight:', se.clientHeight,
                'maxScroll:', se.scrollHeight - se.clientHeight);

            // main要素がネストされたスクロールコンテナになっていないか確認
            const mainEl = document.querySelector('main');
            if (mainEl) {
                console.log('MAIN scrollHeight:', mainEl.scrollHeight,
                    'clientHeight:', mainEl.clientHeight,
                    'scrollTop:', mainEl.scrollTop,
                    'overflow:', getComputedStyle(mainEl).overflow,
                    'isScrollContainer:', mainEl.scrollHeight > mainEl.clientHeight);
            }

            // body要素のスクロール状態
            console.log('BODY scrollHeight:', document.body.scrollHeight,
                'clientHeight:', document.body.clientHeight,
                'scrollTop:', document.body.scrollTop,
                'overflow:', bodyStyle.overflow);

            console.groupEnd();
        }

        prevScrollY = scrollY;
    }, { capture: true, passive: true });

    // バブリングフェーズでdefaultPrevented確認（全セクション）
    window.addEventListener('wheel', function(e) {
        if (e.defaultPrevented) {
            const target = e.target;
            const closestSection = target.closest ? target.closest('[id]') : null;
            console.warn('[PREVENTED] wheel defaultPrevented=true',
                'section:', closestSection ? closestSection.id : 'none',
                'scrollY:', window.pageYOffset);
        }
    }, { capture: false, passive: true });

    // touchmoveも同様にSTUCK検出
    let lastTouchDebug = 0;
    let prevTouchScrollY = window.pageYOffset;
    let touchStuckCount = 0;
    window.addEventListener('touchmove', function(e) {
        const now = Date.now();
        if (now - lastTouchDebug < 300) return;
        lastTouchDebug = now;

        const scrollY = window.pageYOffset;
        const isStuck = (scrollY === prevTouchScrollY);
        if (isStuck) touchStuckCount++; else touchStuckCount = 0;

        if (isStuck && touchStuckCount >= 2) {
            const target = e.target;
            const closestSection = target.closest ? target.closest('[id]') : null;
            console.group('[TOUCH-STUCK] scrollY=' + scrollY + ' (stuck ' + touchStuckCount + ' times)');
            console.log('target:', target.tagName + (target.id ? '#' + target.id : ''));
            console.log('section:', closestSection ? closestSection.id : 'none');
            console.log('defaultPrevented:', e.defaultPrevented, 'cancelable:', e.cancelable);

            const touch = e.touches[0];
            if (touch) {
                const elementsAtTouch = document.elementsFromPoint(touch.clientX, touch.clientY);
                const touchLayerInfo = elementsAtTouch.slice(0, 10).map(el => {
                    const cs = getComputedStyle(el);
                    return {
                        tag: el.tagName,
                        id: el.id || '',
                        class: (typeof el.className === 'string' ? el.className.substring(0, 30) : ''),
                        pointerEvents: cs.pointerEvents,
                        position: cs.position,
                        zIndex: cs.zIndex
                    };
                });
                console.table(touchLayerInfo);
            }

            const se = document.scrollingElement;
            const beforeTest = se.scrollTop;
            se.scrollTop = beforeTest + 1;
            const afterTest = se.scrollTop;
            se.scrollTop = beforeTest;
            console.log('scrollTop test:', afterTest === beforeTest ? '*** TRULY BLOCKED ***' : 'OK (smooth was hiding it)');

            console.groupEnd();
        }
        prevTouchScrollY = scrollY;
    }, { capture: true, passive: true });

    // 初期状態
    const htmlStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const mainEl = document.querySelector('main');
    const mainStyle = mainEl ? getComputedStyle(mainEl) : null;
    console.log('[SCROLL-DEBUG] html overflow:', htmlStyle.overflow, 'scrollBehavior:', htmlStyle.scrollBehavior);
    console.log('[SCROLL-DEBUG] body overflow:', bodyStyle.overflow, 'overscrollBehavior:', bodyStyle.overscrollBehaviorY);
    console.log('[SCROLL-DEBUG] main overflow:', mainStyle ? mainStyle.overflow : 'N/A',
        mainEl ? ('scrollH:' + mainEl.scrollHeight + ' clientH:' + mainEl.clientHeight) : '');
    console.log('[SCROLL-DEBUG] scrollingElement:', document.scrollingElement.tagName,
        'scrollHeight:', document.scrollingElement.scrollHeight,
        'clientHeight:', document.scrollingElement.clientHeight);
    console.log('[SCROLL-DEBUG] v2.1 loaded - will log when scroll gets stuck');
})();
