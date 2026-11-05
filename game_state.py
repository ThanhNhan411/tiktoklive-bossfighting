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
        self.is_poisoned = False
        self.poison_end_time = 0
        self.poison_dmg_per_tick = 50
        self.last_poison_tick = 0
        self.poison_start_time = 0
        self.last_poison_activity = 0
        self.poison_ticks_done = 0
        self.poison_ticks_left = 0

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

    def apply_poison(self, duration=4, damage_per_tick=50):
        """Đầu độc Boss: rút máu liên tục theo thời gian (4 giây, mỗi giây 50 máu)."""
        if self.is_dead:
            return False
        now = time.time()
        self.is_poisoned = True
        self.poison_end_time = now + duration
        self.poison_dmg_per_tick = damage_per_tick
        self.last_poison_tick = now
        self.poison_start_time = now
        self.poison_ticks_done = 0
        self.poison_ticks_left = int(duration)
        return True

    def check_poison_tick(self):
        """Trừ máu độc đúng nhịp mỗi 1 giây: tổng 4 tick x 50 máu (không trôi nhịp)."""
        if not self.is_poisoned or self.is_dead:
            return 0, False, False
        now = time.time()
        total_ticks = int(round(self.poison_end_time - self.poison_start_time))
        due = min(total_ticks, int((now - self.poison_start_time) // 1.0))
        dmg = 0
        while self.poison_ticks_done < due and not self.is_dead:
            self.poison_ticks_done += 1
            dmg += self.take_damage(self.poison_dmg_per_tick, "Kịch Độc")
            self.last_poison_activity = now
        finished = self.poison_ticks_done >= total_ticks or self.is_dead
        if finished:
            self.is_poisoned = False
            self.poison_ticks_left = 0
            return dmg, False, True
        self.poison_ticks_left = total_ticks - self.poison_ticks_done
        return dmg, True, False

    def reset_rage(self):
        self.rage = 0

    def to_dict(self):
        now = time.time()
        is_pos = self.is_poisoned and (now < self.poison_end_time) and (getattr(self, 'poison_ticks_left', 0) > 0)
        return {
            "id": self.boss_id,
            "name": self.name,
            "max_hp": self.max_hp,
            "current_hp": self.current_hp,
            "hp_percent": round((self.current_hp / self.max_hp) * 100, 1) if self.max_hp > 0 else 0,
            "boss_type": self.boss_type,
            "rage": round(self.rage, 1),
            "is_dead": self.is_dead,
            "killer": self.killer,
            "is_poisoned": is_pos,
            "poison_remaining": max(0, int(self.poison_end_time - now)) if is_pos else 0,
            "poison_end_time": self.poison_end_time if is_pos else 0
        }

class Player:
    def __init__(self, max_hp=1000, revive_hearts_required=50):
        self.max_hp = max_hp
        self.current_hp = max_hp
        self.is_dead = False
        self.revive_hearts_required = revive_hearts_required
        self.revive_hearts_count = 0

    def take_damage(self, amount):
        if self.is_dead:
            return 0
        actual = min(self.current_hp, amount)
        self.current_hp -= actual
        if self.current_hp <= 0:
            self.current_hp = 0
            self.is_dead = True
            self.revive_hearts_count = 0
        return actual

    def heal(self, amount):
        if self.is_dead:
            return 0
        actual = min(self.max_hp - self.current_hp, amount)
        self.current_hp += actual
        return actual

    def add_revive_heart(self, count=1):
        if not self.is_dead:
            return False, 0
        self.revive_hearts_count += count
        if self.revive_hearts_count >= self.revive_hearts_required:
            self.is_dead = False
            self.current_hp = self.max_hp
            self.revive_hearts_count = 0
            return True, self.current_hp
        return False, self.revive_hearts_count

    def revive(self):
        self.is_dead = False
        self.current_hp = self.max_hp
        self.revive_hearts_count = 0
        return self.current_hp

    def to_dict(self):
        return {
            "max_hp": self.max_hp,
            "current_hp": self.current_hp,
            "hp_percent": round((self.current_hp / self.max_hp) * 100, 1) if self.max_hp > 0 else 0,
            "is_dead": self.is_dead,
            "revive_hearts_required": self.revive_hearts_required,
            "revive_hearts_count": self.revive_hearts_count,
            "revive_percent": round((self.revive_hearts_count / self.revive_hearts_required) * 100, 1) if self.revive_hearts_required > 0 else 0
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

        # Dũng Sĩ Người Chơi & Cơ Chế Hồi Sinh
        self.player = Player(max_hp=1000, revive_hearts_required=50)

        # Boss Phản Công Người Chơi
        self.boss_auto_attack_enabled = True
        self.boss_attack_interval = 8.0 # Giây giữa các đòn phản công của Boss
        self.last_boss_attack_time = time.time()

        # Cơ chế Hồi Máu Khi Không Tương Tác (Idle Regeneration)
        self.auto_heal_enabled = True
        self.idle_heal_delay = 5.0
        self.heal_percent_per_sec = 0.006
        self.last_interaction_time = time.time()

        # Boss Nộ & Cảnh Báo 5 Giây & Khiên Hộ Giá (arcane/time-stop)
        self.rage_warning_active = False
        self.rage_warning_end_time = 0
        self.player_shielded = False
        self.player_shield_by = ""

    def start_rage_warning(self, duration=5.0):
        """Bắt đầu cảnh báo 5 giây trước khi Boss xả Nộ Hủy Diệt."""
        with self.lock:
            if self.boss.is_dead or self.player.is_dead:
                return False
            self.rage_warning_active = True
            self.rage_warning_end_time = time.time() + duration
            self.player_shielded = False
            self.player_shield_by = ""
            return True

    def activate_shield(self, nickname="Dũng Sĩ"):
        """Người xem comment 'hộ giá' kích hoạt Khiên Time-Stop bảo vệ người chơi."""
        with self.lock:
            self.player_shielded = True
            self.player_shield_by = nickname
            return True

    def execute_boss_rage(self):
        """Kích hoạt Nộ Boss: tác động lên người chơi, nộ làm người chơi chết ngay lập tức nếu không có khiên."""
        with self.lock:
            self.rage_warning_active = False
            self.boss.reset_rage()
            if self.player.is_dead or self.boss.is_dead:
                return False, False, 0, ""

            shielded = self.player_shielded
            shield_by = self.player_shield_by

            if shielded:
                # Có khiên Hộ Giá -> Người chơi an toàn, không nhận sát thương!
                actual_dmg = 0
            else:
                # Không có khiên -> Người chơi chết ngay lập tức!
                actual_dmg = self.player.take_damage(self.player.current_hp if self.player.current_hp > 0 else 999999)

            self.player_shielded = False
            self.player_shield_by = ""
            return True, shielded, actual_dmg, shield_by

    def set_player_config(self, max_hp=None, revive_hearts=None, auto_attack=None, attack_interval=None):
        with self.lock:
            if max_hp is not None:
                new_max = max(100, int(max_hp))
                diff = new_max - self.player.max_hp
                self.player.max_hp = new_max
                self.player.current_hp = max(1, min(self.player.max_hp, self.player.current_hp + diff))
            if revive_hearts is not None:
                self.player.revive_hearts_required = max(1, int(revive_hearts))
            if auto_attack is not None:
                self.boss_auto_attack_enabled = bool(auto_attack)
            if attack_interval is not None:
                self.boss_attack_interval = max(3.0, float(attack_interval))
            return self.player.to_dict()

    def boss_attack_player(self, skill_index=None):
        """Boss tung skill phản công gây sát thương lên Dũng Sĩ."""
        with self.lock:
            if self.boss.is_dead or self.player.is_dead:
                return None, 0
            
            skills = [
                {
                    "name": "Cầu Lửa Hắc Ám",
                    "effect": "boss_fireball",
                    "damage": 120,
                    "message": "phóng Cầu Lửa Hắc Ám thiêu đốt Dũng Sĩ!"
                },
                {
                    "name": "Thiên Lôi Hắc Ám",
                    "effect": "boss_lightning",
                    "damage": 160,
                    "message": "giáng sấm sét hủy diệt xuống Dũng Sĩ!"
                },
                {
                    "name": "Hàn Băng Thấu Xương",
                    "effect": "boss_frost",
                    "damage": 130,
                    "message": "phóng bão tuyết đóng băng Dũng Sĩ!"
                },
                {
                    "name": "Địa Chấn Diệt Tuyệt",
                    "effect": "boss_slam",
                    "damage": 200,
                    "message": "dậm sàn đấu cuồng nộ đánh bay Dũng Sĩ!"
                }
            ]
            import random
            if skill_index is not None and 0 <= skill_index < len(skills):
                skill = skills[skill_index]
            else:
                skill = random.choice(skills)

            actual_dmg = self.player.take_damage(skill["damage"])
            self.last_boss_attack_time = time.time()
            return skill, actual_dmg

    def heal_player(self, amount=150, nickname="Dũng sĩ"):
        """Hồi máu cho người chơi."""
        with self.lock:
            actual = self.player.heal(amount)
            return actual

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
            if not self.auto_heal_enabled or self.boss.is_dead or self.boss.is_poisoned:
                return 0, False
            now = time.time()
            # Độc cũng tính là đang giao tranh: chờ đủ idle_heal_delay sau tick độc cuối mới hồi máu
            idle_seconds = now - max(self.last_interaction_time, self.boss.last_poison_activity)
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

            trigger_rage = False
            if self.boss.rage >= 100 and not self.rage_warning_active and not self.boss.is_dead and not self.player.is_dead:
                self.start_rage_warning(duration=5.0)
                trigger_rage = True

            event_data = {
                "user_id": user_id,
                "nickname": nickname,
                "avatar": avatar,
                "skill": skill_name,
                "damage": actual_damage,
                "raw_damage": raw_damage,
                "is_crit": is_crit,
                "action_type": action_type,
                "boss_dead": self.boss.is_dead,
                "trigger_rage_warning": trigger_rage,
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
            rage_warning_remaining = max(0, int(self.rage_warning_end_time - time.time())) if self.rage_warning_active else 0
            return {
                "boss": self.boss.to_dict(),
                "player": self.player.to_dict(),
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
                "base_start_hp": self.base_start_hp,
                "boss_auto_attack_enabled": self.boss_auto_attack_enabled,
                "boss_attack_interval": self.boss_attack_interval,
                "rage_warning_active": self.rage_warning_active,
                "rage_warning_remaining": rage_warning_remaining,
                "player_shielded": self.player_shielded,
                "player_shield_by": self.player_shield_by
            }
