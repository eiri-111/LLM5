FROM node:22-slim

WORKDIR /app

# パッケージ定義をコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm install

# アプリケーションソースをコピー
COPY . .

EXPOSE 5173 8788

# デフォルトでVite開発サーバーを起動
CMD ["npm", "run", "dev"]
