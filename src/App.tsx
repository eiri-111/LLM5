import React, { useState } from 'react';
import { MessageSquare, ClipboardList, FileText } from 'lucide-react';
import { AnalysisMode, AnalysisResult } from './types';
import { Header } from './components/Header';
import { ChatMode } from './components/ChatMode';
import { QuestionnaireMode } from './components/QuestionnaireMode';
import { TextAnalysisMode } from './components/TextAnalysisMode';
import { ResultReport } from './components/ResultReport';

export const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AnalysisMode>('chat');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetake = () => {
    setAnalysisResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container">
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      <Header onReset={handleRetake} />

      {!analysisResult ? (
        <>
          <div className="mode-nav-container">
            <nav className="mode-nav" aria-label="診断モード選択">
              <button
                type="button"
                className={`mode-nav-btn ${currentMode === 'chat' ? 'active' : ''}`}
                onClick={() => setCurrentMode('chat')}
              >
                <MessageSquare size={15} />
                <span>対話診断</span>
              </button>
              <button
                type="button"
                className={`mode-nav-btn ${currentMode === 'questionnaire' ? 'active' : ''}`}
                onClick={() => setCurrentMode('questionnaire')}
              >
                <ClipboardList size={15} />
                <span>設問10問</span>
              </button>
              <button
                type="button"
                className={`mode-nav-btn ${currentMode === 'text' ? 'active' : ''}`}
                onClick={() => setCurrentMode('text')}
              >
                <FileText size={15} />
                <span>文章分析</span>
              </button>
            </nav>
          </div>

          <main className="main-content">
            {currentMode === 'chat' && (
              <ChatMode
                onAnalysisComplete={handleAnalysisComplete}
                showToast={showToast}
              />
            )}
            {currentMode === 'questionnaire' && (
              <QuestionnaireMode
                onAnalysisComplete={handleAnalysisComplete}
                showToast={showToast}
              />
            )}
            {currentMode === 'text' && (
              <TextAnalysisMode
                onAnalysisComplete={handleAnalysisComplete}
                showToast={showToast}
              />
            )}
          </main>
        </>
      ) : (
        <main className="main-content">
          <ResultReport
            result={analysisResult}
            onRetake={handleRetake}
            showToast={showToast}
          />
        </main>
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
