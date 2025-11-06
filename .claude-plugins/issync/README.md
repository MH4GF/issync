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
   export GITHUB_PROJECTS_NUMBER=1  # プロジェクト番号
   export GITHUB_PROJECTS_OWNER_TYPE=user  # 'user' または 'org' (デフォルト: user)
   ```

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

この plugin は、矛盾解消駆動開発のワークフローをサポートする 8 つのコマンドを提供します：

**メインフロー:**

```
/issync:plan (plan)
    ↓
POC実装
    ↓
/issync:review-poc (architecture-decision)
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

**何ができる:** GitHub Issueからコードベース調査を含む全コンテキストを自動収集し、進捗ドキュメントを生成。`issync init`、コードベース調査、基本セクション記入、Open Questions精査、GitHub Projects Status変更（plan → poc）を一括実行。

**いつ使う:** GitHub Issue作成後すぐ

**使い方:** `/issync:plan https://github.com/owner/repo/issues/123`

**自動実行内容:** ファイル名決定 & issync init → Issue内容確認 → コードベース調査 → 基本セクション記入 → Open Questions精査 → issync push → Status変更（plan → poc）

**完了後:** Open Questionsを確認・判断 → POC実装開始

詳細は`commands/plan.md`を参照。

---

### `/issync:review-poc` - POC レビュー

**何ができる:** POC完了後、得た知見を分析し、人間の意思決定のための材料を整理。POC PR情報取得、Acceptance Criteria検証、Discoveries & Insights追記、Open Questions強化、Decision Log推奨案記入、POC PRクローズ、issync push同期を一括実行。

**いつ使う:** POC完了後（技術検証完了時）、アーキテクチャ決定前（意思決定材料が必要な時）、本実装前

**使い方:** `/issync:review-poc https://github.com/owner/repo/pull/123`

**自動実行内容:** POC PR情報取得 → Discoveries & Insights参照 → Acceptance Criteria検証 → Discoveries & Insights追記 → Open Questions追加 → Decision Log推奨案記入 → Specification記入（オプション） → POC PRクローズ → issync push

**完了後（人間が実施）:** POC検証結果確認 → Open Questions検討・意思決定 → Decision Log推奨案の承認/修正/却下 → 承認後、手動でStatusを`implement`に変更

詳細は`commands/review-poc.md`を参照。

---

### `/issync:compact-progress-document` - 進捗ドキュメント圧縮

**何ができる:** 進捗ドキュメントが大きくなりすぎた際に、情報量を保持したまま文量を削減。重複情報削減、解決済みOpen Questions整理、完了Phase簡潔化、矛盾検出と報告を一括実行。

**いつ使う:** 500行以上に膨らんだ時、Phase完了時、Open Questions大量解決時、retrospective前、矛盾の疑いがある時

**使い方:** `/issync:compact-progress-document .issync/docs/plan-123-example.md`

**自動実行内容:** 進捗ドキュメント分析 → 圧縮処理適用 → 矛盾検出とレポート → watchモードで自動同期

詳細は`commands/compact-progress-document.md`を参照。

---

### `/issync:resolve-questions` - Open Questions 解消

**何ができる:** 進捗ドキュメント内のOpen Questionsを解消し、Decision LogやSpecificationセクションを自動更新。ユーザーがARGUMENTS形式で各質問への意思決定を入力し、LLMがそれを進捗ドキュメントに反映。取り消し線マーク、Decision Log記録、Specification更新、issync push同期を一括実行。

**いつ使う:** どのフェーズでも使用可能（Open Questionsへの回答が明確になった時）、architecture-decision（意思決定を記録したい時）、implement（仕様を確定したい時）

**使い方:** `/issync:resolve-questions Q1-2: 推奨案 Q3: <意思決定内容> Q4: 推奨案`

**自動実行内容:** `/understand-progress`で読み込み → Open Questions確認 → ユーザー入力解析 → Open Questionsセクション更新（取り消し線 + 解決済みマーク + 決定内容追記） → Decision Log記録 → Specification更新 → issync push

**完了後:** Decision Log確認、Specification確認、残りのOpen Questions解消

**重要ポイント:** ユーザー主導の意思決定（ARGUMENTSで明示的に入力）、推奨案の自動抽出、一貫したフォーマット維持、Decision LogとSpecificationへの構造化記録

詳細は`commands/resolve-questions.md`を参照。

---

### `/issync:implement` - 実装フェーズ自動化

**何ができる:** 進捗ドキュメント内容を理解した上で実装を進め、作業中は常に進捗ドキュメントを更新。`/understand-progress`による読み込み、Specification/仕様に基づいた実装、テスト実行、継続的更新、issync push同期を一括実行。

**いつ使う:** implementステート（アーキテクチャ決定後、本実装フェーズ）、GitHub Actions（Claude Code Action）から`@claude`コメントで実装依頼する時

**使い方:** `/issync:implement` | `/issync:implement https://github.com/owner/repo/issues/123` | `/issync:implement 123`

**自動実行内容:** `/understand-progress`で読み込み → Specification確認 → 実装開始 → 進捗ドキュメント継続的更新 → テスト実行 → issync push → Git commit & PR作成

**完了後:** PRレビュー依頼、Open Questions解消、サブissueの場合は`/complete-sub-issue`で親issueに反映

**重要ポイント:** 進捗ドキュメント駆動、継続的更新（Single Source of Truth維持）、テスト駆動、GitHub Actions連携

詳細は`commands/implement.md`を参照。

---

### `/issync:understand-progress` - 進捗ドキュメント読み込み

**何ができる:** セッション開始時に、state.ymlから同期中の進捗ドキュメントを選択して読み込み。複数の場合は選択肢提示、1つの場合は自動選択。Issue URL、最終同期時刻、重要なセクション情報を表示。

**いつ使う:** セッション開始時、複数タスク同時進行時、進捗ドキュメント状態確認時

**使い方:** `/issync:understand-progress` | `/issync:understand-progress <file_path>`

**自動実行内容:** `issync list`で一覧取得 → 選択（複数の場合）→ Readツールで読み込み → 情報表示（Issue URL、最終同期時刻、Purpose/Overview要約、Open Questions件数、推測Status）

詳細は`commands/understand-progress.md`を参照。

---

### `/issync:create-sub-issue` - タスクのサブ issue 化

**何ができる:** 新規タスクをGitHub Issueとして作成し、親issueとのリンクを自動管理。タスク概要入力、親issue情報取得、LLMによるタイトル・本文生成、GitHub Issue作成、Sub-issues APIによる紐づけを一括実行。

**いつ使う:** plan（初期タスク整理時）、architecture-decision（アーキテクチャ決定後、実装タスクをサブissue化したい時）、implement（実装中に新たなタスク判明時）

**使い方:** `/issync:create-sub-issue` (インタラクティブモード) | `/issync:create-sub-issue "タスク1" "タスク2"` (引数モード)

**設計原則:** インタラクティブモード（デフォルトで1つ作成、階層的分解）、引数モード（複数の独立タスクが明確な場合）、推奨ワークフロー（1つ作成 → `/plan`で詳細化 → 必要に応じて孫issue作成）

詳細は`commands/create-sub-issue.md`を参照。

---

### `/issync:complete-sub-issue` - サブ issue 完了

**何ができる:** サブissue完了時に親issueの進捗ドキュメントを自動更新し、完了サマリーとFollow-up事項を親issueに反映。サブissue情報フェッチ、完了情報抽出、親issue更新、サブissueクローズ、完了通知を一括実行。

**いつ使う:** retrospective（サブissueの振り返り記入後）、サブissueのclose時

**使い方:** `/issync:complete-sub-issue https://github.com/owner/repo/issues/124`

**自動実行内容:** サブissue情報フェッチ → 完了情報抽出 → 親issue更新（Tasksセクション完了マーク、Outcomes & Retrospectives追加、Follow-up Issues振り分け）→ サブissueクローズ → 完了通知

**Follow-up Issues振り分け:** 実装タスク → Tasksセクション、未解決の質問・改善課題 → Open Questionsセクション、別issue扱い申し送り事項 → Follow-up Issuesセクション

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

**Q: pluginが見つからない** → マーケットプレイス名を確認: `issync@issync-plugins`

**Q: 古いバージョンのまま** → `/plugin marketplace update issync-plugins` → `/plugin uninstall issync@issync-plugins` → `/plugin install issync@issync-plugins`

**Q: ローカル開発版を使いたい** → issyncリポジトリをclone → `/plugin marketplace add /path/to/issync` → `/plugin install issync@issync-plugins`。変更を反映するには再インストール。

### Plugin の構造

```
issync/
├── .claude-plugin/
│   └── plugin.json                 # Pluginメタデータ
├── commands/
│   ├── plan.md                     # plan実行コマンド
│   ├── review-poc.md               # POCレビューコマンド
│   ├── compact-progress-document.md # 進捗ドキュメント圧縮コマンド
│   ├── resolve-questions.md        # Open Questions解消コマンド
│   ├── implement.md                # 実装フェーズ自動化コマンド
│   ├── understand-progress.md      # 進捗ドキュメント読み込みコマンド
│   ├── create-sub-issue.md         # タスクのサブissue化コマンド
│   └── complete-sub-issue.md       # サブissue完了コマンド
└── README.md                       # このファイル
```

### Plugin 開発

この plugin を変更するには：

1. コマンドプロンプトを編集:
   - `/issync:plan`: `commands/plan.md`
   - `/issync:review-poc`: `commands/review-poc.md`
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
