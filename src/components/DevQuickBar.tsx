import React, { useState } from 'react';
import { FlaskConical, MessageSquare, ClipboardCheck, BarChart3, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface DevQuickBarProps {
  currentPhase: 'chat' | 'survey' | 'result';
  onSkipToChat: () => void;
  onSkipToSurvey: () => void;
  onSkipToResult: () => void;
  onReset: () => void;
}

export const DevQuickBar: React.FC<DevQuickBarProps> = ({
  currentPhase,
  onSkipToChat,
  onSkipToSurvey,
  onSkipToResult,
  onReset
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <div
      style={{
        position: 'fixed',
        top: '58px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'calc(100% - 24px)',
        maxWidth: '520px',
        pointerEvents: 'auto'
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
          padding: isExpanded ? '8px 12px' : '6px 12px',
          transition: 'all 0.2s ease-in-out',
          color: '#ffffff',
          fontSize: '0.8rem'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <div
            onClick={() => setIsExpanded(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              userSelect: 'none',
              fontWeight: 700,
              fontSize: '0.75rem',
              color: '#93c5fd'
            }}
          >
            <FlaskConical size={14} className="text-blue-400" />
            <span>動作確認ツール</span>
            <span
              style={{
                fontSize: '0.65rem',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                padding: '1px 6px',
                borderRadius: '9999px',
                border: '1px solid rgba(96, 165, 250, 0.3)'
              }}
            >
              DEV
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {!isExpanded && (
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                現在: {currentPhase === 'chat' ? '対話' : currentPhase === 'survey' ? '質問紙' : '結果'}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(prev => !prev)}
              aria-label={isExpanded ? '折りたたむ' : '展開する'}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={onSkipToChat}
              style={{
                flex: '1 1 auto',
                minWidth: '80px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                padding: '6px 10px',
                fontSize: '0.74rem',
                fontWeight: currentPhase === 'chat' ? 700 : 500,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentPhase === 'chat' ? '#2563eb' : 'rgba(255, 255, 255, 0.08)',
                color: currentPhase === 'chat' ? '#ffffff' : '#e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <MessageSquare size={13} />
              <span>チャット</span>
            </button>

            <button
              type="button"
              onClick={onSkipToSurvey}
              style={{
                flex: '1.2 1 auto',
                minWidth: '110px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                padding: '6px 10px',
                fontSize: '0.74rem',
                fontWeight: currentPhase === 'survey' ? 700 : 500,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentPhase === 'survey' ? '#2563eb' : 'rgba(255, 255, 255, 0.08)',
                color: currentPhase === 'survey' ? '#ffffff' : '#e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <ClipboardCheck size={13} />
              <span>質問紙へスキップ</span>
            </button>

            <button
              type="button"
              onClick={onSkipToResult}
              style={{
                flex: '1.2 1 auto',
                minWidth: '110px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                padding: '6px 10px',
                fontSize: '0.74rem',
                fontWeight: currentPhase === 'result' ? 700 : 500,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentPhase === 'result' ? '#2563eb' : 'rgba(255, 255, 255, 0.08)',
                color: currentPhase === 'result' ? '#ffffff' : '#e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <BarChart3 size={13} />
              <span>結果画面へスキップ</span>
            </button>

            <button
              type="button"
              onClick={onReset}
              title="初期状態にリセット"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px 8px',
                fontSize: '0.72rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(239, 68, 68, 0.18)',
                color: '#fca5a5',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={12} />
              <span>リセット</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
