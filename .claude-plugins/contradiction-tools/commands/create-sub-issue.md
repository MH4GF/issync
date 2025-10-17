---
description: 新規タスクをGitHub Issueとして作成し、親issueとのリンクを自動管理。plan.mdのTasksセクションは不使用
---

# /create-sub-issue: サブissue作成オペレーション

あなたはユーザーの新規タスクをGitHub Issueとして作成するサポートをしています。このコマンドは以下のワークフローを自動化します：
1. タスク名の入力（インタラクティブモードまたは引数モード）
2. `.issync/state.yml`から親issue情報を取得
3. LLMが親issueのコンテキストを理解し、各タスクのissue本文を生成
4. ユーザー確認後にGitHub Issueを一括作成
5. Sub-issues APIで親issueと紐づけ + 作成順序を維持

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**横断的オペレーション**です：
- **どのステートでも実行可能**（plan、poc、architecture-decision、implement）
- GitHub Sub-issuesを完全なSSOTとし、plan.mdのTasksセクションは使用しない（Template v7で完全移行）
- LLM生成のissue本文により、各サブissueが親issueのコンテキストを継承
- 作成されたサブissueは自動的に親issueとリンク

## 使用方法

```bash
/create-sub-issue                    # インタラクティブモード（タスク名入力を促される）
/create-sub-issue "タスク名1" "タスク名2"  # 引数指定モード
```

**引数**:
- **インタラクティブモード**: タスク名を1つずつ入力（空行で終了）
- **引数指定モード**: タスク名を引数として複数指定

## 前提条件

実行前に以下が必要です：
- [ ] `.issync/state.yml`が存在する（issync initが完了している）
- [ ] `GITHUB_TOKEN`環境変数が設定されている（`export GITHUB_TOKEN=$(gh auth token)`）
- [ ] `gh` CLIがインストールされている

## 実行ステップ

### ステップ1: タスク名の入力

#### インタラクティブモード（引数なし）

タスク名を1つずつ入力するよう促す：

```
タスク名を入力してください（空行で終了）:
> [ユーザー入力1]
> [ユーザー入力2]
> [空行で終了]
```

#### 引数指定モード

コマンド実行時に引数として渡されたタスク名を使用：
```bash
/create-sub-issue "Status変更時の自動アクション設計" "/create-sub-issue実装"
```

### ステップ2: .issync/state.ymlから親issue情報を取得

`.issync/state.yml`を読み込み、以下の情報を取得：
- `issue_url`: 親issueのURL（例: `https://github.com/owner/repo/issues/123`）
- `local_file`: plan.mdのパス（例: `.issync/docs/task-dashboard.md`）

**親issue決定ロジック**:
- `.issync/state.yml`に複数のsyncが存在する場合、ユーザーに選択を促す
- 1つのみの場合は自動的にそれを使用

**エラーハンドリング**:
- `.issync/state.yml`が存在しない場合:
  ```
  エラー: .issync/state.ymlが見つかりません。
  まず `issync init <issue-url>` を実行してください。
  ```

### ステップ3: 親issueのplan.mdを読み込み、コンテキストを抽出

`local_file`（親issueのplan.md）を**全体読み込み**し、以下をLLMが理解：
1. **Purpose/Overviewセクション**: 親issueの目的、コアバリュー
2. **Context & Directionセクション**: 問題の背景、設計哲学
3. **Specification / 仕様セクション**: システム仕様、アーキテクチャ（存在する場合）

### ステップ4: LLMによるissue本文の生成

**入力情報**: 親issueのplan.md全体、タスク名、親issue番号とURL

**生成テンプレート**:
```markdown
Part of #{親issue番号}

## Goal
{このタスクの具体的な目的（1-2文）}

## Background
{親issueのコンテキストから関連情報のみを抽出・要約（2-4段落）}

## Acceptance Criteria
- [ ] {具体的な完了条件（3-5項目）}
- [ ] Code review completed
- [ ] Documentation updated

## Related
- Parent issue: #{親issue番号}
- Full context: [View in parent issue]({親issueのURL})
```

**生成ポイント**:
- タスク固有の情報のみ抽出
- 具体的で実行可能な内容
- 過不足ない情報量（冗長にしない）

### ステップ5: ユーザー確認

生成した本文を提示し、承認を得てから次へ進む：

```
以下の内容でサブissueを作成します。よろしいですか？ (y/n):

Issue 1: [タスク名1]
[生成された本文のプレビュー]

Issue 2: [タスク名2]
[生成された本文のプレビュー]
```

**ユーザー入力**:
- `y`: 次のステップへ進む
- `n`: 処理を中止

### ステップ6: GitHub Issueを一括作成とSub-issues紐づけ・順序設定

**処理フロー** (作成順序を維持)：
1. `gh issue create`でサブissue作成
2. Issue番号を抽出: `echo $ISSUE_URL | grep -o '[0-9]*$'`
3. 内部IDを取得: `gh api /repos/{owner}/{repo}/issues/{番号} --jq .id`
4. Sub-issues APIで紐づけ: `POST /repos/{owner}/{repo}/issues/{親issue番号}/sub_issues`
5. 2つ目以降は順序設定: `PATCH .../sub_issues/priority` with `after_id={前タスクID}`

**コマンド例**:
```bash
PREV_SUB_ISSUE_ID=""
for TASK_NAME in "${TASK_NAMES[@]}"; do
  ISSUE_URL=$(gh issue create --repo {owner}/{repo} --title "$TASK_NAME" --body "...")
  ISSUE_NUMBER=$(echo $ISSUE_URL | grep -o '[0-9]*$')
  SUB_ISSUE_ID=$(gh api /repos/{owner}/{repo}/issues/$ISSUE_NUMBER --jq .id)

  # Sub-issueとして紐づけ
  gh api --method POST /repos/{owner}/{repo}/issues/{親issue番号}/sub_issues \
    -F "sub_issue_id=$SUB_ISSUE_ID"

  # 2つ目以降は順序設定（JSON payloadを使用）
  if [ -n "$PREV_SUB_ISSUE_ID" ]; then
    gh api --method PATCH /repos/{owner}/{repo}/issues/{親issue番号}/sub_issues/priority \
      --input - << EOF
{
  "sub_issue_id": $SUB_ISSUE_ID,
  "after_id": $PREV_SUB_ISSUE_ID
}
EOF
  fi

  PREV_SUB_ISSUE_ID=$SUB_ISSUE_ID
done
```

**出力例**:
```
Created issue #124: Status変更時の自動アクション設計
  → Linked to parent issue #123 as sub-issue (position: 1)
Created issue #125: /create-sub-issue実装
  → Linked to parent issue #123 as sub-issue (position: 2, after #124)
```

### ステップ7: GitHub Projects Statusを設定（オプション）

作成されたissueの初期Statusを`plan`に設定：

```bash
# Projects情報を取得して設定（gh CLIで可能な場合）
gh issue edit $ISSUE_NUMBER --add-project "{ProjectName}" --project-field "Status=plan"
```

**注**: この機能がgh CLIで利用不可の場合はスキップし、手動設定を促す

---

## 出力フォーマット

全ステップ完了後、以下の形式でサマリーを提供：

```markdown
## /create-sub-issue 実行結果

### 作成されたサブissue
- #124: Status変更時の自動アクション設計
  - ✅ Sub-issueとして親issue #123に紐づけ完了（position: 1）
- #125: /create-sub-issue実装
  - ✅ Sub-issueとして親issue #123に紐づけ完了（position: 2, after #124）

合計: 2件

### 更新内容
- ✅ Sub-issues API紐づけ完了: 2件のサブissueが親issueと紐づけられました
- ✅ Sub-issues順序設定完了: 作成順序に従って適切に並べられました
- ✅ LLM生成issue本文: 各issueに親issueコンテキストを基にしたGoal、Background、Acceptance Criteriaを付与

### 次のアクション
- [ ] 作成されたサブissueを確認してください
- [ ] 各サブissueのStatusを`plan`に設定してください（GitHub Projects経由）
- [ ] 必要に応じて各サブissueで `/plan` コマンドを実行してplan.mdを初期化してください
```

---

## 重要な注意事項

### 必須要件
- parent issueのplan.mdを必ず読む（.issync/state.ymlのlocal_fileパスを使用）
- 既存のフォーマットと構造を保持
- gh CLIを使用（GitHub API直接使用NG）
- issue本文はLLM生成、ユーザー確認必須
- 内部ID使用（Issue番号ではなく）: `gh api .../issues/{番号} --jq .id`

### Sub-issues API
- 作成直後に実行: Issue作成→内部ID取得→Sub-issues API
- 順序維持: 1つ目は紐づけのみ、2つ目以降は`after_id`で前タスクの後に配置
- JSON payloadを使用（`--input -` + heredoc）
- エラーハンドリング: API失敗時も処理継続、ユーザーに報告

### plan.mdのTasksセクションは操作しない
- Template v7では、Tasksセクションが削除されているため、このコマンドはplan.mdを一切変更しない
- タスク管理はGitHub Sub-issuesに完全移行

### エラーハンドリング
- `.issync/state.yml`不在 → エラー表示して終了
- `gh` CLI不在 → エラー表示して終了
- Issue作成失敗 → 失敗タスクを明示、部分成功も記録

---

## 実行例

### 例1: インタラクティブモード

**入力**: `/create-sub-issue`

**処理**:
1. state.yml読み込み → 親issue #123確認
2. タスク名入力プロンプト表示 → ユーザーが2件入力
3. plan.md読み込み → LLMがコンテキスト理解
4. issue本文生成 → ユーザー確認 → `y`
5. Issue作成+Sub-issues紐づけ → #124, #125
6. 順序設定完了

**出力**: 作成されたサブissue 2件、Sub-issues紐づけ完了、次のアクション提示

### 例2: 引数指定モード

**入力**: `/create-sub-issue "自動アクション設計" "/create-sub-issue実装"`

**処理**: 例1と同様だが、タスク名入力をスキップ（引数から直接取得）

**出力**: 作成されたサブissue 2件

---

## 補足: Template v7への完全移行

このコマンドは、task-dashboard.mdの**Decision Log 2025-10-17**（TasksセクションをGitHub Sub-issuesに完全移行）を実現するための実装です：

- **完全移行**: GitHub Sub-issuesが完全なSSoT、plan.mdのTasksセクションは使用しない
- **新ワークフロー**:
  1. architecture-decision後、実装タスクが明確になったら`/create-sub-issue`を実行
  2. LLMが親issueコンテキストを理解し、各サブissueに適切なGoal/Background/Acceptance Criteriaを生成
  3. 自動でSub-issues APIで親issueに紐づけ
  4. 各サブissueで`/plan`を実行してplan.mdを初期化、開発開始

このワークフローにより、タスク管理の一元化とドキュメントの簡素化が実現されます。
