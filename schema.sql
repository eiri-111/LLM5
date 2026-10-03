-- LLM5 診断データ保存用 D1 スキーマ定義
-- 実行方法:
-- ローカル実行: npx wrangler d1 execute llm5-db --local --file=./schema.sql
-- 本番実行: npx wrangler d1 execute llm5-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id TEXT PRIMARY KEY,                       -- セッションID (UUID)
  student_id TEXT NOT NULL,                   -- 学籍番号
  age INTEGER NOT NULL,                       -- 年齢
  gender TEXT NOT NULL,                       -- 性別 ('male' | 'female' | 'other' | 'prefer_not_to_say')
  created_at TEXT NOT NULL,                   -- 登録日時 (ISO8601)

  -- AI対話ログ & 分析結果
  dialogue_turns INTEGER DEFAULT 0,           -- 対話往復数
  chat_messages TEXT,                         -- JSON: 全対話履歴 [{role, content}, ...]
  ai_personality_title TEXT,                  -- 性格キャッチコピー
  ai_personality_type TEXT,                   -- 性格タイプ
  ai_summary TEXT,                            -- 全体サマリー
  ai_openness REAL,                           -- AIスコア 開放性 (0〜100)
  ai_conscientiousness REAL,                  -- AIスコア 誠実性 (0〜100)
  ai_extraversion REAL,                       -- AIスコア 外向性 (0〜100)
  ai_agreeableness REAL,                      -- AIスコア 協調性 (0〜100)
  ai_neuroticism REAL,                        -- AIスコア 情緒安定性/神経症傾向 (0〜100)
  ai_full_result TEXT,                        -- JSON: AI分析結果フルデータ

  -- 心理測定尺度（質問紙アンケート）
  survey_scale_type TEXT,                     -- 'tipi-j' | 'namikawa' | 'bfi-2-s'
  survey_scale_name TEXT,                     -- 尺度名称
  survey_raw_answers TEXT,                    -- JSON: 設問ごとの回答 { "1": 5, "2": 3, ... }
  survey_openness REAL,                       -- 尺度スコア 開放性 (0〜100正規化)
  survey_conscientiousness REAL,              -- 尺度スコア 誠実性/勤勉性 (0〜100正規化)
  survey_extraversion REAL,                   -- 尺度スコア 外向性 (0〜100正規化)
  survey_agreeableness REAL,                  -- 尺度スコア 協調性 (0〜100正規化)
  survey_neuroticism REAL,                    -- 尺度スコア 情緒不安定性/神経症傾向 (0〜100正規化)
  survey_completed_at TEXT                    -- 質問紙完了日時 (ISO8601)
);

CREATE INDEX IF NOT EXISTS idx_student_id ON assessment_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON assessment_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_survey_scale ON assessment_sessions(survey_scale_type);
