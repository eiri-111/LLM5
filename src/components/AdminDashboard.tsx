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
  Layers
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
    setSelectedSession(null);
  };

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
          throw new Error('セッションの有効期限が切れたか、パスワードが無効です');
        }
        throw new Error(`データ取得エラー (${res.status})`);
      }

      const data: any = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
        setIsDbConnected(data.is_db_connected !== false);
      } else {
        throw new Error(data.error || 'データ取得に失敗しました');
      }
    } catch (err: any) {
      setFetchError(err.message || 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`セッション「${id}」を削除しますか？\nこの操作は元に戻せません。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'x-admin-password': password
        }
      });

      if (!res.ok) {
        throw new Error('削除に失敗しました');
      }

      setSessions(prev => prev.filter(s => s.id !== id));
      if (selectedSession?.id === id) {
        setSelectedSession(null);
      }
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
    }
  };

  const handleDownloadCsv = () => {
    const url = `/api/admin/export?format=csv&key=${encodeURIComponent(password)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm5_research_data_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadJson = () => {
    const url = `/api/admin/export?format=json&key=${encodeURIComponent(password)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm5_research_data_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSingleSessionJson = (session: AdminSessionRecord) => {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${session.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // フィルタリング & ソート
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // 検索フィルタ
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(s =>
        (s.student_id && s.student_id.toLowerCase().includes(query)) ||
        (s.id && s.id.toLowerCase().includes(query)) ||
        (s.qualtrics_id && s.qualtrics_id.toLowerCase().includes(query)) ||
        (s.ai_personality_type && s.ai_personality_type.toLowerCase().includes(query)) ||
        (s.ai_personality_title && s.ai_personality_title.toLowerCase().includes(query))
      );
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

  // 1. 認証前のログイン画面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 font-sans">
        <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Lock size={32} />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-white mb-2">
            LLM5 研究データ管理画面
          </h1>
          <p className="text-sm text-slate-400 text-center mb-6">
            収集された診断セッション、AI対話ログ、質問紙データを閲覧・一括ダウンロードできます。パスワードを入力してください。
          </p>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                管理者パスワード
              </label>
              <input
                type="password"
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
                placeholder="パスワードを入力"
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                autoFocus
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                <AlertCircle size={16} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>認証確認中...</span>
                </>
              ) : (
                <>
                  <Lock size={18} />
                  <span>管理画面に入る</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700/60 text-center">
            <button
              onClick={onBackToApp}
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition"
            >
              <ArrowLeft size={16} />
              <span>性格診断トップページへ戻る</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 認証後のダッシュボード画面
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* トップナビゲーションバー */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <BarChart3 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white text-base sm:text-lg leading-tight">
                  LLM5 研究データ管理コンソール
                </h1>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  isDbConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {isDbConnected ? 'D1 接続中' : 'ローカル / モック'}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                ビッグファイブAI対話ログ・質問紙照合データ閲覧 & ダウンロード
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => fetchSessions(password)}
              disabled={isLoading}
              title="データを再読み込み"
              className="p-2 sm:px-3 sm:py-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">更新</span>
            </button>

            <button
              onClick={onBackToApp}
              className="px-3 py-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">診断画面へ</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 sm:px-3 sm:py-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border border-rose-500/20"
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
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">総セッション数</span>
              <User size={18} className="text-indigo-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {stats.total}
              <span className="text-xs font-normal text-slate-400 ml-1.5">件</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">実施・登録された全被験者数</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">AI分析完了</span>
              <CheckCircle2 size={18} className="text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {stats.aiCompleted}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                ({stats.total > 0 ? Math.round((stats.aiCompleted / stats.total) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">プロファイリング完了数</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">質問紙 (Qualtrics) 完了</span>
              <FileSpreadsheet size={18} className="text-sky-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-sky-400">
              {stats.surveyCompleted}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                ({stats.total > 0 ? Math.round((stats.surveyCompleted / stats.total) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">尺度照合データ取得済み</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">平均対話ターン数</span>
              <MessageSquare size={18} className="text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
              {stats.avgTurns}
              <span className="text-xs font-normal text-slate-400 ml-1.5">ターン</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">1セッションあたりの会話数</p>
          </div>
        </div>

        {/* ダウンロード & 操作ツールバー */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              disabled={sessions.length === 0}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium rounded-lg text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              <FileSpreadsheet size={16} />
              <span>CSVダウンロード (UTF-8 BOM付)</span>
            </button>

            <button
              onClick={handleDownloadJson}
              disabled={sessions.length === 0}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-lg text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              <FileCode size={16} />
              <span>JSON一括ダウンロード</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
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
              placeholder="学籍番号、セッションID、Qualtrics ID、性格タイプで検索..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="all">すべてのステータス ({sessions.length})</option>
              <option value="survey_done">質問紙 (Qualtrics) 完了のみ</option>
              <option value="ai_done">AI性格分析完了のみ</option>
              <option value="survey_pending">質問紙未完了のみ</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="latest">実施日時が新しい順</option>
              <option value="oldest">実施日時が古い順</option>
              <option value="student_id">学籍番号順</option>
            </select>
          </div>
        </div>

        {/* エラー表示 */}
        {fetchError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={() => fetchSessions(password)}
              className="text-xs underline hover:text-rose-300"
            >
              再試行
            </button>
          </div>
        )}

        {/* セッション一覧テーブル */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">被験者 / ID</th>
                  <th className="py-3.5 px-4 font-semibold">年齢 / 性別</th>
                  <th className="py-3.5 px-4 font-semibold">実施日時</th>
                  <th className="py-3.5 px-4 font-semibold">対話</th>
                  <th className="py-3.5 px-4 font-semibold">AIビッグファイブスコア (O C E A N)</th>
                  <th className="py-3.5 px-4 font-semibold">質問紙スコア</th>
                  <th className="py-3.5 px-4 font-semibold">Qualtrics ID</th>
                  <th className="py-3.5 px-4 font-semibold text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-indigo-500" />
                        <span>データを読み込み中...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
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
                        className="hover:bg-slate-800/40 transition cursor-pointer group"
                      >
                        {/* 被験者 / ID */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">
                            {session.student_id || '未設定'}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono text-slate-400">
                              {session.id.slice(0, 16)}...
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(session.id, session.id);
                              }}
                              className="text-slate-500 hover:text-slate-300 p-0.5"
                              title="セッションIDをコピー"
                            >
                              {copiedId === session.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>

                        {/* 年齢 / 性別 */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-slate-200">
                            {session.age ? `${session.age}歳` : '未設定'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {session.gender === 'male' ? '男性' : session.gender === 'female' ? '女性' : session.gender || 'その他'}
                          </div>
                        </td>

                        {/* 実施日時 */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-300 text-xs">
                          {new Date(session.created_at).toLocaleString('ja-JP', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>

                        {/* 対話ターン数 */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            <MessageSquare size={11} />
                            {session.dialogue_turns || session.messages_count || 0}
                          </span>
                        </td>

                        {/* AIビッグファイブスコア */}
                        <td className="py-3 px-4">
                          {hasAi ? (
                            <div className="space-y-1">
                              {session.ai_personality_title && (
                                <div className="text-xs font-medium text-indigo-300 truncate max-w-[200px]" title={session.ai_personality_title}>
                                  {session.ai_personality_title}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                <span className="text-emerald-400" title="開放性 (O)">O:{Math.round(session.ai_openness ?? 0)}</span>
                                <span className="text-blue-400" title="誠実性 (C)">C:{Math.round(session.ai_conscientiousness ?? 0)}</span>
                                <span className="text-amber-400" title="外向性 (E)">E:{Math.round(session.ai_extraversion ?? 0)}</span>
                                <span className="text-purple-400" title="協調性 (A)">A:{Math.round(session.ai_agreeableness ?? 0)}</span>
                                <span className="text-rose-400" title="情緒安定性 (N)">N:{Math.round(session.ai_neuroticism ?? 0)}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">分析未実行</span>
                          )}
                        </td>

                        {/* 質問紙スコア */}
                        <td className="py-3 px-4">
                          {hasSurvey && session.survey_openness !== null && session.survey_openness !== undefined ? (
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400">
                                {session.survey_scale_type?.toUpperCase() || '質問紙'}
                              </span>
                              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                <span className="text-emerald-400">O:{Math.round(session.survey_openness)}</span>
                                <span className="text-blue-400">C:{Math.round(session.survey_conscientiousness ?? 0)}</span>
                                <span className="text-amber-400">E:{Math.round(session.survey_extraversion ?? 0)}</span>
                                <span className="text-purple-400">A:{Math.round(session.survey_agreeableness ?? 0)}</span>
                                <span className="text-rose-400">N:{Math.round(session.survey_neuroticism ?? 0)}</span>
                              </div>
                            </div>
                          ) : hasSurvey ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              <Clock size={11} /> 回答済 (スコア未算出)
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 italic">未回答</span>
                          )}
                        </td>

                        {/* Qualtrics ID */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {session.qualtrics_id ? (
                            <span className="font-mono text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                              {session.qualtrics_id}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>

                        {/* アクション */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSession(session);
                              }}
                              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-md transition"
                              title="詳細ログ・対話を見る"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadSingleSessionJson(session);
                              }}
                              className="p-1.5 text-slate-300 hover:text-indigo-400 hover:bg-slate-700/60 rounded-md transition"
                              title="単一セッションJSONを保存"
                            >
                              <Download size={16} />
                            </button>

                            <button
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition"
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

      {/* セッション詳細モーダル */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto">
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>被験者: {selectedSession.student_id || '未設定'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                      {selectedSession.id}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    実施日時: {new Date(selectedSession.created_at).toLocaleString('ja-JP')} | 年齢: {selectedSession.age}歳 | 性別: {selectedSession.gender}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSingleSessionJson(selectedSession)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition flex items-center gap-1.5 border border-slate-700"
                >
                  <Download size={14} />
                  <span>JSON保存</span>
                </button>

                <button
                  onClick={() => setSelectedSession(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* モーダルタブ切り替え */}
            <div className="flex border-b border-slate-800 px-6 bg-slate-950/40 text-xs font-medium">
              <button
                onClick={() => setActiveModalTab('overview')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  activeModalTab === 'overview'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 size={14} />
                <span>分析サマリー & スコア比較</span>
              </button>

              <button
                onClick={() => setActiveModalTab('chat')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  activeModalTab === 'chat'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare size={14} />
                <span>対話ログ全文 ({selectedSession.dialogue_turns || 0}ターン)</span>
              </button>

              <button
                onClick={() => setActiveModalTab('survey')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  activeModalTab === 'survey'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet size={14} />
                <span>質問紙回答データ ({selectedSession.qualtrics_id || '未完了'})</span>
              </button>

              <button
                onClick={() => setActiveModalTab('json')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  activeModalTab === 'json'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
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
                  {/* スコア対比テーブル */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5">
                    <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                      <BarChart3 size={16} className="text-indigo-400" />
                      <span>ビッグファイブ5因子 スコア対比 (0〜100正規化)</span>
                    </h3>

                    <div className="grid grid-cols-5 gap-3 text-center">
                      {[
                        { key: 'openness', name: '開放性 (O)', ai: selectedSession.ai_openness, survey: selectedSession.survey_openness, color: 'text-emerald-400' },
                        { key: 'conscientiousness', name: '誠実性 (C)', ai: selectedSession.ai_conscientiousness, survey: selectedSession.survey_conscientiousness, color: 'text-blue-400' },
                        { key: 'extraversion', name: '外向性 (E)', ai: selectedSession.ai_extraversion, survey: selectedSession.survey_extraversion, color: 'text-amber-400' },
                        { key: 'agreeableness', name: '協調性 (A)', ai: selectedSession.ai_agreeableness, survey: selectedSession.survey_agreeableness, color: 'text-purple-400' },
                        { key: 'neuroticism', name: '情緒安定性 (N)', ai: selectedSession.ai_neuroticism, survey: selectedSession.survey_neuroticism, color: 'text-rose-400' }
                      ].map(d => {
                        const aiVal = d.ai !== null && d.ai !== undefined ? Math.round(d.ai) : null;
                        const surveyVal = d.survey !== null && d.survey !== undefined ? Math.round(d.survey) : null;
                        const diff = (aiVal !== null && surveyVal !== null) ? Math.abs(aiVal - surveyVal) : null;

                        return (
                          <div key={d.key} className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                            <div className="text-xs font-semibold text-slate-300 mb-2">{d.name}</div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">AI:</span>
                                <span className={`font-mono font-bold ${d.color}`}>{aiVal !== null ? aiVal : '-'}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">質問紙:</span>
                                <span className="font-mono font-bold text-sky-400">{surveyVal !== null ? surveyVal : '-'}</span>
                              </div>
                              {diff !== null && (
                                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                                  差異: <span className="font-mono text-slate-300">{diff}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI性格タイトル & サマリー */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div>
                      <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">AI分析キャッチコピー</span>
                      <h4 className="text-lg font-bold text-white mt-1">
                        {selectedSession.ai_personality_title || '未分析'}
                      </h4>
                      {selectedSession.ai_personality_type && (
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          タイプ: {selectedSession.ai_personality_type}
                        </span>
                      )}
                    </div>

                    {selectedSession.ai_summary && (
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">プロファイル サマリー</span>
                        <p className="text-sm text-slate-300 leading-relaxed mt-1">
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
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                    <span>心理カウンセラー「Dr. OCEAN」と被験者の対話履歴</span>
                    <span>往復数: {selectedSession.dialogue_turns || 0} ターン</span>
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
                        <div className="py-8 text-center text-slate-500">
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
                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                  isUser
                                    ? 'bg-indigo-600 text-white rounded-br-none'
                                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
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
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400">Qualtrics 回答ID:</span>
                        <div className="font-mono text-sm text-sky-400 mt-0.5">
                          {selectedSession.qualtrics_id || '未紐付け'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">回答完了日時:</span>
                        <div className="text-sm text-slate-200 mt-0.5">
                          {selectedSession.survey_completed_at
                            ? new Date(selectedSession.survey_completed_at).toLocaleString('ja-JP')
                            : '未完了'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">使用尺度名:</span>
                        <div className="text-sm text-slate-200 mt-0.5">
                          {selectedSession.survey_scale_name || selectedSession.survey_scale_type || '未指定'}
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
                        <div className="py-8 text-center text-slate-500">
                          設問ごとの生回答データはありません（Qualtricsで回答された場合はQualtrics側集計データと照合してください）。
                        </div>
                      );
                    }

                    return (
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                          設問ごとの回答値 (Likert Scale)
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {Object.entries(answers).map(([qKey, val]) => (
                            <div key={qKey} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                              <div className="text-[11px] text-slate-400">設問 {qKey}</div>
                              <div className="text-base font-mono font-bold text-sky-400 mt-1">{val}</div>
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
                    className="absolute right-4 top-4 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition border border-slate-700 flex items-center gap-1.5"
                  >
                    {copiedId === 'raw_json' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>コピー</span>
                  </button>
                  <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto max-h-[500px]">
                    {JSON.stringify(selectedSession, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
              <span>セッション: {selectedSession.id}</span>
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
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
