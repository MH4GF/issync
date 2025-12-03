---
description: Status="retrospective"の全issueに対して/issync:complete-sub-issueを自動実行
---

# /issync:process-retrospective-lane

GitHub ProjectsのStatus="retrospective"にある全issueに対して`/issync:complete-sub-issue`を自動実行します。

**使用方法**: `/issync:process-retrospective-lane`（引数なし）

## 実行ステップ

1. `issync projects list-issues --status=retrospective`でissue番号を取得（JSON配列）
2. **Task toolを使用して各issueを並列処理**: 各issueに対してTask tool (subagent_type='general-purpose')を起動し、`/issync:complete-sub-issue`を並列実行

**重要**: 必ず**単一メッセージで複数のTask tool呼び出し**を行うこと。これにより並列実行が可能になり、処理時間を大幅に短縮できます。

```markdown
# 実装例（擬似コード）
issues = issync projects list-issues --status=retrospective

# 単一メッセージで全issueのTask toolを呼び出し（並列実行）
for issue in issues:
  Task(
    subagent_type="general-purpose",
    description=f"Process issue #{issue} completion",
    prompt=f"Execute `/issync:complete-sub-issue {issue}` and report a brief summary."
  )
```
