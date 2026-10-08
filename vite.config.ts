import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const devMockSessions: any[] = [
  {
    id: 'session_demo_001',
    student_id: 'KGU-2024-001',
    age: 21,
    gender: 'female',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    dialogue_turns: 5,
    qualtrics_id: 'R_1234567890abc',
    survey_completed_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    ai_personality_title: '穏やかな探求者・共感型クリエイター',
    ai_personality_type: '共感・探求タイプ',
    ai_summary: '他者の感情に寄り添いながら、新しいアイデアや未知の体験への好奇心を発揮するバランスの良い性格です。',
    ai_openness: 82.5,
    ai_conscientiousness: 65.0,
    ai_extraversion: 74.0,
    ai_agreeableness: 88.0,
    ai_neuroticism: 32.0,
    survey_scale_type: 'tipi-j',
    survey_scale_name: 'TIPI-J (日本語版十項目性格尺度)',
    survey_openness: 80.0,
    survey_conscientiousness: 60.0,
    survey_extraversion: 70.0,
    survey_agreeableness: 90.0,
    survey_neuroticism: 35.0,
    survey_raw_answers: JSON.stringify({ "1": 6, "2": 2, "3": 5, "4": 6, "5": 3, "6": 2, "7": 3, "8": 2, "9": 2, "10": 6 }),
    chat_messages: JSON.stringify([
      { role: 'assistant', content: 'こんにちは！Dr. OCEANです。普段の休日はどのように過ごすことが多いですか？' },
      { role: 'user', content: '休日は友人とカフェ巡りをしたり、新しい美術館や展示を見に行くのが好きです。' },
      { role: 'assistant', content: '素敵な過ごし方ですね！新しい刺激を楽しむのがお好きなんですね。グループで活動するときはどんな役割になることが多いですか？' },
      { role: 'user', content: 'みんなの話をよく聞いて、意見が対立したときに間を取り持つことが多いです。' }
    ])
  },
  {
    id: 'session_demo_002',
    student_id: 'KGU-2024-042',
    age: 20,
    gender: 'male',
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    dialogue_turns: 4,
    qualtrics_id: null,
    survey_completed_at: null,
    ai_personality_title: '論理的ストラテジスト・堅実な実務家',
    ai_personality_type: '分析・計画タイプ',
    ai_summary: '物事を筋道立てて計画的に実行する高い誠実性と自己規律を持ち合わせています。',
    ai_openness: 58.0,
    ai_conscientiousness: 92.0,
    ai_extraversion: 45.0,
    ai_agreeableness: 62.0,
    ai_neuroticism: 28.0,
    survey_scale_type: 'bfi-2-s',
    survey_scale_name: 'BFI-2-S (短縮版ビッグファイブ質問紙)',
    survey_openness: null,
    survey_conscientiousness: null,
    survey_extraversion: null,
    survey_agreeableness: null,
    survey_neuroticism: null,
    survey_raw_answers: null,
    chat_messages: JSON.stringify([
      { role: 'assistant', content: 'こんにちは！普段タスクや勉強を進めるとき、どのように管理していますか？' },
      { role: 'user', content: '毎朝ToDoリストを作成して、優先度順にしっかり完了させてから帰るようにしています。' }
    ])
  }
];

const devApiPlugin = (): Plugin => ({
  name: 'dev-api-middleware',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/')) {
        return next();
      }

      res.setHeader('Content-Type', 'application/json');

      if (req.url === '/api/health') {
        const hasKey = Boolean(process.env.GEMINI_API_KEY);
        const hasGw = Boolean(process.env.CF_AI_GATEWAY_URL);
        res.end(JSON.stringify({
          status: 'ok',
          has_api_key: hasKey,
          has_ai_gateway: hasGw,
          platform: 'Vite Dev Middleware (Cloudflare Pages compatible)',
          timestamp: new Date().toISOString()
        }));
        return;
      }

      if (req.url === '/api/questions') {
        const questions = [
          { id: 1, text: "新しいアイデアや未知の体験、創造的な活動にワクワクする", dimension: "openness", dimension_name: "開放性", is_reverse: false },
          { id: 2, text: "物事を計画的に進め、締め切りや約束事はしっかり守るほうだ", dimension: "conscientiousness", dimension_name: "誠実性", is_reverse: false },
          { id: 3, text: "初対面の人とも打ち解けやすく、賑やかな場や交流が好きだ", dimension: "extraversion", dimension_name: "外向性", is_reverse: false },
          { id: 4, text: "他人の気持ちに共感しやすく、困っている人を見ると放っておけない", dimension: "agreeableness", dimension_name: "協調性", is_reverse: false },
          { id: 5, text: "ささいなことで心配になったり、プレッシャーで不安を感じやすい", dimension: "neuroticism", dimension_name: "情緒不安定性", is_reverse: false },
          { id: 6, text: "慣れ親しんだいつものやり方を好み、変化やリスクは避けたい", dimension: "openness", dimension_name: "開放性", is_reverse: true },
          { id: 7, text: "細かい整理整頓や計画は苦手で、その場の気分で行動しがちだ", dimension: "conscientiousness", dimension_name: "誠実性", is_reverse: true },
          { id: 8, text: "大勢で過ごすよりも、一人で静かに過ごす時間のほうが落ち着く", dimension: "extraversion", dimension_name: "外向性", is_reverse: true },
          { id: 9, text: "相手の意見に疑問があるときは、遠慮なく反論や批判をすることが多い", dimension: "agreeableness", dimension_name: "協調性", is_reverse: true },
          { id: 10, text: "予期せぬトラブルや失敗があっても、気持ちを素早く切り替えられる", dimension: "neuroticism", dimension_name: "情緒不安定性", is_reverse: true }
        ];
        const freeTextPrompt = {
          title: "自由記述（より詳細な分析のために）",
          description: "普段の休日の過ごし方、今夢中になっていること、または大切にしている信条や価値観などを自由に記入してください（任意ですが、詳しく書くほどLLMの分析精度が飛躍的に高まります）。",
          placeholder: "例：休日はカフェで読書をしたり、気になった新しい技術を試すのが好きです。"
        };
        res.end(JSON.stringify({ questions, free_text_prompt: freeTextPrompt }));
        return;
      }

      const adminPassword = process.env.ADMIN_PASSWORD || 'llm5admin';
      const parsedUrl = new URL(req.url, 'http://localhost');

      const isAuthorized = () => {
        const headerKey = req.headers['x-admin-password'];
        const authHeader = req.headers['authorization'];
        const bearer = (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) ? authHeader.slice(7).trim() : null;
        const queryKey = parsedUrl.searchParams.get('key') || parsedUrl.searchParams.get('password');
        return headerKey === adminPassword || bearer === adminPassword || queryKey === adminPassword;
      };

      // 管理者セッション一覧取得 (GET /api/admin/sessions)
      if (req.method === 'GET' && parsedUrl.pathname === '/api/admin/sessions') {
        if (!isAuthorized()) {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: '認証エラー: 管理者パスワードが違います' }));
          return;
        }

        res.end(JSON.stringify({
          success: true,
          is_db_connected: false,
          total: devMockSessions.length,
          sessions: devMockSessions
        }));
        return;
      }

      // 管理者データエクスポート (GET /api/admin/export)
      if (req.method === 'GET' && parsedUrl.pathname === '/api/admin/export') {
        if (!isAuthorized()) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: '認証エラー: 管理者パスワードが違います' }));
          return;
        }

        const format = (parsedUrl.searchParams.get('format') || 'csv').toLowerCase();
        const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

        if (format === 'json') {
          res.setHeader('Content-Disposition', `attachment; filename="llm5_dev_data_${nowStr}.json"`);
          res.end(JSON.stringify(devMockSessions, null, 2));
          return;
        }

        const headers = [
          'id', 'student_id', 'age', 'gender', 'created_at', 'dialogue_turns',
          'qualtrics_id', 'survey_completed_at',
          'ai_personality_title', 'ai_personality_type', 'ai_summary',
          'ai_openness', 'ai_conscientiousness', 'ai_extraversion', 'ai_agreeableness', 'ai_neuroticism',
          'survey_scale_type', 'survey_scale_name',
          'survey_openness', 'survey_conscientiousness', 'survey_extraversion', 'survey_agreeableness', 'survey_neuroticism',
          'survey_raw_answers', 'chat_messages'
        ];

        const lines = [headers.join(',')];
        for (const s of devMockSessions) {
          const row = headers.map(h => {
            const val = (s as any)[h];
            if (val === null || val === undefined) return '""';
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(',');
          lines.push(row);
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="llm5_dev_data_${nowStr}.csv"`);
        res.end('\uFEFF' + lines.join('\r\n'));
        return;
      }

      // POST リクエストの読み取り
      let bodyText = '';
      for await (const chunk of req) {
        bodyText += chunk;
      }
      const body = bodyText ? JSON.parse(bodyText) : {};

      // 管理者認証検証 (POST /api/admin/verify)
      if (req.method === 'POST' && parsedUrl.pathname === '/api/admin/verify') {
        const inputPw = body.password || '';
        if (isAuthorized() || inputPw.trim() === adminPassword) {
          res.end(JSON.stringify({ success: true, message: '認証に成功しました' }));
        } else {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'パスワードが正しくありません' }));
        }
        return;
      }

      // 管理者セッション削除 (DELETE /api/admin/sessions)
      if (req.method === 'DELETE' && parsedUrl.pathname === '/api/admin/sessions') {
        if (!isAuthorized()) {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: '認証エラー' }));
          return;
        }
        const delId = parsedUrl.searchParams.get('id') || body.id;
        const index = devMockSessions.findIndex(s => s.id === delId);
        if (index !== -1) {
          devMockSessions.splice(index, 1);
        }
        res.end(JSON.stringify({ success: true, deleted_id: delId }));
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'GEMINI_API_KEY が未設定です。.envファイルまたはCloudflare環境変数で設定してください。' }));
        return;
      }

      const gatewayUrl = process.env.CF_AI_GATEWAY_URL;
      const baseUrl = gatewayUrl && gatewayUrl.trim() !== ''
        ? gatewayUrl.replace(/\/+$/, '')
        : 'https://generativelanguage.googleapis.com';
      const geminiUrl = `${baseUrl}/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      if (req.url === '/api/chat') {
        const { messages = [], user_input } = body;
        const currentTurn = messages.filter((m: any) => m.role === 'assistant').length + 1;
        const isReady = currentTurn >= 4;

        const contents = messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
        contents.push({ role: 'user', parts: [{ text: user_input }] });

        try {
          const fetchRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              system_instruction: {
                parts: [{
                  text: `あなたは心理カウンセラー「Dr. OCEAN」です。ビッグファイブの5因子（開放性、誠実性、外向性、協調性、情緒安定性）を自然に引き出す対話を日本語で短く行ってください。スマホ向けに150文字以内で簡潔に返してください。現在${currentTurn}問目です。${isReady ? '十分対話できたので分析へ案内してください。' : '日常のシーンについての質問を1つ投げかけてください。'}`
                }]
              },
              generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
            })
          });

          if (!fetchRes.ok) {
            const err = await fetchRes.text();
            res.statusCode = fetchRes.status;
            res.end(JSON.stringify({ error: 'Gemini API Error', details: err }));
            return;
          }

          const geminiData: any = await fetchRes.json();
          const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'ありがとうございます！';
          res.end(JSON.stringify({
            response: reply,
            question_count: currentTurn,
            is_ready_for_analysis: isReady
          }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      if (req.url === '/api/analyze') {
        let promptText = '';
        if (body.mode === 'chat') {
          promptText = '【対話履歴】\n' + (body.messages || []).map((m: any) => `${m.role}: ${m.content}`).join('\n');
        } else if (body.mode === 'questionnaire') {
          promptText = '【設問回答】\n' + JSON.stringify(body.answers) + '\n自由記述: ' + (body.free_text || '');
        } else {
          promptText = '【ユーザー記述文章】\n' + (body.direct_text || '');
        }

        try {
          const schema = {
            type: "OBJECT",
            properties: {
              personality_title: { type: "STRING" },
              personality_type: { type: "STRING" },
              summary: { type: "STRING" },
              scores: {
                type: "OBJECT",
                properties: {
                  openness: {
                    type: "OBJECT",
                    properties: { score: { type: "INTEGER" }, level: { type: "STRING" }, title: { type: "STRING" }, description: { type: "STRING" }, traits: { type: "ARRAY", items: { type: "STRING" } } },
                    required: ["score", "level", "title", "description", "traits"]
                  },
                  conscientiousness: {
                    type: "OBJECT",
                    properties: { score: { type: "INTEGER" }, level: { type: "STRING" }, title: { type: "STRING" }, description: { type: "STRING" }, traits: { type: "ARRAY", items: { type: "STRING" } } },
                    required: ["score", "level", "title", "description", "traits"]
                  },
                  extraversion: {
                    type: "OBJECT",
                    properties: { score: { type: "INTEGER" }, level: { type: "STRING" }, title: { type: "STRING" }, description: { type: "STRING" }, traits: { type: "ARRAY", items: { type: "STRING" } } },
                    required: ["score", "level", "title", "description", "traits"]
                  },
                  agreeableness: {
                    type: "OBJECT",
                    properties: { score: { type: "INTEGER" }, level: { type: "STRING" }, title: { type: "STRING" }, description: { type: "STRING" }, traits: { type: "ARRAY", items: { type: "STRING" } } },
                    required: ["score", "level", "title", "description", "traits"]
                  },
                  neuroticism: {
                    type: "OBJECT",
                    properties: { score: { type: "INTEGER" }, level: { type: "STRING" }, title: { type: "STRING" }, description: { type: "STRING" }, traits: { type: "ARRAY", items: { type: "STRING" } } },
                    required: ["score", "level", "title", "description", "traits"]
                  }
                },
                required: ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]
              },
              strengths: { type: "ARRAY", items: { type: "STRING" } },
              growth_areas: { type: "ARRAY", items: { type: "STRING" } },
              career_recommendations: { type: "ARRAY", items: { type: "STRING" } },
              relationship_style: { type: "STRING" },
              stress_management: { type: "STRING" }
            },
            required: ["personality_title", "personality_type", "summary", "scores", "strengths", "growth_areas", "career_recommendations", "relationship_style", "stress_management"]
          };

          const fetchRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `以下の情報からビッグファイブ性格プロファイルを作成してください。\n${promptText}` }] }],
              system_instruction: {
                parts: [{ text: 'ビッグファイブ理論に基づく性格心理学者として、JSONスキーマに従い0〜100のスコアと詳細な分析を出力してください。' }]
              },
              generationConfig: {
                temperature: 0.3,
                responseMimeType: "application/json",
                responseSchema: schema
              }
            })
          });

          if (!fetchRes.ok) {
            const err = await fetchRes.text();
            res.statusCode = fetchRes.status;
            res.end(JSON.stringify({ error: 'Gemini API Error', details: err }));
            return;
          }

          const geminiData: any = await fetchRes.json();
          const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          res.end(jsonText);
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      next();
    });
  }
});

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  }
});
