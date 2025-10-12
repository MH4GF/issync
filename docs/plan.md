# issync 開発計画

この実行計画は生きたドキュメントです。新しい情報が出るたびに `進捗状況`、`発見と気づき`、`決定ログ`、`成果と振り返り` を更新してください。各セクションは、事前知識のない初めての貢献者へのガイダンスとして扱ってください。

## 目的 / 全体像

issync は、GitHub Issue のコメントとローカルファイル間でテキストを同期する CLI ツールです。AI エージェントが GitHub Issue 内で生きたドキュメント(plans.md など)を単一の信頼できる情報源として維持できるようにし、複数のローカルセッション(git worktree、Devin など)が同じドキュメントを同時に読み書きできるようにします。

**コアバリュー:**

- 共有コンテキストを持つ並行 AI 開発セッションを可能にする
- ドキュメントファイルでの git コンフリクトを回避する
- 環境間で進捗ドキュメントを同期し続ける

## 進捗状況

- [x] プロジェクト名決定: `issync`
- [x] リポジトリ作成と初期化
- [x] 言語/ランタイムの選択: **Bun + TypeScript**
- [x] プロジェクト構造の定義
- [x] 基本的な CLI フレームワークの実装 (commander.js)
- [x] GitHub API クライアントの実装 (Octokit)
- [x] .issync.yml スキーマの実装 (型定義 + config 管理)
- [x] テストフレームワークのセットアップ (Bun Test)
- [x] 基本ライブラリのテスト作成 (hash, github URL parse)

**Phase 1 (MVP - ドッグフーディングまで):**
- [x] init コマンドの実装 (TDD)
- [x] push コマンドの実装 (楽観ロック含む、TDD)
- [x] pull コマンドの実装 (TDD)
- [x] GitHub Issue #1 作成とドッグフーディング開始
- [x] コードレビューと品質改善 (8件の改善完了)
- [x] watch モードの実装 (フォアグラウンド、ポーリング + ファイル監視)

**Phase 2 (スマートマージとデーモン化):**

- [ ] watch モードのデーモン化 (--daemon, PID 管理)
- [ ] stop コマンドの実装
- [ ] セクションベースのマージ戦略の実装
- [ ] コンフリクト解決 UI

**Phase 3 (安定性):**

- [ ] 包括的なテストの追加
- [ ] エラーハンドリングとリトライ戦略
- [ ] ドキュメント作成

## 発見と気づき

**2025-10-12: Claude Code の Edit() ツールを活用したコンフリクト検出**

- Claude Code の Edit() は Read() しないと動作しない
- Edit() は文字列置換に失敗すると(= ファイルが更新されていると)エラーになる
- この仕組みをそのまま活用すれば、AI エージェント側でコンフリクト検出が自然に起きる
- issync は透過的にバックグラウンドで動作し、AI エージェントは存在を意識しなくて済む

**2025-10-12: Bun Test によるゼロ設定テスト環境**

- Bun Test は追加の依存関係なしで動作する
- Jest 互換 API でテストが書ける
- TypeScript をそのままテストできる(トランスパイル不要)
- 実行速度が非常に速い (8 tests in 156ms)

**2025-10-12: watch モード使用時の前提条件とワークフロー**

- **発見**: AI エージェントが issync を使うには、**watch モード起動 → 編集開始** の順序が重要
- **問題事例**: watch を起動せずに編集したため、実際に 45 行の進捗記録が消失（git checkout で復元）
  - リモートが古いバージョンのまま watch を起動
  - pull が古いバージョンでローカルを無条件上書き
  - 楽観的ロックの TOCTOU 問題が実際に発生
- **根本原因**: MVP 版の pull は無条件上書きするため、リモートが最新でないと必ずデータロスが起きる
- **運用での対処**: CLAUDE.md に使用手順を明記し、watch 起動を最初のステップとして定義
- **Phase 2 での解決**: セクションベースマージ実装により、pull での上書きリスクを軽減

## 決定ログ

**2025-10-12: ツール命名**

- 候補: isync、plansync、ghmd、tether、clink、relay、plink、zync、comlink
- 採用: `issync` (issue + sync)
- 理由: 明確、機能的、利用可能

**2025-10-12: アーキテクチャ決定**

- SSoT: GitHub Issue Comment (Issue 本文ではない)
- 同期戦略: Pull 重視 + オンデマンド push
- マージ戦略: セクションベースの自動マージとコンフリクト検出
- コンフリクト解決: 楽観的ロックと手動フォールバック
- メタデータ保存: プロジェクトルートの .issync.yml

**2025-10-12: MVP の SSoT は GitHub Issue とする**

- 理由:
  - インフラ不要、GitHub の認証・認可をそのまま活用
  - 可視性・監査可能性が高い(Issue/PR の文脈と紐づく)
  - 運用負荷ゼロ(サーバー管理、DB、デプロイ不要)
  - 段階的拡張が可能(後から yjs など CRDT ベースに移行可能)
- yjs + 中央サーバーは将来の拡張として検討
  - ハイブリッド案: yjs をセッション中のみ起動し、定期的に Issue に永続化

**2025-10-12: AI エージェントに透過的な設計**

- **重要な要件**: AI コーディングエージェントは issync の存在を知らなくて済む
- AI エージェントは通常の Read()/Edit() ツールでファイルを操作
- issync は watch mode でバックグラウンド動作し、自動的に pull/push
- **コンフリクト検出の仕組み**:
  1. issync が watch mode でリモートの変更を pull し、ローカルファイルを更新
  2. AI エージェントが Edit() を試みる
  3. old_string が見つからず Edit() が失敗(ファイルが更新済みのため)
  4. AI エージェントは自然に Re-read して再試行(Claude Code の標準動作)
- **push 側の楽観ロック**:
  - ローカルファイル変更を検知(inotify/fswatch)
  - push 前に GitHub 側の comment hash を検証
  - 既に更新されていたら pull → マージ → 再 push or 手動解決

**2025-10-12: 言語選択 - Bun + TypeScript**

- 採用: **Bun + TypeScript**
- 理由:
  - **開発速度**: TypeScript で素早く MVP を実装できる
  - **GitHub API**: Octokit が最も成熟している
  - **ファイル監視**: chokidar など npm エコシステムを活用
  - **配布**: npm パッケージとして公開(`npm install -g issync`)
  - **ターゲットユーザー**: 開発者は Node.js/Bun を既に持っている
- 配布戦略:
  - Phase 1: npm パッケージ(ランタイム必要)
  - Phase 2: 必要に応じて単一バイナリ化 or Go への移行を検討
- 比較検討した候補: Go, Rust
  - Go: 単一バイナリ配布は優秀だが、開発速度で劣る
  - Rust: MVP には過剰、学習コストが高い

**2025-10-12: テストフレームワーク - Bun Test**

- 採用: **Bun Test** (組み込み)
- 理由:
  - **ゼロ設定**: 追加の依存関係不要、すぐに使える
  - **高速**: Jest より圧倒的に速い
  - **Jest 互換 API**: describe, test, expect など同じ API
  - **TypeScript ネイティブ**: そのまま .ts ファイルをテスト可能
- 比較検討した候補: Vitest, Jest
  - Vitest: 良い選択肢だが、Bun Test で十分
  - Jest: エコシステムは豊富だが、設定が複雑で遅い
- TDD で開発を進める

**2025-10-12: MVP スコープの明確化 - ドッグフーディング優先**

- **ゴール**: docs/plan.md を実際の GitHub Issue と同期し、issync 自体の開発に使う
- **Phase 1 (MVP) に含める**:
  - ✅ init, pull, push コマンド
  - ✅ シンプルな楽観ロック (hash 不一致時はエラーのみ、自動マージなし)
  - ✅ watch mode (フォアグラウンドプロセス、Ctrl+C で停止)
  - ✅ リモートポーリング (setInterval)
  - ✅ ローカルファイル監視 (chokidar)
- **Phase 2 以降に後回し**:
  - ❌ watch mode のデーモン化 (--daemon, PID 管理)
  - ❌ stop コマンド (デーモン停止用)
  - ❌ セクションベースの自動マージ
  - ❌ コンフリクト解決 UI
  - ❌ 高度なレート制限処理
- **理由**: 早期にドッグフーディングを開始し、実際の使用感を確認する

**2025-10-12: 状態管理に `.issync/` ディレクトリを採用**

- **採用**: `.issync/state.yml` で状態を管理
- **理由**:
  - **設定 vs 状態の明確な分離**: ルートの `.issync.yml` は設定ファイルと誤認される
  - **`.git/` との類似性**: 開発者に馴染み深いパターン（ローカル状態管理）
  - **gitignore の自然さ**: `.issync/` → 「状態管理。gitignore に追加」と直感的
  - **将来の拡張性**: 複数ファイル対応時に `.issync/plan.state.yml` などに拡張可能
- **ディレクトリ構造**:
  ```
  project-root/
    .issync/
      state.yml       # 状態ファイル（gitignore）
    .gitignore        # .issync/ を追加推奨
    docs/
      plan.md
  ```
- **init コマンドの動作**:
  - `.issync/` ディレクトリを作成
  - `state.yml` に状態を保存
  - ユーザーに `.gitignore` への追加を推奨（自動化は Phase 2 で検討）

**2025-10-12: Formatter/Linter - Biome 採用**

- **採用**: **Biome** (formatter + linter)
- **理由**:
  - **高速**: Rust 製、ESLint + Prettier より圧倒的に速い
  - **ゼロ設定**: デフォルト設定で即座に使える
  - **統合**: フォーマットとリントを単一ツールで実行
  - **Bun エコシステムとの相性**: Bun ランタイムと同様にパフォーマンス重視
- **比較検討した候補**: ESLint + Prettier
  - ESLint + Prettier: 成熟しているが設定が複雑で遅い
  - Biome: モダンで高速、MVP に最適
- **セットアップ内容**:
  - `@biomejs/biome` をインストール
  - `biome.json` で設定
  - `package.json` にスクリプト追加 (`format`, `lint`, `check`)

**2025-10-12: TypeScript ESLint の追加導入**

- **追加採用**: **typescript-eslint** (Biome と併用)
- **理由**:
  - **Biome で検出できないルール**: 不要な `async` キーワード検出 (`@typescript-eslint/require-await`)
  - **型情報を活用したリント**: `no-floating-promises`, `no-misused-promises` など
  - **コードレビュー指摘の予防**: 静的解析で事前に品質問題を検出
- **Biome との役割分担**:
  - **Biome**: フォーマット + 基本的なリント (高速、日常的に使用)
  - **typescript-eslint**: 型情報ベースの高度なリント (CI/プッシュ前)
- **セットアップ内容**:
  - `eslint`, `typescript-eslint` をインストール
  - `eslint.config.mjs` で Flat Config を使用
  - `recommended` + `require-await` ルールを有効化
  - `package.json` にスクリプト追加 (`lint:eslint`)

**2025-10-12: CLAUDE.md での運用ガイドライン提供**

- **背景**: MVP 版の pull は無条件上書きするため、watch 起動前にリモートが最新でないとデータロスが起きる
- **採用**: issync を使うプロジェクトは CLAUDE.md に使用手順を記載
  - watch 起動手順 (セッション開始時の最初のステップ)
  - 注意事項 (watch 起動前に編集しない)
  - コマンド例 (GITHUB_TOKEN の設定方法含む)
- **理由**:
  - Phase 2 実装まで、この運用ルールで MVP の制約をカバー
  - AI エージェントへの明示的な指示により、データロスを防止
  - CLAUDE.md は AI エージェントが最初に読むため、効果的
- **Phase 2 での改善**: セクションベースマージで pull のリスク軽減

**2025-10-12: コードレビュー後のリンティング設定強化 (初回)**

- **背景**: コードレビューで指摘された問題の多くは既存ルールでカバー済みだが、明示的にルール設定を追加
- **追加ルール**:
  - **Biome**:
    - `noUnusedVariables: error` (correctness カテゴリ、明示的に error に設定)
    - `noAssignInExpressions: error` (suspicious カテゴリ、条件式内の代入を防止)
  - **typescript-eslint**: 既存設定で十分 (`require-await`, `no-floating-promises`, `no-misused-promises`)
- **対処した問題**:
  - 未使用変数 (`_isOperationInFlight`) → `noUnusedVariables` で検出
  - 条件式内の誤った代入 → `noAssignInExpressions` で防止
- **検証結果**:
  - 全テスト合格 (24 tests)
  - Biome と ESLint の両方でエラーなし
- **理由**:
  - コードレビューで手動修正した問題を将来自動検出
  - レースコンディションやファイル存在確認は静的解析では検出困難（設計レベルの問題）
  - 既存の型システムとリンティングルールの組み合わせで十分な品質担保が可能

**2025-10-12: コードレビュー後のリンティング設定強化 (2回目: watch 実装後)**

- **背景**: watch コマンド実装のコードレビューで、Promise の型安全性に関する問題が指摘された
- **追加ルール**:
  - **typescript-eslint**:
    - `@typescript-eslint/await-thenable`: 'error' - Promise 以外を await しないことを強制
    - `@typescript-eslint/return-await`: ['error', 'in-try-catch'] - try-catch での return await を強制
- **理由**:
  - `await-thenable`: 非 Promise 値への誤った await を防止（型安全性の向上）
  - `return-await`: try-catch ブロック内で Promise を正しく処理し、catch ブロックが動作することを保証
  - これらのルールは try-catch 内の Promise の扱いに関するバグを防ぐ
- **対処した問題**:
  - テストコードで不要な async キーワードを削除 (mockImplementation)
  - Bun Test の `expect().rejects` が thenable-like を返す問題に対処 (ESLint コメントで無効化)
- **検証結果**:
  - 全テスト合格 (28 pass, 4 skip, 0 fail)
  - TypeScript 型チェック、Biome、ESLint 全てクリア
- **影響**:
  - Promise 処理の型安全性が向上
  - try-catch でのエラーハンドリングが確実に動作することを静的解析で保証

**2025-10-12: watch リファクタリング後のリンティング設定レビュー (3回目)**

- **背景**: watch コマンドのリファクタリング (クラスベース設計、レースコンディション修正) のコードレビューで、リンティングで検出可能な問題を調査
- **分析結果**:
  - **グローバル変数によるテスト不可能性** → 設計レベルの問題（静的解析では防止困難）
  - **レースコンディション（ポーリング）** → 設計レベルの問題（静的解析では防止困難）
  - **マジックナンバー** → Biome の `noMagicNumbers` (nursery) で検出可能だが、以下の理由で追加しない:
    - 既に手動で定数化完了
    - nursery グループ（実験的ルール）でまだ安定していない
    - テストコードで `setTimeout(100)` などの値を誤検出する可能性
    - コードレビューで十分発見可能（費用対効果が低い）
  - **スキップされたテスト** → テスト戦略の問題（静的解析では防止困難）
- **結論**: 既存のリンティング設定（Biome + typescript-eslint）で十分
  - 今回のリファクタリングで対応した問題は主に設計レベル
  - Promise 処理、async/await、型安全性は既存ルールでカバー済み
  - マジックナンバーは手動レビューで対応可能
- **今後の方針**:
  - 設計レベルの問題はコードレビュープロセスで対応
  - リンティングルールは実際に問題が発生した時に追加（YAGNI原則）
  - 新しいルールを追加する際は false positive のリスクを慎重に評価

**2025-10-12: watch 最終リファクタリング後のリンティング設定強化 (4回目: 認知的複雑度)**

- **背景**: watch コマンドの最終リファクタリング (fail-fast、バックオフロジック分離、メモリリーク防止) のコードレビューで、認知的複雑度の問題を発見
- **追加ルール**:
  - **Biome**:
    - `noExcessiveCognitiveComplexity`: error (maxAllowedComplexity: 15)
- **検出された問題**:
  - ポーリングループ（watch.ts:167）の認知的複雑度が18で制限の15を超えていた
  - ループ内で複数の条件分岐、try-catch、エラーハンドリングが複雑に組み合わさっていた
- **リファクタリング内容**:
  - ポーリングループを2つのメソッドに分割:
    - `pollOnce()`: 単一ポーリングの実行（バックオフチェック、pull、エラーハンドリング）
    - `runPollingLoop()`: ループ制御（sleep、abort チェック、pollOnce 呼び出し）
  - 各メソッドの複雑度が15以下に削減され、Biome エラーが解消
- **検証結果**:
  - 全テスト合格 (8/8 tests passed)
  - Biome、ESLint、TypeScript 型チェック全てクリア
  - リファクタリングによりコードの可読性と保守性が向上
- **理由**:
  - 認知的複雑度が高いコードは理解しにくく、バグの温床になる
  - コードレビューで手動発見した複雑度の問題を将来自動検出
  - リファクタリングにより単一責任の原則に従った設計に改善
- **影響**:
  - 今後、複雑度が高いコードが早期に検出され、適切なリファクタリングが促される
  - `withLock()` のような複数の責任を持つメソッドも将来的に検出可能

**2025-10-12: Knip 導入 - 不要コード検出**

- **採用**: **Knip** (不要な依存関係、エクスポート、ファイルを検出)
- **理由**:
  - **保守性の向上**: 使われていない依存関係、エクスポート、ファイルを自動検出
  - **パフォーマンス改善**: 不要なコードを削除することでビルドサイズと速度を改善
  - **コードベースの健全性**: デッドコードを継続的に監視
  - **Bun サポート**: `knip-bun` コマンドで Bun ランタイムを使用可能
  - **TypeScript 統合**: 型安全な設定ファイル (`knip.ts`) をサポート
- **セットアップ内容**:
  - `knip` をインストール
  - `knip.ts` で TypeScript 設定
  - エントリーポイント (`src/cli.ts`) とプロジェクトファイルを定義
  - `package.json` にスクリプト追加 (`knip`, `knip:fix`)
- **検証方針**:
  - CI/CD で定期実行し、不要コードの蓄積を防止
  - 手動実行: `bun run knip` で現状を確認
  - 自動修正: `bun run knip:fix` で削除可能なコードを自動削除

## 成果と振り返り

**2025-10-12: 初期セットアップ完了**

- **実装した内容**:
  - Bun プロジェクトの初期化 (package.json, tsconfig.json)
  - CLI フレームワーク (commander.js) の骨組み実装
    - 全コマンド (init, pull, push, watch, stop, status) のスケルトン
  - GitHub API クライアント (Octokit) の実装
    - Issue URL パース機能
    - コメントの CRUD 操作
  - 設定管理 (.issync.yml) の実装
  - ハッシュ計算ユーティリティ
  - 型定義 (IssyncConfig, GitHubIssueInfo, CommentData)
  - Bun Test のセットアップ
  - 基本ライブラリのテスト作成 (8 tests, all passing)
- **構成**:
  ```
  src/
  ├── cli.ts              # CLI エントリーポイント
  ├── lib/
  │   ├── config.ts       # 設定管理
  │   ├── github.ts       # GitHub API クライアント
  │   ├── github.test.ts
  │   ├── hash.ts         # ハッシュ計算
  │   └── hash.test.ts
  └── types/
      └── index.ts        # 型定義
  ```
- **次のステップ**: TDD で init コマンドを実装

**2025-10-12: MVP スコープの明確化とドッグフーディング計画**

- **実施内容**:
  - 進捗状況を Phase 1/2/3 に分割
  - MVP スコープを明確化 (watch のデーモン化を Phase 2 に移動)
  - 決定ログに「MVP スコープの明確化」を追加
  - 作業計画を Phase 別に整理
  - 具体的なステップを MVP に絞って簡略化
  - コマンド例を MVP 範囲に合わせて更新
  - .issync.yml スキーマを Phase 別に整理
- **方針**:
  - **Phase 1 ゴール**: docs/plan.md を GitHub Issue と同期してドッグフーディング開始
  - watch mode はフォアグラウンドプロセスで OK (Ctrl+C で停止)
  - 楽観ロックはシンプルに (hash 不一致時はエラーのみ)
  - 自動マージやデーモン化は Phase 2 以降
- **理由**: 早期にドッグフーディングを開始し、実際の使用感から学ぶ
- **次のステップ**: init コマンドの TDD 実装開始

**2025-10-12: Phase 1 コア機能の実装完了とコードレビュー**

- **実装した内容** (TDD アプローチ):
  - **init コマンド**: Issue URL からプロジェクトを初期化
    - `.issync/` ディレクトリと `state.yml` を作成
    - カスタムエラークラス `AlreadyInitializedError` を実装
    - 5つのテストケース、全て合格
  - **push コマンド**: ローカルファイルをリモートに同期
    - 楽観的ロック (hash ベース) を実装
    - comment_id がない場合は新規作成、ある場合は更新
    - `OptimisticLockError` カスタムエラーを実装
  - **pull コマンド**: リモートからローカルに同期
    - GitHub Issue コメント取得 → ローカルファイル書き込み
    - hash と timestamp を状態ファイルに保存
  - **ドッグフーディング**: Issue #1 を作成し、docs/plan.md (465行) を同期成功
- **コードレビューと品質改善** (8件の改善完了):
  1. ✅ 未実装のスキップテスト削除 (`pull.test.ts`)
  2. ✅ GitHubトークン検証追加 (正規表現で `ghp_*` / `ghs_*` 形式をチェック)
  3. ✅ CLIの重複エラーハンドリング抽出 (`_handleCommand` ヘルパー関数を作成、~40行削減)
  4. ✅ ファイルパス検証を push/pull に追加:
     - パストラバーサル攻撃の検出
     - ファイル存在確認 (push)
     - 親ディレクトリ自動作成 (pull)
     - カスタムエラークラス追加 (`InvalidFilePathError`, `FileNotFoundError`)
  5. ✅ `parseIssueUrl` の正規表現を堅牢化:
     - オプショナルなプロトコル (http/https)
     - オプショナルな www サブドメイン
     - owner/repo 名のバリデーション (英数字、アンダースコア、ハイフン、ドット)
     - オプショナルな .git サフィックス
     - クエリパラメータとフラグメントのサポート
  6. ✅ `getStatePath` に明示的な戻り値の型を追加
  7. ✅ `init` 関数から不要な async を削除 (同期関数に変更)
     - テストケースも同期版に更新 (全5テスト合格)
  8. ✅ 楽観的ロックの制限事項をドキュメント化:
     - TOCTOU (Time-of-check to time-of-use) レースコンディションの説明
     - 3つの解決策の提示
     - MVP での受容基準を明記
- **テスト結果**: 24テスト全て合格 (4ファイル、50 expect() コール、47ms)
- **技術的な成果**:
  - セキュリティ: パストラバーサル防止、トークン検証
  - 保守性: コード重複削減、明示的な型付け
  - 堅牢性: 入力バリデーション強化、エラーハンドリング改善
  - ドキュメント: 技術的制約の明文化
- **次のステップ**: watch モードの実装 (リモートポーリング + ローカルファイル監視)

**2025-10-12: watch モードの実装完了 (Phase 1 MVP 達成)**

- **実装した内容**:
  - **watch コマンド**: フォアグラウンドプロセスで自動同期
    - リモートポーリング (setInterval, デフォルト10秒間隔)
    - ローカルファイル監視 (chokidar)
    - Graceful shutdown (SIGINT/SIGTERM ハンドリング)
  - **chokidar 統合**:
    - `awaitWriteFinish` でファイル書き込み完了を待機
    - 初期読み込みをスキップ (`ignoreInitial: true`)
    - エラーハンドリング
  - **既存コマンドの再利用**: pull/push コマンドを watch 内で呼び出し
  - **ESLint 設定の改善**: dist ディレクトリを除外、Flat Config 対応
- **技術的な工夫**:
  - Promise を void 返す関数に渡す際は `void` キーワードを使用
  - async/await の不要な使用を回避 (`@typescript-eslint/require-await`)
  - chokidar の型定義を正しく import (`type FSWatcher`)
- **テスト結果**: 24テスト全て合格、型チェック・ESLint・Biome 全てクリア
- **Phase 1 MVP 達成**: init, pull, push, watch の全コア機能が実装完了
- **発見した課題**: 初回ドッグフーディング時に pull による上書き問題を発見
  - watch モードの pull が古いリモートバージョンでローカルを上書き
  - 楽観的ロックの TOCTOU 問題が実際に発生
  - 手動で git checkout による復元が必要だった
  - Phase 2 でセクションベースマージが重要であることを確認
- **次のステップ**: 実際のドッグフーディングで継続使用し、フィードバックを収集

## コンテキストと方向性

**問題のコンテキスト:**
AI エージェント(Claude Code、Devin など)は、開発セッション中に生きたドキュメントを維持することで利益を得ます。しかし、ローカルファイルには問題があります:

1. 複数人チームでの Git コンフリクト
2. 並行セッション(git worktree)間でドキュメントを共有できない
3. ドキュメントの同期が困難

**インスピレーション元:**
Feler の手法: plans.md を生きたドキュメントとして使い、AI エージェントが長時間の開発セッション(7 時間セッション、150M トークン、15K 行のリファクタリング)中に継続的に読み書きする。

**設計哲学:**

- **AI エージェントに透過的**: エージェントは issync の存在を意識せず、通常のファイル操作(Read/Edit)で動作
- **バックグラウンド同期**: watch mode がリモートとローカルを自動的に同期
- **既存ツールの活用**: Claude Code の Edit() の失敗メカニズムをコンフリクト検出に利用
- **段階的拡張**: MVP は Issue SSoT、将来的に CRDT ベース(yjs)へ移行可能

## 作業計画

### Phase 1: MVP (ドッグフーディングまで)

**ゴール:** docs/plan.md を GitHub Issue と同期し、issync 自体の開発に使う

**実装するコマンド:**

1. **init**: Issue URL → `.issync/state.yml` 生成
2. **push**: ローカル → リモート (楽観ロック: hash 不一致時はエラー)
3. **pull**: リモート → ローカル (無条件上書き)
4. **watch**: フォアグラウンドプロセスで自動同期
   - リモートポーリング (setInterval, デフォルト 10 秒)
   - ローカルファイル監視 (chokidar)
   - Ctrl+C で停止

**スコープ外 (Phase 2 以降):**

- watch のデーモン化、PID 管理、stop コマンド
- セクションベースの自動マージ
- コンフリクト解決 UI

### Phase 2: スマートマージとデーモン化

- watch mode のデーモン化 (--daemon オプション)
- PID 管理と stop コマンド
- status コマンドの詳細化
- セクションベースの Markdown パース
- 追記専用セクションの自動マージ
- コンフリクト解決 UI

### Phase 3: 安定性と最適化

- レート制限処理の改善
- エラーハンドリングとリトライ戦略
- ローカルバックアップ機能
- 包括的なテストスイート

### Phase 4: 仕上げ

- ドキュメント整備
- リリース自動化
- npm パッケージ公開

## 具体的なステップ (Phase 1 MVP)

### 実装順序

1. ✅ 言語/ランタイム決定 (Bun + TypeScript)
2. ✅ CLI 構造セットアップ (commander.js)
3. ✅ GitHub API クライアント実装 (Octokit)
4. ✅ .issync.yml スキーマ作成
5. **init コマンド実装 (TDD)**
   - Issue URL パース
   - `.issync/` ディレクトリ作成
   - `state.yml` 生成
   - バリデーション (URL, ファイル存在確認)
   - gitignore 追加の推奨メッセージ表示
6. **push コマンド実装 (TDD)**
   - ローカルファイル読み込み
   - 初回: comment 作成
   - 2 回目以降: 楽観ロック (hash 比較) → comment 更新
   - `state.yml` 更新
7. **pull コマンド実装 (TDD)**
   - リモート comment 取得
   - ローカルファイル書き込み (無条件上書き)
   - `state.yml` 更新
8. **watch モード実装**
   - chokidar でファイル監視
   - setInterval でリモートポーリング
   - フォアグラウンドプロセス (Ctrl+C で停止)
9. **ドッグフーディング開始**
   - GitHub Issue #1 作成
   - docs/plan.md を同期
   - 実際の開発で使用

### TDD ワークフロー

```bash
# 各ステップで:
1. bun test --watch を起動 (バックグラウンド)
2. テストを書く (Red)
3. 実装する (Green)
4. リファクタリング (Refactor)
5. 次のステップへ
```

## 検証と受け入れ基準

**受け入れ基準:**

- Issue コメント URL で初期化できる
- リモートの変更をローカルファイルに pull できる
- ローカルの変更をリモートコメントに push できる
- **AI エージェントが通常の Read()/Edit() で透過的に動作する**:
  - watch mode がバックグラウンドで動作中
  - AI エージェントが Edit() を試行
  - リモート更新があった場合、Edit() が失敗し、再 Read() が促される
  - issync の存在を意識せずに動作する
- Watch モードがリモート変更時にローカルファイルを自動更新する
- ローカルファイル変更時に自動的に push される
- 同じ Issue で複数の worktree 間で動作する
- 楽観ロックが機能し、コンフリクトを適切に検出・処理する

**テストシナリオ:**

- 単一ユーザー、単一セッション
- 単一ユーザー、複数 worktree(同時編集)
- 複数ユーザー、追記専用更新
- コンフリクトシナリオ(両側が同じセクションを編集)
- **AI エージェント透過性**:
  - Claude Code で watch mode 起動
  - Claude Code が plan.md を Read/Edit
  - 別セッション(or 手動)でリモート更新
  - Claude Code の Edit が自然に失敗し、再試行する

## べき等性と復旧

- Pull 操作はべき等(複数回安全に実行可能)
- Push は書き込み前にリモートハッシュを検証
- Watch モードは API 失敗を適切に処理
- マージコンフリクト前にローカルバックアップを作成

## 成果物とメモ

**主要コマンド (Phase 1 MVP):**

```bash
# 初期化: .issync/ ディレクトリと state.yml を作成
issync init <issue-url> [--file path/to/file]

# 手動同期
issync pull                    # リモート → ローカル
issync push [-m "message"]     # ローカル → リモート

# 自動同期 (フォアグラウンド)
issync watch [--interval 10]  # リモートを10秒ごとにポーリング + ローカル変更を自動push
                               # Ctrl+C で停止
```

**Phase 2 で追加予定:**

```bash
issync watch --daemon          # デーモンとして起動
issync stop                    # watch mode を停止
issync status                  # 同期状態、watch mode の状態
```

**典型的な使用フロー (MVP):**

```bash
# セッション開始時
issync init https://github.com/owner/repo/issues/123 --file docs/plan.md
issync push  # 初回pushでcommentを作成

# ターミナル1: watch mode起動 (フォアグラウンド)
issync watch

# ターミナル2: AIエージェント(Claude Code)がファイルを操作
# → issync が透過的に自動同期

# セッション終了時
# Ctrl+C で watch を停止
```

**状態ファイルフォーマット (`.issync/state.yml`):**

```yaml
# Phase 1 (MVP) - 最小限の状態管理
issue_url: https://github.com/owner/repo/issues/123
comment_id: 123456789 # 最初の push で自動設定
local_file: docs/plan.md
last_synced_hash: abc123def # リモートの最終 hash (楽観ロック用)
```

**Phase 2 で追加予定:**

```yaml
# デバッグ用フィールド
# last_synced_at: 2025-10-12T10:30:00Z

# コマンド引数で対応可能
# poll_interval: 10  # --interval で指定

# デーモン化関連
# watch_daemon_pid: 12345

# 高度なマージ戦略
# merge_strategy: section-based
```

**`.gitignore` への追加推奨:**

```gitignore
# issync ローカル状態
.issync/
```

**GitHub API 考慮事項:**

- レート制限: 5000 リクエスト/時間(認証済み)
- 10 秒間隔でのポーリング = 360 リクエスト/時間(watch プロセスあたり)
- 403/429 レスポンスの処理が必要
- **楽観ロックの実装**:
  - GET /repos/{owner}/{repo}/issues/comments/{comment_id} でコメント取得
  - body の hash を計算し、`state.yml` に保存
  - PATCH で更新する前に再度 GET して hash を比較
  - hash が一致しなければコンフリクト(pull → マージ → 再試行)
- Issue comment の更新は PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}
