[English](README.md) | **日本語**

# xai-cli

> {{PROJECT_DESCRIPTION_JA}}

## 特徴

-

## クイックスタート

```bash
npm install -g xai-cli
```

## 使い方

### ツイートURL から内容取得

```bash
# テキスト本文のみ（LLM 経由）
xai tweet "https://x.com/elonmusk/status/123456789"

# X API v2 直叩き（構造化 JSON）
xai tweet "https://x.com/elonmusk/status/123456789" --raw --json
```

### 画像 OCR / Vision 解析 (--image)

画像が主体のツイート（スクリーンショット、資料、グラフなど）を Grok Vision で解析します。

```bash
# ツイート本文 + 添付画像の内容を Markdown で出力
xai tweet "https://x.com/yonkuro_svc/status/2059579175858827763" --image

# JSON 出力
xai --json tweet "https://x.com/yonkuro_svc/status/2059579175858827763" --image
```

**必要な環境変数:**

| 環境変数 | 用途 |
|---|---|
| `XAI_API_KEY` | テキスト取得 + Vision 解析（必須） |
| `X_BEARER_TOKEN` | X API v2 で画像 URL 取得（任意）|

`X_BEARER_TOKEN` 未設定時は画像取得をスキップし、テキストのみ出力します。Vision API エラー時も同様にテキストのみへフォールバックします。

## 設定

## アーキテクチャ

## よくある質問

## コントリビューション

コントリビューションを歓迎します。変更を加える前に、まず Issue を作成して議論してください。

```bash
git clone https://github.com/tackeyy/xai-cli.git
cd xai-cli
```

## ライセンス

[MIT](LICENSE)
