import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, HelpCircle, Sparkles, AlertCircle } from 'lucide-react';
import { SurveyResult } from '../types';
import { BFI_2_S_CONFIG, calculateBfiScores } from '../data/bfi2s';

interface BfiSurveySectionProps {
  onCompleteSurvey: (result: SurveyResult) => void;
  showToast: (msg: string) => void;
}

export const BfiSurveySection: React.FC<BfiSurveySectionProps> = ({
  onCompleteSurvey,
  showToast
}) => {
  const [answers, setAnswers] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem('llm5_bfi_answers');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {};
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const questions = BFI_2_S_CONFIG.questions;
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);
  const isAllAnswered = answeredCount === totalQuestions;

  const handleSelectAnswer = (questionId: number, value: number) => {
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: value };
      try {
        localStorage.setItem('llm5_bfi_answers', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const handleSubmit = () => {
    if (!isAllAnswered) {
      showToast(`未回答の設問があります（残り ${totalQuestions - answeredCount}問）`);
      return;
    }

    setIsSubmitting(true);
    showToast('BFI-2-Sスコアを集計し、AI対話分析と照合しています...');

    try {
      const scores = calculateBfiScores(answers);
      const completedAt = new Date().toISOString();

      const surveyResult: SurveyResult = {
        scaleType: 'bfi-2-s',
        scaleName: BFI_2_S_CONFIG.name,
        rawAnswers: answers,
        scores,
        completedAt,
        isQualtrics: false
      };

      try {
        localStorage.removeItem('llm5_bfi_answers');
      } catch (_) {}

      onCompleteSurvey(surveyResult);
    } catch (err: any) {
      console.error('BFI-2-S 集計エラー:', err);
      showToast('集計中にエラーが発生しました');
      setIsSubmitting(false);
    }
  };

  // テスト・動作確認用: サンプル一括入力
  const handleAutoFillSample = () => {
    const sampleAnswers: Record<number, number> = {};
    questions.forEach((q) => {
      // 3を中心に2〜4の自然な回答を生成
      const val = Math.floor(Math.random() * 3) + 2;
      sampleAnswers[q.id] = val;
    });
    setAnswers(sampleAnswers);
    try {
      localStorage.setItem('llm5_bfi_answers', JSON.stringify(sampleAnswers));
    } catch (_) {}
    showToast('テスト用にすべての設問にサンプル回答を入力しました');
  };

  return (
    <div className="survey-container max-w-2xl mx-auto px-4 py-6">
      {/* 尺度ヘッダー */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <span className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-full">
            学術標準尺度: BFI-2-S
          </span>
          <button
            type="button"
            onClick={handleAutoFillSample}
            className="text-xs text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
          >
            （テスト用）全問自動入力
          </button>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
          性格特性 質問紙アンケート（BFI-2-S）
        </h1>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          {BFI_2_S_CONFIG.description}（{BFI_2_S_CONFIG.authorYear}）<br />
          {BFI_2_S_CONFIG.instruction}
        </p>

        {/* 進捗バー */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1.5">
            <span>回答進捗</span>
            <span className="text-indigo-600 font-mono">{answeredCount} / {totalQuestions}問 ({progressPercent}%)</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 設問リスト */}
      <div className="space-y-4 mb-8">
        {questions.map((q) => {
          const selectedValue = answers[q.id];
          const isAnswered = typeof selectedValue === 'number';

          return (
            <div
              key={q.id}
              className={`bg-white rounded-2xl p-5 border transition-all ${
                isAnswered
                  ? 'border-indigo-200 shadow-xs'
                  : 'border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                  isAnswered
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {q.id}
                </span>
                <p className="text-sm font-semibold text-slate-900 pt-0.5 leading-snug">
                  「私は普段、{q.text}」
                </p>
              </div>

              {/* 5件法 選択ボタングリッド */}
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2 pt-1">
                {BFI_2_S_CONFIG.scaleLabels.map((opt) => {
                  const isSelected = selectedValue === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectAnswer(q.id, opt.value)}
                      className={`py-3 px-1 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold scale-[1.02]'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60 font-medium'
                      }`}
                    >
                      <span className="text-sm font-bold">{opt.value}</span>
                      <span className="text-[10px] leading-tight opacity-90 line-clamp-1 hidden sm:block">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* スマホ用ラベル表示 (選択中のラベル) */}
              <div className="sm:hidden text-center text-[11px] text-slate-500 mt-2">
                {isAnswered ? (
                  <span className="text-indigo-600 font-semibold">
                    選択: {BFI_2_S_CONFIG.scaleLabels.find(l => l.value === selectedValue)?.label}
                  </span>
                ) : (
                  <span>1: 全くあてはまらない 〜 5: とてもよくあてはまる</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 送信アクションバー */}
      <div className="sticky bottom-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 flex items-center justify-between gap-4">
        <div className="text-xs">
          {isAllAnswered ? (
            <span className="text-emerald-600 font-bold flex items-center gap-1.5">
              <CheckCircle2 size={16} /> 全30問の回答が完了しました！
            </span>
          ) : (
            <span className="text-slate-500 flex items-center gap-1.5">
              <AlertCircle size={16} className="text-amber-500" />
              残り <strong className="text-slate-800">{totalQuestions - answeredCount}問</strong> 未回答です
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isAllAnswered || isSubmitting}
          className={`py-3 px-6 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 ${
            isAllAnswered && !isSubmitting
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-[0.98]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          <Sparkles size={16} />
          <span>{isSubmitting ? '照合中...' : '回答を送信して総合照合レポートを見る'}</span>
        </button>
      </div>
    </div>
  );
};
