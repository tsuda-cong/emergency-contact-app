// 古い iPhone（iOS 15.0〜15.3 の Safari）にない機能を補う。
// Next.js 本体と依存ライブラリがこれらを使っており、ないと一部の処理が途中で止まる。
// （構文の違いは package.json の browserslist で iOS 15 向けに変換している）

if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, "at", {
    value: function at<T>(this: T[], index: number): T | undefined {
      const i = Math.trunc(index) || 0;
      return this[i < 0 ? this.length + i : i];
    },
    writable: true,
    configurable: true,
  });
}

if (!String.prototype.at) {
  Object.defineProperty(String.prototype, "at", {
    value: function at(this: string, index: number): string | undefined {
      const i = Math.trunc(index) || 0;
      return this.charAt(i < 0 ? this.length + i : i) || undefined;
    },
    writable: true,
    configurable: true,
  });
}

if (!Object.hasOwn) {
  Object.defineProperty(Object, "hasOwn", {
    value: (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key),
    writable: true,
    configurable: true,
  });
}
