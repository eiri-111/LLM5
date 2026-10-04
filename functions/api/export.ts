import { Env } from './_gateway';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
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
    const { results } = await env.DB.prepare(`
      SELECT 
        id, student_id, age, gender, created_at, dialogue_turns,
        qualtrics_id,
        ai_personality_title, ai_personality_type,
        ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
        survey_scale_type, survey_scale_name,
        survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
        survey_completed_at,
        chat_messages, ai_full_result, survey_raw_answers
      FROM assessment_sessions
      ORDER BY created_at DESC
    `).all();

    if (format === 'csv') {
      const headers = [
        'id', 'student_id', 'age', 'gender', 'created_at', 'dialogue_turns',
        'qualtrics_id',
        'ai_personality_title', 'ai_personality_type',
        'ai_openness', 'ai_conscientiousness', 'ai_extraversion', 'ai_agreeableness', 'ai_neuroticism',
        'survey_scale_type', 'survey_scale_name',
        'survey_openness', 'survey_conscientiousness', 'survey_extraversion', 'survey_agreeableness', 'survey_neuroticism',
        'survey_completed_at'
      ];

      const csvRows = [headers.join(',')];

      for (const row of (results as any[])) {
        const line = headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(',');
        csvRows.push(line);
      }

      return new Response(csvRows.join('\r\n'), {
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
