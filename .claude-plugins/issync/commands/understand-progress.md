---
description: 進捗ドキュメントを選択してコンテキストを理解
---

# /issync:understand-progress

**Usage**: `/issync:understand-progress https://github.com/owner/repo/issues/123`

## ⚠️ 禁止事項

全データは実行結果から取得。推測・捏造は一切禁止:
- ツールを実行せずに推測で値を埋める
- ツール結果を待たずに次ステップへ進む
- 存在しないデータ(ファイルパス、行数、日時)を捏造する

---

## 実行ステップ

### 1. 同期設定の確認

```bash
issync status <issue_url>
# 設定なし → issync init <issue_url>
```
→ `local_file`パス取得

### 2. ファイル読み込み

Readツールで全行読み込み (offset/limit指定なし) → 総行数・ファイルパス記録

### 3. Sub-issues取得

```bash
gh api "/repos/{owner}/{repo}/issues/{issue_number}/sub_issues" \
  --jq '.[] | {number, title, state, url}'
```
→ CLOSED(実装済み)、OPEN(残タスク)を分析してフェーズ判定

### 4. コミット履歴確認

```bash
git log --oneline -20
```

---

## 出力 (全ステップ完了後のみ)

```markdown
## /issync:understand-progress 実行結果

✅ コンテキストを理解しました

**ファイル**: <file_path> (<total_lines>行)
**Issue**: <issue_url>
**最終同期**: <last_synced_at>
**Sub-issues**: <total>件 (OPEN: <open>, CLOSED: <closed>)
**プロジェクト状態**: <簡潔なサマリー>

[500行超の場合のみ] ⚠️ **警告**: `/compact-progress-document` 推奨

**次のアクション**: <状況に応じた具体的なアクション提案>
```

---

## 進捗ドキュメント更新ルール

**更新タイミング:** 決定時 → Decision Log / 発見時 → Discoveries & Insights / 疑問時 → Open Questions / 完了時 → Outcomes & Retrospectives / フェーズ移行時 → Current Status

**更新方法:** Edit/Updateツールでセクション単位更新 (全体書き換え禁止) → `issync push` で同期 (ユーザー確認不要、高頻度更新推奨)

**Single Source of Truth**: 進捗ドキュメント = 現在の状態
