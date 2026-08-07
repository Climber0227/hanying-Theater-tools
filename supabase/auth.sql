-- 网站账号安全加固（Supabase 控制台 → SQL Editor 执行一次即可）

-- 1. users 表 player_id 唯一约束（防并发/竞态重复注册）
alter table users
  add constraint users_player_id_unique unique (player_id);

-- 2. 登录失败计数 + 锁定时间（连续失败 5 次锁定 15 分钟）
alter table users
  add column if not exists login_fail_count int not null default 0;
alter table users
  add column if not exists locked_until timestamptz;
