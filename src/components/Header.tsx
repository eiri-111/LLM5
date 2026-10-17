import React from 'react';
import { RotateCcw } from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
  phase: 'chat' | 'survey' | 'result';
}

export const Header: React.FC<HeaderProps> = ({ onReset, phase }) => {
  const phaseLabel =
    phase === 'chat'
      ? 'セクション 1/2 : AI対話セッション'
      : phase === 'survey'
      ? 'セクション 2/2 : 標準心理尺度質問紙 (BFI-2-S)'
      : '分析・照合レポート';

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-brand">
          <span className="brand-logo">パーソナリティ評価調査 (LLM5)</span>
          <span className="brand-tagline">{phaseLabel}</span>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="btn-header-reset"
          title="調査を最初からやり直す"
          aria-label="調査を最初からやり直す"
        >
          <RotateCcw size={12} />
          <span>最初からやり直す</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
