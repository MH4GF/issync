---
description: サブissue完了時に親issueの進捗ドキュメントを自動更新。PRから学びを抽出し振り返りを生成・加筆、Follow-up Issuesセクションを4分類で処理（Critical自動作成、Improvement提案、Open Questions追加、Feature Enhancements提案）。完了サマリーを親issueにコメント投稿。完了後はissync removeで同期設定を自動削除
---

# /complete-sub-issue: サブissue完了オペレーション

サブissue完了時に親issueの進捗ドキュメントを自動更新します。PRから学びを抽出し、振り返りを生成・加筆、Follow-up Issuesを優先度付きで4分類処理します。完了サマリーを親issueにコメント投稿します。詳細は「実行ステップ」参照。

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
1. `/create-sub-issue`でサブissue作成
2. サブissueで開発（plan → implementation → retrospective）
3. `/complete-sub-issue`で親issueに自動反映＆close（PR分析、5 Whys分析、Follow-up Issues 4分類処理）
4. Critical Improvements（品質向上）に即座着手
5. 必要に応じてProject Improvements/Feature Enhancementsで次のサブissue作成

**Note**: Template v7では進捗ドキュメントのTasksセクションが削除されているため、このコマンドはTasksセクションを操作しません。

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

   既存の記載がある場合も、新たに得られた情報（PR分析結果）を基に、不足している視点や誤りがあれば加筆修正する。
   ユーザー確認後、サブissueの進捗ドキュメントに反映。

5. **Follow-up Issuesの抽出**

   PR description、レビューコメント、インラインコメントスレッドから未対応事項を抽出。ステップ4の改善策を基にタスク生成し、優先度を自動分類（詳細はステップ6参照）。既存内容とマージ後、ユーザー確認を経てサブissueの進捗ドキュメントに追記。

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

サブissueの進捗ドキュメントの**Follow-up Issuesセクション**に記載された内容を**優先度とタイプで4分類**し、適切に処理：

**Follow-up Issuesとは**: 進捗ドキュメントのセクション名。すべての未対応事項（改善施策、論点、将来タスクなど）の総称。

1. **Critical Improvements (品質向上のための重要な仕組み化)** → **即座に`/create-sub-issue`実行**
   - 優先度: **Critical**
   - キーワード: "lint追加"、"lintルール"、"型定義強化"、"型チェック"、"テスト追加"、"自動化"、"hook追加"、"CI改善"、"品質向上"、"セキュリティ"、"脆弱性"
   - フォーマット: タイトルに `[Critical]` プレフィックス付与
   - 処理: **ユーザー確認後、自動的に `/create-sub-issue` 実行**（複数可）
   - 理由: より良い開発環境の構築、同様の改善機会の早期発見のため、最優先で対応が必要

2. **Project Improvements (プロジェクト全体の改善)** → **`/create-sub-issue`実行を提案**
   - 優先度: **High/Medium**
   - キーワード: "CLAUDE.md"、"テンプレート"、"template"、"ガイドライン"、"全体適用"、"開発フロー"、"標準化"、"ベストプラクティス"、"ドキュメント整備"、"共有"
   - フォーマット: タイトルに `[Improvement]` プレフィックス付与
   - 処理: 完了サマリーで提示、ユーザー確認後に `/create-sub-issue` 実行を提案
   - 理由: プロジェクト全体の生産性向上のため、計画的に対応

3. **Open Questions (論点・調査事項)** → 親issueの**Open Questionsに自動追加**
   - 優先度: **Medium**
   - キーワード: "検討"、"調査"、"方法"、"どのように"、"理由"、"判断"、"選択"、"課題"、"トレードオフ"、"比較"
   - フォーマット: `**Q[次の番号]: [質問タイトル]**\n- [詳細]`
   - 理由: 意思決定が必要な論点を明確化

4. **Feature Enhancements (機能拡張・将来タスク)** → **`/create-sub-issue`実行を提案**
   - 優先度: **Low/Medium**
   - キーワード: "実装"、"機能追加"、"対応"、"作成"、"構築"、"別issue"、"今回のスコープ外"、"将来的に"、"拡張"、"エンハンス"、"機能強化"
   - 処理: 完了サマリーで提示、自動作成はしない
   - 理由: スコープ外の機能追加、将来的な拡張

**優先度判定の詳細ルール:**
- **Critical**:
  - 品質向上のための重要な仕組み化（同様の改善機会を早期発見できる仕組み）
  - セキュリティ強化、重要なバグ対応
  - pre-commit hook、型チェック、Lintルール追加
- **High**:
  - プロジェクト全体の生産性向上（CLAUDE.md、テンプレート更新）
  - 開発フロー改善、標準化
- **Medium**:
  - 通常の機能追加、調査事項、論点
- **Low**:
  - Nice-to-have な改善、将来的な拡張

**重要**:
- Critical Improvements は**自動作成**することで、より良い開発環境の構築を確実に促す
- 親issueのFollow-up Issuesセクションへの転記は禁止（v7以降、Tasksセクション削除のため）

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

`!env GITHUB_PROJECTS_NUMBER`が設定されている場合のみ、サブissueのStatus→`done`に変更。GraphQL APIでProject ID取得後、`gh project item-edit`で更新。

環境変数:
- `GITHUB_PROJECTS_NUMBER`: プロジェクト番号（例: `1`）
- `GITHUB_PROJECTS_OWNER_TYPE`: `user` または `org`（デフォルト: `user`）

```bash
gh api graphql -f query='...'  # Project情報取得
gh project item-edit --id <item-id> --project-id <project-id> --field-id <status-field-id> --option-id <done-option-id>
```

**エラー時**: 認証エラーは`gh auth refresh -s project`、その他失敗時は警告のみで作業継続（手動変更案内）。環境変数の形式が不正、プロジェクトが見つからない、権限不足の場合は警告を表示して処理を継続。

### ステップ10: GitHub Issueへの同期

親issueの進捗ドキュメントの変更をGitHub Issueに同期してください。

```bash
issync push
```

### ステップ11: 完了通知

編集内容のサマリーを出力。出力フォーマットは次セクション参照。

### ステップ12: 親issueへのコメント投稿

ステップ11の完了通知と同じ内容を、親issueのコメント欄に投稿します。フォーマットは「出力フォーマット」セクションを参照。

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
## /complete-sub-issue 実行結果

### 完了したサブissue
- #[サブissue番号]: [サブissueタイトル]
- 親issue: #[親issue番号]

### 更新内容
- ✅ PRの内容確認: 完了
- ✅ **改善の機会の検出**: [X]件の学びを検出（修正コミット[Y]件、CI結果[Z]件、レビューディスカッション[W]件）
- ✅ **5 Whys分析**: 完了（より良い開発への気づきを整理）
- ✅ 振り返り本文: [生成して追記 / 既存内容を確認し加筆修正]
- ✅ Follow-up Issues: PRから[Y]件抽出、**改善策から[Z]件生成**
- ✅ 親issueのOutcomes & Retrospectives: サブタスク完了サマリー追加 (進捗ドキュメント:[line_number])
- ✅ 親issueのOpen Questions: [X]件追加
- ✅ サブissue #[サブissue番号]: [closeした（Related PR: [PR URL]） / すでにclosed]
- ✅ issync remove実行: [✅ 成功 / ⚠️ スキップ（未登録） / ⚠️ 失敗]
- ✅ GitHub Projects Status: `done`に変更 [✅ 成功 / ⚠️ 失敗（手動変更推奨）]
- ✅ GitHub Issueへの同期: 完了（issync push）

---

### 🎯 Critical: 品質向上タスク (自動作成済み)

- #[番号]: [Critical] [タスク名]
- #[番号]: [Critical] [タスク名]

**次のアクション**: 即座に着手（最優先）

---

### 💡 Recommended: プロジェクト改善提案

- [タスク名1]
- [タスク名2]

実行例: `/create-sub-issue "[Improvement] タスク名1" "[Improvement] タスク名2"`

---

### 📋 Feature Enhancements: 機能拡張・将来タスク提案

- [タスク名1]
- [タスク名2]

実行例: `/create-sub-issue "タスク名1" "タスク名2"`

---

### 次のアクション

**優先度順に実施してください:**

1. [ ] **🎯 最優先**: 品質向上タスク (#[番号], #[番号]) に即座に着手
2. [ ] **💡 推奨**: プロジェクト改善提案を確認し、必要に応じて `/create-sub-issue` 実行
3. [ ] 親issueの更新内容（Outcomes & Retrospectives）を確認
4. [ ] 追加されたOpen Questionsを確認
5. [ ] 必要に応じてFeature Enhancementsのサブissue作成を検討
```

---

## エラーハンドリング

<<<<<<< HEAD
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

実行フローは冒頭のワークフロー（ステップ1-12）を参照。

---

## 運用フロー

1. `/create-sub-issue`でサブissue作成
2. サブissueで開発（plan → retrospective）、進捗ドキュメントに成果を記入（任意）
3. `/complete-sub-issue`で親issueに自動反映＆サブissueclose（PR自動取得、振り返り/Follow-up Issues自動生成）
4. 必要に応じて`/create-sub-issue`で次のサブissue作成
=======
- 未登録issue → `issync init`で自動初期化（親issue失敗時は中断、サブissue失敗時は「（記載なし）」で続行）
- 無効URL/親issue不在 → エラー表示
- すでにclosed → close処理スキップ
- close失敗 → 警告表示
>>>>>>> 4bf8209 (refactor: enhance /complete-sub-issue with deeper retrospectives)
