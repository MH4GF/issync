---
description: planフェーズのプロセスを標準化し、コードベース調査を強制することで高品質なplan.md作成を実現
---

# /plan: plan実行ワークフロー

あなたはユーザーの `.issync/docs/plan-{番号}-{slug}.md` ファイルを初期作成するサポートをしています。このコマンドは以下の5ステップのワークフローを自動化します：
1. 前提条件確認 & ファイル名決定 & 必要なら issync init 実行
2. GitHub Issue内容の確認
3. コードベース調査（CRITICAL）
4. plan-{番号}-{slug}.md 基本セクションの記入
5. Open Questionsの精査
6. issync pushで同期

**Note**: Template v7では、Tasksセクションが削除されています。タスクは後で `/create-sub-issue` コマンドを使用してGitHub Sub-issuesとして作成します。

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**planステート**で使用されます：
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

#### ファイル名決定プロセス

ユーザーにGitHub Issue URLを確認：
```
GitHub Issue URLを教えてください（例: https://github.com/owner/repo/issues/123）
```

**命名規則**: `.issync/docs/plan-{番号}-{slug}.md`
- 番号: Issue URLから抽出（`/issues/123` → `123`）
- slug: Issueタイトルから生成（小文字・ハイフン区切り・2-4単語）
  - 例: "Implement watch daemon mode" → `watch-daemon`

#### 初期化フロー

状態を確認し、以下のいずれかを実行：

**ケース A: issync未初期化** (`.issync/state.yml` 不存在)
```bash
issync init <Issue URL> --file .issync/docs/plan-{番号}-{slug}.md
```

**ケース B: plan.md不存在** (state.yml存在、plan.md不存在)
- 新規sync追加: 上記`issync init`を実行
- 既存commentから取得: `issync pull --issue <Issue URL>`

**ケース C: すべて準備完了** → ステップ2へ

---

### ステップ2: GitHub Issue内容の確認

Issue内容を理解し、不明点があればユーザーに確認

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

調査で発見した内容をDiscoveries & Insightsセクションに記録。

**フォーマット**: テンプレートの「Discoveries & Insights」セクションを参照

---

### ステップ4: plan.md基本セクションの記入

テンプレートに従い、Purpose/Overview、Context & Direction、Validation & Acceptance Criteriaを記入

---

### ステップ5: Open Questionsの精査

コードベース調査の結果を踏まえ、**コードで確認できないもののみ**をOpen Questionsに記載。

#### Open Questions記載基準

| 記載すべき ✅ | 記載すべきでない ❌ |
|-------------|------------------|
| アーキテクチャ上の選択肢 | コードを読めばわかる実装詳細 |
| 仕様の曖昧性 | ドキュメント記載済みの情報 |
| 外部システム連携方法 | 簡単な調査で解決可能な疑問 |
| パフォーマンス考慮事項 | |

**⚠️ 目標**: 5-10項目に絞る

**フォーマット**: 「検討案」セクションを追加し、各選択肢に「（推奨）」マーカーでAIの初期仮説を明示

**例1: 基本形式**
```markdown
**Q1: [質問タイトル]**
- [質問の詳細]

**検討案:**
- **[選択肢A]（推奨）**: [説明 + 推奨理由]
- **[選択肢B]**: [説明]
```

**例2: トレードオフを含む場合**
```markdown
**Q2: [質問タイトル]**
- [質問の詳細]

**検討案:**
- **[選択肢A]（推奨）**: [説明]
  - トレードオフ: [制約や懸念点]
  - 理由: [なぜこれを推奨するか]
- **[選択肢B]**: [説明]
  - トレードオフ: [制約や懸念点]
```

**例3: 検討ポイントのみ**
```markdown
**Q3: [質問タイトル]**
- [質問の詳細]
- [考慮すべき点]

**検討案:**
- **[案]（推奨）**: [説明と理由]
  - 検討事項: [残る懸念点や確認が必要な点]
```

**Note**: Template v7では、Tasksセクションが削除されています。タスクは後で `/create-sub-issue` コマンドを使用してGitHub Sub-issuesとして作成します。

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
- ✅ ステップ5: Open Questions精査（Open Questions: [Y]項目）
- ✅ ステップ6: issync push完了（watchモードで自動同期）

### 作成されたファイル
- ファイルパス: `.issync/docs/plan-{番号}-{slug}.md`
- Issue番号: {番号}
- Slug: {slug}

### 次のアクション
- [ ] `.issync/docs/plan-{番号}-{slug}.md` の内容をレビューしてください
- [ ] Open Questionsが適切に絞り込まれているか確認してください
- [ ] 準備が整ったら、Statusを `poc` に変更してください
- [ ] アーキテクチャ決定後、必要に応じて `/create-sub-issue` コマンドでタスクをGitHub Sub-issuesとして作成してください
```

---

## 重要な注意事項

- **ファイル命名**: ステップ1の命名規則を厳守（詳細はステップ1参照）
- **コードベース調査**: ステップ3を省略しない（省略すると不要なOpen Questionsが大量発生）
- **Discoveries記録**: 調査結果は必ず記録（後フェーズで参照）
- **Open Questions**: コードで確認可能な情報は記載しない、5-10項目に絞る
- **日付形式**: YYYY-MM-DD形式を使用
- **エラー時**: 明確に報告し、ガイダンスを求める

---

## 実行例

Issue URL確認 → ファイル名決定 → issync init → コードベース調査 → 基本セクション記入 → Open Questions精査 → 同期完了

Note: Template v7ではTasksセクションが削除されています。アーキテクチャ決定後、`/create-sub-issue`でタスクをGitHub Sub-issuesとして作成

---

## 補足: ステートマシンとの統合

**ワークフロー**:
```
GitHub Issue作成
   ↓
/plan実行 → コードベース調査 → plan-{番号}-{slug}.md作成
   ↓
人間レビュー → Statusをpocに変更 → Devin起動
```

**重要**: plan完了後、人間レビューと承認後にStatusを変更

**ファイル配置**: `.issync/docs/plan-{番号}-{slug}.md` 形式で管理
