---
description: "ユーザーの要望を受け取り、適切なissyncコマンドを自動選択・実行するルーター"
---

# /issync:exec: コマンドルーター

ユーザーの意図から適切な `/issync:*` コマンドを選択し、SlashCommand ツールで実行する。

**MUST**: このコマンドは必ずいずれかの `/issync:*` コマンドを実行して終了すること。

## 禁止事項

- 「直接修正した方が効率的」等の理由でコマンド実行をスキップしてはならない
- コマンドを実行せずに作業を開始してはならない
- ユーザーに「issyncワークフローで進めますか？」と確認してはならない（このコマンドが呼ばれた時点でissyncワークフローを使う意図は明確）

## 入力

```
$ARGUMENTS
```

## 判断基準

| 意図パターン | 実行コマンド |
|------------|------------|
| 新規タスクを全自動で進めたい | `/issync:develop` |
| 既存issueの続き・状況把握 | `/issync:understand-progress` |
| 調査・検証を行いたい | `/issync:poc` |
| 実装を進めたい | `/issync:implement` |
| 質問を解決したい | `/issync:resolve-questions` |
| サブissueを完了させたい | `/issync:complete-sub-issue` |

## 実行手順

1. `$ARGUMENTS` からユーザーの意図を分析
2. 判断基準に基づいて適切なコマンドを選択
3. 判断基準に該当しない場合のみ AskUserQuestion で確認（選択肢は上記コマンドのみ）
4. SlashCommand ツールで選択したコマンドを実行
