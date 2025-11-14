---
description: planフェーズのプロセスを標準化し、コードベース調査を強制することで高品質な進捗ドキュメント作成を実現
---

# /issync:plan: plan実行ワークフロー

進捗ドキュメント（`.issync/docs/plan-{番号}-{slug}.md`）を初期作成するコマンドです。以下の7ステップを自動化します：

1. 前提条件確認 & ファイル名決定 & issync init実行 & Stage設定（In Progress）
2. GitHub Issue内容の確認
3. コードベース調査（CRITICAL）
4. 基本セクションの記入
5. Open Questionsの精査
6. issync pushで同期 & Stage更新（To Review）
7. GitHub Projects Status & Stage自動変更（plan → poc, Stage → To Start）

**Note**: Template v7では、Tasksセクションが削除されています。タスクは `/issync:create-sub-issue` コマンドで作成します。

## コンテキスト

- **対象ステート**: plan（矛盾解消駆動開発ワークフロー）
- **ファイル命名**: `.issync/docs/plan-{番号}-{slug}.md`
  - 番号: Issue URLから抽出（例: `/issues/123` → `123`）
  - slug: Issueタイトルから生成（小文字・ハイフン区切り・2-4単語、例: `watch-daemon`）
- **コードベース調査優先**: Open Questionsを真に不明な点のみに絞るため、調査を先に実施

## 前提条件

- GitHub Issueが作成されている
- `ISSYNC_GITHUB_TOKEN` 環境変数が設定されている

## 実行ステップ

### ステップ1: 前提条件確認 & ファイル名決定 & issync init & Stage設定

**ファイル名決定**:
1. Issue URLを確認（例: `https://github.com/owner/repo/issues/123`）
2. 番号とslugを抽出・生成

**初期化**:
- **ケース A**: issync未初期化 → `issync init <Issue URL> --file .issync/docs/plan-{番号}-{slug}.md`
- **ケース B**: 進捗ドキュメント不存在 → 新規sync追加または `issync pull --issue <Issue URL>`
- **ケース C**: 準備完了 → 次へ

**Stage設定（AI作業開始）**:

`!env ISSYNC_GITHUB_PROJECTS_NUMBER`が設定されている場合のみ、`gh project item-edit`でStage→`In Progress`に設定。失敗時も作業継続（警告のみ）。

環境変数:
- `ISSYNC_GITHUB_PROJECTS_NUMBER`: プロジェクト番号（例: `1`）
- `ISSYNC_GITHUB_PROJECTS_OWNER_TYPE`: `user` または `org`（デフォルト: `user`）

**Stage 設定コマンド**（環境変数設定時のみ実行）:

```bash
# GitHub Projects ヘルパースクリプトを使用
bash ${CLAUDE_PLUGIN_ROOT}/scripts/github-projects.sh set-stage $ISSUE_NUMBER "in progress"
```

**エラーハンドリング**:
- スクリプトは自動的にエラーハンドリングを行います
- 環境変数未設定: 警告を表示して処理を継続（GitHub Projects 連携をスキップ）
- 認証スコープ不足: `gh auth refresh -s project` を実行して再試行
- プロジェクトが見つからない: 警告を表示して処理を継続

### ステップ2: GitHub Issue内容の確認

Issue内容を理解し、不明点があればユーザーに確認

### ステップ3: コードベース調査（CRITICAL）

⚠️ **最重要**: Open Questions記載前に必ず調査してください。

**調査項目**:
- 類似機能・既存の実装パターン
- 使用している技術スタック・ライブラリ
- テストコードの存在と構造
  - **プロジェクトのテスト戦略を理解する**:
    - 使用しているテストフレームワーク（単体テスト、統合テスト、E2E）
    - 既存のテストパターン（ファイル配置、命名規則、カバレッジ）
    - UIコンポーネントの検証方法（Storybook等の有無）
- 関連ファイル・モジュール
- ドキュメント（README、CLAUDE.md、進捗ドキュメント等）

**調査方法** (状況に応じて選択):
```
ファイル・コード探索:
  Glob: **/*[関連するキーワード]*
  Grep: "関連する関数名やクラス名"
  Read: README.md, CLAUDE.md, docs/

設定ファイル確認:
  Read: package.json, pyproject.toml, Cargo.toml等

テストファイル確認:
  Glob: **/*.test.*, **/*.spec.*, **/*_test.*, test/**/*

実行による確認(必要に応じて):
  Bash: [テストコマンド/リントコマンド/ビルドコマンド等]
  ※ 実際のコマンドはプロジェクトの設定ファイルやREADMEから判断
```

**記録**: 発見内容をDiscoveries & Insightsセクションに記録

### ステップ4: 基本セクションの記入

テンプレートに従い、以下を記入：
- Purpose/Overview
- Context & Direction
- Validation & Acceptance Criteria
  - **重要**: ステップ3で調査したテスト戦略に基づき、テスト要件を含めること
    - ロジック変更 → 該当する単体テストフレームワークでのテスト要件
    - UI変更 → UIコンポーネント検証ツールでの検証要件
    - E2E要件 → エンドツーエンドテストでの検証要件

### ステップ5: Open Questionsの精査

**記載基準**:

| 記載すべき ✅ | 記載すべきでない ❌ |
|-------------|------------------|
| アーキテクチャ上の選択肢 | コードを読めばわかる実装詳細 |
| 仕様の曖昧性 | ドキュメント記載済みの情報 |
| 外部システム連携方法 | 簡単な調査で解決可能な疑問 |
| パフォーマンス考慮事項 | |

**目標**: 5-10項目に絞る

**推奨案の自信度**: 推奨案のみに付与（非推奨案は不要）

- 🟢 **自信度:高** - 既存パターン確認済み、実装実績あり
- 🟡 **自信度:中** - 類似パターンあり、慎重に実装
- 🔴 **自信度:低** - 新アプローチ/外部連携/性能影響不明 → **pocフェーズで検証必須**

**フォーマット例**:
```markdown
**Q1: [質問タイトル]**
- [質問の詳細]

**検討案:**
- **[選択肢A]（推奨 自信度:高🟢）**: [説明 + 推奨理由]
- **[選択肢B]**: [説明]
  - トレードオフ: [制約]

**Q2: [別の質問（自信度低の場合）]**
**検討案:**
- **[選択肢C]（推奨 自信度:低🔴）**: [説明]
  - **⚠️ PoC必須**: [検証項目]
```

### ステップ6: GitHub Issueへの同期 & Stage更新

**同期**:
進捗ドキュメントの変更をGitHub Issueに同期します。

```bash
issync push
```

**Stage更新（レビュー待ち）**:

`!env ISSYNC_GITHUB_PROJECTS_NUMBER`が設定されている場合のみ、`gh project item-edit`でStage→`To Review`に設定。失敗時も作業継続（警告のみ）。

```bash
# GitHub Projects ヘルパースクリプトを使用
bash ${CLAUDE_PLUGIN_ROOT}/scripts/github-projects.sh set-stage $ISSUE_NUMBER "to review"
```

### ステップ7: GitHub Projects Status & Stage自動変更

`!env ISSYNC_GITHUB_PROJECTS_NUMBER`が設定されている場合のみ、Status→`poc`、Stage→`To Start`に変更。GraphQL APIでProject ID取得後、`gh project item-edit`で両フィールドを更新。

環境変数に基づいてプロジェクトを特定:
- `ISSYNC_GITHUB_PROJECTS_NUMBER`: プロジェクト番号（例: `1`）
- `ISSYNC_GITHUB_PROJECTS_OWNER_TYPE`: `user` または `org`（デフォルト: `user`）

**Status & Stage 変更コマンド**:

```bash
# GitHub Projects ヘルパースクリプトを使用
bash ${CLAUDE_PLUGIN_ROOT}/scripts/github-projects.sh set-status $ISSUE_NUMBER "poc"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/github-projects.sh set-stage $ISSUE_NUMBER "to start"
```

**エラー時**: スクリプトが自動的にエラーハンドリングを行います。認証スコープ不足の場合は`gh auth refresh -s project`実行。失敗時はGitHub Projects UIで手動変更。環境変数の形式が不正、プロジェクトが見つからない、権限不足の場合は警告を表示して処理を継続。

## 出力フォーマット

全ステップ完了後、以下を表示：

```markdown
## /issync:plan 実行結果

### 完了したステップ
- ✅ ステップ1-7: 全ステップ完了

### 作成されたファイル
- ファイルパス: `.issync/docs/plan-{番号}-{slug}.md`
- Issue番号: {番号}
- Slug: {slug}

### GitHub Projects Status & Stage変更
- Status: `plan` → `poc` ✅
- Stage: `To Start` ✅ （人間がDevinに指示すべき）
- Project: {project_title} (#{project_number})

### 次のアクション
- [ ] 進捗ドキュメントの内容をレビュー
- [ ] Open Questionsが適切に絞り込まれているか確認
- [ ] POC実装を開始（Devin等のAIエージェント活用）
- [ ] architecture-decision後、必要に応じて `/issync:create-sub-issue` でタスク作成
```

## 重要な注意事項

- **コードベース調査**: ステップ3を省略しない（省略すると不要なOpen Questionsが大量発生）
- **Open Questions**: コードで確認可能な情報は記載しない、5-10項目に絞る

## 補足: ステートマシンとの統合

**ワークフロー**:
```
GitHub Issue作成（Status: plan, Stage: To Start）
   ↓
/plan実行開始 → Stage自動変更（To Start → In Progress）
   ↓
コードベース調査 → 進捗ドキュメント作成
   ↓
issync push → Stage自動変更（In Progress → To Review）
   ↓
Status & Stage自動変更（Status: plan → poc, Stage: To Review → To Start）
   ↓
人間レビュー → POC開始（Devin起動）
```

**重要**:
- `/issync:plan`コマンド完了時に自動的にStatusが`poc`、Stageが`To Start`に変更されます
- 人間による手動のStatus/Stage変更は不要です
- Stage変更により、人間が「何をすべきか」が明確になります（To Start = Devinに指示）
