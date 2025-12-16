---
description: 「〇〇がしたい」という要望を受け取り、適切な/issync:*コマンドを自動選択・実行するルーター
---

# /issync:exec: コマンドルーター

ユーザーの意図から適切な `/issync:*` コマンドを選択し、SlashCommand ツールで実行する。

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
3. 不明な場合はAskUserQuestionでユーザーに確認
4. SlashCommandツールで選択したコマンドを実行
