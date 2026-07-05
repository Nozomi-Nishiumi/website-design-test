// スクロールアニメーション
document.addEventListener('DOMContentLoaded', function() {

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
        adjustTitleSize();
        updateTitleCenterLine();
    });

    // 初期位置を保存（ページ読み込み時に一度だけ取得）
    let initialPositions = [];

    // 仮想スクロール位置（拡大アニメーション用）
    let virtualScroll = 0;
    let isExpanding = true; // 拡大中フラグ
    let expansionComplete = false; // 拡大完了フラグ
    const expansionScrollAmount = 800; // 拡大完了までのスクロール量（ピクセル）
    let userNavigatedAway = false; // ユーザーが手動でセクションに移動したかどうか

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
    function updateMissilePointerEvents() {
        if (!missileBackground) return;

        const opacity = parseFloat(window.getComputedStyle(missileBackground).opacity);

        // opacity が 0.1 以下の場合はマウスイベントを透過（カーソルは消えない）
        if (opacity <= 0.1) {
            missileBackground.style.pointerEvents = 'none';
        } else {
            // opacity が 0.1 より大きい場合はマウスイベントを受け取る（iframe内でカーソルが消える）
            missileBackground.style.pointerEvents = 'auto';
        }
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

            setTimeout(() => {
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
                function updateAutoWipeEffects() {
                    const windowHeight = window.innerHeight;
                    const triggerStart = windowHeight;
                    const triggerEnd = windowHeight * 0.2;

                    // 隣接するセクション間でワイプエフェクトを適用
                    for (let i = 0; i < sectionsWithBg.length - 1; i++) {
                        const currentItem = sectionsWithBg[i];
                        const nextItem = sectionsWithBg[i + 1];

                        // セクション2→3の特別処理: 黄色枠の下端を基準にワイプ
                        if (nextItem.section.id === 'section-3' && currentItem.section.id === 'section-2') {
                            const section2 = currentItem.section;
                            const yellowBox = section2.querySelector('.yellow-box');

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
                                const nextRect = nextItem.section.getBoundingClientRect();

                                if (nextRect.top <= triggerStart && nextRect.top >= triggerEnd) {
                                    wipeProgress = (triggerStart - nextRect.top) / (triggerStart - triggerEnd);
                                    wipeProgress = Math.max(0, Math.min(1, wipeProgress));
                                } else if (nextRect.top < triggerEnd) {
                                    wipeProgress = 1;
                                } else if (nextRect.top > triggerStart) {
                                    wipeProgress = 0;
                                }
                            }

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
                            // セクション3→4, 4→5, 5→6, 6→7の特別処理: 前セクションのコンテンツ下端を基準にワイプ
                            const prevSection = currentItem.section;
                            const contentWithImages = prevSection.querySelector('.content-with-images');

                            let wipeProgress = 0;

                            if (contentWithImages) {
                                // コンテンツ下端位置を取得
                                const contentRect = contentWithImages.getBoundingClientRect();
                                const contentBottom = contentRect.bottom;

                                // コンテンツ下端に15vhのオフセットを加える
                                const buffer = windowHeight * 0.15;  // 15vhのバッファ
                                const adjustedBottom = contentBottom + buffer;  // 15vh下に余裕を持たせる

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
                                // フォールバック: コンテンツが見つからない場合は従来方式
                                const nextRect = nextItem.section.getBoundingClientRect();

                                if (nextRect.top <= triggerStart && nextRect.top >= triggerEnd) {
                                    wipeProgress = (triggerStart - nextRect.top) / (triggerStart - triggerEnd);
                                    wipeProgress = Math.max(0, Math.min(1, wipeProgress));
                                } else if (nextRect.top < triggerEnd) {
                                    wipeProgress = 1;
                                } else if (nextRect.top > triggerStart) {
                                    wipeProgress = 0;
                                }
                            }

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
                        const item = sectionsWithBg[i];
                        const itemRect = item.section.getBoundingClientRect();

                        if (itemRect.bottom > 0 && itemRect.top < windowHeight) {
                            const sectionProgress = Math.max(0, Math.min(1,
                                (windowHeight - itemRect.top) / (windowHeight + itemRect.height)
                            ));
                            const scale = 1.0 + (sectionProgress * 0.2); // 1.0 → 1.2 ズームイン

                            if (item.isMainTile) {
                                const mainTileImg = mainTile.querySelector('img');
                                if (mainTileImg) {
                                    mainTileImg.style.transform = `scale(${scale})`;
                                }
                            } else if (item.bgElement) {
                                item.bgElement.style.transform = `scale(${scale})`;
                                item.bgElement.style.transformOrigin = 'center center';
                            }
                        }
                    }
                }

                window.addEventListener('scroll', function() {
                    updateAutoWipeEffects();
                });
                updateAutoWipeEffects(); // 初期実行

                // リサイズイベント: 拡大完了後のタイルサイズを更新
                window.addEventListener('resize', () => {
                    if (expansionComplete && mainTile) {
                        mainTile.style.width = window.innerWidth + 'px';
                        mainTile.style.height = window.innerHeight + 'px';
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
        const now = Date.now();
        const scrollY = window.pageYOffset;

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

    window.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        touchVelocity = 0;
        lastTouchTime = Date.now();

        // 慣性スクロールを停止
        if (inertiaAnimationId) {
            cancelAnimationFrame(inertiaAnimationId);
            inertiaAnimationId = null;
        }
    }, { passive: true });

    window.addEventListener('touchmove', function(e) {
        const scrollY = window.pageYOffset;
        const prevY = touchCurrentY;
        touchCurrentY = e.touches[0].clientY;
        const deltaY = touchStartY - touchCurrentY;
        const instantDelta = prevY - touchCurrentY;

        // 拡大中または拡大完了後の上スワイプ
        if ((isExpanding && virtualScroll < expansionScrollAmount) ||
            (!isExpanding && virtualScroll > 0 && deltaY < 0 && scrollY === 0)) {

            e.preventDefault();

            virtualScroll += instantDelta * 4; // タッチは感度を上げる
            virtualScroll = Math.max(0, Math.min(virtualScroll, expansionScrollAmount));

            // 速度を記録（慣性用）
            const now = Date.now();
            const timeDelta = now - lastTouchTime;
            if (timeDelta > 0 && timeDelta < 100) { // 100ms以内の移動のみ考慮
                touchVelocity = instantDelta * 4; // フレームごとの移動量
            }
            lastTouchTime = now;

            // 逆スワイプで拡大モードに戻る
            if (!isExpanding && virtualScroll < expansionScrollAmount && deltaY < 0) {
                isExpanding = true;
                expansionComplete = false;
            }

            updateTileGrid();

        } else if (virtualScroll >= expansionScrollAmount && deltaY > 0) {
            isExpanding = false;
        }
    }, { passive: false });

    window.addEventListener('touchend', function() {
        // 慣性スクロールを開始
        if (Math.abs(touchVelocity) > 1 && isExpanding && virtualScroll < expansionScrollAmount) {
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
    }, { passive: true });

    // 通常のスクロールイベント（拡大完了後）
    let ticking = false;
    let lastScrollY = 0;
    let isResetting = false;

    window.addEventListener('scroll', function() {
        const scrollY = window.pageYOffset;

        // トップに戻ったときに拡大エフェクトをリセット
        if (scrollY === 0 && expansionComplete && virtualScroll > 0 && !isResetting) {
            isResetting = true;
            virtualScroll = 0;
            isExpanding = true;
            expansionComplete = false;
            initialPositions = [];

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
                    isResetting = false;
                    lastScrollY = 0;
                });
            });
        }

        // スクロールによる拡大エフェクト（ホイール以外の入力対応）
        if (isExpanding && scrollY > 0 && initialPositions.length > 0 && !isResetting) {
            const deltaScroll = scrollY - lastScrollY;
            if (deltaScroll > 0) {
                virtualScroll += deltaScroll;
                virtualScroll = Math.max(0, Math.min(virtualScroll, expansionScrollAmount));
                updateTileGrid();
                if (virtualScroll >= expansionScrollAmount) {
                    isExpanding = false;
                    expansionComplete = true;
                }
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
        zoomImages.forEach(img => {
            const rect = img.getBoundingClientRect();
            const windowHeight = window.innerHeight;

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
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight - windowHeight;
        const scrolled = (window.pageYOffset / documentHeight) * 100;
        progressBar.style.width = scrolled + '%';
    });

    // スクロールで背景画像を切り替え
    function updateBackgroundOnScroll() {
        const scrollY = window.pageYOffset;
        const heroHeight = document.querySelector('.hero-dynamic').offsetHeight;

        // ヒーローセクションを通過していない場合は何もしない
        if (scrollY < heroHeight - 200) {
            return;
        }

        const windowHeight = window.innerHeight;

        // 全セクションの進行度を計算（統一的に処理）
        textSections.forEach((section, sectionIndex) => {
            const rect = section.getBoundingClientRect();
            const img = sectionToBgMap.get(sectionIndex); // Mapから正しい画像を取得

            // purposeセクション（index=0）のミサイル背景のワイプ制御
            if (sectionIndex === 0 && missileBackground) {
                // セクション2が上がってくる際のワイプアウト処理（メインタイルと同じロジック）
                if (textSections[1]) {
                    const section2Rect = textSections[1].getBoundingClientRect();
                    const triggerStart = windowHeight;  // 画面下端
                    const triggerEnd = windowHeight * 0.2;  // 画面上部20%

                    let wipeProgress = 0;

                    if (section2Rect.top <= triggerStart && section2Rect.top >= triggerEnd) {
                        wipeProgress = (triggerStart - section2Rect.top) / (triggerStart - triggerEnd);
                        wipeProgress = Math.max(0, Math.min(1, wipeProgress));
                    } else if (section2Rect.top < triggerEnd) {
                        wipeProgress = 1;
                    }

                    // 下から上にワイプアウト（メインタイルと同じ）
                    const clipValue = wipeProgress * 100;
                    missileBackground.style.clipPath = `inset(0 0 ${clipValue}% 0)`;
                } else {
                    // セクション2がまだ存在しない場合は完全表示
                    missileBackground.style.clipPath = 'inset(0 0 0 0)';
                }
            }

            // 背景画像の処理（data-bg属性があるセクションのみ）
            if (img) {

            // セクションが画面下部から現れ始めるタイミングを計算
            // セクション2の場合は、ワイプアウトと完全に同じrectを使用して同期
            const currentRect = (sectionIndex === 1 && textSections[1]) ? textSections[1].getBoundingClientRect() : rect;

            // ワイプインを少し早めに開始（灰色の隙間を防ぐため）
            const offset = (sectionIndex === 1) ? 20 : 0;  // セクション2のみ20px早く開始
            const triggerStart = windowHeight + offset;  // 画面下端より少し下から開始
            const triggerEnd = windowHeight * 0.2;  // 画面上部20%の位置

            let progress = 0;

            if (currentRect.top <= triggerStart && currentRect.top >= triggerEnd) {
                // セクションが画面下から上がってくる間
                progress = (triggerStart - currentRect.top) / (triggerStart - triggerEnd);
                progress = Math.max(0, Math.min(1, progress));
            } else if (currentRect.top < triggerEnd) {
                // セクションが完全に上がりきった
                progress = 1;
            }

            // clip-pathで下から徐々に表示
            const clipValue = 100 - (progress * 100);
            img.style.clipPath = `inset(${clipValue}% 0 0 0)`;

            // 進行度が10%以上でactiveクラスを追加（z-index管理用）
            if (progress > 0.1) {
                img.classList.add('active');
            } else {
                img.classList.remove('active');
            }

            // スクロールに応じてズームエフェクトを追加
            // セクションが画面内にある間、セクションの位置に応じてズーム（1.0 → 1.1）
            const sectionTop = rect.top;
            const sectionBottom = rect.bottom;

            if (sectionBottom > 0 && sectionTop < windowHeight) {
                // セクション全体の進行度（画面下から上へ移動する割合）
                const sectionProgress = Math.max(0, Math.min(1,
                    (windowHeight - sectionTop) / (windowHeight + rect.height)
                ));

                // 1.0から1.2までズーム
                const scale = 1.0 + (sectionProgress * 0.2);
                img.style.transform = `scale(${scale})`;
            }
            } // 背景画像処理の終了

            // テキストコンテンツのフェードイン制御（全セクション共通）
            const textParagraphs = section.querySelectorAll('.content-with-images > p');

            if (textParagraphs.length > 0) {
                // セクション3, 4, 5, 6, 7ではテキストフェードアニメーションを無効化
                if (section.id === 'section-3' || section.id === 'section-4' ||
                    section.id === 'section-5' || section.id === 'section-6' || section.id === 'section-7') {
                    textParagraphs.forEach((p, idx) => {
                        p.classList.remove('fade-hidden');
                        p.classList.add('fade-visible');
                    });
                } else {
                    const textTrigger = windowHeight * 0.7;
                    // セクションが画面内にあり、かつ完全に通過していない場合に表示
                    const isInViewport = rect.top <= textTrigger && rect.bottom > windowHeight * 0.3;

                    textParagraphs.forEach((p, idx) => {
                        if (isInViewport) {
                            // フェードイン
                            p.classList.remove('fade-hidden');
                            p.classList.add('fade-visible');
                        } else {
                            // フェードアウト
                            p.classList.remove('fade-visible');
                            p.classList.add('fade-hidden');
                        }
                    });
                }
            }

            // section-1の5段階スクロール制御（switch-case + 遷移phase）
            if (sectionIndex === 0) {
                const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
                const heroHeight = windowHeight * 1.8; // hero-dynamicの高さ（180vh）

                // data属性からタイムライン係数を読み取り
                const textStartCoeff = parseFloat(section.dataset.timelineTextStart || '1.0');
                const missileStartCoeff = parseFloat(section.dataset.timelineMissileStart || '2.0');
                const missileEndCoeff = parseFloat(section.dataset.timelineMissileEnd || '3.0');
                const wipeStartCoeff = parseFloat(section.dataset.timelineWipeStart || '4.0');

                // タイムライン定義
                const timeline = {
                    textStart: heroHeight * textStartCoeff,      // テキスト移動開始
                    missileStart: heroHeight * missileStartCoeff,   // ミサイルフェード開始
                    missileEnd: heroHeight * missileEndCoeff,     // ミサイルフェード完了
                    wipeStart: heroHeight * wipeStartCoeff       // ワイプ開始（transition開始）
                };

                // テキスト制御
                const purposeText = section.querySelector('.text-content');
                if (purposeText) {
                    const MOVE_SPEED_RATIO = 112.5; // vh per screen height（一定の移動速度）

                    // 現在どの段階にいるか判定（5段階phase）
                    const sectionPhase =
                        currentScroll < timeline.textStart ? 0 :      // Phase 0: idle
                        currentScroll < timeline.missileStart ? 1 :   // Phase 1: textSlideInAndStop
                        currentScroll < timeline.missileEnd ? 2 :     // Phase 2: missileActive
                        currentScroll < timeline.wipeStart ? 3 :      // Phase 3: waiting
                        4;                                            // Phase 4: transition（ワイプ許可）

                    switch (sectionPhase) {
                        case 0: // Phase 0: idle（未開始）
                            purposeText.style.opacity = '0';
                            purposeText.style.position = 'fixed';
                            purposeText.style.top = '100vh';
                            purposeText.style.paddingTop = '0';
                            break;

                        case 1: // Phase 1: textSlideInAndStop（テキスト移動＋停止）
                            const fadeProgress1 = Math.min(1, (currentScroll - timeline.textStart) / (windowHeight * 0.2));
                            purposeText.style.opacity = String(fadeProgress1);
                            purposeText.style.position = 'fixed';

                            // 一定速度で移動
                            const scrollDistance1 = (currentScroll - timeline.textStart) / windowHeight;
                            let topPosition1 = 100 - (scrollDistance1 * MOVE_SPEED_RATIO);

                            // クランプ処理：10vhを下回ったら10vhで停止
                            if (topPosition1 < 10) {
                                topPosition1 = 10;
                            }

                            purposeText.style.top = `${topPosition1}vh`;
                            purposeText.style.paddingTop = '0';
                            break;

                        case 2: // Phase 2: missileActive（ミサイルフェード進行中）
                        case 3: // Phase 3: waiting（全て完了、待機期間）
                        case 4: // Phase 4: transition（ワイプ許可）
                            purposeText.style.opacity = '1';
                            purposeText.style.position = 'fixed';
                            purposeText.style.top = '10vh';
                            purposeText.style.paddingTop = '0';
                            break;
                    }
                }

                // ミサイル制御
                if (missileBackground) {
                    const sectionPhase =
                        currentScroll < timeline.textStart ? 0 :
                        currentScroll < timeline.missileStart ? 1 :
                        currentScroll < timeline.missileEnd ? 2 :
                        currentScroll < timeline.wipeStart ? 3 :
                        4;

                    switch (sectionPhase) {
                        case 0: // Phase 0: idle
                        case 1: // Phase 1: textSlideInAndStop（ミサイルはまだ非表示）
                            missileBackground.style.opacity = '0';
                            break;

                        case 2: // Phase 2: missileActive（ミサイルフェード進行中）
                            const progress2 = (currentScroll - timeline.missileStart) / (timeline.missileEnd - timeline.missileStart);
                            const missileOpacity2 = Math.max(0, Math.min(1.0, progress2 * 1.0));
                            missileBackground.style.opacity = String(missileOpacity2);
                            break;

                        case 3: // Phase 3: waiting
                        case 4: // Phase 4: transition
                            missileBackground.style.opacity = '1.0';
                            break;
                    }

                    // pointer-events制御: opacity > 0.1の時だけカーソルインタラクションを有効化
                    const missileOpacityValue = parseFloat(missileBackground.style.opacity) || 0;
                    if (missileOpacityValue <= 0.1) {
                        missileBackground.style.pointerEvents = 'none';
                    } else {
                        missileBackground.style.pointerEvents = 'auto';
                    }
                }
            }

            // ミサイルフェードセクション（.missile-fade-section）の汎用アニメーション制御
            if (section.classList.contains('missile-fade-section')) {
                const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
                const heroHeight = windowHeight * 1.8; // hero-dynamicの高さ（180vh）
                const sectionOffsetTop = section.offsetTop;

                // テキストのスライドイン・固定制御
                const sectionText = section.querySelector('.text-content');
                if (sectionText) {
                    // セクション2はtextRect-based clamp方式、他はpaddingTop方式
                    if (section.id === 'section-2') {
                        // セクション2のタイムライン構造（絶対位置方式）
                        const MOVE_SPEED_RATIO = 112.5; // vh per screen height（一定の移動速度）

                        // data属性からすべてのタイムラインイベントを動的に読み取り
                        const timelineEvents = [];
                        for (const key in section.dataset) {
                            if (key.startsWith('timeline')) {
                                const eventName = key.replace('timeline', '');
                                const coeff = parseFloat(section.dataset[key]);
                                // キャメルケースをケバブケースに変換（例: TextStart -> text-start）
                                const kebabName = eventName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
                                const scrollPos = sectionOffsetTop + heroHeight * coeff - windowHeight;

                                timelineEvents.push({
                                    name: kebabName,
                                    coeff: coeff,
                                    scrollPos: scrollPos
                                });
                            }
                        }

                        // 係数順にソート
                        timelineEvents.sort((a, b) => a.coeff - b.coeff);

                        // すべてのタイムラインイベントを同一概念のphaseとして処理
                        // 各イベントに到達したかチェックし、対応する処理を実行

                        // レイヤー要素を取得
                        const animatedLayers = section.querySelectorAll('.cyber-layer-animated');

                        // 各イベントを評価
                        timelineEvents.forEach(event => {
                            const isActive = currentScroll >= event.scrollPos;

                            // レイヤーイベント（2-1, 2-2, ...）の処理
                            if (event.name.match(/^\d+-\d+$/)) {
                                const targetLayer = Array.from(animatedLayers).find(layer => {
                                    const layerId = layer.alt.replace('レイヤー', '');
                                    return layerId === event.name;
                                });

                                if (targetLayer) {
                                    const order = parseInt(targetLayer.dataset.order);

                                    // すべてのアニメーションレイヤーでスクロール進行度を計算
                                    if (order >= 1 && order <= 12) {
                                        // 次のイベントを取得（同じscrollPosのイベントはスキップ）
                                        const currentIndex = timelineEvents.indexOf(event);
                                        let nextEvent = null;
                                        for (let i = currentIndex + 1; i < timelineEvents.length; i++) {
                                            if (timelineEvents[i].scrollPos > event.scrollPos) {
                                                nextEvent = timelineEvents[i];
                                                break;
                                            }
                                        }
                                        const nextScrollPos = nextEvent ? nextEvent.scrollPos : event.scrollPos + windowHeight;

                                        // 進行度を計算（0.0 ～ 1.0）
                                        const distance = nextScrollPos - event.scrollPos;
                                        const progress = distance > 0 ? Math.max(0, Math.min(1,
                                            (currentScroll - event.scrollPos) / distance
                                        )) : 1;

                                        // CSS変数として進行度を設定
                                        targetLayer.style.setProperty('--effect-progress', progress);

                                        if (currentScroll >= event.scrollPos) {
                                            targetLayer.classList.add('active');
                                        } else {
                                            targetLayer.classList.remove('active');
                                        }
                                    } else {
                                        // その他のレイヤーは従来通り
                                        if (isActive) {
                                            targetLayer.classList.add('active');
                                        } else {
                                            targetLayer.classList.remove('active');
                                        }
                                    }
                                }
                            }
                        });

                        // テキストコンテンツの位置制御（既存のPhase境界を使用）
                        const textStart = timelineEvents.find(e => e.name === 'text-start');
                        const titleStop = timelineEvents.find(e => e.name === 'title-stop');
                        const resumeStart = timelineEvents.find(e => e.name === 'resume-start');
                        const topicsStop = timelineEvents.find(e => e.name === 'topics-stop');
                        const wipeStart = timelineEvents.find(e => e.name === 'wipe-start');

                        if (currentScroll < (textStart ? textStart.scrollPos : 0)) {
                            // Phase: text-start前（idle）
                            sectionText.style.opacity = '0';
                            sectionText.style.position = 'fixed';
                            sectionText.style.top = '100vh';
                            sectionText.style.paddingTop = '0';
                        } else if (currentScroll < (titleStop ? titleStop.scrollPos : Infinity)) {
                            // Phase: text-start ～ title-stop（slideToStop）
                            const textStartPos = textStart ? textStart.scrollPos : 0;
                            const fadeProgress1 = Math.min(1, (currentScroll - textStartPos) / (windowHeight * 0.2));
                            sectionText.style.opacity = String(fadeProgress1);
                            sectionText.style.position = 'fixed';

                            // 一定速度で移動
                            const scrollDistance1 = (currentScroll - textStartPos) / windowHeight;
                            let top1 = 100 - (scrollDistance1 * MOVE_SPEED_RATIO);

                            // クランプ処理：青紫枠の上下中央が50vhになる位置で停止
                            const blueVioletBox = section.querySelector('.blue-violet-box');
                            if (blueVioletBox) {
                                const wrapperRect = blueVioletBox.getBoundingClientRect();
                                const textContentRect = sectionText.getBoundingClientRect();

                                // 青紫枠の上下中央位置を計算（vh単位）
                                const wrapperCenterRelativeToText = ((wrapperRect.top + wrapperRect.bottom) / 2 - textContentRect.top) / windowHeight * 100;

                                // 青紫枠の上下中央が50vhになるtop値
                                const maxTop = 50 - wrapperCenterRelativeToText;

                                if (top1 < maxTop) {
                                    top1 = maxTop;
                                }
                            }

                            sectionText.style.top = `${top1}vh`;
                            sectionText.style.paddingTop = '0';
                        } else if (currentScroll < (resumeStart ? resumeStart.scrollPos : Infinity)) {
                            // Phase: title-stop ～ resume-start（青紫枠停止期間）
                            sectionText.style.opacity = '1';
                            sectionText.style.position = 'fixed';

                            // 青紫枠の上下中央が50vhになる位置を計算
                            let titleStopPosition = 10; // デフォルト値
                            const blueVioletBox2 = section.querySelector('.blue-violet-box');
                            if (blueVioletBox2) {
                                const wrapperRect2 = blueVioletBox2.getBoundingClientRect();
                                const textContentRect2 = sectionText.getBoundingClientRect();
                                const wrapperCenterRelativeToText2 = ((wrapperRect2.top + wrapperRect2.bottom) / 2 - textContentRect2.top) / windowHeight * 100;
                                titleStopPosition = 50 - wrapperCenterRelativeToText2;
                            }

                            sectionText.style.top = `${titleStopPosition}vh`;
                            sectionText.style.paddingTop = '0';
                        } else {
                            // Phase: resume-start以降（継続的に上に移動、停止なし）
                            sectionText.style.opacity = '1';
                            sectionText.style.position = 'fixed';

                            // 青紫枠の上下中央が50vhになる停止位置を計算（再開時の初期位置として使用）
                            let titleStopPosition3 = 10;
                            const blueVioletBox3 = section.querySelector('.blue-violet-box');
                            if (blueVioletBox3) {
                                const wrapperRect3 = blueVioletBox3.getBoundingClientRect();
                                const textContentRect3 = sectionText.getBoundingClientRect();
                                const wrapperCenterRelativeToText3 = ((wrapperRect3.top + wrapperRect3.bottom) / 2 - textContentRect3.top) / windowHeight * 100;
                                titleStopPosition3 = 50 - wrapperCenterRelativeToText3;
                            }

                            // 一定速度で移動（継続）- クランプ処理なし
                            const resumeStartPos = resumeStart ? resumeStart.scrollPos : 0;
                            const scrollDistance3 = (currentScroll - resumeStartPos) / windowHeight;
                            let top3 = titleStopPosition3 - (scrollDistance3 * MOVE_SPEED_RATIO);

                            // クランプ処理を削除：黄色枠は継続的に上に流れる
                            // topics-stopを使用しない新方針により、停止なし

                            sectionText.style.top = `${top3}vh`;
                            sectionText.style.paddingTop = '0';
                        }

                        // 以下の旧Phase（topics-stop ～ wipe-start、wipe-start以降）は削除
                        /*
                        } else if (currentScroll < (wipeStart ? wipeStart.scrollPos : Infinity)) {
                            // Phase: topics-stop ～ wipe-start（下マゼンタ枠停止期間）
                            sectionText.style.opacity = '1';
                            sectionText.style.position = 'fixed';

                            // 下側のマゼンタ枠下端が100vhになる位置を計算
                            let topicsStopPosition = 10; // デフォルト値
                            const fourTopicsContainer4 = section.querySelector('.yellow-box');
                            if (fourTopicsContainer4) {
                                const topicItems4 = fourTopicsContainer4.querySelectorAll('.magenta-box');
                                if (topicItems4.length >= 2) {
                                    const bottomTopicItem4 = topicItems4[topicItems4.length - 1];
                                    const itemRect4 = bottomTopicItem4.getBoundingClientRect();
                                    const textContentRect4 = sectionText.getBoundingClientRect();
                                    const itemBottomRelativeToText4 = (itemRect4.bottom - textContentRect4.top) / windowHeight * 100;
                                    topicsStopPosition = 100 - itemBottomRelativeToText4;
                                }
                            }

                            sectionText.style.top = `${topicsStopPosition}vh`;
                            sectionText.style.paddingTop = '0';
                        } else {
                            // Phase: wipe-start以降（transition上昇継続）
                            sectionText.style.opacity = '1';
                            sectionText.style.position = 'fixed';

                            // 下側のマゼンタ枠停止位置を計算
                            let topicsStopPosition5 = 10; // デフォルト値
                            const fourTopicsContainer5 = section.querySelector('.yellow-box');
                            if (fourTopicsContainer5) {
                                const topicItems5 = fourTopicsContainer5.querySelectorAll('.magenta-box');
                                if (topicItems5.length >= 2) {
                                    const bottomTopicItem5 = topicItems5[topicItems5.length - 1];
                                    const itemRect5 = bottomTopicItem5.getBoundingClientRect();
                                    const textContentRect5 = sectionText.getBoundingClientRect();
                                    const itemBottomRelativeToText5 = (itemRect5.bottom - textContentRect5.top) / windowHeight * 100;
                                    topicsStopPosition5 = 95 - itemBottomRelativeToText5;
                                }
                            }

                            // 一定速度で移動継続
                            const wipeStartPos = wipeStart ? wipeStart.scrollPos : 0;
                            const scrollDistance5 = (currentScroll - wipeStartPos) / windowHeight;
                            const top5 = topicsStopPosition5 - (scrollDistance5 * MOVE_SPEED_RATIO);

                            sectionText.style.top = `${top5}vh`;
                            sectionText.style.paddingTop = '0';
                        }
                        */
                    } else if (section.id === 'section-3') {
                        // セクション3: 黄色枠の位置に同期してスライドイン開始し、その後も継続的に流れ続ける
                        const MOVE_SPEED_RATIO = 112.5;
                        const section2 = document.querySelector('#section-2');
                        const yellowBox = section2 ? section2.querySelector('.yellow-box') : null;

                        if (yellowBox) {
                            // 黄色枠の下端位置を取得
                            const yellowBoxRect = yellowBox.getBoundingClientRect();
                            const yellowBoxBottom = yellowBoxRect.bottom;

                            // 黄色枠の下端に15vhのオフセットを加える
                            const buffer = windowHeight * 0.15;  // 15vhのバッファ
                            const adjustedBottom = yellowBoxBottom + buffer;  // 15vh下に余裕を持たせる

                            // 調整後の位置が画面下端に到達した時点からの経過スクロール量を計算
                            const customTriggerStart = windowHeight;  // 100vh (画面下端)

                            // 調整後の位置が画面下端より上にある場合のみ処理
                            if (adjustedBottom <= customTriggerStart) {
                                // 調整後の位置が画面下端から上にどれだけ移動したかを計算（無制限）
                                const scrolledDistance = (customTriggerStart - adjustedBottom) / windowHeight;

                                // コンテンツの進行度をワイプより少し遅らせる（0.8倍で少し下に）
                                const contentProgress = scrolledDistance * 0.8;

                                // スクロール距離に応じてテキスト位置を計算（停止せずに流れ続ける）
                                const topPosition = 100 - (contentProgress * MOVE_SPEED_RATIO);

                                // フェードイン（最初の20%で完了）
                                const fadeProgress = Math.min(1, contentProgress / 0.2);

                                sectionText.style.opacity = String(fadeProgress);
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = `${topPosition}vh`;
                                sectionText.style.paddingTop = '0';
                            } else {
                                // まだ開始前
                                sectionText.style.opacity = '0';
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = '100vh';
                                sectionText.style.paddingTop = '0';
                            }
                        } else {
                            // フォールバック: 黄色枠が見つからない場合
                            sectionText.style.opacity = '0';
                            sectionText.style.position = 'fixed';
                            sectionText.style.top = '100vh';
                            sectionText.style.paddingTop = '0';
                        }
                    } else if (section.id === 'section-4') {
                        // セクション4: セクション3のコンテンツ下端に同期してスライドイン
                        const MOVE_SPEED_RATIO = 112.5;
                        const section3 = document.querySelector('#section-3');
                        const prevContent = section3 ? section3.querySelector('.content-with-images') : null;

                        if (prevContent) {
                            const prevContentRect = prevContent.getBoundingClientRect();
                            const prevContentBottom = prevContentRect.bottom;

                            // コンテンツ下端に15vhのオフセットを加える
                            const buffer = windowHeight * 0.15;  // 15vhのバッファ
                            const adjustedBottom = prevContentBottom + buffer;  // 15vh下に余裕を持たせる

                            const customTriggerStart = windowHeight;

                            if (adjustedBottom <= customTriggerStart) {
                                const scrolledDistance = (customTriggerStart - adjustedBottom) / windowHeight;
                                const contentProgress = scrolledDistance * 0.8;
                                const topPosition = 100 - (contentProgress * MOVE_SPEED_RATIO);
                                const fadeProgress = Math.min(1, contentProgress / 0.2);

                                sectionText.style.opacity = String(fadeProgress);
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = `${topPosition}vh`;
                                sectionText.style.paddingTop = '0';
                            } else {
                                sectionText.style.opacity = '0';
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = '100vh';
                                sectionText.style.paddingTop = '0';
                            }
                        } else {
                            sectionText.style.opacity = '0';
                            sectionText.style.position = 'fixed';
                            sectionText.style.top = '100vh';
                            sectionText.style.paddingTop = '0';
                        }
                    } else if (section.id === 'section-5') {
                        // セクション5: セクション4のコンテンツ下端に同期してスライドイン
                        const MOVE_SPEED_RATIO = 112.5;
                        const section4 = document.querySelector('#section-4');
                        const prevContent = section4 ? section4.querySelector('.content-with-images') : null;

                        if (prevContent) {
                            const prevContentRect = prevContent.getBoundingClientRect();
                            const prevContentBottom = prevContentRect.bottom;

                            // コンテンツ下端に15vhのオフセットを加える
                            const buffer = windowHeight * 0.15;  // 15vhのバッファ
                            const adjustedBottom = prevContentBottom + buffer;  // 15vh下に余裕を持たせる

                            const customTriggerStart = windowHeight;

                            if (adjustedBottom <= customTriggerStart) {
                                const scrolledDistance = (customTriggerStart - adjustedBottom) / windowHeight;
                                const contentProgress = scrolledDistance * 0.8;
                                const topPosition = 100 - (contentProgress * MOVE_SPEED_RATIO);
                                const fadeProgress = Math.min(1, contentProgress / 0.2);

                                sectionText.style.opacity = String(fadeProgress);
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = `${topPosition}vh`;
                                sectionText.style.paddingTop = '0';
                            } else {
                                sectionText.style.opacity = '0';
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = '100vh';
                                sectionText.style.paddingTop = '0';
                            }
                        } else {
                            sectionText.style.opacity = '0';
                            sectionText.style.position = 'fixed';
                            sectionText.style.top = '100vh';
                            sectionText.style.paddingTop = '0';
                        }
                    } else if (section.id === 'section-6') {
                        // セクション6: セクション5のコンテンツ下端に同期してスライドイン
                        const MOVE_SPEED_RATIO = 112.5;
                        const section5 = document.querySelector('#section-5');
                        const prevContent = section5 ? section5.querySelector('.content-with-images') : null;

                        if (prevContent) {
                            const prevContentRect = prevContent.getBoundingClientRect();
                            const prevContentBottom = prevContentRect.bottom;

                            // コンテンツ下端に15vhのオフセットを加える
                            const buffer = windowHeight * 0.15;  // 15vhのバッファ
                            const adjustedBottom = prevContentBottom + buffer;  // 15vh下に余裕を持たせる

                            const customTriggerStart = windowHeight;

                            if (adjustedBottom <= customTriggerStart) {
                                const scrolledDistance = (customTriggerStart - adjustedBottom) / windowHeight;
                                const contentProgress = scrolledDistance * 0.8;
                                const topPosition = 100 - (contentProgress * MOVE_SPEED_RATIO);
                                const fadeProgress = Math.min(1, contentProgress / 0.2);

                                sectionText.style.opacity = String(fadeProgress);
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = `${topPosition}vh`;
                                sectionText.style.paddingTop = '0';
                            } else {
                                sectionText.style.opacity = '0';
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = '100vh';
                                sectionText.style.paddingTop = '0';
                            }
                        } else {
                            sectionText.style.opacity = '0';
                            sectionText.style.position = 'fixed';
                            sectionText.style.top = '100vh';
                            sectionText.style.paddingTop = '0';
                        }
                    } else if (section.id === 'section-7') {
                        // セクション7: セクション6のコンテンツ下端に同期してスライドイン
                        const MOVE_SPEED_RATIO = 112.5;
                        const section6 = document.querySelector('#section-6');
                        const prevContent = section6 ? section6.querySelector('.content-with-images') : null;

                        if (prevContent) {
                            const prevContentRect = prevContent.getBoundingClientRect();
                            const prevContentBottom = prevContentRect.bottom;

                            // コンテンツ下端に15vhのオフセットを加える
                            const buffer = windowHeight * 0.15;  // 15vhのバッファ
                            const adjustedBottom = prevContentBottom + buffer;  // 15vh下に余裕を持たせる

                            const customTriggerStart = windowHeight;

                            if (adjustedBottom <= customTriggerStart) {
                                const scrolledDistance = (customTriggerStart - adjustedBottom) / windowHeight;
                                const contentProgress = scrolledDistance * 0.8;
                                const topPosition = 100 - (contentProgress * MOVE_SPEED_RATIO);
                                const fadeProgress = Math.min(1, contentProgress / 0.2);

                                sectionText.style.opacity = String(fadeProgress);
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = `${topPosition}vh`;
                                sectionText.style.paddingTop = '0';
                            } else {
                                sectionText.style.opacity = '0';
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = '100vh';
                                sectionText.style.paddingTop = '0';
                            }
                        } else {
                            sectionText.style.opacity = '0';
                            sectionText.style.position = 'fixed';
                            sectionText.style.top = '100vh';
                            sectionText.style.paddingTop = '0';
                        }
                    } else {
                        // セクション4のタイムライン構造（絶対位置方式）
                        const MOVE_SPEED_RATIO = 112.5; // vh per screen height（一定の移動速度）

                        // data属性からタイムライン係数を読み取り
                        const textStartCoeff = parseFloat(section.dataset.timelineTextStart || '0.0');
                        const wipeStartCoeff = parseFloat(section.dataset.timelineWipeStart || '3.0');

                        // タイムライン定義（セクション開始位置を0とした相対係数）
                        const timeline = {
                            textStart: sectionOffsetTop + heroHeight * textStartCoeff - windowHeight,  // テキスト移動開始
                            wipeStart: sectionOffsetTop + heroHeight * wipeStartCoeff - windowHeight  // ワイプ開始
                        };

                        // 現在どの段階にいるか判定（3段階phase）
                        const sectionPhase =
                            currentScroll < timeline.textStart ? 0 :      // Phase 0: idle
                            currentScroll < timeline.wipeStart ? 1 :      // Phase 1: slideAndStop（移動＋停止）
                            2;                                            // Phase 2: transition

                        switch (sectionPhase) {
                            case 0: // Phase 0: idle（未開始）
                                sectionText.style.opacity = '0';
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = '100vh';
                                sectionText.style.paddingTop = '0';
                                break;

                            case 1: // Phase 1: slideAndStop（100vh → 10vh、クランプで停止）
                                const fadeProgress1 = Math.min(1, (currentScroll - timeline.textStart) / (windowHeight * 0.2));
                                sectionText.style.opacity = String(fadeProgress1);
                                sectionText.style.position = 'fixed';

                                // 一定速度で移動
                                const scrollDistance1 = (currentScroll - timeline.textStart) / windowHeight;
                                let topPosition1 = 100 - (scrollDistance1 * MOVE_SPEED_RATIO);

                                // クランプ処理：10vhを下回ったら10vhで停止
                                if (topPosition1 < 10) {
                                    topPosition1 = 10;
                                }

                                sectionText.style.top = `${topPosition1}vh`;
                                sectionText.style.paddingTop = '0';
                                break;

                            case 2: // Phase 2: transition（10vhで固定）
                                sectionText.style.opacity = '1';
                                sectionText.style.position = 'fixed';
                                sectionText.style.top = '10vh';
                                sectionText.style.paddingTop = '0';
                                break;
                        }
                    }
                }

                // ミサイルのフェードイン制御
                const sectionMissile = section.querySelector('.missile-background');
                if (sectionMissile) {
                    let missileOpacity = 0;

                    // テキストが固定された後にミサイルをフェードイン
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

                    // pointer-events制御: opacity > 0.1の時だけカーソルインタラクションを有効化
                    if (missileOpacity <= 0.1) {
                        sectionMissile.style.pointerEvents = 'none';
                    } else {
                        sectionMissile.style.pointerEvents = 'auto';
                    }
                }
            }

            // セクションタイトルの一文字ずつ表示アニメーション
            const sectionTitle = section.querySelector('.section-title-animated');
            if (sectionTitle) {
                // セクション3, 4, 5, 6, 7ではタイトルフェードアニメーションを無効化
                if (section.id === 'section-3' || section.id === 'section-4' ||
                    section.id === 'section-5' || section.id === 'section-6' || section.id === 'section-7') {
                    const titleChars = sectionTitle.querySelectorAll('span');
                    titleChars.forEach(char => {
                        char.classList.remove('fade-hidden');
                        char.classList.add('fade-visible');
                    });
                } else {
                    const titleChars = sectionTitle.querySelectorAll('span');
                    const titleTrigger = windowHeight * 0.8; // より手前で開始

                    if (rect.top <= titleTrigger) {
                        // セクションが画面内に入ったら、スクロール位置に応じて一文字ずつ表示
                        const scrollDistance = titleTrigger - rect.top;
                        const totalDistance = windowHeight * 0.8; // アニメーション完了までの距離（0.4→0.8に変更してゆっくりに）
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
                        // まだ画面外の場合は非表示
                        titleChars.forEach(char => {
                            char.classList.remove('fade-visible');
                            char.classList.add('fade-hidden');
                        });
                    }
                }
            }
        });
    }

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
        const windowHeight = window.innerHeight;
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

    // ウィンドウリサイズ時に再計算
    window.addEventListener('resize', function() {
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
    requestAnimationFrame(() => {
        document.body.style.setProperty('--fade-transition-time', '3s');
        updateBackgroundOnScroll();
    });

    // 遅延実行で確実にチェック
    requestAnimationFrame(() => {
        updateBackgroundOnScroll();
    });

    setTimeout(updateBackgroundOnScroll, 50);
    setTimeout(updateBackgroundOnScroll, 100);
    setTimeout(updateBackgroundOnScroll, 200);
    setTimeout(updateBackgroundOnScroll, 500);
    setTimeout(updateBackgroundOnScroll, 1000);

    // 自動スクロール関数（タイルとナビゲーションで共通使用）
    function autoScrollToSection(sectionIndex) {
        const targetSection = textSections[sectionIndex];

        if (targetSection) {
            const currentScrollY = window.pageYOffset;
            const heroHeight = heroSection.offsetHeight;
            const sectionOffset = targetSection.offsetTop;

            // 既にヒーローセクションを通過している場合
            if (currentScrollY >= heroHeight) {
                // タイルと同じ速度でスクロール
                userNavigatedAway = true;

                const startScroll = currentScrollY;
                const distance = sectionOffset - startScroll;
                const scrollSpeed = 150; // タイルと同じ速度
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
                    }
                }

                requestAnimationFrame(animateScroll);
            } else {
                // ヒーローセクション内にいる場合、ホイールイベントをシミュレート
                // 拡大エフェクトを経由してセクションまでスクロール

                const totalDistance = sectionOffset;
                const scrollSpeed = 150; // スクロール速度（ピクセル/フレーム）
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
            e.preventDefault();
            const sectionIndex = parseInt(this.getAttribute('data-section'));
            autoScrollToSection(sectionIndex);
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
        }, 3000);
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

// ミサイルiframeからのスクロール要求を処理
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'missileScroll') {
        window.scrollBy({
            top: event.data.deltaY,
            behavior: 'auto'  // スムーズではなく即座にスクロール
        });
    }
});
