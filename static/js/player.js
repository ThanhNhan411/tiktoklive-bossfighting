// player.js - HIỂN THỊ & DIỄN HOẠT NGƯỜI CHƠI (2D PLATFORM HERO)
// Đại diện cho người xem TikTok Live: Hiển thị Avatar, Tên, Chiêu thức & Diễn hoạt 2D Platform

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

        // Cache hình ảnh Avatar người dùng
        this.avatarCache = {};
        this.avatarImages = {};

        // Trạng thái diễn hoạt
        this.animState = 'idle'; // 'idle', 'windup', 'slash', 'cast', 'gift_charge'
        this.animTimer = 0;
        this.chargeTimer = 0;
        this.lungeX = 0;
        this.floatY = 0;

        // Tọa độ nhân vật trên sàn đấu
        this.x = 200;
        this.y = 800;

        // Vũ khí / Áo choàng
        this.weaponGlowColor = '#00e5ff';
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
            img.onerror = () => {
                // Fallback nếu link avatar lỗi
                this.avatarImages[avatar] = null;
            };
            this.avatarImages[avatar] = img;
        }

        // Chọn màu phát sáng của vũ khí theo chiêu thức
        if (effectType === 'fireball' || effectType === 'gift_donut') {
            this.weaponGlowColor = '#ff5722';
        } else if (effectType === 'lightning') {
            this.weaponGlowColor = '#d500f9';
        } else if (effectType === 'ice_shard') {
            this.weaponGlowColor = '#00e5ff';
        } else if (effectType === 'gift_crown' || effectType === 'gift_galaxy') {
            this.weaponGlowColor = '#ffd700';
        } else if (effectType === 'gift_heart' || effectType === 'gift_rose') {
            this.weaponGlowColor = '#ff4081';
        } else {
            this.weaponGlowColor = '#00e5ff';
        }
    }

    triggerAttack(nickname, avatar, skillName, effectType = 'sword_slash') {
        this.setUserData(nickname, avatar, skillName, effectType);
        this.animState = 'slash';
        this.animTimer = 22; // ~0.35s chém
        this.lungeX = 35; // Lao tới 35px
    }

    triggerCast(nickname, avatar, skillName, effectType = 'fireball') {
        this.setUserData(nickname, avatar, skillName, effectType);
        this.animState = 'cast';
        this.animTimer = 25; // ~0.4s niệm chú
        this.lungeX = 15;
    }

    triggerGiftCharge(nickname, avatar, skillName, effectType = 'gift_galaxy', durationFrames = 45) {
        this.setUserData(nickname, avatar, skillName, effectType);
        this.animState = 'gift_charge';
        this.chargeTimer = durationFrames; // Tích tụ năng lượng trước khi ra tuyệt kỹ
    }

    update() {
        this.time += 0.05;

        // Giảm dần độ lao tới
        if (this.lungeX > 0) {
            this.lungeX *= 0.88;
        }

        // Xử lý đếm ngược diễn hoạt
        if (this.chargeTimer > 0) {
            this.chargeTimer--;
            this.floatY = Math.sin(this.time * 6) * 16 - 12; // Lơ lửng trên không
            if (this.chargeTimer <= 0) {
                this.animState = 'slash';
                this.animTimer = 30;
                this.lungeX = 50;
            }
        } else if (this.animTimer > 0) {
            this.animTimer--;
            if (this.animTimer <= 0) {
                this.animState = 'idle';
                this.floatY = 0;
            }
        } else {
            this.animState = 'idle';
            this.floatY = Math.sin(this.time * 2.0) * 3; // Nhịp thở bình thường
        }
    }

    draw(ctx, posX, posY) {
        this.update();
        this.x = posX;
        this.y = posY;

        const charX = posX + this.lungeX;
        const charY = posY + this.floatY;

        ctx.save();

        // 1. VÒNG HÀO QUANG KHI TÍCH TỤ TUYỆT KỸ (GIFT CHARGE)
        if (this.animState === 'gift_charge' || this.chargeTimer > 0) {
            this._drawGiftAura(ctx, charX, charY);
        }

        // 2. VẼ BÓNG DƯỚI CHÂN
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        const shadowScale = Math.max(0.4, 1.0 - (this.floatY / -40));
        ctx.ellipse(charX, posY + 5, 36 * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3. VẼ THÂN NHÂN VẬT 2D PLATFORM (CHIẾN BINH / PHÁP SƯ)
        this._drawHeroBody(ctx, charX, charY);

        // 4. VẼ AVATAR NGƯỜI DÙNG Ở ĐẦU / KHUNG HUY HIỆU
        this._drawUserAvatar(ctx, charX, charY - 60);

        // 5. VẼ BẢNG TÊN & CHIÊU THỨC PHÍA TRÊN ĐẦU
        this._drawUserBadge(ctx, charX, charY - 110);

        ctx.restore();
    }

    _drawGiftAura(ctx, x, y) {
        ctx.save();
        const rot = this.time * 4.0;
        const auraGrad = ctx.createRadialGradient(x, y - 40, 10, x, y - 40, 95);
        auraGrad.addColorStop(0, 'rgba(255, 215, 0, 0.9)');
        auraGrad.addColorStop(0.5, 'rgba(255, 61, 0, 0.5)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(x, y - 40, 95, 0, Math.PI * 2);
        ctx.fill();

        // Vòng ma pháp xoay tròn
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(x, y - 40, 75 + Math.sin(this.time * 8) * 6, rot, rot + Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    _drawHeroBody(ctx, x, y) {
        ctx.save();

        const breath = Math.sin(this.time * 2.5) * 2;
        const isSlashing = (this.animState === 'slash');
        const isCharging = (this.animState === 'gift_charge');

        // Áo choàng (Cape) tung bay
        const capeFlutter = Math.sin(this.time * 3.5) * 10;
        ctx.fillStyle = isCharging ? '#ffd700' : '#d50000';
        ctx.beginPath();
        ctx.moveTo(x - 12, y - 45);
        ctx.quadraticCurveTo(x - 30 + capeFlutter, y - 25, x - 26 + capeFlutter * 1.3, y - 2);
        ctx.lineTo(x - 6, y - 10);
        ctx.closePath();
        ctx.fill();

        // Chân trái & Chân phải
        ctx.fillStyle = '#263238';
        ctx.fillRect(x - 14, y - 16, 10, 18);
        ctx.fillRect(x + 2, y - 16, 10, 18);

        // Giày giáp sắt
        ctx.fillStyle = '#cfd8dc';
        ctx.fillRect(x - 16, y - 4, 13, 6);
        ctx.fillRect(x + 1, y - 4, 13, 6);

        // Thân áo giáp kim loại
        ctx.fillStyle = isCharging ? '#ffb300' : '#37474f';
        ctx.beginPath();
        ctx.roundRect(x - 16, y - 48 + breath, 30, 34, 6);
        ctx.fill();

        // Viền ngực giáp vàng
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Biểu tượng giáp ngực phát sáng
        ctx.fillStyle = this.weaponGlowColor;
        ctx.beginPath();
        ctx.arc(x - 1, y - 32 + breath, 5, 0, Math.PI * 2);
        ctx.fill();

        // Tay cầm vũ khí & Đòn chém
        ctx.save();
        ctx.translate(x + 8, y - 35 + breath);

        let weaponAngle = 0.3; // Tư thế cầm kiếm bình thường
        if (isSlashing) {
            weaponAngle = 1.6; // Chém thẳng về phía trước tới Boss
        } else if (isCharging) {
            weaponAngle = -0.9; // Giơ kiếm thẳng lên trời tích tụ nộ
        }

        ctx.rotate(weaponAngle);

        // Chuôi kiếm
        ctx.fillStyle = '#795548';
        ctx.fillRect(-3, -2, 6, 14);

        // Thanh chắn kiếm
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-10, -5, 20, 5);

        // Lưỡi kiếm sắc bén (Hướng sang phải tới Boss)
        const swordLen = isCharging ? 55 : 46;
        ctx.fillStyle = '#eceff1';
        ctx.beginPath();
        ctx.moveTo(-4, -5);
        ctx.lineTo(-4, -swordLen);
        ctx.lineTo(0, -swordLen - 8);
        ctx.lineTo(4, -swordLen);
        ctx.lineTo(4, -5);
        ctx.closePath();
        ctx.fill();

        // Vệt phát sáng trên lưỡi kiếm
        ctx.strokeStyle = this.weaponGlowColor;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.restore();

        // Tay trái (Khiên ma thuật hoặc quả cầu sáng)
        ctx.fillStyle = this.weaponGlowColor;
        ctx.beginPath();
        ctx.arc(x - 12, y - 30 + breath, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    _drawUserAvatar(ctx, x, y) {
        ctx.save();

        const avatarRadius = 24;
        const img = this.avatarImages[this.currentUser.avatar];

        // Vòng phát sáng quanh Avatar
        ctx.shadowColor = this.weaponGlowColor;
        ctx.shadowBlur = 12;

        ctx.strokeStyle = (this.animState === 'gift_charge') ? '#ffd700' : '#ffffff';
        ctx.lineWidth = 3.5;

        ctx.beginPath();
        ctx.arc(x, y, avatarRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Cắt hình tròn để dán Avatar TikTok người dùng
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, avatarRadius, 0, Math.PI * 2);
        ctx.clip();

        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, x - avatarRadius, y - avatarRadius, avatarRadius * 2, avatarRadius * 2);
        } else {
            // Avatar dự phòng phong cách hiệp sĩ hoàng gia
            ctx.fillStyle = 'linear-gradient(135deg, #1565c0, #0d47a1)';
            ctx.fillRect(x - avatarRadius, y - avatarRadius, avatarRadius * 2, avatarRadius * 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Montserrat, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initial = (this.currentUser.nickname || 'H').charAt(0).toUpperCase();
            ctx.fillText(initial, x, y);
        }

        ctx.restore();

        // Vương miện nhỏ trên avatar nếu là đại gia tặng quà
        if (this.animState === 'gift_charge' || this.currentUser.effectType.startsWith('gift_')) {
            ctx.font = '18px sans-serif';
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
        ctx.font = 'bold 11px Montserrat, sans-serif';
        const skillWidth = ctx.measureText(skillName).width;

        const badgeWidth = Math.max(nickWidth, skillWidth) + 24;
        const badgeHeight = 36;
        const badgeX = x - badgeWidth / 2;
        const badgeY = y;

        // Khung nền huy hiệu bóng bẩy
        ctx.fillStyle = 'rgba(8, 2, 20, 0.85)';
        ctx.strokeStyle = this.weaponGlowColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 8);
        ctx.fill();
        ctx.stroke();

        // Tên người dùng
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(nickname, x, badgeY + 4);

        // Tên chiêu thức
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Montserrat, sans-serif';
        ctx.fillText(skillName, x, badgeY + 20);

        ctx.restore();
    }
}

window.PlayerRenderer = PlayerRenderer;
