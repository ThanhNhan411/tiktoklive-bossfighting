// effects.js - KỸ THUẬT SPRITE BAKING & GPU COMPOSITING: HIỆU ỨNG SIÊU ĐẸP & TỐI ƯU 60 FPS

const MAX_PARTICLES = 160;       // Giới hạn hạt tối đa trên toàn màn hình
const MAX_DAMAGE_NUMBERS = 25;    // Giới hạn số sát thương tối đa
const MAX_ACTIVE_SKILLS = 8;      // Giới hạn chiêu thức cùng lúc

// BỘ ĐỆM TEXTURE PHÁT SÁNG (OFFSCREEN SPRITE CACHE)
// Tạo sẵn 1 lần duy nhất trong RAM, sau đó GPU chỉ cần vẽ lại (drawImage) với tốc độ ánh sáng!
const GLOW_SPRITES = {};

function getGlowSprite(colorType) {
    if (GLOW_SPRITES[colorType]) return GLOW_SPRITES[colorType];

    const size = 64;
    const cvs = document.createElement('canvas');
    cvs.width = size;
    cvs.height = size;
    const ctx = cvs.getContext('2d');
    const half = size / 2;

    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, '#ffffff'); // Tâm trắng tinh khiết

    if (colorType === 'fire') {
        grad.addColorStop(0.3, '#ff9100');
        grad.addColorStop(0.7, '#ff1744');
    } else if (colorType === 'cyan') {
        grad.addColorStop(0.3, '#00e5ff');
        grad.addColorStop(0.7, '#0091ea');
    } else if (colorType === 'gold') {
        grad.addColorStop(0.3, '#ffd700');
        grad.addColorStop(0.7, '#ff6d00');
    } else if (colorType === 'purple') {
        grad.addColorStop(0.3, '#d500f9');
        grad.addColorStop(0.7, '#651fff');
    } else if (colorType === 'pink') {
        grad.addColorStop(0.3, '#ff4081');
        grad.addColorStop(0.7, '#f50057');
    } else if (colorType === 'green') {
        grad.addColorStop(0.3, '#00e676');
        grad.addColorStop(0.7, '#00b0ff');
    } else {
        grad.addColorStop(0.3, '#ffab00');
        grad.addColorStop(0.7, '#ff3d00');
    }

    grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Trong suốt ở rìa

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    GLOW_SPRITES[colorType] = cvs;
    return cvs;
}

class Particle {
    constructor(x, y, vx, vy, colorType, size, life, decay, shape = 'glow', options = {}) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.colorType = colorType; // 'fire', 'cyan', 'gold', 'purple', 'pink', 'green'
        this.size = size;
        this.initialLife = life;
        this.life = life;
        this.decay = decay;
        this.shape = shape; // 'glow', 'spark', 'heart', 'star', 'ring', 'smoke'
        this.gravity = options.gravity || 0;
        this.drag = options.drag || 0.98;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.08;
    }

    update() {
        this.vx *= this.drag;
        this.vy = (this.vy + this.gravity) * this.drag;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotSpeed;
        this.life -= this.decay;
        return this.life > 0 && this.size > 0.4;
    }

    // VẼ BẰNG PRE-RENDERED SPRITE: VỪA TỰ ĐỘNG PHÁT SÁNG CỰC ĐẸP VỪA 0% LAG
    draw(ctx) {
        const progress = Math.max(0, this.life / this.initialLife);
        ctx.globalAlpha = Math.min(1, progress * 1.3);

        if (this.shape === 'glow') {
            const sprite = getGlowSprite(this.colorType);
            const renderSize = this.size * progress * 2.4;
            ctx.drawImage(sprite, this.x - renderSize / 2, this.y - renderSize / 2, renderSize, renderSize);
        } else if (this.shape === 'spark') {
            ctx.strokeStyle = this.colorType === 'cyan' ? '#00e5ff' : (this.colorType === 'gold' ? '#ffd700' : '#ffffff');
            ctx.lineWidth = Math.max(1, this.size * 0.5);
            ctx.beginPath();
            ctx.moveTo(this.x - this.vx * 1.6, this.y - this.vy * 1.6);
            ctx.lineTo(this.x + this.vx * 1.6, this.y + this.vy * 1.6);
            ctx.stroke();
        } else if (this.shape === 'heart') {
            ctx.font = `${Math.floor(this.size * 1.6)}px sans-serif`;
            ctx.fillText('💖', this.x, this.y);
        } else if (this.shape === 'star') {
            ctx.font = `${Math.floor(this.size * 1.6)}px sans-serif`;
            ctx.fillText('✨', this.x, this.y);
        } else if (this.shape === 'ring') {
            ctx.strokeStyle = this.colorType === 'gold' ? '#ffd700' : (this.colorType === 'cyan' ? '#00e5ff' : '#ff3d00');
            ctx.lineWidth = 3.5 * progress;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * (1 + (1 - progress) * 2.8), 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.shape === 'smoke') {
            ctx.fillStyle = `rgba(45, 45, 45, ${progress * 0.28})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * (1.8 - progress * 0.8), 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class DamageNumber {
    constructor(x, y, text, color = '#ffeb3b', isCrit = false) {
        this.x = x + (Math.random() - 0.5) * 60;
        this.baseX = this.x;
        this.y = y - 20 + (Math.random() - 0.5) * 30;
        this.text = text;
        this.color = color;
        this.isCrit = isCrit;
        this.life = 1.0;
        this.vy = isCrit ? -3.8 : -2.4;
        this.scale = isCrit ? 1.6 : 1.0;
        this.age = 0;
    }

    update() {
        this.age++;
        this.vy *= 0.94;
        this.y += this.vy;
        this.x = this.baseX + Math.sin(this.age * 0.08) * 10;
        this.life -= 0.009;
        return this.life > 0;
    }

    draw(ctx) {
        const alpha = Math.min(1, this.life * 2.0);
        ctx.globalAlpha = alpha;
        const fontSize = Math.floor((this.isCrit ? 34 : 24) * this.scale);
        ctx.font = `900 ${fontSize}px "Montserrat", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = this.isCrit ? 5 : 3.5;

        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
    }
}

// LỚP DIỄN HOẠT HIỆU ỨNG PIXELFX PROCEDURAL (OPEN-SOURCE PIXELFX)
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
        this.duration = this.meta.duration || 2.2;
        this.elapsed = 0;
    }

    update(dt = 0.016) {
        if (this.isDead) return false;
        this.elapsed += dt;
        this.acc += dt;
        while (this.acc >= this.step) {
            this.acc -= this.step;
            if (this.elapsed >= this.duration && !this.meta.loop) {
                this.isDead = true;
                return false;
            }
            this.inst.update(this.step);
        }

        window.PixelFX.clearFrame(this.frame);
        this.inst.draw(this.frame, "front");
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
        const drawX = this.x - this.ox * this.scale;
        const drawY = this.y - this.oy * this.scale;

        mainCtx.drawImage(this.canvas, drawX, drawY, drawW, drawH);
        mainCtx.restore();
    }
}

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
            case 'sword_slash': return 90;
            case 'fireball': return 120;
            case 'lightning': return 130;
            case 'ice_shard': return 140;
            case 'bomb_blast': return 120;
            case 'heart_barrage': return 150;
            case 'gift_rose': return 200;
            case 'gift_heart': return 180;
            case 'gift_donut': return 200;
            case 'gift_rocket': return 220;
            case 'gift_crown': return 240;
            case 'gift_corgi': return 200;
            case 'gift_car': return 200;
            case 'gift_lion': return 260;
            case 'gift_galaxy': return 340;
            case 'blade_storm': return 200;
            case 'meteor_shower': return 200;
            case 'mega_laser': return 200;
            case 'ultimate_dragon': return 340;
            default: return 80;
        }
    }

    update(effectsManager) {
        this.frame++;

        // 1. Trảm Phong Kiếm (Double Slash từ PixelFX)
        if (this.type === 'sword_slash') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(7, 12);
                effectsManager.createSlashArc(this.targetX, this.targetY);
                effectsManager.spawnPixelFX('doubleSlash', this.targetX, this.targetY, 3.4);
            }
        }

        // 2. Cầu Lửa (Fireball + Big Explosion từ PixelFX)
        else if (this.type === 'fireball') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(8, 15);
                effectsManager.createExplosion(this.targetX, this.targetY, 'fire', 16);
                effectsManager.createShockwave(this.targetX, this.targetY, 'fire');
                effectsManager.spawnPixelFX('fireball', this.targetX - 90, this.targetY, 3.2);
                effectsManager.spawnPixelFX('bigExplosion', this.targetX, this.targetY, 2.6);
            }
            if (this.frame % 8 === 0 && this.frame < 90) {
                effectsManager.createFlameColumn(this.targetX, this.targetY);
            }
        }

        // 3. Lôi Thần (Lightning Strike + Chain Lightning từ PixelFX)
        else if (this.type === 'lightning') {
            if (this.frame === 1 || this.frame === 30 || this.frame === 60) {
                effectsManager.triggerScreenShake(10, 14);
                effectsManager.createLightningBolt(this.targetX, this.targetY);
                effectsManager.createShockwave(this.targetX, this.targetY, 'purple');
                effectsManager.spawnPixelFX('lightningStrike', this.targetX + (Math.random() - 0.5) * 60, this.targetY, 2.8);
            }
            if (this.frame === 1) {
                effectsManager.spawnPixelFX('chainLightning', this.targetX, this.targetY, 2.8);
            }
            if (this.frame % 6 === 0 && this.frame < 90) {
                effectsManager.createElectricSparks(this.targetX, this.targetY);
            }
        }

        // 4. Băng Giá (Frost Nova + Ice Crystal từ PixelFX)
        else if (this.type === 'ice_shard') {
            if (this.frame === 1) {
                effectsManager.createIcePillars(this.targetX, this.targetY);
                effectsManager.createShockwave(this.targetX, this.targetY, 'cyan');
                effectsManager.spawnPixelFX('frostNova', this.targetX, this.targetY, 2.6);
                effectsManager.spawnPixelFX('iceCrystal', this.targetX, this.targetY, 3.0);
            }
        }

        // 5. Bộc Phá (Barrel Explosion + Nuke từ PixelFX)
        else if (this.type === 'bomb_blast') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(14, 18);
                effectsManager.createExplosion(this.targetX, this.targetY, 'fire', 22);
                effectsManager.createShockwave(this.targetX, this.targetY, 'fire');
                effectsManager.spawnPixelFX('barrelExplosion', this.targetX, this.targetY, 3.0);
                effectsManager.spawnPixelFX('nuke', this.targetX, this.targetY, 2.2);
            }
            if (this.frame % 10 === 0 && this.frame < 70) {
                effectsManager.createSmokePlume(this.targetX, this.targetY);
            }
        }

        // 6. Thả Tim (Charmed Sparkles từ PixelFX)
        else if (this.type === 'heart_barrage') {
            if (this.frame % 6 === 0 && this.frame < 120) {
                effectsManager.createStreamOfHearts(this.targetX, this.targetY);
            }
            if (this.frame === 1 || this.frame === 45) {
                effectsManager.spawnPixelFX('charmed', this.targetX + (Math.random() - 0.5) * 80, this.targetY + (Math.random() - 0.5) * 60, 3.2);
            }
        }

        // 🌹 Quà 1: Hoa Hồng (Cherry Blossoms + Double Slash từ PixelFX)
        else if (this.type === 'gift_rose' || this.type === 'blade_storm') {
            if (this.frame === 1) {
                effectsManager.spawnPixelFX('cherryBlossoms', this.targetX, this.targetY - 140, 2.8);
                effectsManager.spawnPixelFX('doubleSlash', this.targetX, this.targetY, 3.8);
            }
            if (this.frame % 8 === 0 && this.frame < 140) {
                effectsManager.createFlyingSword(this.targetX, this.targetY);
            }
            if (this.frame % 25 === 0) {
                effectsManager.triggerScreenShake(5, 8);
            }
        }

        // 💖 Quà 2: Trái Tim (Charmed Nova từ PixelFX)
        else if (this.type === 'gift_heart') {
            if (this.frame === 1) {
                effectsManager.spawnPixelFX('charmed', this.targetX, this.targetY, 4.0);
            }
            if (this.frame === 18) {
                effectsManager.triggerScreenShake(10, 12);
                effectsManager.createShockwave(this.targetX, this.targetY, 'pink');
                effectsManager.createExplosion(this.targetX, this.targetY, 'pink', 18);
            }
            if (this.frame > 18 && this.frame % 8 === 0 && this.frame < 120) {
                effectsManager.createStreamOfHearts(this.targetX, this.targetY);
            }
        }

        // 🍩 Quà 3: Donut (Meteor + Big Explosion từ PixelFX)
        else if (this.type === 'gift_donut' || this.type === 'meteor_shower') {
            if (this.frame === 1) {
                effectsManager.spawnPixelFX('meteor', this.targetX, this.targetY, 3.2);
                effectsManager.spawnPixelFX('bigExplosion', this.targetX, this.targetY, 2.8);
            }
            if (this.frame % 45 === 0 && this.frame < 150) {
                effectsManager.triggerScreenShake(12, 16);
                effectsManager.createGiantMeteor(this.targetX, this.targetY);
            }
        }

        // 🚀 Quà 4: Tên Lửa Hạt Nhân (Nuke từ PixelFX)
        else if (this.type === 'gift_rocket') {
            if (this.frame === 55) {
                effectsManager.triggerScreenShake(20, 26);
                effectsManager.createNuclearExplosion(this.targetX, this.targetY);
                effectsManager.createShockwave(this.targetX, this.targetY, 'fire');
                effectsManager.spawnPixelFX('nuke', this.targetX, this.targetY, 3.5);
            }
            if (this.frame > 55 && this.frame % 8 === 0 && this.frame < 140) {
                effectsManager.createSmokePlume(this.targetX, this.targetY);
            }
        }

        // 👑 Quà 5: Vương Miện (Smite / Thánh Kiếm Excalibur từ PixelFX)
        else if (this.type === 'gift_crown') {
            if (this.frame === 1) {
                effectsManager.spawnPixelFX('smite', this.targetX, this.targetY, 3.6);
            }
            if (this.frame === 40) {
                effectsManager.triggerScreenShake(18, 22);
                effectsManager.createShockwave(this.targetX, this.targetY, 'gold');
                effectsManager.createHolySparks(this.targetX, this.targetY);
            }
        }

        // 🐺 Quà 6: Bầy Sói (Dash Strike từ PixelFX)
        else if (this.type === 'gift_corgi') {
            if (this.frame === 1 || this.frame === 35) {
                effectsManager.spawnPixelFX('dashStrike', this.targetX, this.targetY, 3.2);
            }
            if (this.frame % 20 === 0 && this.frame < 140) {
                effectsManager.triggerScreenShake(8, 10);
                effectsManager.createWolfSlits(this.targetX, this.targetY);
            }
        }

        // 🏎️ Quà 7: Siêu Xe (Dash Strike + Fire Tornado từ PixelFX)
        else if (this.type === 'gift_car') {
            if (this.frame === 1) {
                effectsManager.spawnPixelFX('dashStrike', this.targetX, this.targetY, 3.5);
                effectsManager.spawnPixelFX('fireTornado', this.targetX, this.targetY, 2.8);
            }
            if (this.frame === 35) {
                effectsManager.triggerScreenShake(16, 20);
                effectsManager.createExplosion(this.targetX, this.targetY, 'fire', 22);
                effectsManager.createShockwave(this.targetX, this.targetY, 'fire');
            }
        }

        // 🦁 Quà 8: Sư Tử (Fire Tornado từ PixelFX)
        else if (this.type === 'gift_lion') {
            if (this.frame === 1) {
                effectsManager.spawnPixelFX('fireTornado', this.targetX, this.targetY, 3.8);
            }
            if (this.frame === 25 || this.frame === 80 || this.frame === 135) {
                effectsManager.triggerScreenShake(16, 20);
                effectsManager.createShockwave(this.targetX, this.targetY, 'gold');
                effectsManager.createExplosion(this.targetX, this.targetY, 'gold', 18);
            }
        }

        // 🌌 Quà 9: Hố Đen & Rồng Thần (Black Hole + Arcane Beam từ PixelFX)
        else if (this.type === 'gift_galaxy' || this.type === 'ultimate_dragon') {
            if (this.frame === 1) {
                effectsManager.spawnPixelFX('blackHole', this.targetX, this.targetY, 4.0);
            }
            if (this.frame === 60) {
                effectsManager.spawnPixelFX('arcaneBeam', this.targetX, this.targetY, 3.4);
            }
            effectsManager.triggerScreenShake(12, 16);
            if (this.frame % 8 === 0 && this.frame < 280) {
                effectsManager.createHolySparks(this.targetX, this.targetY);
            }
            if (this.frame === 50 || this.frame === 130 || this.frame === 210) {
                effectsManager.createShockwave(this.targetX, this.targetY, 'gold');
            }
        }

        if (this.frame >= this.maxFrames) {
            this.isDead = true;
        }
    }

    draw(ctx) {
        const t = this.frame / this.maxFrames;
        const progress = Math.sin(t * Math.PI);

        // 1. Vệt Kiếm Khí (Băng tuyết / Cắt gió)
        if (this.type === 'sword_slash' && this.frame < 50) {
            const arcAlpha = Math.max(0, 1 - (this.frame / 50));
            ctx.globalAlpha = arcAlpha * 0.95;
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 12 * arcAlpha;
            ctx.beginPath();
            ctx.arc(this.targetX, this.targetY + 20, 230, -Math.PI * 0.85, -Math.PI * 0.15);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4 * arcAlpha;
            ctx.stroke();
        }

        // 2. Mũi Tên Cupid
        else if (this.type === 'gift_heart' && this.frame <= 50) {
            const arrowX = (this.frame / 18) * this.targetX;
            ctx.globalAlpha = Math.sin((this.frame / 50) * Math.PI);
            ctx.strokeStyle = '#ff4081';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(arrowX - 160, this.targetY);
            ctx.lineTo(arrowX + 40, this.targetY);
            ctx.stroke();

            ctx.font = '42px sans-serif';
            ctx.fillText('🏹💖', arrowX, this.targetY + 12);
        }

        // 3. Tên Lửa Hạt Nhân
        else if (this.type === 'gift_rocket' && this.frame <= 55) {
            const rocketProgress = this.frame / 55;
            const rx = this.targetX + Math.sin(this.frame * 0.2) * 15;
            const ry = -80 + rocketProgress * (this.targetY + 80);

            ctx.save();
            ctx.translate(rx, ry);
            ctx.rotate(Math.PI);
            ctx.font = '60px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🚀', 0, 0);

            ctx.fillStyle = '#ff9100';
            ctx.beginPath();
            ctx.moveTo(-12, -35);
            ctx.lineTo(12, -35);
            ctx.lineTo(0, -80);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // 4. Thánh Kiếm Excalibur
        else if (this.type === 'gift_crown') {
            const swordAlpha = Math.min(1, Math.sin((this.frame / this.maxFrames) * Math.PI) * 1.5);
            ctx.globalAlpha = swordAlpha * 0.92;

            const lightGrad = ctx.createLinearGradient(this.targetX - 70, 0, this.targetX + 70, 0);
            lightGrad.addColorStop(0, 'rgba(255, 215, 0, 0)');
            lightGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
            lightGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = lightGrad;
            ctx.fillRect(this.targetX - 70, 0, 140, ctx.canvas.height);

            const swordY = Math.min(this.targetY + 80, -180 + (this.frame / 40) * (this.targetY + 260));
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(this.targetX, swordY);
            ctx.lineTo(this.targetX - 22, swordY - 280);
            ctx.lineTo(this.targetX + 22, swordY - 280);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ff9100';
            ctx.fillRect(this.targetX - 50, swordY - 300, 100, 16);
        }

        // 5. Siêu Xe Nitro
        else if (this.type === 'gift_car' && this.frame <= 50) {
            const carX = -180 + (this.frame / 35) * (this.targetX + 280);
            ctx.strokeStyle = '#ff3d00';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(0, this.targetY + 35);
            ctx.lineTo(carX, this.targetY + 35);
            ctx.moveTo(0, this.targetY + 70);
            ctx.lineTo(carX, this.targetY + 70);
            ctx.stroke();

            ctx.font = '75px sans-serif';
            ctx.fillText('🏎️🔥', carX - 50, this.targetY + 60);
        }

        // 6. Sư Tử Lửa Thần Thánh
        else if (this.type === 'gift_lion') {
            ctx.globalAlpha = progress * 0.85;
            ctx.save();
            ctx.translate(this.targetX, this.targetY - 45);

            ctx.font = `${Math.floor(160 + Math.sin(this.frame * 0.15) * 15)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🦁', 0, 0);

            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 5;
            for (let r = 90; r < 320; r += 75) {
                const waveRadius = (r + this.frame * 7) % 320;
                ctx.beginPath();
                ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        // 7. Hố Đen Vũ Trụ & Rồng Thần
        else if (this.type === 'gift_galaxy' || this.type === 'ultimate_dragon') {
            ctx.globalAlpha = progress * 0.8;
            ctx.fillStyle = '#05020d';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            // Vòng Xoáy Hố Đen
            ctx.save();
            ctx.translate(this.targetX, this.targetY);
            ctx.rotate(this.frame * 0.035);

            const galaxyGrad = ctx.createRadialGradient(0, 0, 25, 0, 0, 300);
            galaxyGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
            galaxyGrad.addColorStop(0.3, 'rgba(124, 77, 255, 0.85)');
            galaxyGrad.addColorStop(0.6, 'rgba(0, 229, 255, 0.55)');
            galaxyGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = galaxyGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 300, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Rồng Thần Hoàng Kim
            if (this.frame >= 60 && this.frame <= 300) {
                const blastProgress = Math.sin(((this.frame - 60) / 240) * Math.PI);
                ctx.globalAlpha = blastProgress * 0.95;

                const sunGrad = ctx.createRadialGradient(this.targetX, this.targetY, 25, this.targetX, this.targetY, 400 * blastProgress);
                sunGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
                sunGrad.addColorStop(0.3, 'rgba(255, 215, 0, 0.95)');
                sunGrad.addColorStop(0.7, 'rgba(255, 61, 0, 0.55)');
                sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = sunGrad;
                ctx.beginPath();
                ctx.arc(this.targetX, this.targetY, 400 * blastProgress, 0, Math.PI * 2);
                ctx.fill();

                ctx.font = '130px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🐉⚡', this.targetX, this.targetY);
            }
        }
    }
}

class EffectsManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.damageNumbers = [];
        this.activeSkills = [];
        this.activePixelFx = [];
        this.shakeTime = 0;
        this.shakeMagnitude = 0;
        this.ambientParticles = [];
        this._initAmbientParticles();
    }

    _initAmbientParticles() {
        this.ambientParticles = [];
        for (let i = 0; i < 16; i++) {
            this.ambientParticles.push({
                x: Math.random() * (this.canvas.width || 1200),
                y: Math.random() * (this.canvas.height || 800),
                vx: (Math.random() - 0.5) * 0.6,
                vy: -Math.random() * 0.7 - 0.2,
                size: Math.random() * 2.5 + 1,
                alpha: Math.random() * 0.4 + 0.15
            });
        }
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
        if (this.activePixelFx.length >= 8) {
            this.activePixelFx.shift();
        }
        const fx = new PixelFXInstance(mod, x, y, scale, options);
        this.activePixelFx.push(fx);
        return fx;
    }

    addSkill(type, targetX, targetY, options = {}) {
        if (this.activeSkills.length >= MAX_ACTIVE_SKILLS) {
            this.activeSkills.shift();
        }
        this.activeSkills.push(new VisualSkillEffect(type, targetX, targetY, options));
    }

    addDamageNumber(x, y, amount, isCrit = false, prefix = "-") {
        if (this.damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
            this.damageNumbers.shift();
        }
        const text = `${prefix}${amount.toLocaleString()}`;
        const color = isCrit ? '#ff0055' : (amount >= 50000 ? '#ffd700' : (amount >= 10000 ? '#ff9100' : (amount >= 1000 ? '#00e5ff' : '#ffffff')));
        this.damageNumbers.push(new DamageNumber(x, y, text, color, isCrit));
    }

    _addParticle(p) {
        if (this.particles.length >= MAX_PARTICLES) {
            this.particles.shift();
        }
        this.particles.push(p);
    }

    createNuclearExplosion(x, y) {
        for (let i = 0; i < 26; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 15 + 4;
            this._addParticle(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 5,
                i % 2 === 0 ? 'fire' : 'gold',
                Math.random() * 12 + 8,
                1.0, 0.018, 'glow',
                { drag: 0.96, gravity: -0.04 }
            ));
        }
    }

    createWolfSlits(x, y) {
        for (let i = 0; i < 8; i++) {
            this._addParticle(new Particle(
                x + (Math.random() - 0.5) * 160,
                y + (Math.random() - 0.5) * 120,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                'cyan',
                Math.random() * 14 + 8,
                1.0, 0.03, 'spark'
            ));
        }
    }

    createShockwave(x, y, colorType = 'gold') {
        this._addParticle(new Particle(x, y, 0, 0, colorType, 45, 1.0, 0.02, 'ring'));
    }

    createSlashArc(x, y) {
        for (let i = 0; i < 15; i++) {
            const angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.8;
            const speed = Math.random() * 14 + 6;
            this._addParticle(new Particle(
                x + (Math.random() - 0.5) * 120,
                y + (Math.random() - 0.5) * 50,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                'cyan',
                Math.random() * 8 + 4,
                1.0, 0.03, 'glow',
                { drag: 0.96 }
            ));
        }
    }

    createFlameColumn(x, y) {
        for (let i = 0; i < 3; i++) {
            this._addParticle(new Particle(
                x + (Math.random() - 0.5) * 100,
                y + 50 + Math.random() * 30,
                (Math.random() - 0.5) * 3,
                -Math.random() * 7 - 3,
                'fire',
                Math.random() * 14 + 8,
                1.0, 0.025, 'glow',
                { drag: 0.98 }
            ));
        }
    }

    createLightningBolt(targetX, targetY) {
        let currentX = targetX + (Math.random() - 0.5) * 80;
        let currentY = 0;
        const segments = 10;
        const dy = (targetY - currentY) / segments;

        for (let i = 0; i < segments; i++) {
            const nextX = currentX + (Math.random() - 0.5) * 50;
            const nextY = currentY + dy;
            this._addParticle(new Particle(
                (currentX + nextX) / 2,
                (currentY + nextY) / 2,
                0, 0,
                'purple',
                Math.random() * 8 + 4,
                1.0, 0.035, 'glow'
            ));
            currentX = nextX;
            currentY = nextY;
        }
    }

    createElectricSparks(x, y) {
        for (let i = 0; i < 2; i++) {
            this._addParticle(new Particle(
                x + (Math.random() - 0.5) * 120,
                y + (Math.random() - 0.5) * 120,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                'cyan',
                Math.random() * 5 + 3,
                1.0, 0.035, 'spark'
            ));
        }
    }

    createIcePillars(x, y) {
        for (let i = 0; i < 14; i++) {
            this._addParticle(new Particle(
                x + (Math.random() - 0.5) * 150,
                y + (Math.random() - 0.5) * 120,
                (Math.random() - 0.5) * 6,
                -Math.random() * 6 - 2,
                'cyan',
                Math.random() * 10 + 6,
                1.0, 0.02, 'glow',
                { gravity: 0.15 }
            ));
        }
    }

    createSmokePlume(x, y) {
        this._addParticle(new Particle(
            x + (Math.random() - 0.5) * 100,
            y + (Math.random() - 0.5) * 50,
            (Math.random() - 0.5) * 2,
            -Math.random() * 2.5 - 1,
            'smoke',
            Math.random() * 22 + 12,
            1.0, 0.02, 'smoke'
        ));
    }

    createStreamOfHearts(x, y) {
        this._addParticle(new Particle(
            x + (Math.random() - 0.5) * 140,
            this.canvas.height - 20,
            (Math.random() - 0.5) * 4,
            -Math.random() * 14 - 10,
            'pink',
            Math.random() * 6 + 12,
            1.0, 0.02, 'heart'
        ));
    }

    createFlyingSword(x, y) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const startX = side === 1 ? -40 : this.canvas.width + 40;
        const startY = y + (Math.random() - 0.5) * 160;
        const angle = Math.atan2(y - startY, x - startX);
        const speed = Math.random() * 12 + 15;

        this._addParticle(new Particle(
            startX, startY,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            'gold',
            Math.random() * 6 + 4,
            1.0, 0.022, 'spark'
        ));
    }

    createGiantMeteor(x, y) {
        this.createExplosion(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 70, 'fire', 22);
        this.createShockwave(x, y, 'gold');
    }

    createHolySparks(x, y) {
        for (let i = 0; i < 3; i++) {
            this._addParticle(new Particle(
                x + (Math.random() - 0.5) * 280,
                y + (Math.random() - 0.5) * 200,
                (Math.random() - 0.5) * 8,
                -Math.random() * 6 - 2,
                'gold',
                Math.random() * 10 + 6,
                1.0, 0.025, 'glow'
            ));
        }
    }

    createExplosion(x, y, colorType = 'fire', count = 16) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 10 + 2;
            this._addParticle(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                colorType,
                Math.random() * 10 + 6,
                1.0, 0.025, 'glow',
                { drag: 0.97, gravity: 0.06 }
            ));
        }
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

        // Cập nhật ambient
        for (let i = 0; i < this.ambientParticles.length; i++) {
            const p = this.ambientParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.y < 0) {
                p.y = this.canvas.height;
                p.x = Math.random() * this.canvas.width;
            }
        }

        // In-place update activePixelFx (Hiệu ứng PixelFX)
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

        // In-place update particles
        let pWrite = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.update()) {
                this.particles[pWrite++] = p;
            }
        }
        this.particles.length = pWrite;

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
        // 1. Vẽ Ambient Particles
        for (let i = 0; i < this.ambientParticles.length; i++) {
            const p = this.ambientParticles[i];
            ctx.fillStyle = `rgba(255, 215, 0, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // 1.5. Vẽ Hiệu Ứng PixelFX Procedural
        for (let i = 0; i < this.activePixelFx.length; i++) {
            this.activePixelFx[i].draw(ctx);
        }

        // 2. Vẽ Active Skills (Đồ họa lớn)
        for (let i = 0; i < this.activeSkills.length; i++) {
            this.activeSkills[i].draw(ctx);
        }

        // 3. Vẽ Hạt Phát Sáng Với GPU Additive Blending (Cực Đẹp & 0% Lag)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].draw(ctx);
        }
        ctx.restore();

        // 4. Vẽ Damage Numbers
        for (let i = 0; i < this.damageNumbers.length; i++) {
            this.damageNumbers[i].draw(ctx);
        }
    }
}

window.EffectsManager = EffectsManager;
