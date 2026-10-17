import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
        bottom: '12px',
        right: '12px',
        zIndex: 9999,
        maxWidth: '360px',
        pointerEvents: 'auto'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #b8c2cc',
          borderTop: '3px solid #1b365d',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
          padding: isExpanded ? '8px 10px' : '5px 10px',
          color: '#1b2432',
          fontSize: '0.75rem'
        }}
      >
        <div
          onClick={() => setIsExpanded(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            cursor: 'pointer',
            userSelect: 'none',
            fontWeight: 600,
            color: '#1b365d'
          }}
        >
          <span>プレビュー切替 ({currentPhase === 'chat' ? '対話' : currentPhase === 'survey' ? '質問紙' : '結果'})</span>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>

        {isExpanded && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginTop: '8px',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={onSkipToChat}
              style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: currentPhase === 'chat' ? 700 : 500,
                borderRadius: '3px',
                border: '1px solid #b8c2cc',
                backgroundColor: currentPhase === 'chat' ? '#007ac0' : '#f7f9fa',
                color: currentPhase === 'chat' ? '#ffffff' : '#333e4f',
                cursor: 'pointer'
              }}
            >
              1. 対話
            </button>

            <button
              type="button"
              onClick={onSkipToSurvey}
              style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: currentPhase === 'survey' ? 700 : 500,
                borderRadius: '3px',
                border: '1px solid #b8c2cc',
                backgroundColor: currentPhase === 'survey' ? '#007ac0' : '#f7f9fa',
                color: currentPhase === 'survey' ? '#ffffff' : '#333e4f',
                cursor: 'pointer'
              }}
            >
              2. 質問紙
            </button>

            <button
              type="button"
              onClick={onSkipToResult}
              style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: currentPhase === 'result' ? 700 : 500,
                borderRadius: '3px',
                border: '1px solid #b8c2cc',
                backgroundColor: currentPhase === 'result' ? '#007ac0' : '#f7f9fa',
                color: currentPhase === 'result' ? '#ffffff' : '#333e4f',
                cursor: 'pointer'
              }}
            >
              3. 結果レポート
            </button>

            <button
              type="button"
              onClick={onReset}
              style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                borderRadius: '3px',
                border: '1px solid #d93025',
                backgroundColor: '#ffffff',
                color: '#d93025',
                cursor: 'pointer'
              }}
            >
              初期化
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
