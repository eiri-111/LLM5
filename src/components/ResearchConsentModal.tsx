import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, User, Sparkles, Check, AlertCircle, Lock, GraduationCap, Clock } from 'lucide-react';
import { UserProfile, GenderType } from '../types';

interface ResearchConsentModalProps {
  initialProfile: UserProfile | null;
  onConsentAndSubmit: (profile: UserProfile) => void;
}

export const ResearchConsentModal: React.FC<ResearchConsentModalProps> = ({
  initialProfile,
  onConsentAndSubmit
}) => {
  const [age, setAge] = useState<string>(
    initialProfile?.age ? String(initialProfile.age) : ''
  );
  const [gender, setGender] = useState<GenderType>(
    (initialProfile?.gender as GenderType) || 'male'
  );
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAgreed) {
      setErrorMessage('研究参加への同意チェックを入れてください。');
      return;
    }

    const parsedAge = parseInt(age, 10);
    if (!age || isNaN(parsedAge) || parsedAge < 10 || parsedAge > 120) {
      setErrorMessage('正しい年齢（半角数字）を入力してください。');
      return;
    }

    const profile: UserProfile = {
      age: parsedAge,
      gender
    };

    setErrorMessage(null);
    onConsentAndSubmit(profile);
  };

  const genderOptions: { key: GenderType; label: string }[] = [
    { key: 'male', label: '男性' },
    { key: 'female', label: '女性' },
    { key: 'other', label: 'その他' },
    { key: 'prefer_not_to_say', label: '回答しない' }
  ];

  return (
    <div className="modal-backdrop">
      <div className="profile-modal-card" style={{ maxWidth: '520px', padding: '2rem 1.8rem', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            color: '#2563eb',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            marginBottom: '0.5rem'
          }}>
            <Sparkles size={13} />
            <span>LLM5 RESEARCH PROJECT</span>
          </div>
          <h2 style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            lineHeight: 1.3
          }}>
            対話型パーソナリティ診断
          </h2>
          <p style={{
            fontSize: '0.82rem',
            color: '#64748b',
            marginTop: '0.25rem'
          }}>
            生成AIと標準心理測定尺度を用いた共同研究のご案内
          </p>
        </div>

        {/* 3つの要点バッジ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          marginBottom: '1rem'
        }}>
          <div style={{
            padding: '10px 8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <Lock size={16} style={{ margin: '0 auto 4px', color: '#3b82f6' }} />
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>安全な暗号化</div>
            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>個人情報非収集</div>
          </div>
          <div style={{
            padding: '10px 8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <Clock size={16} style={{ margin: '0 auto 4px', color: '#10b981' }} />
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>中断自由</div>
            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>いつでも終了可</div>
          </div>
          <div style={{
            padding: '10px 8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <GraduationCap size={16} style={{ margin: '0 auto 4px', color: '#8b5cf6' }} />
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>学術研究</div>
            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>心理尺度検証</div>
          </div>
        </div>

        {/* 研究目的・プライバシー説明 */}
        <div style={{
          marginBottom: '1.25rem',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          overflow: 'hidden'
        }}>
          <button
            type="button"
            onClick={() => setIsDetailOpen(!isDetailOpen)}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#475569'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#3b82f6" />
              研究目的・データの取り扱いについて
            </span>
            {isDetailOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {isDetailOpen && (
            <div style={{
              padding: '12px 14px',
              fontSize: '0.75rem',
              color: '#475569',
              lineHeight: 1.6,
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0'
            }}>
              <p style={{ marginBottom: '8px' }}>
                <strong>【研究目的】</strong><br />
                本研究は、AIとの自由対話から推定されるビッグファイブ性格因子と、標準心理測定尺度（BFI-2-S）のスコアを比較し、より妥当性の高い対話型特性理解の確立を目指すものです。
              </p>
              <p style={{ marginBottom: '8px' }}>
                <strong>【データの取り扱い】</strong><br />
                対話ログおよびアンケート回答は暗号化し、安全なデータベースに保存され、学術研究（論文・統計分析）にのみ利用されます。氏名やメールアドレス等の直接的な個人情報は収集しません。
              </p>
              <p>
                <strong>【中断の権利】</strong><br />
                診断の途中いつでもブラウザを閉じて中断でき、不利益を被ることは一切ありません。
              </p>
            </div>
          )}
        </div>

        {/* 属性入力フォーム */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            padding: '14px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '10px'
            }}>
              <User size={15} color="#3b82f6" />
              <span>被験者属性（対話分析の基準値）</span>
            </div>

            {/* 年齢入力 */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                年齢 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min="10"
                  max="120"
                  placeholder="例: 21"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                />
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.8rem',
                  color: '#94a3b8'
                }}>
                  歳
                </span>
              </div>
            </div>

            {/* 性別選択 (ピル型ボタン) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                性別 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px'
              }}>
                {genderOptions.map((g) => {
                  const isSelected = gender === g.key;
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGender(g.key)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '10px',
                        border: isSelected ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                        color: isSelected ? '#1d4ed8' : '#475569',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 同意チェック */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '14px',
            backgroundColor: hasAgreed ? '#eff6ff' : '#f8fafc',
            border: hasAgreed ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
            transition: 'all 0.15s ease'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none'
            }}>
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#3b82f6',
                  cursor: 'pointer'
                }}
              />
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: hasAgreed ? '#1e40af' : '#334155',
                lineHeight: 1.4
              }}>
                上記の研究目的・データ管理に同意して参加します
              </span>
            </label>
          </div>

          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.78rem',
              borderRadius: '10px'
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 開始ボタン */}
          <button
            type="submit"
            disabled={!hasAgreed || !age}
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: '14px',
              border: 'none',
              background: hasAgreed && age ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' : '#e2e8f0',
              color: hasAgreed && age ? '#ffffff' : '#94a3b8',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: hasAgreed && age ? 'pointer' : 'not-allowed',
              boxShadow: hasAgreed && age ? '0 4px 14px rgba(59, 130, 246, 0.35)' : 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Check size={16} />
            <span>同意して対話診断をはじめる</span>
          </button>
        </form>
      </div>
    </div>
  );
};
