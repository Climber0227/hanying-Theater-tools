import React from 'react';

// 全局错误兜底：渲染异常时显示错误提示而非整页白屏，并把错误信息持久化便于排查
const ERR_KEY = 'huaxu_last_error';

export default class ErrorBoundary extends React.Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        try {
            localStorage.setItem(ERR_KEY, JSON.stringify({
                msg: String((error && error.message) || error),
                stack: (error && error.stack) || '',
                component: (info && info.componentStack || '').slice(0, 500),
                time: Date.now(),
                href: window.location.href
            }));
        } catch { /* 隐私模式忽略 */ }
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{
                    maxWidth: 460, margin: '80px auto', padding: '28px 20px',
                    textAlign: 'center', fontFamily: 'system-ui, sans-serif', background: '#fff',
                    borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
                }}>
                    <h2 style={{ margin: '0 0 12px', fontSize: 18, color: '#333' }}>页面出错了</h2>
                    <p style={{ fontSize: 12, color: '#888', wordBreak: 'break-all', lineHeight: 1.6, margin: '0 0 20px' }}>
                        {String(this.state.error.message || this.state.error)}
                    </p>
                    <button onClick={() => location.reload()} style={{
                        padding: '10px 28px', borderRadius: 8, border: 'none',
                        background: '#4f7cff', color: '#fff', fontSize: 14, cursor: 'pointer'
                    }}>
                        重新加载
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
