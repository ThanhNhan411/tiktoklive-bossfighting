// player.js - HIỂN THỊ & DIỄN HOẠT DŨNG SĨ BẰNG SPRITE SHEET SAMURAI PIXEL ART CHUẨN
// Đồng bộ 100% phong cách đồ họa Pixel Art với thư viện PixelFX

class PlayerRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.time = 0;

        // Trạng thái người chơi hiện tại
        this.currentUser = {
            id: 'host',
            nickname: 'Dũng Sĩ Live',
            avatar: '',
            skillName: 'Sẵn Sàng',
            effectType: 'idle'
        };

        // Sprite Sheet Pixel Art Samurai (1600 x 1000: 8 cột x 5 hàng, mỗi frame 200 x 200)
        // Row 0: Idle (8 frames)
        // Row 1: Run (8 frames)
        // Row 2: Attack 1 (6 frames)
        // Row 3: Attack 2 (6 frames)
        // Row 4: Charge / Cast (8 frames)
        this.spriteSheet = new Image();
        this.spriteSheet.src = '/static/images/hero_warrior.png';
        this.spriteLoaded = false;
        this.spriteSheet.onload = () => {
            this.spriteLoaded = true;
        };

        this.fw = 200; // Chiều rộng 1 frame
        this.fh = 200; // Chiều cao 1 frame
        this.scale = 1.35; // Tỷ lệ phóng to pixel lý tưởng cho sàn đấu platform

        // Quản lý Animation
        this.animState = 'idle'; // 'idle', 'run', 'attack1', 'attack2', 'charge'
        this.currentFrame = 0;
        this.frameTick = 0;
        this.frameSpeed = 5; // Tốc độ diễn hoạt
        this.chargeTimer = 0;
        this.floatY = 0;

        // Cache Avatar TikTok
        this.avatarImages = {};

        // Vị trí người chơi
        this.x = 220;
        this.y = 800;
        this.weaponColor = '#00e5ff';

        // Dữ liệu Máu & Hồi Sinh của Dũng Sĩ
        this.playerData = {
            max_hp: 1000,
            current_hp: 1000,
            hp_percent: 100,
            is_dead: false,
            revive_hearts_required: 50,
            revive_hearts_count: 0,
            revive_percent: 0
        };
        this.displayHpPercent = 100;
        this.hurtFlash = 0;
        this.healGlow = 0;
    }

    setPlayerData(data) {
        if (!data) return;
        this.playerData = Object.assign({}, this.playerData, data);
    }

    triggerHurt() {
        this.hurtFlash = 1.0;
    }

    triggerHeal() {
        this.healGlow = 1.0;
    }

    setUserData(nickname, avatar, skillName, effectType = 'sword_slash') {
        this.currentUser.nickname = nickname || 'Dũng Sĩ';
        this.currentUser.avatar = avatar || '';
        this.currentUser.skillName = skillName || 'Tấn công';
        this.currentUser.effectType = effectType;

        if (avatar && !this.avatarImages[avatar]) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = avatar;
            img.onload = () => {
                this.avatarImages[avatar] = img;
            };
            this.avatarImages[avatar] = img;
        }

        if (effectType.startsWith('gift_')) {
            this.weaponColor = '#ffd700';
        } else if (effectType === 'fireball') {
            this.weaponColor = '#ff5722';
        } else if (effectType === 'lightning') {
            this.weaponColor = '#d500f9';
        } else if (effectType === 'ice_shard') {
            this.weaponColor = '#00e5ff';
        } else {
            this.weaponColor = '#ffd700';
        }
    }

    triggerAttack(nickname, avatar, skillName, effectType = 'sword_slash') {
        this.setUserData(nickname, avatar, skillName, effectType);
        this.animState = (Math.random() > 0.5) ? 'attack1' : 'attack2';
        this.currentFrame = 0;
        this.frameTick = 0;
    }

    triggerCast(nickname, avatar, skillName, effectType = 'fireball') {
        this.setUserData(nickname, avatar, skillName, effectType);
        this.animState = 'attack2';
        this.currentFrame = 0;
        this.frameTick = 0;
    }

    triggerGiftCharge(nickname, avatar, skillName, effectType = 'gift_galaxy', durationFrames = 60) {
        this.setUserData(nickname, avatar, skillName, effectType);
        this.animState = 'charge';
        this.currentFrame = 0;
        this.frameTick = 0;
        this.chargeTimer = durationFrames;
    }

    update() {
        this.time += 0.05;
        this.frameTick++;

        if (this.animState === 'charge') {
            this.floatY = Math.sin(this.time * 6) * 8 - 10; // Lơ lửng trên không
            if (this.frameTick % 6 === 0) {
                this.currentFrame = (this.currentFrame + 1) % 8;
            }
            if (this.chargeTimer > 0) {
                this.chargeTimer--;
                if (this.chargeTimer <= 0) {
                    this.animState = 'attack1';
                    this.currentFrame = 0;
                    this.floatY = 0;
                }
            }
        } else if (this.animState === 'attack1' || this.animState === 'attack2') {
            this.floatY = 0;
            if (this.frameTick % 4 === 0) {
                this.currentFrame++;
                if (this.currentFrame >= 6) {
                    this.animState = 'idle';
                    this.currentFrame = 0;
                }
            }
        } else {
            // Idle bình thường
            this.floatY = Math.sin(this.time * 2.0) * 1.5;
            if (this.frameTick % this.frameSpeed === 0) {
                this.currentFrame = (this.currentFrame + 1) % 8;
            }
        }

        if (this.hurtFlash > 0) this.hurtFlash -= 0.08;
        if (this.healGlow > 0) this.healGlow -= 0.05;

        // Smooth Lerp hiển thị phần trăm máu người chơi
        const targetHp = (this.playerData && typeof this.playerData.hp_percent === 'number') ? this.playerData.hp_percent : 100;
        this.displayHpPercent += (targetHp - this.displayHpPercent) * 0.15;
    }

    draw(ctx, posX, groundY) {
        this.update();
        this.x = posX;
        this.y = groundY;

        ctx.save();
        ctx.imageSmoothingEnabled = false; // Chuẩn Retro Pixel Art sắc nét

        const charX = posX;
        const charY = groundY + (this.playerData.is_dead ? 0 : this.floatY);

        // 1. HÀO QUANG KHI NẠP NĂNG LƯỢNG QUÀ TẶNG (GIFT CHARGE)
        if (!this.playerData.is_dead && (this.animState === 'charge' || this.chargeTimer > 0)) {
            this._drawGiftAura(ctx, charX, charY);
        }

        // 2. VẼ BÓNG DƯỚI SÀN
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        const shadowScale = this.playerData.is_dead ? 0.8 : Math.max(0.4, 1.0 - (-this.floatY / 30));
        ctx.ellipse(charX, groundY - 2, 26 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3. VẼ NHÂN VẬT TỪ SPRITE SHEET PIXEL ART
        this._drawSprite(ctx, charX, charY);

        // Đầu nhân vật nằm ở y=70 trong frame 200x200 (feet ở y=122, diff = 52px)
        const headTopY = charY - (52 * this.scale);

        // 4. VẼ THANH MÁU HOẶC HỘP THẢ TIM HỒI SINH
        if (this.playerData.is_dead) {
            this._drawRevivalBox(ctx, charX, headTopY - 45);
        } else {
            // 4.1. Avatar TikTok
            this._drawUserAvatar(ctx, charX, headTopY - 26);
            // 4.2. Bảng tên & Chiêu thức
            this._drawUserBadge(ctx, charX, headTopY - 60);
            // 4.3. THANH MÁU DŨNG SĨ (PLAYER HEALTH BAR)
            this._drawPlayerHpBar(ctx, charX, headTopY - 78);
        }

        ctx.restore();
    }

    _drawPlayerHpBar(ctx, x, y) {
        ctx.save();
        const barW = 110;
        const barH = 11;
        const bx = x - barW / 2;
        const by = y;

        // Khung nền thanh máu
        ctx.fillStyle = 'rgba(5, 2, 15, 0.9)';
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(bx, by, barW, barH, 4);
        ctx.fill();
        ctx.stroke();

        // Máu hiện tại (Lerp)
        const hpPct = Math.max(0, Math.min(100, this.displayHpPercent));
        const fillW = Math.max(0, (barW - 2) * (hpPct / 100));

        if (fillW > 0) {
            let fillColor = '#00e676'; // Xanh lá
            if (hpPct <= 25) {
                fillColor = '#ff1744'; // Đỏ nguy hiểm
            } else if (hpPct <= 50) {
                fillColor = '#ffea00'; // Vàng cam
            }
            ctx.fillStyle = fillColor;
            ctx.beginPath();
            ctx.roundRect(bx + 1, by + 1, fillW, barH - 2, 3);
            ctx.fill();
        }

        // Chữ số máu
        const curHp = this.playerData.current_hp || 0;
        const maxHp = this.playerData.max_hp || 1000;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 3;
        ctx.fillText(`❤️ ${curHp.toLocaleString()} / ${maxHp.toLocaleString()}`, x, by + barH / 2);

        ctx.restore();
    }

    _drawRevivalBox(ctx, x, y) {
        ctx.save();
        const boxW = 150;
        const boxH = 46;
        const bx = x - boxW / 2;
        const by = y;

        const pulse = 0.85 + Math.sin(this.time * 6.0) * 0.15;

        // Nền hộp hồi sinh
        ctx.fillStyle = 'rgba(25, 5, 20, 0.94)';
        ctx.strokeStyle = `rgba(255, 23, 68, ${pulse})`;
        ctx.lineWidth = 2.0;
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Tiêu đề
        ctx.fillStyle = '#ff5252';
        ctx.font = 'bold 10px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💀 DŨNG SĨ ĐÃ GỤC NGÃ!', x, by + 12);

        // Thanh tiến độ thả tim hồi sinh
        const barW = 130;
        const barH = 12;
        const barX = x - barW / 2;
        const barY = by + 20;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.strokeStyle = '#e91e63';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();
        ctx.stroke();

        const count = this.playerData.revive_hearts_count || 0;
        const req = this.playerData.revive_hearts_required || 50;
        const pct = Math.min(100, Math.max(0, (count / req) * 100));
        const fillW = Math.max(0, (barW - 2) * (pct / 100));

        if (fillW > 0) {
            ctx.fillStyle = 'linear-gradient(90deg, #ff4081, #e91e63)';
            ctx.fillStyle = '#ff4081';
            ctx.beginPath();
            ctx.roundRect(barX + 1, barY + 1, fillW, barH - 2, 3);
            ctx.fill();
        }

        // Chữ tiến độ tim
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px Montserrat, sans-serif';
        ctx.fillText(`THẢ TIM CỨU: ${count} / ${req} ❤️`, x, barY + barH / 2 + 1);

        // Nhắc nhở nhấp nháy
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 8px Montserrat, sans-serif';
        ctx.fillText('👉 CHAT "TIM" HOẶC CHẠM MÀN HÌNH', x, by + 40);

        ctx.restore();
    }

    _drawSprite(ctx, x, y) {
        if (!this.spriteLoaded) {
            // Fallback nếu ảnh đang tải
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(x - 20, y - 60, 40, 60);
            return;
        }

        // Xác định dòng (Row) trong sprite sheet theo animation state
        let row = 0; // Row 0: Idle (8 frames)
        let maxFramesInRow = 8;
        if (this.animState === 'run') {
            row = 1;
            maxFramesInRow = 8;
        } else if (this.animState === 'attack1') {
            row = 2; // Row 2: Attack 1 (6 frames)
            maxFramesInRow = 6;
        } else if (this.animState === 'attack2') {
            row = 3; // Row 3: Attack 2 (6 frames)
            maxFramesInRow = 6;
        } else if (this.animState === 'charge') {
            row = 4; // Row 4: Charge / Cast pose (8 frames)
            maxFramesInRow = 8;
        }

        const col = Math.min(maxFramesInRow - 1, Math.max(0, this.currentFrame));
        const sx = col * this.fw;
        const sy = row * this.fh;

        const dw = this.fw * this.scale;
        const dh = this.fh * this.scale;

        // Căn chỉnh tâm trọng tâm và chân nhân vật chạm sát mặt đất:
        // Trong frame 200x200:
        // Trọng tâm x ở giữa = 100.
        // Chân nhân vật chạm đất ở y = 122.
        const drawX = x - (100 * this.scale);
        const drawY = y - (122 * this.scale);

        ctx.save();
        if (this.playerData.is_dead) {
            ctx.filter = 'grayscale(100%) opacity(60%)';
        }

        ctx.drawImage(
            this.spriteSheet,
            sx, sy, this.fw, this.fh,
            drawX, drawY, dw, dh
        );

        // Hiệu ứng chớp đỏ khi Dũng Sĩ bị Boss đánh trúng
        if (this.hurtFlash > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(255, 30, 60, ${this.hurtFlash * 0.6})`;
            ctx.fillRect(drawX, drawY, dw, dh);
        }

        // Hiệu ứng hào quang xanh lá khi được hồi máu
        if (this.healGlow > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(0, 230, 118, ${this.healGlow * 0.5})`;
            ctx.fillRect(drawX, drawY, dw, dh);
        }
        ctx.restore();
    }

    _drawGiftAura(ctx, x, y) {
        ctx.save();
        const rot = this.time * 4.0;
        const auraY = y - (30 * this.scale);

        const auraGrad = ctx.createRadialGradient(x, auraY, 10, x, auraY, 85);
        auraGrad.addColorStop(0, 'rgba(255, 215, 0, 0.9)');
        auraGrad.addColorStop(0.5, 'rgba(255, 61, 0, 0.35)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(x, auraY, 85, 0, Math.PI * 2);
        ctx.fill();

        // Vòng rune xoay tròn
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(x, auraY, 65 + Math.sin(this.time * 8) * 4, rot, rot + Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    _drawUserAvatar(ctx, x, y) {
        ctx.save();
        const avatarRadius = 22;
        const img = this.avatarImages[this.currentUser.avatar];

        // Viền phát sáng theo loại chiêu thức
        ctx.shadowColor = this.weaponColor;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = (this.animState === 'charge') ? '#ffd700' : '#ffffff';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.arc(x, y, avatarRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Cắt hình tròn dán avatar người dùng
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, avatarRadius, 0, Math.PI * 2);
        ctx.clip();

        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, x - avatarRadius, y - avatarRadius, avatarRadius * 2, avatarRadius * 2);
        } else {
            ctx.fillStyle = '#1565c0';
            ctx.fillRect(x - avatarRadius, y - avatarRadius, avatarRadius * 2, avatarRadius * 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Montserrat, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initial = (this.currentUser.nickname || 'H').charAt(0).toUpperCase();
            ctx.fillText(initial, x, y);
        }
        ctx.restore();

        // Vương miện hoàng kim nếu tặng quà
        if (this.animState === 'charge' || this.currentUser.effectType.startsWith('gift_')) {
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('👑', x, y - avatarRadius - 4);
        }

        ctx.restore();
    }

    _drawUserBadge(ctx, x, y) {
        ctx.save();
        const nickname = `@${this.currentUser.nickname}`;
        const skillName = this.currentUser.skillName;

        ctx.font = 'bold 12px Montserrat, sans-serif';
        const nickWidth = ctx.measureText(nickname).width;
        ctx.font = 'bold 10px Montserrat, sans-serif';
        const skillWidth = ctx.measureText(skillName).width;

        const badgeWidth = Math.max(nickWidth, skillWidth) + 20;
        const badgeHeight = 32;
        const badgeX = x - badgeWidth / 2;
        const badgeY = y;

        // Khung nền huy hiệu bóng bẩy
        ctx.fillStyle = 'rgba(10, 3, 24, 0.88)';
        ctx.strokeStyle = this.weaponColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6);
        ctx.fill();
        ctx.stroke();

        // Tên người dùng
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(nickname, x, badgeY + 3);

        // Tên chiêu
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9.5px Montserrat, sans-serif';
        ctx.fillText(skillName, x, badgeY + 17);

        ctx.restore();
    }
}

window.PlayerRenderer = PlayerRenderer;
