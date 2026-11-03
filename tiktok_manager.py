# -*- coding: utf-8 -*-
"""
tiktok_manager.py
Quản lý kết nối TikTok Live, bắt sự kiện Like, Comment, Gift, Follow, Share
và chuyển đổi thành chiêu thức tấn công Boss.
"""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import threading
import logging
import time
import re
from typing import Optional, Callable

from TikTokLive import TikTokLiveClient
from TikTokLive.events import (
    CommentEvent,
    ConnectEvent,
    DisconnectEvent,
    GiftEvent,
    LikeEvent,
    FollowEvent,
    ShareEvent
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TikTokManager")

class TikTokManager:
    def __init__(self, game_state, broadcast_callback: Optional[Callable] = None):
        self.game_state = game_state
        self.broadcast_callback = broadcast_callback
        self.client: Optional[TikTokLiveClient] = None
        self.thread: Optional[threading.Thread] = None
        self.username = ""
        self.is_connected = False
        self.status_message = "Chưa kết nối"
        self._stop_requested = False

    def set_broadcast_callback(self, callback: Callable):
        self.broadcast_callback = callback

    def _broadcast(self, event_type: str, data: dict):
        if self.broadcast_callback:
            try:
                self.broadcast_callback(event_type, data)
            except Exception as e:
                logger.error(f"Lỗi broadcast: {e}")

    def connect(self, username: str):
        username = username.strip().lstrip("@")
        if not username:
            return False, "Vui lòng nhập TikTok username hợp lệ!"

        if self.is_connected and self.username == username:
            return True, f"Đã đang kết nối với @{username}"

        # Ngắt kết nối cũ nếu có
        self.disconnect()

        self.username = username
        self.status_message = f"Đang kết nối tới @{username}..."
        self._stop_requested = False

        self.thread = threading.Thread(target=self._run_client, args=(username,), daemon=True)
        self.thread.start()
        return True, f"Đang bắt đầu kết nối tới @{username}"

    def disconnect(self):
        self._stop_requested = True
        if self.client:
            try:
                self.client.disconnect()
            except Exception as e:
                logger.warning(f"Lỗi khi disconnect: {e}")
            self.client = None
        self.is_connected = False
        self.status_message = "Đã ngắt kết nối"
        self._broadcast("status", {"connected": False, "username": self.username, "message": self.status_message})

    def _run_client(self, username: str):
        try:
            logger.info(f"Khởi tạo TikTokLiveClient cho @{username}")
            self.client = TikTokLiveClient(unique_id=username)

            @self.client.on(ConnectEvent)
            async def on_connect(event: ConnectEvent):
                self.is_connected = True
                self.status_message = f"Đã kết nối thành công với Live của @{username}!"
                logger.info(self.status_message)
                self._broadcast("status", {
                    "connected": True,
                    "username": username,
                    "message": self.status_message
                })

            @self.client.on(DisconnectEvent)
            async def on_disconnect(event: DisconnectEvent):
                self.is_connected = False
                self.status_message = "Mất kết nối TikTok Live"
                logger.warning("TikTok Live Disconnected")
                self._broadcast("status", {
                    "connected": False,
                    "username": username,
                    "message": self.status_message
                })

            @self.client.on(LikeEvent)
            async def on_like(event: LikeEvent):
                self._handle_like(event)

            @self.client.on(CommentEvent)
            async def on_comment(event: CommentEvent):
                self._handle_comment(event)

            @self.client.on(GiftEvent)
            async def on_gift(event: GiftEvent):
                self._handle_gift(event)

            @self.client.on(FollowEvent)
            async def on_follow(event: FollowEvent):
                self._handle_follow(event)

            @self.client.on(ShareEvent)
            async def on_share(event: ShareEvent):
                self._handle_share(event)

            # Bắt đầu kết nối
            self.client.run()
        except Exception as e:
            self.is_connected = False
            self.status_message = f"Lỗi kết nối: {str(e)}"
            logger.error(f"Lỗi client loop: {e}")
            self._broadcast("status", {
                "connected": False,
                "username": username,
                "message": self.status_message
            })

    def _get_user_info(self, user_obj):
        if not user_obj:
            return "user_anon", "Người xem", ""
        user_id = getattr(user_obj, "unique_id", "user_anon")
        nickname = getattr(user_obj, "nickname", user_id)
        avatar = ""
        # Lấy avatar url nếu có
        try:
            profile_picture = getattr(user_obj, "profile_picture", None)
            if profile_picture and hasattr(profile_picture, "urls") and profile_picture.urls:
                avatar = profile_picture.urls[0]
            elif profile_picture and hasattr(profile_picture, "url_list") and profile_picture.url_list:
                avatar = profile_picture.url_list[0]
            elif hasattr(user_obj, "avatar_thumb") and user_obj.avatar_thumb:
                avatar = user_obj.avatar_thumb.urls[0] if hasattr(user_obj.avatar_thumb, "urls") else ""
        except Exception:
            avatar = ""
        return user_id, nickname, avatar

    # --- XỬ LÝ SỰ KIỆN LIVE THẬT & GIẢ LẬP ---

    def _handle_like(self, event):
        user_id, nickname, avatar = self._get_user_info(event.user)
        count = getattr(event, "count", 1) or 1
        self.process_like(user_id, nickname, avatar, count)

    def process_like(self, user_id, nickname, avatar, count=1):
        # 1 Like = 15 HP. Nếu >= 15 like thì mưa tên
        base_dmg = 15 * count
        skill_name = "Mưa Bắn Tim" if count >= 10 else "Tia Sáng Ma Thuật"
        effect_type = "heart_barrage" if count >= 10 else "magic_bullet"

        event_data = self.game_state.register_attack(
            user_id=user_id,
            nickname=nickname,
            avatar=avatar,
            raw_damage=base_dmg,
            skill_name=skill_name,
            action_type="like"
        )
        event_data["effect"] = effect_type
        event_data["count"] = count
        self._broadcast("action", event_data)

    def _handle_comment(self, event):
        user_id, nickname, avatar = self._get_user_info(event.user)
        comment_text = getattr(event, "comment", "") or getattr(event, "content", "")
        self.process_comment(user_id, nickname, avatar, comment_text)

    def process_comment(self, user_id, nickname, avatar, comment_text):
        text_lower = comment_text.lower().strip()
        
        # Nhận diện kỹ năng qua từ khóa
        if any(w in text_lower for w in ["chem", "chém", "slash", "kiem", "kiếm", "danh", "đánh"]):
            skill_name = "Trảm Phong Kiếm"
            effect_type = "sword_slash"
            raw_dmg = 100
        elif any(w in text_lower for w in ["lua", "lửa", "fire", "hoa", "hỏa", "chay", "cháy"]):
            skill_name = "Cầu Lửa Hủy Diệt"
            effect_type = "fireball"
            raw_dmg = 200
        elif any(w in text_lower for w in ["bang", "băng", "ice", "tuyet", "tuyết"]):
            skill_name = "Băng Thiên Tiễn"
            effect_type = "ice_shard"
            raw_dmg = 200
        elif any(w in text_lower for w in ["set", "sét", "thunder", "loi", "lôi", "dien", "điện"]):
            skill_name = "Lôi Thần Trừng Phạt"
            effect_type = "lightning"
            raw_dmg = 350
        elif any(w in text_lower for w in ["bom", "bomb", "no", "nổ", "boom"]):
            skill_name = "Bộc Phá Ma Thuật"
            effect_type = "bomb_blast"
            raw_dmg = 450
        elif any(w in text_lower for w in ["heal", "hoi mau", "hồi máu", "buff"]):
            skill_name = "Thánh Quang Hồi Năng"
            effect_type = "holy_heal"
            raw_dmg = 120
        else:
            # Comment thường thành đạn chữ bay vào boss
            skill_name = f"Ngọc Chữ: {comment_text[:20]}"
            effect_type = "text_bullet"
            raw_dmg = 60

        event_data = self.game_state.register_attack(
            user_id=user_id,
            nickname=nickname,
            avatar=avatar,
            raw_damage=raw_dmg,
            skill_name=skill_name,
            action_type="comment"
        )
        event_data["effect"] = effect_type
        event_data["comment_text"] = comment_text
        self._broadcast("action", event_data)

    def _handle_gift(self, event):
        user_id, nickname, avatar = self._get_user_info(event.user)
        gift_obj = getattr(event, "gift", None)
        gift_name = getattr(gift_obj, "name", "Quà tặng") if gift_obj else "Quà tặng"
        diamond_count = getattr(gift_obj, "diamond_count", 1) if gift_obj else 1
        repeat_count = getattr(event, "repeat_count", 1) or 1
        
        # Chỉ xử lý khi kết thúc streak hoặc mỗi lượt gift
        # Nếu repeat_end là True hoặc gift không phải streak
        is_repeat_end = getattr(event, "repeat_end", 1)
        # Trong TikTokLive, nếu lặp quà thì diamond = diamond_count * repeat_count
        self.process_gift(user_id, nickname, avatar, gift_name, diamond_count * repeat_count, repeat_count)

    def process_gift(self, user_id, nickname, avatar, gift_name, diamonds=1, count=1):
        diamonds = max(1, diamonds)
        gift_name_lower = gift_name.lower().strip()

        # PHÂN LOẠI 9 HIỆU ỨNG QUÀ TẶNG ĐỘC NHẤT VÔ NHỊ & SIÊU HOÀNH TRÁNG
        if any(k in gift_name_lower for k in ["galaxy", "thiên hà", "universe", "vũ trụ", "dragon", "rồng", "whale", "cá voi"]):
            skill_name = f"🌌 HỐ ĐEN VŨ TRỤ & RỒNG THẦN ({gift_name} x{count})"
            effect_type = "gift_galaxy"
            raw_dmg = max(80000, diamonds * 2500)

        elif any(k in gift_name_lower for k in ["lion", "sư tử", "tiger", "hổ"]):
            skill_name = f"🦁 SƯ TỬ LỬA THẦN THÁNH ({gift_name} x{count})"
            effect_type = "gift_lion"
            raw_dmg = max(45000, diamonds * 2000)

        elif any(k in gift_name_lower for k in ["car", "xe", "ferrari", "lamborghini", "siêu xe", "moto"]):
            skill_name = f"🏎️ CHIẾN MÃ SIÊU THANH ({gift_name} x{count})"
            effect_type = "gift_car"
            raw_dmg = max(25000, diamonds * 1800)

        elif any(k in gift_name_lower for k in ["corgi", "chó", "mèo", "cat", "pet", "thú"]):
            skill_name = f"🐺 BẦY SÓI THẦN CUỒNG PHONG ({gift_name} x{count})"
            effect_type = "gift_corgi"
            raw_dmg = max(15000, diamonds * 1700)

        elif any(k in gift_name_lower for k in ["crown", "vương miện", "castle", "lâu đài", "thánh", "sword"]):
            skill_name = f"👑 THÁNH KIẾM EXCALIBUR ({gift_name} x{count})"
            effect_type = "gift_crown"
            raw_dmg = max(12000, diamonds * 1600)

        elif any(k in gift_name_lower for k in ["rocket", "tên lửa", "ufo", "plane", "phi cơ"]):
            skill_name = f"🚀 TÊN LỬA HẠT NHÂN NGUYÊN TỬ ({gift_name} x{count})"
            effect_type = "gift_rocket"
            raw_dmg = max(8000, diamonds * 1500)

        elif any(k in gift_name_lower for k in ["donut", "bánh", "kem", "ice cream", "pizza"]):
            skill_name = f"🍩 THIÊN THẠCH NGỌT NGÀO ({gift_name} x{count})"
            effect_type = "gift_donut"
            raw_dmg = max(4000, diamonds * 1300)

        elif any(k in gift_name_lower for k in ["heart", "tim", "trái tim", "bắn tim", "cupid", "love"]):
            skill_name = f"💖 MŨI TÊN THẦN CUPID ({gift_name} x{count})"
            effect_type = "gift_heart"
            raw_dmg = max(2000, diamonds * 1200)

        elif any(k in gift_name_lower for k in ["rose", "hoa", "bông hoa", "hoa hồng"]):
            skill_name = f"🌹 VẠN KIẾM QUY TÔNG ({gift_name} x{count})"
            effect_type = "gift_rose"
            raw_dmg = max(800, diamonds * 800)

        else:
            # Quà tặng khác phân loại theo số xu
            if diamonds >= 1000:
                skill_name = f"🌌 HỐ ĐEN VŨ TRỤ ({gift_name} x{count})"
                effect_type = "gift_galaxy"
                raw_dmg = diamonds * 2500
            elif diamonds >= 500:
                skill_name = f"🦁 SƯ TỬ LỬA THẦN THÁNH ({gift_name} x{count})"
                effect_type = "gift_lion"
                raw_dmg = diamonds * 2000
            elif diamonds >= 200:
                skill_name = f"👑 THÁNH KIẾM EXCALIBUR ({gift_name} x{count})"
                effect_type = "gift_crown"
                raw_dmg = diamonds * 1600
            elif diamonds >= 50:
                skill_name = f"🚀 TÊN LỬA HẠT NHÂN ({gift_name} x{count})"
                effect_type = "gift_rocket"
                raw_dmg = diamonds * 1500
            elif diamonds >= 10:
                skill_name = f"💖 MŨI TÊN THẦN CUPID ({gift_name} x{count})"
                effect_type = "gift_heart"
                raw_dmg = diamonds * 1200
            else:
                skill_name = f"🌹 VẠN KIẾM QUY TÔNG ({gift_name} x{count})"
                effect_type = "gift_rose"
                raw_dmg = diamonds * 800

        event_data = self.game_state.register_attack(
            user_id=user_id,
            nickname=nickname,
            avatar=avatar,
            raw_damage=raw_dmg,
            skill_name=skill_name,
            action_type="gift"
        )
        event_data["effect"] = effect_type
        event_data["gift_name"] = gift_name
        event_data["diamonds"] = diamonds
        event_data["gift_count"] = count
        self._broadcast("action", event_data)

    def _handle_follow(self, event):
        user_id, nickname, avatar = self._get_user_info(event.user)
        self.process_follow(user_id, nickname, avatar)

    def process_follow(self, user_id, nickname, avatar):
        # Follow buff x2 damage trong 30 giây
        self.game_state.activate_buff(multiplier=2.0, duration_seconds=30)
        event_data = {
            "user_id": user_id,
            "nickname": nickname,
            "avatar": avatar,
            "action_type": "follow",
            "effect": "buff_activate",
            "skill": "BUFF X2 SÁT THƯƠNG TOÀN ĐỘI!",
            "message": f"@{nickname} đã FOLLOW! Kích hoạt x2 Sát Thương 30s!"
        }
        self._broadcast("buff", event_data)

    def _handle_share(self, event):
        user_id, nickname, avatar = self._get_user_info(event.user)
        self.process_share(user_id, nickname, avatar)

    def process_share(self, user_id, nickname, avatar):
        # Share buff x1.5 damage trong 20s
        self.game_state.activate_buff(multiplier=1.5, duration_seconds=20)
        event_data = {
            "user_id": user_id,
            "nickname": nickname,
            "avatar": avatar,
            "action_type": "share",
            "effect": "buff_activate",
            "skill": "BUFF X1.5 SÁT THƯƠNG!",
            "message": f"@{nickname} đã CHIA SẺ LIVE! Kích hoạt x1.5 Sát Thương 20s!"
        }
        self._broadcast("buff", event_data)
