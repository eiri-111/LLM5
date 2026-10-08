import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, UserProfile, ChatMessage, SurveyResult } from './types';
import { ChatMode } from './components/ChatMode';
import { ResultReport } from './components/ResultReport';
import { SurveySection } from './components/SurveySection';
import { SAMPLE_ANALYSIS_RESULT } from './data/sampleResult';
import { Loader2 } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';

const QUALTRICS_SURVEY_URL = 'https://kobegakuinpsy.qualtrics.com/jfe/form/SV_eqUN3SQZ8LNdZ5Q';

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

  // ユーザープロファイル (必要に応じてチャットから抽出)
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

  // 動作確認・スキップモード管理
  const [isSkippedMode, setIsSkippedMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      return search.includes('survey') || search.includes('skip');
    }
    return false;
  });

  // 画面フェーズ: 'chat' | 'survey' | 'result'
  const [phase, setPhase] = useState<AppPhase>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('sample')) return 'result';
      if (search.includes('survey') || search.includes('skip')) return 'survey';
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
      if (search.includes('sample') || search.includes('survey') || search.includes('skip')) {
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

  // Qualtrics復帰時・結果取得中のローディング状態
  const [isLoadingSessionResult, setIsLoadingSessionResult] = useState<boolean>(false);

  // 裏で実行中のAI分析タスク管理
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [isWaitingForAiToComplete, setIsWaitingForAiToComplete] = useState<boolean>(false);
  const [isPreparingQualtrics, setIsPreparingQualtrics] = useState<boolean>(false);
  const aiAnalysisPromiseRef = useRef<Promise<AnalysisResult | null> | null>(null);

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
   * Qualtricsからのリダイレクト戻り検知 & サーバーから分析結果を取得
   * URLパラメータ: ?phase=result&qualtrics_id=R_xxxx&session_id=session_xxxx
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const qualtricsId = params.get('qualtrics_id');
    const urlSessionId = params.get('session_id');
    const phaseParam = params.get('phase');

    if (qualtricsId || phaseParam === 'result') {
      const targetSessionId = urlSessionId || localStorage.getItem('llm5_current_session_id') || sessionId;
      if (urlSessionId) setSessionId(urlSessionId);

      setIsLoadingSessionResult(true);

      let attempts = 0;
      const maxAttempts = 15; // 2秒 x 15回 = 最大30秒待機

      const pollSessionResult = async () => {
        attempts++;
        try {
          const query = new URLSearchParams({
            session_id: targetSessionId,
            ...(qualtricsId ? { qualtrics_id: qualtricsId } : {})
          });

          const res = await fetch(`/api/session?${query.toString()}`);
          if (res.ok) {
            const data: any = await res.json();
            if (data.found && data.status === 'completed' && data.ai_result) {
              setAiAnalysisResult(data.ai_result);
              if (data.user_profile) setUserProfile(data.user_profile);
              if (data.messages && data.messages.length > 0) setChatMessages(data.messages);
              setPhase('result');
              setIsLoadingSessionResult(false);
              showToast('質問紙（Qualtrics）へのご回答ありがとうございました！');
              return;
            }

            // バックグラウンドでまだ分析中 (status === 'processing') の場合はリトライ
            if (data.status === 'processing' && attempts < maxAttempts) {
              setTimeout(pollSessionResult, 2000);
              return;
            }
          }
        } catch (err) {
          console.warn('Session polling error:', err);
        }

        // タイムアウトまたはDB未接続時のフォールバック処理
        try {
          const savedAi = localStorage.getItem('llm5_ai_result');
          if (savedAi) {
            setAiAnalysisResult(JSON.parse(savedAi));
            setPhase('result');
            setIsLoadingSessionResult(false);
            showToast('質問紙の回答ありがとうございました！');
            return;
          }
        } catch (_) {}

        setAiAnalysisResult(SAMPLE_ANALYSIS_RESULT);
        setPhase('result');
        setIsLoadingSessionResult(false);
        showToast('質問紙の回答ありがとうございました！');
      };

      pollSessionResult();

      // URLクエリパラメータをクリーンアップ
      if (window.history?.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  /**
   * チャット対話終了 ➔ バックグラウンドでAI分析を非同期実行し、即座にQualtrics質問紙へ自動遷移
   */
  const handleStartSurvey = async (messages: ChatMessage[]) => {
    setChatMessages(messages);
    setIsPreparingQualtrics(true);
    showToast('質問紙（Qualtrics）の画面へ移動しています...');

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
    // Workersの context.waitUntil により、クライアントは待たずに即時リダイレクト
    try {
      await fetch('/api/analyze-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_profile: userProfile || undefined,
          messages: messages
        })
      });
    } catch (apiErr) {
      console.warn('Async analysis initiation error:', apiErr);
      // フォールバックとして事前保存
      try {
        await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            user_profile: userProfile || undefined,
            messages: messages
          })
        });
      } catch (_) {}
    }

    // 3. Qualtricsへ自動遷移
    const studentIdParam = encodeURIComponent(userProfile?.student_id || sessionId);
    const sessionIdParam = encodeURIComponent(sessionId);
    const qualtricsUrl = `${QUALTRICS_SURVEY_URL}?user_id=${studentIdParam}&session_id=${sessionIdParam}`;

    // 画面遷移
    window.location.href = qualtricsUrl;
  };

  /**
   * 質問紙回答完了 ➔ AI分析結果と統合して最終照合レポートへ
   */
  const handleCompleteSurvey = async (surveyData: SurveyResult) => {
    setSurveyResult(surveyData);

    let finalAiResult = aiAnalysisResult;

    // もしユーザーの質問紙回答が早すぎて裏のAI分析がまだ完了していなければ待機
    if (!finalAiResult && aiAnalysisPromiseRef.current) {
      setIsWaitingForAiToComplete(true);
      finalAiResult = await aiAnalysisPromiseRef.current;
      setIsWaitingForAiToComplete(false);
    }

    if (!finalAiResult) {
      showToast('AI分析結果を取得できませんでした。もう一度お試しください。');
      return;
    }

    // D1 / R2 へ保存
    if (userProfile) {
      try {
        await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            user_profile: userProfile,
            messages: chatMessages,
            ai_result: finalAiResult,
            survey_result: surveyData
          })
        });
      } catch (err) {
        console.warn('Save on survey completion error:', err);
      }
    }

    setPhase('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('AI分析と質問紙のスコアを照合しました！');
  };

  const handleShowSample = () => {
    setAiAnalysisResult(SAMPLE_ANALYSIS_RESULT);
    setSurveyResult(null);
    setPhase('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * 動作確認用: LLMによる性格検査をスキップして質問紙（アンケート）回答画面へ直接移動
   */
  const handleSkipToSurvey = () => {
    setIsSkippedMode(true);
    // AI分析結果としてサンプルデータを適用（質問紙回答完了後のレーダーチャート照合用）
    if (!aiAnalysisResult) {
      setAiAnalysisResult(SAMPLE_ANALYSIS_RESULT);
    }
    if (!userProfile) {
      const defaultProfile: UserProfile = {
        age: 20,
        gender: 'unspecified'
      };
      setUserProfile(defaultProfile);
      try {
        localStorage.setItem('llm5_user_profile', JSON.stringify(defaultProfile));
      } catch (_) {}
    }
    setIsAiAnalyzing(false);
    setIsPreparingQualtrics(false);
    setPhase('survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('LLM性格検査をスキップし、質問紙の回答画面へ移動しました（動作確認モード）');
  };

  /**
   * 質問紙画面からAI対話画面へ戻る
   */
  const handleBackToChat = () => {
    setPhase('chat');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetake = () => {
    setPhase('chat');
    setIsSkippedMode(false);
    setAiAnalysisResult(null);
    setSurveyResult(null);
    setChatMessages([]);
    const newId = generateSessionId();
    setSessionId(newId);
    setIsAiAnalyzing(false);
    setIsWaitingForAiToComplete(false);
    setIsPreparingQualtrics(false);
    aiAnalysisPromiseRef.current = null;
    try {
      localStorage.setItem('llm5_current_session_id', newId);
      localStorage.setItem('llm5_current_phase', 'chat');
      localStorage.removeItem('llm5_ai_result');
      localStorage.removeItem('llm5_survey_result');
      localStorage.removeItem('llm5_chat_messages');
      localStorage.removeItem('llm5_onboarding_step');
      localStorage.removeItem('llm5_chat_is_ready');
      localStorage.removeItem('llm5_survey_answers');
      localStorage.removeItem('llm5_survey_scale');
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
          <SurveySection
            userProfile={userProfile}
            isAiAnalyzing={isAiAnalyzing}
            onCompleteSurvey={handleCompleteSurvey}
            showToast={showToast}
            onBackToChat={handleBackToChat}
            isSkippedMode={isSkippedMode}
            qualtricsUrl={`${QUALTRICS_SURVEY_URL}?user_id=${encodeURIComponent(sessionId)}&session_id=${encodeURIComponent(sessionId)}`}
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
            showToast={showToast}
          />
        )}
      </main>

      {/* Qualtrics遷移直前のローディングモーダル */}
      {isPreparingQualtrics && (
        <div className="modal-backdrop">
          <div className="profile-modal-card text-center" style={{ textAlign: 'center' }}>
            <Loader2 size={36} className="spinner text-indigo-600" style={{ margin: '0 auto 1rem' }} />
            <h3 className="font-bold text-slate-800 text-lg">
              質問紙（Qualtrics）へ移動しています...
            </h3>
            <p className="text-slate-500 text-sm mt-2">
              対話データを記録し、裏側でAI分析官による深層プロファイリングを開始しました。<br />
              画面が自動的に切り替わります。
            </p>
          </div>
        </div>
      )}

      {/* Qualtrics復帰後のAI分析結果集計・取得待ちモーダル */}
      {isLoadingSessionResult && (
        <div className="modal-backdrop">
          <div className="profile-modal-card text-center" style={{ textAlign: 'center' }}>
            <Loader2 size={36} className="spinner text-indigo-600" style={{ margin: '0 auto 1rem' }} />
            <h3 className="font-bold text-slate-800 text-lg">
              AI性格診断の結果を集計しています...
            </h3>
            <p className="text-slate-500 text-sm mt-2">
              アンケートへのご回答ありがとうございました！<br />
              並行して解析されたAIプロファイルを取得し、照合レポートを生成しています。
            </p>
          </div>
        </div>
      )}

      {/* アプリ内蔵質問紙用：AI分析完了待ちモーダル */}
      {isWaitingForAiToComplete && (
        <div className="modal-backdrop">
          <div className="profile-modal-card text-center" style={{ textAlign: 'center' }}>
            <Loader2 size={36} className="spinner text-indigo-600" style={{ margin: '0 auto 1rem' }} />
            <h3 className="font-bold text-slate-800 text-lg">
              AI対話分析と質問紙スコアを照合中...
            </h3>
            <p className="text-slate-500 text-sm mt-2">
              AI分析官による深層プロファイリングの仕上げを行っています。まもなくレポートが表示されます。
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
