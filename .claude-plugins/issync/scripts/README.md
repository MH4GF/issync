# GitHub Projects Helper Scripts

## Overview

このディレクトリには、issync プラグインコマンドから使用される GitHub Projects 連携用のヘルパースクリプトが含まれています。

## Scripts

### `github-projects.sh`

GitHub Projects の Stage/Status フィールドを操作するヘルパースクリプト。

**前提条件:**
- 環境変数 `ISSYNC_GITHUB_PROJECTS_NUMBER` が設定されていること（例: `4`）
- Organization プロジェクトの場合は `ISSYNC_GITHUB_PROJECTS_OWNER` が必要（例: `my-org`）
- `gh` CLI がインストールされ、認証済みであること
- `jq` コマンドがインストールされていること

**Usage:**

```bash
# Stage を設定
bash github-projects.sh set-stage ISSUE_NUMBER "in progress"
bash github-projects.sh set-stage ISSUE_NUMBER "to review"
bash github-projects.sh set-stage ISSUE_NUMBER "to start"

# Status を設定
bash github-projects.sh set-status ISSUE_NUMBER "plan"
bash github-projects.sh set-status ISSUE_NUMBER "poc"
bash github-projects.sh set-status ISSUE_NUMBER "architecture-decision"
bash github-projects.sh set-status ISSUE_NUMBER "implement"
bash github-projects.sh set-status ISSUE_NUMBER "retrospective"
bash github-projects.sh set-status ISSUE_NUMBER "done"

# Stage をクリア
bash github-projects.sh clear-stage ISSUE_NUMBER
```

**Features:**

- **キャッシュ機能**: プロジェクト情報を5分間キャッシュし、API呼び出しを削減
- **自動エラーハンドリング**: 環境変数未設定時や権限不足時に警告を表示して処理を継続
- **自動判定**: `ISSYNC_GITHUB_PROJECTS_OWNER` の有無で user/org を自動判定

**プラグインコマンドからの使用例:**

```bash
# plan.md ステップ1
bash ${CLAUDE_PLUGIN_ROOT}/scripts/github-projects.sh set-stage $ISSUE_NUMBER "in progress"

# plan.md ステップ6
bash ${CLAUDE_PLUGIN_ROOT}/scripts/github-projects.sh set-stage $ISSUE_NUMBER "to review"

# plan.md ステップ7
bash ${CLAUDE_PLUGIN_ROOT}/scripts/github-projects.sh set-status $ISSUE_NUMBER "poc"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/github-projects.sh set-stage $ISSUE_NUMBER "to start"

# complete-sub-issue.md ステップ10
bash ${CLAUDE_PLUGIN_ROOT}/scripts/github-projects.sh set-status $SUB_ISSUE_NUMBER "done"
```

**エラーハンドリング:**

- 環境変数 `ISSYNC_GITHUB_PROJECTS_NUMBER` が未設定の場合、警告を表示して exit 0（処理を継続）
- プロジェクトが見つからない場合、エラーメッセージを表示して exit 1
- Issue がプロジェクトに見つからない場合、エラーメッセージを表示して exit 1
- その他のエラーは trap で捕捉し、警告を表示して exit 0

## Cache

プロジェクト情報のキャッシュは以下の場所に保存されます:

```
${TMPDIR}/issync-github-projects-cache-${ISSYNC_GITHUB_PROJECTS_NUMBER}.json
```

キャッシュの有効期限は 5 分（300秒）です。

## Development

スクリプトを編集した場合、以下のコマンドでローカルテストできます:

```bash
# User プロジェクトの場合
export ISSYNC_GITHUB_PROJECTS_NUMBER=4

# Organization プロジェクトの場合
export ISSYNC_GITHUB_PROJECTS_NUMBER=4
export ISSYNC_GITHUB_PROJECTS_OWNER=my-org

# スクリプトを実行
bash .claude-plugins/issync/scripts/github-projects.sh set-stage 56 "in progress"
```
