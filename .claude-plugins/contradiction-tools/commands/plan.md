---
description: before-planフェーズのプロセスを標準化し、コードベース調査を強制することで高品質なplan.md作成を実現
---

# /plan: before-plan実行ワークフロー

あなたはユーザーのplan.mdファイルを初期作成するサポートをしています。このコマンドは以下の6ステップのワークフローを自動化します：
1. GitHub Issue内容の確認
2. コードベース調査（CRITICAL）
3. plan.md基本セクションの記入
4. Open Questionsの精査
5. Tasksの初期化
6. issync pushで同期

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**before-planステート**で使用されます：
- GitHub Issueが作成され、`issync init --template` が完了している状態
- plan.mdの初期作成を行い、タスクの目的・コンテキスト・受け入れ基準を定義
- **コードベース調査を先に実施**することで、Open Questionsを真に不明な点（アーキテクチャ選択・仕様の曖昧性）のみに絞る

## 前提条件の確認

実行前に以下を確認してください：
- [ ] GitHub Issueが作成されている
- [ ] `issync init --template` が完了し、plan.mdが存在する
- [ ] issync watch modeが起動している（推奨）

## 実行ステップ

### ステップ1: GitHub Issue内容の確認

GitHub Issueの内容を読み、以下を理解してください：
- タスクの要求・目的
- 解決すべき問題
- 期待される成果物

**質問**: 不明点があれば、このステップでユーザーに確認してください。

---

### ステップ2: コードベース調査（CRITICAL）

⚠️ **最重要ステップ**: Open Questionsを記載する前に、必ず以下を調査してください。

#### 調査チェックリスト

以下の項目を調査し、発見した内容を**Discoveries & Insights**セクションに記録：

- [ ] **類似機能・既存の実装パターン**: 同様の機能がすでに実装されているか？
- [ ] **使用している技術スタック・ライブラリ**: 関連する技術やライブラリは何か？
- [ ] **テストコードの存在と構造**: テストはどのように書かれているか？
- [ ] **関連ファイル・モジュール**: どのファイルを修正する必要があるか？
- [ ] **ドキュメント**: README、CLAUDE.md、既存のplan.md等に記載されている情報は？

#### 調査方法の例

```
# ファイル検索
Glob: **/*[関連するキーワード]*.ts

# コード検索
Grep: "関連する関数名やクラス名"

# ドキュメント確認
Read: README.md, CLAUDE.md, docs/
```

#### Discoveries & Insightsへの記録

調査で発見した内容を以下の形式でDiscoveries & Insightsセクションに記録：

```markdown
**YYYY-MM-DD: [タスク名]のコードベース調査**

- **発見**: [発見した技術的事実]
- **学び**: [この発見が実装にどう影響するか]
- **影響**: [Work PlanやOpen Questionsへの影響]
```

---

### ステップ3: plan.md基本セクションの記入

以下のセクションを記入してください：

#### 3.1 Purpose / Overview

```markdown
## Purpose / Overview

[Issueの要求を踏まえて、タスクの目的を1-2段落で記述]

**コアバリュー:**
- [コアバリュー1: 具体的な価値]
- [コアバリュー2: 具体的な価値]
- [コアバリュー3: 具体的な価値]
```

#### 3.2 Context & Direction

```markdown
## Context & Direction

**問題のコンテキスト:**
[なぜこのタスクが必要か？現状の課題は何か？]

**設計哲学:**
- [設計方針1]
- [設計方針2]
```

#### 3.3 Validation & Acceptance Criteria

```markdown
## Validation & Acceptance Criteria

**受け入れ基準:**
- [テスト可能な受け入れ基準1]
- [テスト可能な受け入れ基準2]
- [テスト可能な受け入れ基準3]

**テスト方針:**
- [テスト戦略（単体/統合/E2E）]
```

#### 3.4 Work Plan

```markdown
## Work Plan

### Phase 1: [初期フェーズ名]

**ゴール:** [Phase 1のゴール]

**実装する機能:**
1. [機能1]
2. [機能2]
3. [機能3]

**スコープ外 (Phase 2 以降):**
- [Phase 1では実装しない項目]

### Phase 2: TBD（POC後に決定）

**注**: Phase 2以降の詳細はPOC完了後、before-architecture-decisionステートで具体化します。
```

---

### ステップ4: Open Questionsの精査

コードベース調査の結果を踏まえ、**コードで確認できないもののみ**をOpen Questionsに記載。

#### Open Questions記載基準

✅ **記載すべき**:
- アーキテクチャ上の選択肢（複数の実装方法がある場合）
- 仕様の曖昧性（Issueの記述だけでは判断できない）
- 外部システムとの連携方法
- パフォーマンス・スケーラビリティの考慮事項

❌ **記載すべきでない**:
- コードを読めばわかる実装詳細
- ドキュメントに記載されている情報
- 簡単な調査で解決できる技術的疑問

**⚠️ 目標**: Open Questionsは5-10項目程度に絞ってください。

#### 記載フォーマット

```markdown
## Open Questions / 残論点

**Q1: [質問のタイトル]**

- [質問の詳細]
- [検討すべき選択肢（あれば）]

**Q2: [質問のタイトル]**

- [質問の詳細]
```

---

### ステップ5: Tasksの初期化

Work Plan Phase 1に基づいて、Tasksセクションを初期化：

```markdown
## Tasks

**Phase 1:**
- [ ] [タスク1: 具体的な実装項目]
- [ ] [タスク2: 具体的な実装項目]
- [ ] [タスク3: 具体的な実装項目]

**Phase 2 (未着手):**
- TBD（POC後に決定）
```

---

### ステップ6: issync pushで同期

**注意**: issyncのwatchモードが起動している場合は、ファイルの変更が自動的にGitHub Issueに同期されます。明示的なpushコマンドは不要です。

watchモードが起動していない場合は、以下を実行：

```bash
issync push
```

---

## 出力フォーマット

全ステップ完了後、以下の形式でサマリーを提供：

```markdown
## /plan 実行結果

### 完了したステップ
- ✅ ステップ1: GitHub Issue内容確認
- ✅ ステップ2: コードベース調査（[X]項目を調査、Discoveries & Insightsに記録）
- ✅ ステップ3: plan.md基本セクション記入（Purpose/Overview、Context、Acceptance Criteria、Work Plan Phase 1）
- ✅ ステップ4: Open Questions精査（[Y]項目に絞り込み）
- ✅ ステップ5: Tasks初期化（Phase 1: [Z]項目）
- ✅ ステップ6: issync push完了（watchモードで自動同期）

### 次のアクション
- [ ] plan.mdの内容をレビューしてください
- [ ] Open Questionsが適切に絞り込まれているか確認してください
- [ ] 準備が整ったら、Statusを `before-poc` に変更してください
```

---

## 重要な注意事項

### コードベース調査について

- **ステップ2を省略しないでください**: コードベース調査を行わずにOpen Questionsを記載すると、大量の不要な質問が生成されます
- **Discoveries & Insightsへの記録は必須**: 調査結果を必ず記録してください。これは後のフェーズで参照されます

### Open Questionsについて

- **記載基準を厳格に守ってください**: コードで確認可能な情報は記載しない
- **5-10項目に絞り込んでください**: 大量のOpen Questionsは管理不能になります

### セクションの構造について

- **既存のフォーマットと構造を保持**してください
- **タイムスタンプには今日の日付を使用**してください（YYYY-MM-DD形式）

### エラーハンドリング

- 問題が発生した場合（例: plan.mdが存在しない、issync未初期化）、**明確に報告**してガイダンスを求めてください

---

## 実行例

**ユーザー:** `/plan`

**アシスタント:** "before-planフェーズの実行をサポートします。まず、前提条件を確認します。

[plan.mdが存在するか確認]
[GitHub Issueを読んで内容を理解]

それでは、ステップ2のコードベース調査から始めます。

[Glob/Grepツールで類似機能を検索]
[README.md、CLAUDE.mdを読んで技術スタックを確認]
[既存のテストコードを確認]

調査結果をDiscoveries & Insightsに記録しました：
- 発見1: [...]
- 発見2: [...]

次に、基本セクションを記入します...

[Purpose/Overview、Context & Direction、Acceptance Criteria、Work Plan Phase 1を記入]

Open Questionsを精査します。コードベース調査の結果、以下の3つの質問のみが真に不明な点です：
- Q1: [...]
- Q2: [...]
- Q3: [...]

Tasksを初期化しました（Phase 1: 5項目）。

watchモードが起動しているため、自動的にGitHub Issueに同期されます。

[サマリー出力]"

---

## 補足: ステートマシンとの統合

このコマンド実行後の流れ：

```
before-plan (このコマンド実行)
   ↓
plan.md完成、issync push完了
   ↓
人間がplan.mdをレビュー
   ↓
Statusを before-poc に変更
   ↓
Devin起動、POC実装開始
```

**重要**: before-plan完了後、必ず人間がplan.mdの内容をレビューし、承認してからStatusを変更してください。
