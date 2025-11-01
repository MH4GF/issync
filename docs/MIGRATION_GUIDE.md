# progress-document-template.md Migration Guide

このドキュメントは、progress-document-template.mdのバージョン間の変更内容とマイグレーション手順を記録します。

## バージョン管理の方針

- **バージョン番号**: 単純な整数（1, 2, 3...）を使用
- **日付**: バージョン番号と共に日付を併記（例: `<!-- Template Version: 1 (2025-10-15) -->`）
- **マイグレーション**: このガイドを参照して、既存のplan.mdを新しいバージョンに更新

**全バージョン共通のマイグレーション最終ステップ**: 変更適用後、plan.mdのバージョンヘッダー（2行目）を対象バージョンに更新

## Version 1-6 (2025-10-15 ~ 2025-10-16)

**主な変更:**
- v1: 初期バージョン（11セクション、HTMLコメントガイダンス）
- v2: Open Questionsのカテゴリ構造をフラット化
- v3: 更新ガイドラインをHTMLコメント化
- v4: issyncマーカー追加（`<!-- issync:v1:start/end -->`）
- v5-6: TasksセクションのGitHub Issue連携ガイダンス整理

**マイグレーション**: カテゴリ見出し削除、ガイドラインHTMLコメント化、issyncマーカー追加

---

## Version 7 (2025-10-17)

**TasksセクションをGitHub Sub-issuesに完全移行（破壊的変更）**

**変更内容:**
- Tasksセクション削除（11セクション → 10セクション）
- GitHub Sub-issuesをSSOTとし、データ重複を排除
- `/create-sub-issue`、`/complete-sub-issue`、`/plan`の仕様変更

**マイグレーション手順:**
1. `## Tasks`見出しから次の`---`まで削除
2. 既存タスクを`/create-sub-issue`でSub-issuesに移行（オプション）

**トレードオフ:** plan.mdでのタスク一覧性が低下、GitHub Projects/APIでの確認が必要

---

## Version 8 (2025-10-17)

**Inboxセクション追加（人間専用の整理前メモエリア）**

**変更内容:**
- 人間が整理前のメモ、リンク、一時情報を記入するスクラッチエリア
- AI/人間の役割を明確に分離

**マイグレーション手順:**
`<!-- issync:v1:end -->`の直前にInboxセクションを挿入（テンプレート参照）

---

## Version 9 (2025-10-17)

**ステート名から`before-`プレフィックス削除（破壊的変更）**

**変更内容:**
- 全ステート名から`before-`プレフィックスを削除（`before-plan` → `plan`等）
- シンプルさ、可読性、一貫性の向上

**マイグレーション手順:**
1. plan.md内の全`before-`プレフィックスを一括置換
2. GitHub Projects Status設定を更新

---

## マイグレーションツール

**`/compact-plan`コマンド:**
- バージョンヘッダー読み取り → 最新版と比較 → マイグレーション提案 → 承認後実行

**手動バージョン確認:**
- plan.md先頭行 `<!-- Template Version: X (YYYY-MM-DD) -->` を確認

**トラブルシューティング:**
- バージョンヘッダーがない: 先頭に追加し、現在の構造から最も近いバージョンを特定
- マイグレーション失敗: GitHub Issueのコメント履歴からバックアップを確認

---

## Version 10 (2025-10-17)

**Open Questionsに「検討案」フォーマット追加**

**変更内容:**
- Open Questionsに「検討案」セクションと「（推奨）」マーカー追加
- AIが叩き台を提示し人間が判断するHITLワークフロー実現

**マイグレーション手順:**
新規は自動適用。既存は次回更新時に任意で適用（テンプレート参照）

---

## Version 11 (2025-10-22)

**ドキュメントタイトルを "Progress Document" に変更**

**変更内容:**
- `# [Project Name] Development Plan` → `# [Project Name] Progress Document`
- 用語統一と明確性向上（生きたドキュメントという性質を表現）

**マイグレーション手順:**
タイトル行を置換（`Development Plan` → `Progress Document`）。既存ドキュメントは任意

---

## Version 12 (2025-10-27)

**ステートマシンを6ステートに簡素化、Stageフィールド導入**

**変更内容:**
- 8ステート → 6ステート（merge/failed削除）
- GitHub Projects カスタムフィールド「Stage」導入（To Start / In Progress / To Review / (empty)）
- Stageで各ステート内の進行状況を3段階表現

**マイグレーション手順:**
1. GitHub Projects設定更新（必須）: Statusフィールド`merge`/`failed`削除、Stageフィールド追加
2. 既存ドキュメント更新（オプショナル）: 次回更新時にステートマシン図を6ステートに更新

---

## Version 13 (2025-10-31)

**Open Questionsに自信度レベル（🟢高/🟡中/🔴低）と解消方法ガイダンス追加**

**変更内容:**
- 推奨案に自信度レベル付与（高🟢/中🟡/低🔴）。低の場合はpocで検証必須
- 取り消し線で履歴保持（`~質問~` ✅ 解決済み + 採用理由記載）

**マイグレーション手順:**
新規は自動適用。既存は次回Open Questions解消時に新フォーマット使用（テンプレート参照）

---

## Version 14 (2025-11-01)

**Deliverables & Notesセクション削除**

**変更内容:**
- Deliverables & Notesセクション削除（10セクション → 9セクション）
- 静的なリファレンス情報は進捗ドキュメントに含めず、README/CLAUDE.md/Specificationセクションで管理
- ドキュメント構造のシンプル化

**マイグレーション手順:**
1. `## Deliverables & Notes`セクション確認
2. 重要な情報がある場合、適切なセクションに移動:
   - コマンドリファレンス → README/CLAUDE.md
   - 設定ファイルフォーマット → Specificationセクション
   - 重要な考慮事項 → Context & DirectionまたはDecision Log
3. `## Deliverables & Notes`セクション全体削除

**注意:** 情報移動先が不明な場合はInboxセクションに一時移動

