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

- [x] GitHub token format 検証の改善 (gho_ フォーマットのサポート)
- [ ] watch の pull-push ループバグ修正 (pull によるファイル変更を無視)
- [ ] watch 起動時の安全性チェック (3-way comparison でコンフリクト検出)
- [ ] docs/plan.md を git 管理から除外（issync 管理のみに移行）
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

**2025-10-12: watch モードの無限ループバグ発見**

- **発見**: watch モードで pull-push の無限ループが発生
- **問題の詳細**:
  - リモートポーリングで pull を実行 → ローカルファイルを書き込み
  - chokidar がファイル変更を検知 → push を実行
  - 10秒後に再びポーリング → pull を実行（リモートと完全に同じでも書き込み）
  - 再び chokidar が変更検知 → push を実行
  - **結果**: 10秒ごとに pull → push が永久に繰り返される
- **根本原因**: pull 時のファイル書き込みを chokidar が検知し、push がトリガーされる
- **影響**:
  - GitHub API のレート制限を無駄に消費（360 req/hour → 720 req/hour）
  - Edit() ツールでのファイル編集が失敗しやすくなる（常にファイルが変更されているため）
  - 実際にファイル編集中に複数回 "File has been modified" エラーが発生
- **Phase 2 での修正**: pull 操作中は chokidar の監視を一時停止、または pull によるファイル変更を無視する仕組みを実装

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

**2025-10-12: 言語・ツールスタック**

- **採用**: Bun + TypeScript, Bun Test
- **理由**: MVP の高速実装を優先。Octokit (GitHub API) と chokidar (ファイル監視) の成熟したエコシステムを活用。Bun Test はゼロ設定で Jest 互換。
- **配布**: npm パッケージ (Phase 1)、将来的に単一バイナリ化を検討

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

**2025-10-12: コードレビュー後のリンティング設定強化**

- **最終的な追加ルール**:
  - **Biome**:
    - `noUnusedVariables: error` - 未使用変数の検出
    - `noAssignInExpressions: error` - 条件式内の誤った代入を防止
    - `noExcessiveCognitiveComplexity: error (maxAllowedComplexity: 15)` - 複雑度が高いコードを検出
  - **typescript-eslint**:
    - `@typescript-eslint/await-thenable: error` - Promise 以外を await しないことを強制
    - `@typescript-eslint/return-await: ['error', 'in-try-catch']` - try-catch での return await を強制
- **検討したが追加しなかったルール**:
  - `noMagicNumbers` (Biome nursery) - 実験的ルールでまだ不安定、手動レビューで対応可能
- **方針**:
  - 設計レベルの問題（レースコンディション、テスト不可能性）は静的解析では検出困難、コードレビュープロセスで対応
  - リンティングルールは実際に問題が発生した時に追加（YAGNI原則）

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

**2025-10-12: GitHub token format 検証の改善 - gho_ サポート**

- **背景**: GitHub が新しい fine-grained personal access token を導入、フォーマットは `gho_` で始まる
- **実装内容**:
  - トークン検証の正規表現を `/^gh[ps]_/` から `/^gh[pso]_/` に変更
  - エラーメッセージに `gho_` フォーマットを追加
  - TDD アプローチで実装（テスト先行、実装、確認）
- **サポートするトークンフォーマット**:
  - `ghp_*`: Personal Access Token (Classic)
  - `ghs_*`: Server Token
  - `gho_*`: Fine-grained Personal Access Token (新規サポート)
- **テスト内容**:
  - 各トークンフォーマットが警告なく受け入れられることを確認
  - 無効なトークンフォーマットで警告が出ることを確認
  - トークンなしでエラーがスローされることを確認
- **理由**: 新しい GitHub トークンフォーマットへの対応により、ユーザーが最新のトークンを使用可能に

**2025-10-12: watch 起動時の安全性チェック (Phase 2)**

- **背景**: CLAUDE.md にワークフローを記載しても、AI エージェントが watch 起動を忘れるリスクは残る
- **採用**: watch 起動時に 3-way comparison でコンフリクト検出を実装
- **実装方針**:
  ```typescript
  // 疑似コード
  const local = readFile('docs/plan.md')
  const remote = await fetchRemote()
  const lastSynced = state.last_synced_hash

  const localHash = hash(local)
  const remoteHash = hash(remote)

  // 3-way comparison
  if (localHash !== lastSynced && remoteHash !== lastSynced) {
    // 両方が変更されている = コンフリクト
    console.error("❌ Cannot start watch: CONFLICT DETECTED")
    console.error("Both local and remote have changes since last sync")
    console.error("Options: 1. diff 2. pull --force 3. push --force")
    process.exit(1)
  }

  // どちらか一方のみが変更されている場合は自動同期
  if (localHash !== lastSynced) await push()
  else if (remoteHash !== lastSynced) await pull()

  startPolling()
  startFileWatcher()
  ```
- **メリット**:
  - データロスを事前に防止（watch 起動前に検出）
  - ユーザーに明示的な選択肢を提示（diff, pull --force, push --force）
  - 一方のみが変更されている場合は自動同期して watch 開始
- **Phase 1 との関係**:
  - Phase 1 (CLAUDE.md での運用ガイドライン) は AI エージェントへの教育
  - Phase 2 (起動時チェック) はシステムレベルでの強制
  - 両方を組み合わせることで多層防御を実現
- **他の検討案**:
  - ❌ Pre-commit hook: コミット時点ではファイル編集後なので遅すぎる
  - ❌ 内部 git 管理: リモートが必要で複雑すぎる、Phase 1 & 2 で十分な価値

## 成果と振り返り

**Phase 1 MVP 完了 (2025-10-12)**
- **実装完了**: init, pull, push, watch コマンドの TDD 実装。Issue #1 でドッグフーディング開始 (docs/plan.md 465行を同期)。
- **品質改善**: コードレビューで 8 件の改善 (トークン検証、パス検証、エラーハンドリング、型安全性)。24 テスト全て合格。
- **発見**: watch 起動前の編集でデータロス発生 (45 行消失、git checkout で復元)。CLAUDE.md に運用ガイドライン追加し、Phase 2 でセクションベースマージを実装予定。

**Phase 2 開始 (2025-10-12)**
- **gho_ トークンサポート追加**: Fine-grained Personal Access Token (`gho_`) のサポート。TDD で実装、12 テスト合格。
- **次のステップ**: watch の pull-push ループバグ修正、起動時安全性チェック、デーモン化。

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

**コマンドリファレンス:**

```bash
# 初期化
issync init <issue-url> [--file path/to/file]

# 手動同期
issync pull                    # リモート → ローカル
issync push [-m "message"]     # ローカル → リモート

# 自動同期 (MVP: フォアグラウンド)
issync watch [--interval 10]   # Ctrl+C で停止

# Phase 2 予定: デーモン化
issync watch --daemon          # バックグラウンド実行
issync stop                    # デーモン停止
issync status                  # 同期状態確認
```

**状態ファイルフォーマット (`.issync/state.yml`):**

```yaml
issue_url: https://github.com/owner/repo/issues/123
comment_id: 123456789 # 最初の push で自動設定
local_file: docs/plan.md
last_synced_hash: abc123def # リモートの最終 hash (楽観ロック用)
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
