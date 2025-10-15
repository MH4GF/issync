---
description: サブissue完了時に親issueのplan.mdを自動更新し、完了サマリーとFollow-up事項を親issueに反映
---

# /complete-subtask: サブissue完了オペレーション

あなたはユーザーのサブissue完了時に、親issueのplan.mdを自動的に更新するサポートをしています。このコマンドは以下のワークフローを自動化します：
1. サブissue情報のフェッチと親issue番号の抽出
2. サブissueのplan.mdから完了情報を抽出
3. 親issueのplan.mdを更新（Tasks、Outcomes & Retrospectives、Open Questions、Follow-up Issues）
4. サブissueのclose
5. 完了通知

## 使用方法

```bash
/complete-subtask <サブissue URL>
# 例: /complete-subtask https://github.com/MH4GF/issync/issues/456
```

**引数**:
- `サブissue URL` (必須): 完了したサブissueのGitHub URL

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**横断的オペレーション**です：
- **実行タイミング**: `before-retrospective`ステート（サブissueの振り返り記入後）
- サブissue完了時に親issueへ完了情報を自動反映
- Follow-up事項を適切なセクション（Tasks、Open Questions、Follow-up Issues）に振り分け
- 大きなタスクのサブissue化と完了フローの自動化

## 前提条件

実行前に以下が必要です：
- [ ] 親issueのplan.mdがローカルに存在する（`.issync/state.yml`で管理）
- [ ] `issync watch`が実行中（親issueへの変更は自動同期される）
- [ ] サブissueのplan.mdに`Outcomes & Retrospectives`セクションが記載されている
- [ ] `GITHUB_TOKEN`環境変数が設定されている（`export GITHUB_TOKEN=$(gh auth token)`）
- [ ] `gh` CLIがインストールされている

## 実行ステップ

### ステップ1: サブissue情報をフェッチ

サブissue URLから以下を取得：

1. **Issue本文を取得**（`gh issue view <issue_url> --json body`）
2. **親issue番号を抽出**（"Part of #123"パターン）

**親issue番号抽出ロジック**:
```regex
Part of #(\d+)
```

**エラーハンドリング**:
- サブissue URLが無効な場合:
  ```
  エラー: 無効なGitHub Issue URLです。
  正しいフォーマット: https://github.com/owner/repo/issues/123
  ```
- 親issue番号が見つからない場合:
  ```
  エラー: サブissue本文に親issue番号（"Part of #123"）が見つかりません。
  サブissueの本文を確認してください。
  ```

### ステップ2: サブissueのplan.mdを読み込み

サブissueがissyncで管理されている場合、以下を抽出：

1. **Outcomes & Retrospectivesセクション**:
   - 実装内容の1行サマリー
   - 主な発見や学び

2. **Follow-up Issuesセクション**（存在する場合）:
   - 今回のスコープでは対応しなかったが、将来的に別issueとして扱うべき事項

**サブissueがissync管理されていない場合**:
```
警告: サブissueのplan.mdが見つかりません。
Outcomes & Retrospectivesセクションは「（記載なし）」として記録されます。
```

### ステップ3: 親issueのplan.mdを特定

`.issync/state.yml`から親issue番号に対応するplan.mdを検索：

**state.yml構造**:
```yaml
syncs:
  - issue_url: https://github.com/owner/repo/issues/123
    local_file: .issync/docs/task-dashboard.md
    ...
```

**エラーハンドリング**:
- `.issync/state.yml`が存在しない場合:
  ```
  エラー: .issync/state.ymlが見つかりません。
  親issueで `issync init` を実行してください。
  ```
- 親issue番号に対応するplan.mdが見つからない場合:
  ```
  エラー: 親issue #123 のplan.mdがローカルに存在しません。
  親issueで `issync init` を実行してください。
  ```

### ステップ4: 親issueのTasksセクションを更新

サブissueのタイトルを使って、親issueのTasksセクションで該当タスクを検索し、完了マークを付ける：

**検索パターン**:
```regex
- \[ \] (.+?) \(#<サブissue番号>\)
```

**変更前**:
```markdown
- [ ] Status変更時の自動アクション設計 (#124)
```

**変更後**:
```markdown
- [x] Status変更時の自動アクション設計 (#124)
```

**エラーハンドリング**:
- 該当タスクが見つからない場合:
  ```
  ⚠️ 警告: Tasksセクションに該当タスク「#{サブissue番号}」が見つかりませんでした。
  Outcomes & Retrospectivesセクションのみ更新します。
  ```

### ステップ5: 親issueのOutcomes & Retrospectivesセクションを更新

サブタスク完了サマリーを追加：

**追加フォーマット**:
```markdown
**サブタスク完了 (YYYY-MM-DD): [サブissueタイトル] (#[サブissue番号])**
- [実装内容の1行サマリー]
- [主な発見や学び（あれば）]
```

**例**:
```markdown
**サブタスク完了 (2025-10-15): Status変更時の自動アクション設計 (#124)**
- GitHub ActionsでCI成功時のStatus自動変更を実装
- Octokit APIを使用したProjects Status更新の知見を獲得
```

**サブissueのOutcomes & Retrospectivesが空の場合**:
```markdown
**サブタスク完了 (2025-10-15): Status変更時の自動アクション設計 (#124)**
- （記載なし）
```

### ステップ6: Follow-up Issuesを親issueに振り分け

サブissueのFollow-up Issuesセクションの各項目を、内容に応じて親issueの適切なセクションに追加：

**振り分けロジック**:

1. **「別タスクとして扱うべき実装」** → 親issueの**Tasksセクション**に追加
   - キーワード: "実装"、"機能追加"、"対応"、"作成"、"構築"
   - フォーマット: `- [ ] [タスク名] (未Issue化)`

2. **「未解決の質問・将来的な改善課題」** → 親issueの**Open Questionsセクション**に追加
   - キーワード: "検討"、"調査"、"方法"、"どのように"、"改善"、"最適化"
   - フォーマット: `**Q[次の番号]: [質問タイトル]**\n- [詳細]`

3. **「別issueとして扱うべき申し送り事項」** → 親issueの**Follow-up Issuesセクション**に追加
   - キーワード: "別issue"、"今回のスコープ外"、"将来的に"
   - フォーマット: `- [項目内容]`

**振り分け例**:

サブissueのFollow-up Issues:
```markdown
## Follow-up Issues / フォローアップ課題

- GitHub Actionsのリトライロジックの実装を検討
- failedステートの自動判定方法の調査が必要
- Phase 3でE2Eテストを別issueとして作成
```

親issueへの振り分け:
- Tasksセクションに追加: `- [ ] GitHub Actionsのリトライロジックの実装 (未Issue化)`
- Open Questionsセクションに追加: `**Q[次の番号]: failedステートの自動判定方法**\n- GitHub ActionsからIssue Statusを変更する方法を調査`
- Follow-up Issuesセクションに追加: `- Phase 3でE2Eテストを別issueとして作成`

**Follow-up Issuesがない場合**: このステップをスキップ

### ステップ7: サブissueをclose

`gh` CLIを使用してサブissueをclose：

```bash
gh issue close <サブissue URL> --comment "Completed. Summary recorded in parent issue #<親issue番号>."
```

**エラーハンドリング**:
- closeに失敗した場合:
  ```
  ⚠️ 警告: サブissueのcloseに失敗しました。
  手動でcloseしてください: <サブissue URL>
  ```

### ステップ8: 完了通知

編集内容のサマリーを出力（watchが自動同期）：

## 出力フォーマット

全ステップ完了後、以下の形式でサマリーを提供：

```markdown
## /complete-subtask 実行結果

### 完了したサブissue
- #[サブissue番号]: [サブissueタイトル]
- 親issue: #[親issue番号]

### 更新内容
- ✅ Tasksセクション更新: タスク完了マーク (#[サブissue番号]) (plan.md:[line_number])
- ✅ Outcomes & Retrospectives: サブタスク完了サマリー追加 (plan.md:[line_number])
- ✅ Follow-up Issues振り分け: Tasksに[X]件、Open Questionsに[Y]件、Follow-up Issuesに[Z]件追加
- ✅ サブissue #[サブissue番号] をclose
- ✅ 自動同期完了（watchモードで親issueに反映）

### 次のアクション
- [ ] 親issueの更新内容を確認してください
- [ ] 追加されたタスクやOpen Questionsを確認してください
- [ ] 必要に応じて新しいサブissueを作成してください（`/create-task-issues`）
```

---

## 重要な注意事項

### サブissue情報の取得について

- **gh CLIを使用**してissue情報を取得（GitHub API直接使用ではない）
- **親issue番号の抽出は必須**（"Part of #123"パターン）
- サブissueがissync管理されていない場合も処理を続行（Outcomes & Retrospectivesは「記載なし」として記録）

### 親issueのplan.md更新について

- **.issync/state.ymlから親issueのplan.mdを特定**
- **既存のフォーマットと構造を保持**してください
- **タイムスタンプには今日の日付を使用**（YYYY-MM-DD形式）
- **Follow-up Issuesの振り分けはAIが判断**（キーワードベース）

### Tasksセクション更新について

- **該当タスクが見つからない場合は警告を出して続行**
- **チェックボックスのみ変更**（`- [ ]` → `- [x]`）
- **タスク名やIssue番号は変更しない**

### Follow-up Issues振り分けについて

- **内容に応じて適切なセクションに振り分け**（Tasks、Open Questions、Follow-up Issues）
- **Open Questionsに追加する場合は、次の番号を自動で割り当て**
- **Tasksに追加する場合は`(未Issue化)`マークを付与**

### エラーハンドリング

- `.issync/state.yml`が存在しない場合 → エラーメッセージを表示して終了
- 親issue番号が見つからない場合 → エラーメッセージを表示して終了
- 親issueのplan.mdがローカルに不在 → エラーメッセージを表示して終了
- Tasksセクションに該当タスクなし → 警告を出して続行
- サブissueのOutcomes & Retrospectivesが空 → "（記載なし）"として記録
- サブissueのcloseに失敗 → 警告を出して手動close依頼

### その他

- **issync watchが実行中であることを前提**（自動同期）
- **明示的なissync pushは不要**
- **サブissueのclose時にコメントを追加**して親issueへのリンクを記録

---

## 実行例

### 例1: サブissue完了（基本フロー）

**ユーザー:** `/complete-subtask https://github.com/MH4GF/issync/issues/124`

**アシスタント:**

"サブissue完了処理を開始します。

### ステップ1: サブissue情報をフェッチ

[gh issue viewを実行]

サブissue: #124 - Status変更時の自動アクション設計
親issue: #123

### ステップ2: サブissueのplan.mdを読み込み

[サブissueのplan.mdからOutcomes & Retrospectives、Follow-up Issuesを抽出]

Outcomes & Retrospectives:
- GitHub ActionsでCI成功時のStatus自動変更を実装
- Octokit APIを使用したProjects Status更新の知見を獲得

Follow-up Issues:
- GitHub Actionsのリトライロジックの実装を検討
- failedステートの自動判定方法の調査が必要

### ステップ3: 親issueのplan.mdを特定

[.issync/state.ymlから親issue #123のplan.mdを特定]

親issueのplan.md: .issync/docs/task-dashboard.md

### ステップ4-6: 親issueのplan.mdを更新

[Editツールで以下を更新]
- Tasksセクション: #124を完了マーク
- Outcomes & Retrospectives: サブタスク完了サマリー追加
- Tasks: 「GitHub Actionsのリトライロジックの実装 (未Issue化)」を追加
- Open Questions: 「Q13: failedステートの自動判定方法」を追加

### ステップ7: サブissueをclose

[gh issue close実行]

✅ サブissue #124 をcloseしました

## /complete-subtask 実行結果

### 完了したサブissue
- #124: Status変更時の自動アクション設計
- 親issue: #123

### 更新内容
- ✅ Tasksセクション更新: タスク完了マーク (#124) (task-dashboard.md:343)
- ✅ Outcomes & Retrospectives: サブタスク完了サマリー追加 (task-dashboard.md:561)
- ✅ Follow-up Issues振り分け: Tasksに1件、Open Questionsに1件追加
- ✅ サブissue #124 をclose
- ✅ 自動同期完了（watchモードで親issueに反映）

### 次のアクション
- [ ] 親issueの更新内容を確認してください
- [ ] 追加されたタスクやOpen Questionsを確認してください
- [ ] 必要に応じて新しいサブissueを作成してください（`/create-task-issues`）
"

---

### 例2: サブissue完了（サブissueにplan.mdがない場合）

**ユーザー:** `/complete-subtask https://github.com/MH4GF/issync/issues/125`

**アシスタント:**

"サブissue完了処理を開始します。

### ステップ1-2: サブissue情報をフェッチ

サブissue: #125 - /create-task-issues実装
親issue: #123

⚠️ 警告: サブissueのplan.mdが見つかりません。
Outcomes & Retrospectivesセクションは「（記載なし）」として記録されます。

### ステップ3-6: 親issueのplan.mdを更新

[親issueのplan.mdを更新]
- Tasksセクション: #125を完了マーク
- Outcomes & Retrospectives: 「（記載なし）」として追加

### ステップ7: サブissueをclose

✅ サブissue #125 をcloseしました

## /complete-subtask 実行結果

### 完了したサブissue
- #125: /create-task-issues実装
- 親issue: #123

### 更新内容
- ✅ Tasksセクション更新: タスク完了マーク (#125) (task-dashboard.md:348)
- ✅ Outcomes & Retrospectives: サブタスク完了サマリー追加（記載なし） (task-dashboard.md:565)
- ✅ サブissue #125 をclose
- ✅ 自動同期完了（watchモードで親issueに反映）

### 次のアクション
- [ ] 親issueの更新内容を確認してください
- [ ] サブissue #125 の実装内容をOutcomes & Retrospectivesに手動で追記することを検討してください
"

---

## 補足: Q8 Open Questionとの関連

このコマンドは、task-dashboard.mdの**Open Question Q8**（タスクのサブissue化と完了時の申し送り事項の反映）を解決するための実装です：

- **選択肢A（ハイブリッド方式）を採用**
  - 各タスクをサブissue化
  - 完了時に親issueのOutcomes & RetrospectivesとFollow-up Issuesを更新

- **運用フロー**:
  1. `/create-task-issues`でサブissue作成
  2. サブissueで開発（before-plan → before-retrospective）
  3. サブissueのplan.mdにOutcomes & RetrospectivesとFollow-up Issuesを記入
  4. `/complete-subtask`で親issueに自動反映＆サブissueclose

このワークフローにより、サブissueの成果が親issueに確実に反映され、知見の蓄積と次のタスク計画が自動化されます。
