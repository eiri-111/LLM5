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
  qualtrics_id?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: SaveRequestBody = await request.json();
    const { session_id, user_profile, messages = [], ai_result, survey_result, qualtrics_id } = body;

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
        // テーブルが存在しない場合に備えて自動作成 (Auto-Migration)
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

        // 既存テーブルに qualtrics_id カラムがない場合に備えてカラム追加
        try {
          await env.DB.prepare('ALTER TABLE assessment_sessions ADD COLUMN qualtrics_id TEXT').run();
        } catch (_) {}

        const userCount = messages.filter(m => m.role === 'user').length;
        
        await env.DB.prepare(`
          INSERT INTO assessment_sessions (
            id, student_id, age, gender, created_at,
            dialogue_turns, chat_messages,
            ai_personality_title, ai_personality_type, ai_summary,
            ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
            ai_full_result,
            qualtrics_id,
            survey_scale_type, survey_scale_name, survey_raw_answers,
            survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
            survey_completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
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
            qualtrics_id = COALESCE(excluded.qualtrics_id, assessment_sessions.qualtrics_id),
            survey_scale_type = COALESCE(excluded.survey_scale_type, assessment_sessions.survey_scale_type),
            survey_scale_name = COALESCE(excluded.survey_scale_name, assessment_sessions.survey_scale_name),
            survey_raw_answers = COALESCE(excluded.survey_raw_answers, assessment_sessions.survey_raw_answers),
            survey_openness = COALESCE(excluded.survey_openness, assessment_sessions.survey_openness),
            survey_conscientiousness = COALESCE(excluded.survey_conscientiousness, assessment_sessions.survey_conscientiousness),
            survey_extraversion = COALESCE(excluded.survey_extraversion, assessment_sessions.survey_extraversion),
            survey_agreeableness = COALESCE(excluded.survey_agreeableness, assessment_sessions.survey_agreeableness),
            survey_neuroticism = COALESCE(excluded.survey_neuroticism, assessment_sessions.survey_neuroticism),
            survey_completed_at = COALESCE(excluded.survey_completed_at, assessment_sessions.survey_completed_at)
        `).bind(
          session_id,
          user_profile.student_id,
          user_profile.age || 0,
          user_profile.gender || 'unspecified',
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
          qualtrics_id || null,
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
          qualtrics_id,
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
