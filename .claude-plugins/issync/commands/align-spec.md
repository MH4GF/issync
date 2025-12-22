---
description: テストとOpen Questionsの認識を揃え、仕様を確定する。iterativeに齟齬を解消
---

# /issync:align-spec

スケルトンテストとOpen Questionsの認識合わせを行い、仕様を確定する。

**ゴール**: テストケースと仕様の認識齟齬を完全に解消し、implement準備完了状態にする

## 使用方法

```bash
/issync:align-spec
Q1: 推奨案
Q2: <ユーザーの意思決定>
Q3-5: 推奨案
```

**引数形式**:
- `Q[番号]: [意思決定]` または `Q[範囲]: [意思決定]`
- `推奨案` / `推奨`: 検討案から推奨マーク付きを採用

## 前提条件

- `/issync:plan` 実行済み（スケルトンテスト + Open Questions作成済み）
- `ISSYNC_GITHUB_TOKEN` 設定済み

## 実行ステップ

### 1. 進捗ドキュメント読み込み

既に理解済みならスキップ。未読の場合は `/issync:understand-progress` を内部呼び出し。

### 2. 入力解析 & Open Questions解消

1. 未解決Open Questionsを抽出（取り消し線なし）
2. ユーザー入力を解析:
   - `推奨案` → 推奨マーク付き案を自動抽出
   - その他 → 入力内容をそのまま使用

3. 各質問を更新:
   ```markdown
   **~Q1: [質問]~** ✅ 解決済み (YYYY-MM-DD)
   [元の内容]
   **決定**: [採用案]
   ```

### 3. テストケース更新

解決内容に基づきスケルトンテストを更新:

- **曖昧だったテスト**: 決定内容で具体化
- **新規テスト追加**: 決定により必要になったケース
- **テスト削除**: 決定によりスコープ外になったケース

```typescript
// Before
test.todo("エラー時の挙動");

// After（Q1で「リトライ3回後にエラー表示」と決定）
test.todo("エラー発生時、3回リトライ後にエラーメッセージを表示");
```

### 4. 新たな齟齬の確認

テスト更新中に新たな疑問が浮かんだ場合:
- Open Questionsに追加
- ユーザーに報告し、再度 `/issync:align-spec` を促す

### 5. Decision Log & Specification更新

**Decision Log**: 解決した質問をグループ化して記録
```markdown
**YYYY-MM-DD: [決定タイトル]**
- **採用**: [案]
- **理由**: [簡潔に]
- **比較候補**: [他案と却下理由]
```

**Specification**: 決定内容から仕様を推論して追記（推論不可ならスキップ）

### 6. 変更をコミット & 同期

```bash
git add <テストファイル>
git commit -m "test: update skeleton tests based on spec decisions"
issync push
```

## 出力フォーマット

```markdown
## Align Spec Complete

### Resolved Questions ({N}件)
- Q1: [タイトル] → [決定内容]
- Q2: [タイトル] → [決定内容]

### Test Updates
- **Updated**: {M}件
- **Added**: {L}件
- **File**: `{テストファイルパス}`

### Remaining Questions ({K}件)
{0件なら "None - ready for implement"}
{1件以上なら一覧と再実行の案内}

### Next Steps
{全解消時}
- Begin `/issync:implement`

{残りあり時}
- Resolve remaining questions
- Run `/issync:align-spec` again
```

## iterativeな実行

このコマンドは**複数回実行**を想定:

```
/issync:plan → スケルトンテスト + Open Questions
    ↓
/issync:align-spec Q1-3: 推奨案
    ↓
（新たな疑問発生）
    ↓
/issync:align-spec Q4: 方式Bで
    ↓
全解消 → /issync:implement
```

## エラーハンドリング

- **Open Questions不在**: メッセージ表示して終了
- **質問番号不在**: 警告表示してスキップ（他は継続）
- **推奨案不在**: 検討案の最初を採用
- **issync push失敗**: エラー表示、手動実行を案内
