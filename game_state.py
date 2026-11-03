# -*- coding: utf-8 -*-
"""
game_state.py
Quản lý trạng thái trò chơi: Máu Boss, Cấp độ Boss, Bảng xếp hạng, Buff sát thương,
cơ chế tăng trưởng máu theo cấp số nhân (Exponential HP Scaling) và hồi máu khi không tương tác.
"""
import time
import threading

class Boss:
    def __init__(self, boss_id=1, name="Hỏa Long Ignis", max_hp=50000, boss_type="dragon"):
        self.boss_id = boss_id
        self.name = name
        self.max_hp = max_hp
        self.current_hp = max_hp
        self.boss_type = boss_type
        self.rage = 0 # 0 -> 100%
        self.is_dead = False
        self.killer = None

    def take_damage(self, amount, user_name="Người bí ẩn"):
        if self.is_dead:
            return 0
        actual_damage = min(self.current_hp, amount)
        self.current_hp -= actual_damage
        self.rage = min(100, self.rage + (actual_damage / self.max_hp) * 50)
        
        if self.current_hp <= 0:
            self.current_hp = 0
            self.is_dead = True
            self.killer = user_name
        return actual_damage

    def heal(self, amount):
        """Hồi máu cho boss (không vượt quá max_hp)."""
        if self.is_dead or self.current_hp >= self.max_hp:
            return 0
        actual_heal = min(self.max_hp - self.current_hp, amount)
        self.current_hp += actual_heal
        return actual_heal

    def reset_rage(self):
        self.rage = 0

    def to_dict(self):
        return {
            "id": self.boss_id,
            "name": self.name,
            "max_hp": self.max_hp,
            "current_hp": self.current_hp,
            "hp_percent": round((self.current_hp / self.max_hp) * 100, 1) if self.max_hp > 0 else 0,
            "boss_type": self.boss_type,
            "rage": round(self.rage, 1),
            "is_dead": self.is_dead,
            "killer": self.killer
        }

# Kho 12 Boss đồ sộ, phong phú, độc nhất vô nhị
BOSS_TEMPLATES = [
    {"name": "Hỏa Long Ignis", "type": "dragon"},
    {"name": "Ma Vương Hắc Ám Morzan", "type": "titan"},
    {"name": "Titan Nham Thạch Magma", "type": "golem"},
    {"name": "Mãng Xà Độc Vương Hydra", "type": "hydra"},
    {"name": "Chiến Binh Cơ Khí Mecha-X", "type": "cyber"},
    {"name": "Băng Thần Quỷ FrostLord", "type": "frost"},
    {"name": "Lôi Thần Kim Giáp Zeus", "type": "zeus"},
    {"name": "Chúa Tể Hắc Ám Lich King", "type": "lich"},
    {"name": "Cổ Thần Biển Sâu Kraken", "type": "kraken"},
    {"name": "Phượng Hoàng Lửa Bất Tử", "type": "phoenix"},
    {"name": "Bạch Hổ Chiến Thần Tướng", "type": "tiger"},
    {"name": "Cơ Giáp Tử Thần Anubis", "type": "anubis"},
]

class GameState:
    def __init__(self):
        self.lock = threading.RLock()
        self.level = 1
        self.total_kills = 0
        self.base_start_hp = 50000   # Máu khởi điểm ở Level 1
        self.hp_growth_rate = 1.35   # Tăng trưởng 35% mỗi level (càng cao máu càng khủng)
        self.boss = self._create_boss_for_level(1)
        self.leaderboard = {}
        self.damage_multiplier = 1.0
        self.buff_end_time = 0
        self.recent_events = []
        self.max_recent_events = 20

        # Cơ chế Hồi Máu Khi Không Tương Tác (Idle Regeneration)
        self.auto_heal_enabled = True
        self.idle_heal_delay = 5.0
        self.heal_percent_per_sec = 0.006
        self.last_interaction_time = time.time()

    def _create_boss_for_level(self, level):
        template_idx = (level - 1) % len(BOSS_TEMPLATES)
        template = BOSS_TEMPLATES[template_idx]

        # CÔNG THỨC MÁU TĂNG THEO CẤP SỐ NHÂN (EXPONENTIAL HP SCALING)
        # Càng lên cao máu càng trâu, vượt qua mọi vòng lặp
        calc_hp = int(self.base_start_hp * (self.hp_growth_rate ** (level - 1)))
        
        # Làm tròn số máu cho đẹp mắt
        if calc_hp < 1000000:
            final_hp = max(50000, round(calc_hp / 1000) * 1000)
        else:
            final_hp = round(calc_hp / 10000) * 10000

        name = f"Lv.{level} {template['name']}"
        return Boss(boss_id=level, name=name, max_hp=final_hp, boss_type=template["type"])

    def set_hp_config(self, base_start_hp=None, growth_rate=None):
        with self.lock:
            if base_start_hp is not None:
                self.base_start_hp = max(10000, int(base_start_hp))
            if growth_rate is not None:
                self.hp_growth_rate = max(1.05, float(growth_rate))
            # Cập nhật lại boss hiện tại theo cấu hình mới
            self.boss = self._create_boss_for_level(self.level)
            return self.boss.to_dict()

    def next_boss(self):
        with self.lock:
            self.level += 1
            self.total_kills += 1
            self.boss = self._create_boss_for_level(self.level)
            self.last_interaction_time = time.time()
            return self.boss.to_dict()

    def reset_current_boss(self, max_hp=None):
        with self.lock:
            template_idx = (self.level - 1) % len(BOSS_TEMPLATES)
            template = BOSS_TEMPLATES[template_idx]
            if max_hp:
                hp = max_hp
            else:
                calc_hp = int(self.base_start_hp * (self.hp_growth_rate ** (self.level - 1)))
                hp = round(calc_hp / 1000) * 1000 if calc_hp < 1000000 else round(calc_hp / 10000) * 10000

            name = f"Lv.{self.level} {template['name']}"
            self.boss = Boss(boss_id=self.level, name=name, max_hp=hp, boss_type=template["type"])
            self.last_interaction_time = time.time()
            return self.boss.to_dict()

    def touch_interaction(self):
        with self.lock:
            self.last_interaction_time = time.time()

    def check_idle_heal(self):
        with self.lock:
            if not self.auto_heal_enabled or self.boss.is_dead:
                return 0, False
            now = time.time()
            idle_seconds = now - self.last_interaction_time
            if idle_seconds >= self.idle_heal_delay:
                heal_val = max(50, int(self.boss.max_hp * self.heal_percent_per_sec))
                actual = self.boss.heal(heal_val)
                if actual > 0:
                    return actual, True
            return 0, False

    def activate_buff(self, multiplier=2.0, duration_seconds=30):
        with self.lock:
            self.touch_interaction()
            self.damage_multiplier = multiplier
            self.buff_end_time = time.time() + duration_seconds

    def get_effective_multiplier(self):
        if time.time() < self.buff_end_time:
            return self.damage_multiplier
        return 1.0

    def register_attack(self, user_id, nickname, avatar, raw_damage, skill_name, action_type="comment"):
        with self.lock:
            self.touch_interaction()
            multiplier = self.get_effective_multiplier()
            final_damage = int(raw_damage * multiplier)
            is_crit = multiplier > 1.0

            actual_damage = self.boss.take_damage(final_damage, nickname)

            if user_id not in self.leaderboard:
                self.leaderboard[user_id] = {
                    "user_id": user_id,
                    "nickname": nickname,
                    "avatar": avatar,
                    "damage": 0,
                    "attacks": 0,
                    "last_skill": skill_name
                }
            self.leaderboard[user_id]["damage"] += actual_damage
            self.leaderboard[user_id]["attacks"] += 1
            self.leaderboard[user_id]["last_skill"] = skill_name
            if avatar:
                self.leaderboard[user_id]["avatar"] = avatar
            if nickname:
                self.leaderboard[user_id]["nickname"] = nickname

            event_data = {
                "user_id": user_id,
                "nickname": nickname,
                "avatar": avatar,
                "skill": skill_name,
                "damage": actual_damage,
                "is_crit": is_crit,
                "action_type": action_type,
                "boss_dead": self.boss.is_dead,
                "timestamp": time.time()
            }
            self.recent_events.append(event_data)
            if len(self.recent_events) > self.max_recent_events:
                self.recent_events.pop(0)

            return event_data

    def get_top_players(self, limit=5):
        with self.lock:
            sorted_players = sorted(
                self.leaderboard.values(),
                key=lambda p: p["damage"],
                reverse=True
            )
            return sorted_players[:limit]

    def get_snapshot(self):
        with self.lock:
            buff_remaining = max(0, int(self.buff_end_time - time.time()))
            idle_seconds = max(0, int(time.time() - self.last_interaction_time))
            is_regenerating = self.auto_heal_enabled and not self.boss.is_dead and idle_seconds >= self.idle_heal_delay
            return {
                "boss": self.boss.to_dict(),
                "level": self.level,
                "total_kills": self.total_kills,
                "buff_active": buff_remaining > 0,
                "buff_remaining": buff_remaining,
                "damage_multiplier": self.damage_multiplier if buff_remaining > 0 else 1.0,
                "top_players": self.get_top_players(5),
                "is_regenerating": is_regenerating,
                "auto_heal_enabled": self.auto_heal_enabled,
                "idle_seconds": idle_seconds,
                "hp_growth_rate": self.hp_growth_rate,
                "base_start_hp": self.base_start_hp
            }
