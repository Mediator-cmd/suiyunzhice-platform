import React from 'react';

/**
 * 错误边界 —— 演示现场白屏是灾难性的
 *
 * 任何一个板块抛异常时，只让该板块降级为「暂时不可用」，
 * 侧边栏与其它板块照常工作，用户可以切走。
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[panel-error]', this.props.label || '', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)' }}>
          {this.props.label || '该板块'}暂时不可用
        </h3>
        <div className="xs mute" style={{ marginBottom: 12 }}>
          {String(this.state.error?.message || this.state.error)}
        </div>
        <button className="btn" onClick={() => this.setState({ error: null })}>
          重试
        </button>
      </div>
    );
  }
}
