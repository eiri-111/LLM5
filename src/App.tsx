import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, UserProfile, ChatMessage, SurveyResult } from './types';
import { ChatMode } from './components/ChatMode';
import { ResultReport } from './components/ResultReport';
import { SurveySection } from './components/SurveySection';
import { SAMPLE_ANALYSIS_RESULT } from './data/sampleResult';
import { Loader2 } from 'lucide-react';

const QUALTRICS_SURVEY_URL = 'https://kobegakuinpsy.qualtrics.com/jfe/form/SV_eqUN3SQZ8LNdZ5Q';

function generateSessionId(): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `session_${Date.now()}_${rand}`;
}

type AppPhase = 'chat' | 'survey' | 'result';

export const App: React.FC = () => {
  // ユーザープロファイル (必要に応じてチャットから抽出)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('llm5_user_profile');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null;
  });

  const [sessionId, setSessionId] = useState<string>(generateSessionId);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // 画面フェーズ: 'chat' | 'survey' | 'result'
  const [phase, setPhase] = useState<AppPhase>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('sample')) {
      return 'result';
    }
    return 'chat';
  });

  // AI分析結果 & 質問紙結果
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AnalysisResult | null>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('sample')) {
      return SAMPLE_ANALYSIS_RESULT;
    }
    return null;
  });
  const [surveyResult, setSurveyResult] = useState<SurveyResult | null>(null);

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

  /**
   * Qualtricsからのリダイレクト戻り検知
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

      let restoredAiResult: AnalysisResult | null = null;
      let restoredProfile = userProfile;
      let restoredMessages: ChatMessage[] = [];

      try {
        const savedAi = localStorage.getItem('llm5_ai_result');
        if (savedAi) restoredAiResult = JSON.parse(savedAi);

        const savedMessages = localStorage.getItem('llm5_chat_messages');
        if (savedMessages) {
          restoredMessages = JSON.parse(savedMessages);
          setChatMessages(restoredMessages);
        }

        const savedProfile = localStorage.getItem('llm5_user_profile');
        if (savedProfile) {
          restoredProfile = JSON.parse(savedProfile);
          setUserProfile(restoredProfile);
        }
      } catch (e) {
        console.warn('LocalStorage復元エラー:', e);
      }

      if (restoredAiResult) {
        setAiAnalysisResult(restoredAiResult);
        setPhase('result');
      }

      // qualtrics_id をサーバーに保存
      if (qualtricsId) {
        fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: targetSessionId,
            user_profile: restoredProfile || { student_id: 'anonymous', age: 0, gender: 'unspecified' },
            messages: restoredMessages,
            ai_result: restoredAiResult || undefined,
            qualtrics_id: qualtricsId
          })
        }).then(() => {
          showToast('質問紙（Qualtrics）へのご回答ありがとうございました！');
        }).catch(err => {
          console.warn('Qualtrics ID 保存エラー:', err);
        });
      }

      // URLクエリパラメータをクリーンアップ
      if (window.history?.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  /**
   * チャット対話終了 ➔ AI分析を実行してQualtrics質問紙へ自動遷移
   */
  const handleStartSurvey = async (messages: ChatMessage[]) => {
    setChatMessages(messages);
    setIsPreparingQualtrics(true);
    showToast('AI性格分析を実行しています...');

    try {
      // 1. AI分析を実行
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          messages: messages
        })
      });

      if (!res.ok) {
        const errData: any = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || '性格分析に失敗しました');
      }

      const data: AnalysisResult = await res.json();
      setAiAnalysisResult(data);

      // 2. localStorage にセッション情報を退避
      try {
        localStorage.setItem('llm5_current_session_id', sessionId);
        localStorage.setItem('llm5_chat_messages', JSON.stringify(messages));
        localStorage.setItem('llm5_ai_result', JSON.stringify(data));
        if (userProfile) {
          localStorage.setItem('llm5_user_profile', JSON.stringify(userProfile));
        }
      } catch (storageErr) {
        console.warn('LocalStorage save error:', storageErr);
      }

      // 3. サーバーへ事前保存 (D1 / R2)
      try {
        await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            user_profile: userProfile || undefined,
            messages: messages,
            ai_result: data
          })
        });
      } catch (saveErr) {
        console.warn('Pre-save session error:', saveErr);
      }

      // 4. Qualtricsへ自動遷移
      const studentIdParam = encodeURIComponent(sessionId);
      const sessionIdParam = encodeURIComponent(sessionId);
      const qualtricsUrl = `${QUALTRICS_SURVEY_URL}?user_id=${studentIdParam}&session_id=${sessionIdParam}`;

      // 画面遷移
      window.location.href = qualtricsUrl;

    } catch (err: any) {
      console.error('AI analysis error before Qualtrics:', err);
      setIsPreparingQualtrics(false);
      showToast(`AI分析エラー: ${err.message || 'もう一度お試しください'}`);
    }
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

  const handleRetake = () => {
    setPhase('chat');
    setAiAnalysisResult(null);
    setSurveyResult(null);
    setChatMessages([]);
    setSessionId(generateSessionId());
    setIsAiAnalyzing(false);
    setIsWaitingForAiToComplete(false);
    setIsPreparingQualtrics(false);
    aiAnalysisPromiseRef.current = null;
    try {
      localStorage.removeItem('llm5_current_session_id');
      localStorage.removeItem('llm5_ai_result');
      localStorage.removeItem('llm5_chat_messages');
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
            onShowSample={handleShowSample}
          />
        )}

        {phase === 'survey' && (
          <SurveySection
            userProfile={userProfile}
            isAiAnalyzing={isAiAnalyzing}
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
            showToast={showToast}
          />
        )}
      </main>

      {/* Qualtrics遷移前のAI分析実行モーダル */}
      {isPreparingQualtrics && (
        <div className="modal-backdrop">
          <div className="profile-modal-card text-center" style={{ textAlign: 'center' }}>
            <Loader2 size={36} className="spinner text-indigo-600" style={{ margin: '0 auto 1rem' }} />
            <h3 className="font-bold text-slate-800 text-lg">
              AI性格診断を実行しています...
            </h3>
            <p className="text-slate-500 text-sm mt-2">
              これまでの対話から深層プロファイリングを分析しています。<br />
              完了後、自動的に質問紙（Qualtrics）の回答画面へ移動します。
            </p>
          </div>
        </div>
      )}

      {/* AI分析完了待ちモーダル（極めて短時間で回答し終えた場合のみ表示） */}
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
