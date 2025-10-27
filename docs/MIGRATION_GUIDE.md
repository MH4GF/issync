# progress-document-template.md Migration Guide

このドキュメントは、progress-document-template.mdのバージョン間の変更内容とマイグレーション手順を記録します。

## バージョン管理の方針

- **バージョン番号**: 単純な整数（1, 2, 3...）を使用
- **日付**: バージョン番号と共に日付を併記（例: `<!-- Template Version: 1 (2025-10-15) -->`）
- **マイグレーション**: このガイドを参照して、既存のplan.mdを新しいバージョンに更新

**全バージョン共通のマイグレーション最終ステップ**: 変更適用後、plan.mdのバージョンヘッダー（2行目）を対象バージョンに更新

## Version 1-4 (2025-10-15)

**主な変更:**
- v1: 初期バージョン（11セクション構成、HTMLコメントガイダンス）
- v2: Open Questionsのカテゴリ構造削除（フラット化）
- v3: 更新ガイドラインをHTMLコメント化
- v4: issyncマーカー追加（`<!-- issync:v1:start/end -->`）

**マイグレーション**: カテゴリ見出し削除 → ガイドラインHTMLコメント化 → issyncマーカー追加

---

## Version 5-6 (2025-10-16)

**主な変更:**
- v5: TasksセクションのGitHub Issue連携ガイダンスをHTMLコメント化
- v6: Tasks作成タイミングを`before-plan`→`before-architecture-decision`に変更

**マイグレーション**: ガイダンスをHTMLコメント内に移動し、記入タイミングを更新

---

## Version 7 (2025-10-17)

### 変更内容

**TasksセクションをGitHub Sub-issuesに完全移行 - 破壊的変更**

**削除セクション**: Tasks
**変更セクション数**: 11セクション → 10セクション
**理由**:
- GitHub Sub-issuesをSingle Source of Truth（SSOT）とし、データの重複を排除
- タスク管理の一元化により、plan.mdの簡素化と保守性向上
- `/create-sub-issue`コマンドでタスク作成を簡素化

**影響するコマンド**:
- `/create-sub-issue` → `/create-sub-issue`に名称変更・仕様変更
- `/complete-sub-issue` → Tasksセクション更新処理を削除
- `/plan` → Tasks初期化処理を削除（5ステップワークフローに変更）

**トレードオフ**: plan.mdでのタスク一覧性が低下、GitHub Projects/APIでの確認が必要

### マイグレーション手順

#### 1. Tasksセクション全体を削除

`## Tasks` 見出しから次の`---`までを削除

#### 2. 既存タスクの移行（オプション）

**選択肢A**: `/create-sub-issue`でGitHub Sub-issuesに移行後、Tasksセクション削除
**選択肢B**: Tasksセクションを残し、新規タスクのみSub-issuesとして作成

#### 3. コマンド使用方法の変更

`/create-sub-issue "タスク名"`でタスク作成（旧`/create-sub-issue`から変更）

---

## Version 8 (2025-10-17)

### 変更内容

**Inboxセクションを追加 - 人間専用の整理前メモエリア**

**追加セクション**: Inbox（人間が整理前のメモ、リンク、一時的な情報を記入。AIは記入しない）
**理由**: 断片的な情報を一時保管し、各セクションに書き込む前に人間が整理するスクラッチエリアを提供。AI/人間の役割を明確に分離

### マイグレーション手順

`<!-- issync:v1:end -->`の直前に以下を挿入:

```markdown
---

## Inbox

<!--
📝 Guidance for AI
記入タイミング: **人間が記入** - AIは記入しない
記入内容: 整理前のメモ、リンク、一時的な情報など。人間が後で適切なセクションに整理する
-->

[人間が記入する整理前の情報やメモ]
```

**注意**: Inboxは人間専用。整理完了後は適切なセクションに移動し、Inboxから削除を推奨

---

## Version 9 (2025-10-17)

### 変更内容

**ステート名から`before-`プレフィックスを削除 - 破壊的変更**

**変更内容**: 全ステート名から`before-`プレフィックスを削除
**理由**:
- シンプルさ: 全ステートに`before-`をつけるのは冗長
- 可読性: GitHub Projects UIで`plan`の方が`before-plan`より簡潔で読みやすい
- 一貫性: `failed`と`done`には元々`before-`がなく、全体の命名規則を統一

**変更後のステート名**:
- `before-plan` → `plan`
- `before-poc` → `poc`
- `before-architecture-decision` → `architecture-decision`
- `before-implement` → `implement`
- `before-merge` → `merge`
- `before-retrospective` → `retrospective`
- `failed` (変更なし)
- `done` (変更なし)

**影響範囲**: progress-document-template.md内の全HTMLコメントガイダンス、ステートマシン図、実行プロセス記述

### マイグレーション手順

#### 1. plan.md内の全`before-`プレフィックスを削除

ドキュメント全体を検索し、以下の置換を実行:
- `before-plan` → `plan`
- `before-poc` → `poc`
- `before-architecture-decision` → `architecture-decision`
- `before-implement` → `implement`
- `before-merge` → `merge`
- `before-retrospective` → `retrospective`

#### 2. GitHub Projects Status設定を更新（人間が実施）

GitHub Projects v2のStatusフィールド値を新しいステート名に更新

#### 3. contradiction-toolsコマンドを更新（自動）

contradiction-toolsプラグインが最新版であれば、自動的に新ステート名を使用

---

## マイグレーションツールの使用方法

### `/compact-plan` コマンド

plan.mdのバージョンをチェックし、マイグレーションをサポート

**動作**: バージョンヘッダー読み取り → 最新版と比較 → マイグレーション提案 → 承認後実行

### 手動バージョン確認

plan.md先頭行 `<!-- Template Version: X (YYYY-MM-DD) -->` を確認し、最新版と比較

---

## トラブルシューティング

**バージョンヘッダーがない**: plan.md先頭に `<!-- Template Version: 1 (YYYY-MM-DD) -->` を追加し、現在の構造から最も近いバージョンを特定

**マイグレーション失敗**: GitHub Issueのコメント履歴からバックアップを確認し、手動で手順を実施

---

## Version 10 (2025-10-17)

### 変更内容

**Open Questionsに「検討案」フォーマットを追加 - AIエージェント主導の意思決定を加速**

- Open Questionsに「検討案」セクションを追加し、各選択肢に「（推奨）」マーカーでAIの初期仮説を明示
- `.claude-plugins/contradiction-tools/commands/plan.md` Step 5に3パターンの具体例を追加

**理由**: AIが叩き台を提示し人間が判断するHITLワークフローを実現。初期仮説→最終決定の経緯を記録し、フォーマットの一貫性を向上

**新フォーマット**: `docs/progress-document-template.md` の「Open Questions / 残論点」セクションを参照

### マイグレーション手順

#### オプショナル - 段階的移行を推奨

**新規plan.md**: `/contradiction-tools:plan`コマンドで自動的にv10フォーマットが適用される

**既存plan.md**: 次回更新時に任意で適用
- Open Questionsに「検討案:」セクションを追加
- 推奨する選択肢に「（推奨）」マーカーを追加
- 推奨理由を記載

**一斉更新は不要**: 既存のOpen Questionsが既に解決済みの可能性が高く、フォーマット統一の優先度は低い

---

## Version 11 (2025-10-22)

### 変更内容

**概要**: ドキュメントタイトルを "Development Plan" から "Progress Document" に変更

**変更されたセクション:**
- **ドキュメントタイトル**: `# [Project Name] Development Plan` → `# [Project Name] Progress Document`

**理由:**
- 用語の統一: CLAUDE.mdやGlossaryセクションで「進捗ドキュメント (Progress Document)」という用語を使用しているため、ドキュメントタイトルもこれに合わせる
- 明確性の向上: "Development Plan" は「開発計画」という静的なドキュメントを連想させるが、"Progress Document" は継続的に更新される生きたドキュメントという性質をより明確に表現

### マイグレーション手順

#### 手動マイグレーション

既存のplan.mdをバージョン11に移行する手順:

1. ドキュメントの1行目（タイトル行）を確認
2. `# [Project Name] Development Plan` を `# [Project Name] Progress Document` に置換

**変更前:**
```markdown
<!-- Template Version: 10 (2025-10-17) -->

# [Project Name] Development Plan
```

**変更後:**
```markdown
<!-- Template Version: 11 (2025-10-22) -->

# [Project Name] Progress Document
```

**注意事項:**
- この変更は破壊的変更ではなく、オプショナルな用語統一のための変更です
- 既存のplan.mdで "Development Plan" のままでも機能的には問題ありません
- 新規作成されるplan.mdには自動的に "Progress Document" が使用されます

---

## Version 12 (2025-10-27)

### 変更内容

**概要**: ステートマシンを8ステートから6ステートに簡素化し、Stageフィールドを導入

**変更されたセクション:**
- **ステートマシン**: 8ステート（plan/poc/architecture-decision/implement/merge/retrospective/failed/done）→ 6ステート（plan/poc/architecture-decision/implement/retrospective/done）
- **削除されたステート**: merge（implement × To Reviewで表現）、failed（運用されていないため削除）
- **新規フィールド**: GitHub Projects カスタムフィールド「Stage」を導入（To Start / In Progress / To Review / (empty)）

**理由:**
- **問題**: 人間のアクションとAIのアクションが区別できず、「人間が何をすべきか」「待ちの状態か」が不明確
- **解決**: Stageフィールドで各ステート内の進行状況を3段階で表現
- **シンプル化**: mergeとfailedは冗長なステートであり、削除することでステートマシンが簡潔に

**影響範囲:**
- スラッシュコマンド: `/plan`、`/review-poc`にStage自動設定機能を追加
- GitHub Projects設定: Stageカスタムフィールドと3つのビュー（Full Workflow Board、Human Action Required、AI Working）を追加
- CI自動遷移ロジック: Status変更時にStageも同時に設定

### マイグレーション手順

#### 1. GitHub Projectsの設定更新（必須）

- **Statusフィールド**: `merge`/`failed`削除 → 6ステート（plan/poc/architecture-decision/implement/retrospective/done）
- **Stageフィールド追加**: Single Select（To Start/In Progress/To Review/(empty)）
- **ビュー追加（推奨）**: Full Workflow Board（6カラム）、Human Action Required（Stage: To Start/To Review）、AI Working（Stage: In Progress）

#### 2. 既存進捗ドキュメントの更新（オプショナル）

新規は自動適用。既存は次回更新時に任意でステートマシン図を6ステートに更新。一斉更新不要。

#### 3. スラッシュコマンドの更新（自動）

`/plan`と`/review-poc`は既にStage自動設定対応済み。追加設定不要。

---

## 更新履歴

- **Version 12 (2025-10-27)**: ステートマシンを6ステートに簡素化、Stageフィールドを導入（人間/AIアクションの区別を明確化）
- **Version 11 (2025-10-22)**: ドキュメントタイトルを "Development Plan" から "Progress Document" に変更（用語統一）
- **Version 10 (2025-10-17)**: Open Questionsに「検討案」フォーマットを追加、AIエージェント主導の意思決定を加速
- **Version 9 (2025-10-17)**: ステート名から`before-`プレフィックスを削除（破壊的変更）
- **Version 8 (2025-10-17)**: Inboxセクションを追加（人間専用の整理前メモエリア）
- **Version 7 (2025-10-17)**: TasksセクションをGitHub Sub-issuesに完全移行（破壊的変更）
- **Version 6 (2025-10-16)**: TasksセクションのAIガイダンス更新（planでの作成を廃止）
- **Version 5 (2025-10-16)**: TasksセクションのGitHub Issue連携ガイダンスをHTMLコメント化
- **Version 4 (2025-10-15)**: issyncマーカーをテンプレートに追加
- **Version 3 (2025-10-15)**: 更新ガイドラインをHTMLコメント化
- **Version 2 (2025-10-15)**: Open Questions セクションのカテゴリ構造を削除
- **Version 1 (2025-10-15)**: 初期バージョン
