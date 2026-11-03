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

    print("\nALL TESTS PASSED SUCCESSFULLY! 100% HOÀN HẢO!")

if __name__ == '__main__':
    test()
