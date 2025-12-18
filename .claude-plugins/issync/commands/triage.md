---
description: "プロジェクトの優先issueを分析し、適切なissyncコマンドを提案"
---

# /issync:triage

優先度順にissueを取得し、並列分析して次のアクションを提案する。

```
/issync:triage      # デフォルト3件
/issync:triage 5    # 5件分析
```

<constraints>
- 🚫 NEVER: コマンドを自動実行しない（提案のみ）
- 🚫 NEVER: ツール結果を待たずに推測で値を埋める
</constraints>

---

## 実行フロー

### Step 1: issue取得

```bash
issync projects list-issues --status=plan,implement --limit $ARGUMENTS
# $ARGUMENTSが空 or 非数値 → デフォルト3
# 出力: JSON配列 [1, 2, 3]（Stage優先順）
```

**0件の場合**: 「アクティブなissueがありません」と報告して終了

### Step 2: 並列分析

⚠️ **MUST**: 単一メッセージで全Task toolを呼び出し（並列実行）

各issueに対して:
```
Task(
  subagent_type="general-purpose",
  description="Triage #<number>",
  prompt="Issue #<number>を分析。
    1. gh issue view <number> --json url でURL取得
    2. issync status <url> で進捗ドキュメントのパス取得
    3. 進捗ドキュメントを読み、Current Status/Open Questions/Sub-issues状態を確認
    4. 判定基準で推奨コマンド決定

    出力: Summary|Status|Recommended|Reason の4項目のみ"
)
```

### Step 3: 判定基準

```
Open Questions未解決        → /issync:resolve-questions
plan + Questions解決済み    → /issync:implement
implement + sub未完了       → /issync:implement（継続）
implement + sub全完了       → /issync:complete-sub-issue
retrospective              → /issync:complete-sub-issue
```

### Step 4: 結果出力

<output_format>
## /issync:triage 実行結果

| Issue | Status | 推奨コマンド | 理由 |
|-------|--------|-------------|------|
| #123 | plan | `/issync:resolve-questions 123` | 未解決の質問が2件 |
| #456 | implement | `/issync:implement 456` | AC2が未完了 |

**次のステップ**: 実行したいコマンドを選択してください。
</output_format>
