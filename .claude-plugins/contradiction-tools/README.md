# contradiction-tools Plugin

GitHub Issue を単一の真実の情報源として、進捗ドキュメントをローカルファイルと双方向同期しながら、AI 駆動開発のワークフロー（plan → POC → architecture-decision → implement）を自動化する Claude Code plugin。issync と連携し、矛盾解消駆動開発における進捗ドキュメントの作成・更新・レビュー・圧縮を効率化します。

## Quick Start

### 前提条件

1. **issync CLI**のインストール（進捗ドキュメントの同期に使用）:

   ```bash
   npm install -g @mh4gf/issync
   ```

2. **GitHub CLI (`gh`)**のインストール（GitHub 操作に使用）:

   - インストール方法: https://cli.github.com/

3. **GITHUB_TOKEN 環境変数**の設定:

   - ローカル開発: `export GITHUB_TOKEN=$(gh auth token)`
   - GitHub Actions: ワークフローで自動設定済み（設定不要）

4. **issync watch**の起動（推奨）:
   ```bash
   issync watch
   ```

5. **GitHub Projects統合の設定**（オプション）:

   GitHub Projectsを使用するプロジェクトでは、以下の環境変数を設定してください：

   ```bash
   export GITHUB_PROJECTS_NUMBER=1                    # プロジェクト番号（例: 1）
   export GITHUB_PROJECTS_OWNER_TYPE=user             # プロジェクト所有者タイプ（user または org、デフォルト: user）
   ```

   - `GITHUB_PROJECTS_NUMBER`: GitHub Projects の番号（プロジェクトURLの末尾の番号、例: `https://github.com/users/username/projects/1` → `1`）
   - `GITHUB_PROJECTS_OWNER_TYPE`: プロジェクト所有者タイプ（`user` または `org`）。未設定の場合はデフォルトで `user` を使用します。

   これらの環境変数が未設定の場合、GitHub Projects操作（Status/Stage変更）はスキップされます。

### インストール

**Claude Code 上で**以下のコマンドを実行します：

1. マーケットプレイスを追加（GitHub から直接）:

   ```
   /plugin marketplace add MH4GF/issync
   ```

2. plugin をインストール:

   ```
   /plugin install contradiction-tools@issync-plugins
   ```

3. インストール確認:

   ```
   /plugin list
   ```

   `contradiction-tools` が表示されていれば成功です。

### 最初のコマンド

```bash
# 新規タスクの進捗ドキュメント作成
/contradiction-tools:plan https://github.com/owner/repo/issues/123

# 完了後、進捗ドキュメントをレビューしてStatusを変更
```

## Workflow Overview

この plugin は、矛盾解消駆動開発のワークフローをサポートする 6 つのコマンドを提供します：

**メインフロー:**

```
/contradiction-tools:plan (plan)
    ↓
POC実装
    ↓
/contradiction-tools:review-poc (architecture-decision)
    ↓
人間のレビュー・承認
    ↓
implement
    ↓
retrospective
```

**横断的オペレーション（どのフェーズでも使用可能）:**

- `/contradiction-tools:understand-progress`: セッション開始時に進捗ドキュメントを選択・読み込み
- `/contradiction-tools:create-sub-issue`: タスクをサブ issue 化
- `/contradiction-tools:complete-sub-issue`: サブ issue 完了を親 issue に反映
- `/contradiction-tools:compact-plan`: 進捗ドキュメント圧縮（500 行以上で推奨）

## Commands

### `/contradiction-tools:plan` - 進捗ドキュメント初期作成

**何ができる:**
GitHub Issue からコードベース調査を含む全てのコンテキストを自動収集し、精度の高い進捗ドキュメントを生成します。`issync init`の実行から、コードベース調査、基本セクションの記入、Open Questions の精査、GitHub Projects Status の自動変更（plan → poc）まで、全てを一括実行します。

**ユーザーがやること:**
issue 上に同期された進捗ドキュメントの Open Questions を見て判断するだけ。コードベース調査や進捗ドキュメント作成は全て自動化されます。

**いつ使う:**

- GitHub Issue 作成後すぐ

**使い方:**

1. 前提条件を確認:

   - GitHub Issue が作成されている
   - `issync watch` が起動している（推奨）

2. コマンドを実行:

   ```bash
   /contradiction-tools:plan https://github.com/owner/repo/issues/123
   ```

3. plugin が以下を自動実行:

   - **ステップ 1**: ファイル名決定 & `issync init` 実行
   - **ステップ 2**: GitHub Issue 内容の確認
   - **ステップ 3**: コードベース調査（類似機能、技術スタック、テストコード、関連ファイル、ドキュメント）
   - **ステップ 4**: 進捗ドキュメント基本セクション記入（Purpose/Overview、Context & Direction、Acceptance Criteria）
   - **ステップ 5**: Open Questions 精査（コードで確認可能な情報を除外し、5-10 項目に絞り込み）
   - **ステップ 6**: issync push で同期
   - **ステップ 7**: GitHub Projects Status を自動変更（plan → poc）

4. 完了後にやること:
   - Open Questions を確認し、判断が必要な項目について決定
   - POC 実装を開始

---

### `/contradiction-tools:review-poc` - POC レビュー

**何ができる:**
POC 完了後、POC で得た知見を分析し、人間の意思決定のための材料を整理します。POC PR 情報取得、Acceptance Criteria 検証、Discoveries & Insights 追記、Open Questions 強化、Decision Log 推奨案記入、POC PR クローズ、issync push による同期を一括実行します。

**いつ使う:**

- POC 完了後（技術検証が完了し、実装の知見が得られた時）
- アーキテクチャ決定前（人間が意思決定するための材料が必要な時）
- 本実装前（implement に進む前に、POC の結果を整理する時）

**使い方:**

1. 前提条件を確認:

   - 現在の GitHub Issue Status が `architecture-decision` である
   - POC 実装が完了し、PR が作成されている
   - `GITHUB_TOKEN` 環境変数が設定されている

2. コマンドを実行:

   ```bash
   /contradiction-tools:review-poc https://github.com/owner/repo/pull/123
   ```

3. plugin が以下を自動実行:

   - **ステップ 1**: POC PR 情報取得（description, commits, diff, comments）
   - **ステップ 2**: Discoveries & Insights 参照
   - **ステップ 3**: Acceptance Criteria 検証（達成/未達成を明確化、未達成の理由分析）
   - **ステップ 4**: Discoveries & Insights 追記（POC で発見した技術的事実）
   - **ステップ 5**: Open Questions 追加（未達成項目の論点化、選択肢の明確化）
   - **ステップ 6**: Decision Log 推奨案記入（人間の最終決定を前提とした推奨案）
   - **ステップ 7**: Specification / 仕様記入（POC で確認された部分のみ、オプショナル）
   - **ステップ 8**: POC PR クローズ
   - **ステップ 9**: issync push で同期

4. 完了後、**人間が進捗ドキュメントをレビュー**:
   - POC 検証結果の確認
   - Open Questions の検討・意思決定
   - Decision Log 推奨案の承認/修正/却下
   - 承認後、手動で Status を `implement` に変更

---

### `/contradiction-tools:compact-plan` - 進捗ドキュメント圧縮

**何ができる:**
進捗ドキュメントが大きくなりすぎた際に、情報量を保持したまま文量を削減します。重複情報の削減、解決済み Open Questions の整理、完了済み Phase の簡潔化、矛盾検出と報告を一括実行します。

**いつ使う:**

- 進捗ドキュメントが 500 行以上に膨らんだ時（読みづらくなる前に定期的に圧縮）
- Phase が完了した時（完了フェーズの詳細を簡潔化）
- Open Questions が大量に解決された時（解決済み質問を整理）
- retrospective 前（振り返りを書く前にドキュメントを整理）
- 矛盾の疑いがある時（矛盾検出機能で一貫性をチェック）

**使い方:**

1. コマンドを実行（ファイルパスを指定）:

   ```bash
   /contradiction-tools:compact-plan .issync/docs/plan-123-example.md
   ```

2. plugin が以下を自動実行:

   - 進捗ドキュメントの分析（総行数、セクション別行数、重複、矛盾）
   - progress-document-template.md との比較
   - 圧縮処理の適用
   - 矛盾検出とレポート
   - watch モードが起動している場合は自動的に GitHub Issue に同期

3. 圧縮結果レポートを確認:
   - 削減された行数と削減率
   - 適用された圧縮処理の詳細
   - 検出された矛盾（ある場合）

---

### `/contradiction-tools:understand-progress` - 進捗ドキュメント読み込み

**何ができる:**
セッション開始時に、state.yml から同期中の進捗ドキュメントを選択して読み込みます。複数の進捗ドキュメントがある場合は選択肢を提示し、1つの場合は自動選択します。読み込み後、Issue URL、最終同期時刻、重要なセクション情報を表示します。

**いつ使う:**

- セッション開始時（進捗ドキュメントのコンテキストを把握したい時）
- 複数のタスクを同時進行している時（どの進捗ドキュメントで作業するか選択したい時）
- 進捗ドキュメントの現在の状態を確認したい時

**使い方:**

1. コマンドを実行:

   ```bash
   /contradiction-tools:understand-progress                    # state.ymlから選択
   /contradiction-tools:understand-progress <file_path>        # 明示的パス指定
   ```

2. plugin が以下を自動実行:

   - **引数なしの場合**: `issync list` で同期中のファイル一覧を取得
   - **複数ファイル**: 選択肢を提示（番号入力）
   - **1つのみ**: 確認後に自動選択
   - **引数ありの場合**: 指定パスを直接読み込み

3. Read ツールでファイルを読み込み、以下の情報を表示:
   - Issue URL と最終同期時刻
   - Purpose/Overview の要約
   - Open Questions の件数
   - 推測される Status（plan/poc/architecture-decision/implement 等）

4. 完了後にやること:
   - 進捗ドキュメントの内容を確認
   - Open Questions を確認し、必要に応じて解消
   - 次のステップ（POC/実装等）を開始

---

### `/contradiction-tools:create-sub-issue` - タスクのサブ issue 化

**何ができる:**
新規タスクを GitHub Issue として作成し、親 issue とのリンクを自動管理します。タスク概要入力、親 issue 情報取得、LLM によるタイトル・本文生成、GitHub Issue 作成、Sub-issues API による紐づけを一括実行します。

**いつ使う:**

- plan: 初期タスクを整理し、サブ issue を作成する時
- architecture-decision: アーキテクチャ決定後、実装タスクをサブ issue 化したい時
- implement: 実装中に新たなタスクが判明した時

**使い方:**

1. コマンドを実行:

   ```bash
   /contradiction-tools:create-sub-issue                          # インタラクティブモード（1つのタスク概要を入力）
   /contradiction-tools:create-sub-issue "自動アクション設計" "CI/CD統合"  # 引数モード（複数可）
   ```

2. **インタラクティブモード**の場合:

   - プロンプト: 「1 つのサブ issue を作成します。タスク概要を入力してください」
   - タスク概要を 1 つ入力（例: "Status 変更時の自動アクション設計"）
   - LLM が親 issue のコンテキストから適切なタイトルと本文を生成
   - ユーザー確認後、GitHub Issue を作成
   - Sub-issues API で親 issue と紐づけ

3. **引数モード**の場合:

   - 引数で指定された複数のタスク概要から一括作成
   - 各タスクに対して LLM がタイトルと本文を生成
   - Sub-issues 順序設定で作成順序を維持

4. 作成されたサブ issue を確認:
   - 各サブ issue の Status を適切に設定（plan 等）
   - 必要に応じて各サブ issue で `/contradiction-tools:plan` コマンドを実行

**設計原則:**

- **インタラクティブモード**: デフォルトで 1 つのサブ issue を作成（階層的分解）
- **引数モード**: 複数の独立したタスクが明確な場合に一括作成
- **推奨ワークフロー**: まず 1 つ作成 → `/contradiction-tools:plan`で詳細化 → 必要に応じて孫 issue を作成

---

### `/contradiction-tools:complete-sub-issue` - サブ issue 完了

**何ができる:**
サブ issue 完了時に親 issue の進捗ドキュメントを自動更新し、完了サマリーと Follow-up 事項を親 issue に反映します。サブ issue 情報のフェッチ、完了情報の抽出、親 issue 更新、サブ issue クローズ、完了通知を一括実行します。

**いつ使う:**

- retrospective: サブ issue の振り返り記入後、親 issue に完了情報を反映する時
- サブ issue の close 時: 完了サマリーと Follow-up 事項を親 issue に自動転記したい時

**使い方:**

1. 前提条件を確認:

   - サブ issue の進捗ドキュメントに Outcomes & Retrospectives と Follow-up Issues が記入されている
   - 親 issue の進捗ドキュメントがローカルに存在
   - `issync watch`が実行中（推奨）

2. コマンドを実行:

   ```bash
   /contradiction-tools:complete-sub-issue https://github.com/owner/repo/issues/124
   ```

3. plugin が以下を自動実行:
   - サブ issue 情報のフェッチと親 issue 番号の抽出
   - サブ issue の進捗ドキュメントから完了情報を抽出（Outcomes & Retrospectives、Follow-up Issues）
   - 親 issue の進捗ドキュメントを更新
     - Tasks セクション: 該当タスクを完了マーク
     - Outcomes & Retrospectives: サブタスク完了サマリー追加
     - Follow-up Issues の振り分け（Tasks、Open Questions、Follow-up Issues に適切に配置）
   - サブ issue の close
   - 完了通知（watch モードで自動同期）

**Follow-up Issues 振り分けロジック:**

- 「実装タスク」→ 親 issue の**Tasks セクション**に`(未Issue化)`として追加
- 「未解決の質問・改善課題」→ 親 issue の**Open Questions セクション**に追加
- 「別 issue として扱うべき申し送り事項」→ 親 issue の**Follow-up Issues セクション**に追加

**運用フロー:**

1. サブ issue で開発完了（plan → retrospective）
2. サブ issue の進捗ドキュメントに Outcomes & Retrospectives と Follow-up Issues を記入
3. `/complete-sub-issue <サブissue URL>`を実行
4. 親 issue の Tasks セクションが自動で完了マーク
5. 親 issue の Outcomes & Retrospectives にサブタスク完了サマリーが自動追加
6. サブ issue の Follow-up Issues が親 issue の適切なセクションに自動振り分け
7. サブ issue が自動で close

## Appendix

### 詳細なインストール方法

#### issync リポジトリを clone した場合（開発者向け）

1. ローカルパスでマーケットプレイスを追加:

   ```bash
   # Claude Codeで実行（絶対パスを使用）:
   /plugin marketplace add <リポジトリのパス>/.claude-plugins
   # 例: /plugin marketplace add /Users/mh4gf/ghq/github.com/MH4GF/issync/.claude-plugins
   ```

2. plugin をインストール:

   ```bash
   /plugin install contradiction-tools@issync-plugins
   ```

3. インストール確認:
   ```bash
   /plugin list
   ```

#### Plugin 更新方法

plugin が更新された場合、以下の手順で最新版に更新できます：

```bash
# 1. マーケットプレイスを更新（GitHubから最新情報を取得）
/plugin marketplace update issync-plugins

# 2. pluginを再インストール
/plugin install contradiction-tools@issync-plugins
```

### トラブルシューティング

**Q: plugin が見つからないと言われる**

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

**Q: ローカル開発版を使いたい（plugin 開発者向け）**

A: issync リポジトリを clone し、ローカルパスからマーケットプレイスを追加してください：

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

### Plugin の構造

```
contradiction-tools/
├── .claude-plugin/
│   └── plugin.json                 # Pluginメタデータ
├── commands/
│   ├── plan.md                     # plan実行コマンド
│   ├── review-poc.md               # POCレビューコマンド
│   ├── compact-plan.md             # 進捗ドキュメント圧縮コマンド
│   ├── understand-progress.md      # 進捗ドキュメント読み込みコマンド
│   ├── create-sub-issue.md         # タスクのサブissue化コマンド
│   └── complete-sub-issue.md       # サブissue完了コマンド
└── README.md                       # このファイル
```

### Plugin 開発

この plugin を変更するには：

1. コマンドプロンプトを編集:
   - `/contradiction-tools:plan`: `commands/plan.md`
   - `/contradiction-tools:review-poc`: `commands/review-poc.md`
   - `/contradiction-tools:compact-plan`: `commands/compact-plan.md`
   - `/contradiction-tools:understand-progress`: `commands/understand-progress.md`
   - `/contradiction-tools:create-sub-issue`: `commands/create-sub-issue.md`
   - `/contradiction-tools:complete-sub-issue`: `commands/complete-sub-issue.md`
2. メタデータを変更する場合は `plugin.json` を更新
3. ローカルでテスト: `/plugin install contradiction-tools@issync-plugins` で再インストール

---

## ライセンス

MIT

## 作者

MH4GF
