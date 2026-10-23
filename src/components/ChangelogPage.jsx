import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { CHANGELOG } from '../data/changelog.js';

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
