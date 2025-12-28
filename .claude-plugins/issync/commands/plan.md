---
description: コードベース調査→受け入れ条件明確化→Open Questions導出で進捗ドキュメントを作成
---

# /issync:plan

進捗ドキュメント（`.issync/docs/plan-{番号}-{slug}.md`）を作成。10ステップ：

1. 前提確認 & issync init & Stage設定（In Progress）
2. Issue内容確認
3. **タスク種別判定**
4. コードベース調査
5. **受け入れ条件の明確化**（種別に応じた検証戦略）
6. **Open Questions精査 & 分割判断**
7. 基本セクション記入
8. 成果物をコミット & issync push & Stage更新（To Review）
9. Status/Stage変更 & ラベル付与（implement, To Start）
10. 分割対応（該当時のみ）

## 前提条件

- GitHub Issue作成済み
- `ISSYNC_GITHUB_TOKEN`設定済み

## ステップ詳細

### 1. 前提確認 & issync init & Stage設定

```bash
issync status <Issue URL>
```
- 設定あり → ステップ2へ
- 設定なし → `issync init <Issue URL> --file .issync/docs/plan-{番号}-{slug}.md`

Projects連携時: `issync projects set-stage "$ISSUE_URL" "in_progress"`

### 2. Issue内容確認

Issue内容を理解、不明点はユーザーに確認。

### 3. タスク種別判定

Issue内容から種別を判定し、検証戦略を決定：

| 種別 | 例 | 検証戦略 |
|------|-----|----------|
| **code** | 機能実装、バグ修正、リファクタ | スケルトンテスト（test.todo） |
| **config** | linter、CI、ビルド設定 | 検証コマンド + 期待結果 |
| **infra** | terraform、k8s、Docker | plan出力 + 手動検証チェックリスト |
| **docs** | README、ADR、ドキュメント | レビュー観点リスト |

**判定基準**: 主な成果物は何か？
- `.ts`, `.js`, `.py` 等のアプリコード → code
- `.json`, `.yml`, `.toml` 等の設定ファイル → config
- `.tf`, `Dockerfile`, `k8s/*.yaml` → infra
- `.md` 等のドキュメント → docs

**複合タスクの場合**: 主要な成果物の種別を選択。

### 4. コードベース調査（CRITICAL）

**複雑度判定**:
| 複雑度 | Agent数 | 調査内容 |
|--------|---------|----------|
| Simple | 1 | 類似機能パターン |
| Moderate | 2 | + テスト戦略 |
| Complex | 3 | + 技術スタック |

外部ライブラリ/新技術採用時は Agent 4（外部調査）追加。

**実行**: 単一メッセージで複数Task tool呼び出し。各Agentは `.claude-plugins/issync/agents/codebase-explorer.md` に従う。

**集約**: 全Agentの特定ファイルを読み、Discoveries & Insightsに記録。

### 5. 受け入れ条件の明確化（種別別）

ステップ3で判定した種別に応じた手法を選択。

#### code → スケルトンテスト作成

受け入れ条件を`test.todo()`で定義。テストが通れば実装完了の明確な基準。

**前提確認（MUST）**:
スケルトンテストを書く前に、既存テストを確認:
1. `Grep` で関連テストファイルを検索
2. 既存テストがカバーしている振る舞いを把握
3. 既存テストの拡張（ケース追加）で済む場合は新規作成しない

**書くべきテスト**:
- CIで継続的に実行する価値がある振る舞いの検証
- リグレッション防止として長期的に機能するもの
- 入力→出力の関係を検証するもの

**書くべきでないテスト**:
| パターン | 代替手段 |
|----------|----------|
| 既存テストと重複 | 既存テストにケース追加 |
| スナップショット更新で十分 | 既存スナップショットの期待値を更新 |
| 一回限りの確認（マイグレーション等） | 手動検証チェックリスト or Open Question |
| 未実装機能のテスト | 依存機能の実装後に作成 |
| 実装詳細（内部状態、private関数） | テスト対象外 |

**判断フロー**:
```
このテストはCIで毎回実行する価値があるか？
├─ No → スケルトンテストに含めない
│   └─ 必要なら Open Questions or 手動チェックリストに記載
└─ Yes → 既存テストでカバーされているか？
    ├─ Yes → 既存テストの拡張で対応
    └─ No → スケルトンテスト作成
```

**配置**: プロジェクトの既存テスト構造・命名規則に従う

```typescript
// Good: 振る舞いを検証
describe("watch command", () => {
  test.todo("リモート変更時、ローカルファイルを更新");
  test.todo("ローカル未保存変更時、conflict報告");
});

// Bad: 一回限りの確認
describe("migration", () => {
  test.todo("旧フォーマットから新フォーマットへ変換"); // → 手動確認で十分
});
```

#### config → 検証コマンド定義

設定変更の効果を確認するコマンドと期待結果を定義。

```markdown
## Acceptance Criteria

| 検証コマンド | 期待結果 |
|-------------|----------|
| `bun run lint` | エラー0件 |
| `bun run lint --fix` | 自動修正が適用される |
| `git diff` | 意図した設定のみ変更 |
```

#### infra → 手動検証チェックリスト

自動テスト不可のため、検証手順を明文化。

```markdown
## Acceptance Criteria

**Plan出力確認**:
- [ ] `terraform plan` で意図した変更のみ表示
- [ ] destroy対象がないこと

**適用後確認**:
- [ ] リソースがコンソールで確認できる
- [ ] アプリケーションから接続できる
```

#### docs → レビュー観点

```markdown
## Acceptance Criteria

- [ ] 対象読者が明確
- [ ] 手順通りに実行可能
- [ ] コード例・スクリーンショットが最新
```

### 6. Open Questions精査 & 分割判断

受け入れ条件を定義する過程で浮かんだ疑問を整理し、分割要否を判断。

#### 6a. Open Questions導出

**判断フロー**:
```
条件が明確に書けた → 記載しない
書けなかった理由:
  - 仕様が曖昧 → Open Question
  - 複数の方法 → Open Question
  - 外部依存不明 → Open Question
```

**目標**: 5-10項目

**フォーマット**:
```markdown
**Q1: [質問]**
[条件を書けなかった理由]

**検討案:**
- **[A]（推奨 🟢）**: [説明]
- **[B]**: [説明] / トレードオフ: [制約]
```

**自信度**: 🟢高（同一パターン確認済）/ 🟡中（類似あり）/ 🔴低（前例なし→検証必要）

#### 6b. 分割判断

Open Questionsの自信度から分割要否を判定。

**分割トリガー**（いずれか該当で分割検討）:
- 自信度🔴低が2件以上
- 1論点の調査に1セッション以上かかる見込み
- 独立した技術検証が必要（PoC、ベンチマーク等）

**分割時の処理**:
1. 親の進捗ドキュメントは**完成させる**（中断しない）
2. 該当Open Questionに参照を追記:
   ```markdown
   **Q3: [質問]** 🔴
   [書けなかった理由]

   → **調査中**: #xxx で検証予定
   ```
3. ステップ9完了後、`/issync:create-sub-issue` で調査タスクを作成
4. sub-issueの完了条件 = 親のOpen Question解消

**分割しないケース**:
- 自信度🟢🟡のみ
- 実装しながら解消できる
- 調査より実装した方が早い

### 7. 基本セクション記入

- Purpose/Overview
- Context & Direction
- Validation & Acceptance Criteria: **ステップ5の成果物を参照**

```markdown
## Validation & Acceptance Criteria

<!-- code の場合 -->
**テストファイル**: `packages/cli/src/commands/watch/watch.test.ts`
**検証コマンド**: `bun test packages/cli/src/commands/watch/watch.test.ts`
全テストがパスすれば実装完了。

<!-- config の場合 -->
上記の検証コマンド表を実行し、全て期待結果を満たせば完了。

<!-- infra の場合 -->
上記チェックリストを全て確認すれば完了。

<!-- docs の場合 -->
上記レビュー観点を全て満たせば完了。
```

### 8. 成果物をコミット & issync push & Stage更新

```bash
# code の場合
git add <テストファイル>
git commit -m "test: add skeleton tests for <機能名>"

# config/infra/docs の場合（進捗ドキュメントのみ）
# コミット不要、issync pushのみ

issync push
issync projects set-stage "$ISSUE_URL" "to_review"  # Projects連携時
```

### 9. Status/Stage変更 & ラベル付与

```bash
issync projects set-status "$ISSUE_URL" "implement"
issync projects set-stage "$ISSUE_URL" "to_start"
gh issue edit $ISSUE_NUMBER --add-label "issync:implement"
```

### 10. 分割対応（該当時のみ）

ステップ6bで分割トリガーに該当した場合のみ実行。

```bash
/issync:create-sub-issue "Q3の調査: [質問の要約]"
```

作成後、親のOpen Questionを更新（`#xxx で検証予定` → 実際のissue番号）。

## 出力フォーマット

```markdown
## Plan Phase Complete

**Progress Document**: {issue_url}
**Task Type**: {code|config|infra|docs}

### Acceptance Criteria
<!-- 種別に応じた内容 -->

<!-- code -->
- **Test File**: `{テストファイルパス}`
- **Test Cases**: {N}件
- **Commit**: `{ハッシュ}`

<!-- config -->
- **Verification Commands**: {N}件定義済み

<!-- infra -->
- **Checklist Items**: {N}件定義済み

<!-- docs -->
- **Review Points**: {N}件定義済み

### Key Discoveries
- {技術スタック、既存パターン、関連ファイル}
- {参考実装やアーキテクチャ}

### Open Questions ({N}件)
{主要テーマ要約}

<!-- 分割が発生した場合のみ -->
### Sub-issues Created
| Issue | 対象Open Question | 目的 |
|-------|-------------------|------|
| #xxx | Q3 | [調査内容] |

### Next Steps
1. Review Acceptance Criteria and Open Questions
2. Run `/issync:align-spec` to finalize
3. Begin `/issync:implement`
<!-- 分割時は追加 -->
4. Sub-issues完了後、親のOpen Questionsを更新

**Status**: plan → implement (Stage: To Start)
```
