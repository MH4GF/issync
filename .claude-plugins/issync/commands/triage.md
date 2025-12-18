---
description: "プロジェクトの優先issueを分析し、適切なissyncコマンドを提案するルーター"
---

# /issync:triage

GitHub ProjectsのStatusが`plan`または`implement`のissueをStage優先順で取得し、上位N件を並列分析して適切なコマンドを提案します。

**使用方法**: `/issync:triage` または `/issync:triage 5`（分析するissue数を指定）

## 設計思想

**人間の判断を排除するのではなく、良い提案で判断を助ける**

- コマンドは自動実行しない（提案のみ）
- 各issueの状況を簡潔にサマリーし、推奨コマンドを提示
- 最終的な実行判断はユーザーが行う

## 実行ステップ

### 1. issue一覧取得

```bash
issync projects list-issues --status=plan,implement --limit <N>
```

- デフォルト: N=3
- 引数指定: `$ARGUMENTS`の数値を使用
- 出力: JSON配列 `[1, 2, 3]`
- ソート: Stage優先順（To Start > In Progress > To Review > 未設定）

### 2. 並列分析

**Task toolを使用して各issueを並列分析**

各issueに対してTask tool (subagent_type='general-purpose')を起動:

```markdown
# 単一メッセージで全issueのTask toolを呼び出し（並列実行）
for issue in issues:
  Task(
    subagent_type="general-purpose",
    description=f"Analyze issue #{issue}",
    prompt="""
Execute `/issync:understand-progress <issue_url>` for issue #<issue>.

After understanding the context, determine the recommended next action:
- If Open Questions exist → `/issync:resolve-questions`
- If plan phase with no open questions → `/issync:implement`
- If implement phase with sub-issues incomplete → continue implementing
- If all sub-issues complete → `/issync:complete-sub-issue`

Report:
1. Issue summary (1-2 sentences)
2. Current phase
3. Recommended command with reason
"""
  )
```

**重要**: 必ず**単一メッセージで複数のTask tool呼び出し**を行うこと。これにより並列実行が可能になり、処理時間を大幅に短縮できます。

### 3. 結果サマリー

全Task完了後、以下の形式で出力:

```markdown
## /issync:triage 実行結果

| # | Issue | Phase | Recommended Command | Reason |
|---|-------|-------|---------------------|--------|
| 1 | #123 | plan | `/issync:resolve-questions 123` | 未解決の質問が2件存在 |
| 2 | #456 | implement | `/issync:implement 456` | AC2の実装が未完了 |
| 3 | #789 | implement | `/issync:complete-sub-issue 789` | 全ACが完了済み |

**次のステップ**: 上記コマンドを確認し、実行したいものを選択してください。
```

## 注意事項

- 分析結果は現時点のスナップショット
- 推奨コマンドは参考情報であり、状況に応じて別のコマンドを選択可能
- issueが0件の場合は「アクティブなissueがありません」と報告
