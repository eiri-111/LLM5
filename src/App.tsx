import React, { useState, useRef } from 'react';
import { AnalysisResult, UserProfile, ChatMessage, SurveyResult } from './types';
import { ChatMode } from './components/ChatMode';
import { ResultReport } from './components/ResultReport';
import { SurveySection } from './components/SurveySection';
import { ProfileModal } from './components/ProfileModal';
import { SAMPLE_ANALYSIS_RESULT } from './data/sampleResult';
import { Loader2 } from 'lucide-react';

function generateSessionId(): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `session_${Date.now()}_${rand}`;
}

type AppPhase = 'chat' | 'survey' | 'result';

export const App: React.FC = () => {
  // ユーザープロファイル (学籍番号、年齢、性別)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('llm5_user_profile');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null;
  });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(() => !userProfile);
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
  const aiAnalysisPromiseRef = useRef<Promise<AnalysisResult | null> | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleSaveProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    try {
      localStorage.setItem('llm5_user_profile', JSON.stringify(profile));
    } catch (_) {}
    setIsProfileModalOpen(false);
    showToast(`学籍番号「${profile.student_id}」で登録しました`);
  };

  /**
   * チャット対話終了 ➔ 質問紙回答へ進む
   * 同時にバックグラウンドで /api/analyze を非同期発火！
   */
  const handleStartSurvey = (messages: ChatMessage[]) => {
    setChatMessages(messages);
    setPhase('survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 裏で非同期にAI分析を開始
    setIsAiAnalyzing(true);
    const analyzePromise = (async () => {
      try {
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
        return data;
      } catch (err: any) {
        console.error('Background AI analysis error:', err);
        showToast(`AI分析エラー: ${err.message}`);
        return null;
      } finally {
        setIsAiAnalyzing(false);
      }
    })();

    aiAnalysisPromiseRef.current = analyzePromise;
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
    aiAnalysisPromiseRef.current = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`app-container ${phase === 'chat' ? 'fullscreen-chat' : 'scrollable-view'}`}>
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      <ProfileModal
        isOpen={isProfileModalOpen}
        initialProfile={userProfile}
        onSave={handleSaveProfile}
      />

      <main className="main-content">
        {phase === 'chat' && (
          <ChatMode
            userProfile={userProfile}
            onEditProfile={() => setIsProfileModalOpen(true)}
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
