import { Env, verifyAdminPassword } from '../_gateway';

// BFI-2-S 30設問の逆転項目定義 (1-indexed)
// 逆転項目: 1, 3, 5, 7, 8, 10, 14, 17, 19, 22, 23, 26, 27, 30
const REVERSE_ITEMS = new Set([1, 3, 5, 7, 8, 10, 14, 17, 19, 22, 23, 26, 27, 30]);

// 社会的望ましさ尺度 (SDS) 10設問の逆転項目 (Q31〜Q40): Q32, Q35, Q37, Q39
const SDS_REVERSE_ITEMS = new Set([32, 35, 37, 39]);

const QUESTION_LABELS: Record<number, string> = {
  1: 'Q01_無口な方だ(E_逆)',
  2: 'Q02_他人への思いやりがあり優しい(A)',
  3: 'Q03_行き当たりばったりな方だ(C_逆)',
  4: 'Q04_多くの悩みごとを抱えている(N)',
  5: 'Q05_芸術的関心があまりない(O_逆)',
  6: 'Q06_堂々としていて自己主張ができる(E)',
  7: 'Q07_他人を疑いやすい(A_逆)',
  8: 'Q08_怠けがちである(C_逆)',
  9: 'Q09_落ち込んだり憂鬱になりやすい(N)',
  10: 'Q10_抽象的な知識にはほとんど関心がない(O_逆)',
  11: 'Q11_いつもエネルギーに満ちている(E)',
  12: 'Q12_誰に対しても礼儀正しく敬意を払う(A)',
  13: 'Q13_信頼がおけ常に頼りになる(C)',
  14: 'Q14_情緒が安定していて動じにくい(N_逆)',
  15: 'Q15_独創的で新しいアイデアを思いつく(O)',
  16: 'Q16_積極的で社交的である(E)',
  17: 'Q17_冷淡で思いやりに欠けることがある(A_逆)',
  18: 'Q18_物事をきちんと整理整頓しておく(C)',
  19: 'Q19_リラックスしていてストレスに対処(N_逆)',
  20: 'Q20_芸術や音楽文学に強い魅力を感じる(O)',
  21: 'Q21_他人をリードするのが得意である(E)',
  22: 'Q22_他人と対立し揉め事を起こしやすい(A_逆)',
  23: 'Q23_物事を最後までやり通すのが苦手(C_逆)',
  24: 'Q24_不安や緊張を感じやすい(N)',
  25: 'Q25_考え方が複雑で深く考える人間だ(O)',
  26: 'Q26_控えめで大人しい(E_逆)',
  27: 'Q27_他人に対して冷たく無関心になりやすい(A_逆)',
  28: 'Q28_効率的に仕事をこなす(C)',
  29: 'Q29_気分の浮き沈みが激しい(N)',
  30: 'Q30_創造性がほとんどない(O_逆)'
};

const SDS_LABELS: Record<number, string> = {
  31: 'SDS_Q01_他者欠点への不怒',
  32: 'SDS_Q02_思い通りにならない時の不機嫌(逆)',
  33: 'SDS_Q03_過ちの即座受容',
  34: 'SDS_Q04_噂話悪口の完全拒絶',
  35: 'SDS_Q05_断りの口実模索(逆)',
  36: 'SDS_Q06_普遍的公平親切',
  37: 'SDS_Q07_知ったかぶりの経験(逆)',
  38: 'SDS_Q08_時間締切の完全厳守',
  39: 'SDS_Q09_お礼の失念(逆)',
  40: 'SDS_Q10_感情的言動の完全皆無'
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'spss_csv').toLowerCase();
  const headerMode = (url.searchParams.get('header') || 'single').toLowerCase(); // 'single' (SPSS用1行) or 'qualtrics' (3行)

  // 管理者認証チェック
  if (!verifyAdminPassword(request, env)) {
    return new Response(JSON.stringify({
      error: '認証エラー: 正しい管理者パスワードを指定してください (?key=... または ヘッダー)'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({
      error: 'D1データベースがバインドされていません'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  try {
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 2000) : (format === 'json' ? 500 : 2000);

    const selectQuery = format === 'json'
      ? `SELECT 
          id, age, gender, created_at, dialogue_turns,
          ai_personality_title, ai_personality_type, ai_summary,
          ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
          survey_scale_type, survey_scale_name,
          survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
          survey_social_desirability,
          survey_completed_at,
          COALESCE(r2_saved, 0) AS r2_saved, r2_key,
          chat_messages, ai_full_result, survey_raw_answers
        FROM assessment_sessions
        ORDER BY created_at DESC
        LIMIT ?`
      : `SELECT 
          id, age, gender, created_at, dialogue_turns,
          ai_personality_title, ai_personality_type, ai_summary,
          ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
          survey_scale_type, survey_scale_name,
          survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
          survey_social_desirability,
          survey_completed_at,
          COALESCE(r2_saved, 0) AS r2_saved, r2_key,
          ai_full_result, survey_raw_answers
        FROM assessment_sessions
        ORDER BY created_at DESC
        LIMIT ?`;

    const { results } = await env.DB.prepare(selectQuery).bind(limit).all();

    const dataRows = (results || []) as any[];
    const nowIso = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // SPSS対応 CSV / シンタックス共通 変数定義
    const varNames = [
      'ResponseId',
      'RecordedDate',
      'Finished',
      'DialogueTurns',
      'Age',
      'Gender_Code',
      'Gender',
      'AI_PersonalityTitle',
      'AI_PersonalityType',
      // AI 5因子スコア (情緒安定性と神経症傾向の双方を明示)
      'AI_Openness',
      'AI_Conscientiousness',
      'AI_Extraversion',
      'AI_Agreeableness',
      'AI_EmotionalStability',
      'AI_Neuroticism',
      // AI 5因子直接スコア (案2: 比較検証用)
      'AI_Dir_Openness',
      'AI_Dir_Conscientiousness',
      'AI_Dir_Extraversion',
      'AI_Dir_Agreeableness',
      'AI_Dir_EmotionalStability',
      'AI_Dir_Neuroticism',
      // 質問紙 5因子スコア (0-100正規化)
      'Survey_Openness',
      'Survey_Conscientiousness',
      'Survey_Extraversion',
      'Survey_Agreeableness',
      'Survey_EmotionalStability',
      'Survey_Neuroticism',
      // 質問紙 追加尺度 (社会的望ましさ 0-100正規化)
      'Survey_SocialDesirability',
      // AI妥当性指標 (建前・社会的望ましさ度) & 差分
      'AI_Val_SocialDesirability',
      'Diff_SocialDesirability',
      // AI vs 質問紙 差分 (AI - Survey)
      'Diff_Openness',
      'Diff_Conscientiousness',
      'Diff_Extraversion',
      'Diff_Agreeableness',
      'Diff_EmotionalStability',
      'Diff_Neuroticism',
      // AI vs 質問紙 絶対差分 (|AI - Survey|)
      'AbsDiff_Openness',
      'AbsDiff_Conscientiousness',
      'AbsDiff_Extraversion',
      'AbsDiff_Agreeableness',
      'AbsDiff_EmotionalStability',
      'AbsDiff_Neuroticism',
      // 完全二元化評価スコア (STAR行動実績 vs SJT状況判断 vs ギャップ)
      'STAR_Openness',
      'STAR_Conscientiousness',
      'STAR_Extraversion',
      'STAR_Agreeableness',
      'STAR_EmotionalStability',
      'STAR_Neuroticism',
      'SJT_Openness',
      'SJT_Conscientiousness',
      'SJT_Extraversion',
      'SJT_Agreeableness',
      'SJT_EmotionalStability',
      'SJT_Neuroticism',
      'Gap_Openness',
      'Gap_Conscientiousness',
      'Gap_Extraversion',
      'Gap_Agreeableness',
      'Gap_EmotionalStability',
      'Gap_Neuroticism',
      // AI 15ファセット個別スコア
      'AI_O_Intellectual',
      'AI_O_Aesthetic',
      'AI_O_Creative',
      'AI_C_Organization',
      'AI_C_Productiveness',
      'AI_C_Responsibility',
      'AI_E_Sociability',
      'AI_E_Assertiveness',
      'AI_E_Activity',
      'AI_A_Compassion',
      'AI_A_Respect',
      'AI_A_Trust',
      'AI_N_Anxiety',
      'AI_N_Depression',
      'AI_N_Volatility',
      // BFI-2-S 30設問 生回答 (1-5)
      ...Array.from({ length: 30 }, (_, i) => `BFI_Q${String(i + 1).padStart(2, '0')}`),
      // BFI-2-S 30設問 反転後得点 (1-5)
      ...Array.from({ length: 30 }, (_, i) => `BFI_Q${String(i + 1).padStart(2, '0')}_Scored`),
      // 社会的望ましさ尺度 (SDS) 10設問 生回答 & 反転後得点 (Q31-Q40)
      ...Array.from({ length: 10 }, (_, i) => `SDS_Q${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 10 }, (_, i) => `SDS_Q${String(i + 1).padStart(2, '0')}_Scored`),
      'R2_Saved',
      'AI_Summary'
    ];

    // 変数ラベル (Qualtrics 3行ヘッダー用 / SPSS用)
    const varLabels: Record<string, string> = {
      ResponseId: '回答セッションID',
      RecordedDate: '記録日時 (ISO)',
      Finished: '完了フラグ (1:完了, 0:未完了)',
      DialogueTurns: '対話ターン数 (発話往復数)',
      Age: '年齢',
      Gender_Code: '性別コード (1:男性, 2:女性, 3:その他, 9:未回答)',
      Gender: '性別ラベル',
      AI_PersonalityTitle: 'AI性格キャッチコピー',
      AI_PersonalityType: 'AI性格タイプ',
      AI_Openness: 'AI開放性スコア (0-100)',
      AI_Conscientiousness: 'AI誠実性スコア (0-100)',
      AI_Extraversion: 'AI外向性スコア (0-100)',
      AI_Agreeableness: 'AI協調性スコア (0-100)',
      AI_EmotionalStability: 'AI情緒安定性スコア (0-100, 高=安定)',
      AI_Neuroticism: 'AI神経症傾向スコア (0-100, 高=敏感/不安)',
      AI_Dir_Openness: 'AI直接開放性スコア (0-100)',
      AI_Dir_Conscientiousness: 'AI直接誠実性スコア (0-100)',
      AI_Dir_Extraversion: 'AI直接外向性スコア (0-100)',
      AI_Dir_Agreeableness: 'AI直接協調性スコア (0-100)',
      AI_Dir_EmotionalStability: 'AI直接情緒安定性スコア (0-100)',
      AI_Dir_Neuroticism: 'AI直接神経症傾向スコア (0-100)',
      Survey_Openness: '質問紙開放性スコア (0-100)',
      Survey_Conscientiousness: '質問紙誠実性スコア (0-100)',
      Survey_Extraversion: '質問紙外向性スコア (0-100)',
      Survey_Agreeableness: '質問紙協調性スコア (0-100)',
      Survey_EmotionalStability: '質問紙情緒安定性スコア (0-100, 高=安定)',
      Survey_Neuroticism: '質問紙神経症傾向スコア (0-100, 高=敏感/不安)',
      Survey_SocialDesirability: '質問紙社会的望ましさスコア (0-100, 高=模範解答・建前バイアス高)',
      AI_Val_SocialDesirability: 'AI推定社会的望ましさ偏重度 (0-100, 対話妥当性チェック)',
      Diff_SocialDesirability: '社会的望ましさ差分 (AI - 質問紙)',
      Diff_Openness: '開放性差分 (AI - Survey)',
      Diff_Conscientiousness: '誠実性差分 (AI - Survey)',
      Diff_Extraversion: '外向性差分 (AI - Survey)',
      Diff_Agreeableness: '協調性差分 (AI - Survey)',
      Diff_EmotionalStability: '情緒安定性差分 (AI - Survey)',
      Diff_Neuroticism: '神経症傾向差分 (AI - Survey)',
      AbsDiff_Openness: '開放性絶対差分 (|AI - Survey|)',
      AbsDiff_Conscientiousness: '誠実性絶対差分 (|AI - Survey|)',
      AbsDiff_Extraversion: '外向性絶対差分 (|AI - Survey|)',
      AbsDiff_Agreeableness: '協調性絶対差分 (|AI - Survey|)',
      AbsDiff_EmotionalStability: '情緒安定性絶対差分 (|AI - Survey|)',
      AbsDiff_Neuroticism: '神経症傾向絶対差分 (|AI - Survey|)',
      STAR_Openness: 'STAR法行動実績: 開放性 (0-100)',
      STAR_Conscientiousness: 'STAR法行動実績: 誠実性 (0-100)',
      STAR_Extraversion: 'STAR法行動実績: 外向性 (0-100)',
      STAR_Agreeableness: 'STAR法行動実績: 協調性 (0-100)',
      STAR_EmotionalStability: 'STAR法行動実績: 情緒安定性 (0-100)',
      STAR_Neuroticism: 'STAR法行動実績: 神経症傾向 (0-100)',
      SJT_Openness: 'SJT状況判断: 開放性 (0-100)',
      SJT_Conscientiousness: 'SJT状況判断: 誠実性 (0-100)',
      SJT_Extraversion: 'SJT状況判断: 外向性 (0-100)',
      SJT_Agreeableness: 'SJT状況判断: 協調性 (0-100)',
      SJT_EmotionalStability: 'SJT状況判断: 情緒安定性 (0-100)',
      SJT_Neuroticism: 'SJT状況判断: 神経症傾向 (0-100)',
      Gap_Openness: '判断ギャップ: 開放性 (SJT - STAR)',
      Gap_Conscientiousness: '判断ギャップ: 誠実性 (SJT - STAR)',
      Gap_Extraversion: '判断ギャップ: 外向性 (SJT - STAR)',
      Gap_Agreeableness: '判断ギャップ: 協調性 (SJT - STAR)',
      Gap_EmotionalStability: '判断ギャップ: 情緒安定性 (SJT - STAR)',
      Gap_Neuroticism: '判断ギャップ: 神経症傾向 (SJT - STAR)',
      AI_O_Intellectual: 'AIファセット: 知的好奇心',
      AI_O_Aesthetic: 'AIファセット: 美的好奇心',
      AI_O_Creative: 'AIファセット: 創造力',
      AI_C_Organization: 'AIファセット: 組織化',
      AI_C_Productiveness: 'AIファセット: 生産性',
      AI_C_Responsibility: 'AIファセット: 責任感',
      AI_E_Sociability: 'AIファセット: 社交性',
      AI_E_Assertiveness: 'AIファセット: 主張性',
      AI_E_Activity: 'AIファセット: 活動性',
      AI_A_Compassion: 'AIファセット: 思いやり',
      AI_A_Respect: 'AIファセット: 敬意',
      AI_A_Trust: 'AIファセット: 信頼',
      AI_N_Anxiety: 'AIファセット: 不安の低さ',
      AI_N_Depression: 'AIファセット: 抑うつの低さ',
      AI_N_Volatility: 'AIファセット: 感情変動の低さ',
      R2_Saved: 'R2オブジェクト保存済フラグ',
      AI_Summary: 'AI分析プロファイル要約'
    };

    for (let i = 1; i <= 30; i++) {
      const qKey = `BFI_Q${String(i).padStart(2, '0')}`;
      varLabels[qKey] = QUESTION_LABELS[i] || `設問${i}`;
      varLabels[`${qKey}_Scored`] = `設問${i}_反転後得点(1-5)`;
    }

    for (let i = 1; i <= 10; i++) {
      const globalId = 30 + i;
      const qKey = `SDS_Q${String(i).padStart(2, '0')}`;
      varLabels[qKey] = SDS_LABELS[globalId] || `社会的望ましさ設問${i}`;
      varLabels[`${qKey}_Scored`] = `社会的望ましさ設問${i}_反転後得点(1-5)`;
    }

    // 1. JSONエクスポート
    if (format === 'json') {
      const formattedJson = dataRows.map(row => {
        let messages = [];
        try { if (row.chat_messages) messages = JSON.parse(row.chat_messages); } catch (_) {}

        let aiResult = null;
        try { if (row.ai_full_result) aiResult = JSON.parse(row.ai_full_result); } catch (_) {}

        let surveyAnswers = null;
        try { if (row.survey_raw_answers) surveyAnswers = JSON.parse(row.survey_raw_answers); } catch (_) {}

        return {
          ...row,
          chat_messages: messages,
          ai_full_result: aiResult,
          survey_raw_answers: surveyAnswers
        };
      });

      return new Response(JSON.stringify(formattedJson, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="llm5_dataset_${nowIso}.json"`,
          'Cache-Control': 'no-store'
        }
      });
    }

    // 2. SPSSシンタックスファイル (.sps) 生成 (全変数の完全定義・尺度水準の同期)
    if (format === 'sps') {
      const nominalVars = ['ResponseId', 'RecordedDate', 'Finished', 'Gender_Code', 'Gender', 'AI_PersonalityTitle', 'AI_PersonalityType', 'R2_Saved', 'AI_Summary'];
      const scaleVars = varNames.filter(v => !nominalVars.includes(v));

      const spsContent = `* SPSS Syntax for LLM5 Big Five Dataset.
* Generated at: ${new Date().toISOString()}.
* Usage: SPSSで [ファイル] -> [開く] -> [シンタックス] で実行、またはCSV読み込み後に実行してください.

VARIABLE LABELS
  ${varNames.map(v => `${v} '${(varLabels[v] || v).replace(/'/g, "''")}'`).join('\n  ')}.

VALUE LABELS
  Finished
    0 '未完了'
    1 '完了'
  /Gender_Code
    1 '男性'
    2 '女性'
    3 'その他'
    9 '無回答・未設定'
  /R2_Saved
    0 '未保存'
    1 '保存済'
  /${Array.from({ length: 30 }, (_, i) => `BFI_Q${String(i + 1).padStart(2, '0')}`).join(' ')} ${Array.from({ length: 10 }, (_, i) => `SDS_Q${String(i + 1).padStart(2, '0')}`).join(' ')}
    1 '全くあてはまらない'
    2 'あまりあてはまらない'
    3 'どちらともいえない'
    4 'ややあてはまる'
    5 'とてもよくあてはまる'
  /${Array.from({ length: 30 }, (_, i) => `BFI_Q${String(i + 1).padStart(2, '0')}_Scored`).join(' ')} ${Array.from({ length: 10 }, (_, i) => `SDS_Q${String(i + 1).padStart(2, '0')}_Scored`).join(' ')}
    1 '低特性'
    2 'やや低'
    3 '中程度'
    4 'やや高'
    5 '高特性'.

VARIABLE LEVEL
  ${nominalVars.filter(v => varNames.includes(v)).join(' ')} (NOMINAL)
  ${scaleVars.join(' ')} (SCALE).

EXECUTE.
`;
      return new Response(spsContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="llm5_spss_syntax_${nowIso}.sps"`,
          'Cache-Control': 'no-store'
        }
      });
    }

    // 3. SPSS対応 CSV エクスポート (Q1〜Q30展開、SPSS準拠変数名、差分変数、デュアル評価変数)
    const csvLines: string[] = [];

    // ヘッダー行の構築
    if (headerMode === 'qualtrics') {
      // 1行目: 変数名
      csvLines.push(varNames.join(','));
      // 2行目: 変数ラベル / 設問テキスト
      csvLines.push(varNames.map(v => `"${(varLabels[v] || v).replace(/"/g, '""')}"`).join(','));
      // 3行目: Qualtrics ImportId
      csvLines.push(varNames.map(v => `"${v}"`).join(','));
    } else {
      // SPSS標準: 1行目に変数名のみ
      csvLines.push(varNames.join(','));
    }

    // データ行の書き出し
    for (const row of dataRows) {
      let parsedAi: any = null;
      try { if (row.ai_full_result) parsedAi = JSON.parse(row.ai_full_result); } catch (_) {}

      let parsedAnswers: Record<string | number, number> = {};
      try { if (row.survey_raw_answers) parsedAnswers = JSON.parse(row.survey_raw_answers); } catch (_) {}

      const directScores = parsedAi?.clef_scoring_data?.direct_scores;
      const facets = parsedAi?.clef_scoring_data?.facets;
      const dualScores = parsedAi?.clef_scoring_data?.dual_scores;

      // 性別コード変換
      let genderCode = 9;
      let genderLabel = row.gender || '';
      if (row.gender === 'male' || row.gender === '男性') {
        genderCode = 1;
        genderLabel = '男性';
      } else if (row.gender === 'female' || row.gender === '女性') {
        genderCode = 2;
        genderLabel = '女性';
      } else if (row.gender === 'other' || row.gender === 'その他') {
        genderCode = 3;
        genderLabel = 'その他';
      }

      // 差分計算ヘルパー
      const calcDiff = (ai: any, survey: any) => {
        if (ai != null && survey != null && ai !== '' && survey !== '') {
          return Math.round((Number(ai) - Number(survey)) * 100) / 100;
        }
        return '';
      };
      const calcAbsDiff = (ai: any, survey: any) => {
        if (ai != null && survey != null && ai !== '' && survey !== '') {
          return Math.round(Math.abs(Number(ai) - Number(survey)) * 100) / 100;
        }
        return '';
      };

      const isFinished = Boolean(row.survey_completed_at && (row.ai_openness != null || row.ai_personality_title)) ? 1 : 0;

      // 情緒安定性（高=安定）と神経症傾向（高=敏感/不安）の双方向算出
      const aiES = row.ai_neuroticism != null ? Math.round(row.ai_neuroticism) : '';
      const aiN = row.ai_neuroticism != null ? Math.round(100 - row.ai_neuroticism) : '';
      const dirES = directScores?.neuroticism != null ? Math.round(directScores.neuroticism) : '';
      const dirN = directScores?.neuroticism != null ? Math.round(100 - directScores.neuroticism) : '';
      const surveyES = row.survey_neuroticism != null ? Math.round(row.survey_neuroticism) : '';
      const surveyN = row.survey_neuroticism != null ? Math.round(100 - row.survey_neuroticism) : '';

      const record: Record<string, any> = {
        ResponseId: row.id,
        RecordedDate: row.created_at,
        Finished: isFinished,
        DialogueTurns: row.dialogue_turns ?? 0,
        Age: row.age > 0 ? row.age : '',
        Gender_Code: genderCode,
        Gender: genderLabel,
        AI_PersonalityTitle: row.ai_personality_title || '',
        AI_PersonalityType: row.ai_personality_type || '',

        // AI 5因子スコア (0-100)
        AI_Openness: row.ai_openness != null ? Math.round(row.ai_openness) : '',
        AI_Conscientiousness: row.ai_conscientiousness != null ? Math.round(row.ai_conscientiousness) : '',
        AI_Extraversion: row.ai_extraversion != null ? Math.round(row.ai_extraversion) : '',
        AI_Agreeableness: row.ai_agreeableness != null ? Math.round(row.ai_agreeableness) : '',
        AI_EmotionalStability: aiES,
        AI_Neuroticism: aiN,

        // AI 直接スコア
        AI_Dir_Openness: directScores?.openness != null ? Math.round(directScores.openness) : '',
        AI_Dir_Conscientiousness: directScores?.conscientiousness != null ? Math.round(directScores.conscientiousness) : '',
        AI_Dir_Extraversion: directScores?.extraversion != null ? Math.round(directScores.extraversion) : '',
        AI_Dir_Agreeableness: directScores?.agreeableness != null ? Math.round(directScores.agreeableness) : '',
        AI_Dir_EmotionalStability: dirES,
        AI_Dir_Neuroticism: dirN,

        // 質問紙 5因子スコア (0-100)
        Survey_Openness: row.survey_openness != null ? Math.round(row.survey_openness) : '',
        Survey_Conscientiousness: row.survey_conscientiousness != null ? Math.round(row.survey_conscientiousness) : '',
        Survey_Extraversion: row.survey_extraversion != null ? Math.round(row.survey_extraversion) : '',
        Survey_Agreeableness: row.survey_agreeableness != null ? Math.round(row.survey_agreeableness) : '',
        Survey_EmotionalStability: surveyES,
        Survey_Neuroticism: surveyN,

        // 質問紙 追加尺度 (社会的望ましさ)
        Survey_SocialDesirability: row.survey_social_desirability != null ? Math.round(row.survey_social_desirability) : '',

        // AI妥当性指標 (建前・社会的望ましさ度) & 差分
        AI_Val_SocialDesirability: parsedAi?.clef_scoring_data?.multidirectional?.validity_checks?.social_desirability != null
          ? Math.round(parsedAi.clef_scoring_data.multidirectional.validity_checks.social_desirability * 100)
          : '',
        Diff_SocialDesirability: (parsedAi?.clef_scoring_data?.multidirectional?.validity_checks?.social_desirability != null && row.survey_social_desirability != null)
          ? Math.round((parsedAi.clef_scoring_data.multidirectional.validity_checks.social_desirability * 100 - row.survey_social_desirability) * 10) / 10
          : '',

        // 差分 (AI - Survey)
        Diff_Openness: calcDiff(row.ai_openness, row.survey_openness),
        Diff_Conscientiousness: calcDiff(row.ai_conscientiousness, row.survey_conscientiousness),
        Diff_Extraversion: calcDiff(row.ai_extraversion, row.survey_extraversion),
        Diff_Agreeableness: calcDiff(row.ai_agreeableness, row.survey_agreeableness),
        Diff_EmotionalStability: calcDiff(aiES, surveyES),
        Diff_Neuroticism: calcDiff(aiN, surveyN),

        // 絶対差分 (|AI - Survey|)
        AbsDiff_Openness: calcAbsDiff(row.ai_openness, row.survey_openness),
        AbsDiff_Conscientiousness: calcAbsDiff(row.ai_conscientiousness, row.survey_conscientiousness),
        AbsDiff_Extraversion: calcAbsDiff(row.ai_extraversion, row.survey_extraversion),
        AbsDiff_Agreeableness: calcAbsDiff(row.ai_agreeableness, row.survey_agreeableness),
        AbsDiff_EmotionalStability: calcAbsDiff(aiES, surveyES),
        AbsDiff_Neuroticism: calcAbsDiff(aiN, surveyN),

        // 完全二元化評価スコア (STAR行動実績 vs SJT状況判断 vs ギャップ)
        STAR_Openness: dualScores?.star_scores?.openness != null ? Math.round(dualScores.star_scores.openness) : '',
        STAR_Conscientiousness: dualScores?.star_scores?.conscientiousness != null ? Math.round(dualScores.star_scores.conscientiousness) : '',
        STAR_Extraversion: dualScores?.star_scores?.extraversion != null ? Math.round(dualScores.star_scores.extraversion) : '',
        STAR_Agreeableness: dualScores?.star_scores?.agreeableness != null ? Math.round(dualScores.star_scores.agreeableness) : '',
        STAR_EmotionalStability: dualScores?.star_scores?.neuroticism != null ? Math.round(dualScores.star_scores.neuroticism) : '',
        STAR_Neuroticism: dualScores?.star_scores?.neuroticism != null ? Math.round(100 - dualScores.star_scores.neuroticism) : '',

        SJT_Openness: dualScores?.sjt_scores?.openness != null ? Math.round(dualScores.sjt_scores.openness) : '',
        SJT_Conscientiousness: dualScores?.sjt_scores?.conscientiousness != null ? Math.round(dualScores.sjt_scores.conscientiousness) : '',
        SJT_Extraversion: dualScores?.sjt_scores?.extraversion != null ? Math.round(dualScores.sjt_scores.extraversion) : '',
        SJT_Agreeableness: dualScores?.sjt_scores?.agreeableness != null ? Math.round(dualScores.sjt_scores.agreeableness) : '',
        SJT_EmotionalStability: dualScores?.sjt_scores?.neuroticism != null ? Math.round(dualScores.sjt_scores.neuroticism) : '',
        SJT_Neuroticism: dualScores?.sjt_scores?.neuroticism != null ? Math.round(100 - dualScores.sjt_scores.neuroticism) : '',

        Gap_Openness: dualScores?.gap_scores?.openness != null ? Math.round(dualScores.gap_scores.openness) : '',
        Gap_Conscientiousness: dualScores?.gap_scores?.conscientiousness != null ? Math.round(dualScores.gap_scores.conscientiousness) : '',
        Gap_Extraversion: dualScores?.gap_scores?.extraversion != null ? Math.round(dualScores.gap_scores.extraversion) : '',
        Gap_Agreeableness: dualScores?.gap_scores?.agreeableness != null ? Math.round(dualScores.gap_scores.agreeableness) : '',
        Gap_EmotionalStability: dualScores?.gap_scores?.neuroticism != null ? Math.round(dualScores.gap_scores.neuroticism) : '',
        Gap_Neuroticism: dualScores?.gap_scores?.neuroticism != null ? Math.round(-dualScores.gap_scores.neuroticism) : '',

        // 15ファセット
        AI_O_Intellectual: facets?.openness?.intellectual ?? '',
        AI_O_Aesthetic: facets?.openness?.aesthetic ?? '',
        AI_O_Creative: facets?.openness?.creative ?? '',
        AI_C_Organization: facets?.conscientiousness?.organization ?? '',
        AI_C_Productiveness: facets?.conscientiousness?.productiveness ?? '',
        AI_C_Responsibility: facets?.conscientiousness?.responsibility ?? '',
        AI_E_Sociability: facets?.extraversion?.sociability ?? '',
        AI_E_Assertiveness: facets?.extraversion?.assertiveness ?? '',
        AI_E_Activity: facets?.extraversion?.activity ?? '',
        AI_A_Compassion: facets?.agreeableness?.compassion ?? '',
        AI_A_Respect: facets?.agreeableness?.respect ?? '',
        AI_A_Trust: facets?.agreeableness?.trust ?? '',
        AI_N_Anxiety: facets?.neuroticism?.anxiety ?? '',
        AI_N_Depression: facets?.neuroticism?.depression ?? '',
        AI_N_Volatility: facets?.neuroticism?.volatility ?? '',

        R2_Saved: row.r2_saved ? 1 : 0,
        AI_Summary: row.ai_summary || ''
      };

      // 30問の設問生回答と反転後得点をセット
      for (let i = 1; i <= 30; i++) {
        const raw = parsedAnswers[i];
        const qKey = `BFI_Q${String(i).padStart(2, '0')}`;
        if (raw != null && raw >= 1 && raw <= 5) {
          record[qKey] = raw;
          record[`${qKey}_Scored`] = REVERSE_ITEMS.has(i) ? 6 - raw : raw;
        } else {
          record[qKey] = '';
          record[`${qKey}_Scored`] = '';
        }
      }

      // 社会的望ましさ尺度 (SDS) 10問 (Q31-Q40)
      for (let i = 1; i <= 10; i++) {
        const globalId = 30 + i;
        const raw = parsedAnswers[globalId];
        const qKey = `SDS_Q${String(i).padStart(2, '0')}`;
        if (raw != null && raw >= 1 && raw <= 5) {
          record[qKey] = raw;
          record[`${qKey}_Scored`] = SDS_REVERSE_ITEMS.has(globalId) ? 6 - raw : raw;
        } else {
          record[qKey] = '';
          record[`${qKey}_Scored`] = '';
        }
      }

      const line = varNames.map(v => {
        const val = record[v];
        if (val === null || val === undefined || val === '') return '';
        if (typeof val === 'number') return val;
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',');

      csvLines.push(line);
    }

    // Excel・SPSSでの文字化け防止のため UTF-8 BOM (\uFEFF) を付与
    const bomCsv = '\uFEFF' + csvLines.join('\r\n');

    return new Response(bomCsv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="llm5_spss_dataset_${nowIso}.csv"`,
        'Cache-Control': 'no-store'
      }
    });

  } catch (err: any) {
    console.error('Export error:', err);
    return new Response(JSON.stringify({ error: err.message || 'データ出力エラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
};
