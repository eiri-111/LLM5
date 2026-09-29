# OCEAN AI - ビッグファイブ対話型性格分析ツール (LLM5)

Cloudflare Pages × **Cloudflare AI Gateway (Route機能)** で動作する、**完全対話集中・白基調スマートフォン特化型**のビッグファイブ（OCEAN）性格分析Webアプリケーションです。

---

## 📱 特徴

- **完全対話集中の没入UI**:
  - ヘッダー等の余計な装飾をすべて排除し、画面いっぱいにAIカウンセラー「Dr. OCEAN」との対話画面が広がるミニマルデザイン。
  - 清潔感と透明感のあるピュアホワイト＆スレートの配色。
  - 親指操作に最適化されたLINE / メッセージアプリ風のスマホチャット体験。
- **Cloudflare AI Gateway (Route機能) による安全運用**:
  - **Gemini APIキーをアプリ環境変数に持たせる必要がありません**。
  - Cloudflare AI Gateway 側の Route / Provider Secrets 設定で Gemini の API キーを管理・自動注入。
  - キャッシング、レート制限、プロバイダー自動ルーティング、利用ログの可視化をすべて Cloudflare 側で一元管理。
- **高精度なビッグファイブ性格プロファイリング**:
  - 4往復程度の自然な対話から、ビッグファイブの5因子（開放性・誠実性・外向性・協調性・情緒安定性）を的確に推定。
  - Chart.js による美しいレーダーチャート表示。
  - パーソナリティタイプ（二つ名）、強み、成長ヒント、適職、対人関係、ストレス対策を網羅。
  - X（旧Twitter）および LINE へのワンタップシェア機能。

---

## ☁️ Cloudflare Pages へのデプロイ手順

### 1. Cloudflare AI Gateway の準備
1. Cloudflare ダッシュボード > **AI** > **AI Gateway** を開く
2. Gateway を作成（または既存の Gateway を選択）
3. **Route** または **Settings** で、Google AI Studio (Gemini) の API キーを登録
4. AI Gateway の Endpoint URL をコピー
   - 例: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}`

### 2. Cloudflare Pages プロジェクトの作成
1. Cloudflare ダッシュボード > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**
2. 本リポジトリ `LLM5` を選択
3. ビルド設定:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables (環境変数)** を設定:
   - **`CF_AI_GATEWAY_URL`**: コピーした AI Gateway の URL
   - **`CF_AIG_TOKEN`**: （Gateway にトークン認証を設定している場合のみ入力、通常は不要）

### 3. デプロイ完了
- **「Save and Deploy」** をクリックするとビルドが実行され、数分で世界中のエッジサーバーに公開されます！
