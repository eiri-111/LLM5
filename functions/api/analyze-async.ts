import { Env, ChatMessage, runFinalAnalysis } from './_gateway';

interface AnalyzeAsyncRequestBody {
  session_id: string;
  user_profile?: {
    student_id?: string;
    age?: number | string;
    gender?: string;
  };
  messages: ChatMessage[];
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: AnalyzeAsyncRequestBody = await request.json();
    const { session_id, user_profile, messages = [] } = body;

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'セッションIDは必須です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!messages || messages.length < 2) {
      return new Response(JSON.stringify({ error: '対話履歴が不足しています。最低2往復以上の対話が必要です。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const effectiveStudentId = user_profile?.student_id || `user_${session_id.slice(-8)}`;
    const effectiveAge = typeof user_profile?.age === 'number' ? user_profile.age : 0;
    const effectiveGender = user_profile?.gender || 'unspecified';
    const timestamp = new Date().toISOString();
    const userCount = messages.filter(m => m.role === 'user').length;

    // 1. D1へセッション初期レコードを即時保存（テーブル自動生成も含む）
    if (env.DB) {
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

        try {
          await env.DB.prepare('ALTER TABLE assessment_sessions ADD COLUMN qualtrics_id TEXT').run();
        } catch (_) {}

        await env.DB.prepare(`
          INSERT INTO assessment_sessions (
            id, student_id, age, gender, created_at,
            dialogue_turns, chat_messages
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            student_id = excluded.student_id,
            age = CASE WHEN excluded.age > 0 THEN excluded.age ELSE assessment_sessions.age END,
            gender = CASE WHEN excluded.gender != 'unspecified' THEN excluded.gender ELSE assessment_sessions.gender END,
            dialogue_turns = excluded.dialogue_turns,
            chat_messages = excluded.chat_messages
        `).bind(
          session_id,
          effectiveStudentId,
          effectiveAge,
          effectiveGender,
          timestamp,
          userCount,
          JSON.stringify(messages)
        ).run();
      } catch (dbInitErr) {
        console.error('Initial D1 session creation error in analyze-async:', dbInitErr);
      }
    }

    // 2. Cloudflare Workers context.waitUntil でバックグラウンドAI分析を実行
    context.waitUntil((async () => {
      try {
        console.log(`[analyze-async] Starting background AI analysis for session: ${session_id}`);
        const aiResult = await runFinalAnalysis(env, messages);
        console.log(`[analyze-async] Completed AI analysis for session: ${session_id}`);

        let resolvedAge = effectiveAge;
        if (resolvedAge === 0 && aiResult.demographics?.age) {
          const parsed = parseInt(String(aiResult.demographics.age), 10);
          if (!isNaN(parsed)) resolvedAge = parsed;
        }

        const resolvedGender = (effectiveGender !== 'unspecified')
          ? effectiveGender
          : (aiResult.demographics?.gender || 'unspecified');

        // D1へ分析結果を反映
        if (env.DB) {
          await env.DB.prepare(`
            UPDATE assessment_sessions SET
              age = CASE WHEN age > 0 THEN age ELSE ? END,
              gender = CASE WHEN gender != 'unspecified' THEN gender ELSE ? END,
              ai_personality_title = ?,
              ai_personality_type = ?,
              ai_summary = ?,
              ai_openness = ?,
              ai_conscientiousness = ?,
              ai_extraversion = ?,
              ai_agreeableness = ?,
              ai_neuroticism = ?,
              ai_full_result = ?
            WHERE id = ?
          `).bind(
            resolvedAge,
            resolvedGender,
            aiResult.personality_title || null,
            aiResult.personality_type || null,
            aiResult.summary || null,
            aiResult.scores?.openness?.score ?? null,
            aiResult.scores?.conscientiousness?.score ?? null,
            aiResult.scores?.extraversion?.score ?? null,
            aiResult.scores?.agreeableness?.score ?? null,
            aiResult.scores?.neuroticism?.score ?? null,
            JSON.stringify(aiResult),
            session_id
          ).run();
          console.log(`[analyze-async] Updated D1 with AI result for session: ${session_id}`);
        }

        // R2へも保存 (存在する場合)
        const r2Bucket = env.BUCKET || env.R2;
        if (r2Bucket) {
          const fullPayload = {
            session_id,
            user_profile: {
              student_id: effectiveStudentId,
              age: resolvedAge,
              gender: resolvedGender
            },
            messages,
            ai_result: aiResult,
            saved_at: new Date().toISOString()
          };
          const key = `sessions/${effectiveStudentId}_${session_id}.json`;
          await r2Bucket.put(key, JSON.stringify(fullPayload, null, 2), {
            httpMetadata: { contentType: 'application/json' }
          });
          console.log(`[analyze-async] Saved payload to R2 for session: ${session_id}`);
        }
      } catch (bgErr) {
        console.error(`[analyze-async] Error in background analysis for session: ${session_id}:`, bgErr);
      }
    })());

    // 3. クライアントには待たせずに即座にレスポンスを返す（ユーザーは即座にQualtricsへ遷移可能）
    return new Response(JSON.stringify({
      success: true,
      session_id,
      status: 'processing'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: any) {
    console.error('analyze-async endpoint error:', error);
    return new Response(JSON.stringify({ error: error.message || '内部サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
