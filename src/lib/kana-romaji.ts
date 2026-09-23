// ふりがな（ひらがな/カタカナ）をヘボン式ローマ字に変換するユーティリティ。
// 用途は一覧のソートキー生成のみで、完全な学術的正確性は目的としない。

const SMALL_Y = new Set(["ゃ", "ゅ", "ょ"]);

const ROMAJI_MAP: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", ゐ: "i", ゑ: "e", を: "o", ん: "n",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ゔ: "vu",
};

const YOON_MAP: Record<string, string> = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  じゃ: "ja", じゅ: "ju", じょ: "jo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
  ぢゃ: "ja", ぢゅ: "ju", ぢょ: "jo",
};

export function katakanaToHiragana(input: string): string {
  return input.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

export function kanaToRomaji(input: string): string {
  const hira = katakanaToHiragana(input.trim());
  let result = "";
  let i = 0;

  while (i < hira.length) {
    const ch = hira[i];
    const next = hira[i + 1];

    // 長音記号（ー）: 直前の母音を繰り返す
    if (ch === "ー") {
      const lastVowel = result.slice(-1);
      if ("aiueo".includes(lastVowel)) result += lastVowel;
      i += 1;
      continue;
    }

    // 促音（っ）: 次の子音を重ねる
    if (ch === "っ") {
      const nextPair = next ? hira.slice(i + 1, i + 3) : "";
      const nextRomaji = YOON_MAP[nextPair] ?? (next ? ROMAJI_MAP[next] : undefined);
      if (nextRomaji) {
        result += nextRomaji.startsWith("ch") ? "t" : nextRomaji[0];
      }
      i += 1;
      continue;
    }

    // 拗音（きゃ・しゅ 等）
    if (next && SMALL_Y.has(next)) {
      const pair = ch + next;
      if (YOON_MAP[pair]) {
        result += YOON_MAP[pair];
        i += 2;
        continue;
      }
    }

    if (ROMAJI_MAP[ch] !== undefined) {
      result += ROMAJI_MAP[ch];
      i += 1;
      continue;
    }

    // マッピング対象外の文字（英数字・記号・スペース等）はそのまま採用
    result += ch.toLowerCase();
    i += 1;
  }

  return result;
}
