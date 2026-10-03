import { Env, ChatMessage, AnalysisResult } from './_gateway';

interface SaveRequestBody {
  session_id: string;
  user_profile: {
    student_id: string;
    age: number;
    gender: string;
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
    const { session_id, user_profile, messages = [], ai_result, survey_result } = body;

    if (!session_id || !user_profile?.student_id) {
      return new Response(JSON.stringify({ error: 'セッションIDおよび学籍番号は必須です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const savedTargets: string[] = [];
    const timestamp = new Date().toISOString();

    // 1. Cloudflare D1 保存処理
    if (env.DB) {
      try {
        const userCount = messages.filter(m => m.role === 'user').length;
        
        await env.DB.prepare(`
          INSERT INTO assessment_sessions (
            id, student_id, age, gender, created_at,
            dialogue_turns, chat_messages,
            ai_personality_title, ai_personality_type, ai_summary,
            ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
            ai_full_result,
            survey_scale_type, survey_scale_name, survey_raw_answers,
            survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
            survey_completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            dialogue_turns = excluded.dialogue_turns,
            chat_messages = excluded.chat_messages,
            ai_personality_title = excluded.ai_personality_title,
            ai_personality_type = excluded.ai_personality_type,
            ai_summary = excluded.ai_summary,
            ai_openness = excluded.ai_openness,
            ai_conscientiousness = excluded.ai_conscientiousness,
            ai_extraversion = excluded.ai_extraversion,
            ai_agreeableness = excluded.ai_agreeableness,
            ai_neuroticism = excluded.ai_neuroticism,
            ai_full_result = excluded.ai_full_result,
            survey_scale_type = excluded.survey_scale_type,
            survey_scale_name = excluded.survey_scale_name,
            survey_raw_answers = excluded.survey_raw_answers,
            survey_openness = excluded.survey_openness,
            survey_conscientiousness = excluded.survey_conscientiousness,
            survey_extraversion = excluded.survey_extraversion,
            survey_agreeableness = excluded.survey_agreeableness,
            survey_neuroticism = excluded.survey_neuroticism,
            survey_completed_at = excluded.survey_completed_at
        `).bind(
          session_id,
          user_profile.student_id,
          user_profile.age || 0,
          user_profile.gender || 'unspecified',
          timestamp,
          userCount,
          JSON.stringify(messages),
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
          survey_result?.completedAt || null
        ).run();

        savedTargets.push('D1');
      } catch (dbErr: any) {
        console.error('D1 save error:', dbErr);
      }
    }

    // 2. Cloudflare R2 保存処理 (BUCKET または R2 バインディング)
    const r2Bucket = env.BUCKET || env.R2;
    if (r2Bucket) {
      try {
        const fullPayload = {
          session_id,
          user_profile,
          messages,
          ai_result,
          survey_result,
          saved_at: timestamp
        };

        const key = `sessions/${user_profile.student_id}_${session_id}.json`;
        await r2Bucket.put(key, JSON.stringify(fullPayload, null, 2), {
          httpMetadata: { contentType: 'application/json' }
        });

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
