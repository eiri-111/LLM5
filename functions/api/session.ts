import { Env, AnalysisResult, ChatMessage } from './_gateway';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  const qualtricsId = url.searchParams.get('qualtrics_id');

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'session_id は必須です' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({
      found: false,
      status: 'not_configured',
      warning: 'D1データベースが未接続です'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // qualtrics_id またはスコアパラメータが指定されていればDB・R2に記録
    const qOpennessParam = url.searchParams.get('openness') || url.searchParams.get('survey_openness') || url.searchParams.get('o');
    const qConscientiousnessParam = url.searchParams.get('conscientiousness') || url.searchParams.get('survey_conscientiousness') || url.searchParams.get('c');
    const qExtraversionParam = url.searchParams.get('extraversion') || url.searchParams.get('survey_extraversion') || url.searchParams.get('e');
    const qAgreeablenessParam = url.searchParams.get('agreeableness') || url.searchParams.get('survey_agreeableness') || url.searchParams.get('a');
    const qNeuroticismParam = url.searchParams.get('neuroticism') || url.searchParams.get('survey_neuroticism') || url.searchParams.get('n');
    const qScaleNameParam = url.searchParams.get('scale_name') || url.searchParams.get('survey_scale_name') || 'Qualtrics 心理尺度';

    // スコアの正規化ヘルパー (7件法や5件法平均値の場合は 0-100 に変換)
    const normalizeScore = (valStr: string | null): number | null => {
      if (valStr === null || valStr === undefined || valStr.trim() === '') return null;
      const num = parseFloat(valStr);
      if (isNaN(num)) return null;
      if (num <= 7 && num >= 1) {
        // 1〜7点満点スケールを0〜100に正規化
        return Math.round(((num - 1) / 6) * 100);
      }
      return Math.min(100, Math.max(0, Math.round(num)));
    };

    const parsedOpenness = normalizeScore(qOpennessParam);
    const parsedConscientiousness = normalizeScore(qConscientiousnessParam);
    const parsedExtraversion = normalizeScore(qExtraversionParam);
    const parsedAgreeableness = normalizeScore(qAgreeablenessParam);
    const parsedNeuroticism = normalizeScore(qNeuroticismParam);

    const hasIncomingSurveyScores = parsedOpenness !== null || parsedConscientiousness !== null ||
      parsedExtraversion !== null || parsedAgreeableness !== null || parsedNeuroticism !== null;

    if (qualtricsId || hasIncomingSurveyScores) {
      try {
        const updateCompletedAt = new Date().toISOString();
        await env.DB.prepare(`
          UPDATE assessment_sessions 
          SET 
            qualtrics_id = COALESCE(?, qualtrics_id),
            survey_scale_type = COALESCE(?, survey_scale_type),
            survey_scale_name = COALESCE(?, survey_scale_name),
            survey_openness = COALESCE(?, survey_openness),
            survey_conscientiousness = COALESCE(?, survey_conscientiousness),
            survey_extraversion = COALESCE(?, survey_extraversion),
            survey_agreeableness = COALESCE(?, survey_agreeableness),
            survey_neuroticism = COALESCE(?, survey_neuroticism),
            survey_completed_at = COALESCE(survey_completed_at, ?)
          WHERE id = ?
        `).bind(
          qualtricsId || null,
          hasIncomingSurveyScores ? 'qualtrics' : null,
          hasIncomingSurveyScores ? qScaleNameParam : null,
          parsedOpenness,
          parsedConscientiousness,
          parsedExtraversion,
          parsedAgreeableness,
          parsedNeuroticism,
          hasIncomingSurveyScores ? updateCompletedAt : null,
          sessionId
        ).run();
      } catch (err) {
        console.warn('Qualtrics info update error in session endpoint:', err);
      }
    }

    // セッションレコードを取得
    const row: any = await env.DB.prepare(`
      SELECT 
        id, student_id, age, gender, created_at, dialogue_turns,
        chat_messages, ai_personality_title, ai_personality_type, ai_summary,
        ai_openness, ai_conscientiousness, ai_extraversion, ai_agreeableness, ai_neuroticism,
        ai_full_result, qualtrics_id,
        survey_scale_type, survey_scale_name, survey_raw_answers,
        survey_openness, survey_conscientiousness, survey_extraversion, survey_agreeableness, survey_neuroticism,
        survey_completed_at
      FROM assessment_sessions
      WHERE id = ?
    `).bind(sessionId).first();

    if (!row) {
      return new Response(JSON.stringify({
        found: false,
        status: 'not_found',
        session_id: sessionId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // AI分析が完了しているか判定
    let aiResult: AnalysisResult | null = null;
    if (row.ai_full_result) {
      try {
        aiResult = JSON.parse(row.ai_full_result);
      } catch (e) {
        console.error('Failed to parse ai_full_result:', e);
      }
    }

    let messages: ChatMessage[] = [];
    if (row.chat_messages) {
      try {
        messages = JSON.parse(row.chat_messages);
      } catch (_) {}
    }

    // 質問紙 / Qualtrics 分析結果の構築
    let surveyResult: any = null;
    const hasSurveyScores = row.survey_openness !== null || row.survey_conscientiousness !== null ||
      row.survey_extraversion !== null || row.survey_agreeableness !== null || row.survey_neuroticism !== null;

    if (hasSurveyScores || row.survey_scale_type || row.qualtrics_id) {
      let rawAnswers: Record<string, number> = {};
      if (row.survey_raw_answers) {
        try {
          rawAnswers = JSON.parse(row.survey_raw_answers);
        } catch (_) {}
      }

      surveyResult = {
        scaleType: row.survey_scale_type || 'qualtrics',
        scaleName: row.survey_scale_name || (row.qualtrics_id ? 'Qualtrics心理測定尺度' : '質問紙調査'),
        rawAnswers,
        scores: {
          openness: {
            rawMean: row.survey_openness !== null ? Number(row.survey_openness) : 0,
            normalizedScore: row.survey_openness !== null ? Math.round(Number(row.survey_openness)) : 0
          },
          conscientiousness: {
            rawMean: row.survey_conscientiousness !== null ? Number(row.survey_conscientiousness) : 0,
            normalizedScore: row.survey_conscientiousness !== null ? Math.round(Number(row.survey_conscientiousness)) : 0
          },
          extraversion: {
            rawMean: row.survey_extraversion !== null ? Number(row.survey_extraversion) : 0,
            normalizedScore: row.survey_extraversion !== null ? Math.round(Number(row.survey_extraversion)) : 0
          },
          agreeableness: {
            rawMean: row.survey_agreeableness !== null ? Number(row.survey_agreeableness) : 0,
            normalizedScore: row.survey_agreeableness !== null ? Math.round(Number(row.survey_agreeableness)) : 0
          },
          neuroticism: {
            rawMean: row.survey_neuroticism !== null ? Number(row.survey_neuroticism) : 0,
            normalizedScore: row.survey_neuroticism !== null ? Math.round(Number(row.survey_neuroticism)) : 0
          }
        },
        completedAt: row.survey_completed_at || new Date().toISOString()
      };
    }

    // もし incoming な Qualtrics スコアがあれば、R2 にも非同期保存
    if (hasIncomingSurveyScores) {
      const r2Bucket = env.BUCKET || env.R2;
      if (r2Bucket) {
        context.waitUntil((async () => {
          try {
            const key = `sessions/${row.student_id || 'unknown'}_${sessionId}.json`;
            const payload = {
              session_id: sessionId,
              user_profile: {
                student_id: row.student_id,
                age: row.age,
                gender: row.gender
              },
              messages,
              ai_result: aiResult,
              survey_result: surveyResult,
              qualtrics_id: row.qualtrics_id || qualtricsId,
              saved_at: new Date().toISOString()
            };
            await r2Bucket.put(key, JSON.stringify(payload, null, 2), {
              httpMetadata: { contentType: 'application/json' }
            });
          } catch (r2Err) {
            console.warn('R2 update error in session endpoint:', r2Err);
          }
        })());
      }
    }

    const isCompleted = aiResult !== null;

    return new Response(JSON.stringify({
      found: true,
      status: isCompleted ? 'completed' : 'processing',
      session_id: row.id,
      user_profile: {
        student_id: row.student_id,
        age: row.age,
        gender: row.gender
      },
      messages,
      ai_result: aiResult,
      survey_result: surveyResult,
      qualtrics_id: row.qualtrics_id,
      created_at: row.created_at
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: any) {
    console.error('Session endpoint error:', error);
    return new Response(JSON.stringify({ error: error.message || 'データ取得エラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
