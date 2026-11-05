// game.js - TRÌNH ĐIỀU KHIỂN GAME 2D PLATFORM & ĐỒNG BỘ SSE THỜI GIAN THỰC
// Boss đứng bên phải, Dũng sĩ đứng bên trái
// 100% Kỹ năng PixelFX, Tương tác chuẩn mặt đất, Zoom cận cảnh khi tặng quà không chồng hiệu ứng

// BỘ ĐIỀU KHIỂN CAMERA CINEMATIC ZOOM
class CameraController {
    constructor() {
        this.zoom = 1.0;
        this.targetZoom = 1.0;
        this.focusX = 0;
        this.focusY = 0;
        this.targetFocusX = 0;
        this.targetFocusY = 0;
        this.isCinematic = false;
    }

    startGiftZoom(targetX, targetY, durationMs = 1050) {
        this.isCinematic = true;
        this.targetZoom = 1.65; // Zoom cận cảnh người chơi khi tặng quà
        this.targetFocusX = targetX;
        this.targetFocusY = targetY;

        // Sau thời gian nạp năng lượng -> Zoom out mượt mà trở về toàn cảnh
        setTimeout(() => {
            this.targetZoom = 1.0;
            this.targetFocusX = 0;
            this.targetFocusY = 0;
            setTimeout(() => {
                this.isCinematic = false;
            }, 350);
        }, durationMs);
    }

    update() {
        this.zoom += (this.targetZoom - this.zoom) * 0.12;
        this.focusX += (this.targetFocusX - this.focusX) * 0.12;
        this.focusY += (this.targetFocusY - this.focusY) * 0.12;
    }

    apply(ctx, canvasWidth, canvasHeight) {
        if (Math.abs(this.zoom - 1.0) < 0.005 && Math.abs(this.focusX) < 1 && Math.abs(this.focusY) < 1) {
            return;
        }
        const cx = canvasWidth / 2;
        const cy = canvasHeight / 2;
        const fx = this.focusX || cx;
        const fy = this.focusY || cy;

        ctx.translate(cx, cy);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-fx, -fy);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Khởi tạo các hệ thống
    const sound = window.soundSystem;
    const effects = new window.EffectsManager(canvas);
    const bossRenderer = new window.BossRenderer(canvas);
    const playerRenderer = new window.PlayerRenderer(canvas);
    const camera = new CameraController();

    // Sprite Sheet Mặt Đất 2D Platform (Modular Stone Platform 80x48)
    const tilesetImg = new Image();
    tilesetImg.src = '/static/images/platform_tileset.png';
    let tilesetLoaded = false;
    tilesetImg.onload = () => { tilesetLoaded = true; };

    // DOM Elements
    const bossNameEl = document.getElementById('bossName');
    const bossHpTextEl = document.getElementById('bossHpText');
    const bossHpBarEl = document.getElementById('bossHpBar');
    const bossHpGhostEl = document.getElementById('bossHpGhost');
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
    const rageAlertEl = document.getElementById('rageAlert');
    const rageTimerEl = document.getElementById('rageTimer');
    const connectionStatusEl = document.getElementById('connectionStatus');
    const victoryOverlayEl = document.getElementById('victoryOverlay');
    const victoryBossNameEl = document.getElementById('victoryBossName');
    const victoryKillerEl = document.getElementById('victoryKiller');

    // Quản lý cảnh báo đòn nộ 5 giây của Boss
    let rageCountdownTimer = null;
    function showRageWarning(durationSeconds = 5.0) {
        if (!rageAlertEl) return;
        rageAlertEl.classList.remove('hidden');
        let remaining = Math.round(durationSeconds);
        if (rageTimerEl) rageTimerEl.textContent = remaining;

        clearInterval(rageCountdownTimer);
        rageCountdownTimer = setInterval(() => {
            remaining--;
            if (rageTimerEl) rageTimerEl.textContent = Math.max(0, remaining);
            if (remaining <= 0) {
                clearInterval(rageCountdownTimer);
                // Dự phòng: nếu server không gửi sự kiện nộ, tự ẩn bảng sau 2.5s
                setTimeout(hideRageWarning, 2500);
            }
        }, 1000);
    }

    function hideRageWarning() {
        clearInterval(rageCountdownTimer);
        if (rageAlertEl) rageAlertEl.classList.add('hidden');
    }

    // Tự động resize Canvas khớp khung nhìn
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Tính toán bố cục 2D Platform (Dũng sĩ bên trái, Boss bên phải)
    function getPlatformLayout() {
        const isPortrait = canvas.height > canvas.width;
        // Chiều cao sàn đấu platform
        const groundY = isPortrait ? canvas.height * 0.44 : canvas.height * 0.62;
        // Dũng sĩ đứng bên TRÁI
        const playerX = isPortrait ? canvas.width * 0.22 : canvas.width * 0.22;
        const playerY = groundY;
        // Boss đứng bên PHẢI
        const bossX = isPortrait ? canvas.width * 0.77 : canvas.width * 0.78;
        // Tâm thân Boss: tính đúng theo cách boss.js vẽ (kích thước, lơ lửng, tỉ lệ 0.52) để đòn đánh nổ giữa thân trên mọi màn hình
        const bType = (bossRenderer && bossRenderer.bossData && bossRenderer.bossData.boss_type) || 'dragon';
        const bossSize = isPortrait ? Math.min(canvas.width * 0.44, 280) : 340;
        const hover = (bType === 'dragon' || bType === 'phoenix' || bType === 'frost') ? -22 : 0;
        const bossY = groundY - bossSize * 0.975 + hover + bossSize * 0.52;

        return { isPortrait, groundY, playerX, playerY, bossX, bossY };
    }

    // Cho phép kích hoạt âm thanh khi click màn hình
    document.body.addEventListener('click', () => {
        sound.init();
    }, { once: true });

    // Trạng thái cục bộ
    let currentHpPercent = 100;
    let ghostHpPercent = 100;
    let targetHpPercent = 100;
    let buffRemaining = 0;
    let vipBannerTimeout = null;
    let isVictoryScheduled = false;
    let victoryTimeout = null;
    let isGiftZoomActive = false;
    let pendingActions = [];

    // Cập nhật DOM từ Game Snapshot (cho phép trì hoãn trừ máu khi chiêu đang bay/nạp)
    function updateGameState(snapshot, updateBossHp = true) {
        if (!snapshot) return;

        const boss = snapshot.boss;
        if (boss && updateBossHp) {
            bossRenderer.setBossData(boss);
            bossNameEl.textContent = boss.name;
            bossHpTextEl.textContent = `${boss.current_hp.toLocaleString()} / ${boss.max_hp.toLocaleString()} HP (${boss.hp_percent}%)`;
            targetHpPercent = boss.hp_percent;
            bossRageBarEl.style.width = `${boss.rage}%`;
        }

        // Cập nhật Dữ liệu Dũng Sĩ Người Chơi & Tiến độ Hồi Sinh
        if (snapshot.player) {
            playerRenderer.setPlayerData(snapshot.player);
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

    // Định dạng số sát thương hiển thị gọn gàng, rõ ràng
    function formatDmg(dmg) {
        if (typeof dmg !== 'number') return '0 DMG';
        if (dmg >= 1000000) return (dmg / 1000000).toFixed(1) + 'M DMG';
        if (dmg >= 10000) return (dmg / 1000).toFixed(1) + 'K DMG';
        return dmg.toLocaleString() + ' DMG';
    }

    let lastPlayersJson = '';
    function renderLeaderboard(players) {
        const jsonStr = JSON.stringify(players);
        if (jsonStr === lastPlayersJson) return;
        lastPlayersJson = jsonStr;

        leaderboardListEl.innerHTML = '';
        if (!players || players.length === 0) {
            leaderboardListEl.innerHTML = '<div class="leaderboard-empty">Chưa có ai ra đòn!</div>';
            return;
        }

        const fallbackAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30'><circle cx='15' cy='15' r='15' fill='%23ffd700'/></svg>";

        players.slice(0, 5).forEach((p, idx) => {
            const item = document.createElement('div');
            item.className = `leaderboard-item rank-${idx + 1}`;
            const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}`));

            const rankSpan = document.createElement('span');
            rankSpan.className = 'rank-num';
            rankSpan.textContent = medal;

            const img = document.createElement('img');
            img.className = 'user-avatar';
            img.src = p.avatar || fallbackAvatar;
            img.onerror = () => { img.onerror = null; img.src = fallbackAvatar; };

            const infoDiv = document.createElement('div');
            infoDiv.className = 'user-info';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'user-name';
            nameSpan.textContent = `@${p.nickname || 'Hiệp sĩ'}`;

            const dmgSpan = document.createElement('span');
            dmgSpan.className = 'user-dmg';
            dmgSpan.textContent = formatDmg(p.damage);

            infoDiv.appendChild(nameSpan);
            infoDiv.appendChild(dmgSpan);

            item.appendChild(rankSpan);
            item.appendChild(img);
            item.appendChild(infoDiv);

            leaderboardListEl.appendChild(item);
        });
    }

    function addCombatFeed(nickname, skill, damage, avatar) {
        const item = document.createElement('div');
        item.className = 'feed-item';
        item.innerHTML = `
            <span class="feed-user">@${nickname}</span>
            <span class="feed-skill">${skill}</span>
            <span class="feed-dmg">-${damage.toLocaleString()}</span>
        `;
        combatFeedEl.insertBefore(item, combatFeedEl.firstChild);

        while (combatFeedEl.children.length > 5) {
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

        let delayMs = 2400;
        if (effectType === 'gift_galaxy' || effectType === 'ultimate_dragon') {
            delayMs = 5200;
        } else if (effectType === 'gift_rocket') {
            delayMs = 4000;
        } else if (effectType === 'gift_crown') {
            delayMs = 3800;
        } else if (effectType === 'gift_lion' || effectType === 'gift_car' || effectType === 'gift_corgi') {
            delayMs = 3400;
        } else if (effectType.startsWith('gift_')) {
            delayMs = 2800;
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

        setTimeout(() => {
            victoryOverlayEl.classList.add('hidden');
            victoryOverlayEl.classList.remove('banner-pop');
            isVictoryScheduled = false;
            fetch('/api/boss/next', { method: 'POST' }).catch(err => console.error(err));
        }, 4500);
    }

    // HÀM TRỪ MÁU, BẮT ĐẦU HIỆN SỐ SÁT THƯƠNG & CHỚP ĐỎ BOSS KHI ĐÒN ĐÁNH THỰC SỰ CHẠM TRÚNG
    function applyDamageHit(data) {
        const { bossX, bossY } = getPlatformLayout();
        const damage = data.damage || 0;
        const isCrit = data.is_crit || false;
        const effect = data.effect || '';

        // 1. Cập nhật trừ máu Boss theo snapshot
        if (data.game_snapshot) {
            updateGameState(data.game_snapshot, true);
        }

        // 2. Hiện số sát thương bay lên trên đầu Boss
        effects.addDamageNumber(bossX + 15, bossY - 60, damage, isCrit);

        // 3. Boss rung chớp đỏ khi nhận sát thương
        bossRenderer.triggerHurt();

        // 4. Nếu đòn này kết liễu Boss
        if (data.boss_dead || (data.game_snapshot && data.game_snapshot.boss && data.game_snapshot.boss.is_dead)) {
            scheduleVictory(data.game_snapshot.boss, effect);
        }
    }

    // XỬ LÝ SỰ KIỆN TỪ SERVER QUA SSE
    function handleServerEvent(event) {
        const type = event.type;
        const data = event.data || {};
        // Mọi đòn đánh (action) đều trì hoãn trừ thanh máu cho tới khi hiệu ứng hình ảnh chạm trúng Boss (onHit)
        const isDelayedHit = (type === 'action');

        // Nếu là chiêu hành động, chỉ cập nhật thông tin chung trước, CHƯA trừ máu thanh HP
        if (data.game_snapshot) {
            updateGameState(data.game_snapshot, !isDelayedHit);
        }

        const { playerX, playerY, bossX, bossY, groundY } = getPlatformLayout();

        if (type === 'action') {
            const effect = data.effect || 'sword_slash';
            const damage = data.damage || 0;
            const isCrit = data.is_crit || false;
            const nickname = data.nickname || 'Hiệp sĩ';
            const avatar = data.avatar || '';
            const skill = data.skill || 'Tấn công';
            const isGift = (data.action_type === 'gift') || (effect.startsWith('gift_'));

            // 1. KHI NGƯỜI DÙNG TẶNG QUÀ VIP:
            if (isGift) {
                showVipBanner(avatar, nickname, skill, damage);
                playerRenderer.triggerAttack(nickname, avatar, skill, effect);

                // Phát âm thanh quà tặng tương ứng
                if (effect === 'gift_rose' || effect === 'blade_storm') sound.playGiftLaser();
                else if (effect === 'gift_heart') sound.playCupidArrow();
                else if (effect === 'gift_donut' || effect === 'meteor_shower') sound.playBomb();
                else if (effect === 'gift_rocket') sound.playRocketLaunch();
                else if (effect === 'gift_crown') sound.playExcalibur();
                else if (effect === 'gift_corgi') sound.playBeastRoar();
                else if (effect === 'gift_car') sound.playSupercarEngine();
                else if (effect === 'gift_lion') sound.playLionRoar();
                else if (effect === 'gift_galaxy' || effect === 'ultimate_dragon') sound.playBlackHoleGalaxy();
                else sound.playGiftLaser();

                // Chiêu thức PixelFX tung thẳng sang Boss
                if (effect === 'gift_galaxy' || effect === 'ultimate_dragon') {
                    effects.addSkill(effect, bossX, bossY, {
                        originX: playerX,
                        originY: playerY,
                        groundY: groundY,
                        onMultiHit: (tickIdx, tickDmg) => {
                            bossRenderer.triggerHurt();
                            sound.playBlackHoleGalaxy();
                            effects.triggerScreenShake(12, 16);
                            effects.addDamageNumber(bossX + 20, bossY - 50, tickDmg || 500000, true);
                        },
                        onHit: () => {
                            applyDamageHit(data);
                        }
                    });
                } else {
                    effects.addSkill(effect, bossX, bossY, {
                        originX: playerX,
                        originY: playerY,
                        groundY: groundY,
                        onHit: () => {
                            applyDamageHit(data);
                        }
                    });
                }
            } 
            // 2. KHI BÌNH LUẬN (chem, lua, bang, set, bom, doc) HOẶC LIKE:
            else {
                // Hiển thị diễn hoạt nhân vật & phát âm thanh xuất chiêu
                if (effect === 'sword_slash') {
                    playerRenderer.triggerAttack(nickname, avatar, skill, effect);
                    sound.playSlash();
                } else if (effect === 'fireball') {
                    // Chat "lua": Arcane Missiles ma thuật bay tới tâm ngực boss
                    playerRenderer.triggerCast(nickname, avatar, skill, effect);
                    sound.playFireball();
                } else if (effect === 'lightning') {
                    // Dũng sĩ niệm chú pháp trận, sấm sét tích tụ năng lượng, CHƯA đánh xuống
                    playerRenderer.triggerCast(nickname, avatar, skill, effect);
                } else if (effect === 'bomb_blast') {
                    // Chat "bom": Quả cầu lửa bay tới Boss rồi mới nổ
                    playerRenderer.triggerAttack(nickname, avatar, skill, effect);
                    sound.playFireball();
                } else if (effect === 'ice_shard') {
                    // Chat "bang": Ice Spikes + Snowflake Burst
                    playerRenderer.triggerCast(nickname, avatar, skill, effect);
                    sound.playIce();
                } else if (effect === 'heart_barrage' || effect === 'magic_bullet') {
                    playerRenderer.triggerCast(nickname, avatar, skill, effect);
                    sound.playHeartHit();
                } else if (effect === 'poison_sting') {
                    // Chat "doc": Acid Splash ăn mòn
                    playerRenderer.triggerCast(nickname, avatar, skill, effect);
                    sound.playSlash();
                } else {
                    playerRenderer.triggerAttack(nickname, avatar, skill, effect);
                    sound.playSlash();
                }

                // 2.1. ĐỐI VỚI CHIÊU SÉT ("set"):
                // CHỜ TIA SÉT KHỔNG LỒ TỪ TRỜI ĐÁNH XUỐNG MẶT ĐẤT MỚI TRỪ MÁU, HIỆN SỐ DMG & RUNG CHẤN!
                if (effect === 'lightning') {
                    effects.addSkill(effect, bossX, bossY, {
                        originX: playerX,
                        originY: playerY,
                        groundY: groundY,
                        onHit: () => {
                            sound.playLightning();
                            applyDamageHit(data);
                        }
                    });
                } 
                // 2.2. ĐỐI VỚI CHIÊU BỘC PHÁ ("bom"):
                // QUẢ CẦU LỬA BAY TỚI BOSS RỒI MỚI NỔ BỘC PHÁ & TRỪ MÁU
                else if (effect === 'bomb_blast') {
                    effects.addSkill('bomb_blast', bossX, bossY, {
                        originX: playerX,
                        originY: playerY,
                        groundY: groundY,
                        onHit: () => {
                            sound.playBomb();
                            applyDamageHit(data);
                        }
                    });
                }
                // 2.3. ĐỐI VỚI CHIÊU ĐỘC TỐ ("doc"):
                // NỔ AXIT LỤC BẢO TRÊN BOSS & BẮT ĐẦU RÚT MÁU ĐỘC (50 HP/S TRONG 4S)
                else if (effect === 'poison_sting') {
                    effects.addSkill('poison_sting', bossX, bossY, {
                        originX: playerX,
                        originY: playerY,
                        groundY: groundY,
                        onHit: () => {
                            // Độc không trừ máu tức thì (không hiện số, không chớp đỏ): chỉ bật hiệu ứng nhiễm độc,
                            // máu sẽ rút dần từng giây qua sự kiện boss_poison_tick
                            if (data.game_snapshot) updateGameState(data.game_snapshot, true);
                            if (data.game_snapshot && data.game_snapshot.boss) {
                                bossRenderer.setBossData(data.game_snapshot.boss);
                            }
                        }
                    });
                }
                else {
                    // Mọi chiêu thức khác: Chờ hiệu ứng chạm Boss mới trừ máu
                    effects.addSkill(effect, bossX, bossY, {
                        originX: playerX,
                        originY: playerY,
                        groundY: groundY,
                        onHit: () => {
                            applyDamageHit(data);
                        }
                    });
                }
            }

            // Ghi nhật ký chiến đấu
            addCombatFeed(nickname, skill, damage, avatar);

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
            // Boss bên phải tung đòn nộ nứt mặt sàn về phía người chơi (scale 80% tinh gọn)
            sound.playBomb();
            effects.triggerScreenShake(20, 25);
            effects.spawnPixelFX('darkExplosion', bossX, groundY, 2.7);

        } else if (type === 'boss_heal') {
            // Boss hồi máu tại vị trí Boss bên phải (scale 80% tinh gọn)
            const healAmount = data.heal_amount || 0;
            bossRenderer.triggerHeal();
            effects.spawnPixelFX('heal', bossX, groundY, 2.4);
            effects.addDamageNumber(bossX + 25, bossY - 60, healAmount, false, "+");

        } else if (type === 'boss_attack_player') {
            // BOSS TẤNG CÔNG NGƯỢC LẠI DŨNG SĨ VỚI CÁC SKILL ĐẶC BIỆT
            const skillName = data.skill_name || 'Cầu Lửa Hắc Ám';
            const effect = data.effect || 'boss_fireball';
            const damage = data.damage || 500;

            if (effect === 'boss_fireball') sound.playFireball();
            else if (effect === 'boss_lightning') sound.playLightning();
            else if (effect === 'boss_frost') sound.playIce();
            else sound.playBomb();

            effects.addSkill(effect, playerX, playerY, {
                originX: bossX,
                originY: bossY,
                groundY: groundY,
                onHit: () => {
                    playerRenderer.triggerHurt();
                    effects.addDamageNumber(playerX, playerY - 45, damage, true, "-");
                    if (data.player) {
                        playerRenderer.setPlayerData(data.player);
                    }
                }
            });
            addCombatFeed(bossRenderer.bossData.name || 'Boss', skillName, damage, '');

        } else if (type === 'boss_poison_tick') {
            // RÚT MÁU ĐỘC TỐ ĐỊNH KỲ CỦA BOSS (50 HP/S)
            const poisonDmg = data.damage || 50;
            effects.addDamageNumber(bossX + 20, bossY - 60, poisonDmg, false, "-🧪 ");
            bossRenderer.triggerHurt();
            if (data.game_snapshot) {
                updateGameState(data.game_snapshot, true);
            } else if (data.boss) {
                bossRenderer.setBossData(data.boss);
                bossHpTextEl.textContent = `${data.boss.current_hp.toLocaleString()} / ${data.boss.max_hp.toLocaleString()} HP (${data.boss.hp_percent}%)`;
                targetHpPercent = data.boss.hp_percent;
            }
            if (data.boss && data.boss.is_dead) {
                scheduleVictory(data.boss, 'poison_sting');
            }

        } else if (type === 'boss_poison_end') {
            // ĐỘC HẾT HIỆU LỰC SAU 5 GIÂY: TẮT HIỆU ỨNG VÀ BONG BÓNG ĐỘC
            if (data.game_snapshot) {
                updateGameState(data.game_snapshot, true);
            }
            if (data.boss) {
                bossRenderer.setBossData(data.boss);
            }
            if (bossRenderer.bossData) {
                bossRenderer.bossData.is_poisoned = false;
            }
            if (bossRenderer.poisonBubbles) {
                bossRenderer.poisonBubbles = [];
            }

        } else if (type === 'boss_poisoned') {
            if (data.boss) {
                bossRenderer.setBossData(data.boss);
            }

        } else if (type === 'boss_rage_warning') {
            // CẢNH BÁO 5S TRƯỚC KHI BOSS PHÓNG ĐÒN NỘ TỬ THẦN
            showRageWarning(data.duration || 5.0);
            sound.playBomb();
            effects.triggerScreenShake(18, 25);
            addCombatFeed(bossRenderer.bossData.name || 'BOSS', '⚠️ TÍCH NỘ 5S! (CHAT "hộ giá" ĐỂ BẬT KHIÊN)', 0, '');

        } else if (type === 'shield_activated') {
            // NGƯỜI CHƠI CHAT "hộ giá" KÍCH HOẠT KHIÊN TIME-STOP
            sound.playVictory();
            effects.triggerScreenShake(8, 14);
            effects.addSkill('player_shield', playerX, playerY, { groundY: groundY });
            addCombatFeed(data.nickname || 'Hiệp sĩ', '🛡️ KÍCH HOẠT HỘ GIÁ (KHIÊN THỜI GIAN)', 0, '');

        } else if (type === 'boss_rage_execute') {
            // THI HÀNH ĐÒN NỘ CỦA BOSS
            hideRageWarning();
            if (data.cancelled) {
                if (data.player) playerRenderer.setPlayerData(data.player);
                return;
            }
            if (data.shielded) {
                // ĐÃ BẬT KHIÊN: KHÔNG NHẬN SÁT THƯƠNG
                sound.playVictory();
                effects.triggerScreenShake(12, 18);
                addCombatFeed(data.shield_by || 'Hiệp sĩ', '🛡️ HỘ GIÁ THÀNH CÔNG! CHẶN HOÀN TOÀN ĐÒN NỘ!', 0, '');
            } else {
                // CHƯA BẬT KHIÊN: NỘ TỬ THẦN ĐÁNH THẲNG VÀO NGƯỜI CHƠI (CHẾT NGAY LẬP TỨC)
                sound.playBomb();
                effects.triggerScreenShake(28, 40);
                effects.addSkill('boss_rage', playerX, playerY, { groundY: groundY });
                playerRenderer.triggerHurt();
                effects.addDamageNumber(playerX, playerY - 45, 999999, true, "-💀 ");
                addCombatFeed(bossRenderer.bossData.name || 'BOSS', '⚡ NỘ DIỆT THẾ! DŨNG SĨ GỤC NGÃ!', 999999, '');
            }
            if (data.player) {
                playerRenderer.setPlayerData(data.player);
            }

        } else if (type === 'player_revived') {
            // DŨNG SĨ HỒI SINH THÀNH CÔNG VỚI HIỆU ỨNG SCIFI/WARP-IN
            sound.playVictory();
            effects.triggerScreenShake(18, 26);
            effects.spawnPixelFX('scifi/warp-in', playerX, groundY, 2.6, { duration: 3.0 });
            playerRenderer.triggerHeal();
            if (data.player) {
                playerRenderer.setPlayerData(data.player);
            }
            addCombatFeed(data.nickname || 'Dũng Sĩ', 'HỒI SINH THÀNH CÔNG', 0, data.avatar || '');

        } else if (type === 'player_heart_added') {
            // THẢ TIM CỨU DŨNG SĨ
            sound.playHeartHit();
            effects.spawnPixelFX('charmed', playerX + (Math.random() - 0.5) * 35, groundY - 45, 1.8, { duration: 1.0 });
            if (data.player) {
                playerRenderer.setPlayerData(data.player);
            }

        } else if (type === 'player_damaged') {
            playerRenderer.triggerHurt();
            effects.addDamageNumber(playerX, playerY - 45, data.damage || 200, false, "-");
            if (data.player) {
                playerRenderer.setPlayerData(data.player);
            }

        } else if (type === 'player_healed') {
            playerRenderer.triggerHeal();
            effects.spawnPixelFX('heal', playerX, groundY, 2.6, { duration: 1.8 });
            effects.addDamageNumber(playerX, playerY - 45, data.amount || 200, false, "+");
            if (data.player) {
                playerRenderer.setPlayerData(data.player);
            }

        } else if (type === 'player_update') {
            if (data.player) {
                playerRenderer.setPlayerData(data.player);
            }

        } else if (type === 'status') {
            if (connectionStatusEl) {
                connectionStatusEl.textContent = data.message || (data.connected ? 'LIVE ĐÃ KẾT NỐI' : 'CHƯA KẾT NỐI');
                connectionStatusEl.className = data.connected ? 'status-connected' : 'status-disconnected';
            }
        }
    }

    // VẼ SÀN ĐẤU 2D BẰNG SPRITE SHEET MODULAR PIXEL ART (16x16)
    function drawBattlePlatform(ctx, canvasWidth, canvasHeight, groundY) {
        ctx.save();
        ctx.imageSmoothingEnabled = false; // Chuẩn Pixel Art sắc nét

        const isPortrait = canvasHeight > canvasWidth;
        const platformWidth = isPortrait ? canvasWidth * 0.94 : canvasWidth * 0.88;
        const platformX = (canvasWidth - platformWidth) / 2;
        
        // Tileset 48x48 (3 cột x 3 hàng, mỗi tile 16x16 pixel)
        // Cột 0: Mép trái (sx = 0)
        // Cột 1: Thân giữa liền mạch (sx = 16)
        // Cột 2: Mép phải (sx = 32)
        // Hàng 0: Mặt sàn trên cùng (sy = 0)
        // Hàng 1: Thân đất đá giữa (sy = 16)
        // Hàng 2: Đáy đá đặc nguyên khối 100% không lỗ rỗng (sy = 32)
        const tileSize = 16;
        const scale = isPortrait ? 2.6 : 3.0;
        const drawTileSize = tileSize * scale;

        // 1. Ánh sáng chân trời phía sau sàn đấu
        const horizonGrad = ctx.createLinearGradient(0, groundY - 70, 0, groundY + 35);
        horizonGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        horizonGrad.addColorStop(0.65, 'rgba(124, 77, 255, 0.12)');
        horizonGrad.addColorStop(1, 'rgba(0, 229, 255, 0.18)');
        ctx.fillStyle = horizonGrad;
        ctx.fillRect(0, groundY - 70, canvasWidth, 105);

        if (tilesetLoaded && tilesetImg.complete) {
            const cols = Math.ceil(platformWidth / drawTileSize);

            for (let c = 0; c < cols; c++) {
                const tx = platformX + c * drawTileSize;

                // sx: 0 = mép trái, 32 = mép phải, 16 = thân đá giữa
                let sx = 16;
                if (c === 0) sx = 0;
                else if (c === cols - 1) sx = 32;

                // Hàng 0: Mặt sàn trên (chân nhân vật và boss đứng tại groundY)
                ctx.drawImage(tilesetImg, sx, 0, tileSize, tileSize, tx, groundY - 2, drawTileSize, drawTileSize);

                // Hàng 1: Thân đất đá liền khối
                ctx.drawImage(tilesetImg, sx, 16, tileSize, tileSize, tx, groundY - 2 + drawTileSize, drawTileSize, drawTileSize);

                // Hàng 2: Đáy đá đặc nguyên khối (100% không loang lổ)
                ctx.drawImage(tilesetImg, sx, 32, tileSize, tileSize, tx, groundY - 2 + drawTileSize * 2, drawTileSize, drawTileSize);
            }
        } else {
            // Fallback khi ảnh đang tải
            ctx.fillStyle = '#1a0933';
            ctx.fillRect(platformX, groundY, platformWidth, 38);
        }

        // 2. Viền neon phát sáng siêu mảnh chạy dọc mặt sàn
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.65)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(platformX + 4, groundY - 2);
        ctx.lineTo(platformX + platformWidth - 4, groundY - 2);
        ctx.stroke();

        ctx.restore();
    }

    // Kết nối Server-Sent Events (SSE)
    function setupSSE() {
        const evtSource = new EventSource('/stream');
        evtSource.onopen = () => {
            console.log("SSE Connected");
            if (connectionStatusEl) {
                connectionStatusEl.textContent = "SSE ĐÃ KẾT NỐI";
                connectionStatusEl.className = "status-connected";
            }
        };
        evtSource.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data);
                handleServerEvent(event);
            } catch (err) {
                console.error("Lỗi parse SSE:", err);
            }
        };
        evtSource.onerror = () => {
            console.warn("SSE Error, retrying in 3s...");
            if (connectionStatusEl) {
                connectionStatusEl.textContent = "MẤT KẾT NỐI SSE";
                connectionStatusEl.className = "status-disconnected";
            }
        };
    }

    setupSSE();

    // VÒNG LẶP RENDER CHÍNH (60 FPS)
    function gameLoop() {
        // Cập nhật thanh máu mượt mà (Lerp)
        currentHpPercent += (targetHpPercent - currentHpPercent) * 0.15;
        ghostHpPercent += (targetHpPercent - ghostHpPercent) * 0.05;

        bossHpBarEl.style.width = `${Math.max(0, currentHpPercent)}%`;
        if (bossHpGhostEl) {
            bossHpGhostEl.style.width = `${Math.max(0, ghostHpPercent)}%`;
        }

        if (currentHpPercent > 50) {
            bossHpBarEl.style.background = 'linear-gradient(90deg, #00e676, #76ff03)';
        } else if (currentHpPercent > 25) {
            bossHpBarEl.style.background = 'linear-gradient(90deg, #ff9100, #ffea00)';
        } else {
            bossHpBarEl.style.background = 'linear-gradient(90deg, #ff1744, #ff5252)';
        }

        // Cập nhật Camera Zoom
        camera.update();

        // Cập nhật rung chấn màn hình
        const { offsetX, offsetY } = effects.update();

        // Xóa màn hình canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // BẮT ĐẦU VẼ THẾ GIỚI GAME 2D VỚI CAMERA CINEMATIC
        ctx.save();

        // 1. Áp dụng Camera Zoom (Chỉ zoom khi có quà tặng)
        camera.apply(ctx, canvas.width, canvas.height);

        // 2. Áp dụng rung lắc khi trúng đòn
        ctx.translate(offsetX, offsetY);

        const { groundY, playerX, playerY, bossX, bossY } = getPlatformLayout();

        // 3. Vẽ Sàn Đấu 2D Platform (Sprite Sheet Tileset)
        drawBattlePlatform(ctx, canvas.width, canvas.height, groundY);

        // 4. Vẽ Dũng Sĩ (BÊN TRÁI) - Sprite Sheet Samurai Pixel Art & Avatar TikTok
        playerRenderer.draw(ctx, playerX, playerY);

        // 5. Vẽ Boss (BÊN PHẢI) - Quái vật đối đầu, chân chạm chuẩn mặt đất groundY
        bossRenderer.draw(ctx, bossX, groundY);

        // 6. Vẽ Kỹ Năng (PixelFX thuần túy tương tác mặt sàn + Số sát thương)
        effects.draw(ctx);

        ctx.restore();

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);

    // Hỗ trợ kiểm thử trực quan nhanh qua query params (vd: ?test_skill=lightning)
    const urlParams = new URLSearchParams(window.location.search);
    const testSkill = urlParams.get('test_skill');
    if (testSkill) {
        handleServerEvent({
            type: 'action',
            data: {
                effect: testSkill,
                damage: 15400,
                is_crit: true,
                nickname: 'Hero_Gamer',
                skill: testSkill === 'lightning' ? 'Lôi Thần Trừng Phạt' : (testSkill === 'sword_slash' ? 'Trảm Phong Kiếm' : testSkill)
            }
        });
        const advanceFrames = urlParams.get('frames') ? parseInt(urlParams.get('frames')) : (testSkill === 'lightning' ? 49 : 5);
        for (let k = 0; k < advanceFrames; k++) {
            effects.update();
        }
    }
});
