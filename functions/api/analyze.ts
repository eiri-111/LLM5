import { Env, ChatMessage, runFinalAnalysis } from './_gateway';

interface AnalyzeRequestBody {
  mode?: 'chat';
  session_id?: string;
  user_profile?: {
    student_id?: string;
    age?: number | string;
    gender?: string;
  };
  messages: ChatMessage[];
  survey_result?: any;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: AnalyzeRequestBody = await request.json();
    const { session_id, user_profile, messages, survey_result } = body;

    if (!messages || messages.length < 2) {
      return new Response(JSON.stringify({ error: '対話履歴が不足しています。最低2往復以上の対話が必要です。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ステップ3: 最終性格分析 (Route: dynamic/llm5-analyst ※Gemini, 自動フォールバック対応)
    const result = await runFinalAnalysis(env, messages);

    // セッションIDがある場合はD1/R2にも即座に保存・更新（バックグラウンド分析が未完了だった場合のリカバリー同期保存）
    if (session_id && env.DB) {
      try {
        const effectiveStudentId = user_profile?.student_id || `user_${session_id.slice(-8)}`;
        const effectiveAge = typeof user_profile?.age === 'number' ? user_profile.age : 0;
        const effectiveGender = user_profile?.gender || 'unspecified';
        const userCount = messages.filter(m => m.role === 'user').length;

        await env.DB.prepare(`
          INSERT INTO assessment_sessions (
            id, student_id, age, gender, created_at,
            dialogue_turns, chat_messages,
            ai_personality_title, ai_personality_type, ai_summary,
            ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
            ai_full_result
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            student_id = excluded.student_id,
            age = CASE WHEN excluded.age > 0 THEN excluded.age ELSE assessment_sessions.age END,
            gender = CASE WHEN excluded.gender != 'unspecified' THEN excluded.gender ELSE assessment_sessions.gender END,
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
            ai_full_result = excluded.ai_full_result
        `).bind(
          session_id,
          effectiveStudentId,
          effectiveAge,
          effectiveGender,
          new Date().toISOString(),
          userCount,
          JSON.stringify(messages),
          result.personality_title || null,
          result.personality_type || null,
          result.summary || null,
          result.scores?.openness?.score ?? null,
          result.scores?.conscientiousness?.score ?? null,
          result.scores?.extraversion?.score ?? null,
          result.scores?.agreeableness?.score ?? null,
          result.scores?.neuroticism?.score ?? null,
          JSON.stringify(result)
        ).run();
      } catch (dbErr) {
        console.warn('D1 direct save in /api/analyze error:', dbErr);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: any) {
    console.error('Analyze endpoint error:', error);
    return new Response(JSON.stringify({ error: error.message || '内部サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
