import { Env, verifyAdminPassword } from '../_gateway';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!verifyAdminPassword(request, env)) {
    return new Response(JSON.stringify({
      success: false,
      error: '認証に失敗しました。管理者パスワードが必要です。'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({
      success: true,
      is_db_connected: false,
      message: 'Cloudflare D1データベースがバインドされていません',
      total: 0,
      sessions: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // テーブルが存在しない場合に備えて確認
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS assessment_sessions (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL,
          age INTEGER NOT NULL,
          gender TEXT NOT NULL,
          created_at TEXT NOT NULL,
          dialogue_turns INTEGER DEFAULT 0,
          chat_messages TEXT,
          ai_personality_title TEXT,
          ai_personality_type TEXT,
          ai_summary TEXT,
          ai_openness REAL,
          ai_conscientiousness REAL,
          ai_extraversion REAL,
          ai_agreeableness REAL,
          ai_neuroticism REAL,
          ai_full_result TEXT,
          qualtrics_id TEXT,
          survey_scale_type TEXT,
          survey_scale_name TEXT,
          survey_raw_answers TEXT,
          survey_openness REAL,
          survey_conscientiousness REAL,
          survey_extraversion REAL,
          survey_agreeableness REAL,
          survey_neuroticism REAL,
          survey_completed_at TEXT
        )
      `).run();
    } catch (_) {}

    const queryResult = await env.DB.prepare(`
      SELECT 
        id,
        student_id,
        age,
        gender,
        created_at,
        dialogue_turns,
        qualtrics_id,
        ai_personality_title,
        ai_personality_type,
        ai_summary,
        ai_openness,
        ai_conscientiousness,
        ai_extraversion,
        ai_agreeableness,
        ai_neuroticism,
        survey_scale_type,
        survey_scale_name,
        survey_openness,
        survey_conscientiousness,
        survey_extraversion,
        survey_agreeableness,
        survey_neuroticism,
        survey_completed_at,
        chat_messages,
        ai_full_result,
        survey_raw_answers
      FROM assessment_sessions
      ORDER BY created_at DESC
      LIMIT 1000
    `).all();

    const rawRows = (queryResult.results || []) as any[];

    // 各行を整形
    const sessions = rawRows.map(row => {
      let parsedMessages = [];
      try {
        if (row.chat_messages) parsedMessages = JSON.parse(row.chat_messages);
      } catch (_) {}

      let parsedAiResult = null;
      try {
        if (row.ai_full_result) parsedAiResult = JSON.parse(row.ai_full_result);
      } catch (_) {}

      let parsedSurveyAnswers = null;
      try {
        if (row.survey_raw_answers) parsedSurveyAnswers = JSON.parse(row.survey_raw_answers);
      } catch (_) {}

      return {
        ...row,
        messages_count: parsedMessages.length,
        has_ai_result: parsedAiResult !== null || (row.ai_openness !== null && row.ai_openness !== undefined),
        has_survey_completed: Boolean(row.survey_completed_at || row.qualtrics_id),
        // クライアントで必要に応じて詳細参照可能
        parsed_ai_result: parsedAiResult,
        parsed_messages: parsedMessages,
        parsed_survey_answers: parsedSurveyAnswers
      };
    });

    return new Response(JSON.stringify({
      success: true,
      is_db_connected: true,
      total: sessions.length,
      sessions
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (err: any) {
    console.error('Admin sessions fetch error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'データ取得エラーが発生しました'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!verifyAdminPassword(request, env)) {
    return new Response(JSON.stringify({
      success: false,
      error: '認証に失敗しました'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({
      success: false,
      error: 'D1データベースが接続されていません'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    let sessionId = url.searchParams.get('id');

    if (!sessionId) {
      try {
        const body: any = await request.json();
        sessionId = body.id;
      } catch (_) {}
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: '削除するセッションID (id) を指定してください' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare('DELETE FROM assessment_sessions WHERE id = ?').bind(sessionId).run();

    return new Response(JSON.stringify({
      success: true,
      deleted_id: sessionId,
      message: 'セッションを削除しました'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Admin delete session error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || '削除中にエラーが発生しました'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
