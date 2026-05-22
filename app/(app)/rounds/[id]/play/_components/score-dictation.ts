export type SpeechRecognitionResultEvent = {
  results: {
    length: number;
    item(index: number): {
      length: number;
      item(index: number): { transcript: string };
    };
  };
};

export type SpeechRecognitionErrorEvent = {
  error?: string;
};

export type ScoreDictationPatch = {
  strokes: number | null;
  putts: number | null;
};

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return (
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
  );
}

const numberWords = new Map<string, number>([
  ["zero", 0],
  ["oh", 0],
  ["one", 1],
  ["two", 2],
  ["too", 2],
  ["to", 2],
  ["three", 3],
  ["four", 4],
  ["for", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["ate", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12],
  ["thirteen", 13],
  ["fourteen", 14],
  ["fifteen", 15],
]);

function getTokenNumber(token: string) {
  if (/^\d+$/.test(token)) return Number(token);
  return numberWords.get(token) ?? null;
}

function scoreTermToStrokes(tokens: string[], par: number) {
  const text = tokens.join(" ");
  if (text.includes("triple bogey")) return par + 3;
  if (text.includes("double bogey")) return par + 2;
  if (tokens.includes("eagle")) return par - 2;
  if (tokens.includes("birdie")) return par - 1;
  if (tokens.includes("par")) return par;
  if (tokens.includes("bogey")) return par + 1;
  return null;
}

function tokenize(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function parseScoreDictation(
  transcript: string,
  par: number,
): ScoreDictationPatch | null {
  const tokens = tokenize(transcript);

  if (!tokens.length) return null;

  const numbers = tokens
    .map((token, index) => ({ index, value: getTokenNumber(token) }))
    .filter(
      (number): number is { index: number; value: number } =>
        number.value != null,
    );
  let strokes = scoreTermToStrokes(tokens, par);
  let putts: number | null = null;

  if (
    strokes == null &&
    numbers.length === 1 &&
    /^\d{2}$/.test(tokens[numbers[0].index])
  ) {
    const [firstDigit, secondDigit] = tokens[numbers[0].index]
      .split("")
      .map(Number);

    return { strokes: firstDigit, putts: secondDigit };
  }

  for (const number of numbers) {
    const previousToken = tokens[number.index - 1];
    const nextToken = tokens[number.index + 1];
    const nearPutts =
      previousToken?.startsWith("putt") || nextToken?.startsWith("putt");
    const nearStrokes =
      previousToken?.startsWith("stroke") ||
      nextToken?.startsWith("stroke") ||
      previousToken === "score" ||
      nextToken === "score";

    if (nearPutts) {
      putts = number.value;
    } else if (nearStrokes) {
      strokes = number.value;
    }
  }

  const unassignedNumbers = numbers.filter((number) => {
    const previousToken = tokens[number.index - 1];
    const nextToken = tokens[number.index + 1];
    return (
      !previousToken?.startsWith("putt") &&
      !nextToken?.startsWith("putt") &&
      !previousToken?.startsWith("stroke") &&
      !nextToken?.startsWith("stroke") &&
      previousToken !== "score" &&
      nextToken !== "score"
    );
  });

  if (strokes == null && numbers.length >= 2) {
    strokes = numbers[0].value;
    putts ??= numbers[1].value;
  } else if (strokes != null && putts == null && unassignedNumbers.length) {
    putts = unassignedNumbers[0].value;
  } else if (strokes == null && numbers.length === 1) {
    strokes = numbers[0].value;
  }

  if (strokes != null && strokes < 1) strokes = null;
  if (putts != null && putts < 0) putts = null;

  if (strokes == null && putts == null) return null;

  return { strokes, putts };
}

export type TwoPlayerScoreDictation = {
  you: ScoreDictationPatch | null;
  delegate: ScoreDictationPatch | null;
};

export function parseTwoPlayerScoreDictation(
  transcript: string,
): TwoPlayerScoreDictation | null {
  const tokens = tokenize(transcript);
  if (!tokens.length) return null;

  const numbers: number[] = [];
  for (const token of tokens) {
    if (/^\d{2,}$/.test(token)) {
      for (const digit of token.split("")) numbers.push(Number(digit));
    } else {
      const value = getTokenNumber(token);
      if (value != null) numbers.push(value);
    }
  }

  if (numbers.length !== 4) return null;

  const you = toPatch(numbers[0], numbers[1]);
  const delegate = toPatch(numbers[2], numbers[3]);
  if (!you || !delegate) return null;

  return { you, delegate };
}

function toPatch(
  strokesValue: number | null,
  puttsValue: number | null,
): ScoreDictationPatch | null {
  const strokes = strokesValue != null && strokesValue >= 1 ? strokesValue : null;
  const putts = puttsValue != null && puttsValue >= 0 ? puttsValue : null;
  if (strokes == null && putts == null) return null;
  return { strokes, putts };
}
