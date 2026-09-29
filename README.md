# LLM5

Cloudflare Pages × **Cloudflare AI Gateway (Routes: dynamic/llm5-analyst & dynamic/llm5)** で動作する、**デュアルLLM・完全対話集中・白基調スマートフォン特化型**の性格分析Webアプリケーションです。

---

## 🧠 デュアルLLMアーキテクチャ

1つのAIにすべてをやらせるのではなく、**2つのAIがリアルタイムに連携**することで、最高精度の心理分析と心地よい自然な対話を両立しています。

```mermaid
sequenceDiagram
    autonumber
    actor ユーザー
    participant Pages as Cloudflare Pages (/api/chat)
    participant Analyst as 分析官AI (Route: dynamic/llm5-analyst)
    participant Interviewer as 質問係AI (Route: dynamic/llm5)

    ユーザー->>Pages: 発言を送信
    Note over Pages,Analyst: ステップ1: 心理分析・未測定因子の抽出
    Pages->>Analyst: これまでの対話履歴を渡す
    Analyst-->>Pages: 質問戦略JSON: {"focus_dimension": "誠実性", "strategy": "予定変更時の行動について尋ねる", "is_ready": false}
    
    Note over Pages,Interviewer: ステップ2: ユーザー向け共感＋自然な問いの生成
    Pages->>Interviewer: 分析官の指示 ＋ 対話文脈
    Interviewer-->>Pages: ユーザー向けの親しみやすい会話文
    Pages->>ユーザー: メッセージを表示
```

1. **裏方の分析官AI (Route: `dynamic/llm5-analyst`)**:
   - 会話履歴からビッグファイブの5因子（開放性、誠実性、外向性、協調性、情緒安定性）の測定状況を冷徹に追跡。
   - 「どの因子が情報不足か」「次にどんなシチュエーションを尋ねるべきか」の戦略JSONを高速生成。
   - ※ 使用するAIモデル（Qwen, Llama, Gemini等）はすべてCloudflare AI GatewayのRoute側で自由に切り替え・管理可能。
2. **表舞台の質問係AI (`dynamic/llm5`)**:
   - 分析官からの戦略指示を受け取り、会話の流れに寄り添いながら、日常の自然な言葉に変換してユーザーに語りかける。
3. **最終プロファイラー (`dynamic/llm5`)**:
   - 会話終了後、詳細な5因子スコア（0〜100）、レーダーチャート用データ、キャッチコピー、強み・適職・対人関係のアドバイスを構造化生成。

---

## 📱 UI/UX 特徴

- **完全対話集中の没入UI**:
  - ヘッダーやアバター、進度バッジ等の余計な装飾を一切排除。
  - スマホ全画面（`100dvh`）に対話チャットのみが広がるミニマルな白基調デザイン。
- **安心のプロバイダーキー非保持**:
  - Gemini等のプロバイダーAPIキーはアプリ環境変数に一切不要。AI Gateway側で安全に自動注入。

---

## ☁️ Cloudflare Pages での設定

Cloudflare Pages の **Settings > Environment variables** にて以下を設定（デフォルトで自動設定されているため、基本は自動で動作します）:

| 変数名 (Variable name) | デフォルト / 例 | 説明 |
| :--- | :--- | :--- |
| **`CF_ACCOUNT_ID`** | `e809b1129ec4b6f69520858ac79b2095` | Cloudflare アカウントID |
| **`CF_GATEWAY_ID`** | `llm5` | AI Gatewayの名称（slug）。ダッシュボードで作成した名前を指定 |
| **`CF_AIG_TOKEN`** | `（あなたのToken）` | 【任意】AI Gatewayで認証トークンを有効化している場合のみ設定 |
| **`CF_AI_GATEWAY_URL`** | `https://gateway.ai.cloudflare.com/v1/.../compat/chat/completions` | 【任意】エンドポイントURL全体を手動指定したい場合 |

### 🔍 疎通確認用エンドポイント
デプロイ後、`https://<あなたのPagesドメイン>/api/health` にアクセスすると、AI Gatewayへの接続先URLや設定状況をJSONで即座に確認できます。
