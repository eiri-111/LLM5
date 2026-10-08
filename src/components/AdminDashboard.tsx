import React, { useState, useEffect, useMemo } from 'react';
import { AdminSessionRecord, ChatMessage, AnalysisResult } from '../types';
import {
  Download,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Trash2,
  Lock,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  MessageSquare,
  ArrowLeft,
  Copy,
  Check,
  BarChart3,
  LogOut,
  Layers,
  Sparkles
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToApp: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToApp }) => {
  // 認証パスワード管理 (sessionStorage)
  const [password, setPassword] = useState<string>(() => {
    try {
      return sessionStorage.getItem('llm5_admin_password') || '';
    } catch (_) {
      return '';
    }
  });
  const [inputPassword, setInputPassword] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // データ状態
  const [sessions, setSessions] = useState<AdminSessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(true);

  // 検索・フィルタリング・ソート
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'survey_done' | 'ai_done' | 'survey_pending'>('all');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'student_id'>('latest');

  // 詳細モーダル
  const [selectedSession, setSelectedSession] = useState<AdminSessionRecord | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'overview' | 'chat' | 'survey' | 'json'>('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 初回マウント時にパスワードが保持されていれば認証確認
  useEffect(() => {
    if (password) {
      verifyAndLoad(password);
    }
  }, []);

  const verifyAndLoad = async (pw: string) => {
    setIsVerifying(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pw
        },
        body: JSON.stringify({ password: pw })
      });

      if (!res.ok) {
        const data: any = await res.json().catch(() => ({}));
        throw new Error(data.error || 'パスワードが正しくありません');
      }

      setIsAuthenticated(true);
      try {
        sessionStorage.setItem('llm5_admin_password', pw);
      } catch (_) {}
      setPassword(pw);
      await fetchSessions(pw);
    } catch (err: any) {
      setAuthError(err.message || '認証に失敗しました');
      setIsAuthenticated(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword.trim()) {
      setAuthError('パスワードを入力してください');
      return;
    }
    verifyAndLoad(inputPassword.trim());
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('llm5_admin_password');
    } catch (_) {}
    setPassword('');
    setIsAuthenticated(false);
    setSessions([]);
  };

  // セッション一覧の取得
  const fetchSessions = async (pw: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/admin/sessions', {
        headers: {
          'x-admin-password': pw
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          handleLogout();
          throw new Error('セッションの有効期限が切れました。再ログインしてください。');
        }
        throw new Error(`データ取得エラー [${res.status}]`);
      }

      const data: any = await res.json();
      setSessions(data.sessions || []);
      setIsDbConnected(!data.mock);
    } catch (err: any) {
      console.error('Fetch sessions error:', err);
      setFetchError(err.message || 'セッションデータの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // セッション削除
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`セッション [${sessionId}] を削除しますか？\n（復元できません）`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: {
          'x-admin-password': password
        }
      });

      if (!res.ok) {
        throw new Error('削除リクエストが失敗しました');
      }

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
    }
  };

  // CSVダウンロード
  const handleDownloadCsv = () => {
    const url = `/api/export?format=csv&key=${encodeURIComponent(password)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm5_research_data_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // JSONダウンロード
  const handleDownloadJson = () => {
    const url = `/api/export?format=json&key=${encodeURIComponent(password)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm5_research_data_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 単一セッションJSONダウンロード
  const handleDownloadSingleSessionJson = (session: AdminSessionRecord) => {
    const jsonStr = JSON.stringify(session, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${session.student_id || session.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // クリップボードコピー
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // フィルタリング & ソート
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // 検索クエリ
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s => {
        return (
          s.id.toLowerCase().includes(q) ||
          (s.student_id && s.student_id.toLowerCase().includes(q)) ||
          (s.qualtrics_id && s.qualtrics_id.toLowerCase().includes(q)) ||
          (s.ai_personality_title && s.ai_personality_title.toLowerCase().includes(q)) ||
          (s.ai_personality_type && s.ai_personality_type.toLowerCase().includes(q))
        );
      });
    }

    // ステータスフィルタ
    if (statusFilter === 'survey_done') {
      result = result.filter(s => s.has_survey_completed || s.qualtrics_id || s.survey_completed_at);
    } else if (statusFilter === 'ai_done') {
      result = result.filter(s => s.has_ai_result || s.ai_personality_title);
    } else if (statusFilter === 'survey_pending') {
      result = result.filter(s => !(s.has_survey_completed || s.qualtrics_id || s.survey_completed_at));
    }

    // ソート
    result.sort((a, b) => {
      if (sortOrder === 'latest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortOrder === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortOrder === 'student_id') {
        return (a.student_id || '').localeCompare(b.student_id || '');
      }
      return 0;
    });

    return result;
  }, [sessions, searchQuery, statusFilter, sortOrder]);

  // 集計統計
  const stats = useMemo(() => {
    const total = sessions.length;
    const aiCompleted = sessions.filter(s => s.has_ai_result || s.ai_personality_title).length;
    const surveyCompleted = sessions.filter(s => s.has_survey_completed || s.qualtrics_id || s.survey_completed_at).length;
    const totalTurns = sessions.reduce((acc, s) => acc + (s.dialogue_turns || 0), 0);
    const avgTurns = total > 0 ? (totalTurns / total).toFixed(1) : '0';

    return { total, aiCompleted, surveyCompleted, avgTurns };
  }, [sessions]);

  // 1. 認証前のログイン画面（アプリ本体と統一されたクリーンなホワイトカード）
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col justify-center items-center px-4 font-sans">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-8">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Lock size={26} />
            </div>
          </div>

          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold mb-2">
              <Sparkles size={12} />
              ADMIN CONSOLE
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              研究データ管理コンソール
            </h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              対話ログ、BFI-2-S質問紙データの一括照合・ダウンロード用管理画面です。
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                管理者パスワード
              </label>
              <input
                type="password"
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
                placeholder="管理者パスワードを入力"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm"
                autoFocus
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-medium">
                <AlertCircle size={15} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>認証確認中...</span>
                </>
              ) : (
                <>
                  <Lock size={16} />
                  <span>管理画面に入る</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <button
              onClick={onBackToApp}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>性格診断トップページへ戻る</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 認証後のダッシュボード画面（ホワイト＆スレートテーマ）
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      {/* トップナビゲーションバー */}
      <header className="bg-white/95 border-b border-slate-200 sticky top-0 z-30 backdrop-blur shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
              <BarChart3 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight">
                  LLM5 研究データ管理コンソール
                </h1>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  isDbConnected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {isDbConnected ? 'D1 接続中' : 'ローカル / モック'}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                ビッグファイブAI対話ログ・BFI-2-S質問紙照合データ閲覧 & ダウンロード
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => fetchSessions(password)}
              disabled={isLoading}
              title="データを再読み込み"
              className="p-2 sm:px-3 sm:py-2 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200 shadow-2xs cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">更新</span>
            </button>

            <button
              onClick={onBackToApp}
              className="px-3 py-2 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200 shadow-2xs cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">診断画面へ戻る</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 sm:px-3 sm:py-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-rose-200 cursor-pointer"
              title="ログアウト"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツエリア */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPIサマリーカード */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">総セッション数</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <User size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {stats.total}
              <span className="text-xs font-normal text-slate-400 ml-1.5">件</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">実施・登録された全被験者数</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">AI分析完了</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {stats.aiCompleted}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                ({stats.total > 0 ? Math.round((stats.aiCompleted / stats.total) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">プロファイリング完了数</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">質問紙 (BFI-2-S) 完了</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileSpreadsheet size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">
              {stats.surveyCompleted}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                ({stats.total > 0 ? Math.round((stats.surveyCompleted / stats.total) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">尺度照合データ取得済み</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">平均対話ターン数</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <MessageSquare size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600">
              {stats.avgTurns}
              <span className="text-xs font-normal text-slate-400 ml-1.5">ターン</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">1セッションあたりの会話数</p>
          </div>
        </div>

        {/* ダウンロード & 操作ツールバー */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownloadCsv}
              disabled={sessions.length === 0}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              <span>CSVダウンロード (UTF-8 BOM付)</span>
            </button>

            <button
              onClick={handleDownloadJson}
              disabled={sessions.length === 0}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <FileCode size={16} />
              <span>JSON一括ダウンロード</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>※ CSVはExcel・SPSS・R等で文字化けせず即座に集計可能です</span>
          </div>
        </div>

        {/* 検索・フィルター・ソートバー */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="学籍番号、セッションID、性格タイプで検索..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition shadow-2xs"
            >
              <option value="all">すべてのステータス ({sessions.length})</option>
              <option value="survey_done">質問紙 (BFI-2-S) 完了のみ</option>
              <option value="ai_done">AI性格分析完了のみ</option>
              <option value="survey_pending">質問紙未完了のみ</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition shadow-2xs"
            >
              <option value="latest">実施日時が新しい順</option>
              <option value="oldest">実施日時が古い順</option>
              <option value="student_id">学籍番号順</option>
            </select>
          </div>
        </div>

        {/* エラー表示 */}
        {fetchError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={() => fetchSessions(password)}
              className="text-xs underline hover:text-rose-900 cursor-pointer font-bold"
            >
              再試行
            </button>
          </div>
        )}

        {/* セッション一覧テーブル */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-bold">被験者 / ID</th>
                  <th className="py-3.5 px-4 font-bold">年齢 / 性別</th>
                  <th className="py-3.5 px-4 font-bold">実施日時</th>
                  <th className="py-3.5 px-4 font-bold">対話</th>
                  <th className="py-3.5 px-4 font-bold">AIスコア (O C E A N)</th>
                  <th className="py-3.5 px-4 font-bold">質問紙 (BFI-2-S)</th>
                  <th className="py-3.5 px-4 font-bold text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-indigo-600" />
                        <span>データを読み込み中...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      {sessions.length === 0
                        ? '登録されたセッションデータはまだありません。'
                        : '条件に一致するセッションは見つかりませんでした。'}
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map(session => {
                    const hasSurvey = Boolean(session.has_survey_completed || session.qualtrics_id || session.survey_completed_at);
                    const hasAi = Boolean(session.has_ai_result || session.ai_personality_title);

                    return (
                      <tr
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className="hover:bg-slate-50/80 transition cursor-pointer group"
                      >
                        {/* 被験者 / ID */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {session.student_id || '未設定'}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono">
                              {session.id.slice(0, 16)}...
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(session.id, session.id);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                              title="セッションIDをコピー"
                            >
                              {copiedId === session.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>

                        {/* 年齢 / 性別 */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">
                            {session.age ? `${session.age}歳` : '-'}
                          </span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-slate-600">
                            {session.gender === 'male' ? '男性' : session.gender === 'female' ? '女性' : session.gender || '-'}
                          </span>
                        </td>

                        {/* 実施日時 */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                          {new Date(session.created_at).toLocaleString('ja-JP', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>

                        {/* 対話 */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            <MessageSquare size={12} className="text-slate-500" />
                            {session.dialogue_turns || 0}ターン
                          </span>
                        </td>

                        {/* AIスコア */}
                        <td className="py-3.5 px-4">
                          {hasAi && session.ai_openness !== null && session.ai_openness !== undefined ? (
                            <div className="space-y-1">
                              <div className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                                {session.ai_personality_title}
                              </div>
                              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                <span className="text-emerald-600 font-bold">O:{Math.round(session.ai_openness)}</span>
                                <span className="text-blue-600 font-bold">C:{Math.round(session.ai_conscientiousness ?? 0)}</span>
                                <span className="text-amber-600 font-bold">E:{Math.round(session.ai_extraversion ?? 0)}</span>
                                <span className="text-purple-600 font-bold">A:{Math.round(session.ai_agreeableness ?? 0)}</span>
                                <span className="text-rose-600 font-bold">N:{Math.round(session.ai_neuroticism ?? 0)}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">分析未実行</span>
                          )}
                        </td>

                        {/* 質問紙スコア */}
                        <td className="py-3.5 px-4">
                          {hasSurvey && session.survey_openness !== null && session.survey_openness !== undefined ? (
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {session.survey_scale_type?.toUpperCase() || 'BFI-2-S'}
                              </span>
                              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                <span className="text-emerald-600 font-bold">O:{Math.round(session.survey_openness)}</span>
                                <span className="text-blue-600 font-bold">C:{Math.round(session.survey_conscientiousness ?? 0)}</span>
                                <span className="text-amber-600 font-bold">E:{Math.round(session.survey_extraversion ?? 0)}</span>
                                <span className="text-purple-600 font-bold">A:{Math.round(session.survey_agreeableness ?? 0)}</span>
                                <span className="text-rose-600 font-bold">N:{Math.round(session.survey_neuroticism ?? 0)}</span>
                              </div>
                            </div>
                          ) : hasSurvey ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                              <Clock size={11} /> 回答済 (スコア集計中)
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">未回答</span>
                          )}
                        </td>

                        {/* アクション */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSession(session);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                              title="詳細ログ・対話を見る"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadSingleSessionJson(session);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="単一セッションJSONを保存"
                            >
                              <Download size={16} />
                            </button>

                            <button
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="セッションを削除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* セッション詳細モーダル（ホワイト＆スレートテーマ） */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto">
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>被験者: {selectedSession.student_id || '未設定'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                      {selectedSession.id}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    実施日時: {new Date(selectedSession.created_at).toLocaleString('ja-JP')} | 年齢: {selectedSession.age}歳 | 性別: {selectedSession.gender}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSingleSessionJson(selectedSession)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-200 shadow-2xs"
                >
                  <Download size={14} />
                  <span>JSON保存</span>
                </button>

                <button
                  onClick={() => setSelectedSession(null)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* モーダルタブ切り替え */}
            <div className="flex border-b border-slate-200 px-6 bg-white text-xs font-semibold">
              <button
                onClick={() => setActiveModalTab('overview')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'overview'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 size={14} />
                <span>分析サマリー & スコア比較</span>
              </button>

              <button
                onClick={() => setActiveModalTab('chat')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'chat'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare size={14} />
                <span>対話ログ全文 ({selectedSession.dialogue_turns || 0}ターン)</span>
              </button>

              <button
                onClick={() => setActiveModalTab('survey')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'survey'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet size={14} />
                <span>質問紙回答データ</span>
              </button>

              <button
                onClick={() => setActiveModalTab('json')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'json'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileCode size={14} />
                <span>Raw JSON</span>
              </button>
            </div>

            {/* モーダル本文 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              {/* タブ1: サマリー & スコア比較 */}
              {activeModalTab === 'overview' && (
                <div className="space-y-6">
                  {/* スコア対比カード */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
                      <BarChart3 size={16} className="text-indigo-600" />
                      <span>ビッグファイブ5因子 スコア対比 (0〜100正規化)</span>
                    </h3>

                    <div className="grid grid-cols-5 gap-3 text-center">
                      {[
                        { key: 'openness', name: '開放性 (O)', ai: selectedSession.ai_openness, survey: selectedSession.survey_openness, color: 'text-emerald-600' },
                        { key: 'conscientiousness', name: '誠実性 (C)', ai: selectedSession.ai_conscientiousness, survey: selectedSession.survey_conscientiousness, color: 'text-blue-600' },
                        { key: 'extraversion', name: '外向性 (E)', ai: selectedSession.ai_extraversion, survey: selectedSession.survey_extraversion, color: 'text-amber-600' },
                        { key: 'agreeableness', name: '協調性 (A)', ai: selectedSession.ai_agreeableness, survey: selectedSession.survey_agreeableness, color: 'text-purple-600' },
                        { key: 'neuroticism', name: '情緒安定性 (N)', ai: selectedSession.ai_neuroticism, survey: selectedSession.survey_neuroticism, color: 'text-rose-600' }
                      ].map(d => {
                        const aiVal = d.ai !== null && d.ai !== undefined ? Math.round(d.ai) : null;
                        const surveyVal = d.survey !== null && d.survey !== undefined ? Math.round(d.survey) : null;
                        const diff = (aiVal !== null && surveyVal !== null) ? Math.abs(aiVal - surveyVal) : null;

                        return (
                          <div key={d.key} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                            <div className="text-xs font-bold text-slate-700 mb-2">{d.name}</div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">AI:</span>
                                <span className={`font-mono font-bold ${d.color}`}>{aiVal !== null ? aiVal : '-'}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">質問紙:</span>
                                <span className="font-mono font-bold text-indigo-600">{surveyVal !== null ? surveyVal : '-'}</span>
                              </div>
                              {diff !== null && (
                                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 font-semibold">
                                  差異: <span className="font-mono text-slate-800">{diff}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI性格タイトル & サマリー */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">AI分析キャッチコピー</span>
                      <h4 className="text-lg font-bold text-slate-900 mt-1">
                        {selectedSession.ai_personality_title || '未分析'}
                      </h4>
                      {selectedSession.ai_personality_type && (
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          タイプ: {selectedSession.ai_personality_type}
                        </span>
                      )}
                    </div>

                    {selectedSession.ai_summary && (
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">プロファイル サマリー</span>
                        <p className="text-sm text-slate-700 leading-relaxed mt-1">
                          {selectedSession.ai_summary}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* タブ2: 対話ログ全文 */}
              {activeModalTab === 'chat' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-200 pb-2">
                    <span>心理カウンセラー「Dr. OCEAN」と被験者の対話履歴</span>
                    <span className="font-semibold">往復数: {selectedSession.dialogue_turns || 0} ターン</span>
                  </div>

                  {(() => {
                    let messages: ChatMessage[] = [];
                    try {
                      if (selectedSession.parsed_messages) {
                        messages = selectedSession.parsed_messages;
                      } else if (selectedSession.chat_messages) {
                        messages = JSON.parse(selectedSession.chat_messages);
                      }
                    } catch (_) {}

                    if (messages.length === 0) {
                      return (
                        <div className="py-8 text-center text-slate-400">
                          対話ログが記録されていません。
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {messages.map((m, idx) => {
                          const isUser = m.role === 'user';
                          return (
                            <div
                              key={idx}
                              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                            >
                              <div className="text-[10px] text-slate-400 mb-1 px-1">
                                {isUser ? `被験者 (${selectedSession.student_id || 'ユーザー'})` : 'Dr. OCEAN (AI分析官)'}
                              </div>
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                  isUser
                                    ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                                    : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-bl-xs'
                                }`}
                              >
                                {m.content}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* タブ3: 質問紙回答データ */}
              {activeModalTab === 'survey' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500">回答完了日時:</span>
                        <div className="text-sm font-semibold text-slate-800 mt-0.5">
                          {selectedSession.survey_completed_at
                            ? new Date(selectedSession.survey_completed_at).toLocaleString('ja-JP')
                            : '未完了'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">使用尺度名:</span>
                        <div className="text-sm font-semibold text-slate-800 mt-0.5">
                          {selectedSession.survey_scale_name || selectedSession.survey_scale_type || 'BFI-2-S'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    let answers: Record<string | number, number> | null = null;
                    try {
                      if (selectedSession.parsed_survey_answers) {
                        answers = selectedSession.parsed_survey_answers;
                      } else if (selectedSession.survey_raw_answers) {
                        answers = JSON.parse(selectedSession.survey_raw_answers);
                      }
                    } catch (_) {}

                    if (!answers || Object.keys(answers).length === 0) {
                      return (
                        <div className="py-8 text-center text-slate-400">
                          設問ごとの生回答データはありません。
                        </div>
                      );
                    }

                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                          設問ごとの回答値 (1〜5点 5件法)
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {Object.entries(answers).map(([qKey, val]) => (
                            <div key={qKey} className="bg-white border border-slate-200 rounded-xl p-2.5 text-center shadow-2xs">
                              <div className="text-[11px] text-slate-500 font-semibold">Q{qKey}</div>
                              <div className="text-base font-mono font-extrabold text-indigo-600 mt-0.5">{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* タブ4: Raw JSON */}
              {activeModalTab === 'json' && (
                <div className="relative">
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(selectedSession, null, 2), 'raw_json')}
                    className="absolute right-4 top-4 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === 'raw_json' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>コピー</span>
                  </button>
                  <pre className="bg-slate-900 text-slate-200 p-4 rounded-2xl border border-slate-800 text-xs font-mono overflow-x-auto max-h-[500px]">
                    {JSON.stringify(selectedSession, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">セッション: {selectedSession.id}</span>
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
