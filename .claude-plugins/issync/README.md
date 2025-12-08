# issync Plugin

GitHub Issue を単一の真実の情報源として、進捗ドキュメントをローカルファイルと双方向同期しながら、AI 駆動開発のワークフロー（plan → POC → architecture-decision → implement）を自動化する Claude Code plugin。issync と連携し、矛盾解消駆動開発における進捗ドキュメントの作成・更新・レビュー・圧縮を効率化します。

## Quick Start

### 前提条件

1. **issync CLI**: `npm install -g @mh4gf/issync`
2. **GitHub CLI (`gh`)**: https://cli.github.com/
3. **GITHUB_TOKEN**: `export GITHUB_TOKEN=$(gh auth token)` (GitHub Actionsでは自動設定)
4. **issync watch**: `issync watch` (推奨)
5. **GitHub Projects統合** (オプション):
   ```bash
   # User プロジェクトの場合（デフォルト）
   export ISSYNC_GITHUB_PROJECTS_NUMBER=1  # プロジェクト番号

   # Organization プロジェクトの場合
   export ISSYNC_GITHUB_PROJECTS_NUMBER=1  # プロジェクト番号
   export ISSYNC_GITHUB_PROJECTS_OWNER=organization-name  # 組織名
   ```
6. **ラベル自動付与**:
   - サブissue作成時に`issync:plan`ラベルを常に自動付与
   - auto-planワークフローが自動実行され、進捗ドキュメントが自動作成される

### インストール

**Claude Code 上で**以下のコマンドを実行します：

1. マーケットプレイスを追加（GitHub から直接）:

   ```
   /plugin marketplace add MH4GF/issync
   ```

2. plugin をインストール:

   ```
   /plugin install issync@issync-plugins
   ```

3. インストール確認:

   ```
   /plugin list
   ```

   `issync` が表示されていれば成功です。

### 最初のコマンド

```bash
# 新規タスクの進捗ドキュメント作成
/issync:plan https://github.com/owner/repo/issues/123

# 完了後、進捗ドキュメントをレビューしてStatusを変更
```

## Workflow Overview

この plugin は、矛盾解消駆動開発のワークフローをサポートする 9 つのコマンドを提供します：

**メインフロー:**

```
/issync:plan (plan)
    ↓
/issync:poc (poc) - 調査・検証フェーズ
    ↓
人間のレビュー・承認
    ↓
/issync:implement (implement)
    ↓
retrospective
```

**横断的オペレーション（どのフェーズでも使用可能）:**

- `/issync:understand-progress`: セッション開始時に進捗ドキュメントを選択・読み込み
- `/issync:resolve-questions`: Open Questions を解消し Decision Log と Specification を更新
- `/issync:create-sub-issue`: タスクをサブ issue 化
- `/issync:complete-sub-issue`: サブ issue 完了を親 issue に反映
- `/issync:compact-progress-document`: 進捗ドキュメント圧縮（500 行以上で推奨）

## Commands

### `/issync:plan` - 進捗ドキュメント初期作成

GitHub Issueから全コンテキストを自動収集し、進捗ドキュメントを生成（`issync init`、コードベース調査、基本セクション記入、Open Questions精査、Status変更を一括実行）。

**使い方:** `/issync:plan https://github.com/owner/repo/issues/123`

詳細は`commands/plan.md`を参照。

---

### `/issync:poc` - POC調査フェーズ自動化

自信度を上げるための調査・検証を中心に行い、発見を進捗ドキュメントに記録。実装は破棄前提で、知見の獲得が目的。POC PR作成後、人間がレビュー。

**使い方:** `/issync:poc` | `/issync:poc https://github.com/owner/repo/issues/123` | `/issync:poc 123`

詳細は`commands/poc.md`を参照。

---

### `/issync:compact-progress-document` - 進捗ドキュメント圧縮

情報量を保持したまま文量を削減（重複削減、解決済みOpen Questions整理、完了Phase簡潔化、矛盾検出）。500行以上で推奨。

**使い方:** `/issync:compact-progress-document .issync/docs/plan-123-example.md`

詳細は`commands/compact-progress-document.md`を参照。

---

### `/issync:resolve-questions` - Open Questions 解消

Open Questionsを解消し、Decision LogとSpecificationを自動更新。ユーザーがARGUMENTS形式で意思決定を入力。

**使い方:** `/issync:resolve-questions Q1-2: 推奨案 Q3: <意思決定内容> Q4: 推奨案`

詳細は`commands/resolve-questions.md`を参照。

---

### `/issync:implement` - 実装フェーズ自動化

進捗ドキュメント内容を理解した上で実装を進め、作業中は常に進捗ドキュメントを更新。

**使い方:** `/issync:implement` | `/issync:implement https://github.com/owner/repo/issues/123` | `/issync:implement 123`

詳細は`commands/implement.md`を参照。

---

### `/issync:understand-progress` - 進捗ドキュメント読み込み

セッション開始時に、state.ymlから同期中の進捗ドキュメントを選択して読み込み。

**使い方:** `/issync:understand-progress` | `/issync:understand-progress <file_path>`

詳細は`commands/understand-progress.md`を参照。

---

### `/issync:create-sub-issue` - タスクのサブ issue 化

新規タスクをGitHub Issueとして作成し、親issueとのリンクを自動管理。

**使い方:** `/issync:create-sub-issue` (インタラクティブ) | `/issync:create-sub-issue "タスク1" "タスク2"` (引数)

詳細は`commands/create-sub-issue.md`を参照。

---

### `/issync:complete-sub-issue` - サブ issue 完了

サブissue完了時に親issueの進捗ドキュメントを自動更新し、完了サマリーとFollow-up事項を反映。親issueのコメント欄に完了サマリーを投稿。

**使い方:** `/issync:complete-sub-issue https://github.com/owner/repo/issues/124`

詳細は`commands/complete-sub-issue.md`を参照。

## Appendix

### 詳細なインストール方法

**issyncリポジトリをcloneした場合（開発者向け）:**
1. `/plugin marketplace add <リポジトリのパス>/.claude-plugins`
2. `/plugin install issync@issync-plugins`
3. `/plugin list`で確認

**Plugin更新方法:**
```bash
/plugin marketplace update issync-plugins
/plugin install issync@issync-plugins
```

### トラブルシューティング

- **pluginが見つからない**: マーケットプレイス名を確認 `issync@issync-plugins`
- **古いバージョンのまま**: marketplace update → uninstall → install
- **ローカル開発版**: リポジトリをclone → marketplace add → install（変更後は再インストール）

### Plugin の構造

```
issync/
├── .claude-plugin/
│   └── plugin.json                 # Pluginメタデータ
├── agents/
│   └── codebase-explorer.md        # コードベース調査エージェント
├── commands/
│   ├── plan.md                     # plan実行コマンド
│   ├── poc.md                      # POC調査フェーズ自動化コマンド
│   ├── compact-progress-document.md # 進捗ドキュメント圧縮コマンド
│   ├── resolve-questions.md        # Open Questions解消コマンド
│   ├── implement.md                # 実装フェーズ自動化コマンド
│   ├── understand-progress.md      # 進捗ドキュメント読み込みコマンド
│   ├── create-sub-issue.md         # タスクのサブissue化コマンド
│   └── complete-sub-issue.md       # サブissue完了コマンド
└── README.md                       # このファイル
```

### Agent Architecture

この plugin は内部で再利用可能な agent を使用して、複雑なタスクを分解します。

**Commands と Agents の関係:**
- **Commands**: ユーザー向けワークフローを定義（`/issync:plan` など）
- **Agents**: Commands が Task tool で呼び出す専門エージェント

**現在の Agent:**

| Agent | 用途 | 呼び出し元 |
|-------|------|-----------|
| `codebase-explorer` | 実装パターン、アーキテクチャ、依存関係を調査 | `/issync:plan` ステップ3 |

**Agent の設計原則:**
- **汎用的なフレームワーク**: 4つの分析観点（Feature Discovery, Code Flow Tracing, Architecture Analysis, Implementation Details）を常に適用
- **柔軟な調査対象**: 親コマンドが調査対象を指示し、エージェントが適切なフォーカスを判断
- **並列実行**: 単一メッセージで複数の Task tool 呼び出しにより並列調査が可能
- **構造化された出力**: 進捗ドキュメントの「Discoveries & Insights」に直接貼り付け可能

Agent は直接呼び出すものではなく、コマンドが内部で Task tool 経由で使用します。

### Plugin 開発

この plugin を変更するには：

1. コマンドプロンプトを編集:
   - `/issync:plan`: `commands/plan.md`
   - `/issync:poc`: `commands/poc.md`
   - `/issync:compact-progress-document`: `commands/compact-progress-document.md`
   - `/issync:resolve-questions`: `commands/resolve-questions.md`
   - `/issync:implement`: `commands/implement.md`
   - `/issync:understand-progress`: `commands/understand-progress.md`
   - `/issync:create-sub-issue`: `commands/create-sub-issue.md`
   - `/issync:complete-sub-issue`: `commands/complete-sub-issue.md`
2. メタデータを変更する場合は `plugin.json` を更新
3. ローカルでテスト: `/plugin install issync@issync-plugins` で再インストール

---

## ライセンス

MIT

## 作者

MH4GF
