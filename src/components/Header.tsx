import React from 'react';
import { Sparkles } from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onReset }) => {
  return (
    <header className="app-header">
      <div className="header-inner">
        <button 
          onClick={onReset} 
          className="brand-link" 
          aria-label="トップに戻る"
        >
          <div className="brand-icon-box">
            <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>◈</span>
          </div>
          <div>
            <h1 className="brand-title">OCEAN AI</h1>
            <span className="brand-tagline">対話型ビッグファイブ性格分析</span>
          </div>
        </button>

        <div className="badge-clean">
          <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
          Cloudflare AI
        </div>
      </div>
    </header>
  );
};
