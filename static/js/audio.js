// audio.js - Bộ tổng hợp âm thanh bằng Web Audio API
// Chạy trực tiếp trên trình duyệt, không cần tải bất kỳ file mp3 nào, không sợ lỗi mạng hay bản quyền!

class SoundSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
    }

    toggleMute() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    _getMasterGain(duration = 0.5) {
        if (!this.enabled || !this.ctx) return null;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        gain.connect(this.ctx.destination);
        return gain;
    }

    // 1. Tiếng Kiếm Chém (Slash)
    playSlash() {
        this.init();
        const master = this._getMasterGain(0.2);
        if (!master) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    // 2. Tiếng Cầu Lửa Nổ (Fireball)
    playFireball() {
        this.init();
        const master = this._getMasterGain(0.4);
        if (!master) return;

        // Tạo tiếng rít lửa + nổ
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    // 3. Tiếng Sấm Sét Giáng Liên Hoàn (Lightning Roll)
    playLightning() {
        this.init();
        const master = this._getMasterGain(0.7);
        if (!master) return;

        const now = this.ctx.currentTime;
        // 3 đợt sét đánh dồn dập
        [0, 0.25, 0.55].forEach(delay => {
            const bufferSize = this.ctx.sampleRate * 0.45;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400, now + delay);
            filter.frequency.exponentialRampToValueAtTime(100, now + delay + 0.45);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.7, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.45);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(master);

            noise.start(now + delay);
            noise.stop(now + delay + 0.5);
        });
    }

    // 4. Tiếng Bom Nổ Vang (Bomb)
    playBomb() {
        this.init();
        const master = this._getMasterGain(0.7);
        if (!master) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);

        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(now + 0.6);
    }

    // 5. Tiếng Băng Giá (Ice)
    playIce() {
        this.init();
        const master = this._getMasterGain(0.3);
        if (!master) return;

        const now = this.ctx.currentTime;
        [1200, 1600, 2000].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.04);
            gain.gain.setValueAtTime(0.2, now + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.04 + 0.15);

            osc.connect(gain);
            gain.connect(master);
            osc.start(now + idx * 0.04);
            osc.stop(now + idx * 0.04 + 0.15);
        });
    }

    // 6. Tiếng Đạn Ma Thuật / Tim (Ting nhẹ)
    playHeartHit() {
        this.init();
        const master = this._getMasterGain(0.2);
        if (!master) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600 + Math.random() * 300, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(now + 0.1);
    }

    // 7. Tiếng Quà Tặng / Tuyệt Chiêu Laser (Mega Laser)
    playGiftLaser() {
        this.init();
        const master = this._getMasterGain(0.7);
        if (!master) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.35);
        osc.frequency.exponentialRampToValueAtTime(300, now + 1.2);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(now + 1.25);
    }

    // 8. Tiếng Rồng Thần / Ultimate Kamehameha Sóng Thần
    playUltimate() {
        this.init();
        const master = this._getMasterGain(0.9);
        if (!master) return;

        const now = this.ctx.currentTime;
        // Rung trầm hùng vĩ kéo dài 3.2 giây
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(60, now);
        subOsc.frequency.linearRampToValueAtTime(220, now + 1.2);
        subOsc.frequency.exponentialRampToValueAtTime(25, now + 3.2);

        subGain.gain.setValueAtTime(0.8, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 3.2);

        subOsc.connect(subGain);
        subGain.connect(master);
        subOsc.start();
        subOsc.stop(now + 3.2);
    }

    // --- CÁC ÂM THANH QUÀ TẶNG SIÊU HOÀNH TRÁNG ---

    // Quà Tên Lửa Hạt Nhân (Rocket)
    playRocketLaunch() {
        this.init();
        const master = this._getMasterGain(0.85);
        if (!master) return;
        const now = this.ctx.currentTime;

        // Tiếng tên lửa bay vút lên cao
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.8);
        osc.frequency.linearRampToValueAtTime(200, now + 1.2);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(now + 1.2);

        // Vụ nổ hạt nhân sau 1.2 giây
        setTimeout(() => this.playBomb(), 1100);
    }

    // Quà Thánh Kiếm Excalibur (Crown)
    playExcalibur() {
        this.init();
        const master = this._getMasterGain(0.9);
        if (!master) return;
        const now = this.ctx.currentTime;

        // Chuông thánh ngân nga
        [523.25, 659.25, 783.99, 1046.50].forEach((f, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, now + idx * 0.1);
            gain.gain.setValueAtTime(0.4, now + idx * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 1.2);
            osc.connect(gain);
            gain.connect(master);
            osc.start(now + idx * 0.1);
            osc.stop(now + idx * 0.1 + 1.3);
        });

        // Kiếm thần cắm xuống đất
        setTimeout(() => this.playLightning(), 600);
    }

    // Quà Bầy Sói Thần (Corgi / Pet)
    playBeastRoar() {
        this.init();
        const master = this._getMasterGain(0.8);
        if (!master) return;
        const now = this.ctx.currentTime;

        // Tiếng sói hú & cào xé
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.4);
        osc.frequency.linearRampToValueAtTime(180, now + 0.9);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);

        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(now + 1.0);
    }

    // Quà Siêu Xe (Sports Car)
    playSupercarEngine() {
        this.init();
        const master = this._getMasterGain(0.85);
        if (!master) return;
        const now = this.ctx.currentTime;

        // Tiếng rú ga VROOOOM từ trầm lên cao rồi va chạm
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.7);
        osc.frequency.exponentialRampToValueAtTime(900, now + 1.1);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.3);

        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(now + 1.3);

        setTimeout(() => this.playBomb(), 1100);
    }

    // Quà Sư Tử Thần Vương (Lion)
    playLionRoar() {
        this.init();
        const master = this._getMasterGain(0.95);
        if (!master) return;
        const now = this.ctx.currentTime;

        // Tiếng gầm sư tử rung chuyển
        const subOsc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(70, now);
        subOsc.frequency.linearRampToValueAtTime(140, now + 0.5);
        subOsc.frequency.linearRampToValueAtTime(50, now + 1.6);

        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

        subOsc.connect(gain);
        gain.connect(master);
        subOsc.start();
        subOsc.stop(now + 1.8);

        this.playLightning();
    }

    // Quà Hố Đen Vũ Trụ (Galaxy)
    playBlackHoleGalaxy() {
        this.init();
        this.playUltimate();
    }

    // Quà Mũi Tên Thần Cupid (Heart)
    playCupidArrow() {
        this.init();
        const master = this._getMasterGain(0.65);
        if (!master) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.35);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(now + 0.4);

        setTimeout(() => this.playHeartHit(), 350);
    }

    // 9. Tiếng Boss Trúng Đòn (Hurt)
    playBossHurt() {
        this.init();
        const master = this._getMasterGain(0.3);
        if (!master) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(now + 0.15);
    }

    // 10. Tiếng Chiến Thắng (Victory Fanfare)
    playVictory() {
        this.init();
        const master = this._getMasterGain(0.6);
        if (!master) return;

        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C, E, G, C, E, G
        const now = this.ctx.currentTime;

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.1);

            gain.gain.setValueAtTime(0.3, now + idx * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.35);

            osc.connect(gain);
            gain.connect(master);
            osc.start(now + idx * 0.1);
            osc.stop(now + idx * 0.1 + 0.4);
        });
    }
}

window.soundSystem = new SoundSystem();
