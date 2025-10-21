---
description: 新規タスクをGitHub Issueとして作成し、親issueとのリンクを自動管理。進捗ドキュメントのTasksセクションは不使用
---

# /create-sub-issue: サブissue作成オペレーション

あなたはユーザーの新規タスクをGitHub Issueとして作成するサポートをしています。このコマンドは以下のワークフローを自動化します：
1. タスクの概要入力（インタラクティブモードまたは引数モード）
2. `.issync/state.yml`から親issue情報を取得
3. LLMが親issueのコンテキストを理解し、各タスクの適切なタイトルと本文を生成
4. ユーザー確認後にGitHub Issueを一括作成
5. Sub-issues APIで親issueと紐づけ + 作成順序を維持

## コンテキスト

**横断的オペレーション** - どのステートでも実行可能（plan、poc、architecture-decision、implement）

**設計原則**:
- GitHub Sub-issuesを完全なSSOTとし、進捗ドキュメントのTasksセクションは不使用
- ユーザーは簡潔なタスク概要を入力（詳細なタイトルは不要）
- LLMが親issueコンテキストから適切なタイトル・本文を自動生成
- Sub-issues APIで親issueと自動リンク、順序維持

## 使用方法

```bash
/create-sub-issue                    # インタラクティブモード（タスク概要入力を促される）
/create-sub-issue "タスク概要1" "タスク概要2"  # 引数指定モード
```

**タスク概要の入力**:
- インタラクティブ: 1つずつ入力（`done`で終了）
- 引数指定: 複数を引数として渡す
- 例: "Status変更時の自動アクション" "コマンド実装" など簡潔でOK

## 前提条件

- `.issync/state.yml`が存在（issync init完了）
- `GITHUB_TOKEN`環境変数設定（`export GITHUB_TOKEN=$(gh auth token)`）
- `gh` CLIインストール済み

## 実行ステップ

### ステップ1: タスク概要の入力

インタラクティブモードまたは引数から取得（使用方法セクション参照）

### ステップ2: .issync/state.ymlから親issue情報を取得

`.issync/state.yml`から取得:
- `issue_url`: 親issueのURL
- `local_file`: 進捗ドキュメントのパス

複数sync存在時はユーザーに選択を促す。ファイル不在時は`issync init`実行を案内。

### ステップ3: 親issueの進捗ドキュメントを読み込み、コンテキストを抽出

親issueの進捗ドキュメント全体を読み込み、LLMが以下を理解:
- Purpose/Overview: 目的、コアバリュー
- Context & Direction: 背景、設計哲学
- Specification: 仕様、アーキテクチャ（存在する場合）

### ステップ4: LLMによるタイトルと本文の生成

**タイトル生成**:
- 形式: 「{動詞} + {対象}」、10-30文字
- 親issueのスタイルに合わせた簡潔で明確なタイトル

**本文生成**:
```markdown
Part of #{親issue番号}

## Goal
{タスクの具体的な目的（1-2文）}

## Background
{親issueから関連情報のみを抽出・要約}

## Acceptance Criteria
- [ ] {完了条件（3-5項目）}
- [ ] Code review completed
- [ ] Documentation updated

## Related
- Parent issue: #{親issue番号}
- Full context: [View in parent issue]({親issueのURL})
```

### ステップ5: ユーザー確認

生成したタイトルと本文プレビューを提示し、承認後に作成（`y`/`n`で選択）

### ステップ6: GitHub Issueを一括作成とSub-issues紐づけ・順序設定

**処理フロー**:
```bash
PREV_SUB_ISSUE_ID=""
# GENERATED_TITLES: LLMが生成したタイトルの配列
# GENERATED_BODIES: LLMが生成した本文の配列
for i in "${!GENERATED_TITLES[@]}"; do
  TITLE="${GENERATED_TITLES[$i]}"
  BODY="${GENERATED_BODIES[$i]}"

  ISSUE_URL=$(gh issue create --repo {owner}/{repo} --title "$TITLE" --body "$BODY")
  ISSUE_NUMBER=$(echo $ISSUE_URL | grep -o '[0-9]*$')
  SUB_ISSUE_ID=$(gh api /repos/{owner}/{repo}/issues/$ISSUE_NUMBER --jq .id)

  # Sub-issueとして紐づけ
  gh api --method POST /repos/{owner}/{repo}/issues/{親issue番号}/sub_issues \
    -F "sub_issue_id=$SUB_ISSUE_ID"

  # 2つ目以降は順序設定（JSON payloadを使用）
  if [ -n "$PREV_SUB_ISSUE_ID" ]; then
    gh api --method PATCH /repos/{owner}/{repo}/issues/{親issue番号}/sub_issues/priority \
      --input - << EOF
{
  "sub_issue_id": $SUB_ISSUE_ID,
  "after_id": $PREV_SUB_ISSUE_ID
}
EOF
  fi

  PREV_SUB_ISSUE_ID=$SUB_ISSUE_ID
done
```

### ステップ7: GitHub Projects Status設定（オプション）

`gh issue edit`でStatus=planを設定（利用不可の場合は手動設定を案内）

---

## 出力フォーマット

完了後、作成されたサブissueリスト、紐づけ結果、次のアクション（Status設定、`/plan`実行）を表示

---

## 重要な注意事項

**必須要件**:
- 親issueの進捗ドキュメント全体読み込み（.issync/state.ymlのlocal_fileパス使用）
- タイトル・本文はLLM生成、ユーザー確認必須
- gh CLI使用、内部ID使用（`gh api .../issues/{番号} --jq .id`）

**Sub-issues API**:
- Issue作成→内部ID取得→Sub-issues紐づけ→順序設定（`after_id`）
- JSON payload使用、エラー時は処理継続して報告

**進捗ドキュメント非変更**: Tasksセクション削除済み、タスク管理はGitHub Sub-issuesに完全移行

**エラーハンドリング**: state.yml不在・gh CLI不在時は終了、Issue作成失敗時は部分成功も記録

---

## 実行例

**インタラクティブモード**: `/create-sub-issue`
- タスク概要を対話的に入力（例: "Status変更時の自動アクション"）
- LLMが親issueから適切なタイトル生成（例: "Status変更時の自動アクション機能を設計"）
- ユーザー確認→Issue作成→Sub-issues紐づけ→順序設定

**引数指定モード**: `/create-sub-issue "自動アクション設計" "/create-sub-issue実装"`
- 引数から直接タスク概要取得、以降は同様
