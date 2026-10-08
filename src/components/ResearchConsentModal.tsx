import React, { useState } from 'react';
import { ShieldCheck, FileText, User, Check, AlertCircle } from 'lucide-react';
import { UserProfile, GenderType } from '../types';

interface ResearchConsentModalProps {
  initialProfile: UserProfile | null;
  onConsentAndSubmit: (profile: UserProfile) => void;
}

export const ResearchConsentModal: React.FC<ResearchConsentModalProps> = ({
  initialProfile,
  onConsentAndSubmit
}) => {
  const [age, setAge] = useState<string>(
    initialProfile?.age ? String(initialProfile.age) : ''
  );
  const [gender, setGender] = useState<GenderType>(
    (initialProfile?.gender as GenderType) || 'male'
  );
  const [studentId, setStudentId] = useState<string>(
    initialProfile?.student_id || ''
  );
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAgreed) {
      setErrorMessage('研究参加への同意チェックボックスにチェックを入れてください。');
      return;
    }

    const parsedAge = parseInt(age, 10);
    if (!age || isNaN(parsedAge) || parsedAge < 10 || parsedAge > 120) {
      setErrorMessage('正しい年齢（半角数字）を入力してください。');
      return;
    }

    const profile: UserProfile = {
      age: parsedAge,
      gender,
      student_id: studentId.trim() || undefined
    };

    setErrorMessage(null);
    onConsentAndSubmit(profile);
  };

  return (
    <div className="modal-backdrop">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 m-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">RESEARCH ETHICS & CONSENT</span>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">研究へのご協力のお願い</h2>
          </div>
        </div>

        {/* 研究目的とデータ取り扱いの説明カード */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-2.5 mb-5 leading-relaxed">
          <div className="flex items-start gap-2">
            <FileText size={15} className="text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <strong className="text-slate-800">研究目的:</strong><br />
              本研究は、AI（大規模言語モデル）との対話から推定される性格特性と、国際標準心理尺度（BFI-2-S）の測定結果を比較検証し、より自然で高精度な性格理解手法の開発を目的としています。
            </div>
          </div>
          <div className="border-t border-slate-200/60 pt-2 space-y-1.5 text-slate-600">
            <div>
              <strong className="text-slate-800">🔒 データの取り扱いとプライバシー保護:</strong>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              <li>収集された対話ログおよびアンケート回答は、厳重に暗号化され、学術研究（論文・学会発表等）にのみ使用されます。</li>
              <li>氏名や連絡先等の直接的な個人情報は収集せず、ランダムな識別IDを用いて匿名・仮名化して安全に管理されます。</li>
              <li>研究への参加はご自身の自由意思によるものであり、途中でいつでも中断・中止できます。不参加や中断によって不利益を被ることは一切ありません。</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本属性入力 (年齢・性別) */}
          <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <User size={14} className="text-indigo-600" />
              <span>事前のご回答（分析精度向上のため）</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 年齢 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  年齢 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max="120"
                    placeholder="例: 21"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                    className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">歳</span>
                </div>
              </div>

              {/* 性別 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  性別 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as GenderType)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">その他</option>
                  <option value="prefer_not_to_say">回答しない</option>
                </select>
              </div>
            </div>

            {/* 学籍番号 / 被験者ID (任意) */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                学籍番号 / 参加者ID <span className="text-slate-400 font-normal">(任意)</span>
              </label>
              <input
                type="text"
                placeholder="例: KGU12345 (指定がある場合のみ)"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 同意チェックボックス */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
              />
              <span className="text-xs font-semibold text-slate-800 leading-snug">
                上記の研究目的およびデータの取り扱いについて理解し、同意の上で診断に参加します。
              </span>
            </label>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-1.5 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={!hasAgreed || !age}
            className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
              hasAgreed && age
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-[0.99]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            <Check size={16} />
            <span>同意してAI対話診断を開始する</span>
          </button>
        </form>
      </div>
    </div>
  );
};
