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
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <div className="brand-icon-box">
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>◈</span>
          </div>
          <div>
            <h1 className="brand-title">OCEAN AI</h1>
            <span className="brand-tagline">Big Five Personality Intelligence</span>
          </div>
        </button>

        <div className="badge-powered">
          <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
          Cloudflare AI
        </div>
      </div>
    </header>
  );
};
