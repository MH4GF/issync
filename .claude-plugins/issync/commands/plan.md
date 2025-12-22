---
description: コードベース調査→スケルトンテスト作成→Open Questions導出で進捗ドキュメントを作成
---

# /issync:plan

進捗ドキュメント（`.issync/docs/plan-{番号}-{slug}.md`）を作成。9ステップ：

1. 前提確認 & issync init & Stage設定（In Progress）
2. Issue内容確認
3. コードベース調査
4. **スケルトンテスト作成**（受け入れ条件の明確化）
5. **Open Questions精査**（テストから導出）
6. 基本セクション記入
7. テストファイルをコミット
8. issync push & Stage更新（To Review）
9. Status/Stage変更 & ラベル付与（implement, To Start）

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

### 3. コードベース調査（CRITICAL）

**複雑度判定**:
| 複雑度 | Agent数 | 調査内容 |
|--------|---------|----------|
| Simple | 1 | 類似機能パターン |
| Moderate | 2 | + テスト戦略 |
| Complex | 3 | + 技術スタック |

外部ライブラリ/新技術採用時は Agent 4（外部調査）追加。

**実行**: 単一メッセージで複数Task tool呼び出し。各Agentは `.claude-plugins/issync/agents/codebase-explorer.md` に従う。

**集約**: 全Agentの特定ファイルを読み、Discoveries & Insightsに記録。

### 4. スケルトンテスト作成（CRITICAL）

受け入れ条件を`test.todo()`で定義。テストが通れば実装完了の明確な基準。

**配置**: プロジェクトの既存テスト構造・命名規則に従う

**形式**:
```typescript
describe("watch command", () => {
  describe("リモート変更検知", () => {
    test.todo("リモート変更時、ローカルファイルを更新");
    test.todo("ローカル未保存変更時、conflict報告");
  });
});
```

**書けない場合**: ステップ5でOpen Questionとして記録

### 5. Open Questions精査（テストから導出）

テストを書く過程で浮かんだ疑問を整理。

**判断フロー**:
```
テストが書けた → 記載しない
書けなかった理由:
  - 仕様が曖昧 → Open Question
  - 複数の実装方法 → Open Question
  - 外部挙動不明 → Open Question
```

**目標**: 5-10項目

**フォーマット**:
```markdown
**Q1: [質問]**
[テストを書けなかった理由]

**関連テスト**: `path/to/test.ts` の `test.todo("...")`

**検討案:**
- **[A]（推奨 🟢）**: [説明]
- **[B]**: [説明] / トレードオフ: [制約]
```

自信度: 🟢高（同一パターン確認済）/ 🟡中（類似あり）/ 🔴低（前例なし→⚠️検証項目併記）

### 6. 基本セクション記入

- Purpose/Overview
- Context & Direction
- Validation & Acceptance Criteria: **ステップ4のテストファイルを参照**

```markdown
## Validation & Acceptance Criteria

**テストファイル**: `packages/cli/src/commands/watch/watch.test.ts`
**検証コマンド**: `bun test packages/cli/src/commands/watch/watch.test.ts`

全テストがパスすれば実装完了。
```

### 7. テストファイルをコミット

```bash
git add <テストファイル>
git commit -m "test: add skeleton tests for <機能名>"
```

### 8. issync push & Stage更新

```bash
issync push
issync projects set-stage "$ISSUE_URL" "to_review"  # Projects連携時
```

### 9. Status/Stage変更 & ラベル付与

```bash
issync projects set-status "$ISSUE_URL" "implement"
issync projects set-stage "$ISSUE_URL" "to_start"
gh issue edit $ISSUE_NUMBER --add-label "issync:implement"
```

## 出力フォーマット

```markdown
## Plan Phase Complete

**Progress Document**: {issue_url}

### Skeleton Tests
- **File**: `{テストファイルパス}`
- **Test Cases**: {N}件
- **Commit**: `{ハッシュ}`

### Key Discoveries
- {技術スタック、既存パターン、テスト戦略}
- {参考実装やアーキテクチャ}

### Open Questions ({N}件)
{主要テーマ要約}

### Next Steps
1. Review skeleton tests and Open Questions
2. Run `/issync:align-spec` to finalize
3. Begin `/issync:implement`

**Status**: plan → implement (Stage: To Start)
```
