# progress-document-template.md Migration Guide

progress-document-template.mdのバージョン間の変更内容とマイグレーション手順を記録。

## バージョン管理の方針

- **バージョン番号**: 整数（1, 2, 3...）
- **日付**: バージョン番号と共に併記（例: `<!-- Template Version: 1 (2025-10-15) -->`）

**全バージョン共通:**
- マイグレーション後、plan.mdのバージョンヘッダー（2行目）を対象バージョンに更新
- 既存のplan-*.mdファイルは任意でマイグレーション可能（新規作成時は最新テンプレートを使用）

---

## Version 1-6 (2025-10-15 ~ 2025-10-16)

- v1: 初期バージョン（11セクション、HTMLコメントガイダンス）
- v2: Open Questionsのカテゴリ構造をフラット化
- v3: 更新ガイドラインをHTMLコメント化
- v4: issyncマーカー追加（`<!-- issync:v1:start/end -->`）
- v5-6: TasksセクションのGitHub Issue連携ガイダンス整理

**マイグレーション**: カテゴリ見出し削除、ガイドラインHTMLコメント化、issyncマーカー追加

---

## Version 7 (2025-10-17)

**Tasksセクション削除（破壊的変更）**

- Tasksセクション削除（11 → 10セクション）
- GitHub Sub-issuesをSSOTに

**マイグレーション**: `## Tasks`見出しから次の`---`まで削除

---

## Version 8 (2025-10-17)

**Inboxセクション追加**

人間専用の整理前メモエリア。

**マイグレーション**: `<!-- issync:v1:end -->`の直前にInboxセクションを挿入

*注: Version 16で削除*

---

## Version 9 (2025-10-17)

**ステート名から`before-`プレフィックス削除（破壊的変更）**

`before-plan` → `plan` 等

**マイグレーション**:
1. plan.md内の全`before-`プレフィックスを一括置換
2. GitHub Projects Status設定を更新

---

## Version 10 (2025-10-17)

**Open Questionsに「検討案」フォーマット追加**

AIが叩き台を提示し人間が判断するHITLワークフロー実現。

**マイグレーション**: 新規は自動適用。既存は次回更新時に任意で適用

---

## Version 11 (2025-10-22)

**ドキュメントタイトル変更**

`# [Project Name] Development Plan` → `# [Project Name] Progress Document`

**マイグレーション**: タイトル行を置換

---

## Version 12 (2025-10-27)

**6ステートに簡素化、Stageフィールド導入**

- 8ステート → 6ステート（merge/failed削除）
- GitHub Projects「Stage」フィールド導入（To Start / In Progress / To Review）

**マイグレーション**:
1. GitHub Projects設定更新: Statusフィールド`merge`/`failed`削除、Stageフィールド追加
2. 既存ドキュメント: 次回更新時にステートマシン図を6ステートに更新（任意）

---

## Version 13 (2025-10-31)

**Open Questionsに自信度レベル追加**

- 推奨案に自信度レベル付与（自信度:高🟢/自信度:中🟡/自信度:低🔴）
- 取り消し線で履歴保持（`~質問~` ✅ 解決済み + 採用理由記載）

**マイグレーション**: 新規は自動適用。既存は次回Open Questions解消時に新フォーマット使用

---

## Version 14 (2025-11-01)

**Deliverables & Notesセクション削除**

10 → 9セクション。静的リファレンス情報はREADME/CLAUDE.md/Specificationで管理。

**マイグレーション**:
1. `## Deliverables & Notes`セクション確認
2. 重要情報を適切なセクションに移動（README、Specification、Decision Log等）
3. セクション全体を削除

---

## Version 15 (2025-11-06)

**Confidence Assessmentセクション追加**

プロジェクト全体の実装確信度を3段階で評価。各Phase完了時に更新。

**マイグレーション**: Outcomes & Retrospectivesの直後にConfidence Assessmentセクションを挿入（テンプレート参照）

---

## Version 16 (2025-11-06)

**Inboxセクション削除**

9 → 8セクション。実際にほとんど使用されていないため削除。

**マイグレーション**: `## Inbox`セクションを削除

---

## Version 17 (2025-11-06)

**Follow-up Issuesセクションの位置変更**

Outcomes & Retrospectivesの直後、Confidence Assessmentの直前に移動。

**マイグレーション**: Follow-up Issuesセクション全体を切り取り、新しい位置に貼り付け

---

## Version 18 (2025-11-08)

**テンプレート簡潔化と日本語統一**

- HTMLコメント内の冗長な記述を削除
- Confidence Assessmentの自信度レベルを日本語に統一: `High 🟢` → `高🟢` 等

**マイグレーション**:
1. 不要なHTMLコメント内ヘッダー削除（該当する場合）
2. 自信度レベル表記を日本語に置換

---

## Version 19 (2025-11-12)

**Current Statusセクション追加**

進捗ドキュメントの現在の状態（Status、Stage、最終更新、ネクストアクション）を可視化。

**マイグレーション**: Confidence Assessmentの直後、`<!-- issync:v1:end -->`の直前にCurrent Statusセクションを挿入（テンプレート参照）

---

## Version 20 (2025-12-02)

**Validation & Acceptance Criteriaのテスト必須化**

- エンドツーエンドシナリオ形式を標準化
- テスト必須化（全テストパス = 完了条件）
- 実装軸 → 振る舞い記述へ移行

**マイグレーション**:
1. ACをシナリオ形式に変換（前提→操作→期待結果）
2. 各ACにテスト方法を追加
3. 実装軸の記述を振る舞い記述に変更

例: ❌「`listCommand()`を実装」 → ✅「`issync list`実行で全設定が表示される」

---

## Version 21 (2025-12-12)

**テンプレート全体の簡素化とプロンプト最適化**

- 冒頭ガイドラインを大幅簡素化（45行→23行）
- 全セクションのガイダンスを「When: | Do:」形式に統一
- 検証方法を実行可能なコマンドに限定（Bash、MCPブラウザ自動化）
- 各セクションのプレースホルダーを最小限に
- 「gitにコミットしない」旨を追加

**マイグレーション**:

1. **冒頭ガイドラインを置換**

```markdown
<!--
## AI向け更新ルール

この進捗ドキュメントは生きた文書。新情報が出るたびに該当セクションのみを更新する。
このファイルはgitにコミットしない（issyncでGitHub Issueと同期される）。

**ワークフロー（6ステート）:**
plan → poc → architecture-decision → implement → retrospective → done

**MUST:**
- 変更は該当セクションのみ、最小限に
- 箇条書きで簡潔に
- 既存の簡潔な表現を維持

**NEVER:**
- 複数セクションを同時に大幅書き換え
- 既存表現を冗長に置き換え
- 情報を別の表現で繰り返す
-->
```

2. **セクションガイダンスを簡素化**（任意）
   - `📝 Guidance for AI + 記入タイミング/記入内容` → `When: | Do:` 形式

3. **検証方法をコードブロック形式に変更**
```markdown
```bash
# 検証コマンド
[実行可能なコマンドを記載]
```
```

4. **セクション名を更新**（任意）
   - `Follow-up Issues / フォローアップ課題` → `Follow-up Issues`

---

## Version 22 (2025-12-22)

**スケルトンテスト駆動の受け入れ条件定義**

受け入れ条件をスケルトンテスト（`test.todo()`）として定義し、テストから Open Questions を導出する新ワークフロー。

**変更内容**:
- Validation & Acceptance Criteria: シナリオ形式 → テストファイル参照形式
- Open Questions: テストから導出、`/issync:align-spec` で解消
- 自信度表記簡素化: `自信度:高🟢` → `🟢高`
- 関連テストへの参照を追加

**マイグレーション**:

1. **Validation & Acceptance Criteria を置換**

```markdown
**テストファイル**: `[テストファイルパス]`

**検証コマンド**:
```bash
bun test [テストファイルパス]
```

**テストケース一覧**:
- [シナリオ1]
  - [テストケース1]
```

2. **Open Questions に関連テストを追加**（任意）

```markdown
**Q1: [質問]**
[テストを書けなかった理由]

**関連テスト**: `path/to/test.ts` の `test.todo("...")`
```

3. **自信度表記を更新**（任意）
   - `（推奨 自信度:高🟢）` → `（推奨 🟢）`

---

## マイグレーションツール

**`/compact-progress-document`コマンド:**
バージョンヘッダー読み取り → 最新版と比較 → マイグレーション提案 → 承認後実行

**手動バージョン確認:**
plan.md先頭行 `<!-- Template Version: X (YYYY-MM-DD) -->` を確認

**トラブルシューティング:**
- バージョンヘッダーがない: 先頭に追加し、現在の構造から最も近いバージョンを特定
- マイグレーション失敗: GitHub Issueのコメント履歴からバックアップを確認
