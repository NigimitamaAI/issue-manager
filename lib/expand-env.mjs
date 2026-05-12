/**
 * 環境変数展開ユーティリティ(廃止予定)
 *
 * v1.0 で導入された ${VAR} / ${VAR:-default} 展開機能。
 * v1.x で setx 依存を廃止して config.json 一本化したため、本機能は使われなくなった。
 *
 * 後方互換のため空のスタブとして残しているが、新規コードでは import しないこと。
 * 将来のバージョンで完全削除する予定。
 *
 * 削除予定: v2.0
 */

/**
 * @deprecated v2.0 で削除予定。今は何もしない pass-through。
 */
export function expandEnv(value) {
  return value
}

/**
 * @deprecated v2.0 で削除予定。今は何もしない pass-through。
 */
export function expandEnvObject(obj) {
  return obj
}

/**
 * @deprecated v2.0 で削除予定。常に空配列を返す。
 */
export function findMissingVars() {
  return []
}
