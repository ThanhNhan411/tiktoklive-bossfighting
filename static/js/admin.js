// admin.js - Xử lý logic cho Bảng điều khiển giả lập & Quản lý kết nối

document.addEventListener('DOMContentLoaded', () => {
    const inputUsername = document.getElementById('tiktokUsername');
    const btnConnect = document.getElementById('btnConnect');
    const btnDisconnect = document.getElementById('btnDisconnect');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const toast = document.getElementById('toast');

    const simUser = document.getElementById('simUser');
    const simCommentCustom = document.getElementById('simCommentCustom');
    const btnSendCustomComment = document.getElementById('btnSendCustomComment');

    const btnNextBoss = document.getElementById('btnNextBoss');
    const btnResetBoss = document.getElementById('btnResetBoss');
    const btnRageAttack = document.getElementById('btnRageAttack');
    const inputCustomHp = document.getElementById('inputCustomHp');

    const checkAutoHeal = document.getElementById('checkAutoHeal');
    const inputHealDelay = document.getElementById('inputHealDelay');
    const inputHealPercent = document.getElementById('inputHealPercent');
    const btnSaveHealConfig = document.getElementById('btnSaveHealConfig');

    const btnCopyObs = document.getElementById('btnCopyObs');
    const obsUrlInput = document.getElementById('obsUrl');

    function showToast(msg, isSuccess = true) {
        toast.textContent = msg;
        toast.style.background = isSuccess ? '#00e676' : '#ff5252';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // Tự động điền link OBS theo host hiện tại
    const obsFullUrl = `${window.location.origin}/game`;
    if (obsUrlInput) {
        obsUrlInput.textContent = obsFullUrl;
    }

    if (btnCopyObs) {
        btnCopyObs.addEventListener('click', () => {
            navigator.clipboard.writeText(obsFullUrl).then(() => {
                showToast("Đã sao chép link OBS!");
            });
        });
    }

    // 1. KẾT NỐI TIKTOK
    btnConnect.addEventListener('click', async () => {
        const username = inputUsername.value.trim();
        if (!username) {
            showToast("Vui lòng nhập TikTok ID!", false);
            return;
        }

        btnConnect.disabled = true;
        btnConnect.textContent = "Đang kết nối...";

        try {
            const res = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const data = await res.json();
            showToast(data.message, data.success);
            updateStatus();
        } catch (err) {
            showToast("Lỗi gửi yêu cầu kết nối!", false);
        } finally {
            btnConnect.disabled = false;
            btnConnect.textContent = "Kết nối TikTok Live";
        }
    });

    btnDisconnect.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/disconnect', { method: 'POST' });
            const data = await res.json();
            showToast(data.message);
            updateStatus();
        } catch (err) {
            showToast("Lỗi khi ngắt kết nối!", false);
        }
    });

    // Cập nhật trạng thái
    async function updateStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            const status = data.status || {};
            const snapshot = data.game_snapshot || {};

            if (status.connected) {
                statusDot.className = 'status-dot online';
                statusText.textContent = `ĐANG LIVE: @${status.username}`;
                btnConnect.style.display = 'none';
                btnDisconnect.style.display = 'inline-flex';
            } else {
                statusDot.className = 'status-dot';
                statusText.textContent = status.message || 'Chưa kết nối';
                btnConnect.style.display = 'inline-flex';
                btnDisconnect.style.display = 'none';
            }

            // Điền cấu hình người chơi nếu chưa sửa
            if (snapshot.player && !window._playerConfigLoaded) {
                window._playerConfigLoaded = true;
                const p = snapshot.player;
                const inputMax = document.getElementById('inputPlayerMaxHp');
                const inputReq = document.getElementById('inputReviveHearts');
                const checkAtk = document.getElementById('checkBossAutoAttack');
                const inputInt = document.getElementById('inputBossAttackInterval');

                if (inputMax) inputMax.value = p.max_hp || 1000;
                if (inputReq) inputReq.value = p.revive_hearts_required || 50;
                if (checkAtk && snapshot.boss_auto_attack_enabled !== undefined) checkAtk.checked = snapshot.boss_auto_attack_enabled;
                if (inputInt && snapshot.boss_attack_interval) inputInt.value = snapshot.boss_attack_interval;
            }
        } catch (err) {
            console.error(err);
        }
    }
    updateStatus();
    setInterval(updateStatus, 4000);

    // 2. BỘ GIẢ LẬP (SIMULATOR)
    async function sendSimulate(payload) {
        payload.username = simUser.value.trim() || 'Hero_Viewer';
        try {
            const res = await fetch('/api/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) {
                showToast(data.message, false);
            }
        } catch (err) {
            showToast("Lỗi gửi tín hiệu giả lập!", false);
        }
    }

    // Xử lý các nút bấm giả lập có thuộc tính data-sim
    document.querySelectorAll('[data-sim-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.simType;
            if (type === 'like') {
                sendSimulate({ type: 'like', count: parseInt(btn.dataset.count || 1) });
            } else if (type === 'comment') {
                sendSimulate({ type: 'comment', text: btn.dataset.text || 'chem' });
            } else if (type === 'gift') {
                sendSimulate({
                    type: 'gift',
                    name: btn.dataset.giftName || 'Hoa Hồng',
                    diamonds: parseInt(btn.dataset.diamonds || 1),
                    count: parseInt(btn.dataset.count || 1)
                });
            } else if (type === 'follow') {
                sendSimulate({ type: 'follow' });
            } else if (type === 'share') {
                sendSimulate({ type: 'share' });
            }
        });
    });

    // Comment tùy ý
    btnSendCustomComment.addEventListener('click', () => {
        const text = simCommentCustom.value.trim();
        if (text) {
            sendSimulate({ type: 'comment', text: text });
            simCommentCustom.value = '';
        }
    });

    simCommentCustom.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnSendCustomComment.click();
        }
    });

    // 3. ĐIỀU KHIỂN BOSS
    btnNextBoss.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/boss/next', { method: 'POST' });
            const data = await res.json();
            showToast(`Đã chuyển sang Boss: ${data.boss.name}`);
        } catch (err) {
            showToast("Lỗi đổi boss!", false);
        }
    });

    btnResetBoss.addEventListener('click', async () => {
        const maxHp = inputCustomHp.value.trim();
        try {
            const res = await fetch('/api/boss/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ max_hp: maxHp ? parseInt(maxHp) : null })
            });
            const data = await res.json();
            showToast(`Đã hồi sinh Boss đầy máu!`);
        } catch (err) {
            showToast("Lỗi hồi sinh boss!", false);
        }
    });

    btnRageAttack.addEventListener('click', async () => {
        try {
            await fetch('/api/boss/rage_attack', { method: 'POST' });
            showToast("Boss đã tung đòn nộ phản công!");
        } catch (err) {
            showToast("Lỗi kích nộ!", false);
        }
    });

    // Cấu hình hồi máu
    btnSaveHealConfig.addEventListener('click', async () => {
        const enabled = checkAutoHeal.checked;
        const delay = parseFloat(inputHealDelay.value) || 5;
        const percent = parseFloat(inputHealPercent.value) || 0.6;

        try {
            const res = await fetch('/api/config/heal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled, delay, percent })
            });
            const data = await res.json();
            showToast("Đã lưu cấu hình hồi máu thành công!");
        } catch (err) {
            showToast("Lỗi lưu cấu hình hồi máu!", false);
        }
    });

    // Cấu hình tăng máu theo Level
    const btnSaveHpConfig = document.getElementById('btnSaveHpConfig');
    const inputBaseStartHp = document.getElementById('inputBaseStartHp');
    const selectGrowthRate = document.getElementById('selectGrowthRate');

    if (btnSaveHpConfig) {
        btnSaveHpConfig.addEventListener('click', async () => {
            const baseHp = parseInt(inputBaseStartHp.value) || 50000;
            const growthRate = parseFloat(selectGrowthRate.value) || 1.35;

            try {
                const res = await fetch('/api/config/hp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base_hp: baseHp, growth_rate: growthRate })
                });
                const data = await res.json();
                showToast(`Đã lưu cấu hình: Máu Boss Level hiện tại = ${data.boss.max_hp.toLocaleString()} HP!`);
            } catch (err) {
                showToast("Lỗi lưu cấu hình máu!", false);
            }
        });
    }

    // 4. CẤU HÌNH DŨNG SĨ & HỒI SINH
    const btnSavePlayerConfig = document.getElementById('btnSavePlayerConfig');
    if (btnSavePlayerConfig) {
        btnSavePlayerConfig.addEventListener('click', async () => {
            const maxHp = parseInt(document.getElementById('inputPlayerMaxHp').value) || 1000;
            const reviveHearts = parseInt(document.getElementById('inputReviveHearts').value) || 50;
            const autoAttack = document.getElementById('checkBossAutoAttack').checked;
            const attackInterval = parseFloat(document.getElementById('inputBossAttackInterval').value) || 8;

            try {
                const res = await fetch('/api/config/player', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        max_hp: maxHp,
                        revive_hearts: reviveHearts,
                        auto_attack: autoAttack,
                        attack_interval: attackInterval
                    })
                });
                const data = await res.json();
                showToast(`Đã lưu: Máu Dũng Sĩ = ${data.player.max_hp} HP, Hồi sinh = ${data.player.revive_hearts_required} Tim!`);
            } catch (err) {
                showToast("Lỗi lưu cấu hình Dũng Sĩ!", false);
            }
        });
    }

    // 5. NÚT TEST BOSS PHẢN CÔNG & HỒI SINH
    const btnSimBossAttack = document.getElementById('btnSimBossAttack');
    if (btnSimBossAttack) {
        btnSimBossAttack.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/boss/attack_player', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                const data = await res.json();
                if (data.success) {
                    showToast(`Boss đã tung ${data.skill.name} gây -${data.damage} HP lên Dũng Sĩ!`);
                } else {
                    showToast(data.message, false);
                }
            } catch (err) {
                showToast("Lỗi kích hoạt Boss đánh!", false);
            }
        });
    }

    const btnSimPlayerKill = document.getElementById('btnSimPlayerKill');
    if (btnSimPlayerKill) {
        btnSimPlayerKill.addEventListener('click', async () => {
            try {
                await fetch('/api/player/damage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ damage: 99999 })
                });
                showToast("Dũng Sĩ đã gục ngã! Hãy thả tim để hồi sinh!");
            } catch (err) {
                showToast("Lỗi hạ gục Dũng Sĩ!", false);
            }
        });
    }

    const btnSimAddHearts = document.getElementById('btnSimAddHearts');
    if (btnSimAddHearts) {
        btnSimAddHearts.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/player/add_heart', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count: 10 })
                });
                const data = await res.json();
                if (data.revived) {
                    showToast("💖 Đã đủ Tim! Dũng Sĩ HỒI SINH ngoạn mục!");
                } else {
                    showToast(`💖 Đã thả 10 Tim (${data.player.revive_hearts_count}/${data.player.revive_hearts_required})!`);
                }
            } catch (err) {
                showToast("Lỗi thả tim hồi sinh!", false);
            }
        });
    }

    const btnSimPlayerRevive = document.getElementById('btnSimPlayerRevive');
    if (btnSimPlayerRevive) {
        btnSimPlayerRevive.addEventListener('click', async () => {
            try {
                await fetch('/api/player/revive', { method: 'POST' });
                showToast("Dũng Sĩ đã được hồi sinh tức thì!");
            } catch (err) {
                showToast("Lỗi hồi sinh Dũng Sĩ!", false);
            }
        });
    }

    const btnSimBossPoison = document.getElementById('btnSimBossPoison');
    if (btnSimBossPoison) {
        btnSimBossPoison.addEventListener('click', async () => {
            try {
                await fetch('/api/boss/poison', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ duration: 8, damage_per_tick: 90 })
                });
                showToast("Boss đã bị nhiễm Kịch Độc (rút máu mỗi giây)!");
            } catch (err) {
                showToast("Lỗi đầu độc Boss!", false);
            }
        });
    }
});
