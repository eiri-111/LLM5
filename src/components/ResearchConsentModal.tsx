import React, { useState } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { UserProfile, GenderType } from '../types';

interface ResearchConsentModalProps {
  initialProfile: UserProfile | null;
  onConsentAndSubmit: (profile: UserProfile) => void;
  onSkipToSurvey?: () => void;
  onSkipToResult?: () => void;
}

export const ResearchConsentModal: React.FC<ResearchConsentModalProps> = ({
  initialProfile,
  onConsentAndSubmit,
  onSkipToSurvey,
  onSkipToResult
}) => {
  const [age, setAge] = useState<string>(
    initialProfile?.age ? String(initialProfile.age) : ''
  );
  const [gender, setGender] = useState<GenderType>(
    (initialProfile?.gender as GenderType) || 'male'
  );
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAgreed) {
      setErrorMessage('研究参加への同意項目を選択してください。');
      return;
    }

    const parsedAge = parseInt(age, 10);
    if (!age || isNaN(parsedAge) || parsedAge < 10 || parsedAge > 120) {
      setErrorMessage('正しい年齢（半角数字 10〜120）を入力してください。');
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
      <div className="profile-modal-card">
        {/* Qualtrics Top Progress Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="qualtrics-progress-row">
            <span className="qualtrics-progress-pct">0%</span>
            <div className="qualtrics-progress-track">
              <div className="qualtrics-progress-fill" style={{ width: '5%' }} />
            </div>
            <span className="qualtrics-progress-pct">100%</span>
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#5c6878', marginTop: '4px' }}>
            調査の進捗状況
          </div>
        </div>

        {/* Survey Title & Instructions */}
        <div style={{
          borderBottom: '1px solid #d8dde6',
          paddingBottom: '1.1rem',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#1b2432',
            lineHeight: 1.4
          }}>
            対話型パーソナリティ評価に関する調査研究
          </h2>
          <p style={{
            fontSize: '0.86rem',
            color: '#333e4f',
            marginTop: '0.5rem',
            lineHeight: 1.65
          }}>
            本調査へのご協力ありがとうございます。回答を開始する前に、以下の研究概要およびデータの取り扱いについてご確認のうえ、基本属性と同意項目にご回答ください。
          </p>
        </div>

        {/* Research Information Block (Qualtrics Descriptive Text Block) */}
        <div style={{
          marginBottom: '1.75rem',
          backgroundColor: '#f7f9fa',
          border: '1px solid #d8dde6',
          borderLeft: '4px solid #007ac0',
          borderRadius: '4px',
          padding: '1rem 1.15rem',
          fontSize: '0.83rem',
          color: '#333e4f',
          lineHeight: 1.65
        }}>
          <div style={{ marginBottom: '0.65rem' }}>
            <strong style={{ color: '#1b2432' }}>1. 研究目的</strong><br />
            本調査は、AIとの自然言語対話から推定されるビッグファイブ性格特性と、標準心理測定尺度（BFI-2-S）の測定値を比較・検証することを目的としています。
          </div>
          <div style={{ marginBottom: '0.65rem' }}>
            <strong style={{ color: '#1b2432' }}>2. データの管理と匿名性</strong><br />
            回答データおよび対話記録は統計的に処理され、学術研究目的にのみ使用されます。氏名・連絡先等の個人を特定できる情報は収集いたしません。
          </div>
          <div>
            <strong style={{ color: '#1b2432' }}>3. 参加の任意性と中断の権利</strong><br />
            本調査への参加は任意であり、回答の途中であってもブラウザを閉じることでいつでも中断することができます。中断による不利益は一切生じません。
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Question 1: Age */}
          <div style={{
            paddingBottom: '1.5rem',
            borderBottom: '1px solid #e5e8ec'
          }}>
            <label
              htmlFor="consent-age-input"
              style={{
                display: 'block',
                fontSize: '0.94rem',
                fontWeight: 600,
                color: '#1b2432',
                marginBottom: '0.6rem'
              }}
            >
              Q1. あなたの現在の年齢を半角数字で入力してください。 <span style={{ color: '#d93025' }}>*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '200px' }}>
              <input
                id="consent-age-input"
                type="number"
                min="10"
                max="120"
                placeholder="例: 21"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                className="form-input"
              />
              <span style={{ fontSize: '0.88rem', color: '#333e4f', whiteSpace: 'nowrap' }}>歳</span>
            </div>
          </div>

          {/* Question 2: Gender (Qualtrics Single-Select Radio List) */}
          <div style={{
            paddingBottom: '1.5rem',
            borderBottom: '1px solid #e5e8ec'
          }}>
            <div style={{
              fontSize: '0.94rem',
              fontWeight: 600,
              color: '#1b2432',
              marginBottom: '0.65rem'
            }}>
              Q2. あなたの性別を選択してください。 <span style={{ color: '#d93025' }}>*</span>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
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
                      width: '100%',
                      padding: '0.7rem 0.9rem',
                      borderRadius: '4px',
                      border: isSelected ? '1px solid #007ac0' : '1px solid #d8dde6',
                      backgroundColor: isSelected ? '#e8f3fa' : '#f7f9fa',
                      color: '#1b2432',
                      fontSize: '0.88rem',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      textAlign: 'left',
                      transition: 'background-color 0.12s ease, border-color 0.12s ease'
                    }}
                  >
                    <span style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: isSelected ? '5px solid #007ac0' : '1.5px solid #8c98a8',
                      backgroundColor: '#ffffff',
                      flexShrink: 0,
                      boxSizing: 'border-box'
                    }} />
                    <span>{g.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 3: Informed Consent */}
          <div style={{
            paddingBottom: '1.25rem',
            borderBottom: '1px solid #e5e8ec'
          }}>
            <div style={{
              fontSize: '0.94rem',
              fontWeight: 600,
              color: '#1b2432',
              marginBottom: '0.65rem'
            }}>
              Q3. 研究参加への同意確認 <span style={{ color: '#d93025' }}>*</span>
            </div>
            <button
              type="button"
              onClick={() => setHasAgreed(!hasAgreed)}
              style={{
                width: '100%',
                padding: '0.8rem 0.95rem',
                borderRadius: '4px',
                border: hasAgreed ? '1px solid #007ac0' : '1px solid #d8dde6',
                backgroundColor: hasAgreed ? '#e8f3fa' : '#f7f9fa',
                color: '#1b2432',
                fontSize: '0.88rem',
                fontWeight: hasAgreed ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textAlign: 'left',
                transition: 'background-color 0.12s ease, border-color 0.12s ease'
              }}
            >
              <span style={{
                width: '18px',
                height: '18px',
                borderRadius: '3px',
                border: hasAgreed ? '1.5px solid #007ac0' : '1.5px solid #8c98a8',
                backgroundColor: hasAgreed ? '#007ac0' : '#ffffff',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                flexShrink: 0
              }}>
                {hasAgreed ? '✓' : ''}
              </span>
              <span>上記の研究目的・データの取り扱いを理解し、調査への参加に同意します。</span>
            </button>
          </div>

          {errorMessage && (
            <div className="profile-form-error">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Qualtrics Next Button Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '0.25rem'
          }}>
            <button
              type="submit"
              disabled={!hasAgreed || !age}
              className="qualtrics-nav-btn"
              title="次へ進む"
            >
              <span>次へ</span>
              <ArrowRight size={17} />
            </button>
          </div>

          {/* 動作確認用スキップ */}
          {(onSkipToSurvey || onSkipToResult) && (
            <div style={{
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px dashed #d8dde6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <span style={{ fontSize: '0.74rem', color: '#5c6878', fontWeight: 600 }}>
                管理者・動作確認用ショートカット:
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {onSkipToSurvey && (
                  <button
                    type="button"
                    onClick={onSkipToSurvey}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: '#007ac0',
                      backgroundColor: '#ffffff',
                      border: '1px solid #b6d8f2',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    質問紙(BFI-2-S)へスキップ
                  </button>
                )}
                {onSkipToResult && (
                  <button
                    type="button"
                    onClick={onSkipToResult}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: '#1b365d',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    結果レポートへスキップ
                  </button>
                )}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
