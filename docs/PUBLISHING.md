# mdanimater の配布・名義確認手順

管理先は `oisworks/mdanimater`（public）、製品名は `mdanimater`、publisherは `oisworks`、現在の拡張機能IDは `oisworks.mdanimater`。Marketplace/Open VSX公開は別途指示がある場合に実施する。

## checkout・認証・履歴

- 配布用checkoutだけからpushする。開発用repositoryの履歴・作業ログ・todo・ローカル設定・認証情報・検査スクリプトは含めない。既存の未コミット作業を保全する。
- 操作認証のAPI実loginが `oisworks`、user IDが `194736958`、repository IDが非公開の現行配布記録に保存した期待IDと一致、private=false、admin権限、originが `https://github.com/oisworks/mdanimater.git` であることをpush直前に照合する。保存済み認証ラベルやグローバルGit設定に依存しない。
- Git author / committerは `oisworks <194736958+oisworks@users.noreply.github.com>` をcheckoutローカルに設定する。全commitの作者・メール・メッセージと全履歴のファイルを検査する。
- 所有者移管と名義統一を分けて検査する。移管だけでは過去commitの作者、publisher、release作成者、asset uploader、共同編集者、Actions実行者は変わらない。
- 名義統一の履歴置換では、全refs・Git bundle・release metadata・元VSIXを非公開のローカル領域へ退避し、置換用履歴・タグ・VSIXを先に検証する。既存の作業ログは開発側で正確に保存する。通常の配布では履歴を書き換えない。
- 履歴を置換する場合は対象refの期待SHAを確認し、明示的なforce-with-leaseを使う。他の変更があれば止めて取り込む。旧cloneからのpushで旧履歴を復活させない。
- releaseの作成者やasset uploaderを統一するため再作成する場合は、元releaseのID・日時・ダウンロード数が引き継がれないことを事前に示す。古いActionsやアクセス権の整理も対象を列挙する。

## 許可されたrepository再作成

- 再作成が明示指示された場合は、削除前に開発フォルダとGit情報、公開側の全refs・bundle・release metadata・添付ファイル・設定を非公開領域へ保存し、復元用ファイルを検証する。
- 現行配布checkoutの追跡ファイルを基準に開発側と照合し、公開対象の全ソースを新しいdirectoryへ複写する。旧`.git`・タグ・履歴・非公開の台帳や検査コードは持ち込まない。著作権表示と依存ライセンスは保持する。
- 新しいGit履歴は所定のauthor/committerによるroot commitから作成し、ソース・全object・metadataを検査する。削除直前に旧repository IDと期待HEADを再照合し、同じURLで作った後は新repository IDが旧IDと異なることを確認して現行記録を更新する。
- 退避した旧checkoutはpush URLを無効化し、以後の配布checkoutと検査の期待rootを新履歴へ切り替える。過去releaseのtagを現在のソースへ付け替えない。旧releaseはバックアップに保持し、現行版を配布する場合はその版のtag・VSIXを検証する。
- 新規cloneのファイル一致、rootと作者、公開refs、CI、ContributorsのAPI・トップカード・詳細グラフを個別に確認する。古いSHAや外部コピーの完全消去は保証せず、直接参照の観測結果と次回確認条件を非公開台帳へ記録する。

## 名前と配布物

- 単一VSIXに全機能を同梱する。個別機能の拡張インストールや初回有効化を必須にしない。Ctrl+Shift+Pとeditor上部の入口は `mdanimater.openMenu` にまとめ、新しい機能もこのメニュー内へ追加する。個別コマンドをパレットから隠しても既存ショートカットや文脈メニューで呼べる状態を保つ。manifestの公開入口数、メニューからの実行先、既定のeditor/diff自動表示、展開VSIXのhostと全3bundleを確認する。

- README本文・導入手順・設定例・manifest・lockfile・テスト・画面ラベル・展開済みVSIXのIdentityを照合する。ソースを直しただけで既存配布物も直ったとは扱わない。
- 製品名・package名・画面表示・command/setting IDの接頭辞をすべて `mdanimater` に統一する。editor IDは `mdanimater.editor`、設定ファイルは `.mdanimaterrc.json`、schemaは `schemas/mdanimaterrc.schema.json`、lint抑制構文は `mdanimater-lint-*`。旧名称を互換用として残す例外は設けない。移行手順の正本は [設定と移行ガイド](CONFIGURATION.md)。
- `npm run verify:branding` で現行ソース・文書・ファイル名・生成bundleを検査する。パッケージ作成後には展開先を `node scripts/verify-branding.mjs <展開先>` に渡し、VSIX内部も検査する。ソースと配布物の両方が合格するまで名称統一を完了にしない。
- publisher変更後は別の拡張機能として導入される。旧publisherの版を無効化またはアンインストールし、新版を有効にする。既定formatterと推奨拡張機能は新IDへ揃える。自動で置き換わるとは説明しない。
- release本文・添付VSIX内部・作成者・uploader・contributors・共同編集者・Actionsの実行者とartifactも確認する。旧名義検出語一覧と具体的な非公開識別子は配布repositoryへ置かない。
- 本名義でのMarketplace/Open VSXへの登録・公開は未実施。GitHub認証とregistryのpublisher/namespace権限は別に確認する。Deploy Extensionは手動opt-inとし、指示なく実行しない。

## 帰属とライセンス

Richdown 0.9.1を基にしている。`Copyright (c) 2026 mytooyo` とMIT全文、引き継いだeditor・preview・export・formatter・linter・theme・test・文書・iconの説明を保持する。mdanimaterの変更部分は同じ所有者の活動名 `oisworks` に統一する。第三者の名義を自分の名義に置き換えない。

`node scripts/generate-third-party-notices.mjs` でbundleに入る依存のライセンスを確認し、THIRD_PARTY_NOTICES.mdをソースとVSIXへ同梱する。

## 検証と継続レビュー

1. 開発用の現行改善台帳と前回レビュー・未評価・次回条件を読む。非公開の実績記録は配布ソースに複写しない。
2. 名義変更では既存manifest整合テスト、lint、test:coverage、build:all、verify:bundles、VSIX作成を行い、失敗と未実施を記録する。文書のみなら全テスト・再ビルドは不要。
3. 展開したVSIXのpackage.jsonとextension.vsixmanifestでpublisher/name・表示名・版番号を照合し、README・LICENSE・THIRD_PARTY_NOTICESと全ファイルを検査する。新IDへの移行だけで同じ版番号を使う場合は、同名VSIXの既存ファイルを上書きせず検証用に分離する。
4. push前に全refsの履歴・全ファイル・認証を検査し、反映後は新規cloneと取得VSIXを再検査する。CIの全jobも確認する。未参照commitやサービス側キャッシュの消去まで保証しない。
5. 名義変更時は即時レビューし、毎回の配布直前と配布更新2件ごとに再評価する。件数・前回対象・未評価・次回条件は開発用の継続改善台帳を正本とし、この文書へ重複して固定しない。既存の入力表示・Windows fixtureの未評価は引き継ぐ。

## GitHubの画面表示の確認

履歴/API/配布物/権限/画面の結果を分けて記録する。contributors APIが新名義だけでも、トップページのContributorsカードとグラフを確認するまで画面の除去完了と報告しない。画面を操作できない場合は画面未評価を明記する。

[GitHub公式の説明](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors#contributor-data-is-stale-after-history-changes)では履歴変更後の表示・統計更新に約24時間かかる場合がある。更新待ちは未解消として記録し、履歴変更から約24時間後を再確認条件にする。なお不正確なら所有者がSupportへ確認する。APIキャッシュと画面表示の更新時点を同一視しない。

- 再確認ではトップページの遅延読み込み完了後のカード、Contributors詳細グラフ（表示期間も記録）、contributors REST API、既定ブランチ全履歴と公開branch/tagを別々に照合する。初期HTMLのプレースホルダーに旧名義がないことは除去成功の証拠にしない。グラフはmerge/empty commitを除外するため、履歴と件数が違うだけで異常と判定しない。
- 履歴変更時刻はcommitのauthor日時ではなくpushイベント・対応CIなどの根拠とともに記録し、約24時間の再確認期限を具体化する。期限経過後の残存は待機を繰り返さず、repository URL/ID、現HEAD、変更と観測の時刻、カード/API/グラフの差、直接参照できる旧SHAを問い合わせ用の事実として非公開記録へまとめる。内部キャッシュの原因は推測と確定を区別する。
- 表示不整合の解消と未参照commitの消去は別判定にする。Supportへ問い合わせる場合は表示集計の再構築可否を確認し、送信は利用者の明示指示に従う。空commit・再force-push・repository再作成を調査だけの依頼で実施しない。
