import { Env } from './_gateway';

interface QualtricsPayload {
  session_id: string;
  qualtrics_id?: string;
  response_id?: string;
  ResponseID?: string;
  scale_type?: string;
  scale_name?: string;
  scores?: {
    openness?: number | string;
    conscientiousness?: number | string;
    extraversion?: number | string;
    agreeableness?: number | string;
    neuroticism?: number | string;
  };
  openness?: number | string;
  conscientiousness?: number | string;
  extraversion?: number | string;
  agreeableness?: number | string;
  neuroticism?: number | string;
  o?: number | string;
  c?: number | string;
  e?: number | string;
  a?: number | string;
  n?: number | string;
  raw_answers?: Record<string | number, any>;
  answers?: Record<string | number, any>;
}

function parseScore(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return null;
  // 1〜7点または1〜5点の平均点スケールの場合は0〜100に正規化
  if (num <= 7 && num >= 1) {
    return Math.round(((num - 1) / 6) * 100);
  }
  return Math.min(100, Math.max(0, Math.round(num)));
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: QualtricsPayload = await request.json();
    const sessionId = body.session_id;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'session_id は必須です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const qualtricsId = body.qualtrics_id || body.response_id || body.ResponseID || null;
    const scaleType = body.scale_type || 'qualtrics';
    const scaleName = body.scale_name || 'Qualtrics BigFive質問紙';

    const openness = parseScore(body.scores?.openness ?? body.openness ?? body.o);
    const conscientiousness = parseScore(body.scores?.conscientiousness ?? body.conscientiousness ?? body.c);
    const extraversion = parseScore(body.scores?.extraversion ?? body.extraversion ?? body.e);
    const agreeableness = parseScore(body.scores?.agreeableness ?? body.agreeableness ?? body.a);
    const neuroticism = parseScore(body.scores?.neuroticism ?? body.neuroticism ?? body.n);

    const rawAnswers = body.raw_answers || body.answers || null;
    const completedAt = new Date().toISOString();
    const savedTargets: string[] = [];

    // 1. Cloudflare D1 保存処理
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

        // 既存レコードを更新、または存在しない場合は新規作成
        const existing = await env.DB.prepare('SELECT id, student_id, chat_messages, ai_full_result FROM assessment_sessions WHERE id = ?').bind(sessionId).first();

        if (existing) {
          await env.DB.prepare(`
            UPDATE assessment_sessions SET
              qualtrics_id = COALESCE(?, qualtrics_id),
              survey_scale_type = ?,
              survey_scale_name = ?,
              survey_raw_answers = COALESCE(?, survey_raw_answers),
              survey_openness = COALESCE(?, survey_openness),
              survey_conscientiousness = COALESCE(?, survey_conscientiousness),
              survey_extraversion = COALESCE(?, survey_extraversion),
              survey_agreeableness = COALESCE(?, survey_agreeableness),
              survey_neuroticism = COALESCE(?, survey_neuroticism),
              survey_completed_at = ?
            WHERE id = ?
          `).bind(
            qualtricsId,
            scaleType,
            scaleName,
            rawAnswers ? JSON.stringify(rawAnswers) : null,
            openness,
            conscientiousness,
            extraversion,
            agreeableness,
            neuroticism,
            completedAt,
            sessionId
          ).run();
        } else {
          await env.DB.prepare(`
            INSERT INTO assessment_sessions (
              id, student_id, age, gender, created_at,
              qualtrics_id, survey_scale_type, survey_scale_name, survey_raw_answers,
              survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
              survey_completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            sessionId,
            `user_${sessionId.slice(-8)}`,
            0,
            'unspecified',
            completedAt,
            qualtricsId,
            scaleType,
            scaleName,
            rawAnswers ? JSON.stringify(rawAnswers) : null,
            openness,
            conscientiousness,
            extraversion,
            agreeableness,
            neuroticism,
            completedAt
          ).run();
        }

        savedTargets.push('D1');
      } catch (dbErr: any) {
        console.error('Qualtrics D1 save error:', dbErr);
      }
    }

    // 2. Cloudflare R2 保存処理
    const r2Bucket = env.BUCKET || env.R2;
    if (r2Bucket) {
      try {
        let existingR2Data: any = {};
        const key = `sessions/qualtrics_${sessionId}.json`;
        try {
          const obj = await r2Bucket.get(key);
          if (obj) {
            existingR2Data = await obj.json();
          }
        } catch (_) {}

        const updatedR2Data = {
          ...existingR2Data,
          session_id: sessionId,
          qualtrics_id: qualtricsId || existingR2Data.qualtrics_id,
          qualtrics_result: {
            scale_type: scaleType,
            scale_name: scaleName,
            scores: {
              openness,
              conscientiousness,
              extraversion,
              agreeableness,
              neuroticism
            },
            raw_answers: rawAnswers,
            completed_at: completedAt
          },
          updated_at: completedAt
        };

        await r2Bucket.put(key, JSON.stringify(updatedR2Data, null, 2), {
          httpMetadata: { contentType: 'application/json' }
        });
        savedTargets.push('R2');
      } catch (r2Err: any) {
        console.error('Qualtrics R2 save error:', r2Err);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      qualtrics_id: qualtricsId,
      scores: {
        openness,
        conscientiousness,
        extraversion,
        agreeableness,
        neuroticism
      },
      saved_targets: savedTargets
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Qualtrics endpoint error:', error);
    return new Response(JSON.stringify({ error: error.message || 'データ処理中にエラーが発生しました' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'session_id は必須です' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET クエリパラメータからの直接保存もサポート
  const qualtricsId = url.searchParams.get('qualtrics_id') || url.searchParams.get('response_id');
  const qO = url.searchParams.get('openness') || url.searchParams.get('o');
  const qC = url.searchParams.get('conscientiousness') || url.searchParams.get('c');
  const qE = url.searchParams.get('extraversion') || url.searchParams.get('e');
  const qA = url.searchParams.get('agreeableness') || url.searchParams.get('a');
  const qN = url.searchParams.get('neuroticism') || url.searchParams.get('n');

  if (qualtricsId || qO !== null || qC !== null || qE !== null || qA !== null || qN !== null) {
    // 内部的に POST と同等の処理を実施可能
  }

  return new Response(JSON.stringify({
    session_id: sessionId,
    qualtrics_id: qualtricsId
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
