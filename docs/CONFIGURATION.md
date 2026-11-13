# mdanimater の設定と旧版からの移行

[READMEに戻る](../README.md)。現在の製品名はmdanimater、拡張機能IDは `oisworks.mdanimater` です。

## 旧版からの移行

0.3.0で製品名とすべての識別子をmdanimaterへ統一しました。旧名称の互換エイリアスはありません。0.2.x以前の設定は自動移行されないため、次の手順で移してください。

1. 旧版を無効化またはアンインストールし、`oisworks.mdanimater` をインストールします。旧版から自動更新では置き換わりません。
2. ユーザー・ワークスペース・リモートのsettings.jsonで、この拡張機能の設定キーの接頭辞を `mdanimater.` に変更します。各設定の値は保持してください。
3. keybindings.jsonの対応コマンドを `mdanimater.*` に変更します。editorの関連付けや `when` 条件に旧editor IDがあれば `mdanimater.editor` に変更します。
4. プロジェクトのformatter/lint設定ファイルを `.mdanimaterrc.json` に改名します。中のrule名と値はそのまま使えます。`$schema` を明示していれば `schemas/mdanimaterrc.schema.json` の新しい参照先へ変更します。
5. Markdown文書内のlint抑制コメントを `mdanimater-lint-disable`、`mdanimater-lint-disable-next-line`、`mdanimater-lint-enable` に揃えます。
6. 既定formatterと推奨拡張機能のIDを `oisworks.mdanimater` に変更し、ウィンドウを再読み込みします。

既定formatterの例：

```json
{
  "[markdown]": {
    "editor.defaultFormatter": "oisworks.mdanimater"
  }
}
```

## 設定

- `mdanimater.openGitDiffAsRichDiff`：既定は `true`。Source Control から新しく開く Markdown の Git diff を、指定された2版のまま Rich Diff に切り替えます。既存のタブ・未保存の差分タブ・Copilot のレビューは切り替えません。`false` で標準の差分表示を維持します。Rich Diff の **Source Diff** ボタンでは常に原文を開けます。
- `mdanimater.openMarkdownAsRichEditor`：local の Markdown file を既定で mdanimater で開きます。Git diff の自動整形表示は `mdanimater.openGitDiffAsRichDiff` で切り替えます。
- `mdanimater.autoSave`：mdanimater で開いている Markdown file を、変更が止まってから 1 秒後に保存します（既定で on）。この保存では `mdanimater.formatOnSave` は動きません。VS Code は extension からの保存を手動の保存として扱うので、`files.trimTrailingWhitespace` など Markdown に設定した保存時の処理は、この保存でも毎回動きます。
- `mdanimater.richTheme`：mdanimater の editor の theme を選びます。`default` は VS Code の theme に合わせます。
- `mdanimater.richTablePreview`：Markdown の table を編集できる rich table として表示します。
- `mdanimater.mermaidPreview`：Mermaid の code block を図として表示します。
- `mdanimater.mermaidColorized`：Mermaid の図に mdanimater の見やすい配色を使います。
- `mdanimater.mermaidPreviewSize`：Mermaid の図の高さの決め方を選びます。
- `mdanimater.gherkinPreview`：Gherkin の code block を BDD board として表示します。
- `mdanimater.previewWidth`：既定の `wide`（Fit editor width）は画面幅に合わせて本文が伸縮します。広い画面では右側の目次の領域を確保します。固定幅で中央に寄せる場合は `default`（Fixed width）を選びます。以前の設定で `default` を明示指定している場合は `wide` に切り替えてください。
- 本文右端の縦の境界線をドラッグすると幅を調整でき、離したときに `mdanimater.previewWidthPixels` へ保存します（全ファイル共通）。ウィンドウが狭ければ収まる幅まで縮まり、広げ直すと指定幅に戻ります。境界線をダブルクリックすると自動幅に戻ります。ドラッグ中のEscは取消、境界線にTabで移動して左右矢印で20pxずつ（Shift併用で100px）、Homeで自動幅に戻せます。設定メニューから幅モードを選び直しても手動幅を解除できます。
- `mdanimater.lint.enabled`：Markdown file を検査して問題を報告します（既定で on）。
- `mdanimater.formatOnSave`：Markdown file を保存するときに format します（既定で off）。一定時間後の自動保存では format しません。

## Formatter と Lint

rule の on / off は `.mdanimaterrc.json` で設定します。mdanimater は Markdown file から workspace folder まで上にたどり、最も近い設定 file を使います。設定 file がなければ、すべての rule が既定値になります。file は comment 付きの JSON で、VS Code が rule 名を補完・検証します。**mdanimater: Open Menu → Create Formatter and Lint Configuration** を実行すると、すべての rule を並べた file から始められます。

```jsonc
{
  "format": {
    "rules": {
      "table-format": false,              // rule を off にする
      "list-marker": { "style": "*" }     // option 付きで rule を on にする
    }
  },
  "lint": {
    "rules": {
      "no-trailing-spaces": false,        // rule を off にする
      "heading-increment": "error",       // 重要度を指定して on にする：error, warning, info, hint
      "line-length": { "severity": "info", "max": 100 }
    }
  }
}
```

- rule の値は `true` / `false`、option の object（`{ "enabled": false }` でも off になる）、lint rule ならさらに重要度のどれかです。
- `"rules"` と同じ階層に `"default": false`（または `true`）を書くと、列挙していない rule がすべて off（または on）になります。一部の rule だけを使いたいときに便利です。
- `"format": false` や `"lint": false` は、その設定の対象になるすべての file で formatter や linter を止めます。
- 文書の中で lint rule を黙らせるには `<!-- mdanimater-lint-disable-next-line rule-name -->` を、範囲で黙らせるには `<!-- mdanimater-lint-disable rule-name -->` … `<!-- mdanimater-lint-enable rule-name -->` を使います。rule 名を書かなければ、すべての rule が対象です。

formatter は fence の code、front matter、HTML block、引用 block を変更しません。書き換えると表示が変わってしまう書き方は、そのまま残します。

| Formatter rule | 既定 | 内容 |
| --- | --- | --- |
| `heading-style` | on | 1 行の setext 見出し（`===` / `---` の下線）を `#` の見出しに変えます。 |
| `atx-heading` | on | `#` の後ろの空白を一つにし、indent と閉じの `#` を取り除きます。単独の行の `##Heading` には欠けている空白を足します。 |
| `list-marker` | on（`"-"`） | 箇条書きの記号を `"-"`・`"*"`・`"+"`・`"consistent"`（文書で最初に使われた記号）のどれかに揃えます。 |
| `ordered-list-numbering` | on（`"ordered"`） | 番号付き list を、最初の項目の番号から 1, 2, 3 と振り直します。同じ番号を繰り返している list はそのままです。`"one"` ではすべての項目を 1 にします。 |
| `thematic-break` | on | 区切り線を `---` で書きます。 |
| `table-format` | on | table の列を揃え、足りない cell を補います。 |
| `blank-lines-around-headings` | on | 見出しの前後に空行を入れます。 |
| `blank-lines-around-fences` | on | fence の code block の前後に空行を入れます。 |
| `blank-lines-around-lists` | on | list の前後に空行を入れます。 |
| `blank-lines-around-tables` | on | table の前後に空行を入れます。 |
| `trailing-whitespace` | on | 行末の空白を取り除きます。2 つの空白による改行は残します。 |
| `consecutive-blank-lines` | on | 続いた空行を一つにまとめ、先頭の空行を取り除きます。 |
| `final-newline` | on | file の末尾を改行一つで終わらせます。 |

| Lint rule | 既定 | 報告する内容 |
| --- | --- | --- |
| `heading-increment` | warning | 見出しの level が飛んでいる。 |
| `single-h1` | off | 最上位の `#` 見出しが二つ以上ある。Obsidian の note では `#` 見出しを並べることが多いので既定では off です。 |
| `no-duplicate-heading` | warning | 同じ階層に同じ文の見出しがある。 |
| `no-empty-heading` | warning | 文のない見出し。 |
| `heading-space` | warning | `#` の後ろの空白がない、または多い。 |
| `blanks-around-headings` | warning | 見出しの前後に空行がない。 |
| `blanks-around-fences` | warning | fence の code block の前後に空行がない。 |
| `blanks-around-lists` | warning | list の前後に空行がない。 |
| `blanks-around-tables` | warning | table の前後に空行がない。 |
| `fenced-code-language` | warning | 言語を指定していない fence の code block。 |
| `unclosed-code-fence` | error | 閉じていない code fence。 |
| `list-marker-style` | warning | 最初の記号、または `"style"` と違う箇条書きの記号。 |
| `ordered-list-numbering` | warning | 番号が順に並んでいない番号付き list。 |
| `table-column-count` | warning | 見出し行と cell の数が違う table の行。 |
| `no-empty-links` | warning | 行き先のない link。 |
| `no-reversed-links` | warning | `[text](url)` ではなく `(text)[url]` と書いた link。 |
| `no-missing-image-alt` | info | 代替 text のない画像。 |
| `no-broken-anchors` | warning | 文書内のどの見出しにも一致しない `#anchor` の link。 |
| `no-trailing-spaces` | warning | 2 つの空白による改行以外の、行末の空白。 |
| `no-hard-tabs` | off | code block の外の tab 文字。Obsidian は tab で字下げするので既定では off です。 |
| `no-multiple-blanks` | warning | 2 行以上続いた空行。 |
| `final-newline` | warning | 末尾の改行がない、または末尾に空行がある。 |
| `no-bare-urls` | off | link や `<url>` として書かれていない URL。 |
| `line-length` | off（`"max": 120`） | code と table の外で `max` 桁を超える行。 |

