// effects.js - QUẢN LÝ HIỆU ỨNG THUẦN TÚY BẰNG THƯ VIỆN PIXELFX PROCEDURAL
// 100% ĐỒ HỌA PIXEL ART - TƯƠNG TÁC CHUẨN XÁC VỚI MẶT ĐẤT - 60 FPS MƯỢT MÀ

const MAX_DAMAGE_NUMBERS = 25;    // Giới hạn số sát thương tối đa
const MAX_ACTIVE_PIXELFX = 10;    // Giới hạn hiệu ứng PixelFX cùng lúc

// LỚP DIỄN HOẠT HIỆU ỨNG TỪ THƯ VIỆN PIXELFX
class PixelFXInstance {
    constructor(effectMod, x, y, scale = 2.8, customOptions = {}) {
        this.mod = effectMod;
        this.meta = effectMod.meta || {};
        const [w, h] = this.meta.size || [160, 120];
        const [ox, oy] = this.meta.origin || [Math.floor(w / 2), Math.floor(h / 2)];
        this.w = w;
        this.h = h;
        this.ox = ox;
        this.oy = oy;
        this.x = x;
        this.y = y;
        this.scale = scale;

        this.canvas = document.createElement('canvas');
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx = this.canvas.getContext('2d');
        this.imgData = this.ctx.createImageData(w, h);

        this.frame = window.PixelFX.createFrame(w, h);
        this.inst = window.PixelFX.createFx(this.mod, {
            x: ox,
            y: oy,
            ...customOptions
        });

        this.isDead = false;
        this.fps = this.meta.fps || 30;
        this.step = 1 / this.fps;
        this.acc = 0;
        
        // Thời lượng hiệu ứng: dù effect có loop trong PixelFX thì trong game kỹ năng vẫn phải kết thúc sau 2.0s - 3.2s!
        this.maxDuration = customOptions.duration || (this.meta.loop ? Math.min(this.meta.duration || 2.5, 3.0) : (this.meta.duration || 2.2));
        this.elapsed = 0;
        this.hasStopped = false;
    }

    update(dt = 0.016) {
        if (this.isDead) return false;
        this.elapsed += dt;
        this.acc += dt;

        // Trước khi kết thúc 0.4s -> Gọi stop() để PixelFX mờ dần tự nhiên
        if (this.elapsed >= (this.maxDuration - 0.4) && !this.hasStopped) {
            this.hasStopped = true;
            if (this.inst && typeof this.inst.stop === 'function') {
                this.inst.stop();
            }
        }

        // Khi hết thời lượng hoặc inst đã done() -> Tiêu hủy dứt điểm hiệu ứng
        if (this.elapsed >= this.maxDuration || (this.inst && typeof this.inst.done === 'function' && this.inst.done())) {
            this.isDead = true;
            return false;
        }

        while (this.acc >= this.step) {
            this.acc -= this.step;
            this.inst.update(this.step);
        }

        // Xóa frame và vẽ ĐẦY ĐỦ cả 2 lớp (Back: nứt sàn/khói mặt đất + Front: tia lửa/hào quang)
        window.PixelFX.clearFrame(this.frame);
        this.inst.draw(this.frame); // Vẽ đầy đủ cả layer back và front
        window.PixelFX.composite(this.frame, this.imgData.data, null);
        this.ctx.putImageData(this.imgData, 0, 0);
        return true;
    }

    draw(mainCtx) {
        if (this.isDead) return;
        mainCtx.save();
        mainCtx.imageSmoothingEnabled = false; // Chuẩn Retro Pixel Art sắc nét

        const drawW = this.w * this.scale;
        const drawH = this.h * this.scale;
        // Đặt chuẩn xác gốc tọa độ (origin) chạm sát sàn đấu groundY
        const drawX = this.x - this.ox * this.scale;
        const drawY = this.y - this.oy * this.scale;

        mainCtx.drawImage(this.canvas, drawX, drawY, drawW, drawH);
        mainCtx.restore();
    }
}

// SỐ HIỂN THỊ SÁT THƯƠNG (RETRO DAMAGE NUMBERS)
class DamageNumber {
    constructor(x, y, text, color = '#ffeb3b', isCrit = false) {
        this.x = x + (Math.random() - 0.5) * 45;
        this.baseX = this.x;
        this.y = y - 15 + (Math.random() - 0.5) * 20;
        this.text = text;
        this.color = color;
        this.isCrit = isCrit;
        this.life = 1.0;
        this.vy = isCrit ? -3.5 : -2.2;
        this.scale = isCrit ? 1.5 : 1.0;
        this.age = 0;
    }

    update() {
        this.age++;
        this.vy *= 0.93;
        this.y += this.vy;
        this.x = this.baseX + Math.sin(this.age * 0.1) * 6;
        this.life -= 0.015;
        return this.life > 0;
    }

    draw(ctx) {
        const alpha = Math.min(1, this.life * 2.0);
        ctx.save();
        ctx.globalAlpha = alpha;
        const fontSize = Math.floor((this.isCrit ? 32 : 22) * this.scale);
        ctx.font = `900 ${fontSize}px "Montserrat", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = this.isCrit ? 5 : 3.5;
        ctx.strokeText(this.text, this.x, this.y);

        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// KỸ NĂNG CHIẾN ĐẤU THUẦN PIXELFX
class VisualSkillEffect {
    constructor(type, targetX, targetY, options = {}) {
        this.type = type;
        this.targetX = targetX;
        this.targetY = targetY;
        this.options = options;
        this.frame = 0;
        this.isDead = false;
        this.maxFrames = this._getMaxFrames(type);
    }

    _getMaxFrames(type) {
        switch (type) {
            case 'sword_slash': return 40;
            case 'fireball': return 60;
            case 'lightning': return 60;
            case 'ice_shard': return 60;
            case 'bomb_blast': return 60;
            case 'magic_bullet':
            case 'heart_barrage': return 50;
            case 'gift_rose':
            case 'blade_storm': return 110;
            case 'gift_heart': return 90;
            case 'gift_donut':
            case 'meteor_shower': return 120;
            case 'gift_rocket': return 140;
            case 'gift_crown': return 130;
            case 'gift_corgi': return 100;
            case 'gift_car': return 110;
            case 'gift_lion': return 120;
            case 'gift_galaxy':
            case 'ultimate_dragon': return 160;
            default: return 50;
        }
    }

    update(effectsManager) {
        this.frame++;

        const groundY = this.options.groundY || (this.targetY + 40);
        const originX = this.options.originX || (this.targetX - 240);

        // 1. Trảm Phong Kiếm (Double Slash + Critical Hit Impact từ PixelFX)
        if (this.type === 'sword_slash') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(6, 10);
                effectsManager.spawnPixelFX('doubleSlash', this.targetX, groundY, 2.2, { duration: 1.0 });
                effectsManager.spawnPixelFX('criticalHit', this.targetX, groundY - 45, 1.8, { duration: 0.8 });
            }
        }

        // 2. Cầu Lửa (Fireball bay tới + Big Explosion nổ nứt mặt đất)
        else if (this.type === 'fireball') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(7, 10);
                effectsManager.spawnPixelFX('fireball', originX + 50, groundY - 45, 2.0, { duration: 0.45 });
            } else if (this.frame === 12) {
                effectsManager.triggerScreenShake(10, 14);
                effectsManager.spawnPixelFX('bigExplosion', this.targetX, groundY, 2.2, { duration: 1.8 });
            }
        }

        // 3. Lôi Thần Trừng Phạt (Lightning Strike giáng thẳng nứt mặt đất)
        else if (this.type === 'lightning') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(11, 15);
                effectsManager.spawnPixelFX('lightningStrike', this.targetX, groundY, 2.3, { duration: 1.8 });
            }
        }

        // 4. Băng Thiên Tiễn (Frost Nova nở rộ từ mặt đất + Ice Crystal)
        else if (this.type === 'ice_shard') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(5, 10);
                effectsManager.spawnPixelFX('frostNova', this.targetX, groundY, 2.1, { duration: 1.8 });
                effectsManager.spawnPixelFX('iceCrystal', this.targetX, groundY - 20, 2.2, { duration: 1.6 });
            }
        }

        // 5. Bộc Phá Ma Thuật (Barrel Explosion nổ tung trên mặt sàn)
        else if (this.type === 'bomb_blast') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(10, 14);
                effectsManager.spawnPixelFX('barrelExplosion', this.targetX, groundY, 2.3, { duration: 1.8 });
            }
        }

        // 6. Thả Tim / Đạn Ma Thuật (Charmed Sparkles từ PixelFX)
        else if (this.type === 'heart_barrage' || this.type === 'magic_bullet') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(3, 6);
                effectsManager.spawnPixelFX('charmed', this.targetX, groundY - 35, 2.2, { duration: 1.4 });
            }
        }

        // 🌹 Quà 1: Hoa Hồng - Vạn Kiếm Quy Tông (Bão kiếm trảm liên hoàn Heavy Cleave + Double Slash + Critical Hit)
        else if (this.type === 'gift_rose' || this.type === 'blade_storm') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(12, 16);
                effectsManager.spawnPixelFX('heavyCleave', this.targetX, groundY, 2.7, { duration: 1.6 });
                effectsManager.spawnPixelFX('doubleSlash', this.targetX - 25, groundY - 25, 2.4, { duration: 1.2 });
            } else if (this.frame === 10) {
                effectsManager.spawnPixelFX('criticalHit', this.targetX, groundY - 45, 2.0, { duration: 0.8 });
            } else if (this.frame === 20) {
                effectsManager.spawnPixelFX('dashStrike', this.targetX, groundY, 2.2, { duration: 1.5 });
            }
        }

        // 💖 Quà 2: Trái Tim (Mũi Tên Thần Cupid - Charmed Bão Tố Đa Tầng)
        else if (this.type === 'gift_heart') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(9, 14);
                effectsManager.spawnPixelFX('charmed', this.targetX, groundY - 35, 3.2, { duration: 2.0 });
            } else if (this.frame === 12) {
                effectsManager.spawnPixelFX('charmed', this.targetX + 20, groundY - 50, 2.6, { duration: 1.6 });
            }
        }

        // 🍩 Quà 3: Donut (Meteor giáng từ bầu trời đập nát mặt sàn + Big Explosion nổ tung)
        else if (this.type === 'gift_donut' || this.type === 'meteor_shower') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(14, 20);
                effectsManager.spawnPixelFX('meteor', this.targetX, groundY, 2.6, { duration: 2.2 });
            } else if (this.frame === 16) {
                effectsManager.triggerScreenShake(16, 22);
                effectsManager.spawnPixelFX('bigExplosion', this.targetX, groundY, 2.4, { duration: 1.8 });
            }
        }

        // 🚀 Quà 4: Tên Lửa (Nuke - nấm nguyên tử mọc từ mặt đất + Critical Hit chấn động)
        else if (this.type === 'gift_rocket') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(18, 24);
                effectsManager.spawnPixelFX('nuke', this.targetX, groundY, 2.8, { duration: 2.6 });
            } else if (this.frame === 14) {
                effectsManager.spawnPixelFX('criticalHit', this.targetX, groundY - 45, 2.2, { duration: 0.9 });
            }
        }

        // 👑 Quà 5: Vương Miện (Smite - Thánh kiếm Excalibur cắm sâu xuống mặt sàn + Sóng chém Heavy Cleave)
        else if (this.type === 'gift_crown') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(16, 22);
                effectsManager.spawnPixelFX('smite', this.targetX, groundY, 2.8, { duration: 2.3 });
            } else if (this.frame === 15) {
                effectsManager.spawnPixelFX('heavyCleave', this.targetX, groundY, 2.4, { duration: 1.5 });
            }
        }

        // 🐺 Quà 6: Corgi / Bầy Sói (Dash Strike lướt thần tốc dọc mặt sàn + Critical Hit cào xé)
        else if (this.type === 'gift_corgi') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(11, 15);
                effectsManager.spawnPixelFX('dashStrike', originX, groundY, 2.5, { duration: 1.8 });
            } else if (this.frame === 12) {
                effectsManager.spawnPixelFX('criticalHit', this.targetX, groundY - 40, 2.0, { duration: 0.8 });
            }
        }

        // 🏎️ Quà 7: Siêu Xe (Dash Strike + Fire Tornado càn quét sàn đấu + Critical Hit va chạm)
        else if (this.type === 'gift_car') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(14, 18);
                effectsManager.spawnPixelFX('dashStrike', originX, groundY, 2.5, { duration: 1.8 });
                effectsManager.spawnPixelFX('fireTornado', this.targetX, groundY, 2.4, { duration: 2.0 });
            } else if (this.frame === 14) {
                effectsManager.spawnPixelFX('criticalHit', this.targetX, groundY - 45, 2.1, { duration: 0.9 });
            }
        }

        // 🦁 Quà 8: Sư Tử Lửa (Fire Tornado lốc xoáy lửa cuồn cuộn trên sàn + Heavy Cleave trảo lửa)
        else if (this.type === 'gift_lion') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(16, 22);
                effectsManager.spawnPixelFX('fireTornado', this.targetX, groundY, 2.8, { duration: 2.3 });
            } else if (this.frame === 15) {
                effectsManager.spawnPixelFX('heavyCleave', this.targetX, groundY, 2.4, { duration: 1.6 });
            }
        }

        // 🌌 Quà 9: Galaxy (Hố đen hút mọi vật trên sàn + Arcane Beam cực quang + Critical Hit nổ tung)
        else if (this.type === 'gift_galaxy' || this.type === 'ultimate_dragon') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(16, 22);
                effectsManager.spawnPixelFX('blackHole', this.targetX, groundY, 2.8, { duration: 2.8 });
            } else if (this.frame === 24) {
                effectsManager.spawnPixelFX('arcaneBeam', originX + 40, groundY - 25, 2.6, { duration: 2.0 });
            } else if (this.frame === 40) {
                effectsManager.spawnPixelFX('criticalHit', this.targetX, groundY - 45, 2.4, { duration: 1.0 });
            }
        }

        if (this.frame >= this.maxFrames) {
            this.isDead = true;
        }
    }

    draw(ctx) {
        // Đã loại bỏ toàn bộ hình vẽ canvas vector thủ công
        // Toàn bộ kỹ năng được vẽ thuần túy qua PixelFXInstance
    }
}

// BỘ ĐIỀU HÀNH HIỆU ỨNG TRUNG TÂM
class EffectsManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.damageNumbers = [];
        this.activeSkills = [];
        this.activePixelFx = [];
        this.shakeTime = 0;
        this.shakeMagnitude = 0;
    }

    triggerScreenShake(magnitude = 12, duration = 18) {
        this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
        this.shakeTime = Math.max(this.shakeTime, duration);
    }

    spawnPixelFX(effectName, x, y, scale = 2.8, options = {}) {
        if (!window.PixelFX || !window.PixelFX.effects) return null;
        const mod = window.PixelFX.effects[effectName];
        if (!mod) {
            console.warn(`[PixelFX] Unknown effect: ${effectName}`);
            return null;
        }
        if (this.activePixelFx.length >= MAX_ACTIVE_PIXELFX) {
            this.activePixelFx.shift();
        }
        const fx = new PixelFXInstance(mod, x, y, scale, options);
        this.activePixelFx.push(fx);
        return fx;
    }

    addSkill(type, targetX, targetY, options = {}) {
        if (this.activeSkills.length >= 8) {
            this.activeSkills.shift();
        }
        this.activeSkills.push(new VisualSkillEffect(type, targetX, targetY, options));
    }

    addDamageNumber(x, y, amount, isCrit = false, prefix = "-") {
        if (this.damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
            this.damageNumbers.shift();
        }
        const text = `${prefix}${amount.toLocaleString()}`;
        const color = isCrit ? '#ff1744' : (amount >= 50000 ? '#ffd700' : (amount >= 10000 ? '#ff9100' : (amount >= 1000 ? '#00e5ff' : '#ffffff')));
        this.damageNumbers.push(new DamageNumber(x, y, text, color, isCrit));
    }

    update() {
        let offsetX = 0;
        let offsetY = 0;
        if (this.shakeTime > 0) {
            this.shakeTime--;
            offsetX = (Math.random() - 0.5) * this.shakeMagnitude;
            offsetY = (Math.random() - 0.5) * this.shakeMagnitude;
            this.shakeMagnitude *= 0.94;
        }

        // In-place update activePixelFx (Cập nhật diễn hoạt PixelFX)
        let fxWrite = 0;
        for (let i = 0; i < this.activePixelFx.length; i++) {
            const fx = this.activePixelFx[i];
            if (fx.update(0.016)) {
                this.activePixelFx[fxWrite++] = fx;
            }
        }
        this.activePixelFx.length = fxWrite;

        // In-place update activeSkills
        let skillWrite = 0;
        for (let i = 0; i < this.activeSkills.length; i++) {
            const s = this.activeSkills[i];
            s.update(this);
            if (!s.isDead) {
                this.activeSkills[skillWrite++] = s;
            }
        }
        this.activeSkills.length = skillWrite;

        // In-place update damageNumbers
        let dWrite = 0;
        for (let i = 0; i < this.damageNumbers.length; i++) {
            const d = this.damageNumbers[i];
            if (d.update()) {
                this.damageNumbers[dWrite++] = d;
            }
        }
        this.damageNumbers.length = dWrite;

        return { offsetX, offsetY };
    }

    draw(ctx) {
        // 1. Vẽ các hiệu ứng PixelFX Procedural (tương tác chuẩn xác mặt sàn)
        for (let i = 0; i < this.activePixelFx.length; i++) {
            this.activePixelFx[i].draw(ctx);
        }

        // 2. Vẽ Active Skills (nếu có hook)
        for (let i = 0; i < this.activeSkills.length; i++) {
            this.activeSkills[i].draw(ctx);
        }

        // 3. Vẽ Số sát thương phong cách Retro Pixel rõ ràng
        for (let i = 0; i < this.damageNumbers.length; i++) {
            this.damageNumbers[i].draw(ctx);
        }
    }
}

window.EffectsManager = EffectsManager;
