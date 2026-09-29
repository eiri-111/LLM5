import React, { useState } from 'react';
import { AnalysisResult } from './types';
import { Header } from './components/Header';
import { ChatMode } from './components/ChatMode';
import { ResultReport } from './components/ResultReport';

export const App: React.FC = () => {
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

      <main className="main-content">
        {!analysisResult ? (
          <ChatMode
            onAnalysisComplete={handleAnalysisComplete}
            showToast={showToast}
          />
        ) : (
          <ResultReport
            result={analysisResult}
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
