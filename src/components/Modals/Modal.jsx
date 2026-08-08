import React, { useRef } from 'react';

// 弹窗叠放层级：后打开的弹窗 z-index 更高（嵌套弹窗时新弹窗恒在最上层）
let modalCounter = 0;
const BASE_Z = 1000;

// 通用弹窗壳
export default function Modal({ title, sub, onClose, children, wide }) {
    const zRef = useRef(++modalCounter * 2 + BASE_Z);
    return (
        <div className="modal" style={{ zIndex: zRef.current }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={`modal-content${wide ? ' modal-wide' : ''}`}>
                <button className="modal-close" onClick={onClose}>&times;</button>
                {title && (
                    <div className="team-modal-title">
                        {title}
                        {sub && <span className="history-sub">{sub}</span>}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
