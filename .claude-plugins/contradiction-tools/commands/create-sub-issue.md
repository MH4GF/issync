---
description: 新規タスクをGitHub Issueとして作成し、親issueとのリンクを自動管理。進捗ドキュメントのTasksセクションは不使用
---

# /create-sub-issue: サブissue作成オペレーション

新規タスクをGitHub Issueとして作成し、以下を自動化：
1. タスク概要入力（インタラクティブ: 1つ / 引数: 複数可）
2. 親issue情報取得（`.issync/state.yml`）
3. LLMによるタイトル・本文生成
4. Issue作成（`issync`ラベル自動付与）
5. Sub-issues API連携（親issue紐づけ + 順序維持）

## コンテキスト

**横断的オペレーション** - どのステートでも実行可能（plan、poc、architecture-decision、implement）

**設計原則**:
- GitHub Sub-issuesを完全なSSOTとする（進捗ドキュメントのTasksセクション不使用）
- ユーザー入力は簡潔な概要のみ（LLMが適切なタイトル・本文を自動生成）
- Sub-issues APIで親issueと自動リンク、順序維持

## 使用方法

```bash
/create-sub-issue                             # インタラクティブモード（1つ）
/create-sub-issue "概要1" "概要2"            # 引数モード（複数可）
```

**入力例**: "Status変更時の自動アクション" "コマンド実装" など簡潔でOK

**推奨ワークフロー**:
- 基本: 1つずつ作成 → `/plan`で詳細化 → 必要に応じて孫issue作成
- 複数の独立タスクが明確な場合のみ引数モードで一括作成

## 前提条件

- `.issync/state.yml`存在（`issync init`完了済み）
- `GITHUB_TOKEN`環境変数設定（`export GITHUB_TOKEN=$(gh auth token)`）
- `gh` CLIインストール済み

## 実行ステップ

### ステップ1: タスク概要の入力

- **インタラクティブモード**: プロンプトでタスク概要を1つ入力
- **引数モード**: コマンドライン引数から複数取得

### ステップ2: 親issue情報を取得

`issync list`を実行し、以下を取得:
- `issue_url`: 親issueのURL
- `local_file`: 進捗ドキュメントのパス

複数sync存在時はユーザー選択を促す。

### ステップ3: 親issueコンテキスト抽出

進捗ドキュメント全体を読み込み、LLMが以下を理解:
- Purpose/Overview: 目的、コアバリュー
- Context & Direction: 背景、設計哲学
- Specification: 仕様、アーキテクチャ（存在時）

### ステップ4: タイトル・本文生成

**タイトル**: 「{動詞} + {対象}」形式、10-30文字、親issueのスタイルに合わせる

**本文テンプレート**:
```markdown
Part of #{親issue番号}

## Goal
{タスクの具体的な目的（1-2文）}

## Background
{親issueから関連情報を抽出・要約}

## Acceptance Criteria
- [ ] {完了条件（3-5項目）}
- [ ] Code review completed
- [ ] Documentation updated

## Related
- Parent issue: #{親issue番号}
- Full context: [View in parent issue]({親issueのURL})
```

### ステップ5: ユーザー確認

生成したタイトル・本文プレビューを提示し、承認後に作成（`y`/`n`）

### ステップ6: Issue作成とSub-issues連携

**処理フロー**:
```bash
PREV_SUB_ISSUE_ID=""
for i in "${!GENERATED_TITLES[@]}"; do
  TITLE="${GENERATED_TITLES[$i]}"
  BODY="${GENERATED_BODIES[$i]}"

  ISSUE_URL=$(gh issue create --repo {owner}/{repo} --title "$TITLE" --body "$BODY" --label "issync")
  ISSUE_NUMBER=$(echo $ISSUE_URL | grep -o '[0-9]*$')
  SUB_ISSUE_ID=$(gh api /repos/{owner}/{repo}/issues/$ISSUE_NUMBER --jq .id)

  # Sub-issueとして紐づけ
  gh api --method POST /repos/{owner}/{repo}/issues/{親issue番号}/sub_issues \
    -F "sub_issue_id=$SUB_ISSUE_ID"

  # 2つ目以降は順序設定
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

`gh issue edit`でStatus=planを設定（利用不可時は手動設定を案内）

## 出力フォーマット

完了後、以下を表示:
- 作成されたサブissueリスト（URL、タイトル）
- Sub-issues紐づけ結果
- `issync`ラベル付与確認
- **auto-planワークフロー自動実行**のため、手動`/plan`実行不要
- GitHub Actionsタブで実行状況確認可能

## 重要な注意事項

**必須要件**:
- 親issueの進捗ドキュメント全体読み込み（`.issync/state.yml`のlocal_fileパス使用）
- タイトル・本文はLLM生成、ユーザー確認必須
- gh CLI使用、内部ID使用（`gh api .../issues/{番号} --jq .id`）
- **すべてのサブissueに`issync`ラベル付与**（`gh issue create --label "issync"`）
  - auto-planワークフローが自動トリガーされ、進捗ドキュメントが自動作成される

**Sub-issues API**:
- 処理順: Issue作成 → 内部ID取得 → Sub-issues紐づけ → 順序設定（`after_id`）
- JSON payload使用、エラー時は処理継続して報告

**その他**:
- 進捗ドキュメント非変更（Tasksセクション削除済み、タスク管理はGitHub Sub-issuesに完全移行）
- エラーハンドリング: `state.yml`/`gh` CLI不在時は終了、Issue作成失敗時は部分成功も記録

## 実行例

**インタラクティブモード**: `/create-sub-issue`
1. タスク概要入力: "Status変更時の自動アクション"
2. LLMがタイトル生成（例: "Status変更時の自動アクション機能を設計"）
3. ユーザー確認 → Issue作成（`issync`ラベル付き）→ Sub-issues紐づけ
4. auto-planワークフロー自動実行 → 進捗ドキュメント作成

**引数モード**: `/create-sub-issue "自動アクション設計" "/create-sub-issue実装"`
1. 複数タスクを一括作成（各々`issync`ラベル付き）
2. Sub-issues順序設定で作成順序維持
3. 各サブissueに対しauto-planワークフロー順次実行
