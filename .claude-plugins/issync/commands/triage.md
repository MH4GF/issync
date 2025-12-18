---
description: "プロジェクトの優先issueを分析し、適切なissyncコマンドを提案"
---

# /issync:triage

<constraints>
🚫 NEVER: コマンドを自動実行（提案のみ）
🚫 NEVER: ツール結果を待たずに値を推測
</constraints>

## 1. issue取得

```bash
issync projects list-issues --status=plan,implement --limit ${ARGUMENTS:-3}
```

- 0件 → 「アクティブなissueがありません」で終了

## 2. 並列分析

⚠️ MUST: 単一メッセージで全Task toolを呼び出す

```
Task(
  subagent_type="general-purpose",
  description="Triage #<number>",
  prompt="Issue #<number>を分析:
    1. gh issue view <number> --json url
    2. issync status <url> でパス取得
    3. 進捗ドキュメント読み込み

    判定:
    - Open Questions未解決 → resolve-questions
    - plan + 質問解決済 → implement
    - implement + sub未完 → implement
    - implement + sub全完 or retrospective → complete-sub-issue
    - 進捗ドキュメントなし → /issync:plan

    出力: Summary|Status|Recommended|Reason"
)
```

## 3. 結果出力

<output_format>
## /issync:triage 結果

| Issue | Status | 推奨コマンド | 理由 |
|-------|--------|-------------|------|
| #123 | plan | `/issync:resolve-questions 123` | 未解決の質問2件 |
| #456 | implement | `/issync:implement 456` | AC2未完了 |

**次のステップ**: 実行したいコマンドを選択してください。
</output_format>
