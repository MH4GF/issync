# resolve-question Plugin

矛盾解消駆動開発のためのOpen Question解消ワークフローを自動化するClaude Code pluginです。

## 概要

このpluginは `/resolve-question` スラッシュコマンドを提供し、plan.mdファイル内のOpen Questionを体系的に解決するサポートをします。以下のプロセスを自動化します：

1. Decision Logへの決定事項の記録
2. Open Questionの解決済みマーク
3. 関連するタスクの更新

## インストール

### issyncリポジトリをcloneした場合

1. マーケットプレイスを追加:
   ```bash
   # Claude Codeで実行:
   /plugin marketplace add <リポジトリのパス>/.claude-plugins
   # 例: /plugin marketplace add /Users/mh4gf/ghq/github.com/MH4GF/issync/.claude-plugins
   ```

2. pluginをインストール:
   ```bash
   /plugin install resolve-question@issync-plugins
   ```

3. インストール確認:
   ```bash
   /plugin list
   ```

### 他のプロジェクトで使用する場合

issyncリポジトリをcloneして、上記の手順でマーケットプレイスを追加してください。pluginはissyncプロジェクトの一部として提供されています。

## 使い方

### 基本的なワークフロー

1. コマンドを実行:
   ```
   /resolve-question
   ```

2. プロンプトに従って以下の情報を提供:
   - **Open Question ID** (例: Q1, Q2, Q5)
   - **決定内容のサマリー** (何を決定したか、なぜそう決定したか)
   - **トレードオフ** (制約や今後の考慮事項)
   - **タスクの更新** (新規タスクまたは削除するタスク)

3. pluginが以下を実行:
   - plan.mdのDecision Logセクションを更新
   - Open Questionを解決済みとしてマーク
   - Tasksセクションを更新
   - issyncが利用可能な場合は `issync push` を実行

### 実行例

Q5（issync init実行について）の決定内容を提供すると、pluginは：
- 決定内容と根拠をDecision Logに追加
- Open QuestionsセクションでQ5を解決済みとしてマーク
- 必要に応じてTasksセクションを更新
- 変更をissync pushで同期

## いつ使うか

開発のどの段階でも、Open Questionに答えた時にこのコマンドを使用してください：
- **before-plan**: 初期設計の質問を解決する時
- **before-poc**: 技術的実現可能性の質問に答える時
- **before-architecture-decision**: アーキテクチャの選択を行う時
- **before-implement**: 実装の詳細を明確にする時

これは矛盾解消駆動開発ワークフローをサポートする横断的オペレーションです。

## 必要要件

- プロジェクトに以下のセクションを含む `plan.md` ファイルが必要:
  - Decision Log
  - Open Questions / 残論点
  - Tasks
- (オプション) 自動同期用のissync CLIツール

## Pluginの構造

```
resolve-question/
├── .claude-plugin/
│   └── plugin.json          # Pluginメタデータ
├── commands/
│   └── resolve-question.md  # コマンドプロンプトとロジック
└── README.md               # このファイル
```

## 開発

このpluginを変更するには：

1. `commands/resolve-question.md` を編集してコマンドの動作を変更
2. メタデータを変更する場合は `plugin.json` を更新
3. ローカルでテスト: `/plugin install resolve-question` で再インストール

## ライセンス

MIT

## 作者

MH4GF
