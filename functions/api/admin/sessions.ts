import { Env, verifyAdminPassword, ensureDbSchema } from '../_gateway';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // 管理者認証チェック
  if (!verifyAdminPassword(request, env)) {
    return new Response(JSON.stringify({
      success: false,
      error: '認証に失敗しました。管理者パスワードが必要です。'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const sessionId = url.searchParams.get('id') || url.searchParams.get('session_id');
  const r2Bucket = env.BUCKET || env.R2;
  const isR2Connected = Boolean(r2Bucket);
  const isDbConnected = Boolean(env.DB);

  // -------------------------------------------------------------------------
  // 1. 個別セッション詳細取得モード (Lazy Load / 単一エクスポート)
  // -------------------------------------------------------------------------
  if (sessionId) {
    try {
      // 1-1. R2 から取得を試行 (優先)
      if (r2Bucket) {
        // 標準キー sessions/{session_id}.json から直接O(1)取得
        let r2Obj = await r2Bucket.get(`sessions/${sessionId}.json`);
        
        // D1に記録されたr2_keyがあれば直接取得 (フルバケットスキャン廃止)
        if (!r2Obj && env.DB) {
          try {
            const dbRow: any = await env.DB.prepare('SELECT r2_key FROM assessment_sessions WHERE id = ?').bind(sessionId).first();
            if (dbRow?.r2_key) {
              r2Obj = await r2Bucket.get(dbRow.r2_key);
            }
          } catch (_) {}
        }

        if (r2Obj) {
          const content = await r2Obj.text();
          const parsed = JSON.parse(content);
          return new Response(JSON.stringify({
            success: true,
            source: 'r2',
            session: {
              id: parsed.session_id || sessionId,
              student_id: parsed.user_profile?.student_id || '',
              age: parsed.user_profile?.age || 0,
              gender: parsed.user_profile?.gender || '',
              created_at: parsed.saved_at || '',
              dialogue_turns: parsed.dialogue_turns || (parsed.messages?.filter((m: any) => m.role === 'user').length ?? 0),
              ai_personality_title: parsed.ai_result?.personality_title || null,
              ai_personality_type: parsed.ai_result?.personality_type || null,
              ai_summary: parsed.ai_result?.summary || null,
              ai_openness: parsed.ai_result?.scores?.openness?.score ?? null,
              ai_conscientiousness: parsed.ai_result?.scores?.conscientiousness?.score ?? null,
              ai_extraversion: parsed.ai_result?.scores?.extraversion?.score ?? null,
              ai_agreeableness: parsed.ai_result?.scores?.agreeableness?.score ?? null,
              ai_neuroticism: parsed.ai_result?.scores?.neuroticism?.score ?? null,
              survey_scale_type: parsed.survey_result?.scaleType || null,
              survey_scale_name: parsed.survey_result?.scaleName || null,
              survey_openness: parsed.survey_result?.scores?.openness?.normalizedScore ?? null,
              survey_conscientiousness: parsed.survey_result?.scores?.conscientiousness?.normalizedScore ?? null,
              survey_extraversion: parsed.survey_result?.scores?.extraversion?.normalizedScore ?? null,
              survey_agreeableness: parsed.survey_result?.scores?.agreeableness?.normalizedScore ?? null,
              survey_neuroticism: parsed.survey_result?.scores?.neuroticism?.normalizedScore ?? null,
              survey_completed_at: parsed.survey_result?.completedAt || null,
              r2_saved: 1,
              r2_key: r2Obj.key,
              has_ai_result: Boolean(parsed.ai_result),
              has_survey_completed: Boolean(parsed.survey_result?.completedAt),
              parsed_ai_result: parsed.ai_result || null,
              parsed_messages: parsed.messages || [],
              parsed_survey_answers: parsed.survey_result?.rawAnswers || null,
              chat_messages: parsed.messages ? JSON.stringify(parsed.messages) : null,
              ai_full_result: parsed.ai_result ? JSON.stringify(parsed.ai_result) : null,
              survey_raw_answers: parsed.survey_result?.rawAnswers ? JSON.stringify(parsed.survey_result.rawAnswers) : null
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
          });
        }
      }

      // 1-2. R2 にない場合は D1 から完全取得
      if (env.DB) {
        const row: any = await env.DB.prepare(`
          SELECT * FROM assessment_sessions WHERE id = ?
        `).bind(sessionId).first();

        if (row) {
          let parsedMessages = [];
          try { if (row.chat_messages) parsedMessages = JSON.parse(row.chat_messages); } catch (_) {}

          let parsedAiResult = null;
          try { if (row.ai_full_result) parsedAiResult = JSON.parse(row.ai_full_result); } catch (_) {}

          let parsedSurveyAnswers = null;
          try { if (row.survey_raw_answers) parsedSurveyAnswers = JSON.parse(row.survey_raw_answers); } catch (_) {}

          return new Response(JSON.stringify({
            success: true,
            source: 'd1',
            session: {
              ...row,
              messages_count: parsedMessages.length,
              has_ai_result: parsedAiResult !== null || (row.ai_openness !== null && row.ai_openness !== undefined),
              has_survey_completed: Boolean(row.survey_completed_at),
              parsed_ai_result: parsedAiResult,
              parsed_messages: parsedMessages,
              parsed_survey_answers: parsedSurveyAnswers
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
          });
        }
      }

      return new Response(JSON.stringify({
        success: false,
        error: `セッションID [${sessionId}] が見つかりませんでした`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (detailErr: any) {
      console.error('Session detail fetch error:', detailErr);
      return new Response(JSON.stringify({
        success: false,
        error: detailErr.message || 'セッション詳細取得中にエラーが発生しました'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // -------------------------------------------------------------------------
  // 2. セッション一覧取得モード (巨大JSONカラムを除外した超高速・超軽量取得)
  // -------------------------------------------------------------------------
  if (!env.DB) {
    return new Response(JSON.stringify({
      success: true,
      is_db_connected: false,
      is_r2_connected: isR2Connected,
      message: 'Cloudflare D1データベースがバインドされていません',
      total: 0,
      sessions: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    await ensureDbSchema(env.DB);

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 500) : 100;
    const offset = (page - 1) * limit;

    const countRes: any = await env.DB.prepare('SELECT COUNT(*) as count FROM assessment_sessions').first();
    const totalCount = countRes?.count ? Number(countRes.count) : 0;

    // 巨大な chat_messages, ai_full_result, survey_raw_answers を除外して高速・ページネーション取得！
    const queryResult = await env.DB.prepare(`
      SELECT 
        id,
        student_id,
        age,
        gender,
        created_at,
        dialogue_turns,
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
        COALESCE(r2_saved, 0) AS r2_saved,
        r2_key
      FROM assessment_sessions
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const rawRows = (queryResult.results || []) as any[];

    // 各行を整形
    const sessions = rawRows.map(row => {
      const hasAi = Boolean(row.ai_personality_title) || (row.ai_openness !== null && row.ai_openness !== undefined);
      const hasSurvey = Boolean(row.survey_completed_at);

      return {
        ...row,
        has_ai_result: hasAi,
        has_survey_completed: hasSurvey,
        r2_saved: Boolean(row.r2_saved)
      };
    });

    return new Response(JSON.stringify({
      success: true,
      is_db_connected: true,
      is_r2_connected: isR2Connected,
      total: totalCount,
      page,
      limit,
      total_pages: Math.ceil(totalCount / limit),
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

    const deleteResults: string[] = [];

    let storedR2Key: string | null = null;

    // 1. D1 から削除
    if (env.DB) {
      try {
        const row: any = await env.DB.prepare('SELECT r2_key FROM assessment_sessions WHERE id = ?').bind(sessionId).first();
        storedR2Key = row?.r2_key || null;
      } catch (_) {}
      await env.DB.prepare('DELETE FROM assessment_sessions WHERE id = ?').bind(sessionId).run();
      deleteResults.push('D1');
    }

    // 2. R2 から削除 (フルスキャンlist廃止、直接キー削除)
    const r2Bucket = env.BUCKET || env.R2;
    if (r2Bucket) {
      try {
        // 標準キー削除
        await r2Bucket.delete(`sessions/${sessionId}.json`);
        // 保存されていた別名キーがあれば直接削除
        if (storedR2Key && storedR2Key !== `sessions/${sessionId}.json`) {
          await r2Bucket.delete(storedR2Key);
        }
        deleteResults.push('R2');
      } catch (r2Err) {
        console.error('R2 deletion error:', r2Err);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      deleted_id: sessionId,
      deleted_targets: deleteResults,
      message: 'セッションデータを削除しました（D1およびR2連携削除完了）'
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
