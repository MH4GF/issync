# contradiction-tools Plugin

矛盾解消駆動開発のためのツール群を提供するClaude Code pluginです。

## 概要

このpluginは5つのスラッシュコマンドを提供し、plan.mdファイルの管理を効率化します：

### `/plan`: before-plan実行ワークフロー

before-planフェーズのplan.md初期作成をガイドします。以下の6ステップを自動化します：

1. GitHub Issue内容の確認
2. コードベース調査（CRITICAL）
3. plan.md基本セクションの記入
4. Open Questionsの精査
5. Tasksの初期化
6. issync pushで同期

**重要**: コードベース調査を先に実施することで、Open Questionsを真に不明な点（アーキテクチャ選択・仕様の曖昧性）のみに絞ります。

### `/resolve-question`: Open Question解消ワークフロー

plan.mdファイル内のOpen Questionを体系的に解決するサポートをします。以下のプロセスを自動化します：

1. Decision Logへの決定事項の記録
2. Open Questionの解決済みマーク
3. 関連するタスクの更新

### `/add-question`: Open Question追加ワークフロー

plan.mdファイルに新しいOpen Questionを追加する際に、優先度評価と最適な配置位置を提案します。以下のプロセスをガイドします：

1. 質問内容の入力（対話形式）
2. 優先度評価（最優先/高/中/低）
3. 既存質問との関係分析
4. 配置位置の提案
5. Open Questionsセクションへの追加

### `/compact-plan`: plan.md圧縮ツール

plan.mdファイルが大きくなりすぎた際に、情報量を保持したまま文量を削減します。以下の処理を自動化します：

1. 重複情報の削減
2. 解決済みOpen Questionsの整理
3. 完了済みPhaseの簡潔化
4. 矛盾検出と報告

### `/create-task-issues`: タスクのサブissue化ワークフロー

plan.mdのTasksセクションから`(未Issue化)`マーク付きタスクを抽出し、GitHub Issueとして一括作成します。以下のプロセスを自動化します：

1. .issync.ymlから親issue情報を取得
2. Tasksセクションから`(未Issue化)`タスクを抽出
3. ユーザーに確認（インタラクティブ）
4. gh CLIでGitHub Issueを一括作成
5. Tasksセクションを自動更新（`(未Issue化)` → `(#123)`）
6. issync pushで同期

**ハイブリッド方式**: 大きなタスクのみサブissue化し、小さなタスクはTasksセクションで管理することで、タスク管理の透明性と効率性を向上させます。

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
/plan                 # before-plan実行ワークフロー
/resolve-question     # Open Question解消ワークフロー
/add-question         # Open Question追加ワークフロー
/compact-plan         # plan.md圧縮ツール
/create-task-issues   # タスクのサブissue化ワークフロー
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

### `/plan`: before-plan実行

#### 基本的なワークフロー

1. 前提条件を確認:
   - GitHub Issueが作成されている
   - `issync init --template` が完了し、plan.mdが存在する
   - issync watch modeが起動している（推奨）

2. コマンドを実行:
   ```
   /plan
   ```

3. pluginが以下を自動実行:
   - **ステップ1**: GitHub Issue内容を確認
   - **ステップ2**: コードベース調査（類似機能、技術スタック、テストコード、関連ファイル、ドキュメント）
   - **ステップ3**: plan.md基本セクション記入（Purpose/Overview、Context & Direction、Acceptance Criteria、Work Plan Phase 1）
   - **ステップ4**: Open Questions精査（5-10項目に絞り込み）
   - **ステップ5**: Tasks初期化
   - **ステップ6**: issync pushで同期

4. 完了後、plan.mdの内容をレビューしてから Statusを `before-poc` に変更

#### 実行例

新規タスクのplan.md作成時：
- GitHub Issueの要求を理解
- コードベースを調査（既存の類似機能を発見、使用技術スタックを確認）
- Purpose/Overview、Context & Direction、Acceptance Criteriaを記入
- Open Questionsをコードで確認できないもののみ3項目に絞り込み
- Work Plan Phase 1とTasksを初期化
- watchモードが起動している場合は自動的にGitHub Issueに同期

### `/resolve-question`: Open Question解消

#### 基本的なワークフロー

1. コマンドを実行:
   ```
   /resolve-question
   ```

2. プロンプトに従って以下の情報を提供:
   - **Open Question ID** (例: Q1, Q2, Q5)
   - **決定内容のサマリー** (何を決定したか、なぜそう決定したか)
   - **トレードオフ** (制約や今後の考慮事項)
   - **タスクの更新** (新規タスクまたは削除するタスク)

3. pluginが以下を実行:
   - plan.mdのDecision Logセクションを更新
   - Open Questionを解決済みとしてマーク
   - Tasksセクションを更新
   - issyncのwatchモードが起動している場合は自動的にGitHub Issueに同期

#### 実行例

Q5（issync init実行について）の決定内容を提供すると、pluginは：
- 決定内容と根拠をDecision Logに追加
- Open QuestionsセクションでQ5を解決済みとしてマーク
- 必要に応じてTasksセクションを更新
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

5. 承認後、pluginがplan.mdを更新:
   - Open Questionsセクションに追加
   - issyncのwatchモードが起動している場合は自動的にGitHub Issueに同期

#### 実行例

新しい質問「エラーハンドリング戦略」を追加すると、pluginは：
- 既存のQ5〜Q12を分析
- 「高優先度」と評価（実装に直接影響するため）
- Q6とQ7の間に配置を提案（アーキテクチャ決定関連の質問の近くに配置）
- ユーザーの承認後、Open Questionsセクションを更新
- watchモードが起動している場合は自動的にGitHub Issueに同期

### `/compact-plan`: plan.md圧縮

#### 基本的なワークフロー

1. コマンドを実行（ファイルパスを指定）:
   ```bash
   /compact-plan docs/plan.md
   ```

2. pluginが以下を自動実行:
   - plan.mdの分析（総行数、セクション別行数、重複、矛盾）
   - plan-template.mdとの比較
   - 圧縮処理の適用
   - 矛盾検出とレポート
   - watchモードが起動している場合は自動的にGitHub Issueに同期

3. 圧縮結果レポートを確認:
   - 削減された行数と削減率
   - 適用された圧縮処理の詳細
   - 検出された矛盾（ある場合）

#### 実行例

plan.mdが779行に膨らんだ場合、pluginは：
- 重複情報を削減（5箇所）
- 解決済みOpen Questionsを整理（3件）
- 完了Phase（Phase 1）を簡潔化
- 完了タスクを削除（12件）
- 矛盾を検出してレポート
- 結果: 779行 → 450行（42%削減）

### `/create-task-issues`: タスクのサブissue化

#### 基本的なワークフロー

1. plan.mdのTasksセクションで大きなタスクに`(未Issue化)`マークを追加:
   ```markdown
   - [ ] Status変更時の自動アクション設計 (未Issue化)
   - [ ] CI/CDパイプライン統合 (未Issue化)
   - [ ] GitHub Projects連携 (未Issue化)
   ```

2. コマンドを実行:
   ```bash
   /create-task-issues              # 全ての(未Issue化)タスクを対象
   /create-task-issues "自動アクション"  # 特定のタスクのみ対象
   ```

3. pluginが以下を実行:
   - .issync.ymlから親issue情報を取得
   - Tasksセクションから`(未Issue化)`タスクを抽出
   - 抽出されたタスクリストを表示し、ユーザーに確認
   - 承認後、gh CLIでGitHub Issueを一括作成
   - Tasksセクションを自動更新: `(未Issue化)` → `(#123)`
   - watchモードが起動している場合は自動的にGitHub Issueに同期

4. 作成されたサブissueを確認:
   - 各サブissueのStatusを適切に設定（before-plan等）
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

before-planフェーズでplan.mdを初期作成する時にこのコマンドを使用してください：
- **新規タスクのplan.md作成時**: GitHub Issue作成後、`issync init --template` の直後
- **コードベース調査を徹底したい時**: 既存パターンや技術スタックを事前に確認
- **Open Questionsを適切に絞り込みたい時**: コードで確認可能な情報を質問にしない

**重要**: このコマンドは、before-planステート専用です。他のステートでは使用しません。

### `/resolve-question`

開発のどの段階でも、Open Questionに答えた時にこのコマンドを使用してください：
- **before-plan**: 初期設計の質問を解決する時
- **before-poc**: 技術的実現可能性の質問に答える時
- **before-architecture-decision**: アーキテクチャの選択を行う時
- **before-implement**: 実装の詳細を明確にする時

これは矛盾解消駆動開発ワークフローをサポートする横断的オペレーションです。

### `/add-question`

開発のどの段階でも、新しいOpen Questionを追加したい時にこのコマンドを使用してください：
- **before-plan**: 初期設計で新たな質問が見つかった時
- **before-poc**: 技術検証中に新しい疑問が生まれた時
- **before-architecture-decision**: アーキテクチャ検討で追加の選択肢が見つかった時
- **before-implement**: 実装準備中に新たな検討事項が発生した時

このコマンドは、質問の優先度を自動評価し、最適な配置位置を提案することで、Open Questionsセクションの整合性を保ちます。

### `/compact-plan`

以下のような状況で使用してください：
- **plan.mdが500行以上に膨らんだ時**: 読みづらくなる前に定期的に圧縮
- **Phaseが完了した時**: 完了フェーズの詳細を簡潔化
- **Open Questionsが大量に解決された時**: 解決済み質問を整理
- **before-retrospective前**: 振り返りを書く前にドキュメントを整理
- **矛盾の疑いがある時**: 矛盾検出機能で一貫性をチェック

### `/create-task-issues`

開発のどの段階でも、大きなタスクをサブissue化したい時にこのコマンドを使用してください：
- **before-plan**: 初期タスクを整理し、大きなタスクを識別した時
- **before-architecture-decision**: アーキテクチャ決定後、実装フェーズを複数サブissueに分割したい時
- **before-implement**: 実装前に、並行作業可能なタスクをサブissue化したい時

**ハイブリッド方式**:
- **大きなタスク**（複数日、複数PRが必要）→ サブissue化（`(未Issue化)`マークを追加 → `/create-task-issues`実行）
- **小さなタスク**（1-2時間で完結）→ plan.mdのTasksセクションで管理（Issue番号なし）

これは矛盾解消駆動開発ワークフローをサポートする横断的オペレーションです。

## 必要要件

- プロジェクトに以下のセクションを含む `plan.md` ファイルが必要:
  - **`/plan`用**: plan-template.mdから生成された初期構造
  - **`/resolve-question`用**: Decision Log, Open Questions / 残論点, Tasks
  - **`/add-question`用**: Open Questions / 残論点
  - **`/compact-plan`用**: docs/plan-template.md（圧縮の基準として使用）
  - **`/create-task-issues`用**: Tasks, Purpose/Overview, .issync.yml（issync init完了）
- (オプション) 自動同期用のissync CLIツール
- **`/create-task-issues`用の追加要件**:
  - `gh` CLI（GitHub Issueを作成するため）
  - `GITHUB_TOKEN`環境変数（`export GITHUB_TOKEN=$(gh auth token)`）

## Pluginの構造

```
contradiction-tools/
├── .claude-plugin/
│   └── plugin.json              # Pluginメタデータ
├── commands/
│   ├── plan.md                  # before-plan実行コマンド
│   ├── resolve-question.md      # Open Question解消コマンド
│   ├── add-question.md          # Open Question追加コマンド
│   ├── compact-plan.md          # plan.md圧縮コマンド
│   └── create-task-issues.md    # タスクのサブissue化コマンド
└── README.md                    # このファイル
```

## 開発

このpluginを変更するには：

1. コマンドプロンプトを編集:
   - `/plan`: `commands/plan.md`
   - `/resolve-question`: `commands/resolve-question.md`
   - `/add-question`: `commands/add-question.md`
   - `/compact-plan`: `commands/compact-plan.md`
   - `/create-task-issues`: `commands/create-task-issues.md`
2. メタデータを変更する場合は `plugin.json` を更新
3. ローカルでテスト: `/plugin install contradiction-tools` で再インストール

## ライセンス

MIT

## 作者

MH4GF
