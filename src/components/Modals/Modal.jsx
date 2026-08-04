import React from 'react';

// 通用弹窗壳
export default function Modal({ title, sub, onClose, children, wide }) {
    return (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
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
