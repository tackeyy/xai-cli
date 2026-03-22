# xai-cli - xAI API CLI

xAI API (Grok) の x_search ツールをラップする CLI ツール。

## 開発ルール

### TDD（テスト駆動開発）

機能追加・バグ修正は **TDD（Red-Green-Refactor）** で進める。

1. テストリストを作成
2. 失敗するテストを書く（Red）
3. テストを通す最小の実装（Green）
4. リファクタリング（Refactor）

### テスト実行

```bash
npm test           # 全テスト
npm run build      # TypeScriptビルド
```

### プロジェクト構成

```
src/
  cli/index.ts          # CLI エントリポイント（commander）
  lib/client.ts         # XaiClient（xAI API ラッパー）
  lib/types.ts          # 型定義
  lib/retry.ts          # リトライロジック（429/5xx）
  __tests__/helpers/mock-fetch.ts  # 共通モック
```

### npm link

`npm link` で `~/dev/xai-cli` がグローバルにリンクされる。ビルド後すぐに `xai` コマンドに反映される。
