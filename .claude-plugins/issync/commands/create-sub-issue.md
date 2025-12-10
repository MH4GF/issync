---
description: 新規タスクをGitHub Issueとして作成し、親issueとのリンクを自動管理。進捗ドキュメントのTasksセクションは不使用
---

# /issync:create-sub-issue: サブissue作成オペレーション

新規タスクをGitHub Issueとして作成し、以下を自動化：
1. タスク概要決定（会話コンテキストから自動抽出 / 引数指定 / 対話入力）
2. 親issue情報取得（設定ファイル）
3. LLMによるタイトル・本文生成
4. Issue作成（`issync:plan`ラベル自動付与）
5. Sub-issues API連携（親issue紐づけ + 順序維持）

## コンテキスト

**横断的オペレーション** - どのステートでも実行可能（plan、poc、architecture-decision、implement）

**設計原則**:
- GitHub Sub-issuesを完全なSSOTとする（進捗ドキュメントのTasksセクション不使用）
- 会話コンテキストから自動的にタスクを抽出し、シームレスなissue作成体験を提供
- LLMが適切なタイトル・本文を自動生成
- Sub-issues APIで親issueと自動リンク、順序維持

## 使用方法

```bash
/issync:create-sub-issue                             # 会話から自動抽出（推奨）
/issync:create-sub-issue "概要1" "概要2"            # 引数で明示指定
```

**入力モード**:
- **会話コンテキスト**: 引数なし時、会話からタスクを自動抽出（フォールバック: プロンプト入力）
- **引数**: 明示的に複数指定

## 前提条件

- issync設定が存在（`issync init`完了済み）
- `ISSYNC_GITHUB_TOKEN`環境変数設定
- `gh` CLIインストール済み

## 実行ステップ

### ステップ1: タスク概要の決定

- **会話コンテキストモード**: 引数なし時、LLMが会話から1つ以上のタスク概要を抽出し、プレビュー表示
- **引数モード**: コマンドライン引数から複数取得
- **対話入力モード（フォールバック）**: 会話コンテキストがない場合、プロンプトで概要を1つ入力

### ステップ2: 親issue情報を取得

`issync status <親issue URL>`を実行し、以下を取得:
- `issue_url`: 親issueのURL
- `local_file`: 進捗ドキュメントのパス

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

## 目的
{タスクの具体的な目的（1-2文）}

## 背景
{親issueから関連情報を抽出・要約}

## 完了条件
- [ ] {完了条件（3-5項目）}

## 関連
- 親issue: #{親issue番号}
```

### ステップ4.5: 既存issueの重複チェック

類似タスクが既に存在しないか検索し、重複作成を防ぐ。

**検索実行**:
```bash
gh search issues --repo {owner}/{repo} "{キーワード1} {キーワード2}" \
  --json number,title,url,state,labels --limit 5
```
- LLMがタイトルから主要キーワード抽出（動詞・名詞中心、2-3語）
- 検索対象: リポジトリ内全issue（open/closed）、親issueのsub-issues優先

**類似issue検出時**: AskUserQuestionツールで新規作成を続けるかキャンセルするか確認

**エラー時**: 警告表示後、検索スキップして続行

### ステップ5: ユーザー確認

AskUserQuestionツールで生成したタイトル・本文プレビューを提示し、作成承認を得る

### ステップ6: Issue作成とSub-issues連携

**ラベル付与**:
`--label "issync:plan"`を付与してissue作成。

**処理フロー**:
```bash
PREV_SUB_ISSUE_ID=""
for i in "${!GENERATED_TITLES[@]}"; do
  TITLE="${GENERATED_TITLES[$i]}"
  BODY="${GENERATED_BODIES[$i]}"

  # issync:planラベル付与
  ISSUE_URL=$(gh issue create --repo {owner}/{repo} --title "$TITLE" --body "$BODY" --label "issync:plan")
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
- `issync:plan`ラベル付与確認
- **auto-planワークフロー自動実行**のため、手動`/issync:plan`実行不要
- GitHub Actionsタブで実行状況確認可能

## 重要な注意事項

**必須要件**:
- 親issueの進捗ドキュメント全体読み込み（設定ファイルのlocal_fileパス使用）
- タイトル・本文はLLM生成、ユーザー確認必須
- gh CLI使用、内部ID使用（`gh api .../issues/{番号} --jq .id`）
- `issync:plan`ラベルを常に自動付与
  - auto-planワークフローが自動トリガーされ、進捗ドキュメントが自動作成される

**Sub-issues API**:
- 処理順: Issue作成 → 内部ID取得 → Sub-issues紐づけ → 順序設定（`after_id`）
- JSON payload使用、エラー時は処理継続して報告

**その他**:
- 進捗ドキュメント非変更（Tasksセクション削除済み、タスク管理はGitHub Sub-issuesに完全移行）
- エラーハンドリング: `state.yml`/`gh` CLI不在時は終了、Issue作成失敗時は部分成功も記録

## 実行例

**会話コンテキストモード**: `/issync:create-sub-issue`
1. LLMが会話から"Status変更時の自動アクション"を抽出
2. タイトル生成（例: "Status変更時の自動アクション機能を設計"）
3. ユーザー確認 → Issue作成（`issync:plan`ラベル付与）
4. auto-planワークフロー自動実行

**引数モード**: `/issync:create-sub-issue "自動アクション設計" "コマンド実装"`
1. 複数タスク一括作成、Sub-issues順序維持
2. 各サブissueでauto-planワークフロー自動実行
