---
description: before-planフェーズのプロセスを標準化し、コードベース調査を強制することで高品質なplan.md作成を実現
---

# /plan: before-plan実行ワークフロー

あなたはユーザーの `.issync/docs/plan-{番号}-{slug}.md` ファイルを初期作成するサポートをしています。このコマンドは以下の6ステップのワークフローを自動化します：
1. 前提条件確認 & ファイル名決定 & 必要なら issync init 実行
2. GitHub Issue内容の確認
3. コードベース調査（CRITICAL）
4. plan-{番号}-{slug}.md 基本セクションの記入
5. Open Questionsの精査とTasksの初期化
6. issync pushで同期

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**before-planステート**で使用されます：
- GitHub Issueが作成されている状態から開始
- Issue URLから番号を抽出し、Issueタイトルからslugを生成して `.issync/docs/plan-{番号}-{slug}.md` ファイルを作成
- slugは内容を表す短い英語名（小文字、ハイフン区切り、例: `watch-daemon`, `multi-sync-support`）
- issync未初期化の場合は自動的に `issync init <issue-url> --file .issync/docs/plan-{番号}-{slug}.md` を実行
- plan-{番号}-{slug}.md の初期作成を行い、タスクの目的・コンテキスト・受け入れ基準を定義
- **コードベース調査を先に実施**することで、Open Questionsを真に不明な点（アーキテクチャ選択・仕様の曖昧性）のみに絞る

## 前提条件

実行前に必要なのは以下のみです：
- [ ] GitHub Issueが作成されている
- [ ] `GITHUB_TOKEN` 環境変数が設定されている（`export GITHUB_TOKEN=$(gh auth token)`）

**注**: issync未初期化やplan-{番号}-{slug}.md不存在の場合は、このワークフロー内で自動的に対処します

## 実行ステップ

### ステップ1: 前提条件確認 & ファイル名決定 & issync init（必要な場合）

まず、現在の状態とGitHub Issue URLを確認してください。

#### 1.1 GitHub Issue URL の確認とファイル名決定

ユーザーにGitHub Issue URLを確認してください：

```
GitHub Issue URLを教えてください（例: https://github.com/owner/repo/issues/123）
```

Issue URLから番号を抽出し、Issueタイトルを取得してslugを生成します：

**ファイル名決定プロセス**:
1. GitHub Issue URLから番号を抽出（例: `/issues/123` → `123`）
2. GitHub Issueのタイトルを読み取る
3. タイトルから内容を表すslugを生成（AIが提案）
   - 小文字、ハイフン区切り
   - 英数字のみ
   - 簡潔で内容を表現（2-4単語程度）
4. ユーザーに提案し、承認または修正してもらう

**slug生成例**:
- Issue: "Implement watch daemon mode" → slug: `watch-daemon`
- Issue: "Add multi-sync support" → slug: `multi-sync-support`
- Issue: "Fix optimistic lock error" → slug: `fix-optimistic-lock`

**最終ファイル名**: `.issync/docs/plan-{番号}-{slug}.md`

#### 1.2 .issync/state.yml の確認

```bash
# .issync/state.yml が存在するか確認
ls .issync/state.yml
```

#### 1.3 issync未初期化の場合

`.issync/state.yml` が存在しない場合、以下を実行：

```bash
issync init <GitHub Issue URL> --file .issync/docs/plan-{番号}-{slug}.md
```

**例**:
```bash
issync init https://github.com/owner/repo/issues/123 --file .issync/docs/plan-123-watch-daemon.md
```

**注**: `--template` オプションは不要です（デフォルトテンプレートを使用）

#### 1.4 plan-{番号}-{slug}.md 不存在の場合

`.issync/state.yml` は存在するが `plan-{番号}-{slug}.md` が存在しない場合：

**新規sync追加の場合**:
```bash
issync init <GitHub Issue URL> --file .issync/docs/plan-{番号}-{slug}.md
```

**既存Issue commentから取得の場合**:
```bash
issync pull --issue <GitHub Issue URL>
```

#### 1.5 すべて準備完了の場合

`.issync/state.yml` と `.issync/docs/plan-{番号}-{slug}.md` が両方存在する場合、ステップ2に進みます。

---

### ステップ2: GitHub Issue内容の確認

GitHub Issueの内容を読み、以下を理解してください：
- タスクの要求・目的
- 解決すべき問題
- 期待される成果物

**質問**: 不明点があれば、このステップでユーザーに確認してください。

---

### ステップ3: コードベース調査（CRITICAL）

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

### ステップ4: plan.md基本セクションの記入

以下のセクションを記入してください：

#### 4.1 Purpose / Overview

```markdown
## Purpose / Overview

[Issueの要求を踏まえて、タスクの目的を1-2段落で記述]

**コアバリュー:**
- [コアバリュー1: 具体的な価値]
- [コアバリュー2: 具体的な価値]
- [コアバリュー3: 具体的な価値]
```

#### 4.2 Context & Direction

```markdown
## Context & Direction

**問題のコンテキスト:**
[なぜこのタスクが必要か？現状の課題は何か？]

**設計哲学:**
- [設計方針1]
- [設計方針2]
```

#### 4.3 Validation & Acceptance Criteria

```markdown
## Validation & Acceptance Criteria

**受け入れ基準:**
- [テスト可能な受け入れ基準1]
- [テスト可能な受け入れ基準2]
- [テスト可能な受け入れ基準3]

**テスト方針:**
- [テスト戦略（単体/統合/E2E）]
```

---

### ステップ5: Open Questionsの精査とTasksの初期化

#### 5.1 Open Questionsの精査

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

#### 5.2 Tasksの初期化

Tasksセクションを初期化し、Phase 1のゴール・タスク・スコープ外を記載：

```markdown
## Tasks

### Phase 1: [初期フェーズ名]

**ゴール:** [Phase 1のゴール]

**タスク:**
- [ ] [具体的なタスク1]
- [ ] [具体的なタスク2]
- [ ] [具体的なタスク3]

**スコープ外（Phase 2以降）:**
- [後回しにする項目1]
- [後回しにする項目2]

### Phase 2: [フェーズ名]（未着手）

TBD（POC後に決定）

### Phase 3: [フェーズ名]（未着手）

TBD（POC後に決定）
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
- ✅ ステップ1: 前提条件確認 & ファイル名決定 & issync init（ファイル: `.issync/docs/plan-{番号}-{slug}.md`）
- ✅ ステップ2: GitHub Issue内容確認
- ✅ ステップ3: コードベース調査（[X]項目を調査、Discoveries & Insightsに記録）
- ✅ ステップ4: plan-{番号}-{slug}.md基本セクション記入（Purpose/Overview、Context、Acceptance Criteria）
- ✅ ステップ5: Open Questions精査とTasks初期化（Open Questions: [Y]項目、Tasks: Phase 1に[Z]項目）
- ✅ ステップ6: issync push完了（watchモードで自動同期）

### 作成されたファイル
- ファイルパス: `.issync/docs/plan-{番号}-{slug}.md`
- Issue番号: {番号}
- Slug: {slug}

### 次のアクション
- [ ] `.issync/docs/plan-{番号}-{slug}.md` の内容をレビューしてください
- [ ] Open Questionsが適切に絞り込まれているか確認してください
- [ ] 準備が整ったら、Statusを `before-poc` に変更してください
```

---

## 重要な注意事項

### ファイル命名規則

- **必ず `.issync/docs/plan-{番号}-{slug}.md` 形式**を使用してください
- Issue番号はGitHub Issue URLから抽出（例: `/issues/123` → `123`）
- slugはIssueタイトルから生成した内容を表す短い英語名
  - 小文字、ハイフン区切り
  - 英数字のみ
  - 簡潔で内容を表現（2-4単語程度）
  - 例: `watch-daemon`, `multi-sync-support`, `fix-optimistic-lock`
- 複数Issueを管理する場合、それぞれ独立したファイルとして作成
- ファイル名から内容が読み取れるようにする（可読性重視）

### コードベース調査について

- **ステップ3を省略しないでください**: コードベース調査を行わずにOpen Questionsを記載すると、大量の不要な質問が生成されます
- **Discoveries & Insightsへの記録は必須**: 調査結果を必ず記録してください。これは後のフェーズで参照されます

### Open Questionsについて

- **記載基準を厳格に守ってください**: コードで確認可能な情報は記載しない
- **5-10項目に絞り込んでください**: 大量のOpen Questionsは管理不能になります

### セクションの構造について

- **既存のフォーマットと構造を保持**してください
- **タイムスタンプには今日の日付を使用**してください（YYYY-MM-DD形式）

### エラーハンドリング

- GitHub Issue URLが不明な場合、ユーザーに確認してください
- `issync init` 実行時にエラーが発生した場合、エラー内容を明確に報告してください
- その他の問題が発生した場合も、**明確に報告**してガイダンスを求めてください

---

## 実行例

**ユーザー:** `/plan`

**アシスタント:** "before-planフェーズの実行をサポートします。

### ステップ1: 前提条件確認とファイル名決定

GitHub Issue URLを教えてください（例: https://github.com/owner/repo/issues/123）

**ユーザー:** `https://github.com/owner/repo/issues/123`

**アシスタント:**
Issue番号: 123

[GitHub Issueのタイトルを読み取る]
Issueタイトル: "Implement watch daemon mode"

タイトルから以下のslugを提案します：
- **提案**: `watch-daemon`
- 理由: タイトルの主要なキーワード "watch" と "daemon" を使用

このファイル名で問題ないですか？
- `.issync/docs/plan-123-watch-daemon.md`

別のslugを希望する場合は教えてください。

**ユーザー:** `問題ないです`

**アシスタント:**
ファイル名を決定しました: `.issync/docs/plan-123-watch-daemon.md`

[.issync/state.yml の存在を確認]
→ 存在しないため、issync init を実行します。

```bash
issync init https://github.com/owner/repo/issues/123 --file .issync/docs/plan-123-watch-daemon.md
```

[issync init実行完了、.issync/docs/plan-123-watch-daemon.md が作成されました]

### ステップ2: GitHub Issue内容確認

[GitHub Issueを読んで内容を理解]

タスクの目的: [...]
解決すべき問題: [...]

### ステップ3: コードベース調査

[Glob/Grepツールで類似機能を検索]
[README.md、CLAUDE.mdを読んで技術スタックを確認]
[既存のテストコードを確認]

調査結果をDiscoveries & Insightsに記録しました：
- 発見1: [...]
- 発見2: [...]

### ステップ4: 基本セクション記入

[Purpose/Overview、Context & Direction、Acceptance Criteriaを記入]

### ステップ5: Open Questions精査とTasks初期化

Open Questionsを精査します。コードベース調査の結果、以下の3つの質問のみが真に不明な点です：
- Q1: [...]
- Q2: [...]
- Q3: [...]

Tasksを初期化しました：
- Phase 1のゴール: [...]
- Phase 1のタスク: 5項目
- スコープ外: 2項目

### ステップ6: 同期

watchモードが起動しているため、自動的にGitHub Issueに同期されます。

[サマリー出力]"

---

## 補足: ステートマシンとの統合

このコマンド実行後の流れ：

```
GitHub Issue作成
   ↓
/plan コマンド実行 (このコマンド)
   ├─ GitHub Issue URL確認
   ├─ Issue番号抽出 & タイトル読み取り
   ├─ slug生成 & ユーザー確認
   ├─ issync init <issue-url> --file .issync/docs/plan-{番号}-{slug}.md（未初期化の場合）
   ├─ コードベース調査
   ├─ plan-{番号}-{slug}.md記入
   └─ issync push（自動同期）
   ↓
plan-{番号}-{slug}.md完成、before-plan完了
   ↓
人間がplan-{番号}-{slug}.mdをレビュー
   ↓
Statusを before-poc に変更
   ↓
Devin起動、POC実装開始
```

**重要**: before-plan完了後、必ず人間がplan-{番号}-{slug}.mdの内容をレビューし、承認してからStatusを変更してください。

**ファイル配置**:
- すべてのplan.mdファイルは `.issync/docs/` ディレクトリに配置
- ファイル名は `plan-{番号}-{slug}.md` 形式（例: `plan-123-watch-daemon.md`）
- 複数のIssueを同時管理する場合、それぞれ独立したファイルとして管理
- slugによりファイル名から内容が把握可能
