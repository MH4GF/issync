---
description: サブissue完了時に親issueの進捗ドキュメントを自動更新。PRから学びを抽出し振り返りを生成・加筆、Open Questionsを解決（/resolve-questions実行）、Follow-up Issuesセクションを4分類で処理（Critical自動作成、Improvement提案、Open Questions追加、Feature Enhancements提案）、進捗ドキュメント全体の矛盾を検出・解消。完了サマリーを親issueにコメント投稿。完了後はissync removeで同期設定を自動削除
---

# /complete-sub-issue: サブissue完了オペレーション

サブissue完了時に親issueの進捗ドキュメントを自動更新します。PRから学びを抽出し、振り返りを生成・加筆、**Open Questionsを解決**（既存情報から最大限解決）、Follow-up Issuesを優先度付きで4分類処理し、**進捗ドキュメント全体の矛盾を検出・解消**します。完了サマリーを親issueにコメント投稿します。詳細は「実行ステップ」参照。

## 使用方法

```bash
/complete-sub-issue <サブissue URL>
# 例: /complete-sub-issue https://github.com/MH4GF/issync/issues/456
```

**引数**:
- `サブissue URL` (必須): 完了したサブissueのGitHub URL

## コンテキスト

「矛盾解消駆動開発」ワークフローの横断的オペレーション。`retrospective`ステート（完了時）に実行し、PRから学びを抽出して親issueに反映、プロジェクト全体の継続的改善を促進します。

**運用フロー**:
1. `/issync:create-sub-issue`でサブissue作成
2. サブissueで開発（plan → implementation → retrospective）
3. `/issync:complete-sub-issue`で親issueに自動反映＆close（PR分析、5 Whys分析、**Open Questions解決**、Follow-up Issues 4分類処理、**矛盾検出と解消**）
4. Critical Improvements（品質向上）に即座着手
5. 必要に応じてProject Improvements/Feature Enhancementsで次のサブissue作成

## 前提条件

- `ISSYNC_GITHUB_TOKEN`環境変数が設定されている
- `gh` CLIがインストール済み
- 未初期化issueは自動初期化（詳細は「エラーハンドリング」参照）

## 実行ステップ

### ステップ1: サブissue情報をフェッチと親issue番号の取得

GitHub Sub-issues API (`gh api /repos/{owner}/{repo}/issues/{issue_number}/parent`) で親issue番号を取得。API失敗時はissue bodyから抽出。無効URL/親issue不在時はエラー表示。

### ステップ2: サブissueの進捗ドキュメントを読み込み

`issync list`で登録状況を確認。以下を抽出（エラーハンドリングは「エラーハンドリング」セクション参照）:
- **Outcomes & Retrospectives**: 実装内容、発見や学び
- **Open Questions**: 未解決の論点
- **Follow-up Issues**: 将来対応事項

### ステップ3: PRの自動取得と深い分析（常に実行）

1. **関連PRを自動取得**
   ```bash
   gh api repos/{owner}/{repo}/issues/{issue_number}/timeline \
     --jq '.[] | select(.event == "cross-referenced" and .source.issue.pull_request) |
          {pr_url: .source.issue.html_url, pr_number: .source.issue.number,
           pr_state: .source.issue.state, merged_at: .source.issue.pull_request.merged_at}'
   ```
   - Timeline Events APIの`cross-referenced`イベントから`pull_request`を持つものを抽出
   - 複数ある場合は最新のマージ済みPRを優先（`merged_at`でソート）
   - 取得できない場合のみユーザーに確認:
     ```
     このサブissueに関連するPRのURLを教えてください
     ```

2. **PRの基本情報を分析**
   ```bash
   gh pr view <PR URL> --json title,body,commits,reviews,comments
   gh pr diff <PR URL>
   gh api repos/{owner}/{repo}/pulls/{pr_number}/comments  # インラインコメント＋リプライスレッド取得
   ```

3. **開発プロセスからの学びを抽出**

   ```bash
   # 修正コミット検出
   gh api repos/{owner}/{repo}/pulls/{pr_number}/commits \
     --jq '.[] | select(.commit.message | test("fix|revert|修正|バグ|typo"; "i"))'

   # CI実行履歴取得
   gh api repos/{owner}/{repo}/commits/{sha}/check-runs \
     --jq '.check_runs[] | select(.conclusion == "failure")'

   # レビュー指摘取得
   gh pr view {pr_number} --json reviews \
     --jq '.reviews[] | select(.body | test("間違い|バグ|問題|修正|直す|改善"; "i"))'
   ```

   検出結果から改善機会を推論（型エラー→型定義強化、Lint違反→ルール明文化、テスト失敗→カバレッジ拡充、修正コミット多数→確認プロセス改善、レビュー指摘→ドキュメント充実化）

4. **振り返り本文の処理**

   既存の記載内容を確認し、以下の構造で振り返りを生成または加筆修正:

   - **実装内容**（事実ベース）
   - **改善の機会と気づき**（ステップ3で検出した修正の経緯、CI結果、レビューディスカッション）
   - **なぜそうなったか (5 Whys分析)**（深い理解と、どの段階でより良くできたか）
   - **より良い開発のための改善策**（Lint/型チェック/テスト/ドキュメント更新の具体的アクション）
   - **技術的な発見や学び**（プロジェクト全体への適用可能性を含む）

5. **Follow-up Issuesの抽出**

   PR description、レビューコメント、インラインコメントスレッドから未対応事項を抽出。ステップ3.4の改善策を基にタスク生成し、優先度を自動分類（詳細はステップ7参照）。既存内容とマージ後、ユーザー確認を経てサブissueの進捗ドキュメントに追記。

### ステップ4: サブissueのOpen Questions処理（最後の砦）

サブissue完了時点で**既にある情報を使って可能な限り解決する**。Open Questionsを解消する最後の砦。

1. **Open Questionsの抽出**: サブissueの進捗ドキュメントから抽出

2. **既存情報からの解決試行**: 以下の情報源から回答を推論
   - Decision Log（既に記録された意思決定）
   - PRの実装内容（ステップ3で取得済み）
   - 振り返り内容（ステップ3.4で生成済み）
   - Follow-up Issues（ステップ3.5で抽出済み）

3. **`/issync:resolve-questions`で自動解決**: 推論できた回答について実行
   - 処理内容: Open Questions更新（取り消し線 + "✅ 解決済み"）、Decision Log記録、Specification更新

4. **未解決のものはFollow-up Issuesへ**: 優先度Medium、理由を記録

**処理原則**: 保守的に推論（False positive回避）、部分的な解決も記録

### ステップ5: 親issueの進捗ドキュメントを特定

```bash
issync list
```

親issue番号に一致する `issue_url` と `local_file` を取得。未登録の場合は自動初期化（`issync init`）。初期化失敗時は処理を中断（親issueは必須）。

### ステップ6: 親issueのOutcomes & Retrospectivesセクションを更新

追加フォーマット:
```markdown
**サブタスク完了 (YYYY-MM-DD): [サブissueタイトル] (#[番号])**
- [実装内容サマリー]
- [主な発見や学び（あれば）]
```

情報が空の場合は `- （記載なし）` と記載。

### ステップ6.5: 親issueのOpen Questions解決チェック

サブissueの実装により、親issueの一部のOpen Questionsが解決されている可能性がある。保守的に推論し、解決可能なものを検出する。

1. **親issueのOpen Questionsを抽出**: 進捗ドキュメントから取得
2. **解決可能性の推論**: サブissueの情報（実装内容、振り返り、Decision Log）から推論
3. **`/issync:resolve-questions`で自動解決**: 親issueに対して実行
   - 処理内容: ステップ4と同様
   - 回答形式: `**A[番号]: [回答内容]** (サブissue #[番号]で解決)` と出典を明記

**処理原則**: 保守的に推論（False positive回避）、部分的な解決も記録

### ステップ7: Follow-up Issuesの適切な処理

サブissueの進捗ドキュメントの**Follow-up Issuesセクション**に記載された内容を**優先度とタイプで4分類**し、適切に処理：

**Follow-up Issuesとは**: 進捗ドキュメントのセクション名。すべての未対応事項（改善施策、論点、将来タスクなど）の総称。

1. **Critical Improvements** (品質向上のための重要な仕組み化) → **即座に`/issync:create-sub-issue`実行**
   - キーワード: "lint追加"、"型定義強化"、"CI改善"、"セキュリティ"など
   - タイトルに `[Critical]` プレフィックス付与
   - 自動作成（複数可）
   - **重複チェック**: `/issync:create-sub-issue`のステップ4.5で既存issue検索が自動実行される

2. **Project Improvements** (プロジェクト全体の改善) → **`/issync:create-sub-issue`実行を提案**
   - キーワード: "CLAUDE.md"、"テンプレート"、"標準化"など
   - タイトルに `[Improvement]` プレフィックス付与
   - 完了サマリーで提示

3. **Open Questions** (論点・調査事項) → 親issueの**Open Questionsに自動追加**
   - キーワード: "検討"、"調査"、"トレードオフ"など
   - フォーマット: `**Q[次の番号]: [質問タイトル]**\n- [詳細]`

4. **Feature Enhancements** (機能拡張・将来タスク) → **`/issync:create-sub-issue`実行を提案**
   - キーワード: "機能追加"、"スコープ外"、"将来的に"など
   - 完了サマリーで提示、自動作成はしない

**重要**:
- Critical Improvements は**自動作成**することで、より良い開発環境の構築を確実に促す
- 親issueのFollow-up Issuesセクションへの転記は禁止（v7以降、Tasksセクション削除のため）
- サブissueのOpen Questionsで未解決のものは、Follow-up Issuesのこのカテゴリに自動分類される

### ステップ8: サブissueをclose

openの場合のみ実行（closedの場合はスキップ）:
```bash
gh issue close <サブissue URL> --comment "Completed. Summary recorded in parent issue #<親issue番号>. Related PR: <PR URL>"
```

### ステップ9: issync remove実行

サブissueをclose後、issync管理から同期設定を削除:
```bash
issync remove --issue <サブissue URL>
```

失敗時も処理を継続し、警告メッセージを表示。未登録の場合はスキップ。

### ステップ10: GitHub Projects Status変更

`!env ISSYNC_GITHUB_PROJECTS_NUMBER`が設定されている場合のみ、サブissueのStatus→`done`に変更。GraphQL APIでProject ID取得後、`gh project item-edit`で更新。

環境変数:
- `ISSYNC_GITHUB_PROJECTS_NUMBER`: プロジェクト番号（例: `1`）
- `ISSYNC_GITHUB_PROJECTS_OWNER_TYPE`: `user` または `org`（デフォルト: `user`）

**Status 変更コマンド**:

```bash
# GitHub Projects ヘルパースクリプトを使用
bash ${CLAUDE_PLUGIN_ROOT}/scripts/github-projects.sh set-status $SUB_ISSUE_NUMBER "done"
```

**エラー時**:
- 認証エラー: `gh auth refresh -s project`で解決を試行
- その他: 警告表示、処理継続（手動変更案内）

### ステップ11: 親issue進捗ドキュメントの矛盾検出と解消

親issueの更新完了後、進捗ドキュメント全体で矛盾を検出し、必要に応じて解消または報告します。

**検出対象の矛盾**:
- **Decision Logの矛盾**: 矛盾する決定（例: 「A採用」→後で「Bに変更」だが撤回理由が不明確）
- **Work PlanとTasksの不一致**: Phase定義とタスク内容が一致しない
- **Acceptance Criteriaの不整合**: Acceptance CriteriaとValidation & Acceptance Criteriaで基準が異なる
- **Open QuestionsとDecision Logの重複**: 同じ質問が両方に存在（解決済みのはずなのにOpen Questionsに残っている）
- **サブissue追加による新たな矛盾**: 今回のサブissue完了内容が既存の記述と矛盾

**処理フロー**:

1. **矛盾の自動検出**: 進捗ドキュメント全体を分析し、上記パターンを検出

2. **自動解消可能な矛盾**:
   - Open QuestionsとDecision Logの重複 → 削除（取り消し線 + "✅ 解決済み (Decision Log参照)"）
   - 完了済みPhaseのタスクがTasksに残存 → 削除

3. **手動確認が必要な矛盾**: Open Questionsに追加
   - Decision Logの矛盾 → `**Q[N]: [矛盾の詳細]を整理する必要があります**`
   - Work PlanとTasksの不一致 → `**Q[N]: Work Plan Phase [X]とTasks内容の整合性を確認してください**`

**処理原則**: 保守的に実行（確実に安全な変更のみ）、矛盾解消の履歴をDecision Logに記録

**出力**: 詳細は「出力フォーマット」セクションの「⚠️ 矛盾検出結果」参照

### ステップ12: GitHub Issueへの同期

親issueの進捗ドキュメントの変更をGitHub Issueに同期してください。

```bash
issync push
```

### ステップ13: 完了通知

編集内容のサマリーを出力。出力フォーマットは次セクション参照。

### ステップ14: 親issueへのコメント投稿

ステップ13の完了通知と同じ内容を、親issueのコメント欄に投稿します。フォーマットは「出力フォーマット」セクションを参照。

```bash
gh issue comment <親issue URL> --body "$(cat <<'EOF'
[出力フォーマットセクションの内容をそのまま使用]
EOF
)"
```

**エラーハンドリング**:
- コメント投稿失敗時は警告メッセージを表示して処理を継続（補助的な機能のため）
- 親issue進捗ドキュメント更新は完了済みのため、コメント投稿失敗でもワークフロー全体は成功扱い

## 出力フォーマット

```markdown
## /issync:complete-sub-issue 実行結果

### 完了したサブissue
- #[サブissue番号]: [サブissueタイトル]
- 親issue: #[親issue番号]

### 更新内容
- ✅ PRの内容確認: 完了
- ✅ **改善の機会の検出**: [X]件の学びを検出（修正コミット[Y]件、CI結果[Z]件、レビューディスカッション[W]件）
- ✅ **5 Whys分析**: 完了（より良い開発への気づきを整理）
- ✅ 振り返り本文: [生成して追記 / 既存内容を確認し加筆修正]
- ✅ Follow-up Issues: PRから[Y]件抽出、**改善策から[Z]件生成**
- ✅ **サブissueのOpen Questions**: [X]件解決（/resolve-questions実行）、[Y]件Follow-up Issuesへ移行
- ✅ 親issueのOutcomes & Retrospectives: サブタスク完了サマリー追加 (進捗ドキュメント:[line_number])
- ✅ **親issueのOpen Questions**: [Z]件解決（/resolve-questions実行）、[W]件新規追加
- ✅ サブissue #[サブissue番号]: [closeした（Related PR: [PR URL]） / すでにclosed]
- ✅ issync remove実行: [✅ 成功 / ⚠️ スキップ（未登録） / ⚠️ 失敗]
- ✅ GitHub Projects Status: `done`に変更 [✅ 成功 / ⚠️ 失敗（手動変更推奨）]
- ✅ **矛盾検出と解消**: [自動解消X件、要確認Y件（Open Questionsに追加） / 矛盾なし]
- ✅ GitHub Issueへの同期: 完了（issync push）

---

### ⚠️ 矛盾検出結果
[矛盾が検出された場合のみ表示]

- ✅ **自動解消**: [件数]件
  - Open Questions [X]件を削除（Decision Logで既に解決済み）
  - 完了Phase [Y]のタスク[Z]件をTasksから削除
- ⚠️ **要確認**: [件数]件（Open Questionsに追加済み）
  - Q[N]: [矛盾の詳細] - 場所: [セクション名]
  - Q[N]: [矛盾の詳細] - 場所: [セクション名]

---

### 🎯 Critical: 品質向上タスク (自動作成済み)

- #[番号]: [Critical] [タスク名]
- #[番号]: [Critical] [タスク名]

**次のアクション**: 即座に着手（最優先）

---

### 💡 Recommended: プロジェクト改善提案

- [タスク名1]
- [タスク名2]

実行例: `/issync:create-sub-issue "[Improvement] タスク名1" "[Improvement] タスク名2"`

---

### 📋 Feature Enhancements: 機能拡張・将来タスク提案

- [タスク名1]
- [タスク名2]

実行例: `/issync:create-sub-issue "タスク名1" "タスク名2"`

---

### 次のアクション

**優先度順に実施してください:**

1. [ ] **🎯 最優先**: 品質向上タスク (#[番号], #[番号]) に即座に着手
2. [ ] **💡 推奨**: プロジェクト改善提案を確認し、必要に応じて `/create-sub-issue` 実行
3. [ ] 親issueの更新内容（Outcomes & Retrospectives、Open Questions解決状況）を確認
4. [ ] 追加された新規Open Questionsを確認
5. [ ] 必要に応じてFeature Enhancementsのサブissue作成を検討
```

---

## エラーハンドリング

**issync管理外のissue**:
- 未登録のissue検出時 → `issync init <issue_url>` で自動初期化
- 親issue初期化失敗 → 処理を中断（必須）
- サブissue初期化失敗 → 「（記載なし）」として続行

**その他**:
- 無効なURL、親issue番号不在 → エラー表示
- issueがすでにclosed → close処理をスキップ
- issue close失敗 → 警告表示

---

## 実行例

```bash
/issync:complete-sub-issue https://github.com/MH4GF/issync/issues/124
```

実行フローは冒頭のワークフロー（ステップ1-14）を参照。

---

**運用フローの詳細**: 冒頭の「コンテキスト」セクション参照
