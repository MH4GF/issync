<!-- issync:v1:start -->
<!-- Template Version: 22 (2025-12-20) -->

# [Project Name] Progress Document

<!--
## AI向け更新ルール

この進捗ドキュメントは生きた文書。新情報が出るたびに該当セクションのみを更新する。
このファイルはgitにコミットしない（issyncでGitHub Issueと同期される）。

**ワークフロー（4ステート）:**
plan → implement → retrospective → done

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
When: plan（スケルトンテスト作成）→ align-spec（具体化）→ implement（実装）
Do: 受け入れ条件をスケルトンテストとして定義。全テストパス = 完了条件

CRITICAL: テストファイルを参照し、検証コマンドを記載
- planフェーズで test.todo() としてテストケースを定義
- align-specフェーズで仕様確定後にテスト内容を具体化
- テスト困難な場合 → Open Questionsへ
-->

**テストファイル**: `[テストファイルパス]`

**検証コマンド**:
```bash
bun test [テストファイルパス]
```

**テストケース一覧**:
- [シナリオ1]
  - [テストケース1]
  - [テストケース2]
- [シナリオ2]
  - [テストケース3]

---

## Specification / 仕様

<!-- When: plan | implement | Do: システム仕様・アーキテクチャを具体化 -->

### [仕様項目1]

[説明]

---

## Open Questions / 残論点

<!--
When: plan（テストから導出）→ align-spec（解消）
Do: テストを書く過程で浮かんだ疑問。implementまでに全て解決

**導出**: スケルトンテスト作成時に書けなかった理由を記録
**解消**: /issync:align-spec で意思決定し、テストを更新

**自信度（推奨案のみ）:**
- 🟢高 - 既存パターン確認済み
- 🟡中 - 類似パターンあり
- 🔴低 - 前例なし → 検証項目併記

**解決時:** タイトルに取り消し線 + 「✅ 解決済み (日付)」+ 決定内容を記載
-->

**~Q1: [解消済みの質問]~** ✅ 解決済み (YYYY-MM-DD)
- **決定**: [採用案]
- **理由**: [簡潔に]

**Q2: [未解決の質問]**
[テストを書けなかった理由]

**関連テスト**: `path/to/test.ts` の `test.todo("...")`

**検討案:**
- **[選択肢A]（推奨 🟢）**: [説明]
- **[選択肢B]**: [説明] / トレードオフ: [制約]

---

## Discoveries & Insights

<!-- When: plan以降、継続的 | Do: 技術的制約・複雑性・失敗原因を記録 -->

**YYYY-MM-DD: [タイトル]**
- [発見内容]
- [学び]

---

## Decision Log

<!-- When: plan | implement | Do: 技術選定、アーキテクチャ決定、トレードオフを記録 -->

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
- Status: plan/implement/retrospective/done
- Stage: To Start/In Progress/To Review
-->

**Status**: [plan / implement / retrospective / done]
**Stage**: [To Start / In Progress / To Review]
**最終更新**: YYYY-MM-DD HH:MM:SS
**ネクストアクション**: [人間が取るべき次のアクション]
<!-- issync:v1:end -->
