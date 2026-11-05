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

        // Tùy chọn tăng dần kích thước theo thời gian (growScale)
        this.growScale = customOptions.growScale || false;
        this.startScale = customOptions.startScale || scale;
        this.targetScale = customOptions.targetScale || scale;
        this.growDuration = customOptions.growDuration || (this.maxDuration * 0.7);
    }

    update(dt = 0.016) {
        if (this.isDead) return false;
        this.elapsed += dt;
        this.acc += dt;

        // Tăng dần kích cỡ mượt mà nếu growScale = true
        if (this.growScale) {
            const p = Math.min(1.0, this.elapsed / this.growDuration);
            const easeOut = 1 - Math.pow(1 - p, 3);
            this.scale = this.startScale + (this.targetScale - this.startScale) * easeOut;
        }

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
            case 'lightning': return 85;
            case 'ice_shard': return 70;
            case 'bomb_blast': return 70;
            case 'poison_sting': return 75;
            case 'player_shield': return 90;
            case 'boss_rage': return 90;
            case 'boss_fireball': return 60;
            case 'boss_lightning': return 85;
            case 'boss_frost': return 65;
            case 'boss_slam': return 65;
            case 'magic_bullet':
            case 'heart_barrage': return 50;
            case 'gift_rose':
            case 'blade_storm': return 110;
            case 'gift_heart': return 90;
            case 'gift_donut':
            case 'meteor_shower': return 130;
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

        // 2. Cầu Lửa (dùng arcane/arcane-missiles cho skill Cầu lửa)
        else if (this.type === 'fireball') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(7, 10);
                effectsManager.spawnPixelFX('arcane/arcane-missiles', originX + 20, groundY - 45, 2.2, { duration: 1.8 });
            } else if (this.frame === 24) {
                effectsManager.triggerScreenShake(10, 14);
                effectsManager.spawnPixelFX('impacts/crit-hit', this.targetX, groundY - 45, 1.8, { duration: 0.8 });
                if (typeof this.options.onHit === 'function') {
                    this.options.onHit(this);
                }
            }
        }

        // 3. Lôi Thần Trừng Phạt (Lightning Strike: nạp pháp trận, giáng sét tại frame 48 mới trừ máu)
        else if (this.type === 'lightning') {
            if (this.frame === 1) {
                // Triệu hồi pháp trận sấm sét tích tụ năng lượng dưới chân boss
                effectsManager.spawnPixelFX('lightningStrike', this.targetX, groundY, 2.3, { duration: 2.2 });
            } else if (this.frame === 48) {
                // ĐÚNG KHOẢNH KHẮC TIA SÉT KHỔNG LỒ GIÁNG XUỐNG MẶT ĐẤT (t = 0.76s):
                effectsManager.triggerScreenShake(15, 20);
                effectsManager.spawnPixelFX('criticalHit', this.targetX, groundY - 45, 1.8, { duration: 0.8 });
                if (typeof this.options.onHit === 'function') {
                    this.options.onHit(this);
                }
            }
        }

        // 4. Băng (dùng ice/ice-spikes kết hợp ice/snowflake-burst cho skill Băng)
        else if (this.type === 'ice_shard') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(7, 12);
                effectsManager.spawnPixelFX('ice/ice-spikes', originX + 40, groundY, 2.2, { duration: 2.2 });
                effectsManager.spawnPixelFX('ice/snowflake-burst', this.targetX, groundY - 30, 2.3, { duration: 2.0 });
                if (typeof this.options.onHit === 'function') {
                    this.options.onHit(this);
                }
            }
        }

        // 5. Bộc Phá Ma Thuật (Dùng fire/fireball kết hợp explosions/small-explosion, khi quả cầu lửa chạm tới Boss thì mới nổ)
        else if (this.type === 'bomb_blast') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(6, 8);
                // Quả cầu lửa phóng từ phía người chơi bay tới Boss
                effectsManager.spawnPixelFX('fire/fireball', originX + 40, groundY - 45, 2.2, { duration: 0.45 });
            } else if (this.frame === 14) {
                // ĐÚNG KHOẢNH KHẮC CẦU LỬA CHẠM TỚI BOSS: Nổ tung small-explosion!
                effectsManager.triggerScreenShake(14, 18);
                effectsManager.spawnPixelFX('explosions/small-explosion', this.targetX, groundY, 2.4, { duration: 2.0 });
                if (typeof this.options.onHit === 'function') {
                    this.options.onHit(this);
                }
            }
        }

        // 6. Thả Tim / Đạn Ma Thuật (Charmed Sparkles từ PixelFX)
        else if (this.type === 'heart_barrage' || this.type === 'magic_bullet') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(3, 6);
                effectsManager.spawnPixelFX('charmed', this.targetX, groundY - 35, 2.2, { duration: 1.4 });
            }
        }

        // 7. Kịch Độc Ma Thuật (Dùng nature/acid-splash cho skill Trúng độc giữ nguyên hiệu ứng trúng độc, 5s 15 HP/s)
        else if (this.type === 'poison_sting') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(8, 12);
                effectsManager.spawnPixelFX('nature/acid-splash', this.targetX, groundY, 2.4, { duration: 2.6 });
                if (typeof this.options.onHit === 'function') {
                    this.options.onHit(this);
                }
            }
        }

        // --- BOSS TẤN CÔNG NGƯỢC LẠI DŨNG SĨ ---
        // 8. Boss Cầu Lửa Hắc Ám
        else if (this.type === 'boss_fireball') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(8, 12);
                effectsManager.spawnPixelFX('fireball', originX - 40, groundY - 45, 2.2, { duration: 0.45 });
            } else if (this.frame === 12) {
                effectsManager.triggerScreenShake(12, 16);
                effectsManager.spawnPixelFX('bigExplosion', this.targetX, groundY, 2.2, { duration: 1.6 });
                if (typeof this.options.onHit === 'function') {
                    this.options.onHit(this);
                }
            }
        }

        // 9. Boss Thiên Lôi Hắc Ám
        else if (this.type === 'boss_lightning') {
            if (this.frame === 1) {
                effectsManager.spawnPixelFX('lightningStrike', this.targetX, groundY, 2.2, {
                    duration: 2.2,
                    palette: ["#1a0628","#350e50","#5c1888","#8b28c8","#b848ff","#da88ff","#f3d0ff","#ffffff"]
                });
            } else if (this.frame === 48) {
                effectsManager.triggerScreenShake(16, 22);
                effectsManager.spawnPixelFX('criticalHit', this.targetX, groundY - 40, 1.8, { duration: 0.8 });
                if (typeof this.options.onHit === 'function') {
                    this.options.onHit(this);
                }
            }
        }

        // 10. Boss Hàn Băng Thấu Xương
        else if (this.type === 'boss_frost') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(8, 14);
                effectsManager.spawnPixelFX('frostNova', this.targetX, groundY, 2.2, { duration: 1.8 });
                effectsManager.spawnPixelFX('iceCrystal', this.targetX, groundY - 20, 2.2, { duration: 1.6 });
                if (typeof this.options.onHit === 'function') {
                    this.options.onHit(this);
                }
            }
        }

        // 11. Boss Địa Chấn Diệt Tuyệt
        else if (this.type === 'boss_slam') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(18, 24);
                effectsManager.spawnPixelFX('darkExplosion', this.targetX, groundY, 2.5, { duration: 1.8 });
                if (typeof this.options.onHit === 'function') {
                    this.options.onHit(this);
                }
            }
        }

        // --- BOSS NỘ VÀ KHIÊN HỘ GIÁ ---
        // Nộ của boss: Dùng explosions/implosion và explosions/plasma-explosion, tác động lên người chơi
        else if (this.type === 'boss_rage') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(18, 24);
                // Implosion hút sụp mọi vật chất tại vị trí người chơi
                effectsManager.spawnPixelFX('explosions/implosion', this.targetX, groundY - 25, 2.8, { duration: 1.65 });
            } else if (this.frame === 20) {
                // Plasma explosion bùng nổ năng lượng cực đại tiêu diệt người chơi
                effectsManager.triggerScreenShake(26, 32);
                effectsManager.spawnPixelFX('explosions/plasma-explosion', this.targetX, groundY - 25, 3.2, { duration: 2.0 });
                if (typeof this.options.onHit === 'function') {
                    this.options.onHit(this);
                }
            }
        }

        // Khiên Hộ Giá: arcane/time-stop bảo vệ người chơi không nhận sát thương
        else if (this.type === 'player_shield') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(8, 12);
                effectsManager.spawnPixelFX('arcane/time-stop', this.targetX, groundY, 2.8, { duration: 4.5 });
            }
        }

        // 🌹 Quà 1: Hoa Hồng - Vạn Kiếm Quy Tông (holy/holy-pillar kết hợp arcane/star-fall palette holy)
        else if (this.type === 'gift_rose' || this.type === 'blade_storm') {
            const holyPal = (window.PixelFX && window.PixelFX.PAL && window.PixelFX.PAL.holy) ? window.PixelFX.PAL.holy : ["#2a1c08","#5a3e10","#9a6c18","#d8a428","#ffd84a","#fff09a","#fffbe6","#ffffff"];
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(14, 20);
                effectsManager.spawnPixelFX('holy/holy-pillar', this.targetX, groundY, 2.5, { duration: 2.8, palette: holyPal });
                effectsManager.spawnPixelFX('arcane/star-fall', this.targetX, groundY, 2.4, { duration: 2.4, palette: holyPal });
            } else if (this.frame === 14) {
                effectsManager.spawnPixelFX('impacts/crit-hit', this.targetX, groundY - 45, 2.0, { duration: 0.8, palette: holyPal });
            }
        }

        // 💖 Quà 2: Trái Tim (shadow/shadow-tendrils palette blood cho Skill mũi tên cupid)
        else if (this.type === 'gift_heart') {
            const bloodPal = (window.PixelFX && window.PixelFX.PAL && window.PixelFX.PAL.blood) ? window.PixelFX.PAL.blood : ["#14040a","#3a0a14","#6a101c","#a01824","#d42a30","#ff5a50","#ff9a8a"];
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(11, 16);
                effectsManager.spawnPixelFX('shadow/shadow-tendrils', this.targetX, groundY, 2.8, { duration: 2.2, palette: bloodPal });
            } else if (this.frame === 12) {
                effectsManager.spawnPixelFX('shadow/shadow-tendrils', this.targetX - 25, groundY, 2.4, { duration: 1.8, palette: bloodPal });
                effectsManager.spawnPixelFX('shadow/shadow-tendrils', this.targetX + 25, groundY, 2.4, { duration: 1.8, palette: bloodPal, flip: true });
            }
        }

        // 🍩 Quà 3: Donut (Bão thiên thạch: nhiều thiên thạch từ nhiều hướng, chạm đất mới nổ)
        else if (this.type === 'gift_donut' || this.type === 'meteor_shower') {
            // Thiên thạch 1: Từ góc trên trái rơi xuống mép trái
            if (this.frame === 1) {
                effectsManager.spawnPixelFX('fire/meteor', this.targetX - 45, groundY, 2.5, { duration: 2.2, flip: false, seed: 1 });
            }
            // Thiên thạch 2: Từ góc trên phải rơi xuống mép phải
            else if (this.frame === 10) {
                effectsManager.spawnPixelFX('fire/meteor', this.targetX + 50, groundY, 2.5, { duration: 2.2, flip: true, seed: 5 });
            }
            // Thiên thạch 3: Từ góc trên trái rơi xuống chính giữa
            else if (this.frame === 22) {
                effectsManager.spawnPixelFX('fire/meteor', this.targetX, groundY, 2.6, { duration: 2.2, flip: false, seed: 9 });
            }
            // Thiên thạch 4: Từ góc trên phải rơi xuống
            else if (this.frame === 32) {
                effectsManager.spawnPixelFX('fire/meteor', this.targetX + 15, groundY, 2.5, { duration: 2.2, flip: true, seed: 12 });
            }
            // NỔ ĐÚNG KHOẢNH KHẮC MỖI THIÊN THẠCH CHẠM ĐẤT (t = 0.62s ~ 18-19 frame sau khi xuất hiện):
            else if (this.frame === 19) {
                effectsManager.triggerScreenShake(16, 20);
                effectsManager.spawnPixelFX('explosions/big-explosion', this.targetX - 45, groundY, 2.4, { duration: 1.8 });
            } else if (this.frame === 28) {
                effectsManager.triggerScreenShake(16, 20);
                effectsManager.spawnPixelFX('explosions/big-explosion', this.targetX + 50, groundY, 2.4, { duration: 1.8 });
            } else if (this.frame === 40) {
                effectsManager.triggerScreenShake(18, 24);
                effectsManager.spawnPixelFX('explosions/big-explosion', this.targetX, groundY, 2.6, { duration: 1.8 });
            } else if (this.frame === 50) {
                effectsManager.triggerScreenShake(18, 24);
                effectsManager.spawnPixelFX('explosions/big-explosion', this.targetX + 15, groundY, 2.5, { duration: 1.8 });
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

        // 🐺 Quà 6: Corgi - Huyết Ma Bạo Tạc (shadow/dark-explosion palette blood)
        else if (this.type === 'gift_corgi') {
            const bloodPal = (window.PixelFX && window.PixelFX.PAL && window.PixelFX.PAL.blood) ? window.PixelFX.PAL.blood : ["#14040a","#3a0a14","#6a101c","#a01824","#d42a30","#ff5a50","#ff9a8a"];
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(14, 20);
                effectsManager.spawnPixelFX('shadow/dark-explosion', this.targetX, groundY, 2.8, { duration: 2.2, palette: bloodPal });
            } else if (this.frame === 12) {
                effectsManager.spawnPixelFX('shadow/dark-explosion', this.targetX - 30, groundY, 2.2, { duration: 1.8, palette: bloodPal });
                effectsManager.spawnPixelFX('shadow/dark-explosion', this.targetX + 30, groundY, 2.2, { duration: 1.8, palette: bloodPal });
            }
        }

        // 🏎️ Quà 7: Siêu Xe - Quỷ Vực Huyết Thủ (shadow/grasping-hands kết hợp shadow/void-orb palette blood)
        else if (this.type === 'gift_car') {
            const bloodPal = (window.PixelFX && window.PixelFX.PAL && window.PixelFX.PAL.blood) ? window.PixelFX.PAL.blood : ["#14040a","#3a0a14","#6a101c","#a01824","#d42a30","#ff5a50","#ff9a8a"];
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(16, 22);
                effectsManager.spawnPixelFX('shadow/grasping-hands', this.targetX, groundY, 2.8, { duration: 2.6, palette: bloodPal });
                effectsManager.spawnPixelFX('shadow/void-orb', this.targetX, groundY, 2.6, { duration: 2.6, palette: bloodPal });
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

        // 🌌 Quà 9: Galaxy (Bỏ arcane beam, dời hố đen vào giữa rồng thần và từ từ tăng kích thước, rút máu 5 lần mỗi lần 500000)
        else if (this.type === 'gift_galaxy' || this.type === 'ultimate_dragon') {
            if (this.frame === 1) {
                effectsManager.triggerScreenShake(16, 22);
                // Dời hố đen vào chính giữa rồng thần/boss (targetX, targetY) và từ từ tăng kích thước khi xuất hiện
                effectsManager.spawnPixelFX('shadow/black-hole', this.targetX, this.targetY, 1.0, {
                    duration: 4.5,
                    growScale: true,
                    startScale: 0.8,
                    targetScale: 3.5,
                    growDuration: 3.0
                });
            }
            // RÚT MÁU 5 LẦN MỖI LẦN 500,000 HP:
            else if (this.frame === 20 || this.frame === 42 || this.frame === 64 || this.frame === 86 || this.frame === 108) {
                effectsManager.triggerScreenShake(12, 16);
                effectsManager.addDamageNumber(this.targetX + (Math.random() - 0.5) * 40, this.targetY - 50, 500000, true);
                effectsManager.spawnPixelFX('impacts/crit-hit', this.targetX + (Math.random() - 0.5) * 30, this.targetY + (Math.random() - 0.5) * 30, 1.8, { duration: 0.7 });
                if (typeof this.options.onMultiHit === 'function') {
                    this.options.onMultiHit(500000);
                }
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
