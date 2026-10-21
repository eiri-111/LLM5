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
  Table,
  FileText,
  HelpCircle,
  Columns
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToApp: () => void;
}

type MainTab = 'data' | 'reports' | 'export';
type TableViewMode = 'standard' | 'comparison' | 'survey_items' | 'all';
type SortField =
  | 'created_at'
  | 'id'
  | 'dialogue_turns'
  | 'age'
  | 'ai_openness'
  | 'ai_conscientiousness'
  | 'ai_extraversion'
  | 'ai_agreeableness'
  | 'ai_neuroticism'
  | 'survey_openness'
  | 'survey_conscientiousness'
  | 'survey_extraversion'
  | 'survey_agreeableness'
  | 'survey_neuroticism';

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

  // ナビゲーションタブ (Qualtricsスタイル)
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('data');

  // テーブルビューモード (列表示切り替え)
  const [tableViewMode, setTableViewMode] = useState<TableViewMode>('standard');

  // 検索・フィルタリング・ソート
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'finished' | 'ai_only' | 'survey_only' | 'in_progress'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // ページネーション
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // 詳細モーダル (Qualtrics Response Viewer)
  const [selectedSession, setSelectedSession] = useState<AdminSessionRecord | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailSource, setDetailSource] = useState<'r2' | 'd1' | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'overview' | 'chat' | 'survey' | 'json'>('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 初回マウント時認証確認
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
          'Authorization': `Bearer ${pw}`,
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

  // セッション一覧の高速取得
  const fetchSessions = async (pw: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/admin/sessions?limit=500', {
        headers: {
          'Authorization': `Bearer ${pw}`,
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

  // セッション詳細を開く (オンデマンドR2フェッチ)
  const handleOpenDetail = async (session: AdminSessionRecord) => {
    setSelectedSession(session);
    setActiveModalTab('overview');
    setDetailSource(session.data_source || (session.r2_saved ? 'r2' : 'd1'));

    if (!session.parsed_messages || session.parsed_messages.length === 0 || !session.parsed_ai_result) {
      setIsLoadingDetail(true);
      try {
        const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(session.id)}`, {
          headers: {
            'Authorization': `Bearer ${password}`,
            'x-admin-password': password
          }
        });
        if (res.ok) {
          const data: any = await res.json();
          if (data.session) {
            setSelectedSession(data.session);
            setDetailSource(data.source || (data.session.r2_saved ? 'r2' : 'd1'));
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

  // セッション削除
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`回答レコード [${sessionId.slice(0, 12)}...] を削除しますか？\n（D1レコードおよびR2オブジェクトが完全に削除されます）`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${password}`,
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

  // 安全なBlobファイルダウンロード（URLにパスワードを露出させずAuthorizationヘッダーで取得）
  const downloadSecureFile = async (urlPath: string, filename: string) => {
    try {
      const res = await fetch(urlPath, {
        headers: {
          'Authorization': `Bearer ${password}`,
          'x-admin-password': password
        }
      });
      if (!res.ok) {
        throw new Error(`ダウンロードに失敗しました [${res.status}]`);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(`ダウンロードエラー: ${err.message}`);
    }
  };

  // SPSS用フラットCSVダウンロード
  const handleDownloadSpssCsv = () => {
    downloadSecureFile('/api/admin/export?format=spss_csv&header=single', `llm5_spss_dataset_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Qualtrics標準3行ヘッダーCSVダウンロード
  const handleDownloadQualtricsCsv = () => {
    downloadSecureFile('/api/admin/export?format=spss_csv&header=qualtrics', `llm5_qualtrics_format_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // SPSSシンタックスファイル (.sps) ダウンロード
  const handleDownloadSpssSyntax = () => {
    downloadSecureFile('/api/admin/export?format=sps', `llm5_spss_syntax_${new Date().toISOString().slice(0, 10)}.sps`);
  };

  // JSONダウンロード
  const handleDownloadJson = () => {
    downloadSecureFile('/api/admin/export?format=json', `llm5_research_data_${new Date().toISOString().slice(0, 10)}.json`);
  };

  // 単一セッションJSONダウンロード
  const handleDownloadSingleSessionJson = async (session: AdminSessionRecord) => {
    let fullSession = session;
    if (!session.parsed_messages || session.parsed_messages.length === 0) {
      try {
        const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(session.id)}`, {
          headers: {
            'Authorization': `Bearer ${password}`,
            'x-admin-password': password
          }
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
    a.download = `response_${fullSession.id.slice(0, 12)}.json`;
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

  // ソート切り替え
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // フィルタ＆ソート
  const filteredAndSortedSessions = useMemo(() => {
    let result = [...sessions];

    // 検索クエリ (ID, 性格タイプ, タイトル)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s => {
        return (
          s.id.toLowerCase().includes(q) ||
          (s.ai_personality_title && s.ai_personality_title.toLowerCase().includes(q)) ||
          (s.ai_personality_type && s.ai_personality_type.toLowerCase().includes(q))
        );
      });
    }

    // ステータスフィルター
    if (statusFilter === 'finished') {
      result = result.filter(s => (s.has_ai_result || s.ai_personality_title) && (s.has_survey_completed || s.survey_completed_at));
    } else if (statusFilter === 'ai_only') {
      result = result.filter(s => (s.has_ai_result || s.ai_personality_title) && !(s.has_survey_completed || s.survey_completed_at));
    } else if (statusFilter === 'survey_only') {
      result = result.filter(s => !(s.has_ai_result || s.ai_personality_title) && (s.has_survey_completed || s.survey_completed_at));
    } else if (statusFilter === 'in_progress') {
      result = result.filter(s => !(s.has_ai_result || s.ai_personality_title) && !(s.has_survey_completed || s.survey_completed_at));
    }

    // ソート処理
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
        valA = valA ?? -999;
        valB = valB ?? -999;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [sessions, searchQuery, statusFilter, sortField, sortDirection]);

  // ページネーション
  const totalPages = Math.ceil(filteredAndSortedSessions.length / pageSize) || 1;
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedSessions.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedSessions, currentPage, pageSize]);

  // 統計レポート用集計 (SPSS風の平均値・標準偏差・差分集計)
  const reportStats = useMemo(() => {
    const total = sessions.length;
    const finished = sessions.filter(s => (s.has_ai_result || s.ai_personality_title) && (s.has_survey_completed || s.survey_completed_at)).length;
    const aiCount = sessions.filter(s => s.has_ai_result || s.ai_personality_title).length;
    const surveyCount = sessions.filter(s => s.has_survey_completed || s.survey_completed_at).length;

    // 年齢集計
    const validAges = sessions.map(s => Number(s.age)).filter(a => a > 0);
    const meanAge = validAges.length > 0 ? (validAges.reduce((a, b) => a + b, 0) / validAges.length).toFixed(1) : '-';

    // 性別集計
    const males = sessions.filter(s => s.gender === 'male' || s.gender === '男性').length;
    const females = sessions.filter(s => s.gender === 'female' || s.gender === '女性').length;
    const others = total - males - females;

    // 5因子統計関数 (Mean & SD & MAD)
    const computeStats = (key: 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism') => {
      const aiVals: number[] = [];
      const surveyVals: number[] = [];
      const diffVals: number[] = [];
      const absDiffVals: number[] = [];

      sessions.forEach(s => {
        const ai = s[`ai_${key}` as keyof AdminSessionRecord] as number | null;
        const surv = s[`survey_${key}` as keyof AdminSessionRecord] as number | null;

        if (ai != null) aiVals.push(ai);
        if (surv != null) surveyVals.push(surv);
        if (ai != null && surv != null) {
          diffVals.push(ai - surv);
          absDiffVals.push(Math.abs(ai - surv));
        }
      });

      const mean = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
      const sd = (arr: number[], m: number | null) => {
        if (!m || arr.length < 2) return null;
        const variance = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / (arr.length - 1);
        return Math.sqrt(variance);
      };

      const mAi = mean(aiVals);
      const mSurv = mean(surveyVals);
      const mDiff = mean(diffVals);
      const mMad = mean(absDiffVals);

      return {
        aiMean: mAi != null ? mAi.toFixed(1) : '-',
        aiSd: sd(aiVals, mAi)?.toFixed(1) || '-',
        survMean: mSurv != null ? mSurv.toFixed(1) : '-',
        survSd: sd(surveyVals, mSurv)?.toFixed(1) || '-',
        meanDiff: mDiff != null ? (mDiff > 0 ? `+${mDiff.toFixed(1)}` : mDiff.toFixed(1)) : '-',
        meanMad: mMad != null ? mMad.toFixed(1) : '-',
        validN: diffVals.length
      };
    };

    return {
      total,
      finished,
      aiCount,
      surveyCount,
      meanAge,
      males,
      females,
      others,
      traits: {
        openness: { name: '開放性 (O)', ...computeStats('openness') },
        conscientiousness: { name: '誠実性 (C)', ...computeStats('conscientiousness') },
        extraversion: { name: '外向性 (E)', ...computeStats('extraversion') },
        agreeableness: { name: '協調性 (A)', ...computeStats('agreeableness') },
        neuroticism: { name: '情緒安定性 (N)', ...computeStats('neuroticism') }
      }
    };
  }, [sessions]);

  // 1. ログイン画面 (Qualtricsスタイル)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] text-slate-800 flex flex-col justify-center items-center px-4 font-sans">
        <div className="w-full max-w-md bg-white border border-slate-300 rounded shadow-md p-8">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
            <div className="w-8 h-8 rounded bg-[#0c2340] text-white flex items-center justify-center font-bold text-sm">
              XM
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                Qualtrics XM | Data & Analysis
              </h1>
              <p className="text-[11px] text-slate-500">LLM5 研究調査データ管理コンソール</p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                管理者パスワード
              </label>
              <input
                type="password"
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#007ac1] focus:ring-1 focus:ring-[#007ac1] transition"
                autoFocus
              />
            </div>

            {authError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 px-4 bg-[#007ac1] hover:bg-[#00629b] active:bg-[#004e7c] text-white font-bold rounded shadow-xs transition text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isVerifying ? '認証中...' : 'サインイン'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200 text-center">
            <button
              onClick={onBackToApp}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>診断トップページへ戻る</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. メイン画面 (Qualtricsスタイル)
  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-800 flex flex-col font-sans">
      {/* Qualtrics 最上部ブランドバー (ダークネイビー #0c2340) */}
      <header className="bg-[#0c2340] text-white">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold tracking-tight text-sm">
              <span className="bg-[#007ac1] px-1.5 py-0.5 rounded text-[11px] font-extrabold">XM</span>
              <span>Qualtrics Style</span>
            </div>
            <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />
            <div className="text-xs text-slate-300 font-medium truncate max-w-[320px] sm:max-w-none">
              LLM5 調査プロジェクト: 対話行動面接 (BEI) & BFI-2-S 心理測定尺度
            </div>
            <span className="hidden lg:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-semibold">
              ● 収集有効 (Active)
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            {/* ストレージステータス */}
            <div className="hidden md:flex items-center gap-1.5 text-slate-300 text-[11px]">
              <span className={`inline-flex items-center gap-1 ${isDbConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                <Database size={12} /> D1
              </span>
              <span>/</span>
              <span className={`inline-flex items-center gap-1 ${isR2Connected ? 'text-sky-400' : 'text-slate-500'}`}>
                <HardDrive size={12} /> R2
              </span>
            </div>

            <button
              onClick={onBackToApp}
              className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">診断画面へ</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-2.5 py-1 text-slate-300 hover:text-rose-300 hover:bg-white/10 rounded transition flex items-center gap-1 cursor-pointer"
              title="ログアウト"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">サインアウト</span>
            </button>
          </div>
        </div>
      </header>

      {/* Qualtrics サブヘッダー (タブナビゲーション) */}
      <div className="bg-white border-b border-slate-300 shadow-2xs sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between">
          <nav className="flex space-x-1 text-xs font-bold text-slate-600">
            <button
              onClick={() => setActiveMainTab('data')}
              className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeMainTab === 'data'
                  ? 'border-[#007ac1] text-[#007ac1]'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Table size={15} />
              <span>データと分析 (Data & Analysis)</span>
            </button>

            <button
              onClick={() => setActiveMainTab('reports')}
              className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeMainTab === 'reports'
                  ? 'border-[#007ac1] text-[#007ac1]'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <BarChart3 size={15} />
              <span>レポート・統計サマリー (Reports)</span>
            </button>

            <button
              onClick={() => setActiveMainTab('export')}
              className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeMainTab === 'export'
                  ? 'border-[#007ac1] text-[#007ac1]'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Download size={15} />
              <span>SPSSエクスポート (SPSS Export)</span>
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSessions(password)}
              disabled={isLoading}
              title="データを再読み込み"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* メインエリア */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* ========================================================================= */}
        {/* TAB 1: データと分析 (Qualtrics スプレッドシート データテーブル) */}
        {/* ========================================================================= */}
        {activeMainTab === 'data' && (
          <div className="space-y-3">
            {/* ツールバー (Qualtrics Data Toolbar) */}
            <div className="bg-white border border-slate-300 rounded p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* 検索入力 */}
                <div className="relative w-64">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Response ID や性格タイプで検索..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#007ac1]"
                  />
                </div>

                {/* ビュー切り替えトグル (QualtricsのColumn Sets) */}
                <div className="flex items-center border border-slate-300 rounded overflow-hidden">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 font-bold text-[11px] border-r border-slate-300 flex items-center gap-1">
                    <Columns size={12} />
                    <span>表示列:</span>
                  </span>
                  <button
                    onClick={() => setTableViewMode('standard')}
                    className={`px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                      tableViewMode === 'standard' ? 'bg-[#007ac1] text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    主要変数
                  </button>
                  <button
                    onClick={() => setTableViewMode('comparison')}
                    className={`px-2.5 py-1 text-[11px] font-semibold border-l border-slate-200 transition cursor-pointer ${
                      tableViewMode === 'comparison' ? 'bg-[#007ac1] text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    AI・尺度差分
                  </button>
                  <button
                    onClick={() => setTableViewMode('survey_items')}
                    className={`px-2.5 py-1 text-[11px] font-semibold border-l border-slate-200 transition cursor-pointer ${
                      tableViewMode === 'survey_items' ? 'bg-[#007ac1] text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    BFI設問 (Q1〜Q30)
                  </button>
                  <button
                    onClick={() => setTableViewMode('all')}
                    className={`px-2.5 py-1 text-[11px] font-semibold border-l border-slate-200 transition cursor-pointer ${
                      tableViewMode === 'all' ? 'bg-[#007ac1] text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    全変数 (SPSS)
                  </button>
                </div>

                {/* ステータスフィルター */}
                <div className="flex items-center gap-1 text-slate-600">
                  <span className="font-semibold text-[11px]">状態:</span>
                  <select
                    value={statusFilter}
                    onChange={e => {
                      setStatusFilter(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-[#007ac1] cursor-pointer"
                  >
                    <option value="all">すべての回答 ({sessions.length})</option>
                    <option value="finished">完了済みのみ (Finished)</option>
                    <option value="ai_only">AI分析のみ</option>
                    <option value="survey_only">質問紙のみ</option>
                    <option value="in_progress">対話中 (未完了)</option>
                  </select>
                </div>
              </div>

              {/* クイックエクスポート */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadSpssCsv}
                  disabled={sessions.length === 0}
                  className="px-3 py-1.5 bg-[#007ac1] hover:bg-[#00629b] text-white font-bold rounded text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  title="SPSSで直接開ける全30問展開CSV"
                >
                  <FileSpreadsheet size={13} />
                  <span>SPSS用CSV</span>
                </button>

                <button
                  onClick={handleDownloadSpssSyntax}
                  disabled={sessions.length === 0}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold rounded text-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="SPSS変数定義構文ファイル (.sps)"
                >
                  <FileCode size={13} />
                  <span>.SPS構文</span>
                </button>
              </div>
            </div>

            {/* スプレッドシート型データテーブル (Qualtrics Data Table) */}
            <div className="bg-white border border-slate-300 rounded shadow-2xs overflow-hidden">
              <div className="overflow-x-auto max-h-[72vh]">
                <table className="w-full text-left text-xs border-collapse">
                  {/* テーブルヘッダー (Qualtrics風 枠線＆ソート対応) */}
                  <thead className="bg-[#f8f9fa] text-slate-700 uppercase text-[11px] font-bold border-b border-slate-300 sticky top-0 z-10 shadow-2xs select-none">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-slate-200 w-12 text-center text-slate-400">#</th>

                      <th
                        onClick={() => handleSort('id')}
                        className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition whitespace-nowrap"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Response ID</span>
                          {sortField === 'id' && (
                            sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </div>
                      </th>

                      <th
                        onClick={() => handleSort('created_at')}
                        className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition whitespace-nowrap"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Recorded Date</span>
                          {sortField === 'created_at' && (
                            sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </div>
                      </th>

                      <th className="py-2.5 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                        Status
                      </th>

                      <th
                        onClick={() => handleSort('dialogue_turns')}
                        className="py-2.5 px-3 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200/60 transition whitespace-nowrap"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Turns</span>
                          {sortField === 'dialogue_turns' && (
                            sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </div>
                      </th>

                      <th
                        onClick={() => handleSort('age')}
                        className="py-2.5 px-3 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200/60 transition whitespace-nowrap"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Age</span>
                          {sortField === 'age' && (
                            sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </div>
                      </th>

                      <th className="py-2.5 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                        Gender
                      </th>

                      {/* 主要変数ビュー / 全変数ビュー: AI 5因子 */}
                      {(tableViewMode === 'standard' || tableViewMode === 'all') && (
                        <>
                          <th onClick={() => handleSort('ai_openness')} className="py-2.5 px-2.5 border-r border-slate-200 text-right text-emerald-800 bg-emerald-50/50 cursor-pointer whitespace-nowrap">AI_O</th>
                          <th onClick={() => handleSort('ai_conscientiousness')} className="py-2.5 px-2.5 border-r border-slate-200 text-right text-blue-800 bg-blue-50/50 cursor-pointer whitespace-nowrap">AI_C</th>
                          <th onClick={() => handleSort('ai_extraversion')} className="py-2.5 px-2.5 border-r border-slate-200 text-right text-amber-800 bg-amber-50/50 cursor-pointer whitespace-nowrap">AI_E</th>
                          <th onClick={() => handleSort('ai_agreeableness')} className="py-2.5 px-2.5 border-r border-slate-200 text-right text-purple-800 bg-purple-50/50 cursor-pointer whitespace-nowrap">AI_A</th>
                          <th onClick={() => handleSort('ai_neuroticism')} className="py-2.5 px-2.5 border-r border-slate-200 text-right text-rose-800 bg-rose-50/50 cursor-pointer whitespace-nowrap">AI_N</th>
                        </>
                      )}

                      {/* 主要変数ビュー / 全変数ビュー: 質問紙 5因子 */}
                      {(tableViewMode === 'standard' || tableViewMode === 'all') && (
                        <>
                          <th onClick={() => handleSort('survey_openness')} className="py-2.5 px-2.5 border-r border-slate-200 text-right text-slate-800 bg-slate-100 cursor-pointer whitespace-nowrap">Surv_O</th>
                          <th onClick={() => handleSort('survey_conscientiousness')} className="py-2.5 px-2.5 border-r border-slate-200 text-right text-slate-800 bg-slate-100 cursor-pointer whitespace-nowrap">Surv_C</th>
                          <th onClick={() => handleSort('survey_extraversion')} className="py-2.5 px-2.5 border-r border-slate-200 text-right text-slate-800 bg-slate-100 cursor-pointer whitespace-nowrap">Surv_E</th>
                          <th onClick={() => handleSort('survey_agreeableness')} className="py-2.5 px-2.5 border-r border-slate-200 text-right text-slate-800 bg-slate-100 cursor-pointer whitespace-nowrap">Surv_A</th>
                          <th onClick={() => handleSort('survey_neuroticism')} className="py-2.5 px-2.5 border-r border-slate-200 text-right text-slate-800 bg-slate-100 cursor-pointer whitespace-nowrap">Surv_N</th>
                        </>
                      )}

                      {/* 差分ビュー / 全変数ビュー: Diff (AI - Survey) */}
                      {(tableViewMode === 'comparison' || tableViewMode === 'all') && (
                        <>
                          <th className="py-2.5 px-2.5 border-r border-slate-200 text-right text-indigo-900 bg-indigo-50/70 whitespace-nowrap">Diff_O</th>
                          <th className="py-2.5 px-2.5 border-r border-slate-200 text-right text-indigo-900 bg-indigo-50/70 whitespace-nowrap">Diff_C</th>
                          <th className="py-2.5 px-2.5 border-r border-slate-200 text-right text-indigo-900 bg-indigo-50/70 whitespace-nowrap">Diff_E</th>
                          <th className="py-2.5 px-2.5 border-r border-slate-200 text-right text-indigo-900 bg-indigo-50/70 whitespace-nowrap">Diff_A</th>
                          <th className="py-2.5 px-2.5 border-r border-slate-200 text-right text-indigo-900 bg-indigo-50/70 whitespace-nowrap">Diff_N</th>
                        </>
                      )}

                      {/* 質問紙設問ビュー / 全変数ビュー: Q01〜Q30 */}
                      {(tableViewMode === 'survey_items' || tableViewMode === 'all') && (
                        Array.from({ length: 30 }, (_, i) => (
                          <th
                            key={i}
                            className="py-2 px-2 border-r border-slate-200 text-center font-mono text-[10px] w-9 bg-slate-50 whitespace-nowrap"
                            title={`Q${i + 1}: ${BFI_2_S_CONFIG.questions[i]?.text || ''}`}
                          >
                            Q{String(i + 1).padStart(2, '0')}
                          </th>
                        ))
                      )}

                      <th className="py-2.5 px-3 text-center whitespace-nowrap w-20">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 font-sans">
                    {isLoading ? (
                      <tr>
                        <td colSpan={25} className="py-14 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <RefreshCw size={20} className="animate-spin text-[#007ac1]" />
                            <span className="text-xs">データを読み込み中...</span>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedSessions.length === 0 ? (
                      <tr>
                        <td colSpan={25} className="py-14 text-center text-slate-400 text-xs">
                          該当する回答データは見つかりませんでした。
                        </td>
                      </tr>
                    ) : (
                      paginatedSessions.map((session, idx) => {
                        const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                        const hasSurvey = Boolean(session.has_survey_completed || session.survey_completed_at);
                        const hasAi = Boolean(session.has_ai_result || session.ai_personality_title);
                        const isFinished = hasAi && hasSurvey;

                        // 質問紙生回答のパース
                        let answers: Record<string | number, number> = {};
                        if (tableViewMode === 'survey_items' || tableViewMode === 'all') {
                          try {
                            if (session.parsed_survey_answers) answers = session.parsed_survey_answers;
                            else if (session.survey_raw_answers) answers = JSON.parse(session.survey_raw_answers);
                          } catch (_) {}
                        }

                        // 差分ヘルパー
                        const getDiff = (ai: number | null | undefined, surv: number | null | undefined) => {
                          if (ai != null && surv != null) {
                            const d = Math.round(ai - surv);
                            return d > 0 ? `+${d}` : `${d}`;
                          }
                          return '-';
                        };

                        return (
                          <tr
                            key={session.id}
                            onClick={() => handleOpenDetail(session)}
                            className="hover:bg-sky-50/50 transition cursor-pointer select-none group"
                          >
                            {/* # (連番) */}
                            <td className="py-2 px-3 border-r border-slate-200 text-center text-[11px] font-mono text-slate-400">
                              {rowNumber}
                            </td>

                            {/* Response ID */}
                            <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800 group-hover:text-[#007ac1]">
                                <span>R_{session.id.slice(0, 8)}</span>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    copyToClipboard(session.id, session.id);
                                  }}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                                  title="フルIDをコピー"
                                >
                                  {copiedId === session.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                </button>
                              </div>
                            </td>

                            {/* Recorded Date */}
                            <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                              {new Date(session.created_at).toLocaleString('ja-JP', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>

                            {/* Status */}
                            <td className="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                              {isFinished ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  完了
                                </span>
                              ) : hasAi ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                                  AIのみ
                                </span>
                              ) : hasSurvey ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                  質問紙のみ
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                  対話中
                                </span>
                              )}
                            </td>

                            {/* Turns */}
                            <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                              {session.dialogue_turns ?? 0}
                            </td>

                            {/* Age */}
                            <td className="py-2 px-3 border-r border-slate-200 text-right font-mono text-slate-800 whitespace-nowrap">
                              {session.age > 0 ? session.age : '-'}
                            </td>

                            {/* Gender */}
                            <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-700 whitespace-nowrap">
                              {session.gender === 'male' || session.gender === '男性'
                                ? '男性'
                                : session.gender === 'female' || session.gender === '女性'
                                ? '女性'
                                : session.gender || '-'}
                            </td>

                            {/* AI 5因子スコア */}
                            {(tableViewMode === 'standard' || tableViewMode === 'all') && (
                              <>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">
                                  {session.ai_openness != null ? Math.round(session.ai_openness) : '-'}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-blue-700">
                                  {session.ai_conscientiousness != null ? Math.round(session.ai_conscientiousness) : '-'}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-amber-700">
                                  {session.ai_extraversion != null ? Math.round(session.ai_extraversion) : '-'}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-purple-700">
                                  {session.ai_agreeableness != null ? Math.round(session.ai_agreeableness) : '-'}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-rose-700">
                                  {session.ai_neuroticism != null ? Math.round(session.ai_neuroticism) : '-'}
                                </td>
                              </>
                            )}

                            {/* 質問紙 5因子スコア */}
                            {(tableViewMode === 'standard' || tableViewMode === 'all') && (
                              <>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono text-slate-800 bg-slate-50/50">
                                  {session.survey_openness != null ? Math.round(session.survey_openness) : '-'}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono text-slate-800 bg-slate-50/50">
                                  {session.survey_conscientiousness != null ? Math.round(session.survey_conscientiousness) : '-'}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono text-slate-800 bg-slate-50/50">
                                  {session.survey_extraversion != null ? Math.round(session.survey_extraversion) : '-'}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono text-slate-800 bg-slate-50/50">
                                  {session.survey_agreeableness != null ? Math.round(session.survey_agreeableness) : '-'}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono text-slate-800 bg-slate-50/50">
                                  {session.survey_neuroticism != null ? Math.round(session.survey_neuroticism) : '-'}
                                </td>
                              </>
                            )}

                            {/* 差分 Diff (AI - Survey) */}
                            {(tableViewMode === 'comparison' || tableViewMode === 'all') && (
                              <>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-semibold text-slate-700 bg-indigo-50/30">
                                  {getDiff(session.ai_openness, session.survey_openness)}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-semibold text-slate-700 bg-indigo-50/30">
                                  {getDiff(session.ai_conscientiousness, session.survey_conscientiousness)}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-semibold text-slate-700 bg-indigo-50/30">
                                  {getDiff(session.ai_extraversion, session.survey_extraversion)}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-semibold text-slate-700 bg-indigo-50/30">
                                  {getDiff(session.ai_agreeableness, session.survey_agreeableness)}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-semibold text-slate-700 bg-indigo-50/30">
                                  {getDiff(session.ai_neuroticism, session.survey_neuroticism)}
                                </td>
                              </>
                            )}

                            {/* 質問紙設問 Q01〜Q30 */}
                            {(tableViewMode === 'survey_items' || tableViewMode === 'all') && (
                              Array.from({ length: 30 }, (_, i) => {
                                const val = answers[i + 1];
                                return (
                                  <td
                                    key={i}
                                    className="py-1 px-1 border-r border-slate-200 text-center font-mono text-[11px] text-slate-700"
                                  >
                                    {val != null ? val : '-'}
                                  </td>
                                );
                              })
                            )}

                            {/* Actions */}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleOpenDetail(session);
                                  }}
                                  className="p-1 text-slate-500 hover:text-[#007ac1] hover:bg-slate-100 rounded"
                                  title="回答詳細を開く"
                                >
                                  <Eye size={14} />
                                </button>

                                <button
                                  onClick={e => handleDeleteSession(session.id, e)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  title="削除"
                                >
                                  <Trash2 size={14} />
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

              {/* ページネーションフッター (Qualtrics Table Footer) */}
              <div className="px-4 py-2.5 bg-[#f8f9fa] border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div>
                  <span>合計 </span>
                  <strong className="text-slate-800">{filteredAndSortedSessions.length}</strong>
                  <span> 件の回答 (表示: </span>
                  <strong className="text-slate-800">
                    {(currentPage - 1) * pageSize + 1}〜
                    {Math.min(currentPage * pageSize, filteredAndSortedSessions.length)}
                  </strong>
                  <span> 件)</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                  </button>

                  <span className="px-2 text-xs font-semibold text-slate-700">
                    ページ {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronRight size={13} />
                  </button>

                  <div className="ml-3 flex items-center gap-1">
                    <span className="text-[11px] text-slate-500">表示件数:</span>
                    <select
                      value={pageSize}
                      onChange={e => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs text-slate-700 cursor-pointer"
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: レポート・統計サマリー (Reports / Cross Tabs) */}
        {/* ========================================================================= */}
        {activeMainTab === 'reports' && (
          <div className="space-y-4">
            {/* サンプル情報サマリー */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-300 rounded p-4 shadow-2xs">
                <span className="text-xs font-semibold text-slate-500">有効回答数 (Sample Size N)</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {reportStats.total}
                  <span className="text-xs font-normal text-slate-500 ml-1">件</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">完全完了: {reportStats.finished} 件</p>
              </div>

              <div className="bg-white border border-slate-300 rounded p-4 shadow-2xs">
                <span className="text-xs font-semibold text-slate-500">平均年齢 (Mean Age)</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {reportStats.meanAge}
                  <span className="text-xs font-normal text-slate-500 ml-1">歳</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">回答者有効年齢</p>
              </div>

              <div className="bg-white border border-slate-300 rounded p-4 shadow-2xs">
                <span className="text-xs font-semibold text-slate-500">性別内訳 (Gender Split)</span>
                <div className="text-sm font-bold text-slate-800 mt-2 space-y-0.5">
                  <div>男性: {reportStats.males} 名 / 女性: {reportStats.females} 名</div>
                  <div className="text-xs text-slate-400 font-normal">その他/未回答: {reportStats.others} 名</div>
                </div>
              </div>

              <div className="bg-white border border-slate-300 rounded p-4 shadow-2xs">
                <span className="text-xs font-semibold text-slate-500">調査完了率 (Completion Rate)</span>
                <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                  {reportStats.total > 0 ? Math.round((reportStats.finished / reportStats.total) * 100) : 0}%
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">AI対話＋質問紙の両方完了</p>
              </div>
            </div>

            {/* 5因子 平均値・標準偏差・差分対比テーブル (SPSS比較分析用) */}
            <div className="bg-white border border-slate-300 rounded shadow-2xs overflow-hidden">
              <div className="px-4 py-3 bg-[#f8f9fa] border-b border-slate-300 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    ビッグファイブ5因子 集計統計表 (AI推定スコア vs 質問紙BFI-2-S)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    母集団における平均値（Mean）、標準偏差（SD）、平均差分（Mean Diff）、平均絶対乖離度（MAD）
                  </p>
                </div>
                <button
                  onClick={handleDownloadSpssCsv}
                  className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded shadow-2xs cursor-pointer"
                >
                  SPSSで検定する (.csv)
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8f9fa] text-slate-600 font-bold border-b border-slate-300 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4 border-r border-slate-200">次元 (Dimension)</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-right">N (対照数)</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-right bg-emerald-50/50">AI Mean</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-right bg-emerald-50/50">AI SD</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-right bg-slate-100">質問紙 Mean</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-right bg-slate-100">質問紙 SD</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-right bg-indigo-50/60">平均差 (AI - Surv)</th>
                      <th className="py-2.5 px-3 text-right bg-indigo-50/60">平均絶対誤差 (MAD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {Object.values(reportStats.traits).map(t => (
                      <tr key={t.name} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 border-r border-slate-200 font-sans font-bold text-slate-900">
                          {t.name}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-600">
                          {t.validN}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-emerald-800">
                          {t.aiMean}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-600">
                          {t.aiSd}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-slate-800 bg-slate-50/50">
                          {t.survMean}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-600 bg-slate-50/50">
                          {t.survSd}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-indigo-700 bg-indigo-50/20">
                          {t.meanDiff}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-900 bg-indigo-50/20">
                          {t.meanMad} 点
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SPSSエクスポート (SPSS Export Data Wizard) */}
        {/* ========================================================================= */}
        {activeMainTab === 'export' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="bg-white border border-slate-300 rounded p-6 shadow-2xs space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-[#007ac1]" />
                  <span>SPSS (IBM SPSS Statistics) 分析用データエクスポート</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  統計解析ソフトSPSSで直接読み込んでt検定・相関分析・信頼性分析・因子分析を行えるよう、BFI-2-S全30問展開、数値コード化（性別等）、差分変数を完備したファイルを出力します。
                </p>
              </div>

              {/* エクスポート形式カード一覧 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. SPSS用フラットCSV */}
                <div className="border border-slate-300 rounded p-4 hover:border-[#007ac1] transition bg-[#fbfcfd] flex flex-col justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 mb-2">
                      推奨 (Recommended)
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">SPSS用フラットCSV (.csv)</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      1行目に英字変数名、2行目以降にデータ。Q1〜Q30設問生回答・反転後得点・差分スコア・性別コード完備。UTF-8 BOM付きで文字化けゼロ。
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadSpssCsv}
                    className="mt-4 w-full py-2 bg-[#007ac1] hover:bg-[#00629b] text-white font-bold rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download size={14} />
                    <span>SPSS用CSVをダウンロード</span>
                  </button>
                </div>

                {/* 2. SPSSシンタックスファイル (.sps) */}
                <div className="border border-slate-300 rounded p-4 hover:border-[#007ac1] transition bg-[#fbfcfd] flex flex-col justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 mb-2">
                      シンタックス自動化
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">SPSS構文ファイル (.sps)</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      SPSS上で変数ラベル（VARIABLE LABELS: 設問文）、値ラベル（VALUE LABELS: 1=全くあてはまらない等）、尺度型（VARIABLE LEVEL）を一括自動定義するスクリプト。
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadSpssSyntax}
                    className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <FileCode size={14} />
                    <span>.SPS構文ファイルをダウンロード</span>
                  </button>
                </div>

                {/* 3. Qualtrics標準形式CSV */}
                <div className="border border-slate-300 rounded p-4 hover:border-[#007ac1] transition bg-[#fbfcfd] flex flex-col justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mb-2">
                      Qualtrics互換
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">Qualtrics形式CSV (3行ヘッダー)</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      1行目: 変数名、2行目: 設問テキスト/変数ラベル、3行目: ImportId のQualtrics標準出力フォーマット。
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadQualtricsCsv}
                    className="mt-4 w-full py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download size={14} />
                    <span>Qualtrics形式CSVをダウンロード</span>
                  </button>
                </div>

                {/* 4. JSONフルデータ */}
                <div className="border border-slate-300 rounded p-4 hover:border-[#007ac1] transition bg-[#fbfcfd] flex flex-col justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mb-2">
                      開発・アーカイブ
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">JSON一括データ (.json)</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      全対話履歴・プロファイラー思考根拠・Clef-flash生データを含む完全なJSON配列。PythonやRでの自然言語処理に最適。
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadJson}
                    className="mt-4 w-full py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download size={14} />
                    <span>JSON一括ダウンロード</span>
                  </button>
                </div>
              </div>

              {/* SPSS読み込み手順ガイド */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded text-xs space-y-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-[#007ac1]" />
                  <span>SPSSでの読み込み手順 (わずか2ステップ)</span>
                </span>
                <ol className="list-decimal list-inside text-slate-600 space-y-1 pl-1">
                  <li>
                    <strong>「SPSS用フラットCSV」</strong>をダウンロードし、SPSSの [ファイル] → [開く] → [データ] でインポートします（自動で区切り文字が判定されます）。
                  </li>
                  <li>
                    <strong>「.SPS構文ファイル」</strong>をダウンロードし、SPSSの [ファイル] → [開く] → [シンタックス] で開き、メニューの [実行] → [すべて] を押すと、各設問の日本語ラベルや値ラベルが全自動で設定されます。
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* Qualtrics Response Viewer (回答詳細モーダル) */}
      {/* ========================================================================= */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-slate-300 w-full max-w-4xl max-h-[92vh] rounded shadow-2xl flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-100">
            {/* モーダルヘッダー (Qualtricsスタイル) */}
            <div className="px-5 py-3.5 border-b border-slate-300 flex items-center justify-between bg-[#f8f9fa]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#0c2340] text-white flex items-center justify-center text-xs font-bold font-mono">
                  R
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 font-mono">
                      Response: {selectedSession.id}
                    </h2>
                    {detailSource && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-700">
                        {detailSource.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    記録日時: {new Date(selectedSession.created_at).toLocaleString('ja-JP')} | 年齢: {selectedSession.age ? `${selectedSession.age}歳` : '-'} | 性別: {selectedSession.gender || '-'} | ターン: {selectedSession.dialogue_turns || 0}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSingleSessionJson(selectedSession)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 font-semibold shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <Download size={13} />
                  <span>JSON保存</span>
                </button>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* モーダルタブ切り替え */}
            <div className="flex border-b border-slate-300 px-5 bg-white text-xs font-bold text-slate-600">
              <button
                onClick={() => setActiveModalTab('overview')}
                className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'overview'
                    ? 'border-[#007ac1] text-[#007ac1]'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <BarChart3 size={14} />
                <span>5因子スコア対比 & AIプロファイル</span>
              </button>

              <button
                onClick={() => setActiveModalTab('survey')}
                className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'survey'
                    ? 'border-[#007ac1] text-[#007ac1]'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet size={14} />
                <span>BFI-2-S 質問紙回答 (全30問)</span>
              </button>

              <button
                onClick={() => setActiveModalTab('chat')}
                className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'chat'
                    ? 'border-[#007ac1] text-[#007ac1]'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <MessageSquare size={14} />
                <span>対話ログ全文 ({selectedSession.dialogue_turns || 0}ターン)</span>
              </button>

              <button
                onClick={() => setActiveModalTab('json')}
                className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'json'
                    ? 'border-[#007ac1] text-[#007ac1]'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <FileCode size={14} />
                <span>Raw JSON</span>
              </button>
            </div>

            {/* モーダル本文 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-800">
              {isLoadingDetail && (
                <div className="p-2.5 bg-sky-50 border border-sky-200 rounded text-[#007ac1] flex items-center gap-2">
                  <RefreshCw size={13} className="animate-spin" />
                  <span>ストレージから完全データを読み込み中...</span>
                </div>
              )}

              {/* タブ1: 5因子スコア対比 & AIプロファイル */}
              {activeModalTab === 'overview' && (
                <div className="space-y-4">
                  {/* スコア対比スプレッドシート */}
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#f8f9fa] text-slate-700 font-bold border-b border-slate-300 text-[11px]">
                        <tr>
                          <th className="py-2 px-3 border-r border-slate-200">次元 (Dimension)</th>
                          <th className="py-2 px-3 border-r border-slate-200 text-right text-emerald-800 bg-emerald-50/50">AIスコア (0-100)</th>
                          <th className="py-2 px-3 border-r border-slate-200 text-right bg-slate-100">質問紙スコア (0-100)</th>
                          <th className="py-2 px-3 border-r border-slate-200 text-right bg-indigo-50/70">差分 (AI - Surv)</th>
                          <th className="py-2 px-3 text-center">判定</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono">
                        {[
                          { name: '開放性 (O / Openness)', ai: selectedSession.ai_openness, surv: selectedSession.survey_openness },
                          { name: '誠実性 (C / Conscientiousness)', ai: selectedSession.ai_conscientiousness, surv: selectedSession.survey_conscientiousness },
                          { name: '外向性 (E / Extraversion)', ai: selectedSession.ai_extraversion, surv: selectedSession.survey_extraversion },
                          { name: '協調性 (A / Agreeableness)', ai: selectedSession.ai_agreeableness, surv: selectedSession.survey_agreeableness },
                          { name: '情緒安定性 (N / Neuroticism)', ai: selectedSession.ai_neuroticism, surv: selectedSession.survey_neuroticism }
                        ].map(d => {
                          const aiVal = d.ai != null ? Math.round(d.ai) : null;
                          const survVal = d.surv != null ? Math.round(d.surv) : null;
                          const diff = (aiVal != null && survVal != null) ? aiVal - survVal : null;
                          const absDiff = diff != null ? Math.abs(diff) : null;

                          return (
                            <tr key={d.name} className="hover:bg-slate-50">
                              <td className="py-2 px-3 border-r border-slate-200 font-sans font-bold text-slate-800">
                                {d.name}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-emerald-700">
                                {aiVal != null ? aiVal : '-'}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-slate-800 bg-slate-50/40">
                                {survVal != null ? survVal : '-'}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-indigo-800 bg-indigo-50/30">
                                {diff != null ? (diff > 0 ? `+${diff}` : diff) : '-'}
                              </td>
                              <td className="py-2 px-3 text-center font-sans">
                                {absDiff != null ? (
                                  absDiff <= 10 ? (
                                    <span className="text-emerald-700 font-bold text-[11px]">高一致</span>
                                  ) : absDiff <= 20 ? (
                                    <span className="text-amber-700 font-semibold text-[11px]">中一致</span>
                                  ) : (
                                    <span className="text-rose-700 font-semibold text-[11px]">乖離あり</span>
                                  )
                                ) : (
                                  '-'
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* AI分析サマリーカード */}
                  <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Personality Title</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                        {selectedSession.ai_personality_title || '未分析'}
                      </h4>
                      {selectedSession.ai_personality_type && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-100 text-[#007ac1]">
                          タイプ: {selectedSession.ai_personality_type}
                        </span>
                      )}
                    </div>

                    {selectedSession.ai_summary && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Summary</span>
                        <p className="text-xs text-slate-700 leading-relaxed mt-1">
                          {selectedSession.ai_summary}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* タブ2: BFI-2-S 質問紙回答 (全30問) */}
              {activeModalTab === 'survey' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    尺度名: <strong className="text-slate-800">{selectedSession.survey_scale_name || 'BFI-2-S 日本語版 (30項目)'}</strong> | 完了日時: {selectedSession.survey_completed_at ? new Date(selectedSession.survey_completed_at).toLocaleString('ja-JP') : '未完了'}
                  </div>

                  {(() => {
                    let answers: Record<string | number, number> = {};
                    try {
                      if (selectedSession.parsed_survey_answers) answers = selectedSession.parsed_survey_answers;
                      else if (selectedSession.survey_raw_answers) answers = JSON.parse(selectedSession.survey_raw_answers);
                    } catch (_) {}

                    if (Object.keys(answers).length === 0) {
                      return <div className="py-8 text-center text-slate-400">質問紙の回答データはありません。</div>;
                    }

                    const labels: Record<number, string> = {
                      1: '全くあてはまらない',
                      2: 'あまりあてはまらない',
                      3: 'どちらともいえない',
                      4: 'ややあてはまる',
                      5: 'とてもよくあてはまる'
                    };

                    return (
                      <div className="border border-slate-300 rounded overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-[#f8f9fa] text-slate-700 font-bold border-b border-slate-300 text-[11px]">
                            <tr>
                              <th className="py-2 px-3 border-r border-slate-200 text-center w-10">No.</th>
                              <th className="py-2 px-3 border-r border-slate-200">設問文</th>
                              <th className="py-2 px-3 border-r border-slate-200 w-28">因子 / ファセット</th>
                              <th className="py-2 px-3 border-r border-slate-200 text-center w-36">回答 (1-5)</th>
                              <th className="py-2 px-3 text-center w-20">得点(反転後)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {BFI_2_S_CONFIG.questions.map(q => {
                              const raw = answers[q.id];
                              const scored = raw != null ? (q.is_reverse ? 6 - raw : raw) : null;

                              return (
                                <tr key={q.id} className="hover:bg-slate-50">
                                  <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-500">
                                    Q{q.id}
                                  </td>
                                  <td className="py-1.5 px-3 border-r border-slate-200 text-slate-800">
                                    <span>{q.text}</span>
                                    {q.is_reverse && (
                                      <span className="ml-1 text-[10px] text-amber-700 font-bold">[反転]</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-3 border-r border-slate-200 text-slate-600">
                                    {q.facet}
                                  </td>
                                  <td className="py-1.5 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                                    {raw != null ? (
                                      <span className="font-mono font-bold text-slate-800">
                                        {raw} <span className="font-normal text-slate-500">({labels[raw]})</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-3 text-center font-mono font-bold text-indigo-700">
                                    {scored != null ? scored : '-'}
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

              {/* タブ3: 対話ログ全文 */}
              {activeModalTab === 'chat' && (
                <div className="space-y-3">
                  {(() => {
                    let messages: ChatMessage[] = [];
                    try {
                      if (selectedSession.parsed_messages) messages = selectedSession.parsed_messages;
                      else if (selectedSession.chat_messages) messages = JSON.parse(selectedSession.chat_messages);
                    } catch (_) {}

                    if (messages.length === 0) {
                      return <div className="py-8 text-center text-slate-400">対話ログがありません。</div>;
                    }

                    return (
                      <div className="space-y-3">
                        {messages.map((m, idx) => {
                          const isUser = m.role === 'user';
                          return (
                            <div key={idx} className={`p-3 rounded border text-xs leading-relaxed ${isUser ? 'bg-sky-50 border-sky-200 ml-8' : 'bg-slate-50 border-slate-200 mr-8'}`}>
                              <div className="font-bold mb-1 text-[11px] text-slate-500">
                                {isUser ? '被験者 (Participant)' : 'Dr. OCEAN (AI分析官)'}
                              </div>
                              <div className="text-slate-800 whitespace-pre-wrap">{m.content}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* タブ4: Raw JSON */}
              {activeModalTab === 'json' && (
                <pre className="p-3 bg-slate-900 text-slate-200 rounded text-[11px] font-mono overflow-x-auto max-h-[500px]">
                  {JSON.stringify(selectedSession, null, 2)}
                </pre>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="px-5 py-3 border-t border-slate-300 bg-[#f8f9fa] flex items-center justify-between">
              <span className="font-mono text-[11px] text-slate-500">ID: {selectedSession.id}</span>
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded text-xs transition cursor-pointer"
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
