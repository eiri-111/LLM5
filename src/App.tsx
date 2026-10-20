import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, UserProfile, ChatMessage, SurveyResult } from './types';
import { ChatMode } from './components/ChatMode';
import { ResultReport } from './components/ResultReport';
import { BfiSurveySection } from './components/BfiSurveySection';
import { ResearchConsentModal } from './components/ResearchConsentModal';
import { DevQuickBar } from './components/DevQuickBar';
import { 
  SAMPLE_ANALYSIS_RESULT, 
  SAMPLE_SURVEY_RESULT, 
  SAMPLE_CHAT_MESSAGES, 
  DEFAULT_USER_PROFILE 
} from './data/sampleResult';
import { Loader2 } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';

function generateSessionId(): string {
  // 分析時（SPSS/Excel/R）に見やすい短縮レスポンスID（例: R_k8m2p9qa 計10文字）
  const rand = Math.random().toString(36).substring(2, 6);
  const timeSuffix = Date.now().toString(36).slice(-4);
  return `R_${timeSuffix}${rand}`;
}

type AppPhase = 'chat' | 'survey' | 'result';

export const App: React.FC = () => {
  // 管理画面モードフラグ (/admin, ?admin, #admin)
  const [isAdminView, setIsAdminView] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      return path === '/admin' || path.startsWith('/admin/') || search.includes('admin') || hash === '#admin';
    }
    return false;
  });

  // 研究倫理同意フラグ & ユーザープロファイル
  const [hasConsented, setHasConsented] = useState<boolean>(() => {
    try {
      return localStorage.getItem('llm5_has_consented') === 'true';
    } catch (_) {}
    return false;
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('llm5_user_profile');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null;
  });

  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('llm5_current_session_id');
      if (saved) return saved;
    } catch (_) {}
    const newId = generateSessionId();
    try {
      localStorage.setItem('llm5_current_session_id', newId);
    } catch (_) {}
    return newId;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('llm5_chat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });

  // 画面フェーズ: 'chat' (/chat) | 'survey' (/survey) | 'result' (/result)
  const [phase, setPhase] = useState<AppPhase>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const search = window.location.search;
      const hash = window.location.hash.toLowerCase();
      if (search.includes('sample') || path === '/result' || hash === '#result') return 'result';
      if (path === '/survey' || hash === '#survey') return 'survey';
      if (path === '/chat' || hash === '#chat') return 'chat';
      try {
        const saved = localStorage.getItem('llm5_current_phase') as AppPhase;
        if (saved && ['chat', 'survey', 'result'].includes(saved)) {
          return saved;
        }
      } catch (_) {}
    }
    return 'chat';
  });

  // AI分析結果 & 質問紙結果
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AnalysisResult | null>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('sample')) {
        return SAMPLE_ANALYSIS_RESULT;
      }
      try {
        const saved = localStorage.getItem('llm5_ai_result');
        if (saved) return JSON.parse(saved);
      } catch (_) {}
    }
    return null;
  });

  const [surveyResult, setSurveyResult] = useState<SurveyResult | null>(() => {
    try {
      const saved = localStorage.getItem('llm5_survey_result');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null;
  });

  // 分析結果集計中のローディング状態
  const [isWaitingForAnalysis, setIsWaitingForAnalysis] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // URL変更検知 (/admin, /chat, /survey, /result へのブラウザ戻る・進むルーティング対応)
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase();
      const search = window.location.search;
      const hash = window.location.hash.toLowerCase();
      const admin = path === '/admin' || path.startsWith('/admin/') || search.includes('admin') || hash === '#admin';
      setIsAdminView(admin);

      if (!admin) {
        if (path === '/result' || hash === '#result' || search.includes('sample')) {
          setPhase('result');
        } else if (path === '/survey' || hash === '#survey') {
          setPhase('survey');
        } else if (path === '/chat' || path === '/' || hash === '#chat') {
          setPhase('chat');
        }
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // 画面フェーズ・セッション・結果の自動保存 & フェーズ遷移時のスクロールトップ & URL同期
  useEffect(() => {
    try {
      localStorage.setItem('llm5_current_phase', phase);
    } catch (_) {}
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.scrollTop = 0;
    }

    // URLの自動更新 (AI対話: /chat, 質問紙: /survey, 結果: /result)
    if (typeof window !== 'undefined' && !isAdminView) {
      const targetPath = phase === 'chat' ? '/chat' : `/${phase}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ phase }, '', targetPath + window.location.search);
      }
    }
  }, [phase, isAdminView]);

  useEffect(() => {
    try {
      if (sessionId) {
        localStorage.setItem('llm5_current_session_id', sessionId);
      }
    } catch (_) {}
  }, [sessionId]);

  useEffect(() => {
    try {
      if (aiAnalysisResult) {
        localStorage.setItem('llm5_ai_result', JSON.stringify(aiAnalysisResult));
      } else {
        localStorage.removeItem('llm5_ai_result');
      }
    } catch (_) {}
  }, [aiAnalysisResult]);

  useEffect(() => {
    try {
      if (surveyResult) {
        localStorage.setItem('llm5_survey_result', JSON.stringify(surveyResult));
      } else {
        localStorage.removeItem('llm5_survey_result');
      }
    } catch (_) {}
  }, [surveyResult]);

  /**
   * 研究倫理同意＆プロファイル入力の確定
   */
  const handleConsentAndSubmit = (profile: UserProfile) => {
    setUserProfile(profile);
    setHasConsented(true);
    try {
      localStorage.setItem('llm5_has_consented', 'true');
      localStorage.setItem('llm5_user_profile', JSON.stringify(profile));
      localStorage.removeItem('llm5_chat_messages');
    } catch (_) {}
    showToast('研究へのご協力ありがとうございます。対話診断を開始します。');
  };

  /**
   * チャット対話終了 ➔ バックグラウンドでAI分析を非同期実行し、アプリ内BFI-2-S質問紙へ移動
   */
  const handleStartSurvey = async (messages: ChatMessage[]) => {
    setChatMessages(messages);
    showToast('BFI-2-S 心理測定アンケートへ進みます');

    // 1. localStorage にセッション情報を退避
    try {
      localStorage.setItem('llm5_current_session_id', sessionId);
      localStorage.setItem('llm5_chat_messages', JSON.stringify(messages));
      if (userProfile) {
        localStorage.setItem('llm5_user_profile', JSON.stringify(userProfile));
      }
    } catch (storageErr) {
      console.warn('LocalStorage save error:', storageErr);
    }

    // 2. サーバーへバックグラウンド分析リクエストを送信 (analyze-async)
    // ユーザーがアンケートに回答している間に裏側でAI分析を実行
    try {
      fetch('/api/analyze-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_profile: userProfile || undefined,
          messages: messages
        })
      }).catch(err => console.warn('Async analysis trigger error:', err));
    } catch (_) {}

    // 3. アプリ内BFI-2-S画面へ遷移
    setPhase('survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  /**
   * BFI-2-S 質問紙回答完了 ➔ AI分析結果を取得・統合してD1/R2へ保存し、照合レポートへ
   */
  const handleCompleteSurvey = async (surveyData: SurveyResult) => {
    setSurveyResult(surveyData);
    setIsWaitingForAnalysis(true);
    setAnalysisError(null);
    showToast('AI対話分析と質問紙スコアを照合しています...');

    let attempts = 0;
    const maxAttempts = 8; // 2秒 x 8回 = 最大16秒ポーリング
    let finalAiResult: AnalysisResult | null = aiAnalysisResult;

    const fetchAiAnalysisResult = async (): Promise<AnalysisResult | null> => {
      while (attempts < maxAttempts) {
        attempts++;
        try {
          const res = await fetch(`/api/session?session_id=${encodeURIComponent(sessionId)}`);
          if (res.ok) {
            const data: any = await res.json();
            if (data.found && data.status === 'completed' && data.ai_result) {
              return data.ai_result;
            }
          }
        } catch (err) {
          console.warn('Session polling error:', err);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      return null;
    };

    // 1. まずバックグラウンド分析結果をポーリング
    if (!finalAiResult) {
      finalAiResult = await fetchAiAnalysisResult();
    }

    // 2. バックグラウンド分析が未完了/失敗だった場合、直接分析API (/api/analyze) で対話ログから即時生成
    if (!finalAiResult && chatMessages.length >= 2) {
      showToast('AI分析を直接生成中...');
      try {
        const analyzeRes = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            user_profile: userProfile || undefined,
            messages: chatMessages,
            survey_result: surveyData
          })
        });
        if (analyzeRes.ok) {
          const directData: any = await analyzeRes.json();
          if (directData && directData.scores) {
            finalAiResult = directData as AnalysisResult;
          }
        } else {
          const errJson = await analyzeRes.json().catch(() => ({}));
          console.error('Direct analyze endpoint returned error:', errJson);
        }
      } catch (directErr: any) {
        console.error('Direct analyze fetch error:', directErr);
      }
    }

    setIsWaitingForAnalysis(false);

    if (finalAiResult) {
      setAiAnalysisResult(finalAiResult);

      // D1 & R2 へ保存
      try {
        await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            user_profile: userProfile || undefined,
            messages: chatMessages,
            ai_result: finalAiResult,
            survey_result: surveyData
          })
        });
      } catch (saveErr) {
        console.warn('Save on survey completion error:', saveErr);
      }

      setPhase('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('AI対話推定とBFI-2-Sのスコアを照合しました！');
    } else {
      // 分析結果が生成できなかった場合は、ダミーにすり替えず明示的にエラーを表示
      setAnalysisError('AI性格分析の生成・取得ができませんでした。AI Gatewayの接続状態をご確認のうえ、もう一度お試しください。');
      setPhase('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * 診断を最初からやり直す（リセット）
   */
  const handleRetake = () => {
    setPhase('chat');
    setAiAnalysisResult(null);
    setSurveyResult(null);
    setAnalysisError(null);
    setChatMessages([]);
    const newId = generateSessionId();
    setSessionId(newId);
    try {
      localStorage.setItem('llm5_current_session_id', newId);
      localStorage.setItem('llm5_current_phase', 'chat');
      localStorage.removeItem('llm5_ai_result');
      localStorage.removeItem('llm5_survey_result');
      localStorage.removeItem('llm5_chat_messages');
      localStorage.removeItem('llm5_onboarding_step');
      localStorage.removeItem('llm5_chat_is_ready');
      localStorage.removeItem('llm5_bfi_answers');
    } catch (_) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('診断を最初からやり直します');
  };

  /**
   * 確認ダイアログ付きで診断を最初からやり直す
   */
  const handleConfirmRetake = () => {
    const isCompleted = phase === 'result';
    const message = isCompleted
      ? '診断を最初からやり直しますか？'
      : '診断を最初からやり直しますか？\n現在の対話内容や回答データはリセットされます。';

    if (window.confirm(message)) {
      handleRetake();
    }
  };

  const handleUpdateProfile = (partial: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const updated = { ...(prev || {}), ...partial };
      try {
        localStorage.setItem('llm5_user_profile', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const handleUpdateSurveyResult = async (updated: SurveyResult) => {
    setSurveyResult(updated);
    try {
      localStorage.setItem('llm5_survey_result', JSON.stringify(updated));
    } catch (_) {}

    // D1 & R2 に保存
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_profile: userProfile || undefined,
          messages: chatMessages,
          ai_result: aiAnalysisResult || undefined,
          survey_result: updated
        })
      });
      showToast('分析結果を保存・更新しました！');
    } catch (err) {
      console.warn('Save updated survey result error:', err);
    }
  };

  /**
   * 動作確認用: 質問紙画面へスキップ
   */
  const handleSkipToSurvey = () => {
    if (!hasConsented || !userProfile) {
      setUserProfile(DEFAULT_USER_PROFILE);
      setHasConsented(true);
      try {
        localStorage.setItem('llm5_has_consented', 'true');
        localStorage.setItem('llm5_user_profile', JSON.stringify(DEFAULT_USER_PROFILE));
      } catch (_) {}
    }
    if (chatMessages.length === 0) {
      setChatMessages(SAMPLE_CHAT_MESSAGES);
      try {
        localStorage.setItem('llm5_chat_messages', JSON.stringify(SAMPLE_CHAT_MESSAGES));
      } catch (_) {}
    }
    setIsWaitingForAnalysis(false);
    setPhase('survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('動作確認: 質問紙画面にスキップしました');
  };

  /**
   * 動作確認用: 結果画面へスキップ
   */
  const handleSkipToResult = () => {
    if (!hasConsented || !userProfile) {
      setUserProfile(DEFAULT_USER_PROFILE);
      setHasConsented(true);
      try {
        localStorage.setItem('llm5_has_consented', 'true');
        localStorage.setItem('llm5_user_profile', JSON.stringify(DEFAULT_USER_PROFILE));
      } catch (_) {}
    }
    if (chatMessages.length === 0) {
      setChatMessages(SAMPLE_CHAT_MESSAGES);
      try {
        localStorage.setItem('llm5_chat_messages', JSON.stringify(SAMPLE_CHAT_MESSAGES));
      } catch (_) {}
    }
    setAiAnalysisResult(SAMPLE_ANALYSIS_RESULT);
    setSurveyResult(SAMPLE_SURVEY_RESULT);
    setIsWaitingForAnalysis(false);
    setPhase('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('動作確認: 結果画面にスキップしました');
  };

  /**
   * 動作確認用: チャット画面へ移動
   */
  const handleSkipToChat = () => {
    if (!hasConsented || !userProfile) {
      setUserProfile(DEFAULT_USER_PROFILE);
      setHasConsented(true);
      try {
        localStorage.setItem('llm5_has_consented', 'true');
        localStorage.setItem('llm5_user_profile', JSON.stringify(DEFAULT_USER_PROFILE));
      } catch (_) {}
    }
    setIsWaitingForAnalysis(false);
    setPhase('chat');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('動作確認: チャット画面に移動しました');
  };

  /**
   * 動作確認用: 初期状態に完全リセット
   */
  const handleResetAll = () => {
    setHasConsented(false);
    setUserProfile(null);
    setAiAnalysisResult(null);
    setSurveyResult(null);
    setChatMessages([]);
    setIsWaitingForAnalysis(false);
    setPhase('chat');
    const newId = generateSessionId();
    setSessionId(newId);
    try {
      localStorage.clear();
      localStorage.setItem('llm5_current_session_id', newId);
    } catch (_) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('初期状態にリセットしました');
  };

  // 管理画面モード表示
  if (isAdminView) {
    return (
      <AdminDashboard
        onBackToApp={() => {
          setIsAdminView(false);
          if (window.history?.pushState) {
            const targetPath = phase === 'chat' ? '/chat' : `/${phase}`;
            window.history.pushState(null, '', targetPath);
          }
        }}
      />
    );
  }

  return (
    <div className={`app-container ${phase === 'chat' ? 'fullscreen-chat' : 'scrollable-view'}`}>
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* 開発・デバッグ確認用（?dev=true の時のみ表示） */}
      {typeof window !== 'undefined' && window.location.search.includes('dev=true') && (
        <DevQuickBar
          currentPhase={phase}
          onSkipToChat={handleSkipToChat}
          onSkipToSurvey={handleSkipToSurvey}
          onSkipToResult={handleSkipToResult}
          onReset={handleResetAll}
        />
      )}

      {/* 研究倫理同意＆プロファイル入力モーダル（未同意の場合に表示） */}
      {(!hasConsented || !userProfile) && (
        <ResearchConsentModal
          initialProfile={userProfile}
          onConsentAndSubmit={handleConsentAndSubmit}
          onSkipToSurvey={handleSkipToSurvey}
          onSkipToResult={handleSkipToResult}
        />
      )}

      <main className="main-content">
        {phase === 'chat' && (
          <ChatMode
            key={sessionId}
            userProfile={userProfile}
            onUpdateProfile={handleUpdateProfile}
            onStartSurvey={handleStartSurvey}
            onSkipToSurvey={handleSkipToSurvey}
            onSkipToResult={handleSkipToResult}
            onReset={handleConfirmRetake}
            showToast={showToast}
          />
        )}

        {phase === 'survey' && (
          <BfiSurveySection
            key={sessionId}
            onCompleteSurvey={handleCompleteSurvey}
            onSkipToResult={handleSkipToResult}
            onBackToChat={handleSkipToChat}
            onReset={handleConfirmRetake}
            showToast={showToast}
          />
        )}

        {phase === 'result' && (
          analysisError ? (
            <div className="result-container" style={{ padding: '2.5rem 1.25rem' }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '4px',
                padding: '2rem 1.5rem',
                border: '1px solid #f5c6cb',
                borderTop: '4px solid #d93025',
                maxWidth: '520px',
                margin: '0 auto',
                textAlign: 'left'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#a91e22', marginBottom: '0.6rem' }}>
                  分析レポートの生成中にエラーが発生しました
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#333e4f', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  {analysisError}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleConfirmRetake}
                    className="qualtrics-nav-btn secondary"
                  >
                    最初からやり直す
                  </button>
                  <button
                    onClick={() => {
                      if (surveyResult) handleCompleteSurvey(surveyResult);
                      else handleConfirmRetake();
                    }}
                    className="qualtrics-nav-btn"
                  >
                    再試行する
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <ResultReport
              result={aiAnalysisResult || SAMPLE_ANALYSIS_RESULT}
              surveyResult={surveyResult || SAMPLE_SURVEY_RESULT}
              userProfile={userProfile}
              messages={chatMessages}
              sessionId={sessionId}
              onRetake={handleConfirmRetake}
              onUpdateSurveyResult={handleUpdateSurveyResult}
              showToast={showToast}
            />
          )
        )}
      </main>

      {/* 分析結果集計待ちモーダル */}
      {isWaitingForAnalysis && (
        <div className="modal-backdrop" style={{ alignItems: 'center' }}>
          <div className="profile-modal-card" style={{ maxWidth: '480px', minHeight: 'auto', textAlign: 'center', padding: '2.25rem 1.75rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '4px',
              background: '#e8f3fa',
              border: '1px solid #b6d8f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              color: '#007ac0'
            }}>
              <Loader2 size={24} className="spinner" />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1b2432', marginBottom: '0.5rem' }}>
              回答データを集計・照合しています...
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#5c6878', lineHeight: 1.65 }}>
              調査へのご回答ありがとうございました。<br />
              AI対話記録とBFI-2-S質問紙の測定値を統合し、評価レポートを作成しています。画面を閉じずにそのままお待ちください。
            </p>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="mobile-toast">
          {toastMessage}
        </div>
      )}

    </div>
  );
};

export default App;
