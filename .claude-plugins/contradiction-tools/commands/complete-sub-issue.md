---
description: サブissue完了時に親issueのplan.mdを自動更新し、完了サマリーとFollow-up事項を親issueに反映
---

# /complete-sub-issue: サブissue完了オペレーション

あなたはユーザーのサブissue完了時に、親issueのplan.mdを自動的に更新するサポートをしています。このコマンドは以下のワークフローを自動化します：
1. サブissue情報のフェッチと親issue番号の抽出
2. サブissueのplan.mdから完了情報を抽出
3. 親issueのplan.mdを更新（Outcomes & Retrospectives、Open Questions、Follow-up Issues）
4. サブissueのclose
5. 完了通知

## 使用方法

```bash
/complete-sub-issue <サブissue URL>
# 例: /complete-sub-issue https://github.com/MH4GF/issync/issues/456
```

**引数**:
- `サブissue URL` (必須): 完了したサブissueのGitHub URL

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**横断的オペレーション**です：
- **実行タイミング**: `before-retrospective`ステート（サブissueの振り返り記入後）
- サブissue完了時に親issueへ完了情報を自動反映
- Follow-up事項を適切なセクション（Open Questions、Follow-up Issues）に振り分け
- 大きなタスクのサブissue化と完了フローの自動化
- **Note**: Template v7では、plan.mdのTasksセクションが削除されているため、このコマンドはTasksセクションを操作しません

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

**エラーハンドリング**: 無効なURL、親issue番号不在時は明確なエラーメッセージを表示

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

**エラーハンドリング**: state.yml不在、親issue未初期化時はissync initを案内

### ステップ4: 親issueのOutcomes & Retrospectivesセクションを更新

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

### ステップ5: Follow-up Issuesを親issueに振り分け

サブissueのFollow-up Issuesセクションの各項目を、内容に応じて親issueの適切なセクションに追加：

**振り分けロジック**:

1. **「未解決の質問・将来的な改善課題」** → 親issueの**Open Questionsセクション**に追加
   - キーワード: "検討"、"調査"、"方法"、"どのように"、"改善"、"最適化"
   - フォーマット: `**Q[次の番号]: [質問タイトル]**\n- [詳細]`

2. **「別issueとして扱うべき申し送り事項」** → 親issueの**Follow-up Issuesセクション**に追加
   - キーワード: "別issue"、"今回のスコープ外"、"将来的に"、"実装"、"機能追加"、"対応"、"作成"、"構築"
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
- Open Questionsセクションに追加: `**Q[次の番号]: failedステートの自動判定方法**\n- GitHub ActionsからIssue Statusを変更する方法を調査`
- Follow-up Issuesセクションに追加:
  - `- GitHub Actionsのリトライロジックの実装を検討`
  - `- Phase 3でE2Eテストを別issueとして作成`

**Follow-up Issuesがない場合**: このステップをスキップ

### ステップ6: サブissueをclose

`gh` CLIを使用してサブissueをclose：

```bash
gh issue close <サブissue URL> --comment "Completed. Summary recorded in parent issue #<親issue番号>."
```

**エラーハンドリング**: close失敗時は警告を表示し手動closeを依頼

### ステップ7: 完了通知

編集内容のサマリーを出力（watchが自動同期）：

## 出力フォーマット

全ステップ完了後、以下の形式でサマリーを提供：

```markdown
## /complete-sub-issue 実行結果

### 完了したサブissue
- #[サブissue番号]: [サブissueタイトル]
- 親issue: #[親issue番号]

### 更新内容
- ✅ Outcomes & Retrospectives: サブタスク完了サマリー追加 (plan.md:[line_number])
- ✅ Follow-up Issues振り分け: Open Questionsに[X]件、Follow-up Issuesに[Y]件追加
- ✅ サブissue #[サブissue番号] をclose
- ✅ 自動同期完了（watchモードで親issueに反映）

### 次のアクション
- [ ] 親issueの更新内容を確認してください
- [ ] 追加されたOpen QuestionsやFollow-up Issuesを確認してください
- [ ] 必要に応じて新しいサブissueを作成してください（`/create-sub-issue`）
```

---

## 重要な注意事項

- gh CLIでissue情報を取得し、"Part of #123"パターンで親issue番号を抽出
- state.ymlから親issueのplan.mdを特定し、既存フォーマットを保持
- Follow-up事項はキーワードベースでOpen Questions/Follow-up Issuesに振り分け
- issync watch実行中を前提とし、明示的なpushは不要

---

## 実行例

### 例1: サブissue完了（基本フロー）

**ユーザー:** `/complete-sub-issue https://github.com/MH4GF/issync/issues/124`

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
- Outcomes & Retrospectives: サブタスク完了サマリー追加
- Open Questions: 「Q13: failedステートの自動判定方法」を追加
- Follow-up Issues: 「GitHub Actionsのリトライロジックの実装を検討」を追加

### ステップ6: サブissueをclose

[gh issue close実行]

✅ サブissue #124 をcloseしました

## /complete-sub-issue 実行結果

### 完了したサブissue
- #124: Status変更時の自動アクション設計
- 親issue: #123

### 更新内容
- ✅ Outcomes & Retrospectives: サブタスク完了サマリー追加 (task-dashboard.md:561)
- ✅ Follow-up Issues振り分け: Open Questionsに1件、Follow-up Issuesに1件追加
- ✅ サブissue #124 をclose
- ✅ 自動同期完了（watchモードで親issueに反映）

### 次のアクション
- [ ] 親issueの更新内容を確認してください
- [ ] 追加されたOpen QuestionsやFollow-up Issuesを確認してください
- [ ] 必要に応じて新しいサブissueを作成してください（`/create-sub-issue`）
"

---

### 例2: サブissueにplan.mdがない場合

plan.md不在時は「（記載なし）」として記録し、手動追記を提案

---

## 補足: Template v7への完全移行

このコマンドは、task-dashboard.mdの**Decision Log 2025-10-17**（TasksセクションをGitHub Sub-issuesに完全移行）を反映した実装です：

- **完全移行**: GitHub Sub-issuesが完全なSSoT、plan.mdのTasksセクションは使用しない
- **更新内容の変更**:
  - Tasksセクションの更新処理を削除
  - Follow-up Issuesの振り分け先をOpen QuestionsまたはFollow-up Issuesのみに変更

- **運用フロー**:
  1. `/create-sub-issue`でサブissue作成
  2. サブissueで開発（before-plan → before-retrospective）
  3. サブissueのplan.mdにOutcomes & RetrospectivesとFollow-up Issuesを記入
  4. `/complete-sub-issue`で親issueに自動反映＆サブissueclose

このワークフローにより、サブissueの成果が親issueに確実に反映され、知見の蓄積と次のタスク計画が自動化されます。
