import { Env, verifyAdminPassword } from './_gateway';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!verifyAdminPassword(request, env)) {
    return new Response(JSON.stringify({
      error: '認証エラー: 正しい管理者パスワードを指定してください (?key=... または ヘッダー)'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'json';

  if (!env.DB) {
    return new Response(JSON.stringify({
      error: 'D1データベースがバインドされていません',
      hint: 'wrangler.toml で [[d1_databases]] を設定してください'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 2000) : (format === 'json' ? 500 : 2000);

    const selectQuery = format === 'json'
      ? `SELECT 
          id, age, gender, created_at, dialogue_turns,
          ai_personality_title, ai_personality_type,
          ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
          survey_scale_type, survey_scale_name,
          survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
          survey_completed_at,
          chat_messages, ai_full_result, survey_raw_answers
        FROM assessment_sessions
        ORDER BY created_at DESC
        LIMIT ?`
      : `SELECT 
          id, age, gender, created_at, dialogue_turns,
          ai_personality_title, ai_personality_type,
          ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
          survey_scale_type, survey_scale_name,
          survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
          survey_completed_at,
          ai_full_result, survey_raw_answers
        FROM assessment_sessions
        ORDER BY created_at DESC
        LIMIT ?`;

    const { results } = await env.DB.prepare(selectQuery).bind(limit).all();

    if (format === 'csv') {
      const headers = [
        'id', 'age', 'gender', 'created_at', 'dialogue_turns',
        'ai_personality_title', 'ai_personality_type',
        'ai_openness', 'ai_conscientiousness', 'ai_extraversion', 'ai_agreeableness', 'ai_emotional_stability', 'ai_neuroticism',
        'ai_direct_openness', 'ai_direct_conscientiousness', 'ai_direct_extraversion', 'ai_direct_agreeableness', 'ai_direct_emotional_stability', 'ai_direct_neuroticism',
        'survey_scale_type', 'survey_scale_name',
        'survey_openness', 'survey_conscientiousness', 'survey_extraversion', 'survey_agreeableness', 'survey_emotional_stability', 'survey_neuroticism',
        'star_openness', 'star_conscientiousness', 'star_extraversion', 'star_agreeableness', 'star_emotional_stability',
        'sjt_openness', 'sjt_conscientiousness', 'sjt_extraversion', 'sjt_agreeableness', 'sjt_emotional_stability',
        'gap_openness', 'gap_conscientiousness', 'gap_extraversion', 'gap_agreeableness', 'gap_emotional_stability',
        'survey_completed_at',
        'clef_facets_json'
      ];

      const csvRows = [headers.join(',')];

      for (const row of (results as any[])) {
        let parsedAi: any = null;
        try {
          if (row.ai_full_result) parsedAi = JSON.parse(row.ai_full_result);
        } catch (_) {}
        const directScores = parsedAi?.clef_scoring_data?.direct_scores;
        const facetsObj = parsedAi?.clef_scoring_data?.facets;
        const dualScores = parsedAi?.clef_scoring_data?.dual_scores;

        const aiES = row.ai_neuroticism != null ? row.ai_neuroticism : '';
        const aiN = row.ai_neuroticism != null ? (100 - row.ai_neuroticism) : '';
        const dirES = directScores?.neuroticism != null ? directScores.neuroticism : '';
        const dirN = directScores?.neuroticism != null ? (100 - directScores.neuroticism) : '';
        const surveyES = row.survey_neuroticism != null ? row.survey_neuroticism : '';
        const surveyN = row.survey_neuroticism != null ? (100 - row.survey_neuroticism) : '';

        const enrichedRow: Record<string, any> = {
          ...row,
          ai_emotional_stability: aiES,
          ai_neuroticism: aiN,
          ai_direct_openness: directScores?.openness ?? '',
          ai_direct_conscientiousness: directScores?.conscientiousness ?? '',
          ai_direct_extraversion: directScores?.extraversion ?? '',
          ai_direct_agreeableness: directScores?.agreeableness ?? '',
          ai_direct_emotional_stability: dirES,
          ai_direct_neuroticism: dirN,
          survey_emotional_stability: surveyES,
          survey_neuroticism: surveyN,
          star_openness: dualScores?.star_scores?.openness ?? '',
          star_conscientiousness: dualScores?.star_scores?.conscientiousness ?? '',
          star_extraversion: dualScores?.star_scores?.extraversion ?? '',
          star_agreeableness: dualScores?.star_scores?.agreeableness ?? '',
          star_emotional_stability: dualScores?.star_scores?.neuroticism ?? '',
          sjt_openness: dualScores?.sjt_scores?.openness ?? '',
          sjt_conscientiousness: dualScores?.sjt_scores?.conscientiousness ?? '',
          sjt_extraversion: dualScores?.sjt_scores?.extraversion ?? '',
          sjt_agreeableness: dualScores?.sjt_scores?.agreeableness ?? '',
          sjt_emotional_stability: dualScores?.sjt_scores?.neuroticism ?? '',
          gap_openness: dualScores?.gap_scores?.openness ?? '',
          gap_conscientiousness: dualScores?.gap_scores?.conscientiousness ?? '',
          gap_extraversion: dualScores?.gap_scores?.extraversion ?? '',
          gap_agreeableness: dualScores?.gap_scores?.agreeableness ?? '',
          gap_emotional_stability: dualScores?.gap_scores?.neuroticism ?? '',
          clef_facets_json: facetsObj ? JSON.stringify(facetsObj) : ''
        };

        const line = headers.map(h => {
          const val = enrichedRow[h];
          if (val === null || val === undefined || val === '') return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(',');
        csvRows.push(line);
      }

      return new Response('\uFEFF' + csvRows.join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="llm5_sessions_${new Date().toISOString().slice(0, 10)}.csv"`
        }
      });
    }

    return new Response(JSON.stringify({
      total: results.length,
      sessions: results
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Export endpoint error:', err);
    return new Response(JSON.stringify({ error: err.message || 'データ取得エラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
