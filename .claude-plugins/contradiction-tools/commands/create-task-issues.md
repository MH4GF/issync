---
description: `(未Issue化)`マーク付きタスクを一括でGitHub Issueに変換し、親issueとのリンクを自動管理
---

# /create-task-issues: タスクのサブissue化ワークフロー

あなたはユーザーのplan.mdファイル内のタスクを、GitHub Issueとして作成するサポートをしています。このコマンドは以下のワークフローを自動化します：
1. `.issync/state.yml`から親issue情報を取得
2. Tasksセクションから`(未Issue化)`マーク付きタスクを抽出
3. ユーザーに確認
4. GitHub Issueを一括作成
5. Tasksセクションを自動更新
6. issync pushで同期

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**横断的オペレーション**です：
- **どのステートでも実行可能**（before-plan、before-poc、before-architecture-decision、before-implement）
- 大きなタスクのみサブissue化し、小さなタスクはTasksセクションで管理（ハイブリッド方式）
- `(未Issue化)`マークで明示的に管理すべきタスクを識別
- 作成されたサブissueは自動的に親issueとリンク

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

`local_file`を読み込み、以下を抽出：
1. **Tasksセクション全体**
2. **Purpose/Overviewセクション**の最初の段落（Issue本文に引用）
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

### ステップ5: GitHub Issueを一括作成

各タスクに対して、以下の形式でIssueを作成：

**Issue作成コマンド**:
```bash
gh issue create \
  --repo {owner}/{repo} \
  --title "{タスク名}" \
  --body "$(cat <<'EOF'
Part of #{親issue番号}

## Context
{親issueのPurpose/Overviewセクションから最初の段落を引用}

## Acceptance Criteria
- TBD (to be defined during before-plan phase)

## Related
- Parent issue: #{親issue番号}
- Progress document: [View in parent issue]({親issueのURL})
EOF
)"
```

**作成されるIssueの例**:
- **タイトル**: "Status変更時の自動アクション設計"
- **本文**:
  ```markdown
  Part of #123

  ## Context
  issyncを活用し、GitHub Projects StatusフィールドのステートマシンとAIエージェントによる完全リモート開発ワークフローを構築する。

  ## Acceptance Criteria
  - TBD (to be defined during before-plan phase)

  ## Related
  - Parent issue: #123
  - Progress document: [View in parent issue](https://github.com/owner/repo/issues/123)
  ```

**作成結果の記録**:
各Issue作成後、Issue番号を記録：
```
Created issue #124: Status変更時の自動アクション設計
Created issue #125: /create-task-issues実装
```

### ステップ6: Tasksセクションを更新

作成したIssue番号を使って、Tasksセクションを更新：

**変更前**:
```markdown
- [ ] Status変更時の自動アクション設計 (未Issue化)
- [ ] /create-task-issues実装 (未Issue化)
```

**変更後**:
```markdown
- [ ] Status変更時の自動アクション設計 (#124)
- [ ] /create-task-issues実装 (#125)
```

**Edit tool使用**:
- 各タスクについて、`(未Issue化)` → `(#{issue_number})`に置換
- 1タスクずつEditツールを呼び出す

### ステップ7: issync pushで同期

**注意**: issyncのwatchモードが起動している場合は、ファイルの変更が自動的にGitHub Issueに同期されます。明示的なpushコマンドは不要です。

watchモードが起動していない場合は、以下を実行：
```bash
issync push
```

---

## 出力フォーマット

全ステップ完了後、以下の形式でサマリーを提供：

```markdown
## /create-task-issues 実行結果

### 作成されたサブissue
- #124: Status変更時の自動アクション設計
- #125: /create-task-issues実装

合計: 2件

### 更新内容
- ✅ Tasksセクション更新: 2件のタスクに Issue番号を追加 (plan.md:[line_number])
- ✅ issync push完了（watchモードで自動同期）

### 次のアクション
- [ ] 作成されたサブissueを確認してください
- [ ] 各サブissueのStatusを適切に設定してください（before-plan等）
- [ ] 必要に応じて各サブissueで `/plan` コマンドを実行してください
```

---

## 重要な注意事項

### plan.mdの読み込みについて

- **必ずplan.mdファイルを読んでください** - .issync/state.ymlから取得したlocal_fileパスを使用
- **既存のフォーマットと構造を保持**してください
- タスクが見つからない場合は、明確に報告してください

### Issue作成について

- **gh CLIを使用**してIssueを作成（GitHub API直接使用ではない）
- **親issue番号は必ず含める**（"Part of #{親issue番号}"形式）
- **Context引用は最初の段落のみ**（長すぎる場合は省略可）
- **Acceptance Criteriaは"TBD"**で統一（詳細は各サブissueのbefore-planフェーズで定義）

### Tasksセクション更新について

- **`(未Issue化)` → `(#{issue_number})`の置換のみ**を行う
- **タスク名は変更しない**
- **チェックボックス状態は維持**（`- [ ]`のまま）
- **他のタスクに影響を与えない**

### エラーハンドリング

- `.issync/state.yml`が存在しない場合 → エラーメッセージを表示して終了
- `(未Issue化)`タスクが見つからない場合 → エラーメッセージを表示して終了
- `gh` CLIが利用できない場合 → エラーメッセージを表示して終了
- Issue作成に失敗した場合 → どのタスクで失敗したか明確に報告し、部分的に成功したタスクも記録

### その他

- **issync pushは最後に1回のみ**実行（各タスク更新後ではない）
- **watchモード起動中は自動同期**されるため、明示的なpushは不要
- **作成したIssue番号は必ず記録**し、ユーザーに報告

---

## 実行例

### 例1: 全ての(未Issue化)タスクを作成

**ユーザー:** `/create-task-issues`

**アシスタント:**

"タスクのサブissue化をサポートします。

### ステップ1: .issync/state.ymlから親issue情報を取得

[.issync/state.ymlを読み込み]

親issue: https://github.com/MH4GF/issync/issues/123
対象ファイル: .issync/docs/task-dashboard.md

### ステップ2: plan.mdからタスクを抽出

[.issync/docs/task-dashboard.mdを読み込み、Tasksセクションをパース]

Found 2 task(s) marked as (未Issue化):

1. [ ] Status変更時の自動アクション設計
2. [ ] /create-task-issues実装

親issue: #123 (https://github.com/MH4GF/issync/issues/123)

これらのタスクをサブissueとして作成しますか？ (y/n):"

**ユーザー:** `y`

**アシスタント:**

"### ステップ5: GitHub Issueを作成

[gh issue createを2回実行]

Created issue #124: Status変更時の自動アクション設計
Created issue #125: /create-task-issues実装

### ステップ6: Tasksセクションを更新

[Editツールで`(未Issue化)` → `(#124)`, `(#125)`に置換]

### ステップ7: 同期

watchモードが起動しているため、自動的にGitHub Issueに同期されます。

## /create-task-issues 実行結果

### 作成されたサブissue
- #124: Status変更時の自動アクション設計
- #125: /create-task-issues実装

合計: 2件

### 更新内容
- ✅ Tasksセクション更新: 2件のタスクに Issue番号を追加 (task-dashboard.md:343-348)
- ✅ issync push完了（watchモードで自動同期）

### 次のアクション
- [ ] 作成されたサブissueを確認してください
- [ ] 各サブissueのStatusを適切に設定してください（before-plan等）
- [ ] 必要に応じて各サブissueで `/plan` コマンドを実行してください
"

---

### 例2: 特定のタスクのみ作成

**ユーザー:** `/create-task-issues "自動アクション"`

**アシスタント:**

"タスクのサブissue化をサポートします。

### ステップ1-3: タスク抽出とフィルタリング

[.issync/state.ymlとplan.mdを読み込み、「自動アクション」でフィルタリング]

Found 1 task(s) matching "自動アクション":

1. [ ] Status変更時の自動アクション設計

親issue: #123 (https://github.com/MH4GF/issync/issues/123)

このタスクをサブissueとして作成しますか？ (y/n):"

**ユーザー:** `y`

**アシスタント:**

"[Issue作成とTasksセクション更新を実行]

## /create-task-issues 実行結果

### 作成されたサブissue
- #124: Status変更時の自動アクション設計

合計: 1件

### 更新内容
- ✅ Tasksセクション更新: 1件のタスクに Issue番号を追加 (task-dashboard.md:343)
- ✅ issync push完了（watchモードで自動同期）
"

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
