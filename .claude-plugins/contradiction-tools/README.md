# contradiction-tools Plugin

矛盾解消駆動開発のためのツール群を提供するClaude Code pluginです。

## 概要

このpluginは2つのスラッシュコマンドを提供し、plan.mdファイルの管理を効率化します：

### `/resolve-question`: Open Question解消ワークフロー

plan.mdファイル内のOpen Questionを体系的に解決するサポートをします。以下のプロセスを自動化します：

1. Decision Logへの決定事項の記録
2. Open Questionの解決済みマーク
3. 関連するタスクの更新

### `/compact-plan`: plan.md圧縮ツール

plan.mdファイルが大きくなりすぎた際に、情報量を保持したまま文量を削減します。以下の処理を自動化します：

1. 重複情報の削減
2. 解決済みOpen Questionsの整理
3. 完了済みPhaseの簡潔化
4. 矛盾検出と報告

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
   /plugin install contradiction-tools@issync-plugins
   ```

3. インストール確認:
   ```bash
   /plugin list
   ```

### 他のプロジェクトで使用する場合

このpluginは他のプロジェクトでも利用できます。GitHubから直接インストールできるため、リポジトリのcloneは不要です。

#### 1. マーケットプレイスを追加

Claude Codeで以下のコマンドを実行し、GitHubから直接マーケットプレイスを追加します：

```bash
/plugin marketplace add MH4GF/issync
```

#### 2. pluginをインストール

マーケットプレイスを追加したら、pluginをインストールします：

```bash
/plugin install contradiction-tools@issync-plugins
```

#### 3. インストール確認

正しくインストールされたか確認します：

```bash
/plugin list
```

`contradiction-tools` が表示されていれば成功です。

#### 4. 使い方

インストール後は、どのプロジェクトでも以下のコマンドが使えます：

```bash
/resolve-question    # Open Question解消ワークフロー
/compact-plan        # plan.md圧縮ツール
```

#### 更新方法

pluginが更新された場合、以下の手順で最新版に更新できます：

```bash
# 1. マーケットプレイスを更新（GitHubから最新情報を取得）
/plugin marketplace update issync-plugins

# 2. pluginを再インストール
/plugin install contradiction-tools@issync-plugins
```

マーケットプレイスの更新により、GitHubリポジトリの最新のplugin情報が取り込まれます。

#### トラブルシューティング

**Q: pluginが見つからないと言われる**

A: マーケットプレイス名を確認してください。正しい形式は `contradiction-tools@issync-plugins` です（`@issync-plugins` はマーケットプレイス名）。

**Q: 古いバージョンのまま更新されない**

A: 以下を試してください：

```bash
# 1. マーケットプレイスを更新
/plugin marketplace update issync-plugins

# 2. pluginをアンインストール
/plugin uninstall contradiction-tools@issync-plugins

# 3. 再インストール
/plugin install contradiction-tools@issync-plugins
```

**Q: ローカル開発版を使いたい（plugin開発者向け）**

A: issyncリポジトリをcloneし、ローカルパスからマーケットプレイスを追加してください：

```bash
# issyncリポジトリをclone
git clone https://github.com/MH4GF/issync.git
# または: ghq get MH4GF/issync

# ローカルパスでマーケットプレイスを追加（絶対パスを使用）
/plugin marketplace add /path/to/issync

# 例（ghqを使っている場合）:
# /plugin marketplace add /Users/username/ghq/github.com/MH4GF/issync

# インストール
/plugin install contradiction-tools@issync-plugins
```

ローカル開発版を使用している場合、変更を反映するには：

```bash
# pluginを再インストール
/plugin uninstall contradiction-tools@issync-plugins
/plugin install contradiction-tools@issync-plugins
```

## 使い方

### `/resolve-question`: Open Question解消

#### 基本的なワークフロー

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
   - issyncのwatchモードが起動している場合は自動的にGitHub Issueに同期

#### 実行例

Q5（issync init実行について）の決定内容を提供すると、pluginは：
- 決定内容と根拠をDecision Logに追加
- Open QuestionsセクションでQ5を解決済みとしてマーク
- 必要に応じてTasksセクションを更新
- watchモードが起動している場合は自動的にGitHub Issueに同期

### `/compact-plan`: plan.md圧縮

#### 基本的なワークフロー

1. コマンドを実行（ファイルパスを指定）:
   ```bash
   /compact-plan docs/plan.md
   ```

2. pluginが以下を自動実行:
   - plan.mdの分析（総行数、セクション別行数、重複、矛盾）
   - plan-template.mdとの比較
   - 圧縮処理の適用
   - 矛盾検出とレポート
   - watchモードが起動している場合は自動的にGitHub Issueに同期

3. 圧縮結果レポートを確認:
   - 削減された行数と削減率
   - 適用された圧縮処理の詳細
   - 検出された矛盾（ある場合）

#### 実行例

plan.mdが779行に膨らんだ場合、pluginは：
- 重複情報を削減（5箇所）
- 解決済みOpen Questionsを整理（3件）
- 完了Phase（Phase 1）を簡潔化
- 完了タスクを削除（12件）
- 矛盾を検出してレポート
- 結果: 779行 → 450行（42%削減）

## いつ使うか

### `/resolve-question`

開発のどの段階でも、Open Questionに答えた時にこのコマンドを使用してください：
- **before-plan**: 初期設計の質問を解決する時
- **before-poc**: 技術的実現可能性の質問に答える時
- **before-architecture-decision**: アーキテクチャの選択を行う時
- **before-implement**: 実装の詳細を明確にする時

これは矛盾解消駆動開発ワークフローをサポートする横断的オペレーションです。

### `/compact-plan`

以下のような状況で使用してください：
- **plan.mdが500行以上に膨らんだ時**: 読みづらくなる前に定期的に圧縮
- **Phaseが完了した時**: 完了フェーズの詳細を簡潔化
- **Open Questionsが大量に解決された時**: 解決済み質問を整理
- **before-retrospective前**: 振り返りを書く前にドキュメントを整理
- **矛盾の疑いがある時**: 矛盾検出機能で一貫性をチェック

## 必要要件

- プロジェクトに以下のセクションを含む `plan.md` ファイルが必要:
  - **`/resolve-question`用**: Decision Log, Open Questions / 残論点, Tasks
  - **`/compact-plan`用**: docs/plan-template.md（圧縮の基準として使用）
- (オプション) 自動同期用のissync CLIツール

## Pluginの構造

```
contradiction-tools/
├── .claude-plugin/
│   └── plugin.json            # Pluginメタデータ
├── commands/
│   ├── resolve-question.md    # Open Question解消コマンド
│   └── compact-plan.md        # plan.md圧縮コマンド
└── README.md                  # このファイル
```

## 開発

このpluginを変更するには：

1. コマンドプロンプトを編集:
   - `/resolve-question`: `commands/resolve-question.md`
   - `/compact-plan`: `commands/compact-plan.md`
2. メタデータを変更する場合は `plugin.json` を更新
3. ローカルでテスト: `/plugin install contradiction-tools` で再インストール

## ライセンス

MIT

## 作者

MH4GF
