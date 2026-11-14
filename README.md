# mdanimater

**AIにも人間にも読みやすい、整形されたMarkdownを。**

mdanimater は、AIと自分をつなぐ接合部を強くするための VS Code 拡張機能です。ファイルはMarkdownのまま、人間には見出し・表・図を整形して見せ、その画面のまま書けるようにします。

## mdanimater の思想

### AIと自分の接合部は、文書である

AIがどれだけ賢くなっても、自分の考えがAIに伝わらず、AIの書いたものを自分が読み切れなければ、その力は自分に届きません。AIと自分の間を行き来しているのは文書です。前提や計画を自分が書いてAIが読み、AIが書いたものを自分が読んで直す。この往復の質が、AIと一緒にできる仕事の上限を決めます。

だから mdanimater が強くするのは、AIでも自分でもなく、その間にある文書です。

### 文書は、すべてMarkdownにすべきだ

AIが円滑に読めるのは、手元にあるテキストファイルです。オフィス製品やNotionのようなアプリの文書は、そのアプリの中に閉じています。AIに読ませるには書き出しや連携を挟むことになり、AIが直した結果を元の文書へ戻す手間も生まれます。

Markdownは、見出し・箇条書き・表といった構造をテキストだけで表せます。AIはそれを変換なしで読み、直接書き換えられます。自分が読んでいるファイルが、そのままAIの読むファイルになります。だから、文書は全部Markdownにすべきです。

### しかし、素のMarkdownは人間に読みにくい

素のMarkdownでは、文章に記号が混ざり、表は縦棒と文字の並びになり、図はコードになります。人間は読むたびに、それを頭の中で見出しや表や図に組み立て直すことになります。

読みにくい文書は、読まれなくなります。AIが書いた計画を流し読みで通してしまえば、接合部は人間の側で切れます。AIに合わせた形式を選ぶだけでは、半分しか解けていません。

### よって、整形Markdownが最適解である

| 文書の形式 | AIにとって | 人間にとって |
| --- | --- | --- |
| オフィス製品やNotionのようなアプリ | 読みにくい | 読みやすい |
| 素のMarkdown | 読みやすい | 読みにくい |
| **整形Markdown** | **読みやすい** | **読みやすい** |

答えは、**ファイルはMarkdownのまま、人間には整形して見せること**です。ここでいう「整形」は、ソースの空白や記号を揃えることだけでなく、見出しを見出しとして、表を表として、図を図として画面に表示することを指します。

AIはMarkdownを直接読み書きし、人間は整形された画面で読み書きする。両者が扱うのは、同じ一つのファイルです。AI用と人間用に文書を分けないので、どちらかが書いた内容を、もう一方がそのまま受け取れます。

mdanimater は、この考えを普段の作業場所であるIDEの中で実現するエディターです。整形した表示のまま編集でき、自分の入力とAIの編集が同じファイルの上でぶつからない仕組みを備えています。

> mdanimater は mytooyo さんの [Richdown](https://github.com/StructWorks/richdown)（MIT）を土台にしています。editor の大部分は Richdown のものです。Richdown の部分と mdanimater で足した部分は [Richdown について](#richdown-について) を見てください。

## インストール

拡張機能 ID は `oisworks.mdanimater` です。

[GitHub Releases](https://github.com/oisworks/mdanimater/releases/latest) から `mdanimater-<version>.vsix` を取得し、VS Code / Cursor の **Extensions: Install from VSIX...** でインストールします。

インストールはこの1本だけです。Markdown editor・Rich Diff・table・Mermaid・Gherkin・HTML/PDF出力・formatter・lintを同梱しており、機能別の拡張を追加する必要はありません。通常はMarkdownを開けばeditor、ソース管理からMarkdownの差分を開けばRich Diffが自動で使えます。初回に各機能をコマンドで有効にする操作も不要です。PDF出力にはインストール済みのChromium系browserを使います。

0.3.1から、Ctrl+Shift+Pに出る入口は **mdanimater: Open Menu** の1つです。手動操作が必要なときは、ここかeditor上部の **mdanimater** ボタンから選びます。

ソースからは `npm ci` と `npm run package:vsix` でVSIXを作成してインストールできます。0.3.0では設定・コマンドを含めた名称を統一しました。旧版の設定は下記の移行ガイドに沿って変更してください。

旧版を利用している場合は、無効化またはアンインストールしてから新版を有効にし、ウィンドウを再読み込みしてください。移行の詳細は [設定と旧版からの移行](docs/CONFIGURATION.md) を参照してください。

既定formatterの設定例：

```json
{
  "[markdown]": {
    "editor.defaultFormatter": "oisworks.mdanimater"
  }
}
```

## AI agent と同時に書く

- **自分の入力も agent の編集も両方残る。** editor は入力を差分として送り、VS Code 側の新しい text の上に載せ直します。入力中に届いた変更が自分の入力を上書きすることも、その逆もありません。
- **保存の衝突が起きない。** mdanimater で開いている file は、変更が止まってから 1 秒後に保存されます（自動保存は既定で on）。agent は disk に直接書き込みますが、VS Code が読み直すのは未保存の変更がない file だけです。そのため自動保存がないと、agent の書き込みは保存の衝突になります。
- **undo の履歴は一つ。** undo・redo・保存は VS Code に任せるので、rich editor と text editor が一つの履歴を共有します。agent の変更のあとで Ctrl+Z を押したときも、text editor と同じ動きになります。table の cell と検索欄は、それぞれ browser 標準の undo を使います。
- agent や他の tool が disk 上の file を変えると、開いている editor を更新します。
- Claude Code や Codex が出す Markdown file への link を、mdanimater のその行で開き、該当箇所を highlight します。VS Code の検索結果と Copilot Chat の link にも同じことができます（開いた位置への移動は既定で off）。ただし VS Code はその位置を text editor にしか渡さないので、いったん text editor で開いてから mdanimater に切り替わり、画面が一瞬ちらつきます。
- GitHub Copilot が開いている file に未確定の編集を持っているときは banner を出し、Keep・Undo・Review Changes の button を表示します。すべての編集が確定または取り消されると、mdanimater で開き直します。

## 機能

### 編集

- `.md` と `.markdown` の file を既定で mdanimater で開きます。WSL・SSH・Dev Containers・Codespaces 上の file も対象です。Source Control から新しく開く Markdown の Git diff も、整形された Rich Diff で表示します。mdanimater と text editor は、editor 上部の button か command palette で切り替えられます。
- 見出し・強調・inline code・link・画像・引用・task の checkbox・区切り線・syntax highlight 付きの code block・table・details block・Mermaid の図・Gherkin の scenario を、編集しながら表示します。
- Markdown の table を rich table として編集できます。cell の編集、行と列の追加・削除ができ、cell 内の `<br>` は改行として表示します。列幅は見出し cell の右端を drag して変えられます。幅の変更は開いている editor 内の表示にだけ反映され、Markdown 本文や Git 差分は変わりません。右端を double-click すると自動幅に戻ります。調整した幅は editor を閉じると失われます。以前の区切り行に保存された幅は互換表示しますが、自動で書き換えません。
- Mermaid の図（Markdown の fence と Azure DevOps 形式の `::: mermaid` block）を表示します。配色の変更、全体表示、拡大縮小、移動、modal 表示ができます。
- `gherkin`・`feature`・`cucumber` の code block を、切り替え可能な BDD board として表示します。
- YAML の front matter を key・値・tag の card として表示します。card を click すると YAML を編集できます。
- Markdown file 間の `#見出し` や `#L12` の link をたどり、その見出しや行へ移動します。
- VS Code に登録された補完 provider（他の extension のものも含む）と、code fence の言語名を補完候補に出します。
- `#ff0066` のような inline の色の値の後ろに色見本を出します。Git で追加・変更・削除された行は行番号の横とスクロールバー横に色付きの印を付け、右端の印を click するとその場所に移動します。検索の一致箇所は VS Code の検索と同じ色で highlight します。
- 本文は画面幅に合わせて自動で伸縮します。本文右端の境界線をdragすると好みの幅に調整して保存でき、double-clickで自動幅に戻せます。editor 内の設定 button から固定幅への切り替えと theme（暗い theme・明るい theme がいくつか、または VS Code の theme に合わせる）を選べます。

### 差分の確認と export

- Git の差分を、見出し・list・table・画像・link・code block を描画した状態で比べられます。表は列幅・配置を揃え、追加・削除を色と記号で表示します。Source Control のステージ済み・未ステージ・過去版の比較対象を保持します。原文の確認や行のステージ操作には、画面の **Source Diff** から VS Code 標準の差分を開けます。
- Rich Diff の **Review Comments** で GitHub PR / GitLab.com MR の URL を入力すると、既存のコメントと返信を IDE 内の隣接 panel で読めます。Refresh で再取得できます。信頼済み workspace と、sign-in 済みの公式 `gh` / `glab` CLI が必要です。読み取り専用で、投稿・返信・行への jump・self-hosted service は対象外です。
- local の Markdown file を、editor と同じ rich table・図・theme の HTML か PDF に export します。

### format と lint

- 設定できる rule で Markdown を format します。対象は見出しの書き方、list の記号と番号、table の位置揃え（全角文字は 2 桁として数える）、block の前後の空行、空白です。command palette、`Shift+Alt+F`、保存時のいずれかで実行します。
- lint rule で Markdown を検査し、問題を Problems panel と editor の波線で示します。editor 右端の overview ruler に文書全体の問題の位置が並び、印を click するか F8 / Shift+F8 で問題の間を移動できます。
- 各 rule は設定ファイルで on / off できます。詳しくは [Formatter と Lint](#formatter-と-lint) を見てください。

## Richdown について

mdanimater は、mytooyo さんが MIT License で公開している VS Code の Markdown editor、[Richdown](https://github.com/StructWorks/richdown) 0.9.1 の fork として始まりました。rich editor とその preview、rich table、Mermaid と Gherkin の表示、Rich Diff、HTML と PDF の export、formatter と linter、theme、test、そしてこの文書の多くは Richdown の成果です。Richdown を作り、open source として公開してくださった mytooyo さんに感謝します。

mdanimater はここから独自の方向に進み、Richdown の release は取り込みません。mdanimater で足したものは次のとおりです。

- editor と VS Code の間を差分で同期し、自分の入力と agent の編集を両方残す仕組み
- agent の disk への書き込みが保存の衝突にならないようにする自動保存
- undo・redo・保存を VS Code に任せ、undo の履歴を一つにすること
- 見出しの境界を drag して table の列幅を変える機能
- mdanimater の名前・command・設定ファイル

extension の icon は、今はまだ Richdown のものです。

## メニューの操作

Ctrl+Shift+P → **mdanimater: Open Menu**、またはeditor上部の **mdanimater** ボタンを開きます。

- **Toggle Markdown Open Mode**：Markdown file を mdanimater で開くか、VS Code 標準の text editor で開くかを切り替えます。
- **Open Rich Diff**：開いている Git diff の比較対象を保って整形表示します。通常の file からは `HEAD` と比較します。
- **Export HTML**：現在の local の Markdown file を、単独で開ける mdanimater の preview として export します。HTML は editor と同じ rich table・Mermaid・Gherkin・画像・task・code・theme の表示を使います。
- **Export PDF**：単独で開ける mdanimater の preview を、install 済みの Chromium 系 browser で印刷して PDF にします。
- **Format Document**：設定ファイルで有効な rule で現在の Markdown file を format します。mdanimater の editor では `Shift+Alt+F` でも実行できます。text editor では、mdanimater を Markdown の formatter に選んでいれば VS Code の Format Document が mdanimater を使います。
- **Create Formatter and Lint Configuration**：すべての rule を既定値と説明付きで並べた設定ファイルを workspace folder に作って開きます。

## 設定

自動保存、theme、本文の幅、table・Mermaid・Gherkinの表示、保存時のformatを変更できます。設定キーと具体的な使い方は [設定ガイド](docs/CONFIGURATION.md#設定) を参照してください。

## Formatter と Lint

**mdanimater: Open Menu → Create Formatter and Lint Configuration** で設定ファイルを作り、ruleを個別に有効・無効にできます。設定例、rule一覧、文書内で警告を抑制する方法は [Formatter と Lintの設定](docs/CONFIGURATION.md#formatter-と-lint) を参照してください。

## 開発

公開・帰属表示の手順は [公開手順](docs/PUBLISHING.md) を参照してください。

依存 package を install し、webview の bundle を build します。

```bash
npm install
npm run build:all
```

手元で extension を動かすには、次の手順を踏みます。

1. この folder を VS Code で開きます。
2. `F5` で Extension Development Host を起動します。
3. 新しく開いた VS Code の window で Markdown file を開きます。

test を実行します。

```bash
npm test                          # 1 回実行
npm run test:watch                # 変更のたびに再実行
npm run test:coverage             # src/ の coverage report
npm test -- test/diffRows.test.js # 一つの suite だけ
```

test は [test/](test/) にあり、[Vitest](https://vitest.dev) で動きます。`src/` の本物の module を import するので、`media/` として出荷される code を検査します。純粋な処理は既定の Node 環境で動き、DOM を扱う module は file 先頭の `// @vitest-environment jsdom` で jsdom を使います。

- [test/helpers/testKit.js](test/helpers/testKit.js) には、domain の test で使う CodeMirror の `Text` と選択範囲の代役があります。
- [test/helpers/previewHarness.js](test/helpers/previewHarness.js) は、preview の extension 一式を入れた本物の `EditorView` を作ります。table・Mermaid・Gherkin・front matter・details の preview を、editor が実際に作る decoration を通して検査します。
- [test/webviewBootstrap.test.js](test/webviewBootstrap.test.js) は、VS Code の host の代役の上で `src/richEditor.js` と `src/richDiff.js` を起動します。

`npm run test:coverage` は [vitest.config.js](vitest.config.js) の coverage の閾値を強制します。意図的に外している最大の部分は、[src/export/markdownExport.js](src/export/markdownExport.js) にある PDF export の Chrome DevTools まわりです。本物の browser が必要なためで、起動と失敗時の処理は [test/pdfExport.test.js](test/pdfExport.test.js) で代わりの実行 file を使って検査しています。

静的解析：

```bash
npm run lint       # extension.js, src/, test/ に ESLint をかける
npm run lint:fix   # 自動で直せる指摘を直す
```

rule は [eslint.config.mjs](eslint.config.mjs) にあり、extension host の file には node の global を、webview の file には browser の global を当てます。`media/` の生成済み bundle は lint しません。

### Pull request の品質 gate

[.github/workflows/ci.yml](.github/workflows/ci.yml) は、すべての pull request と `main` への push で動きます。

| Job | Command | 守るもの |
| --- | --- | --- |
| Lint | `npm run lint` | extension host・webview・test の ESLint の指摘 |
| 名称検査 | `npm run verify:branding` | ソース・文書・生成bundleでの製品名と識別子の統一。VSIX展開後にも同じ検査を実行 |
| Test | `npm run test:coverage` | Vitest の suite と coverage の閾値 |
| Bundles | `npm run verify:bundles` | commit 済みの `media/*.js` が `src/` と一致していること |
| Package VSIX | `npm run package:vsix` | extension が package でき、VSIX が artifact として残ること |

pull request を出す前に、同じ gate を手元で通します。

```bash
npm run lint && npm run test:coverage && npm run verify:bundles
```

VS Code が読み込むのは commit 済みの `media/*.js` です。[scripts/verify-bundles.mjs](scripts/verify-bundles.mjs) は各 bundle を memory 上で作り直し、commit 済みの file と比べます。失敗したら `npm run build:all` を実行して結果を commit してください。

VSIX を作ります。

```bash
npm run build:all
npx @vscode/vsce package
```

## Cursor と Open VSX

Cursor などの VS Code 互換 editor の多くは、Visual Studio Marketplace ではなく Open VSX を使います。Cursor の検索に mdanimater が出てこない場合は、作った VSIX を手動で install するか、Open VSX にも公開してください。

VSIX から手元に install する手順：

1. `npm run package:vsix` を実行します。
2. Cursor で command palette を開きます。
3. `Extensions: Install from VSIX...` を実行します。
4. 作られた `mdanimater-<version>.vsix` を選びます。

Open VSX に公開する：

```bash
npx ovsx create-namespace oisworks -p <open-vsx-token>
npm run publish:openvsx -- -p <open-vsx-token>
```

## GitHub Actions での deploy

`Deploy Extension` workflow は VSIX を一つ作り、Visual Studio Marketplace と Open VSX の両方に公開できます。手動実行専用です。GitHub への push だけでは registry へ公開しません。公開先の選択は既定で両方 off です。

GitHub の repository に次の secret を設定します。

- `VSCE_PAT`：Visual Studio Marketplace の personal access token
- `OVSX_PAT`：Open VSX の personal access token

手動で deploy する：

1. GitHub で repository を開きます。
2. `Actions` -> `Deploy Extension` に進みます。
3. workflow を実行し、Marketplace・Open VSX・両方のどれに公開するかを選びます。

Marketplace / Open VSX への公開には、それぞれの publisher 登録と認証が別途必要です。GitHub へのソース公開だけでは、これらの登録・公開は行いません。

## Release note

release note は root の `CHANGELOG.md` に記録しています。

## License

[MIT](LICENSE)。Copyright (c) 2026 mytooyo（Richdown）、2026 oisworks（mdanimater の変更部分）。

同梱依存ライブラリの著作権表示とライセンス全文は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) に収録しています。
