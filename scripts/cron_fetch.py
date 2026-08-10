# 定时趋势采样（GitHub Actions cron 调用）
# 源站 api.huaxu.app 在 Cloudflare 后面对数据中心 IP 返回 403 挑战页，
# 用 curl_cffi 模拟 Chrome TLS 指纹绕过；拉取 16 难度榜单 → 上传 /api/trends 入库
import json
import sys

from curl_cffi import requests as cffi

BASE = 'https://api.huaxu.app/servers/cn/warzone'
UPLOAD = 'https://jiatenghui.icu/api/trends'
DIFFS = [str(i) for i in range(1, 17)]


def main():
    ok = 0
    for d in DIFFS:
        try:
            r = cffi.get(f'{BASE}/current/{d}', impersonate='chrome', timeout=30)
            if r.status_code != 200:
                print(f'd{d} http {r.status_code}')
                continue
            payload = r.json()
        except Exception as e:
            print(f'd{d} fetch fail: {e}')
            continue
        if payload.get('status') != 'success':
            print(f'd{d} bad status')
            continue
        data = payload.get('data') or {}
        warzone = data.get('warzone') or {}
        week = warzone.get('activity')
        if not week:
            print(f'd{d} no week')
            continue
        samples = []
        for rank in (data.get('rankings') or []):
            pid = str((rank.get('player') or {}).get('id') or '')
            if not pid.isdigit():
                continue
            zones = [(z or {}).get('score') or 0 for z in (rank.get('zones') or [])][:3]
            total = rank.get('score') or 0
            if len(zones) != 3:
                continue
            samples.append({
                'playerId': pid,
                'name': (rank.get('player') or {}).get('name') or '',
                'zones': zones,
                'total': total
            })
        if not samples:
            print(f'd{d} no samples')
            continue
        try:
            r2 = cffi.post(UPLOAD, json={'week': week, 'difficulty': d, 'samples': samples}, impersonate='chrome', timeout=30)
            print(f'd{d}: {r2.status_code} {r2.text[:120]}')
            if r2.status_code == 200:
                ok += 1
        except Exception as e:
            print(f'd{d} upload fail: {e}')
    print(f'done, {ok}/{len(DIFFS)} difficulties uploaded')
    sys.exit(0 if ok > 0 else 1)


if __name__ == '__main__':
    main()
