import React from 'react';
import { RotateCcw } from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
  phase: 'chat' | 'survey' | 'result';
}

export const Header: React.FC<HeaderProps> = ({ onReset }) => {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-brand">
          <span className="brand-logo">LLM5</span>
          <span className="brand-tagline">AI性格対話診断</span>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="btn-header-reset"
          title="診断を最初からやり直す"
          aria-label="診断を最初からに戻る"
        >
          <RotateCcw size={13} />
          <span>最初からに戻る</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
