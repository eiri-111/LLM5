import { Env, verifyAdminPassword } from '../_gateway';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();

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
    const { results } = await env.DB.prepare(`
      SELECT 
        id, student_id, age, gender, created_at, dialogue_turns,
        qualtrics_id,
        ai_personality_title, ai_personality_type, ai_summary,
        ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
        survey_scale_type, survey_scale_name,
        survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
        survey_completed_at,
        chat_messages, ai_full_result, survey_raw_answers
      FROM assessment_sessions
      ORDER BY created_at DESC
    `).all();

    const dataRows = (results || []) as any[];
    const nowIso = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'json') {
      // JSONエクスポート
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
          'Content-Disposition': `attachment; filename="llm5_research_data_${nowIso}.json"`,
          'Cache-Control': 'no-store'
        }
      });
    }

    // CSVエクスポート
    const headers = [
      'id',
      'student_id',
      'age',
      'gender',
      'created_at',
      'dialogue_turns',
      'qualtrics_id',
      'survey_completed_at',
      'ai_personality_title',
      'ai_personality_type',
      'ai_summary',
      'ai_openness',
      'ai_conscientiousness',
      'ai_extraversion',
      'ai_agreeableness',
      'ai_neuroticism',
      'survey_scale_type',
      'survey_scale_name',
      'survey_openness',
      'survey_conscientiousness',
      'survey_extraversion',
      'survey_agreeableness',
      'survey_neuroticism',
      'survey_raw_answers',
      'chat_messages'
    ];

    const csvLines: string[] = [headers.join(',')];

    for (const row of dataRows) {
      const line = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '""';
        // 改行やダブルクォートを適切にエスケープ
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',');
      csvLines.push(line);
    }

    // Excel対応のため UTF-8 BOM (\uFEFF) を先頭に追加
    const bomCsv = '\uFEFF' + csvLines.join('\r\n');

    return new Response(bomCsv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="llm5_research_data_${nowIso}.csv"`,
        'Cache-Control': 'no-store'
      }
    });

  } catch (err: any) {
    console.error('Export error:', err);
    return new Response(JSON.stringify({ error: err.message || 'データ取得エラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
};
