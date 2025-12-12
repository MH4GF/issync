<!-- issync:v1:start -->
<!-- Template Version: 21 (2025-12-12) -->

# [Project Name] Progress Document

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

---

## Purpose / Overview

<!-- When: plan | Do: 目的・解決する問題・コアバリューを定義 -->

[目的と解決する問題を記述]

**コアバリュー:**
- [バリュー1]
- [バリュー2]

---

## Context & Direction

<!-- When: plan | Do: 問題の背景、設計哲学を記述。コードベース調査結果を反映 -->

**問題のコンテキスト:**
[問題の背景]

**設計哲学:**
- **[哲学名]**: [説明]

---

## Validation & Acceptance Criteria

<!--
When: plan（初期）→ architecture-decision（検証・更新）
Do: エンドツーエンドシナリオで受け入れ基準を定義

CRITICAL: 全ACに実行可能な検証方法を記載。全検証パス = 完了条件
- 振る舞いで記述（NG: 「関数を実装」→ OK: 「実行すると結果が表示」）
- 検証方法は以下のいずれかのみ:
  - Bashで実行可能なコマンド（テストランナー、CLIコマンド等）
  - MCPブラウザ自動化（chrome-devtools等）
- 自動検証が困難な場合 → Open Questionsへ
-->

**AC1: [シナリオ名]**
1. [前提条件]
2. [操作]
→ 期待結果: [結果]

```bash
# 検証コマンド
[実行可能なコマンドを記載]
```

---

## Specification / 仕様

<!-- When: architecture-decision | Do: POC知見を基にシステム仕様・アーキテクチャを具体化 -->

### [仕様項目1]

[説明]

---

## Open Questions / 残論点

<!--
When: plan/pocで記入 → 各フェーズで解決
Do: 未解決の重要な問い。implementまでに全て解決。優先度高を上に配置

**自信度（推奨案のみ）:**
- 自信度:高🟢 - 既存パターン確認済み
- 自信度:中🟡 - 類似パターンあり、慎重に
- 自信度:低🔴 - 新アプローチ → poc必須

**解決時:** タイトルに取り消し線 + 「✅ 解決済み (日付)」+ 採用理由を記載。削除禁止
-->

**~Q1: [解消済みの質問]~** ✅ 解決済み (YYYY-MM-DD)
- **採用**: [選択肢]
- **理由**: [簡潔に]

**Q2: [未解決の質問]**
- [詳細]

**検討案:**
- **[選択肢A]（推奨 自信度:高🟢）**: [説明]
- **[選択肢B]**: [説明] / トレードオフ: [制約]

---

## Discoveries & Insights

<!-- When: poc以降、継続的 | Do: 技術的制約・複雑性・失敗原因を記録 -->

**YYYY-MM-DD: [タイトル]**
- [発見内容]
- [学び]

---

## Decision Log

<!-- When: architecture-decision | Do: 技術選定、アーキテクチャ決定、トレードオフを記録 -->

**YYYY-MM-DD: [決定事項]**
- **採用**: [技術・手法]
- **理由**: [簡潔に]
- **比較候補**: [他の選択肢]
- **トレードオフ**: [制約・課題]

---

## Outcomes & Retrospectives

<!-- When: retrospective | Do: 完了内容、品質改善、発見、次のステップを記録 -->

**Phase X 完了 (YYYY-MM-DD)**
- **実装完了**: [概要]
- **発見**: [気づき]
- **次のステップ**: [次の作業]

---

## Follow-up Issues

<!-- When: Open Questions解消時、実装中に発見時 | Do: スコープ外だが将来対応すべき事項 -->

- **[課題]**: [説明] (元: Q1 / 優先度: 中)

---

## Confidence Assessment

<!--
When: 各Phase完了時に必須更新
Do: プロジェクト全体の実装確信度を評価（前回を置き換え）

- 自信度:高🟢 - 方針確定、リスク低
- 自信度:中🟡 - 方針あり、一部不確実
- 自信度:低🔴 - 重要決定が未解決
-->

**自信度**: [自信度:高🟢 / 自信度:中🟡 / 自信度:低🔴] - [理由を1行で]

---

## Current Status

<!--
When: フェーズ開始/完了時に自動更新
- Status: plan/poc/architecture-decision/implement/retrospective/done
- Stage: To Start/In Progress/To Review
-->

**Status**: [plan / poc / architecture-decision / implement / retrospective / done]
**Stage**: [To Start / In Progress / To Review]
**最終更新**: YYYY-MM-DD HH:MM:SS
**ネクストアクション**: [人間が取るべき次のアクション]
<!-- issync:v1:end -->
