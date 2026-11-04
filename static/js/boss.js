// boss.js - Hiển thị & Diễn hoạt Boss tối ưu hiệu năng cao (Zero-Lag)

// LỚP VẦNG HÀO QUANG PROCEDURAL PIXELFX DÀNH RIÊNG CHO BOSS
class BossAuraFX {
    constructor(bossType = 'dragon') {
        this.bossType = bossType;
        this.inst = null;
        this.frame = null;
        this.canvas = null;
        this.ctx = null;
        this.imgData = null;
        this.initFx();
    }

    initFx() {
        if (!window.PixelFX || !window.PixelFX.effects || !window.PixelFX.effects.blackHole) {
            return;
        }
        this.mod = window.PixelFX.effects.blackHole;
        const [w, h] = this.mod.meta.size; // 184 x 132
        this.w = w;
        this.h = h;
        // Tâm hố xoay blackHole là tại ox = 92, oy = 54 (do bt = -70 so với origin 124)
        this.ox = 92;
        this.oy = 54;

        this.canvas = document.createElement('canvas');
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx = this.canvas.getContext('2d');
        this.imgData = this.ctx.createImageData(w, h);

        this.frame = window.PixelFX.createFrame(w, h);
        this.palette = this.getPaletteForBoss(this.bossType);

        this.inst = window.PixelFX.createFx(this.mod, {
            x: this.mod.meta.origin[0],
            y: this.mod.meta.origin[1],
            palette: this.palette,
            seed: 7
        });
    }

    getPaletteForBoss(bType) {
        switch (bType) {
            case 'dragon': // Ải 1: Hỏa Long Ignis - Lửa rực đỏ cam vàng
                return ["#1f0b10","#4a1118","#8c1d1c","#cc3a1a","#f2701f","#ffae35","#ffe27a","#ffffff"];
            case 'titan': // Ải 2: Ma Vương Morzan - Hắc ám tím huyền bí
                return ["#050308","#0f0a18","#1c1230","#2c1a4a","#432468","#5e3290","#8048b8","#a970e0"];
            case 'golem': // Ải 3: Titan Nham Thạch Magma - Đất đá dung nham rực lửa
                return ["#14060a","#380a10","#6e1210","#ac2410","#e8501a","#ff8c2a","#ffd25a","#ffffff"];
            case 'hydra': // Ải 4: Mãng Xà Độc Vương - Độc tố xanh lục bảo bí ẩn
                return ["#0d1a0c","#173a14","#265e18","#3f8a1e","#6cb82a","#a8e04a","#e0ff8a","#ffffff"];
            case 'cyber': // Ải 5: Mecha-X - Ma trận điện tử Cyan Neon
                return ["#041418","#08303a","#0c5260","#127c8a","#18b0be","#3ce0ec","#94f4ff","#ffffff"];
            case 'frost': // Ải 6: Băng Thần FrostLord - Hàn băng sương giá xanh tuyết
                return ["#0c1430","#162c5c","#1f4f94","#2f7fcc","#58b4ec","#9bdcff","#d8f4ff","#ffffff"];
            case 'zeus': // Ải 7: Lôi Thần Zeus - Sấm sét hoàng kim rực rỡ
                return ["#1a1500","#3d3200","#6e5a00","#ab8d00","#e8c000","#ffd700","#fff08a","#ffffff"];
            case 'lich': // Ải 8: Lich King - Tử khí u linh ma thuật
                return ["#140a26","#2b1252","#481c88","#6b2cc0","#9a48ec","#c684ff","#ecc8ff","#ffffff"];
            case 'kraken': // Ải 9: Cổ Thần Kraken - Vực thẳm biển sâu xanh dương đậm
                return ["#040d1a","#081c38","#0e3260","#145090","#2078cc","#48a8ec","#8ce0ff","#ffffff"];
            case 'phoenix': // Ải 10: Phượng Hoàng Lửa - Lửa thiêng tái sinh cam sáng
                return ["#2a0a08","#5a1210","#9e2018","#d83c20","#ff6828","#ffa838","#ffe068","#ffffff"];
            case 'tiger': // Ải 11: Bạch Hổ Chiến Thần - Bạch kim phong lôi & hoàng kim
                return ["#10141a","#222c38","#3e4e60","#627a94","#8eaec8","#bce0f0","#ffd700","#ffffff"];
            case 'anubis': // Ải 12: Cơ Giáp Anubis - Cát vàng sa mạc & linh hồn Ai Cập
                return ["#1c140a","#382814","#5c4220","#8a642e","#ba883e","#e0b050","#ffe488","#ffffff"];
            default:
                return ["#1f0b10","#4a1118","#8c1d1c","#cc3a1a","#f2701f","#ffae35","#ffe27a","#ffffff"];
        }
    }

    update(dt = 0.016) {
        if (!this.inst) {
            this.initFx();
            if (!this.inst) return;
        }
        this.inst.update(dt);
        window.PixelFX.clearFrame(this.frame);
        this.inst.draw(this.frame);
        window.PixelFX.composite(this.frame, this.imgData.data, null);
        this.ctx.putImageData(this.imgData, 0, 0);
    }

    draw(ctx, x, y, scale = 2.4, alpha = 0.85) {
        if (!this.inst) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = alpha;

        const dw = this.w * scale;
        const dh = this.h * scale;
        const dx = x - this.ox * scale;
        const dy = y - this.oy * scale;

        ctx.drawImage(this.canvas, dx, dy, dw, dh);
        ctx.restore();
    }
}

class BossRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.time = 0;
        this.hurtFlash = 0;
        this.healGlow = 0;
        this.deathProgress = 0;
        this.isHealing = false;
        this.auraFx = null;
        this.currentAuraType = null;
        this.bossData = {
            name: "Hỏa Long Ignis",
            current_hp: 50000,
            max_hp: 50000,
            hp_percent: 100,
            boss_type: "dragon",
            rage: 0,
            is_dead: false
        };

        // Danh sách 12 Boss AI phong phú & hoành tráng
        this.images = {};
        this.imagesLoaded = {};
        const bossTypes = [
            'dragon', 'titan', 'golem', 'hydra', 
            'cyber', 'frost', 'zeus', 'lich',
            'kraken', 'phoenix', 'tiger', 'anubis', 'thunder'
        ];

        bossTypes.forEach(type => {
            const img = new Image();
            let fileName = type + '.png';
            if (type === 'thunder') fileName = 'zeus.png';
            img.src = `/static/images/bosses/${fileName}`;
            img.onload = () => {
                this.imagesLoaded[type] = true;
            };
            this.images[type] = img;
        });
    }

    setBossData(data) {
        if (!data) return;
        const wasDead = this.bossData.is_dead;
        this.bossData = Object.assign({}, this.bossData, data);
        if (data.boss_type && data.boss_type !== this.currentAuraType) {
            this.currentAuraType = data.boss_type;
            this.auraFx = new BossAuraFX(this.currentAuraType);
        }
        if (!wasDead && this.bossData.is_dead) {
            this.deathProgress = 1.0;
        } else if (!this.bossData.is_dead) {
            this.deathProgress = 0;
        }
    }

    triggerHurt() {
        this.hurtFlash = 1.0;
    }

    triggerHeal() {
        this.healGlow = 1.0;
    }

    update() {
        this.time += 0.04;
        if (this.hurtFlash > 0) {
            this.hurtFlash -= 0.08;
        }
        if (this.healGlow > 0) {
            this.healGlow -= 0.05;
        }
        if (this.bossData.is_dead && this.deathProgress > 0) {
            this.deathProgress -= 0.005; // Tan biến chậm rãi trong ~3.3s cùng hiệu ứng chiêu
        }
    }

    draw(ctx, centerX, groundY) {
        this.update();
        ctx.save();

        const bType = this.bossData.boss_type || 'dragon';
        const img = this.images[bType] || this.images['dragon'];
        const isLoaded = this.imagesLoaded[bType] || this.imagesLoaded['dragon'];

        // Kích thước hiển thị boss cân đối với sàn đấu
        const isPortrait = this.canvas.height > this.canvas.width;
        const baseSize = isPortrait ? Math.min(this.canvas.width * 0.44, 280) : 340;
        const breathScale = 1.0 + Math.sin(this.time * 2.0) * 0.015;
        const bossSize = baseSize * breathScale;

        // Quái vật bay (Rồng, Phượng Hoàng, Băng Thần) lơ lửng nhẹ trên sàn, quái vật bộ đứng vững trên sàn đấu
        const isFlying = (bType === 'dragon' || bType === 'phoenix' || bType === 'frost');
        const hoverOffset = isFlying ? -22 : 0;
        const breathY = isFlying ? Math.sin(this.time * 2.0) * 8 : Math.sin(this.time * 2.0) * 3;

        // Căn chỉnh đáy chân boss chạm chuẩn mặt đất groundY (ảnh 1024x1024 có biên dưới ~25px)
        const bottomMargin = bossSize * 0.025;
        const drawX = centerX - bossSize / 2;
        const drawY = groundY - bossSize + bottomMargin + hoverOffset + breathY;

        // Giật rung nhẹ khi trúng đòn
        let shakeX = 0;
        let shakeY = 0;
        if (this.hurtFlash > 0) {
            shakeX = (Math.random() - 0.5) * 14 * this.hurtFlash;
            shakeY = (Math.random() - 0.5) * 10 * this.hurtFlash;
        }

        const renderX = drawX + shakeX;
        const renderY = drawY + shakeY;
        const centerBossY = renderY + bossSize * 0.52;

        // Nếu boss chết -> Tan biến dần
        if (this.bossData.is_dead) {
            ctx.globalAlpha = Math.max(0, this.deathProgress);
        }

        // 1. VẼ BÓNG TRÊN MẶT SÀN
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        const shadowScale = isFlying ? Math.max(0.6, 0.9 - (-hoverOffset / 60)) : 1.0;
        ctx.ellipse(centerX, groundY - 2, (bossSize * 0.32) * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. VẼ VẦNG HÀO QUANG PROCEDURAL PIXELFX PHÍA SAU BOSS
        if (!this.auraFx || this.currentAuraType !== bType) {
            this.currentAuraType = bType;
            this.auraFx = new BossAuraFX(this.currentAuraType);
        }

        // Cập nhật diễn hoạt hào quang PixelFX
        this.auraFx.update(0.016);

        // Kích thước hào quang bao trọn và tôn vinh vóc dáng Boss
        const auraScale = (bossSize / 115) * (this.bossData.rage > 40 ? (1 + (this.bossData.rage - 40) / 100 * 0.22) : 1.0);
        const auraAlpha = this.bossData.is_dead ? Math.max(0, this.deathProgress) * 0.85 : (this.bossData.rage > 40 ? 0.95 : 0.85);
        this.auraFx.draw(ctx, centerX, centerBossY, auraScale, auraAlpha);

        // 3. VẼ HÌNH ẢNH BOSS ĐỨNG TRÊN MẶT ĐẤT
        if (isLoaded && img.complete) {
            ctx.save();
            ctx.drawImage(img, renderX, renderY, bossSize, bossSize);

            // Phủ màu đỏ chói khi bị chém
            if (this.hurtFlash > 0) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = `rgba(255, 30, 60, ${this.hurtFlash * 0.6})`;
                ctx.fillRect(renderX, renderY, bossSize, bossSize);
            }

            // Phủ màu xanh lá khi hồi máu
            if (this.healGlow > 0) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = `rgba(0, 230, 118, ${this.healGlow * 0.45})`;
                ctx.fillRect(renderX, renderY, bossSize, bossSize);
            }

            ctx.restore();
        } else {
            this._drawFallback(ctx, centerX, centerBossY, bossSize);
        }

        ctx.restore();
    }

    _drawFallback(ctx, x, y, size) {
        ctx.save();
        ctx.fillStyle = '#b71c1c';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

window.BossRenderer = BossRenderer;
