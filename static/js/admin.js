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
});
