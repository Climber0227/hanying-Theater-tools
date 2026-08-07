import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

// 更新日志（从 git 历史整理）
const CHANGELOG = [
    {
        date: '2026-08-08',
        items: [
            '趋势图全面重绘：三区合并为今日/本周两张图（不同颜色折线），SVG 自绘平滑曲线 + 入场动画 + 常驻跟随数据卡片',
            '趋势数据后端化：被动采样上传 + 服务端曲线查询，所有用户共享趋势；数据只保留当周',
            '历史战绩增强：周范围下拉选择、段位自动识别（利用段位每周仅 ±1 波动的机制做链式邻域搜索）',
            '历史战绩单次查询上限 20 周，降低对源站请求量',
            '请求优化：60 秒内存缓存层（切难度/周/页面不重复请求）+ 玩家查询竞态修复',
            '页面与弹窗懒加载（代码分割），首屏只加载排行榜核心',
            '导航栏补回建站时长（每秒更新）/ 访问计数 / 数据来源'
        ]
    },
    {
        date: '2026-08-05',
        items: [
            '战区卡片显示机制名（困兽犹斗/祸不单行/斗众之势）与混合区增益',
            '趋势图 shadcn 风格 Chart Tooltip'
        ]
    },
    {
        date: '2026-08-04',
        items: [
            '黑白灰主题重构，新增阵容排行与玩家趋势曲线功能',
            '阵容排行玩家行内渲染角色头像、名字、分别战力',
            'React 重构启动：M1 骨架 → M2 排行榜虚拟滚动 → M3 弹窗迁移 → M4 页面迁移 → M5 Electron/Vercel 适配',
            '排行榜滚动性能优化'
        ]
    },
    {
        date: '2026-07-24',
        items: [
            '手机端适配：响应式布局、触控友好 UI、排行榜筛选完整保留',
            '修复分数列挤压，全局横滚 + min-width'
        ]
    },
    {
        date: '2026-06-29',
        items: [
            'API 改为浏览器直连，解决 Cloudflare Bot 防护导致的 403'
        ]
    },
    {
        date: '2026-05-05',
        items: [
            '修复排行榜排序错乱问题'
        ]
    },
    {
        date: '2026-05-04',
        items: [
            '项目立项：含英牌战区数据工具',
            '创建基础结构（HTML/CSS/JS），实现排行榜、玩家查询、难度选择、历史战区导航',
            '黑白深浅色配色方案',
            'Vercel 部署支持 + 用户登录系统（Supabase 云端同步）',
            '添加模拟浏览器请求头防止 API 封禁'
        ]
    }
];

// 滚动驱动时间线（Aceternity Timeline 风格）
function Timeline({ data }) {
    const ref = useRef(null);
    const containerRef = useRef(null);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        if (ref.current) {
            setHeight(ref.current.getBoundingClientRect().height);
        }
    }, []);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start 10%', 'end 50%']
    });
    const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
    const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

    return (
        <div className="tl" ref={containerRef}>
            <div className="tl-header">
                <h2 className="tl-h2">更新日志</h2>
                <p className="tl-sub">含英牌战区数据工具 · 从立项到现在的全部更新</p>
            </div>

            <div ref={ref} className="tl-body">
                {data.map((item, index) => (
                    <div key={index} className="tl-row">
                        <div className="tl-sticky">
                            <div className="tl-dot-wrap">
                                <div className="tl-dot" />
                            </div>
                            <h3 className="tl-title">{item.date}</h3>
                        </div>
                        <div className="tl-content">
                            <h3 className="tl-title-mobile">{item.date}</h3>
                            <ul className="changelog-items">
                                {item.items.map((it, i) => (
                                    <li key={i}>{it}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}

                {/* 进度线 */}
                <div
                    className="tl-line"
                    style={{ height: height + 'px' }}
                >
                    <motion.div
                        className="tl-line-fill"
                        style={{ height: heightTransform, opacity: opacityTransform }}
                    />
                </div>
            </div>
        </div>
    );
}

// 更新日志页
export default function ChangelogPage() {
    return <Timeline data={CHANGELOG} />;
}
