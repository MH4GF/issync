---
description: サブissue完了時に親issueのplan.mdを自動更新し、完了サマリーとFollow-up事項を適切に処理（Open Questions追加、/create-sub-issue提案）
---

# /complete-sub-issue: サブissue完了オペレーション

あなたはユーザーのサブissue完了時に、親issueのplan.mdを自動的に更新するサポートをしています。このコマンドは以下のワークフローを自動化します：
1. サブissue情報のフェッチと親issue番号の抽出
2. サブissueのplan.mdから完了情報を抽出
3. 親issueのplan.mdを更新（Outcomes & Retrospectives、Open Questions）
4. Follow-up事項の適切な処理提案（Open Questions追加または/create-sub-issue実行提案）
5. サブissueのclose
6. 完了通知

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

### ステップ5: Follow-up Issuesの適切な処理

サブissueのFollow-up Issuesをキーワードベースで分類し処理：

1. **論点・調査事項** → 親issueの**Open Questionsに自動追加**
   - キーワード: "検討"、"調査"、"方法"、"どのように"、"理由"、"判断"、"選択"、"課題"
   - フォーマット: `**Q[次の番号]: [質問タイトル]**\n- [詳細]`

2. **実装タスク** → **`/create-sub-issue`実行を提案**（完了サマリーで提示、自動作成はしない）
   - キーワード: "実装"、"機能追加"、"対応"、"作成"、"構築"、"別issue"、"今回のスコープ外"、"将来的に"

**重要**: 親issueのFollow-up Issuesセクションへの転記は禁止。親issueが適切なネクストアクションを実施できるよう支援する。

### ステップ6: サブissueをclose

```bash
gh issue close <サブissue URL> --comment "Completed. Summary recorded in parent issue #<親issue番号>."
```

エラー時は警告を表示し手動closeを依頼。

### ステップ7: 完了通知

編集内容のサマリーを出力（watchが自動同期）。フォーマットは「出力フォーマット」セクション参照。

## 出力フォーマット

全ステップ完了後、以下の形式でサマリーを提供：

```markdown
## /complete-sub-issue 実行結果

### 完了したサブissue
- #[サブissue番号]: [サブissueタイトル]
- 親issue: #[親issue番号]

### 更新内容
- ✅ Outcomes & Retrospectives: サブタスク完了サマリー追加 (plan.md:[line_number])
- ✅ Follow-up Issues処理: Open Questionsに[X]件追加
- ✅ サブissue #[サブissue番号] をclose
- ✅ 自動同期完了（watchモードで親issueに反映）

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

## 重要な注意事項

**技術的制約**:
- gh CLIで"Part of #123"パターンから親issue番号を抽出
- `.issync/state.yml`から親issueのplan.mdを特定
- issync watch実行中を前提（明示的なpushは不要）

**Follow-up処理方針**（詳細はステップ5参照）:
- 論点・調査事項 → Open Questionsに自動追加
- 実装タスク → `/create-sub-issue`実行を提案
- **親issueのFollow-up Issuesセクションへの転記は禁止**

**エラーハンドリング**:
- state.yml不在、親issue未初期化 → issync init案内
- サブissueのplan.md不在 → 「（記載なし）」として記録
- issue close失敗 → 警告表示、手動close依頼

---

## 実行例

**入力**: `/complete-sub-issue https://github.com/MH4GF/issync/issues/124`

**処理**:
1. サブissue #124（Status変更時の自動アクション設計）から親issue #123を特定
2. サブissueのplan.mdからOutcomes & RetrospectivesとFollow-up Issuesを抽出
3. 親issueのplan.md（.issync/docs/task-dashboard.md）を更新:
   - Outcomes & Retrospectives: サブタスク完了サマリー追加
   - Open Questions: 「failedステートの自動判定方法の調査」を追加
4. 実装タスク（「リトライロジック実装」「E2Eテスト環境構築」）は`/create-sub-issue`実行を提案
5. サブissue #124をclose

**出力**: 「出力フォーマット」セクション参照

---

## 運用フロー

1. `/create-sub-issue`でサブissue作成
2. サブissueで開発（plan → retrospective）
3. サブissueのplan.mdにOutcomes & RetrospectivesとFollow-up Issuesを記入
4. `/complete-sub-issue`で親issueに自動反映＆サブissueclose
5. 必要に応じて`/create-sub-issue`で次のサブissueを作成

**設計原則**: GitHub Sub-issuesを完全なSSOTとし、plan.mdのTasksセクションは使用しない。サブissueの成果を親issueに確実に反映し、知見蓄積と次のタスク計画を自動化する。
