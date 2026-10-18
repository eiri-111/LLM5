import React, { useState, useEffect, useMemo } from 'react';
import { AdminSessionRecord, ChatMessage, AnalysisResult } from '../types';
import { BFI_2_S_CONFIG } from '../data/bfi2s';
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
  Users,
  MessageSquare,
  ArrowLeft,
  Copy,
  Check,
  BarChart3,
  LogOut,
  Sparkles,
  Database,
  HardDrive,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Info
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToApp: () => void;
}

type SortField =
  | 'created_at'
  | 'student_id'
  | 'dialogue_turns'
  | 'ai_openness'
  | 'ai_conscientiousness'
  | 'ai_extraversion'
  | 'ai_agreeableness'
  | 'ai_neuroticism';

type SortDirection = 'asc' | 'desc';

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
  const [isR2Connected, setIsR2Connected] = useState<boolean>(true);

  // 検索・フィルタリング・ソート
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'both_done' | 'ai_done' | 'survey_done' | 'pending'>('all');
  const [storageFilter, setStorageFilter] = useState<'all' | 'r2' | 'd1_only'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // ページネーション
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // 詳細モーダル & オンデマンドフェッチ
  const [selectedSession, setSelectedSession] = useState<AdminSessionRecord | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailSource, setDetailSource] = useState<'r2' | 'd1' | null>(null);
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

  // セッション一覧の高速取得 (軽量API)
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
      setIsDbConnected(data.is_db_connected !== false);
      setIsR2Connected(data.is_r2_connected !== false);
    } catch (err: any) {
      console.error('Fetch sessions error:', err);
      setFetchError(err.message || 'セッションデータの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // セッション詳細を開く (必要に応じてR2/D1から詳細完全データをオンデマンドフェッチ)
  const handleOpenDetail = async (session: AdminSessionRecord) => {
    setSelectedSession(session);
    setActiveModalTab('overview');
    setDetailSource(session.data_source || (session.r2_saved ? 'r2' : 'd1'));

    // まだ詳細ログや生回答が無い場合はオンデマンド取得
    if (!session.parsed_messages || session.parsed_messages.length === 0 || !session.parsed_ai_result) {
      setIsLoadingDetail(true);
      try {
        const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(session.id)}`, {
          headers: { 'x-admin-password': password }
        });
        if (res.ok) {
          const data: any = await res.json();
          if (data.session) {
            setSelectedSession(data.session);
            setDetailSource(data.source || (data.session.r2_saved ? 'r2' : 'd1'));
            // 一覧側のステータスも更新
            setSessions(prev =>
              prev.map(s => (s.id === session.id ? { ...s, ...data.session } : s))
            );
          }
        }
      } catch (err) {
        console.error('Detail lazy fetch error:', err);
      } finally {
        setIsLoadingDetail(false);
      }
    }
  };

  // セッション削除 (D1 + R2 完全連動削除)
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`セッション [${sessionId}] を完全に削除しますか？\n（D1レコードおよびR2オブジェクトの両方が削除され、復元できません）`)) {
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
    const url = `/api/admin/export?format=csv&key=${encodeURIComponent(password)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm5_research_data_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // JSONダウンロード
  const handleDownloadJson = () => {
    const url = `/api/admin/export?format=json&key=${encodeURIComponent(password)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm5_research_data_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 単一セッションJSONダウンロード (完全データ)
  const handleDownloadSingleSessionJson = async (session: AdminSessionRecord) => {
    let fullSession = session;
    if (!session.parsed_messages || session.parsed_messages.length === 0) {
      try {
        const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(session.id)}`, {
          headers: { 'x-admin-password': password }
        });
        if (res.ok) {
          const data: any = await res.json();
          if (data.session) fullSession = data.session;
        }
      } catch (_) {}
    }

    const jsonStr = JSON.stringify(fullSession, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${fullSession.student_id || fullSession.id}.json`;
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

  // テーブルヘッダークリックによるソート切り替え
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // フィルタリング & ソート処理
  const filteredAndSortedSessions = useMemo(() => {
    let result = [...sessions];

    // 検索クエリ
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s => {
        return (
          s.id.toLowerCase().includes(q) ||
          (s.student_id && s.student_id.toLowerCase().includes(q)) ||
          (s.ai_personality_title && s.ai_personality_title.toLowerCase().includes(q)) ||
          (s.ai_personality_type && s.ai_personality_type.toLowerCase().includes(q))
        );
      });
    }

    // ステータスフィルタ
    if (statusFilter === 'both_done') {
      result = result.filter(s => (s.has_ai_result || s.ai_personality_title) && (s.has_survey_completed || s.survey_completed_at));
    } else if (statusFilter === 'ai_done') {
      result = result.filter(s => (s.has_ai_result || s.ai_personality_title) && !(s.has_survey_completed || s.survey_completed_at));
    } else if (statusFilter === 'survey_done') {
      result = result.filter(s => !(s.has_ai_result || s.ai_personality_title) && (s.has_survey_completed || s.survey_completed_at));
    } else if (statusFilter === 'pending') {
      result = result.filter(s => !(s.has_ai_result || s.ai_personality_title) && !(s.has_survey_completed || s.survey_completed_at));
    }

    // ストレージフィルタ
    if (storageFilter === 'r2') {
      result = result.filter(s => Boolean(s.r2_saved));
    } else if (storageFilter === 'd1_only') {
      result = result.filter(s => !s.r2_saved);
    }

    // ソート
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'created_at') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      } else {
        valA = valA ?? -1;
        valB = valB ?? -1;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [sessions, searchQuery, statusFilter, storageFilter, sortField, sortDirection]);

  // ページネーション計算
  const totalPages = Math.ceil(filteredAndSortedSessions.length / pageSize) || 1;
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedSessions.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedSessions, currentPage, pageSize]);

  // 統計・サマリー計算
  const stats = useMemo(() => {
    const total = sessions.length;
    const aiCompleted = sessions.filter(s => s.has_ai_result || s.ai_personality_title).length;
    const surveyCompleted = sessions.filter(s => s.has_survey_completed || s.survey_completed_at).length;
    const bothCompleted = sessions.filter(s => (s.has_ai_result || s.ai_personality_title) && (s.has_survey_completed || s.survey_completed_at)).length;
    const r2SavedCount = sessions.filter(s => Boolean(s.r2_saved)).length;
    const totalTurns = sessions.reduce((acc, s) => acc + (s.dialogue_turns || 0), 0);
    const avgTurns = total > 0 ? (totalTurns / total).toFixed(1) : '0';

    // 5因子の有効平均スコア計算
    const aiScores = {
      openness: [] as number[],
      conscientiousness: [] as number[],
      extraversion: [] as number[],
      agreeableness: [] as number[],
      neuroticism: [] as number[]
    };

    sessions.forEach(s => {
      if (s.ai_openness != null) aiScores.openness.push(s.ai_openness);
      if (s.ai_conscientiousness != null) aiScores.conscientiousness.push(s.ai_conscientiousness);
      if (s.ai_extraversion != null) aiScores.extraversion.push(s.ai_extraversion);
      if (s.ai_agreeableness != null) aiScores.agreeableness.push(s.ai_agreeableness);
      if (s.ai_neuroticism != null) aiScores.neuroticism.push(s.ai_neuroticism);
    });

    const calcMean = (arr: number[]) => (arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

    return {
      total,
      aiCompleted,
      surveyCompleted,
      bothCompleted,
      r2SavedCount,
      avgTurns,
      means: {
        openness: calcMean(aiScores.openness),
        conscientiousness: calcMean(aiScores.conscientiousness),
        extraversion: calcMean(aiScores.extraversion),
        agreeableness: calcMean(aiScores.agreeableness),
        neuroticism: calcMean(aiScores.neuroticism)
      }
    };
  }, [sessions]);

  // 1. ログイン画面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center px-4 font-sans">
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl shadow-xl p-8">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
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

  // 2. メインダッシュボード画面
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* トップナビゲーションバー */}
      <header className="bg-white/95 border-b border-slate-200 sticky top-0 z-30 backdrop-blur shadow-xs">
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
                {/* D1 / R2 ステータスバッジ */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${
                      isDbConnected
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <Database size={11} />
                    <span>{isDbConnected ? 'D1 接続中' : 'D1 未接続'}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${
                      isR2Connected
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <HardDrive size={11} />
                    <span>{isR2Connected ? 'R2 連携中' : 'R2 未接続'}</span>
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                D1メタデータ・R2大容量オブジェクト分離構成 | BFI-2-S照合データ分析
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

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI サマリーカード 5枚グリッド */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 総セッション数 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">総セッション数</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users size={15} />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {stats.total}
              <span className="text-xs font-normal text-slate-400 ml-1">件</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">実施登録された全被験者</p>
          </div>

          {/* 完全完了 (AI + 質問紙) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">完全完了 (有効)</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={15} />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-emerald-600">
              {stats.bothCompleted}
              <span className="text-xs font-normal text-slate-400 ml-1">
                ({stats.total > 0 ? Math.round((stats.bothCompleted / stats.total) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">AI診断＆質問紙の両方完了</p>
          </div>

          {/* AI分析完了 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">AI分析完了</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Sparkles size={15} />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-indigo-600">
              {stats.aiCompleted}
              <span className="text-xs font-normal text-slate-400 ml-1">
                ({stats.total > 0 ? Math.round((stats.aiCompleted / stats.total) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">性格プロファイリング完了</p>
          </div>

          {/* 質問紙完了 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">BFI-2-S 回答済</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileSpreadsheet size={15} />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-blue-600">
              {stats.surveyCompleted}
              <span className="text-xs font-normal text-slate-400 ml-1">
                ({stats.total > 0 ? Math.round((stats.surveyCompleted / stats.total) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">30問の心理尺度完了</p>
          </div>

          {/* 平均対話ターン数 & R2保存 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">平均対話ターン</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <MessageSquare size={15} />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-amber-600">
              {stats.avgTurns}
              <span className="text-xs font-normal text-slate-400 ml-1">ターン</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">R2保存済: {stats.r2SavedCount}件</p>
          </div>
        </div>

        {/* 5因子 (OCEAN) 母集団平均スコア ミニウィジェット */}
        {stats.total > 0 && stats.means.openness !== null && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">
                  全被験者 Big Five 5因子 AI推定平均値 (0〜100正規化)
                </span>
              </div>
              <span className="text-[11px] text-slate-400">母集団傾向の簡易モニタリング</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: '開放性 (O)', val: stats.means.openness, color: 'bg-emerald-500', text: 'text-emerald-700' },
                { label: '誠実性 (C)', val: stats.means.conscientiousness, color: 'bg-blue-500', text: 'text-blue-700' },
                { label: '外向性 (E)', val: stats.means.extraversion, color: 'bg-amber-500', text: 'text-amber-700' },
                { label: '協調性 (A)', val: stats.means.agreeableness, color: 'bg-purple-500', text: 'text-purple-700' },
                { label: '情緒安定 (N)', val: stats.means.neuroticism, color: 'bg-rose-500', text: 'text-rose-700' }
              ].map(dim => (
                <div key={dim.label} className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600 font-semibold">{dim.label}</span>
                    <span className={`font-mono font-bold ${dim.text}`}>{dim.val ?? '-'}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${dim.color}`}
                      style={{ width: `${Math.min(100, Math.max(0, dim.val ?? 0))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* コントロールツールバー: 検索・フィルター・エクスポート */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* 検索入力 */}
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="学籍番号、セッションID、性格タイプ・タイトルで検索..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
              />
            </div>

            {/* ダウンロードボタン群 */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDownloadCsv}
                disabled={sessions.length === 0}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title="Excel・SPSSで文字化けしないUTF-8 BOM付きCSV"
              >
                <FileSpreadsheet size={15} />
                <span>CSVエクスポート</span>
              </button>

              <button
                onClick={handleDownloadJson}
                disabled={sessions.length === 0}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title="全セッションの詳細フルデータJSON"
              >
                <FileCode size={15} />
                <span>JSON一括保存</span>
              </button>
            </div>
          </div>

          {/* フィルター＆ページ設定 */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-slate-500 font-semibold mr-1">
                <SlidersHorizontal size={13} />
                <span>絞り込み:</span>
              </div>

              {/* ステータスフィルター */}
              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="all">すべてのステータス ({sessions.length})</option>
                <option value="both_done">完全完了 (AI + 質問紙)</option>
                <option value="ai_done">AI分析完了のみ</option>
                <option value="survey_done">質問紙完了のみ</option>
                <option value="pending">対話のみ (未完了)</option>
              </select>

              {/* ストレージフィルター */}
              <select
                value={storageFilter}
                onChange={e => {
                  setStorageFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="all">すべてのストレージ</option>
                <option value="r2">R2 オブジェクト保存済のみ</option>
                <option value="d1_only">D1 のみ</option>
              </select>
            </div>

            <div className="flex items-center gap-3 text-slate-500">
              <span className="hidden sm:inline">
                該当: <strong className="text-slate-800">{filteredAndSortedSessions.length}</strong> 件
              </span>
              <div className="flex items-center gap-1.5">
                <span>表示件数:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <option value={10}>10件</option>
                  <option value={25}>25件</option>
                  <option value={50}>50件</option>
                  <option value={100}>100件</option>
                </select>
              </div>
            </div>
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

        {/* メインテーブル */}
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead className="bg-slate-50/90 text-slate-600 uppercase text-[11px] tracking-wider border-b border-slate-200 select-none">
                <tr>
                  {/* 被験者 / ID */}
                  <th
                    onClick={() => handleSort('student_id')}
                    className="py-3 px-4 font-bold cursor-pointer hover:bg-slate-100/80 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>被験者 / ID</span>
                      {sortField === 'student_id' && (
                        sortDirection === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                      )}
                    </div>
                  </th>

                  {/* 年齢 / 性別 */}
                  <th className="py-3 px-3 font-bold">年齢 / 性別</th>

                  {/* 実施日時 */}
                  <th
                    onClick={() => handleSort('created_at')}
                    className="py-3 px-3 font-bold cursor-pointer hover:bg-slate-100/80 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>実施日時</span>
                      {sortField === 'created_at' && (
                        sortDirection === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                      )}
                    </div>
                  </th>

                  {/* ステータス */}
                  <th className="py-3 px-3 font-bold text-center">ステータス</th>

                  {/* 対話ターン */}
                  <th
                    onClick={() => handleSort('dialogue_turns')}
                    className="py-3 px-3 font-bold text-center cursor-pointer hover:bg-slate-100/80 transition"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>対話</span>
                      {sortField === 'dialogue_turns' && (
                        sortDirection === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                      )}
                    </div>
                  </th>

                  {/* 5因子スコア (O C E A N) - 上段: AI / 下段: 質問紙 */}
                  <th className="py-3 px-4 font-bold min-w-[280px]">
                    <div className="flex items-center justify-between">
                      <span>ビッグファイブ 5因子 (O C E A N)</span>
                      <span className="text-[10px] font-normal text-slate-400 lowercase">
                        上段:AI / 下段:質問紙
                      </span>
                    </div>
                  </th>

                  {/* ストレージ */}
                  <th className="py-3 px-3 font-bold text-center">ストレージ</th>

                  {/* 操作 */}
                  <th className="py-3 px-4 font-bold text-right">アクション</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-indigo-600" />
                        <span className="text-xs font-semibold">データを高速読み込み中...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-400">
                      {sessions.length === 0
                        ? '登録されたセッションデータはまだありません。'
                        : '条件に一致するセッションは見つかりませんでした。'}
                    </td>
                  </tr>
                ) : (
                  paginatedSessions.map(session => {
                    const hasSurvey = Boolean(session.has_survey_completed || session.survey_completed_at);
                    const hasAi = Boolean(session.has_ai_result || session.ai_personality_title);
                    const isBothDone = hasAi && hasSurvey;

                    return (
                      <tr
                        key={session.id}
                        onClick={() => handleOpenDetail(session)}
                        className="hover:bg-slate-50/80 transition cursor-pointer group"
                      >
                        {/* 被験者 / ID */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition">
                            {session.student_id || '学籍番号未設定'}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono">{session.id.slice(0, 14)}...</span>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                copyToClipboard(session.id, session.id);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                              title="セッションIDをコピー"
                            >
                              {copiedId === session.id ? (
                                <Check size={11} className="text-emerald-600" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 年齢 / 性別 */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">
                            {session.age ? `${session.age}歳` : '-'}
                          </span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="text-slate-600 text-xs">
                            {session.gender === 'male'
                              ? '男性'
                              : session.gender === 'female'
                              ? '女性'
                              : session.gender || '-'}
                          </span>
                        </td>

                        {/* 実施日時 */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                          <div>
                            {new Date(session.created_at).toLocaleDateString('ja-JP', {
                              month: 'numeric',
                              day: 'numeric'
                            })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(session.created_at).toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </td>

                        {/* ステータスバッジ */}
                        <td className="py-3 px-3 whitespace-nowrap text-center">
                          {isBothDone ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={11} />
                              <span>完全完了</span>
                            </span>
                          ) : hasAi ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Sparkles size={11} />
                              <span>AI分析済</span>
                            </span>
                          ) : hasSurvey ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <FileSpreadsheet size={11} />
                              <span>質問紙のみ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <Clock size={11} />
                              <span>対話中</span>
                            </span>
                          )}
                        </td>

                        {/* 対話ターン */}
                        <td className="py-3 px-3 whitespace-nowrap text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                            <MessageSquare size={11} className="text-slate-400" />
                            {session.dialogue_turns || 0}
                          </span>
                        </td>

                        {/* 5因子スコア (O C E A N) - 上下対比ミニバー表示 */}
                        <td className="py-2.5 px-4">
                          <div className="space-y-1">
                            {/* AIスコア (上段) */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">AI:</span>
                              {hasAi && session.ai_openness != null ? (
                                <div className="grid grid-cols-5 gap-1.5 flex-1">
                                  {[
                                    { label: 'O', val: session.ai_openness, color: 'bg-emerald-500', text: 'text-emerald-700' },
                                    { label: 'C', val: session.ai_conscientiousness, color: 'bg-blue-500', text: 'text-blue-700' },
                                    { label: 'E', val: session.ai_extraversion, color: 'bg-amber-500', text: 'text-amber-700' },
                                    { label: 'A', val: session.ai_agreeableness, color: 'bg-purple-500', text: 'text-purple-700' },
                                    { label: 'N', val: session.ai_neuroticism, color: 'bg-rose-500', text: 'text-rose-700' }
                                  ].map(item => (
                                    <div key={item.label} className="bg-slate-100/80 rounded px-1.5 py-0.5 text-center">
                                      <div className="flex items-center justify-between text-[10px] font-mono leading-none">
                                        <span className="text-slate-400 font-bold">{item.label}</span>
                                        <span className={`font-bold ${item.text}`}>{Math.round(item.val ?? 0)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">分析未実行</span>
                              )}
                            </div>

                            {/* 質問紙スコア (下段) */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">尺度:</span>
                              {hasSurvey && session.survey_openness != null ? (
                                <div className="grid grid-cols-5 gap-1.5 flex-1">
                                  {[
                                    { label: 'O', val: session.survey_openness, color: 'bg-emerald-500', text: 'text-emerald-700' },
                                    { label: 'C', val: session.survey_conscientiousness, color: 'bg-blue-500', text: 'text-blue-700' },
                                    { label: 'E', val: session.survey_extraversion, color: 'bg-amber-500', text: 'text-amber-700' },
                                    { label: 'A', val: session.survey_agreeableness, color: 'bg-purple-500', text: 'text-purple-700' },
                                    { label: 'N', val: session.survey_neuroticism, color: 'bg-rose-500', text: 'text-rose-700' }
                                  ].map(item => (
                                    <div key={item.label} className="bg-slate-100/80 rounded px-1.5 py-0.5 text-center">
                                      <div className="flex items-center justify-between text-[10px] font-mono leading-none">
                                        <span className="text-slate-400 font-bold">{item.label}</span>
                                        <span className={`font-bold ${item.text}`}>{Math.round(item.val ?? 0)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">未回答</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* ストレージバッジ */}
                        <td className="py-3 px-3 whitespace-nowrap text-center">
                          {session.r2_saved ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                              title="D1インデックス + R2完全ログ保存済み"
                            >
                              <HardDrive size={10} />
                              <span>D1 + R2</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                              title="D1のみ保存"
                            >
                              <Database size={10} />
                              <span>D1</span>
                            </span>
                          )}
                        </td>

                        {/* アクション */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleOpenDetail(session);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="詳細ログ・対話を見る"
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleDownloadSingleSessionJson(session);
                              }}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="完全データJSONを保存"
                            >
                              <Download size={15} />
                            </button>

                            <button
                              onClick={e => handleDeleteSession(session.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="セッションを完全削除 (D1+R2)"
                            >
                              <Trash2 size={15} />
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

          {/* ページネーションフッター */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                <span>全 </span>
                <strong className="text-slate-800">{filteredAndSortedSessions.length}</strong>
                <span> 件中 </span>
                <strong className="text-slate-800">
                  {(currentPage - 1) * pageSize + 1}〜
                  {Math.min(currentPage * pageSize, filteredAndSortedSessions.length)}
                </strong>
                <span> 件を表示</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  title="前のページへ"
                >
                  <ChevronLeft size={14} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;

                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1 text-slate-400">…</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                            currentPage === p
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  title="次のページへ"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* セッション詳細モーダル */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <User size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      被験者: {selectedSession.student_id || '学籍番号未設定'}
                    </h2>
                    {detailSource && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                          detailSource === 'r2'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {detailSource === 'r2' ? <HardDrive size={10} /> : <Database size={10} />}
                        <span>ソース: {detailSource.toUpperCase()}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ID: <span className="font-mono text-slate-700">{selectedSession.id}</span> | 実施: {new Date(selectedSession.created_at).toLocaleString('ja-JP')} | 年齢: {selectedSession.age ? `${selectedSession.age}歳` : '-'} | 性別: {selectedSession.gender || '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSingleSessionJson(selectedSession)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-200 shadow-2xs cursor-pointer"
                  title="完全JSONをダウンロード"
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
            <div className="flex border-b border-slate-200 px-6 bg-white text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setActiveModalTab('overview')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeModalTab === 'overview'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 size={14} />
                <span>分析サマリー & スコア対比</span>
              </button>

              <button
                onClick={() => setActiveModalTab('chat')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
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
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeModalTab === 'survey'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet size={14} />
                <span>質問紙回答データ (30問)</span>
              </button>

              <button
                onClick={() => setActiveModalTab('json')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeModalTab === 'json'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileCode size={14} />
                <span>生データ (Raw JSON)</span>
              </button>
            </div>

            {/* モーダル本文 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              {isLoadingDetail && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-xs flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>R2/D1 ストレージから詳細完全データを取得しています...</span>
                </div>
              )}

              {/* タブ1: 分析サマリー & スコア対比 */}
              {activeModalTab === 'overview' && (
                <div className="space-y-6">
                  {/* スコア対比カード (AI vs 質問紙) */}
                  <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <BarChart3 size={16} className="text-indigo-600" />
                        <span>ビッグファイブ5因子 スコア対比 (0〜100正規化)</span>
                      </h3>
                      <span className="text-xs text-slate-400">
                        乖離度: |AIスコア − 質問紙スコア|
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {[
                        {
                          key: 'openness',
                          name: '開放性 (O / Openness)',
                          ai: selectedSession.ai_openness,
                          survey: selectedSession.survey_openness,
                          color: 'bg-emerald-500',
                          textColor: 'text-emerald-700'
                        },
                        {
                          key: 'conscientiousness',
                          name: '誠実性 (C / Conscientiousness)',
                          ai: selectedSession.ai_conscientiousness,
                          survey: selectedSession.survey_conscientiousness,
                          color: 'bg-blue-500',
                          textColor: 'text-blue-700'
                        },
                        {
                          key: 'extraversion',
                          name: '外向性 (E / Extraversion)',
                          ai: selectedSession.ai_extraversion,
                          survey: selectedSession.survey_extraversion,
                          color: 'bg-amber-500',
                          textColor: 'text-amber-700'
                        },
                        {
                          key: 'agreeableness',
                          name: '協調性 (A / Agreeableness)',
                          ai: selectedSession.ai_agreeableness,
                          survey: selectedSession.survey_agreeableness,
                          color: 'bg-purple-500',
                          textColor: 'text-purple-700'
                        },
                        {
                          key: 'neuroticism',
                          name: '情緒安定性 (N / Neuroticism)',
                          ai: selectedSession.ai_neuroticism,
                          survey: selectedSession.survey_neuroticism,
                          color: 'bg-rose-500',
                          textColor: 'text-rose-700'
                        }
                      ].map(d => {
                        const aiVal = d.ai != null ? Math.round(d.ai) : null;
                        const surveyVal = d.survey != null ? Math.round(d.survey) : null;
                        const diff = aiVal != null && surveyVal != null ? Math.abs(aiVal - surveyVal) : null;

                        return (
                          <div key={d.key} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-800">{d.name}</span>
                              {diff != null && (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    diff <= 10
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : diff <= 20
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  差分: {diff}点 ({diff <= 10 ? '高一致' : diff <= 20 ? '中程度の差' : '乖離大'})
                                </span>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              {/* AI バー */}
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-12 text-slate-400 font-semibold text-[11px]">AI診断:</span>
                                <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                  {aiVal != null && (
                                    <div
                                      className={`h-full rounded-full ${d.color}`}
                                      style={{ width: `${Math.min(100, Math.max(0, aiVal))}%` }}
                                    />
                                  )}
                                </div>
                                <span className={`font-mono font-bold w-9 text-right ${d.textColor}`}>
                                  {aiVal != null ? aiVal : '-'}
                                </span>
                              </div>

                              {/* 質問紙 バー */}
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-12 text-slate-400 font-semibold text-[11px]">質問紙:</span>
                                <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                  {surveyVal != null && (
                                    <div
                                      className="h-full rounded-full bg-slate-600"
                                      style={{ width: `${Math.min(100, Math.max(0, surveyVal))}%` }}
                                    />
                                  )}
                                </div>
                                <span className="font-mono font-bold w-9 text-right text-slate-700">
                                  {surveyVal != null ? surveyVal : '-'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI性格タイトル & サマリー */}
                  <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                        AI性格キャッチコピー
                      </span>
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
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          プロファイル サマリー
                        </span>
                        <p className="text-sm text-slate-700 leading-relaxed mt-1">
                          {selectedSession.ai_summary}
                        </p>
                      </div>
                    )}

                    {/* AI分析詳細インサイト (強み・適職等) */}
                    {selectedSession.parsed_ai_result && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                        {selectedSession.parsed_ai_result.strengths && selectedSession.parsed_ai_result.strengths.length > 0 && (
                          <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <span className="text-xs font-bold text-emerald-700">主な強み</span>
                            <ul className="text-xs text-slate-600 mt-1 space-y-1 list-disc list-inside">
                              {selectedSession.parsed_ai_result.strengths.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selectedSession.parsed_ai_result.growth_areas && selectedSession.parsed_ai_result.growth_areas.length > 0 && (
                          <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <span className="text-xs font-bold text-amber-700">成長のヒント</span>
                            <ul className="text-xs text-slate-600 mt-1 space-y-1 list-disc list-inside">
                              {selectedSession.parsed_ai_result.growth_areas.map((g, i) => (
                                <li key={i}>{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
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
                      if (selectedSession.parsed_messages && selectedSession.parsed_messages.length > 0) {
                        messages = selectedSession.parsed_messages;
                      } else if (selectedSession.chat_messages) {
                        messages = JSON.parse(selectedSession.chat_messages);
                      }
                    } catch (_) {}

                    if (messages.length === 0) {
                      return (
                        <div className="py-12 text-center text-slate-400 text-xs">
                          対話ログが記録されていないか、読み込み中です。
                        </div>
                      );
                    }

                    let turnCounter = 0;

                    return (
                      <div className="space-y-3.5">
                        {messages.map((m, idx) => {
                          const isUser = m.role === 'user';
                          if (isUser) turnCounter += 1;

                          return (
                            <div
                              key={idx}
                              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                            >
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                                {isUser ? (
                                  <>
                                    <span className="font-bold text-indigo-600">Turn {turnCounter}</span>
                                    <span>被験者 ({selectedSession.student_id || 'ユーザー'})</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={10} className="text-indigo-500" />
                                    <span>Dr. OCEAN (AI心理分析官)</span>
                                  </>
                                )}
                              </div>
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                                  isUser
                                    ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                                    : 'bg-slate-100 text-slate-800 border border-slate-200/80 rounded-bl-xs'
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

              {/* タブ3: 質問紙回答データ (全30問詳細テーブル) */}
              {activeModalTab === 'survey' && (
                <div className="space-y-4">
                  <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">尺度名:</span>
                      <strong className="text-slate-800 ml-1.5">
                        {selectedSession.survey_scale_name || 'BFI-2-S 日本語版 (30項目)'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">完了日時:</span>
                      <strong className="text-slate-800 ml-1.5">
                        {selectedSession.survey_completed_at
                          ? new Date(selectedSession.survey_completed_at).toLocaleString('ja-JP')
                          : '未完了'}
                      </strong>
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
                        <div className="py-12 text-center text-slate-400 text-xs">
                          質問紙の回答データはありません。
                        </div>
                      );
                    }

                    const likertLabels: Record<number, string> = {
                      1: '全くあてはまらない',
                      2: 'あまりあてはまらない',
                      3: 'どちらともいえない',
                      4: 'ややあてはまる',
                      5: 'とてもよくあてはまる'
                    };

                    return (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs text-slate-700">
                          <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 font-bold w-12 text-center">No.</th>
                              <th className="py-2.5 px-3 font-bold">設問文 (「私は普段…」)</th>
                              <th className="py-2.5 px-3 font-bold w-24">因子 / ファセット</th>
                              <th className="py-2.5 px-3 font-bold w-32 text-center">被験者の回答</th>
                              <th className="py-2.5 px-3 font-bold w-20 text-center">反転後点</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {BFI_2_S_CONFIG.questions.map(q => {
                              const rawVal = answers ? answers[q.id] : undefined;
                              const scoredVal = rawVal != null ? (q.is_reverse ? 6 - rawVal : rawVal) : null;

                              return (
                                <tr key={q.id} className="hover:bg-slate-50/60 transition">
                                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                                    Q{q.id}
                                  </td>
                                  <td className="py-2 px-3 text-slate-900">
                                    <span>{q.text}</span>
                                    {q.is_reverse && (
                                      <span className="ml-1.5 text-[10px] text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 font-bold">
                                        反転
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                                    <span className="font-semibold">{q.facet}</span>
                                  </td>
                                  <td className="py-2 px-3 text-center whitespace-nowrap">
                                    {rawVal != null ? (
                                      <span className="inline-flex items-center gap-1 font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                                        <span>{rawVal}点</span>
                                        <span className="text-[10px] font-normal text-slate-500">
                                          ({likertLabels[rawVal] || ''})
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic">未回答</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                                    {scoredVal != null ? scoredVal : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
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
                    className="absolute right-4 top-4 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {copiedId === 'raw_json' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>JSONをコピー</span>
                  </button>
                  <pre className="bg-slate-900 text-slate-200 p-4 rounded-2xl border border-slate-800 text-xs font-mono overflow-x-auto max-h-[520px] leading-relaxed">
                    {JSON.stringify(selectedSession, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">セッション: {selectedSession.id}</span>
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-bold rounded-xl transition cursor-pointer"
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
