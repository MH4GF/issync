---
description: サブissue完了時に親issueの進捗ドキュメントを自動更新。振り返り未記入時はPRから自動生成し、Follow-up事項を適切に処理（Open Questions追加、/create-sub-issue提案）。完了後はissync removeで同期設定を自動削除
---

# /complete-sub-issue: サブissue完了オペレーション

あなたはユーザーのサブissue完了時に、親issueの進捗ドキュメントを自動的に更新するサポートをしています。このコマンドは以下のワークフローを自動化します：
1. サブissue情報のフェッチと親issue番号の抽出
2. 未初期化のissueがあれば `issync init` で自動初期化
3. サブissueの進捗ドキュメントから完了情報を抽出
4. **関連PRを自動取得し内容を常に確認、振り返り未記入時は自動生成、Follow-up Issuesは常に抽出**（Timeline Events API使用、取得失敗時のみユーザーに確認）
5. 親issueの進捗ドキュメントを更新（Outcomes & Retrospectives、Open Questions）
6. Follow-up事項の適切な処理提案（Open Questions追加または/create-sub-issue実行提案）
7. サブissueのclose（closeコメントに関連PR URLを含める）
8. issync remove実行（完了したサブissueの同期設定を削除）
9. GitHub Projects Status変更（done）
10. GitHub Issueへの同期（issync push）
11. 完了通知

## 使用方法

```bash
/complete-sub-issue <サブissue URL>
# 例: /complete-sub-issue https://github.com/MH4GF/issync/issues/456
```

**引数**:
- `サブissue URL` (必須): 完了したサブissueのGitHub URL

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**横断的オペレーション**です：
- **実行タイミング**: `retrospective`ステート（サブissueの振り返り記入後）
- サブissue完了時に親issueへ完了情報を自動反映
- Follow-up事項を適切に処理：論点はOpen Questionsへ、実装タスクは/create-sub-issueで新規サブissue化を提案
- 親issueが適切なネクストアクションを実施できるよう支援
- **Note**: Template v7では、進捗ドキュメントのTasksセクションが削除されているため、このコマンドはTasksセクションを操作しません

## 前提条件

- `GITHUB_TOKEN`環境変数が設定されている
- `gh` CLIがインストール済み
- 未初期化issueは自動初期化（詳細は「エラーハンドリング」参照）

## 実行ステップ

### ステップ1: サブissue情報をフェッチと親issue番号の取得

GitHub Sub-issues API (`gh api /repos/{owner}/{repo}/issues/{issue_number}/parent`) で親issue番号を取得。API失敗時はissue bodyから抽出。無効URL/親issue不在時はエラー表示。

### ステップ2: サブissueの進捗ドキュメントを読み込み

`issync list`で登録状況を確認。未登録の場合は自動初期化（エラーハンドリング参照）。

以下を抽出:
- **Outcomes & Retrospectives**: 実装内容、発見や学び
- **Follow-up Issues**: 将来対応事項

初期化失敗時は「（記載なし）」で続行。

### ステップ3: PRの自動取得と内容確認（常に実行）

1. **関連PRを自動取得**
   ```bash
   gh api repos/{owner}/{repo}/issues/{issue_number}/timeline \
     --jq '.[] | select(.event == "cross-referenced" and .source.issue.pull_request != null) |
          {pr_url: .source.issue.html_url, pr_number: .source.issue.number,
           pr_state: .source.issue.state, merged_at: .source.issue.pull_request.merged_at}'
   ```
   - Timeline Events APIの`cross-referenced`イベントから`pull_request`を持つものを抽出
   - 複数ある場合は最新のマージ済みPRを優先（`merged_at`でソート）
   - 取得できない場合のみユーザーに確認:
     ```
     このサブissueに関連するPRのURLを教えてください
     ```

2. **PRの内容を分析**
   ```bash
   gh pr view <PR URL> --json title,body,commits,reviews,comments
   gh pr diff <PR URL>
   gh api repos/{owner}/{repo}/pulls/{pr_number}/comments  # インラインコメント＋リプライスレッド取得
   ```

3. **振り返り本文の処理**（Outcomes & Retrospectivesが空または「（記載なし）」の場合のみ）
   - 実装内容（事実ベース）と技術的な発見や学びを生成
   - ユーザー確認後、サブissueの進捗ドキュメントに追記
   - 既に記入済みの場合はスキップ

4. **Follow-up Issuesの抽出**（常に実行）
   - PR description、レビューコメント、コミットメッセージ、**インラインコメントスレッド**から未対応事項を抽出
   - インラインスレッド分析: 親コメント（改善候補）とリプライ（対応方針: 別PR/即対応/却下）から分類
   - 既存内容とマージし、ユーザー確認後にサブissueの進捗ドキュメントに追記

### ステップ4: 親issueの進捗ドキュメントを特定

```bash
issync list
```

親issue番号に一致する `issue_url` と `local_file` を取得。未登録の場合は自動初期化（`issync init`）。初期化失敗時は処理を中断（親issueは必須）。

### ステップ5: 親issueのOutcomes & Retrospectivesセクションを更新

追加フォーマット:
```markdown
**サブタスク完了 (YYYY-MM-DD): [サブissueタイトル] (#[番号])**
- [実装内容サマリー]
- [主な発見や学び（あれば）]
```

情報が空の場合は `- （記載なし）` と記載。

### ステップ6: Follow-up Issuesの適切な処理

サブissueのFollow-up Issuesをキーワードベースで分類し処理：

1. **論点・調査事項** → 親issueの**Open Questionsに自動追加**
   - キーワード: "検討"、"調査"、"方法"、"どのように"、"理由"、"判断"、"選択"、"課題"
   - フォーマット: `**Q[次の番号]: [質問タイトル]**\n- [詳細]`

2. **実装タスク** → **`/create-sub-issue`実行を提案**（完了サマリーで提示、自動作成はしない）
   - キーワード: "実装"、"機能追加"、"対応"、"作成"、"構築"、"別issue"、"今回のスコープ外"、"将来的に"

**重要**: 親issueのFollow-up Issuesセクションへの転記は禁止。親issueが適切なネクストアクションを実施できるよう支援する。

### ステップ7: サブissueをclose

openの場合のみ実行（closedの場合はスキップ）:
```bash
gh issue close <サブissue URL> --comment "Completed. Summary recorded in parent issue #<親issue番号>. Related PR: <PR URL>"
```

### ステップ8: issync remove実行

サブissueをclose後、issync管理から同期設定を削除:
```bash
issync remove --issue <サブissue URL>
```

失敗時も処理を継続し、警告メッセージを表示。未登録の場合はスキップ。

### ステップ9: GitHub Projects Status変更

`!env CONTRADICTION_TOOLS_ENABLE_GITHUB_PROJECTS`が`true`の場合のみ、サブissueのStatus→`done`に変更。GraphQL APIでProject ID取得後、`gh project item-edit`で更新。

```bash
gh api graphql -f query='...'  # Project情報取得
gh project item-edit --id <item-id> --project-id <project-id> --field-id <status-field-id> --option-id <done-option-id>
```

**エラー時**: 認証エラーは`gh auth refresh -s project`、その他失敗時は警告のみで作業継続（手動変更案内）

### ステップ10: GitHub Issueへの同期

親issueの進捗ドキュメントの変更をGitHub Issueに同期してください。

```bash
issync push
```

### ステップ11: 完了通知

編集内容のサマリーを出力。出力フォーマットは次セクション参照。

## 出力フォーマット

```markdown
## /complete-sub-issue 実行結果

### 完了したサブissue
- #[サブissue番号]: [サブissueタイトル]
- 親issue: #[親issue番号]

### 更新内容
- ✅ PRの内容確認: 完了
- ✅ 振り返り本文: [生成して追記 / 既に記入済みのためスキップ]
- ✅ Follow-up Issues: PRから[Y]件抽出、サブissueの進捗ドキュメントに追記
- ✅ 親issueのOutcomes & Retrospectives: サブタスク完了サマリー追加 (進捗ドキュメント:[line_number])
- ✅ 親issueのOpen Questions: [X]件追加
- ✅ サブissue #[サブissue番号]: [closeした（Related PR: [PR URL]） / すでにclosed]
- ✅ issync remove実行: [✅ 成功 / ⚠️ スキップ（未登録） / ⚠️ 失敗]
- ✅ GitHub Projects Status: `done`に変更 [✅ 成功 / ⚠️ 失敗（手動変更推奨）]
- ✅ GitHub Issueへの同期: 完了（issync push）

### 推奨アクション: 新規サブissue作成 (該当する場合のみ表示)
以下のタスクは `/create-sub-issue` での新規サブissue化を推奨します：
- [タスク概要1]
- [タスク概要2]

実行例: `/create-sub-issue "[タスク概要1]" "[タスク概要2]"`

### 次のアクション
- [ ] 親issueの更新内容を確認してください
- [ ] 追加されたOpen Questionsを確認してください
- [ ] 推奨されている場合は `/create-sub-issue` で新規サブissueを作成してください
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
/complete-sub-issue https://github.com/MH4GF/issync/issues/124
```

実行フローは冒頭のワークフロー（ステップ1-9）を参照。

---

## 運用フロー

1. `/create-sub-issue`でサブissue作成
2. サブissueで開発（plan → retrospective）、進捗ドキュメントに成果を記入（任意）
3. `/complete-sub-issue`で親issueに自動反映＆サブissueclose（PR自動取得、振り返り/Follow-up Issues自動生成）
4. 必要に応じて`/create-sub-issue`で次のサブissue作成
