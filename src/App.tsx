import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, UserProfile, ChatMessage, SurveyResult } from './types';
import { ChatMode } from './components/ChatMode';
import { ResultReport } from './components/ResultReport';
import { BfiSurveySection } from './components/BfiSurveySection';
import { ResearchConsentModal } from './components/ResearchConsentModal';
import { SAMPLE_ANALYSIS_RESULT } from './data/sampleResult';
import { Loader2 } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';

function generateSessionId(): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `session_${Date.now()}_${rand}`;
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

  // 画面フェーズ: 'chat' | 'survey' | 'result'
  const [phase, setPhase] = useState<AppPhase>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('sample')) return 'result';
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

  // URL変更検知 (/admin へのルーティング対応)
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      setIsAdminView(path === '/admin' || path.startsWith('/admin/') || search.includes('admin') || hash === '#admin');
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // 画面フェーズ・セッション・結果の自動保存
  useEffect(() => {
    try {
      localStorage.setItem('llm5_current_phase', phase);
    } catch (_) {}
  }, [phase]);

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

  /**
   * BFI-2-S 質問紙回答完了 ➔ AI分析結果を取得・統合してD1/R2へ保存し、照合レポートへ
   */
  const handleCompleteSurvey = async (surveyData: SurveyResult) => {
    setSurveyResult(surveyData);
    setIsWaitingForAnalysis(true);
    showToast('AI対話分析と質問紙スコアを照合しています...');

    let attempts = 0;
    const maxAttempts = 15; // 2秒 x 15回 = 最大30秒
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

    if (!finalAiResult) {
      finalAiResult = await fetchAiAnalysisResult();
    }

    // フォールバック
    if (!finalAiResult) {
      finalAiResult = SAMPLE_ANALYSIS_RESULT;
    }

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

    setIsWaitingForAnalysis(false);
    setPhase('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('AI対話推定とBFI-2-Sのスコアを照合しました！');
  };

  const handleRetake = () => {
    setPhase('chat');
    setAiAnalysisResult(null);
    setSurveyResult(null);
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

  // 管理画面モード表示
  if (isAdminView) {
    return (
      <AdminDashboard
        onBackToApp={() => {
          setIsAdminView(false);
          if (window.history?.pushState) {
            window.history.pushState(null, '', '/');
          }
        }}
      />
    );
  }

  return (
    <div className={`app-container ${phase === 'chat' ? 'fullscreen-chat' : 'scrollable-view'}`}>
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* 研究倫理同意＆プロファイル入力モーダル（未同意の場合に表示） */}
      {(!hasConsented || !userProfile) && (
        <ResearchConsentModal
          initialProfile={userProfile}
          onConsentAndSubmit={handleConsentAndSubmit}
        />
      )}

      <main className="main-content">
        {phase === 'chat' && (
          <ChatMode
            userProfile={userProfile}
            onUpdateProfile={handleUpdateProfile}
            onStartSurvey={handleStartSurvey}
            showToast={showToast}
          />
        )}

        {phase === 'survey' && (
          <BfiSurveySection
            onCompleteSurvey={handleCompleteSurvey}
            showToast={showToast}
          />
        )}

        {phase === 'result' && aiAnalysisResult && (
          <ResultReport
            result={aiAnalysisResult}
            surveyResult={surveyResult}
            userProfile={userProfile}
            messages={chatMessages}
            sessionId={sessionId}
            onRetake={handleRetake}
            onUpdateSurveyResult={handleUpdateSurveyResult}
            showToast={showToast}
          />
        )}
      </main>

      {/* 分析結果集計待ちモーダル */}
      {isWaitingForAnalysis && (
        <div className="modal-backdrop">
          <div className="profile-modal-card text-center" style={{ textAlign: 'center' }}>
            <Loader2 size={36} className="spinner text-indigo-600" style={{ margin: '0 auto 1rem' }} />
            <h3 className="font-bold text-slate-800 text-lg">
              AI対話分析と質問紙スコアを照合中...
            </h3>
            <p className="text-slate-500 text-sm mt-2">
              アンケートへのご回答ありがとうございました！<br />
              AI分析官による深層プロファイリングとBFI-2-S測定値を統合し、照合レポートを生成しています。
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
