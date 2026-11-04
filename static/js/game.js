// game.js - Trình điều khiển vòng lặp trò chơi & đồng bộ SSE

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Khởi tạo các hệ thống
    const sound = window.soundSystem;
    const effects = new window.EffectsManager(canvas);
    const bossRenderer = new window.BossRenderer(canvas);

    // DOM Elements
    const bossNameEl = document.getElementById('bossName');
    const bossHpTextEl = document.getElementById('bossHpText');
    const bossHpBarEl = document.getElementById('bossHpBar');
    const bossRageBarEl = document.getElementById('bossRageBar');
    const levelBadgeEl = document.getElementById('levelBadge');
    const leaderboardListEl = document.getElementById('leaderboardList');
    const combatFeedEl = document.getElementById('combatFeed');
    const vipBannerEl = document.getElementById('vipBanner');
    const vipAvatarEl = document.getElementById('vipAvatar');
    const vipUserEl = document.getElementById('vipUser');
    const vipActionEl = document.getElementById('vipAction');
    const buffBannerEl = document.getElementById('buffBanner');
    const buffTimerEl = document.getElementById('buffTimer');
    const regenAlertEl = document.getElementById('regenAlert');
    const connectionStatusEl = document.getElementById('connectionStatus');
    const victoryOverlayEl = document.getElementById('victoryOverlay');
    const victoryBossNameEl = document.getElementById('victoryBossName');
    const victoryKillerEl = document.getElementById('victoryKiller');

    // Tự động resize Canvas khớp khung nhìn
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Cho phép kích hoạt âm thanh khi click màn hình (yêu cầu bảo mật của trình duyệt)
    document.body.addEventListener('click', () => {
        sound.init();
    }, { once: true });

    // Trạng thái cục bộ
    let currentHpPercent = 100;
    let targetHpPercent = 100;
    let buffRemaining = 0;
    let vipBannerTimeout = null;
    let isVictoryScheduled = false;
    let victoryTimeout = null;

    // Cập nhật DOM từ Game Snapshot
    function updateGameState(snapshot) {
        if (!snapshot) return;

        const boss = snapshot.boss;
        if (boss) {
            bossRenderer.setBossData(boss);
            bossNameEl.textContent = boss.name;
            bossHpTextEl.textContent = `${boss.current_hp.toLocaleString()} / ${boss.max_hp.toLocaleString()} HP (${boss.hp_percent}%)`;
            targetHpPercent = boss.hp_percent;
            bossRageBarEl.style.width = `${boss.rage}%`;
        }

        if (snapshot.level) {
            levelBadgeEl.textContent = `ẢI ${snapshot.level}`;
        }

        // Cập nhật Buff
        buffRemaining = snapshot.buff_remaining || 0;
        if (snapshot.buff_active && buffRemaining > 0) {
            buffBannerEl.classList.remove('hidden');
            buffTimerEl.textContent = `${buffRemaining}s (x${snapshot.damage_multiplier} DMG)`;
        } else {
            buffBannerEl.classList.add('hidden');
        }

        // Cập nhật Cảnh Báo Hồi Máu Khi Không Tương Tác
        if (snapshot.is_regenerating) {
            bossRenderer.isHealing = true;
            if (regenAlertEl) regenAlertEl.classList.remove('hidden');
        } else {
            bossRenderer.isHealing = false;
            if (regenAlertEl) regenAlertEl.classList.add('hidden');
        }

        // Cập nhật Leaderboard
        if (snapshot.top_players) {
            renderLeaderboard(snapshot.top_players);
        }
    }

    let lastPlayersJson = '';
    function renderLeaderboard(players) {
        const jsonStr = JSON.stringify(players);
        if (jsonStr === lastPlayersJson) return; // Tránh render lại DOM nếu không đổi
        lastPlayersJson = jsonStr;

        leaderboardListEl.innerHTML = '';
        if (!players || players.length === 0) {
            leaderboardListEl.innerHTML = '<div class="leaderboard-empty">Chưa có ai ra đòn!</div>';
            return;
        }

        players.forEach((p, index) => {
            const item = document.createElement('div');
            item.className = `leaderboard-item rank-${index + 1}`;
            
            const avatarUrl = p.avatar || 'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7338491823938472966~c5_100x100.jpeg?x-expires=1710000000';
            const rankBadges = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

            item.innerHTML = `
                <span class="rank-num">${rankBadges[index] || (index + 1)}</span>
                <img class="user-avatar" src="${avatarUrl}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\'><circle cx=\\'20\\' cy=\\'20\\' r=\\'20\\' fill=\\'%23666\\'/><text x=\\'20\\' y=\\'26\\' font-size=\\'16\\' text-anchor=\\'middle\\' fill=\\'white\\'>⚔️</text></svg>'" />
                <div class="user-info">
                    <div class="user-name">${p.nickname}</div>
                    <div class="user-dmg">${p.damage.toLocaleString()} DMG</div>
                </div>
            `;
            leaderboardListEl.appendChild(item);
        });
    }

    function addCombatFeed(nickname, skill, damage, avatar) {
        const item = document.createElement('div');
        item.className = 'combat-feed-item';
        item.innerHTML = `
            <span class="feed-user">${nickname}</span>
            <span class="feed-skill">${skill}</span>
            <span class="feed-dmg">-${damage.toLocaleString()}</span>
        `;
        combatFeedEl.insertBefore(item, combatFeedEl.firstChild);

        // Giữ tối đa 6 dòng
        while (combatFeedEl.children.length > 6) {
            combatFeedEl.removeChild(combatFeedEl.lastChild);
        }
    }

    function showVipBanner(avatar, nickname, skill, damage) {
        vipAvatarEl.src = avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><circle cx="30" cy="30" r="30" fill="%23e91e63"/><text x="30" y="38" font-size="24" text-anchor="middle" fill="white">👑</text></svg>';
        vipUserEl.textContent = `@${nickname}`;
        vipActionEl.textContent = `Tung ${skill} gây -${damage.toLocaleString()} HP!`;

        vipBannerEl.classList.remove('hidden');
        vipBannerEl.classList.add('banner-pop');

        clearTimeout(vipBannerTimeout);
        vipBannerTimeout = setTimeout(() => {
            vipBannerEl.classList.add('hidden');
            vipBannerEl.classList.remove('banner-pop');
        }, 4000);
    }

    function scheduleVictory(boss, effectType = 'sword_slash') {
        if (isVictoryScheduled) return;
        isVictoryScheduled = true;

        // Tính thời gian chờ cho hiệu ứng kết liễu chạy xong hoàn toàn
        let delayMs = 2200;
        if (effectType === 'gift_galaxy' || effectType === 'ultimate_dragon') {
            delayMs = 5200; // Hố Đen & Rồng Thần Kamehameha đợi 5.2s
        } else if (effectType === 'gift_rocket') {
            delayMs = 4000; // Tên lửa hạt nhân đợi nổ nấm nguyên tử xong (4.0s)
        } else if (effectType === 'gift_crown') {
            delayMs = 3800; // Thánh kiếm Excalibur đợi 3.8s
        } else if (effectType === 'gift_lion' || effectType === 'gift_car' || effectType === 'gift_corgi') {
            delayMs = 3400; // Sư tử, siêu xe, bầy sói đợi 3.4s
        } else if (effectType === 'gift_rose' || effectType === 'gift_donut' || effectType === 'gift_heart' || effectType === 'blade_storm' || effectType === 'meteor_shower') {
            delayMs = 2800; // Quà trung bình đợi 2.8s
        } else if (effectType === 'lightning' || effectType === 'fireball' || effectType === 'bomb_blast' || effectType === 'ice_shard') {
            delayMs = 2200; // Kỹ năng phép thuật đợi 2.2s
        } else {
            delayMs = 1800; // Chém kiếm, thả tim đợi 1.8s
        }

        clearTimeout(victoryTimeout);
        victoryTimeout = setTimeout(() => {
            showVictory(boss);
        }, delayMs);
    }

    function showVictory(boss) {
        victoryBossNameEl.textContent = boss.name;
        victoryKillerEl.textContent = boss.killer ? `Người kết liễu: @${boss.killer}` : '';
        victoryOverlayEl.classList.remove('hidden');
        victoryOverlayEl.classList.add('banner-pop');

        sound.playVictory();
        effects.triggerScreenShake(20, 35);

        // Bảng thông báo hiển thị trong 4.5 giây rồi tự động chuyển sang Boss tiếp theo
        setTimeout(() => {
            victoryOverlayEl.classList.add('hidden');
            victoryOverlayEl.classList.remove('banner-pop');
            isVictoryScheduled = false;

            // Tự động chuyển Boss tiếp theo
            fetch('/api/boss/next', { method: 'POST' }).catch(err => console.error(err));
        }, 4500);
    }

    // Xử lý sự kiện nhận từ Server qua SSE
    function handleServerEvent(event) {
        const type = event.type;
        const data = event.data || {};

        if (data.game_snapshot) {
            updateGameState(data.game_snapshot);
        }

        const isPortrait = canvas.height > canvas.width;
        const bossCenterX = canvas.width / 2;
        const bossCenterY = isPortrait ? canvas.height * 0.36 : canvas.height * 0.45;

        if (type === 'action') {
            const effect = data.effect || 'sword_slash';
            const damage = data.damage || 0;
            const isCrit = data.is_crit || false;
            const nickname = data.nickname || 'Hiệp sĩ';
            const avatar = data.avatar || '';
            const skill = data.skill || 'Tấn công';

            // Kích hoạt rung và hiệu ứng Boss
            bossRenderer.triggerHurt();
            effects.addSkill(effect, bossCenterX, bossCenterY);
            effects.addDamageNumber(bossCenterX, bossCenterY - 40, damage, isCrit);

            // Âm thanh riêng biệt cho từng loại kỹ năng & quà tặng
            if (effect === 'sword_slash') sound.playSlash();
            else if (effect === 'fireball') sound.playFireball();
            else if (effect === 'lightning') sound.playLightning();
            else if (effect === 'bomb_blast') sound.playBomb();
            else if (effect === 'ice_shard') sound.playIce();
            else if (effect === 'heart_barrage' || effect === 'magic_bullet') sound.playHeartHit();
            // ÂM THANH RIÊNG CHO 9 LOẠI QUÀ TẶNG
            else if (effect === 'gift_rose' || effect === 'blade_storm') sound.playGiftLaser();
            else if (effect === 'gift_heart') sound.playCupidArrow();
            else if (effect === 'gift_donut' || effect === 'meteor_shower') sound.playBomb();
            else if (effect === 'gift_rocket') sound.playRocketLaunch();
            else if (effect === 'gift_crown') sound.playExcalibur();
            else if (effect === 'gift_corgi') sound.playBeastRoar();
            else if (effect === 'gift_car') sound.playSupercarEngine();
            else if (effect === 'gift_lion') sound.playLionRoar();
            else if (effect === 'gift_galaxy' || effect === 'ultimate_dragon') sound.playBlackHoleGalaxy();
            else sound.playBossHurt();

            // Feed & VIP Banner
            addCombatFeed(nickname, skill, damage, avatar);
            if (data.action_type === 'gift' || damage >= 2000) {
                showVipBanner(avatar, nickname, skill, damage);
            }

            // NẾU ĐÒN ĐÁNH KẾT LIỄU BOSS: CHỜ HIỆU ỨNG CHIÊU THỨC KẾT THÚC RỒI MỚI HIỆN THÔNG BÁO CHIẾN THẮNG
            if (data.boss_dead || (data.game_snapshot && data.game_snapshot.boss && data.game_snapshot.boss.is_dead)) {
                scheduleVictory(data.game_snapshot.boss, effect);
            }

        } else if (type === 'buff') {
            sound.playGiftLaser();
            effects.triggerScreenShake(10, 20);
            addCombatFeed(data.nickname, data.skill, 0, data.avatar);
            showVipBanner(data.avatar, data.nickname, data.skill, 0);

        } else if (type === 'boss_update') {
            isVictoryScheduled = false;
            clearTimeout(victoryTimeout);
            victoryOverlayEl.classList.add('hidden');
        } else if (type === 'boss_attack') {
            sound.playBomb();
            effects.triggerScreenShake(25, 30);
            effects.spawnPixelFX('darkExplosion', bossCenterX, bossCenterY, 3.6);
            effects.createExplosion(bossCenterX, bossCenterY, 'purple', 30);
        } else if (type === 'boss_heal') {
            const healAmount = data.heal_amount || 0;
            bossRenderer.triggerHeal();
            effects.spawnPixelFX('heal', bossCenterX, bossCenterY, 3.2);
            effects.addDamageNumber(bossCenterX, bossCenterY - 60, healAmount, false, "+");
            // Sinh các hạt sinh mệnh màu xanh lá
            for (let i = 0; i < 15; i++) {
                effects.particles.push(new Particle(
                    bossCenterX + (Math.random() - 0.5) * 160,
                    bossCenterY + 40 + Math.random() * 40,
                    (Math.random() - 0.5) * 3,
                    -Math.random() * 6 - 2,
                    '#00e676',
                    Math.random() * 6 + 3,
                    1.0,
                    0.02,
                    'circle'
                ));
            }
        } else if (type === 'status') {
            if (connectionStatusEl) {
                connectionStatusEl.textContent = data.message || (data.connected ? 'LIVE ĐÃ KẾT NỐI' : 'CHƯA KẾT NỐI');
                connectionStatusEl.className = data.connected ? 'status-connected' : 'status-disconnected';
            }
        }
    }

    // Kết nối Server-Sent Events (SSE)
    function setupSSE() {
        const evtSource = new EventSource('/stream');

        evtSource.onmessage = (e) => {
            try {
                const parsed = JSON.parse(e.data);
                handleServerEvent(parsed);
            } catch (err) {
                console.error("Lỗi parse SSE:", err);
            }
        };

        evtSource.onerror = (err) => {
            console.warn("SSE mất kết nối, trình duyệt sẽ tự động kết nối lại...", err);
            if (connectionStatusEl) {
                connectionStatusEl.textContent = 'Mất kết nối server, đang thử lại...';
                connectionStatusEl.className = 'status-disconnected';
            }
        };
    }

    setupSSE();

    // VÒNG LẶP RENDER CHÍNH (60 FPS)
    function gameLoop() {
        // Cập nhật thanh máu mượt mà (Lerp)
        currentHpPercent += (targetHpPercent - currentHpPercent) * 0.15;
        bossHpBarEl.style.width = `${Math.max(0, currentHpPercent)}%`;

        // Đổi màu thanh máu theo % HP
        if (currentHpPercent > 50) {
            bossHpBarEl.style.background = 'linear-gradient(90deg, #00e676, #76ff03)';
        } else if (currentHpPercent > 25) {
            bossHpBarEl.style.background = 'linear-gradient(90deg, #ff9100, #ffea00)';
        } else {
            bossHpBarEl.style.background = 'linear-gradient(90deg, #ff1744, #ff5252)';
        }

        // Cập nhật Effects & Rung lắc màn hình
        const { offsetX, offsetY } = effects.update();

        // Xóa màn hình canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(offsetX, offsetY);

        // Vẽ Boss
        const isPortrait = canvas.height > canvas.width;
        const bossCenterX = canvas.width / 2;
        const bossCenterY = isPortrait ? canvas.height * 0.36 : canvas.height * 0.45;
        bossRenderer.draw(ctx, bossCenterX, bossCenterY);

        // Vẽ các hiệu ứng hạt, phép thuật, số sát thương
        effects.draw(ctx);

        ctx.restore();

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
});
