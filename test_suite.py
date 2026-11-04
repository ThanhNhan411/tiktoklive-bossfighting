# -*- coding: utf-8 -*-
import time
from app import app, game_state

def test():
    client = app.test_client()

    # 1. Test routes GET
    r_game = client.get('/game')
    assert r_game.status_code == 200, f"Error /game: {r_game.status_code}"

    r_admin = client.get('/admin')
    assert r_admin.status_code == 200, f"Error /admin: {r_admin.status_code}"

    r_status = client.get('/api/status')
    assert r_status.status_code == 200, f"Error /api/status: {r_status.status_code}"
    data = r_status.get_json()
    print("Initial Boss:", data["game_snapshot"]["boss"]["name"], "-", data["game_snapshot"]["boss"]["current_hp"], "HP")

    # 2. Test simulate comment "chem"
    r_sim_chem = client.post('/api/simulate', json={'type': 'comment', 'text': 'chem', 'username': 'GamerHero'})
    assert r_sim_chem.status_code == 200

    # 3. Test 12 Bosses luân chuyển & Máu tăng dần theo cấp số nhân
    print("\n--- TEST 12 BOSSES LUÂN CHUYỂN & MÁU TĂNG THEO LEVEL ---")
    game_state.level = 0
    prev_hp = 0
    for i in range(1, 13):
        boss_data = game_state.next_boss()
        print(f"Ải {i}: {boss_data['name']} ({boss_data['boss_type']}) - {boss_data['max_hp']:,} HP")
        assert boss_data['max_hp'] >= prev_hp, f"Level {i} HP must be greater than previous!"
        prev_hp = boss_data['max_hp']

    # 4. Test cấu hình máu /api/config/hp
    r_hp = client.post('/api/config/hp', json={'base_hp': 60000, 'growth_rate': 1.40})
    assert r_hp.status_code == 200
    print("New Config Boss HP:", r_hp.get_json()['boss']['max_hp'])

    # 5. Test Dũng Sĩ Người Chơi & Hồi Sinh
    print("\n--- TEST DŨNG SĨ, HỒI SINH & PHẢN CÔNG ---")
    r_p_cfg = client.post('/api/config/player', json={'max_hp': 1500, 'revive_hearts': 40, 'auto_attack': True, 'attack_interval': 10})
    assert r_p_cfg.status_code == 200
    p_data = r_p_cfg.get_json()['player']
    assert p_data['max_hp'] == 1500
    assert p_data['revive_hearts_required'] == 40
    print(f"Cấu hình Dũng Sĩ: Max HP = {p_data['max_hp']}, Tim hồi sinh = {p_data['revive_hearts_required']}")

    # Test simulate chat "heal" (hồi máu)
    r_heal = client.post('/api/simulate', json={'type': 'comment', 'text': 'heal', 'username': 'Healer_Priest'})
    assert r_heal.status_code == 200

    # Test simulate chat "doc" (độc tố)
    r_poison = client.post('/api/simulate', json={'type': 'comment', 'text': 'doc', 'username': 'Toxic_Mage'})
    assert r_poison.status_code == 200

    # Test Boss phản công Dũng Sĩ
    r_boss_atk = client.post('/api/boss/attack_player', json={'skill_index': 0})
    assert r_boss_atk.status_code == 200
    print(f"Boss đánh Dũng Sĩ: {r_boss_atk.get_json()['skill']['name']} - Sát thương: {r_boss_atk.get_json()['damage']}")

    # Test Dũng Sĩ chết & Thả tim hồi sinh
    client.post('/api/player/damage', json={'damage': 99999})
    assert game_state.player.is_dead == True
    print("Dũng Sĩ đã gục ngã (is_dead = True)")

    # Thả 20 tim
    r_heart = client.post('/api/player/add_heart', json={'count': 20})
    assert r_heart.get_json()['revived'] == False
    assert r_heart.get_json()['player']['revive_hearts_count'] == 20

    # Thả thêm 20 tim -> Đủ 40 tim -> HỒI SINH!
    r_revive = client.post('/api/player/add_heart', json={'count': 20})
    assert r_revive.get_json()['revived'] == True
    assert r_revive.get_json()['player']['is_dead'] == False
    print("Dũng Sĩ đã HỒI SINH thành công với 100% máu!")

    print("\nALL TESTS PASSED SUCCESSFULLY! 100% HOÀN HẢO!")

if __name__ == '__main__':
    test()
