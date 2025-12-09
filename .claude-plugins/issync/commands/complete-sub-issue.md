---
description: サブissue完了時に親issueの進捗ドキュメントを自動更新。PRから学びを抽出し振り返りを生成・加筆、Open Questionsを解決、Follow-up Issuesを4分類処理、矛盾を検出・解消。完了後はissync removeで同期設定を自動削除
---

# /complete-sub-issue: サブissue完了オペレーション

サブissue完了時に親issueの進捗ドキュメントを自動更新。詳細は「実行ステップ」参照。

## 使用方法

```bash
/complete-sub-issue <サブissue URL>
# 例: /complete-sub-issue https://github.com/MH4GF/issync/issues/456
```

**引数**:
- `サブissue URL` (必須): 完了したサブissueのGitHub URL

## 前提条件

- `ISSYNC_GITHUB_TOKEN`環境変数が設定されている
- `gh` CLIがインストール済み

**運用フロー**: `create-sub-issue` → 開発 → `complete-sub-issue` → Critical着手 → 次のサブissue作成

## 実行ステップ

### ステップ1: サブissue情報をフェッチと親issue番号の取得

GitHub Sub-issues API (`gh api /repos/{owner}/{repo}/issues/{issue_number}/parent`) で親issue番号を取得。API失敗時はissue bodyから抽出。無効URL/親issue不在時はエラー表示。

### ステップ2: サブissueの進捗ドキュメントを読み込み

`issync status <サブissue URL>`でローカルファイルパスを取得。**未登録エラー時は即座に`issync init <サブissue URL>`実行**（確認不要）。以下を抽出:
- **Validation & Acceptance Criteria**: 受け入れ条件と検証コマンド
- **Outcomes & Retrospectives**: 実装内容、発見や学び
- **Open Questions**: 未解決の論点
- **Follow-up Issues**: 将来対応事項

### ステップ2.5: 受け入れ条件の検証

進捗ドキュメントの「Validation & Acceptance Criteria」から検証コマンドを抽出し実行。

**判定**: exit code 0 = 成功、非0 = 失敗

| 結果 | 処理 |
|------|------|
| 全件成功 | 次のステップへ |
| 1件以上失敗 | 失敗AC一覧をユーザーに報告し、継続するか確認 |
| 検証コマンド未定義 | 警告表示、処理継続 |

### ステップ3: コード変更の取得と深い分析

**情報源優先順位**: PR情報 → コミット情報 → ユーザーに確認

#### 3.1 関連PRまたはコミットを特定

```bash
# PRの自動取得（Timeline Events APIから）
gh api repos/{owner}/{repo}/issues/{issue_number}/timeline \
  --jq '.[] | select(.event == "cross-referenced" and .source.issue.pull_request)'
```
複数ある場合は最新のマージ済みPRを優先。PRが見つからない場合はコミットSHAを使用。

#### 3.2 コード変更の分析

```bash
# PRがある場合
gh pr view <PR URL> --json title,body,commits,reviews,comments
gh pr diff <PR URL>

# コミットのみの場合
git show <commit_sha>
```

#### 3.3 学びの抽出

修正コミット、CI失敗、レビュー指摘から改善機会を推論（型エラー→型定義強化、Lint違反→ルール明文化、テスト失敗→カバレッジ拡充など）

#### 3.4 振り返り本文の処理

以下の構造で生成または加筆:
- 実装内容（事実ベース）
- 改善の機会と気づき
- 5 Whys分析
- 改善策（Lint/型/テスト/ドキュメント）
- 技術的な発見や学び

#### 3.5 Follow-up Issuesの抽出

PR/コミットから未対応事項を抽出し、優先度を自動分類（詳細はステップ7参照）。

### ステップ4: サブissueのOpen Questions処理

既存情報（Decision Log、PR実装、振り返り）から可能な限り解決。`/issync:resolve-questions`で自動解決し、未解決はFollow-up Issuesへ移行。

**処理原則**: 保守的に推論（False positive回避）、部分的な解決も記録

### ステップ5: 親issueの進捗ドキュメントを特定

`issync status <親issue URL>`でローカルファイルパスを取得。**未登録エラー時は即座に`issync init <親issue URL>`実行**（確認不要）。

### ステップ6: 親issueのOutcomes & Retrospectivesを更新

```markdown
**サブタスク完了 (YYYY-MM-DD): [サブissueタイトル] (#[番号])**
- [実装内容サマリー]
- [主な発見や学び（あれば）]
```

### ステップ6.5: 親issueのOpen Questions解決チェック

サブissueの情報から親issueのOpen Questionsを解決できるか推論し、`/issync:resolve-questions`で自動解決。回答には出典を明記（例: `サブissue #[番号]で解決`）。

**処理原則**: 保守的に推論（False positive回避）、部分的な解決も記録

### ステップ7: Follow-up Issuesの4分類処理

| 分類 | 処理 | キーワード例 |
|------|------|-------------|
| **Critical Improvements** | 即座に`/issync:create-sub-issue`実行 | lint追加、型定義強化、CI改善 |
| **Project Improvements** | 提案（完了サマリーで提示） | CLAUDE.md、テンプレート |
| **Open Questions** | 親issueのOpen Questionsに追加 | 検討、調査、トレードオフ |
| **Feature Enhancements** | 提案（自動作成なし） | 機能追加、スコープ外 |

**重要**: Critical Improvementsは自動作成。親issueのFollow-up Issuesへの転記は禁止。

### ステップ8: サブissueをclose

openの場合のみ実行。コメントにPR/コミット情報を含める。

### ステップ9: issync remove実行

`issync remove --issue <サブissue URL>`で同期設定を削除。失敗時も処理継続。

### ステップ10: GitHub Projects Status変更

サブissueのStatusを"Done"に更新:

```bash
issync projects set-status "$SUB_ISSUE_URL" "done"
```

環境変数未設定時は警告メッセージが出力されるが、処理は継続される。

### ステップ11: 親issue進捗ドキュメントの矛盾検出と解消

**検出対象**: Decision Logの矛盾、Work PlanとTasksの不一致、Open QuestionsとDecision Logの重複、サブissue追加による新たな矛盾

**処理**:
- 自動解消: Open Questions重複→削除、完了Phaseタスク→削除
- 手動確認: Open Questionsに追加

**処理原則**: 保守的に実行、矛盾解消履歴をDecision Logに記録

### ステップ12: GitHub Issueへの同期

`issync push`で親issueの変更を同期。

### ステップ13-14: 完了通知と親issueコメント

出力フォーマットに従いサマリーを出力し、同内容を親issueにコメント投稿。コメント投稿失敗時は警告のみ（処理継続）。

## 出力フォーマット

```markdown
## /issync:complete-sub-issue 実行結果

### 完了したサブissue
- #[サブissue番号]: [サブissueタイトル] / 親: #[親issue番号]

### 更新内容
- ✅ 受け入れ条件: [X]件成功/[Y]件失敗/[Z]件スキップ
- ✅ コード変更: [PR/コミット]分析、改善機会[X]件検出
- ✅ 振り返り: 5 Whys分析完了、Follow-up Issues[Y]件抽出
- ✅ Open Questions: サブissue[X]件解決/[Y]件移行、親issue[Z]件解決/[W]件追加
- ✅ 親issue更新: Outcomes & Retrospectives追加
- ✅ 後処理: close[✅/⚠️]、remove[✅/⚠️]、Projects[✅/⚠️]
- ✅ 矛盾検出: [自動解消X件/要確認Y件/なし]
- ✅ 同期: issync push完了

### 🎯 Critical (自動作成済み)
- #[番号]: [Critical] [タスク名]

### 💡 Recommended / 📋 Feature Enhancements
- [タスク名] → `/issync:create-sub-issue "[タスク名]"`

### 次のアクション
1. 🎯 Critical着手 → 2. 💡 Recommended検討 → 3. 親issue確認 → 4. Feature検討
```

## 実行例

```bash
/issync:complete-sub-issue https://github.com/MH4GF/issync/issues/124
```
