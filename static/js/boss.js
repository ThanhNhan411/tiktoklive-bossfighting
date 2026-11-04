// boss.js - Hiển thị & Diễn hoạt Boss tối ưu hiệu năng cao (Zero-Lag)

class BossRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.time = 0;
        this.hurtFlash = 0;
        this.healGlow = 0;
        this.deathProgress = 0;
        this.isHealing = false;
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

    draw(ctx, centerX, centerY) {
        this.update();
        ctx.save();

        const bType = this.bossData.boss_type || 'dragon';
        const img = this.images[bType] || this.images['dragon'];
        const isLoaded = this.imagesLoaded[bType] || this.imagesLoaded['dragon'];

        // Độ bồng bềnh thở của quái vật
        const breathY = Math.sin(this.time * 1.5) * 12;
        const breathScale = 1.0 + Math.sin(this.time * 2.0) * 0.025;
        const x = centerX;
        const y = centerY + breathY;

        // Giật rung nhẹ khi trúng đòn
        if (this.hurtFlash > 0) {
            const shakeX = (Math.random() - 0.5) * 16 * this.hurtFlash;
            const shakeY = (Math.random() - 0.5) * 14 * this.hurtFlash;
            ctx.translate(shakeX, shakeY);
        }

        // Nếu boss chết -> Tan biến dần
        if (this.bossData.is_dead) {
            ctx.globalAlpha = Math.max(0, this.deathProgress);
        }

        // 1. VẼ HÀO QUANG PHÍA SAU BOSS (TỐI ƯU KHÔNG DÙNG SHADOWBLUR)
        this._drawMagicAura(ctx, x, y, bType);

        // 2. VẼ BOSS (TỐI ƯU KHÔNG DÙNG CTX.FILTER)
        const isPortrait = this.canvas.height > this.canvas.width;
        const baseSize = isPortrait ? Math.min(this.canvas.width * 0.48, 380) : 420;
        const bossSize = baseSize * breathScale;

        if (isLoaded && img.complete) {
            ctx.save();
            ctx.translate(x, y);

            // Vẽ ảnh Boss
            ctx.drawImage(img, -bossSize / 2, -bossSize / 2, bossSize, bossSize);

            // Phủ màu đỏ chói khi bị chém bằng source-atop (Cực nhẹ, 0 lag)
            if (this.hurtFlash > 0) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = `rgba(255, 30, 60, ${this.hurtFlash * 0.6})`;
                ctx.fillRect(-bossSize / 2, -bossSize / 2, bossSize, bossSize);
            }

            // Phủ màu xanh lá khi hồi máu
            if (this.healGlow > 0) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = `rgba(0, 230, 118, ${this.healGlow * 0.45})`;
                ctx.fillRect(-bossSize / 2, -bossSize / 2, bossSize, bossSize);
            }

            ctx.restore();
        } else {
            this._drawFallback(ctx, x, y, bossSize);
        }

        ctx.restore();
    }

    _drawMagicAura(ctx, x, y, bType) {
        ctx.save();
        const rot = this.time * 0.8;
        let auraColor = '#ff3d00';

        if (bType === 'titan') auraColor = '#7c4dff';
        else if (bType === 'cyber') auraColor = '#00e5ff';
        else if (bType === 'frost') auraColor = '#00b0ff';
        else if (bType === 'golem') auraColor = '#ff6d00';
        else if (bType === 'hydra') auraColor = '#00e676';
        else if (bType === 'zeus' || bType === 'thunder') auraColor = '#ffd700';
        else if (bType === 'lich') auraColor = '#00e5ff';
        else if (bType === 'kraken') auraColor = '#651fff';
        else if (bType === 'phoenix') auraColor = '#ff3d00';
        else if (bType === 'tiger') auraColor = '#00e5ff';
        else if (bType === 'anubis') auraColor = '#ffd700';

        if (this.healGlow > 0 || this.isHealing) {
            auraColor = '#00e676';
        }

        // Hào quang nộ bùng nổ khi nộ > 40% (Vẽ 2 vòng tròn thay cho shadowBlur nặng)
        if (this.bossData.rage > 40) {
            const rageScale = 1 + (this.bossData.rage - 40) / 100 * 0.35;
            const rageAlpha = Math.min(0.5, (this.bossData.rage - 40) / 100 * 0.6);
            ctx.beginPath();
            ctx.arc(x, y, 220 * rageScale, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 0, 0, ${rageAlpha * 0.25})`;
            ctx.fill();
        }

        // Vòng ma pháp kép (Double Ring nhẹ nhàng)
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = auraColor;
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.arc(x, y, 210, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 195, 0, Math.PI * 2);
        ctx.stroke();

        // 8 tia ma pháp xoay
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = rot + (i * Math.PI / 4);
            const ox1 = x + Math.cos(angle) * 190;
            const oy1 = y + Math.sin(angle) * 190;
            const ox2 = x + Math.cos(angle) * 225;
            const oy2 = y + Math.sin(angle) * 225;

            ctx.beginPath();
            ctx.moveTo(ox1, oy1);
            ctx.lineTo(ox2, oy2);
            ctx.stroke();
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
