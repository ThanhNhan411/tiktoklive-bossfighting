# -*- coding: utf-8 -*-
"""
app.py
Server chính của ứng dụng TikTok Live Boss Fight:
- Phục vụ Game Overlay (cho OBS Studio)
- Phục vụ Admin Dashboard & Simulator
- Cung cấp luồng SSE (Server-Sent Events) thời gian thực
- Cung cấp REST API điều khiển
"""
import sys
import os

# Cấu hình tự động mã hóa UTF-8 cho console Windows tránh UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import json
import queue
import time
import threading
from flask import Flask, render_template, request, Response, jsonify
from flask_cors import CORS

from game_state import GameState
from tiktok_manager import TikTokManager

app = Flask(__name__)
CORS(app)

game_state = GameState()
sse_listeners = []
sse_lock = threading.Lock()

def broadcast_event(event_type, data):
    """Gửi sự kiện tới tất cả các kết nối SSE đang mở."""
    # Thêm snapshot trạng thái boss vào mọi event để client đồng bộ tức thì
    data["game_snapshot"] = game_state.get_snapshot()
    payload = json.dumps({"type": event_type, "data": data}, ensure_ascii=False)
    message = f"data: {payload}\n\n"

    with sse_lock:
        to_remove = []
        for q in sse_listeners:
            try:
                q.put_nowait(message)
            except queue.Full:
                to_remove.append(q)
        for q in to_remove:
            if q in sse_listeners:
                sse_listeners.remove(q)

tiktok_manager = TikTokManager(game_state=game_state, broadcast_callback=broadcast_event)

def _idle_heal_worker():
    """Vòng lặp chạy nền kiểm tra hồi máu mỗi giây khi không có tương tác."""
    while True:
        time.sleep(1.0)
        try:
            actual_heal, healed = game_state.check_idle_heal()
            if healed and actual_heal > 0:
                broadcast_event("boss_heal", {
                    "heal_amount": actual_heal,
                    "boss_name": game_state.boss.name,
                    "message": f"⚠️ {game_state.boss.name} đang hồi máu (+{actual_heal:,} HP) do không có tương tác!"
                })
        except Exception:
            pass

def _boss_combat_worker():
    """Vòng lặp kiểm tra Boss phản công Dũng Sĩ & Rút máu độc mỗi giây."""
    while True:
        time.sleep(0.25)
        try:
            # 1. Rút máu khi Boss bị trúng độc (4 giây, mỗi giây 50 HP)
            poison_dmg, is_poisoned, ended = game_state.boss.check_poison_tick()
            if poison_dmg > 0:
                broadcast_event("boss_poison_tick", {
                    "damage": poison_dmg,
                    "boss_name": game_state.boss.name,
                    "message": f"🧪 {game_state.boss.name} bị trúng độc rút máu (-{poison_dmg} HP)!",
                    "boss": game_state.boss.to_dict(),
                    "game_snapshot": game_state.get_snapshot()
                })
            if ended:
                broadcast_event("boss_poison_end", {
                    "boss_name": game_state.boss.name,
                    "message": f"✨ {game_state.boss.name} đã hóa giải độc tố!",
                    "boss": game_state.boss.to_dict(),
                    "game_snapshot": game_state.get_snapshot()
                })

            # 2. Kiểm tra cảnh báo Nộ Boss (5 giây)
            if game_state.rage_warning_active:
                if time.time() >= game_state.rage_warning_end_time:
                    success, shielded, actual_dmg, shield_by = game_state.execute_boss_rage()
                    if not success:
                        # Dũng Sĩ/Boss đã chết trong lúc đếm ngược: báo client tắt bảng đếm ngược
                        broadcast_event("boss_rage_execute", {
                            "boss_name": game_state.boss.name,
                            "cancelled": True,
                            "shielded": False,
                            "player": game_state.player.to_dict(),
                            "boss": game_state.boss.to_dict()
                        })
                    if success:
                        if shielded:
                            broadcast_event("boss_rage_execute", {
                                "boss_name": game_state.boss.name,
                                "shielded": True,
                                "shield_by": shield_by,
                                "message": f"🛡️ @{shield_by} đã hô 'HỘ GIÁ!' thành công! Khiên Ngưng Đọng Thời Gian đã cứu mạng Dũng Sĩ khỏi Nộ Hủy Diệt!",
                                "player": game_state.player.to_dict(),
                                "boss": game_state.boss.to_dict()
                            })
                        else:
                            broadcast_event("boss_rage_execute", {
                                "boss_name": game_state.boss.name,
                                "shielded": False,
                                "damage": actual_dmg,
                                "message": f"💥 {game_state.boss.name} xả NỘ HỦY DIỆT trúng Dũng Sĩ làm Dũng Sĩ gục ngã ngay lập tức! Thả tim để hồi sinh!",
                                "player": game_state.player.to_dict(),
                                "boss": game_state.boss.to_dict()
                            })

            # 3. Boss tự động phản công Dũng Sĩ theo chu kỳ
            now = time.time()
            if (game_state.boss_auto_attack_enabled and 
                not game_state.boss.is_dead and 
                not game_state.player.is_dead):
                if now - game_state.last_boss_attack_time >= game_state.boss_attack_interval:
                    skill, dmg = game_state.boss_attack_player()
                    if skill and dmg > 0:
                        broadcast_event("boss_attack_player", {
                            "skill_name": skill["name"],
                            "effect": skill["effect"],
                            "damage": dmg,
                            "message": f"💥 {game_state.boss.name} {skill['message']} (-{dmg} HP)",
                            "player": game_state.player.to_dict(),
                            "boss": game_state.boss.to_dict()
                        })
        except Exception:
            import traceback; traceback.print_exc()

heal_thread = threading.Thread(target=_idle_heal_worker, daemon=True)
heal_thread.start()

combat_thread = threading.Thread(target=_boss_combat_worker, daemon=True)
combat_thread.start()

@app.route("/")
@app.route("/game")
def game_page():
    """Trang giao diện trò chơi (dành cho OBS Browser Source)."""
    return render_template("game.html")

@app.route("/admin")
def admin_page():
    """Trang Bảng điều khiển giả lập & Quản lý kết nối TikTok."""
    return render_template("admin.html")

@app.route("/stream")
def sse_stream():
    """Endpoint Server-Sent Events (SSE) để truyền dữ liệu thời gian thực."""
    def event_stream():
        client_queue = queue.Queue(maxsize=100)
        with sse_lock:
            sse_listeners.append(client_queue)

        # Gửi dữ liệu khởi tạo ban đầu cho client vừa kết nối
        initial_payload = json.dumps({
            "type": "init",
            "data": {
                "status": {
                    "connected": tiktok_manager.is_connected,
                    "username": tiktok_manager.username,
                    "message": tiktok_manager.status_message
                },
                "game_snapshot": game_state.get_snapshot()
            }
        }, ensure_ascii=False)
        yield f"data: {initial_payload}\n\n"

        try:
            while True:
                # Đợi tin nhắn mới, heartbeat sau mỗi 15 giây
                try:
                    msg = client_queue.get(timeout=15.0)
                    yield msg
                except queue.Empty:
                    # Gửi heartbeat giữ kết nối
                    yield ": ping\n\n"
        except GeneratorExit:
            with sse_lock:
                if client_queue in sse_listeners:
                    sse_listeners.remove(client_queue)

    return Response(
        event_stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )

# --- REST API ---

@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({
        "status": {
            "connected": tiktok_manager.is_connected,
            "username": tiktok_manager.username,
            "message": tiktok_manager.status_message
        },
        "game_snapshot": game_state.get_snapshot()
    })

@app.route("/api/connect", methods=["POST"])
def api_connect():
    data = request.get_json() or {}
    username = data.get("username", "")
    success, message = tiktok_manager.connect(username)
    return jsonify({"success": success, "message": message, "username": username})

@app.route("/api/disconnect", methods=["POST"])
def api_disconnect():
    tiktok_manager.disconnect()
    return jsonify({"success": True, "message": "Đã ngắt kết nối TikTok Live"})

@app.route("/api/simulate", methods=["POST"])
def api_simulate():
    """Giả lập sự kiện người xem mà không cần live thật."""
    data = request.get_json() or {}
    event_type = data.get("type", "comment")
    username = data.get("username", "Hero_Viewer")
    avatar = data.get("avatar", "")

    if event_type == "like":
        count = int(data.get("count", 1))
        tiktok_manager.process_like(
            user_id=f"sim_{username}",
            nickname=username,
            avatar=avatar,
            count=count
        )
    elif event_type == "comment":
        text = data.get("text", "chem")
        tiktok_manager.process_comment(
            user_id=f"sim_{username}",
            nickname=username,
            avatar=avatar,
            comment_text=text
        )
    elif event_type == "gift":
        gift_name = data.get("name", "Hoa Hồng")
        diamonds = int(data.get("diamonds", 1))
        count = int(data.get("count", 1))
        tiktok_manager.process_gift(
            user_id=f"sim_{username}",
            nickname=username,
            avatar=avatar,
            gift_name=gift_name,
            diamonds=diamonds,
            count=count
        )
    elif event_type == "follow":
        tiktok_manager.process_follow(
            user_id=f"sim_{username}",
            nickname=username,
            avatar=avatar
        )
    elif event_type == "share":
        tiktok_manager.process_share(
            user_id=f"sim_{username}",
            nickname=username,
            avatar=avatar
        )
    else:
        return jsonify({"success": False, "message": f"Loại sự kiện không hợp lệ: {event_type}"}), 400

    return jsonify({"success": True, "message": f"Đã giả lập thành công sự kiện {event_type}"})

@app.route("/api/boss/next", methods=["POST"])
def api_boss_next():
    boss_dict = game_state.next_boss()
    broadcast_event("boss_update", {
        "event": "next_boss",
        "boss": boss_dict,
        "message": f"Boss mới xuất hiện: {boss_dict['name']}!"
    })
    return jsonify({"success": True, "boss": boss_dict})

@app.route("/api/boss/reset", methods=["POST"])
def api_boss_reset():
    data = request.get_json() or {}
    max_hp = data.get("max_hp")
    if max_hp:
        try:
            max_hp = int(max_hp)
        except ValueError:
            max_hp = None
    boss_dict = game_state.reset_current_boss(max_hp=max_hp)
    broadcast_event("boss_update", {
        "event": "reset_boss",
        "boss": boss_dict,
        "message": f"Đã hồi sinh {boss_dict['name']}!"
    })
    return jsonify({"success": True, "boss": boss_dict})

@app.route("/api/boss/rage_attack", methods=["POST"])
def api_boss_rage_attack():
    """Boss kích hoạt Nộ (cảnh báo 5 giây)."""
    started = game_state.start_rage_warning(duration=5.0)
    if started:
        broadcast_event("boss_rage_warning", {
            "boss_name": game_state.boss.name,
            "countdown": 5,
            "message": f"⚠️ {game_state.boss.name} đã tích đầy NỘ! Chuẩn bị xả Nộ Hủy Diệt sau 5s! Comment 'hộ giá' để kích hoạt khiên!"
        })
        return jsonify({"success": True, "message": "Đã bắt đầu đếm ngược 5 giây cảnh báo Nộ Boss!"})
    return jsonify({"success": False, "message": "Không thể kích nộ (Boss hoặc Dũng Sĩ đã chết)"})

@app.route("/api/boss/shield", methods=["POST"])
def api_boss_shield():
    """Kích hoạt Khiên Hộ Giá cho Dũng Sĩ."""
    data = request.get_json() or {}
    nickname = data.get("nickname", "Hiệp Sĩ Live")
    game_state.activate_shield(nickname)
    broadcast_event("shield_activated", {
        "nickname": nickname,
        "message": f"🛡️ @{nickname} đã hô 'HỘ GIÁ!' kích hoạt Khiên Ngưng Đọng Thời Gian bảo vệ Dũng Sĩ!",
        "player": game_state.player.to_dict()
    })
    return jsonify({"success": True, "message": "Đã kích hoạt khiên Hộ Giá!"})

@app.route("/api/config/hp", methods=["POST"])
def api_config_hp():
    """Cấu hình công thức máu tăng dần theo Level."""
    data = request.get_json() or {}
    base_hp = data.get("base_hp")
    growth_rate = data.get("growth_rate")
    boss_dict = game_state.set_hp_config(base_start_hp=base_hp, growth_rate=growth_rate)
    broadcast_event("boss_update", {
        "event": "hp_config_update",
        "boss": boss_dict,
        "message": f"Đã cập nhật máu Level {game_state.level}: {boss_dict['max_hp']:,} HP"
    })
    return jsonify({"success": True, "boss": boss_dict})

@app.route("/api/config/heal", methods=["POST"])
def api_config_heal():
    """Cấu hình tính năng Boss tự hồi máu khi không tương tác."""
    data = request.get_json() or {}
    if "enabled" in data:
        game_state.auto_heal_enabled = bool(data["enabled"])
    if "delay" in data:
        game_state.idle_heal_delay = float(data["delay"])
    if "percent" in data:
        game_state.heal_percent_per_sec = float(data["percent"]) / 100.0
    return jsonify({
        "success": True,
        "auto_heal_enabled": game_state.auto_heal_enabled,
        "idle_heal_delay": game_state.idle_heal_delay,
        "heal_percent": game_state.heal_percent_per_sec * 100.0
    })

# --- API CẤU HÌNH & ĐIỀU KHIỂN DŨNG SĨ (PLAYER) & HỒI SINH ---

@app.route("/api/config/player", methods=["POST"])
def api_config_player():
    """Cấu hình Máu Dũng Sĩ, Số Tim Hồi Sinh & Tần suất Boss tấn công."""
    data = request.get_json() or {}
    max_hp = data.get("max_hp")
    revive_hearts = data.get("revive_hearts")
    auto_attack = data.get("auto_attack")
    attack_interval = data.get("attack_interval")
    player_dict = game_state.set_player_config(
        max_hp=max_hp,
        revive_hearts=revive_hearts,
        auto_attack=auto_attack,
        attack_interval=attack_interval
    )
    broadcast_event("player_update", {
        "player": player_dict,
        "boss_auto_attack_enabled": game_state.boss_auto_attack_enabled,
        "boss_attack_interval": game_state.boss_attack_interval,
        "message": "Đã cập nhật cấu hình Dũng Sĩ & Hồi Sinh thành công!"
    })
    return jsonify({"success": True, "player": player_dict})

@app.route("/api/player/damage", methods=["POST"])
def api_player_damage():
    """Gây sát thương lên Dũng Sĩ (Giả lập / Test)."""
    data = request.get_json() or {}
    dmg = int(data.get("damage", 250))
    actual = game_state.player.take_damage(dmg)
    broadcast_event("player_damaged", {
        "damage": actual,
        "player": game_state.player.to_dict(),
        "message": f"Dũng Sĩ nhận {actual} sát thương!"
    })
    return jsonify({"success": True, "damage": actual, "player": game_state.player.to_dict()})

@app.route("/api/player/heal", methods=["POST"])
def api_player_heal():
    """Hồi máu cho Dũng Sĩ."""
    data = request.get_json() or {}
    amt = int(data.get("amount", 200))
    actual = game_state.player.heal(amt)
    broadcast_event("player_healed", {
        "amount": actual,
        "player": game_state.player.to_dict(),
        "message": f"Dũng Sĩ được hồi phục +{actual} HP!"
    })
    return jsonify({"success": True, "amount": actual, "player": game_state.player.to_dict()})

@app.route("/api/player/revive", methods=["POST"])
def api_player_revive():
    """Hồi sinh Dũng Sĩ tức thì."""
    game_state.player.revive()
    broadcast_event("player_revived", {
        "player": game_state.player.to_dict(),
        "message": "Dũng Sĩ đã HỒI SINH ngoạn mục với 100% sinh lực!"
    })
    return jsonify({"success": True, "player": game_state.player.to_dict()})

@app.route("/api/player/add_heart", methods=["POST"])
def api_player_add_heart():
    """Thả tim để tích lũy hồi sinh Dũng Sĩ."""
    data = request.get_json() or {}
    count = int(data.get("count", 5))
    revived, _ = game_state.player.add_revive_heart(count)
    if revived:
        broadcast_event("player_revived", {
            "player": game_state.player.to_dict(),
            "message": "Dũng Sĩ đã đủ Tim và HỒI SINH thành công!"
        })
    else:
        broadcast_event("player_heart_added", {
            "added": count,
            "player": game_state.player.to_dict(),
            "message": f"Đã góp thêm {count} Tim ({game_state.player.revive_hearts_count}/{game_state.player.revive_hearts_required})!"
        })
    return jsonify({"success": True, "player": game_state.player.to_dict(), "revived": revived})

@app.route("/api/boss/attack_player", methods=["POST"])
def api_boss_attack_player():
    """Kích hoạt Boss tung chiêu phản công Dũng Sĩ (thủ công từ Admin)."""
    data = request.get_json() or {}
    skill_idx = data.get("skill_index")
    if skill_idx is not None:
        try:
            skill_idx = int(skill_idx)
        except ValueError:
            skill_idx = None
    skill, dmg = game_state.boss_attack_player(skill_index=skill_idx)
    if skill:
        broadcast_event("boss_attack_player", {
            "skill_name": skill["name"],
            "effect": skill["effect"],
            "damage": dmg,
            "message": f"💥 {game_state.boss.name} {skill['message']} (-{dmg} HP)",
            "player": game_state.player.to_dict(),
            "boss": game_state.boss.to_dict()
        })
        return jsonify({"success": True, "skill": skill, "damage": dmg})
    return jsonify({"success": False, "message": "Không thể tấn công (Dũng Sĩ hoặc Boss đã chết)"})

@app.route("/api/boss/poison", methods=["POST"])
def api_boss_poison():
    """Đầu độc Boss (Giả lập / Test)."""
    data = request.get_json() or {}
    dur = int(data.get("duration", 4))
    dpt = int(data.get("damage_per_tick", 50))
    game_state.boss.apply_poison(duration=dur, damage_per_tick=dpt)
    broadcast_event("boss_poisoned", {
        "boss": game_state.boss.to_dict(),
        "message": f"🧪 {game_state.boss.name} đã bị dính Độc Tố trong {dur}s!"
    })
    return jsonify({"success": True, "boss": game_state.boss.to_dict()})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("=" * 60)
    print("[TIKTOK LIVE BOSS FIGHT SERVER DANG KHOI CHAY]")
    print(f"-> Man hinh Game (OBS Browser Source): http://localhost:{port}/game")
    print(f"-> Bang dieu khien gia lap & ket noi:  http://localhost:{port}/admin")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
