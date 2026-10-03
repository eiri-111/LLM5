import React, { useState, useEffect } from 'react';
import { AnalysisResult, UserProfile, ChatMessage } from './types';
import { ChatMode } from './components/ChatMode';
import { ResultReport } from './components/ResultReport';
import { ProfileModal } from './components/ProfileModal';
import { SAMPLE_ANALYSIS_RESULT } from './data/sampleResult';

function generateSessionId(): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `session_${Date.now()}_${rand}`;
}

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

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('sample')) {
      return SAMPLE_ANALYSIS_RESULT;
    }
    return null;
  });

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

  const handleAnalysisComplete = (result: AnalysisResult, messages: ChatMessage[]) => {
    setAnalysisResult(result);
    setChatMessages(messages);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleShowSample = () => {
    setAnalysisResult(SAMPLE_ANALYSIS_RESULT);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetake = () => {
    setAnalysisResult(null);
    setChatMessages([]);
    setSessionId(generateSessionId());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`app-container ${analysisResult ? 'scrollable-view' : 'fullscreen-chat'}`}>
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      <ProfileModal
        isOpen={isProfileModalOpen}
        initialProfile={userProfile}
        onSave={handleSaveProfile}
      />

      <main className="main-content">
        {!analysisResult ? (
          <ChatMode
            userProfile={userProfile}
            onEditProfile={() => setIsProfileModalOpen(true)}
            onAnalysisComplete={handleAnalysisComplete}
            showToast={showToast}
            onShowSample={handleShowSample}
          />
        ) : (
          <ResultReport
            result={analysisResult}
            userProfile={userProfile}
            messages={chatMessages}
            sessionId={sessionId}
            onRetake={handleRetake}
            showToast={showToast}
          />
        )}
      </main>

      {toastMessage && (
        <div className="mobile-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;

