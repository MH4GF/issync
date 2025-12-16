---
name: exec-issync
description: 「exec-issync 〇〇がしたい」と発話されたとき、ユーザーの意図を理解して適切な/issync:*コマンドを選択・実行する。
---

# exec-issync

ユーザーの意図から適切な `/issync:*` コマンドを選択し、SlashCommand ツールで実行する。

## 判断基準

- 新規タスクを全自動で進めたい → `/issync:develop`
- 既存issueの続き・状況把握 → `/issync:understand-progress` から
- 不明な場合 → ユーザーに確認
