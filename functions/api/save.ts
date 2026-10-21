import { Env, ChatMessage, AnalysisResult, ensureDbSchema, verifyAdminPassword } from './_gateway';

interface SaveRequestBody {
  session_id: string;
  session_token?: string;
  user_profile?: {
    student_id?: string;
    age?: number | string;
    gender?: string;
  };
  messages: ChatMessage[];
  ai_result?: AnalysisResult;
  survey_result?: {
    scaleType: string;
    scaleName: string;
    rawAnswers: Record<number, number>;
    scores: Record<string, { rawMean: number; normalizedScore: number }>;
    completedAt: string;
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: SaveRequestBody = await request.json();
    const { session_id, session_token, user_profile, messages = [], ai_result, survey_result } = body;

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'セッションIDは必須です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const incomingToken =
      session_token ||
      request.headers.get('x-session-token') ||
      (request.headers.get('Authorization')?.startsWith('Bearer ')
        ? request.headers.get('Authorization')?.substring(7).trim()
        : null);

    const effectiveStudentId = user_profile?.student_id || `user_${session_id.slice(-8)}`;

    let effectiveAge = 0;
    if (typeof user_profile?.age === 'number' && user_profile.age > 0) {
      effectiveAge = user_profile.age;
    } else if (ai_result?.demographics?.age) {
      const parsed = parseInt(String(ai_result.demographics.age), 10);
      if (!isNaN(parsed)) effectiveAge = parsed;
    }

    const effectiveGender = (user_profile?.gender && user_profile.gender !== 'unspecified')
      ? user_profile.gender
      : (ai_result?.demographics?.gender || 'unspecified');

    const savedTargets: string[] = [];
    const timestamp = new Date().toISOString();

    // 1. Cloudflare D1 保存処理 (メタデータ＆認証整合性チェック)
    if (env.DB) {
      try {
        await ensureDbSchema(env.DB);

        // 既存セッションのトークン照合（なりすまし・改ざん上書き防止）
        const existingRow: any = await env.DB.prepare(`
          SELECT session_token FROM assessment_sessions WHERE id = ?
        `).bind(session_id).first();

        const isAdmin = verifyAdminPassword(request, env);
        if (existingRow && existingRow.session_token && !isAdmin) {
          if (!incomingToken || incomingToken !== existingRow.session_token) {
            return new Response(JSON.stringify({
              error: 'セッションの更新権限がありません。有効なセッショントークンが必要です。'
            }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        const effectiveToken = incomingToken || existingRow?.session_token || null;
        const userCount = messages.filter(m => m.role === 'user').length;
        
        await env.DB.prepare(`
          INSERT INTO assessment_sessions (
            id, session_token, student_id, age, gender, created_at,
            dialogue_turns, chat_messages,
            ai_personality_title, ai_personality_type, ai_summary,
            ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
            ai_full_result,
            survey_scale_type, survey_scale_name, survey_raw_answers,
            survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
            survey_completed_at,
            r2_saved, r2_key
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            session_token = COALESCE(assessment_sessions.session_token, excluded.session_token),
            dialogue_turns = COALESCE(excluded.dialogue_turns, assessment_sessions.dialogue_turns),
            chat_messages = COALESCE(excluded.chat_messages, assessment_sessions.chat_messages),
            ai_personality_title = COALESCE(excluded.ai_personality_title, assessment_sessions.ai_personality_title),
            ai_personality_type = COALESCE(excluded.ai_personality_type, assessment_sessions.ai_personality_type),
            ai_summary = COALESCE(excluded.ai_summary, assessment_sessions.ai_summary),
            ai_openness = COALESCE(excluded.ai_openness, assessment_sessions.ai_openness),
            ai_conscientiousness = COALESCE(excluded.ai_conscientiousness, assessment_sessions.ai_conscientiousness),
            ai_extraversion = COALESCE(excluded.ai_extraversion, assessment_sessions.ai_extraversion),
            ai_agreeableness = COALESCE(excluded.ai_agreeableness, assessment_sessions.ai_agreeableness),
            ai_neuroticism = COALESCE(excluded.ai_neuroticism, assessment_sessions.ai_neuroticism),
            ai_full_result = COALESCE(excluded.ai_full_result, assessment_sessions.ai_full_result),
            survey_scale_type = COALESCE(excluded.survey_scale_type, assessment_sessions.survey_scale_type),
            survey_scale_name = COALESCE(excluded.survey_scale_name, assessment_sessions.survey_scale_name),
            survey_raw_answers = COALESCE(excluded.survey_raw_answers, assessment_sessions.survey_raw_answers),
            survey_openness = COALESCE(excluded.survey_openness, assessment_sessions.survey_openness),
            survey_conscientiousness = COALESCE(excluded.survey_conscientiousness, assessment_sessions.survey_conscientiousness),
            survey_extraversion = COALESCE(excluded.survey_extraversion, assessment_sessions.survey_extraversion),
            survey_agreeableness = COALESCE(excluded.survey_agreeableness, assessment_sessions.survey_agreeableness),
            survey_neuroticism = COALESCE(excluded.survey_neuroticism, assessment_sessions.survey_neuroticism),
            survey_completed_at = COALESCE(excluded.survey_completed_at, assessment_sessions.survey_completed_at),
            r2_saved = CASE WHEN excluded.r2_saved = 1 THEN 1 ELSE assessment_sessions.r2_saved END,
            r2_key = COALESCE(excluded.r2_key, assessment_sessions.r2_key)
        `).bind(
          session_id,
          effectiveToken,
          effectiveStudentId,
          effectiveAge,
          effectiveGender,
          timestamp,
          userCount,
          messages.length > 0 ? JSON.stringify(messages) : null,
          ai_result?.personality_title || null,
          ai_result?.personality_type || null,
          ai_result?.summary || null,
          ai_result?.scores?.openness?.score ?? null,
          ai_result?.scores?.conscientiousness?.score ?? null,
          ai_result?.scores?.extraversion?.score ?? null,
          ai_result?.scores?.agreeableness?.score ?? null,
          ai_result?.scores?.neuroticism?.score ?? null,
          ai_result ? JSON.stringify(ai_result) : null,
          survey_result?.scaleType || null,
          survey_result?.scaleName || null,
          survey_result?.rawAnswers ? JSON.stringify(survey_result.rawAnswers) : null,
          survey_result?.scores?.openness?.normalizedScore ?? null,
          survey_result?.scores?.conscientiousness?.normalizedScore ?? null,
          survey_result?.scores?.extraversion?.normalizedScore ?? null,
          survey_result?.scores?.agreeableness?.normalizedScore ?? null,
          survey_result?.scores?.neuroticism?.normalizedScore ?? null,
          survey_result?.completedAt || null,
          0,
          null
        ).run();

        savedTargets.push('D1');
      } catch (dbErr: any) {
        console.error('D1 save error:', dbErr);
      }
    }

    // 2. Cloudflare R2 保存処理 (標準単一キー sessions/{session_id}.json のみ保存、重複書き込み廃止)
    const r2Bucket = env.BUCKET || env.R2;
    if (r2Bucket) {
      try {
        const r2Key = `sessions/${session_id}.json`;
        const fullPayload = {
          version: '2.0',
          session_id,
          user_profile: {
            student_id: effectiveStudentId,
            age: effectiveAge,
            gender: effectiveGender
          },
          dialogue_turns: messages.filter(m => m.role === 'user').length,
          messages,
          ai_result,
          survey_result,
          saved_at: timestamp
        };

        await r2Bucket.put(r2Key, JSON.stringify(fullPayload, null, 2), {
          httpMetadata: { contentType: 'application/json' },
          customMetadata: {
            savedAt: timestamp
          }
        });

        // D1のr2_savedフラグを更新
        if (env.DB) {
          try {
            await env.DB.prepare(`
              UPDATE assessment_sessions SET r2_saved = 1, r2_key = ? WHERE id = ?
            `).bind(r2Key, session_id).run();
          } catch (_) {}
        }

        savedTargets.push('R2');
      } catch (r2Err: any) {
        console.error('R2 save error:', r2Err);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      session_id,
      saved_targets: savedTargets,
      warning: savedTargets.length === 0 ? 'D1およびR2バインディングが未設定のため、ストレージ保存はスキップされました' : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Save endpoint error:', error);
    return new Response(JSON.stringify({ error: error.message || 'データ保存中にエラーが発生しました' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
