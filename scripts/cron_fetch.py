# 定时趋势采样（GitHub Actions cron 调用）
# 源站 api.huaxu.app 在 Cloudflare 后面对数据中心 IP 返回 403 挑战页，
# 用 curl_cffi 模拟 Chrome TLS 指纹绕过；拉取 16 难度榜单 → 上传 /api/trends 入库
import json
import os
import sys
from datetime import datetime, timezone

from curl_cffi import requests as cffi

BASE = 'https://api.huaxu.app/servers/cn/warzone'
UPLOAD = 'https://jiatenghui.icu/api/trends'
DIFFS = [str(i) for i in range(1, 17)]

# 与 Vercel 环境变量 CRON_SECRET 一致（GitHub Actions secret 注入），
# /api/trends 仅对携带该头的请求开放删除清理（防未鉴权清库）
CRON_SECRET = os.environ.get('CRON_SECRET', '')
CRON_HEADERS = {'x-cron-secret': CRON_SECRET} if CRON_SECRET else {}


def aligned_sampled_at():
    """对齐到 5 分钟窗口的 UTC ISO 时间：同一窗口内 cron 重试/重复运行产生相同 sampled_at，
    配合唯一约束 (week, sampled_at, player_id, difficulty) 幂等去重，避免重试堆积重复数据"""
    ts = int(datetime.now(timezone.utc).timestamp())
    ts = ts - (ts % 300)
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')


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
            r2 = cffi.post(
                UPLOAD,
                json={'week': week, 'difficulty': d, 'samples': samples, 'sampled_at': aligned_sampled_at()},
                headers=CRON_HEADERS,
                impersonate='chrome',
                timeout=30
            )
            print(f'd{d}: {r2.status_code} {r2.text[:120]}')
            if r2.status_code == 200:
                ok += 1
        except Exception as e:
            print(f'd{d} upload fail: {e}')
    print(f'done, {ok}/{len(DIFFS)} difficulties uploaded')
    sys.exit(0 if ok > 0 else 1)


if __name__ == '__main__':
    main()
