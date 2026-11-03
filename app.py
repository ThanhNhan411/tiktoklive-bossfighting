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

heal_thread = threading.Thread(target=_idle_heal_worker, daemon=True)
heal_thread.start()

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
    """Boss xả nộ phản công."""
    with game_state.lock:
        game_state.boss.reset_rage()
    broadcast_event("boss_attack", {
        "boss_name": game_state.boss.name,
        "skill": "SÓNG XUNG KÍCH HUỶ DIỆT (ROAR OF DOOM)",
        "message": f"⚠️ {game_state.boss.name} đã thịnh nộ và tung đòn phản công cực mạnh!"
    })
    return jsonify({"success": True})

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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("=" * 60)
    print("[TIKTOK LIVE BOSS FIGHT SERVER DANG KHOI CHAY]")
    print(f"-> Man hinh Game (OBS Browser Source): http://localhost:{port}/game")
    print(f"-> Bang dieu khien gia lap & ket noi:  http://localhost:{port}/admin")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
