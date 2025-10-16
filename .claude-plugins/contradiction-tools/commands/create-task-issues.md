---
description: `(未Issue化)`マーク付きタスクを一括でGitHub Issueに変換し、親issueとのリンクを自動管理
---

# /create-task-issues: タスクのサブissue化ワークフロー

あなたはユーザーのplan.mdファイル内のタスクを、GitHub Issueとして作成するサポートをしています。このコマンドは以下のワークフローを自動化します：
1. `.issync/state.yml`から親issue情報を取得
2. Tasksセクションから`(未Issue化)`マーク付きタスクを抽出
3. ユーザーに確認
4. **LLMが親issueのコンテキストを理解し、各タスクのissue本文を生成**
5. GitHub Issueを一括作成
6. Sub-issues APIで親issueと紐づけ + Tasksの順序を維持
7. Tasksセクションを自動更新
8. issync pushで同期

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**横断的オペレーション**です：
- **どのステートでも実行可能**（before-plan、before-poc、before-architecture-decision、before-implement）
- 大きなタスクのみサブissue化し、小さなタスクはTasksセクションで管理（ハイブリッド方式）
- `(未Issue化)`マークで明示的に管理すべきタスクを識別
- 作成されたサブissueは自動的に親issueとリンク
- **Tasksセクションの順序を維持**: Sub-issuesもTasksの順序（優先順位）に従って並べられます

## 使用方法

```bash
/create-task-issues              # 全ての(未Issue化)タスクを対象
/create-task-issues "タスク名"   # 特定のタスクのみ対象（部分一致）
```

**引数**:
- `タスク名` (オプション): 指定がない場合は全ての`(未Issue化)`マーク付きタスクが対象
  - 部分一致で検索（例: `/create-task-issues "自動アクション"` → "Status変更時の自動アクション設計"がマッチ）

## 前提条件

実行前に以下が必要です：
- [ ] `.issync/state.yml`が存在する（issync initが完了している）
- [ ] plan.mdにTasksセクションがあり、`(未Issue化)`マーク付きタスクが存在する
- [ ] `GITHUB_TOKEN`環境変数が設定されている（`export GITHUB_TOKEN=$(gh auth token)`）
- [ ] `gh` CLIがインストールされている

## 実行ステップ

### ステップ1: .issync/state.ymlから親issue情報を取得

`.issync/state.yml`を読み込み、以下の情報を取得：
- `issue_url`: 親issueのURL（例: `https://github.com/owner/repo/issues/123`）
- `local_file`: plan.mdのパス（例: `.issync/docs/task-dashboard.md`）

**エラーハンドリング**:
- `.issync/state.yml`が存在しない場合:
  ```
  エラー: .issync/state.ymlが見つかりません。
  まず `issync init <issue-url>` を実行してください。
  ```

### ステップ2: plan.mdを読み込み、Tasksセクションをパース

`local_file`（親issueのplan.md）を**全体読み込み**し、以下を抽出：
1. **plan.md全体の内容**（LLMがissue本文生成時に使用）
2. **Tasksセクション全体**
3. `(未Issue化)`マーク付きタスクのリスト

**タスク抽出ロジック**:
```regex
- \[ \] (.+?) \(未Issue化\)
```

例:
```markdown
- [ ] Status変更時の自動アクション設計 (未Issue化)
- [ ] CI/CDパイプライン統合（lint、test、type-check）
- [ ] /create-task-issues実装 (未Issue化)
```

→ 抽出結果: 2件（"Status変更時の自動アクション設計"、"/create-task-issues実装"）

### ステップ3: タスクをフィルタリング

**引数が指定されている場合**:
- タスク名に対して部分一致でフィルタリング
- マッチしなかった場合はエラー:
  ```
  エラー: 「{引数}」にマッチする(未Issue化)タスクが見つかりません。
  ```

**引数が指定されていない場合**:
- 全ての`(未Issue化)`タスクを対象

### ステップ4: ユーザーに確認

抽出されたタスクリストを表示し、ユーザーに確認を求める：

```
Found {N} task(s) marked as (未Issue化):

1. [ ] Status変更時の自動アクション設計
2. [ ] /create-task-issues実装

親issue: #{issue_number} ({issue_url})

これらのタスクをサブissueとして作成しますか？ (y/n):
```

**ユーザー入力**:
- `y`: 次のステップへ進む
- `n`: 処理を中止

### ステップ4.5: LLMによるissue本文の生成

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

**生成ポイント**: タスク固有の情報のみ抽出、具体的な内容、過不足ない情報量

**ユーザー確認**: 生成した本文を提示し、承認を得てから次へ進む

### ステップ5: GitHub Issueを一括作成とSub-issues紐づけ・順序設定

**処理フロー** (Tasksセクションの順序を維持):
1. `gh issue create`でサブissue作成（ステップ4.5のテンプレート使用）
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
  gh api --method POST .../sub_issues -F "sub_issue_id=$SUB_ISSUE_ID"
  [ -n "$PREV_SUB_ISSUE_ID" ] && gh api --method PATCH .../sub_issues/priority -F "sub_issue_id=$SUB_ISSUE_ID" -F "after_id=$PREV_SUB_ISSUE_ID"
  PREV_SUB_ISSUE_ID=$SUB_ISSUE_ID
done
```

**出力例**:
```
Created issue #124: Status変更時の自動アクション設計
  → Linked to parent issue #123 as sub-issue (position: 1)
Created issue #125: /create-task-issues実装
  → Linked to parent issue #123 as sub-issue (position: 2, after #124)
```

### ステップ6: Tasksセクションを更新

`(未Issue化)` → `(#{issue_number})`に置換（Editツールで1タスクずつ）

**例**: `- [ ] Status変更時の自動アクション設計 (未Issue化)` → `- [ ] Status変更時の自動アクション設計 (#124)`

### ステップ7: issync pushで同期

watchモード起動中は自動同期、未起動時は `issync push` を実行

---

## 出力フォーマット

全ステップ完了後、以下の形式でサマリーを提供：

```markdown
## /create-task-issues 実行結果

### 作成されたサブissue
- #124: Status変更時の自動アクション設計
  - ✅ Sub-issueとして親issue #123に紐づけ完了（position: 1）
- #125: /create-task-issues実装
  - ✅ Sub-issueとして親issue #123に紐づけ完了（position: 2, after #124）

合計: 2件

### 更新内容
- ✅ Tasksセクション更新: 2件のタスクに Issue番号を追加 (plan.md:[line_number])
- ✅ Sub-issues API紐づけ完了: 2件のサブissueが親issueと紐づけられました
- ✅ Sub-issues順序設定完了: Tasksセクションの順序と一致
- ✅ issync push完了（watchモードで自動同期）

### 次のアクション
- [ ] 作成されたサブissueを確認してください
- [ ] 各サブissueのStatusを適切に設定してください（before-plan等）
- [ ] 必要に応じて各サブissueで `/plan` コマンドを実行してください
```

---

## 重要な注意事項

### 必須要件
- plan.mdを必ず読む（.issync/state.ymlのlocal_fileパスを使用）
- 既存のフォーマットと構造を保持
- gh CLIを使用（GitHub API直接使用NG）
- issue本文はLLM生成（ステップ4.5参照）、ユーザー確認必須
- 内部ID使用（Issue番号ではなく）: `gh api .../issues/{番号} --jq .id`

### Sub-issues API
- 作成直後に実行: Issue作成→内部ID取得→Sub-issues API
- 順序維持: 1つ目は紐づけのみ、2つ目以降は`after_id`で前タスクの後に配置
- エラーハンドリング: API失敗時も処理継続、ユーザーに報告

### Tasksセクション更新
- `(未Issue化)` → `(#{issue_number})`のみ置換
- タスク名、チェックボックス状態は維持

### エラーハンドリング
- `.issync/state.yml`不在、`(未Issue化)`タスク不在、`gh` CLI不在 → エラー表示して終了
- Issue作成失敗 → 失敗タスクを明示、部分成功も記録

### その他
- issync pushは最後に1回のみ（watchモード時は自動同期）
- 内部IDを記録し、次タスクの順序設定に使用

---

## 実行例

### 例1: 全タスクを作成

**入力**: `/create-task-issues`

**処理**:
1. state.yml読み込み → 親issue #123確認
2. plan.md読み込み → 2件の`(未Issue化)`タスク抽出
3. ユーザー確認 → `y`
4. issue本文生成 → ユーザー確認 → `y`
5. Issue作成+Sub-issues紐づけ → #124, #125
6. Tasksセクション更新 → `(未Issue化)` → `(#124)`, `(#125)`

**出力**: 作成されたサブissue 2件、Tasksセクション更新完了、次のアクション提示

### 例2: 特定タスクのみ作成

**入力**: `/create-task-issues "自動アクション"`

**処理**: 例1と同様だが、「自動アクション」でフィルタリング → 1件のみ作成

**出力**: 作成されたサブissue 1件（Note: 1件のみの場合、順序設定不要）

---

## 補足: Q8 Open Questionとの関連

このコマンドは、task-dashboard.mdの**Open Question Q8**（タスクのサブissue化）を解決するための実装です：

- **選択肢C（ハイブリッド方式）を採用**
  - 大きなタスクのみサブissue化
  - 小タスクはTasksセクションで管理
  - `(未Issue化)`マークで明示的に管理

- **運用フロー**:
  1. before-plan時に大きなタスクを識別し、`(未Issue化)`マークを付与
  2. `/create-task-issues`コマンドで一括Issue化
  3. 自動でTasksセクション更新（`(未Issue化)` → `(#{issue_number})`）
  4. issync pushで同期

このワークフローにより、タスク管理の透明性と効率性が向上します。
