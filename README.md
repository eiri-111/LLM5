# OCEAN AI - ビッグファイブ性格分析ツール (LLM5)

Cloudflare Pages × Google Gemini API (Cloudflare AI Gateway対応) で構築された、**スマートフォン特化型**のビッグファイブ（OCEAN）性格分析Webアプリケーションです。

---

## 📱 主な特徴

- **スマホファースト設計**:
  - 親指操作に最適化された直感的UI
  - レーダーチャート（Chart.js）による5因子（開放性・誠実性・外向性・協調性・情緒安定性）の可視化
  - X（旧Twitter）やLINEでの診断結果ワンタップシェア
- **3つの柔軟な診断モード**:
  1. 💬 **対話インタビュー診断**: AIカウンセラー「Dr. OCEAN」とチャット対話しながら深層心理を紐解く
  2. 📋 **設問クイック診断**: 心理学標準尺度（TIPI-Jベース）の10問をサクサク回答
  3. 📝 **文章・テキスト一発診断**: 日記、SNS投稿、自己PRなどの文章をコピペするだけで即座に分析
- **Cloudflare Pages & AI Gateway 最適化**:
  - V8 Edge Runtime（Pages Functions）により、世界中どこからでも低レイテンシで実行
  - 運営側でAPIキーを一括管理（一般ユーザーはキー入力一切不要）
  - Cloudflare AI Gatewayを通すことで、レート制限・キャッシング・コスト監視・ロギングを自動化

---

## 🛠️ 技術スタック
- **Frontend**: Vite, React 18, TypeScript, Chart.js, Lucide Icons
- **Backend (Edge)**: Cloudflare Pages Functions (`/functions/api/`)
- **AI Model**: Google Gemini (`gemini-2.5-flash`), Cloudflare AI Gateway
- **Development**: Docker (コンテナ名: `llm5`), Node.js 22 LTS

---

## 🚀 ローカル開発環境の起動 (Docker)

```bash
# Dockerコンテナのビルドと起動
docker compose up --build -d
```
起動後、ブラウザで [http://localhost:5173](http://localhost:5173) にアクセスしてください。

### 環境変数設定 (`.env`)
```env
# Google Gemini API Key
GEMINI_API_KEY=あなたのGeminiAPIキー

# Cloudflare AI Gateway URL (任意: キャッシュ・ロギング・レート制限用)
# 例: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/google-ai-studio
CF_AI_GATEWAY_URL=
```

---

## ☁️ Cloudflare Pages へのデプロイ手順

### 方法1: GitHub連携（推奨・最も簡単）
1. 本リポジトリをGitHubにプッシュ
2. Cloudflareダッシュボード > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**
3. ビルド設定:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables (環境変数)** を設定:
   - `GEMINI_API_KEY`: 取得したGemini APIキー
   - `CF_AI_GATEWAY_URL`: （使用する場合）AI GatewayのEndpoint URL

### 方法2: Wrangler CLIで直接デプロイ
```bash
npm run pages:deploy
```
