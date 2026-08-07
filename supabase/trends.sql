-- 趋势曲线采样表（前端被动上传）
-- 在 Supabase 控制台 → SQL Editor 执行一次即可

create table if not exists wz_curve_samples (
  id bigint generated always as identity primary key,
  week int not null,
  sampled_at timestamptz not null,
  difficulty text not null default '16',
  player_id text not null,
  player_name text,
  zones jsonb not null,   -- 三区分数 [z1, z2, z3]（分开存储）
  total bigint,           -- 总分（后续总分趋势图直接用）
  created_at timestamptz default now(),
  unique (week, sampled_at, player_id, difficulty)
);

alter table wz_curve_samples enable row level security;
create policy "public read" on wz_curve_samples for select using (true);

-- 查询索引：按 玩家+段位+周 取曲线
create index if not exists wz_curve_player_idx
  on wz_curve_samples (player_id, difficulty, week, sampled_at);
