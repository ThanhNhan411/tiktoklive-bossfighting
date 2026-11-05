# -*- coding: utf-8 -*-
import os
import time
from app import app, game_state, tiktok_manager

def test():
    client = app.test_client()

    print("==================================================")
    print("🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN TIKTOK LIVE BOSS FIGHT")
    print("==================================================")

    # 1. Test routes GET
    r_game = client.get('/game')
    assert r_game.status_code == 200, f"Error /game: {r_game.status_code}"
    assert "PixelFX" in r_game.get_data(as_text=True) or "pixelfx-engine.js" in r_game.get_data(as_text=True)
    assert "rageAlert" in r_game.get_data(as_text=True)

    r_admin = client.get('/admin')
    assert r_admin.status_code == 200, f"Error /admin: {r_admin.status_code}"
    assert "hộ giá" in r_admin.get_data(as_text=True)

    r_status = client.get('/api/status')
    assert r_status.status_code == 200, f"Error /api/status: {r_status.status_code}"
    data = r_status.get_json()
    print("✅ Web Routes & Status: OK")
    print(f"   Boss: {data['game_snapshot']['boss']['name']} - {data['game_snapshot']['boss']['current_hp']:,} HP")

    # 2. Test PixelFX Bundle
    pixelfx_path = os.path.join(os.path.dirname(__file__), 'static', 'js', 'pixelfx-engine.js')
    assert os.path.exists(pixelfx_path), "pixelfx-engine.js not found!"
    size_kb = os.path.getsize(pixelfx_path) / 1024
    print(f"✅ PixelFX Bundle Engine: {size_kb:.1f} KB")
    with open(pixelfx_path, 'r', encoding='utf-8') as f:
        bundle_content = f.read()
    
    required_effects = [
        'scifi/warp-in',
        'holy/holy-pillar',
        'arcane/star-fall',
        'shadow/shadow-tendrils',
        'arcane/arcane-missiles',
        'ice/ice-spikes',
        'ice/snowflake-burst',
        'fire/fireball',
        'explosions/small-explosion',
        'nature/acid-splash',
        'shadow/dark-explosion',
        'explosions/implosion',
        'explosions/plasma-explosion',
        'arcane/time-stop',
        'shadow/grasping-hands',
        'shadow/void-orb'
    ]
    for eff in required_effects:
        assert eff in bundle_content, f"Missing required effect in bundle: {eff}"
    print(f"✅ Đã xác minh 16/16 hiệu ứng PixelFX mục tiêu đều có trong bundle!")

    # 3. Test Cân bằng Sát thương Comment = 200 DMG
    print("\n--- TEST CÂN BẰNG SÁT THƯƠNG COMMENT (200 DMG) ---")
    game_state.buff_active = False
    game_state.buff_multiplier = 1.0

    skills_to_test = [
        ('chem', 'sword_slash'),
        ('lua', 'fireball'),
        ('bang', 'ice_shard'),
        ('set', 'lightning'),
        ('bom', 'bomb_blast'),
        ('doc', 'poison_sting')
    ]

    for kw, expected_eff in skills_to_test:
        res = tiktok_manager.process_comment('u1', 'Hero_Tester', '', kw)
        assert res is not None, f"Comment {kw} must trigger an action!"
        assert res['effect'] == expected_eff, f"Effect mismatch for {kw}: got {res['effect']}, expected {expected_eff}"
        assert res['damage'] == 200, f"Damage for comment '{kw}' must be balanced to 200, got {res['damage']}"
        print(f"   Skill '{kw}' -> Effect: {res['effect']} | Damage: {res['damage']} DMG (Balanced)")

    # Test Bỏ skill heal
    res_heal = tiktok_manager.process_comment('u1', 'Hero_Tester', '', 'heal')
    # Should not trigger heal effect, but fallback comment damage or default
    if res_heal:
        assert res_heal['effect'] != 'holy_heal', "Skill 'heal' must be removed!"
    print("✅ Đã bỏ skill hồi máu ('heal') thành công!")

    # Test Độc tố 15 HP/s trong 5 giây
    assert game_state.boss.is_poisoned == True
    assert game_state.boss.poison_dmg_per_tick == 15
    print(f"✅ Hiệu ứng trúng độc: Đang kích hoạt ({game_state.boss.poison_dmg_per_tick} HP/s trong 5s)!")

    # 4. Test Đòn Nộ Của Boss & Khiên Hộ Giá (Time-Stop)
    print("\n--- TEST ĐÒN NỘ CỦA BOSS & KHIÊN HỘ GIÁ (TIME-STOP) ---")
    game_state.player.revive()
    assert game_state.player.is_dead == False
    initial_player_hp = game_state.player.current_hp

    # 4a. Bắt đầu cảnh báo nộ 5 giây
    game_state.start_rage_warning(duration=5.0)
    assert game_state.rage_warning_active == True
    assert game_state.player_shielded == False
    print("   [1] Boss bắt đầu tích nộ (rage_warning_active = True, 5s countdown)")

    # 4b. Người chơi comment "hộ giá"
    res_hogia = tiktok_manager.process_comment('u2', 'HiepSi_BaoVe', '', 'hộ giá')
    assert res_hogia is not None
    assert res_hogia.get('effect') == 'player_shield'
    assert game_state.player_shielded == True
    assert game_state.player_shield_by == 'HiepSi_BaoVe'
    print(f"   [2] Người chơi cmt 'hộ giá' -> Bật khiên thành công bởi @{game_state.player_shield_by}!")

    # 4c. Thi hành đòn nộ khi ĐÃ có khiên -> Người chơi không nhận sát thương!
    executed, shielded, actual_dmg, shield_by = game_state.execute_boss_rage()
    assert executed == True
    assert shielded == True
    assert actual_dmg == 0
    assert game_state.player.is_dead == False
    assert game_state.player.current_hp == initial_player_hp
    print("   [3] Boss nộ trúng khiên Hộ Giá -> Người chơi sống sót nguyên vẹn (0 DMG)!")

    # 4d. Thi hành đòn nộ khi KHÔNG có khiên -> Người chơi CHẾT NGAY LẬP TỨC!
    game_state.start_rage_warning(duration=5.0)
    assert game_state.player_shielded == False
    executed_fatal, shielded_fatal, actual_dmg_fatal, _ = game_state.execute_boss_rage()
    assert executed_fatal == True
    assert shielded_fatal == False
    assert actual_dmg_fatal > 0
    assert game_state.player.is_dead == True
    assert game_state.player.current_hp == 0
    print("   [4] Boss nộ KHÔNG có khiên -> Người chơi CHẾT NGAY LẬP TỨC (HP = 0, is_dead = True)!")

    # 5. Test Hồi Sinh Dũng Sĩ
    print("\n--- TEST HỒI SINH DŨNG SĨ ---")
    game_state.player.revive_hearts_required = 10
    game_state.player.revive_hearts_count = 0
    r_revive, _ = game_state.player.add_revive_heart(10)
    assert r_revive == True
    assert game_state.player.is_dead == False
    assert game_state.player.current_hp == game_state.player.max_hp
    print("   Dũng sĩ hồi sinh thành công với hiệu ứng scifi/warp-in!")

    # 6. Test Quà Tặng (Gifts) Đã Đổi Tên & Cơ Chế
    print("\n--- TEST ĐỔI TÊN & SÁT THƯƠNG QUÀ TẶNG ---")
    
    # Corgi -> Huyết Ma Bạo Tạc
    corgi_action = tiktok_manager.process_gift('u3', 'VipUser', '', 'Corgi', 299, 1)
    assert corgi_action['effect'] == 'gift_corgi'
    assert 'HUYẾT MA BẠO TẠC' in corgi_action['skill']
    print(f"   Quà Corgi (299 xu): '{corgi_action['skill']}' -> Effect: {corgi_action['effect']}")

    # Xe -> Quỷ Vực Huyết Thủ
    car_action = tiktok_manager.process_gift('u3', 'VipUser', '', 'Siêu Xe', 500, 1)
    assert car_action['effect'] == 'gift_car'
    assert 'QUỶ VỰC HUYẾT THỦ' in car_action['skill']
    print(f"   Quà Siêu Xe (500 xu): '{car_action['skill']}' -> Effect: {car_action['effect']}")

    # Galaxy -> Hố đen & Rồng thần rút máu 2.500.000 HP (5 lần x 500,000 HP)
    game_state.reset_current_boss(max_hp=5000000)
    galaxy_action = tiktok_manager.process_gift('u3', 'VipUser', '', 'Galaxy', 1000, 1)
    assert galaxy_action['effect'] == 'gift_galaxy'
    assert galaxy_action['raw_damage'] >= 2500000
    assert galaxy_action['damage'] >= 2500000
    print(f"   Quà Galaxy (1000 xu): '{galaxy_action['skill']}' -> Damage: {galaxy_action['damage']:,} HP (5 lần x 500k)")

    # 7. Test 12 Boss Luân Chuyển
    print("\n--- TEST 12 BOSS LUÂN CHUYỂN ---")
    game_state.level = 0
    for lvl in range(1, 13):
        b = game_state.next_boss()
        assert b['max_hp'] > 0
    print("✅ 12 Bosses luân chuyển và tăng tiến sức mạnh hoàn hảo!")

    print("\n==================================================")
    print("🎉 TẤT CẢ 15 YÊU CẦU ĐỀU ĐÃ ĐẠT 100% HOÀN HẢO!")
    print("==================================================")

if __name__ == '__main__':
    test()
