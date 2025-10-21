# contradiction-tools Plugin

矛盾解消駆動開発のためのツール群を提供するClaude Code pluginです。

## 概要

このpluginは7つのスラッシュコマンドを提供し、進捗ドキュメントの管理を効率化します：

### `/plan`: plan実行ワークフロー

planフェーズの進捗ドキュメント初期作成をガイドします。以下の6ステップを自動化します：

1. GitHub Issue内容の確認
2. コードベース調査（CRITICAL）
3. 進捗ドキュメント基本セクションの記入
4. Open Questionsの精査
5. Tasksの初期化
6. issync pushで同期

**重要**: コードベース調査を先に実施することで、Open Questionsを真に不明な点（アーキテクチャ選択・仕様の曖昧性）のみに絞ります。

### `/architecture-decision`: アーキテクチャ決定ワークフロー

POC完了後、POCで得た知見を基にアーキテクチャ・設計方針を決定します。以下の8ステップを自動化します：

1. 現在のStatusを検証（architecture-decisionであることを確認）
2. POC PR情報を取得（description, commits, diff, comments）
3. Discoveries & Insightsを参照
4. Decision Logを記入（技術選定、アーキテクチャ決定、トレードオフ）
5. Specification / 仕様セクションを記入（システム仕様、アーキテクチャ、設計方針）
6. Acceptance Criteriaの妥当性検証（POCの結果を踏まえて調整）
7. POC PRをクローズ
8. issync pushで同期

**重要**: POCの実装結果を具体的に記録し、アーキテクチャ決定の根拠を明確にします。

### `/add-question`: Open Question追加ワークフロー

進捗ドキュメントに新しいOpen Questionを追加する際に、優先度評価と最適な配置位置を提案します。以下のプロセスをガイドします：

1. 質問内容の入力（対話形式）
2. 優先度評価（最優先/高/中/低）
3. 既存質問との関係分析
4. 配置位置の提案
5. Open Questionsセクションへの追加

### `/compact-plan`: 進捗ドキュメント圧縮ツール

進捗ドキュメントが大きくなりすぎた際に、情報量を保持したまま文量を削減します。以下の処理を自動化します：

1. 重複情報の削減
2. 解決済みOpen Questionsの整理
3. 完了済みPhaseの簡潔化
4. 矛盾検出と報告

### `/create-sub-issue`: タスクのサブissue化ワークフロー

進捗ドキュメントのTasksセクションから`(未Issue化)`マーク付きタスクを抽出し、GitHub Issueとして一括作成します。以下のプロセスを自動化します：

1. .issync.ymlから親issue情報を取得
2. Tasksセクションから`(未Issue化)`タスクを抽出
3. ユーザーに確認（インタラクティブ）
4. gh CLIでGitHub Issueを一括作成
5. Tasksセクションを自動更新（`(未Issue化)` → `(#123)`）
6. issync pushで同期

**ハイブリッド方式**: 大きなタスクのみサブissue化し、小さなタスクはTasksセクションで管理することで、タスク管理の透明性と効率性を向上させます。

### `/complete-sub-issue`: サブissue完了ワークフロー

サブissue完了時に親issueの進捗ドキュメントを自動更新し、完了サマリーとFollow-up事項を親issueに反映します。以下のプロセスを自動化します：

1. サブissue情報のフェッチと親issue番号の抽出
2. サブissueの進捗ドキュメントから完了情報を抽出（Outcomes & Retrospectives、Follow-up Issues）
3. 親issueの進捗ドキュメントを更新
   - Tasksセクション: 該当タスクを完了マーク
   - Outcomes & Retrospectives: サブタスク完了サマリー追加
   - Follow-up Issuesの振り分け（Tasks、Open Questions、Follow-up Issuesに適切に配置）
4. サブissueのclose
5. 完了通知（watchモードで自動同期）

**Follow-up Issues振り分けロジック**:
- 「実装タスク」→ 親issueの**Tasksセクション**に`(未Issue化)`として追加
- 「未解決の質問・改善課題」→ 親issueの**Open Questionsセクション**に追加
- 「別issueとして扱うべき申し送り事項」→ 親issueの**Follow-up Issuesセクション**に追加

## インストール

### issyncリポジトリをcloneした場合

1. マーケットプレイスを追加:
   ```bash
   # Claude Codeで実行:
   /plugin marketplace add <リポジトリのパス>/.claude-plugins
   # 例: /plugin marketplace add /Users/mh4gf/ghq/github.com/MH4GF/issync/.claude-plugins
   ```

2. pluginをインストール:
   ```bash
   /plugin install contradiction-tools@issync-plugins
   ```

3. インストール確認:
   ```bash
   /plugin list
   ```

### 他のプロジェクトで使用する場合

このpluginは他のプロジェクトでも利用できます。GitHubから直接インストールできるため、リポジトリのcloneは不要です。

#### 1. マーケットプレイスを追加

Claude Codeで以下のコマンドを実行し、GitHubから直接マーケットプレイスを追加します：

```bash
/plugin marketplace add MH4GF/issync
```

#### 2. pluginをインストール

マーケットプレイスを追加したら、pluginをインストールします：

```bash
/plugin install contradiction-tools@issync-plugins
```

#### 3. インストール確認

正しくインストールされたか確認します：

```bash
/plugin list
```

`contradiction-tools` が表示されていれば成功です。

#### 4. 使い方

インストール後は、どのプロジェクトでも以下のコマンドが使えます：

```bash
/plan                   # plan実行ワークフロー
/architecture-decision  # アーキテクチャ決定ワークフロー
/add-question           # Open Question追加ワークフロー
/compact-plan           # 進捗ドキュメント圧縮ツール
/create-sub-issue     # タスクのサブissue化ワークフロー
/complete-sub-issue       # サブissue完了ワークフロー
```

#### 更新方法

pluginが更新された場合、以下の手順で最新版に更新できます：

```bash
# 1. マーケットプレイスを更新（GitHubから最新情報を取得）
/plugin marketplace update issync-plugins

# 2. pluginを再インストール
/plugin install contradiction-tools@issync-plugins
```

マーケットプレイスの更新により、GitHubリポジトリの最新のplugin情報が取り込まれます。

#### トラブルシューティング

**Q: pluginが見つからないと言われる**

A: マーケットプレイス名を確認してください。正しい形式は `contradiction-tools@issync-plugins` です（`@issync-plugins` はマーケットプレイス名）。

**Q: 古いバージョンのまま更新されない**

A: 以下を試してください：

```bash
# 1. マーケットプレイスを更新
/plugin marketplace update issync-plugins

# 2. pluginをアンインストール
/plugin uninstall contradiction-tools@issync-plugins

# 3. 再インストール
/plugin install contradiction-tools@issync-plugins
```

**Q: ローカル開発版を使いたい（plugin開発者向け）**

A: issyncリポジトリをcloneし、ローカルパスからマーケットプレイスを追加してください：

```bash
# issyncリポジトリをclone
git clone https://github.com/MH4GF/issync.git
# または: ghq get MH4GF/issync

# ローカルパスでマーケットプレイスを追加（絶対パスを使用）
/plugin marketplace add /path/to/issync

# 例（ghqを使っている場合）:
# /plugin marketplace add /Users/username/ghq/github.com/MH4GF/issync

# インストール
/plugin install contradiction-tools@issync-plugins
```

ローカル開発版を使用している場合、変更を反映するには：

```bash
# pluginを再インストール
/plugin uninstall contradiction-tools@issync-plugins
/plugin install contradiction-tools@issync-plugins
```

## 使い方

### `/plan`: plan実行

#### 基本的なワークフロー

1. 前提条件を確認:
   - GitHub Issueが作成されている
   - `issync init --template` が完了し、進捗ドキュメントが存在する
   - issync watch modeが起動している（推奨）

2. コマンドを実行:
   ```
   /plan
   ```

3. pluginが以下を自動実行:
   - **ステップ1**: GitHub Issue内容を確認
   - **ステップ2**: コードベース調査（類似機能、技術スタック、テストコード、関連ファイル、ドキュメント）
   - **ステップ3**: 進捗ドキュメント基本セクション記入（Purpose/Overview、Context & Direction、Acceptance Criteria、Work Plan Phase 1）
   - **ステップ4**: Open Questions精査（5-10項目に絞り込み）
   - **ステップ5**: Tasks初期化
   - **ステップ6**: issync pushで同期

4. 完了後、進捗ドキュメントの内容をレビューしてから Statusを `poc` に変更

#### 実行例

新規タスクの進捗ドキュメント作成時：
- GitHub Issueの要求を理解
- コードベースを調査（既存の類似機能を発見、使用技術スタックを確認）
- Purpose/Overview、Context & Direction、Acceptance Criteriaを記入
- Open Questionsをコードで確認できないもののみ3項目に絞り込み
- Work Plan Phase 1とTasksを初期化
- watchモードが起動している場合は自動的にGitHub Issueに同期

### `/architecture-decision`: アーキテクチャ決定

#### 基本的なワークフロー

1. 前提条件を確認:
   - 現在のGitHub Issue Statusが `architecture-decision` である
   - POC実装が完了し、PRが作成されている
   - `GITHUB_TOKEN` 環境変数が設定されている（`export GITHUB_TOKEN=$(gh auth token)`）

2. コマンドを実行:
   ```
   /architecture-decision https://github.com/owner/repo/pull/123
   ```

3. pluginが以下を自動実行:
   - **ステップ1**: Status検証（architecture-decisionであることを確認）
   - **ステップ2**: POC PR情報取得（description, commits, diff, comments）
   - **ステップ3**: Discoveries & Insights参照
   - **ステップ4**: Decision Log記入（技術選定、アーキテクチャ決定、トレードオフ）
   - **ステップ5**: Specification / 仕様記入（システム仕様、アーキテクチャ、設計方針）
   - **ステップ6**: Acceptance Criteria検証（実現可能性確認、必要に応じて調整）
   - **ステップ7**: POC PRクローズ
   - **ステップ8**: issync pushで同期

4. 完了後、進捗ドキュメントの内容をレビューしてから Statusを `implement` に変更

#### 実行例

POC PR #456完了時：
- PRから技術的知見を収集（chokidarの安定性、GitHub API rate limit制約）
- Discoveries & Insightsの既存発見事項を確認
- Decision Logにアーキテクチャ決定を記録（Watch daemon実装方針、ポーリング間隔30秒）
- Specification / 仕様にシステム仕様を記入（mermaid図でアーキテクチャを可視化）
- Acceptance Criteriaを調整（「1秒以内」→「30秒間隔」に変更）
- POC PRをクローズ
- watchモードが起動している場合は自動的にGitHub Issueに同期

### `/add-question`: Open Question追加

#### 基本的なワークフロー

1. コマンドを実行:
   ```
   /add-question
   ```

2. プロンプトに従って以下の情報を提供:
   - **質問のタイトル** (簡潔に)
   - **詳細説明** (背景、検討事項、選択肢など)

3. pluginが以下を実行:
   - 既存のOpen Questionsを分析
   - 優先度を評価（最優先/高/中/低）
   - 配置位置を提案（既存質問との関係を考慮）
   - 質問番号を自動採番（Q7, Q8...）

4. 提案内容を確認:
   - 優先度評価の理由
   - 配置位置の理由
   - 新しい質問番号

5. 承認後、pluginが進捗ドキュメントを更新:
   - Open Questionsセクションに追加
   - issyncのwatchモードが起動している場合は自動的にGitHub Issueに同期

#### 実行例

新しい質問「エラーハンドリング戦略」を追加すると、pluginは：
- 既存のQ5〜Q12を分析
- 「高優先度」と評価（実装に直接影響するため）
- Q6とQ7の間に配置を提案（アーキテクチャ決定関連の質問の近くに配置）
- ユーザーの承認後、Open Questionsセクションを更新
- watchモードが起動している場合は自動的にGitHub Issueに同期

### `/compact-plan`: 進捗ドキュメント圧縮

#### 基本的なワークフロー

1. コマンドを実行（ファイルパスを指定）:
   ```bash
   /compact-plan .issync/docs/plan-123-example.md
   ```

2. pluginが以下を自動実行:
   - 進捗ドキュメントの分析（総行数、セクション別行数、重複、矛盾）
   - progress-document-template.mdとの比較
   - 圧縮処理の適用
   - 矛盾検出とレポート
   - watchモードが起動している場合は自動的にGitHub Issueに同期

3. 圧縮結果レポートを確認:
   - 削減された行数と削減率
   - 適用された圧縮処理の詳細
   - 検出された矛盾（ある場合）

#### 実行例

進捗ドキュメントが779行に膨らんだ場合、pluginは：
- 重複情報を削減（5箇所）
- 解決済みOpen Questionsを整理（3件）
- 完了Phase（Phase 1）を簡潔化
- 完了タスクを削除（12件）
- 矛盾を検出してレポート
- 結果: 779行 → 450行（42%削減）

### `/create-sub-issue`: タスクのサブissue化

#### 基本的なワークフロー

1. 進捗ドキュメントのTasksセクションで大きなタスクに`(未Issue化)`マークを追加:
   ```markdown
   - [ ] Status変更時の自動アクション設計 (未Issue化)
   - [ ] CI/CDパイプライン統合 (未Issue化)
   - [ ] GitHub Projects連携 (未Issue化)
   ```

2. コマンドを実行:
   ```bash
   /create-sub-issue              # 全ての(未Issue化)タスクを対象
   /create-sub-issue "自動アクション"  # 特定のタスクのみ対象
   ```

3. pluginが以下を実行:
   - .issync.ymlから親issue情報を取得
   - Tasksセクションから`(未Issue化)`タスクを抽出
   - 抽出されたタスクリストを表示し、ユーザーに確認
   - 承認後、gh CLIでGitHub Issueを一括作成
   - Tasksセクションを自動更新: `(未Issue化)` → `(#123)`
   - watchモードが起動している場合は自動的にGitHub Issueに同期

4. 作成されたサブissueを確認:
   - 各サブissueのStatusを適切に設定（plan等）
   - 必要に応じて各サブissueで `/plan` コマンドを実行

#### 実行例

3つの大きなタスクをサブissue化する場合、pluginは：
- .issync.ymlから親issue #123を取得
- 3つの`(未Issue化)`タスクを抽出して表示
- ユーザーの承認後、GitHub Issueを3件作成（#124, #125, #126）
- Tasksセクションを自動更新（`(未Issue化)` → `(#124)`, `(#125)`, `(#126)`）
- watchモードが起動している場合は自動的にGitHub Issueに同期

## いつ使うか

### `/plan`

planフェーズで進捗ドキュメントを初期作成する時にこのコマンドを使用してください：
- **新規タスクの進捗ドキュメント作成時**: GitHub Issue作成後、`issync init --template` の直後
- **コードベース調査を徹底したい時**: 既存パターンや技術スタックを事前に確認
- **Open Questionsを適切に絞り込みたい時**: コードで確認可能な情報を質問にしない

**重要**: このコマンドは、planステート専用です。他のステートでは使用しません。

### `/architecture-decision`

architecture-decisionステートでアーキテクチャを決定する時にこのコマンドを使用してください：
- **POC完了後**: 技術検証が完了し、実装の知見が得られた時
- **アーキテクチャ決定時**: 技術選定、設計方針、システム仕様を確定する時
- **本実装前**: implementに進む前に、設計を固める時

**重要**: このコマンドは、architecture-decisionステート専用です。POC PRをクローズし、Decision LogとSpecification / 仕様を記入します。

### `/add-question`

開発のどの段階でも、新しいOpen Questionを追加したい時にこのコマンドを使用してください：
- **plan**: 初期設計で新たな質問が見つかった時
- **poc**: 技術検証中に新しい疑問が生まれた時
- **architecture-decision**: アーキテクチャ検討で追加の選択肢が見つかった時
- **implement**: 実装準備中に新たな検討事項が発生した時

このコマンドは、質問の優先度を自動評価し、最適な配置位置を提案することで、Open Questionsセクションの整合性を保ちます。

### `/compact-plan`

以下のような状況で使用してください：
- **進捗ドキュメントが500行以上に膨らんだ時**: 読みづらくなる前に定期的に圧縮
- **Phaseが完了した時**: 完了フェーズの詳細を簡潔化
- **Open Questionsが大量に解決された時**: 解決済み質問を整理
- **retrospective前**: 振り返りを書く前にドキュメントを整理
- **矛盾の疑いがある時**: 矛盾検出機能で一貫性をチェック

### `/create-sub-issue`

開発のどの段階でも、大きなタスクをサブissue化したい時にこのコマンドを使用してください：
- **plan**: 初期タスクを整理し、大きなタスクを識別した時
- **architecture-decision**: アーキテクチャ決定後、実装フェーズを複数サブissueに分割したい時
- **implement**: 実装前に、並行作業可能なタスクをサブissue化したい時

**ハイブリッド方式**:
- **大きなタスク**（複数日、複数PRが必要）→ サブissue化（`(未Issue化)`マークを追加 → `/create-sub-issue`実行）
- **小さなタスク**（1-2時間で完結）→ 進捗ドキュメントのTasksセクションで管理（Issue番号なし）

これは矛盾解消駆動開発ワークフローをサポートする横断的オペレーションです。

### `/complete-sub-issue`

サブissueが完了し、親issueに成果を反映したい時にこのコマンドを使用してください：
- **retrospective**: サブissueの振り返り記入後、親issueに完了情報を反映する時
- **サブissueのclose時**: 完了サマリーとFollow-up事項を親issueに自動転記したい時

**運用フロー**:
1. サブissueで開発完了（plan → retrospective）
2. サブissueの進捗ドキュメントにOutcomes & RetrospectivesとFollow-up Issuesを記入
3. `/complete-sub-issue <サブissue URL>`を実行
4. 親issueのTasksセクションが自動で完了マーク
5. 親issueのOutcomes & Retrospectivesにサブタスク完了サマリーが自動追加
6. サブissueのFollow-up Issuesが親issueの適切なセクションに自動振り分け
7. サブissueが自動でclose

これは矛盾解消駆動開発ワークフローをサポートする横断的オペレーションです。

## 必要要件

- プロジェクトに以下のセクションを含む `進捗ドキュメント` ファイルが必要:
  - **`/plan`用**: progress-document-template.mdから生成された初期構造
  - **`/architecture-decision`用**: Discoveries & Insights, Decision Log, Specification / 仕様, Validation & Acceptance Criteria
  - **`/add-question`用**: Open Questions / 残論点
  - **`/compact-plan`用**: docs/progress-document-template.md（圧縮の基準として使用）
  - **`/create-sub-issue`用**: Tasks, Purpose/Overview, .issync.yml（issync init完了）
  - **`/complete-sub-issue`用**: Tasks, Outcomes & Retrospectives, Open Questions, Follow-up Issues, .issync/state.yml（issync watch実行中）
- (オプション) 自動同期用のissync CLIツール
- **`/architecture-decision`用の追加要件**:
  - `gh` CLI（PR情報取得・PRクローズのため）
  - `GITHUB_TOKEN`環境変数（`export GITHUB_TOKEN=$(gh auth token)`）
  - 現在のGitHub Issue Statusが `architecture-decision` である
- **`/create-sub-issue`用の追加要件**:
  - `gh` CLI（GitHub Issueを作成するため）
  - `GITHUB_TOKEN`環境変数（`export GITHUB_TOKEN=$(gh auth token)`）
- **`/complete-sub-issue`用の追加要件**:
  - `gh` CLI（サブissueをcloseするため）
  - `GITHUB_TOKEN`環境変数（`export GITHUB_TOKEN=$(gh auth token)`）
  - 親issueの進捗ドキュメントがローカルに存在
  - `issync watch`が実行中（親issueへの変更を自動同期するため）

## Pluginの構造

```
contradiction-tools/
├── .claude-plugin/
│   └── plugin.json                 # Pluginメタデータ
├── commands/
│   ├── 進捗ドキュメント                     # plan実行コマンド
│   ├── architecture-decision.md    # アーキテクチャ決定コマンド
│   ├── add-question.md             # Open Question追加コマンド
│   ├── compact-進捗ドキュメント             # 進捗ドキュメント圧縮コマンド
│   ├── create-sub-issue.md       # タスクのサブissue化コマンド
│   └── complete-sub-issue.md         # サブissue完了コマンド
└── README.md                       # このファイル
```

## 開発

このpluginを変更するには：

1. コマンドプロンプトを編集:
   - `/plan`: `commands/進捗ドキュメント`
   - `/architecture-decision`: `commands/architecture-decision.md`
   - `/add-question`: `commands/add-question.md`
   - `/compact-plan`: `commands/compact-進捗ドキュメント`
   - `/create-sub-issue`: `commands/create-sub-issue.md`
   - `/complete-sub-issue`: `commands/complete-sub-issue.md`
2. メタデータを変更する場合は `plugin.json` を更新
3. ローカルでテスト: `/plugin install contradiction-tools` で再インストール

## ライセンス

MIT

## 作者

MH4GF
