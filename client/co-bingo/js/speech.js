/**
 * speech.js — Web Speech API wrapper for voice number recognition.
 * Supports Korean number words, native Korean, and digits.
 */

let _recognition = null;

export function isSpeechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Start listening. Calls onResult(number) or onError(message).
 */
export function startListening(onResult, onError) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onError('이 브라우저는 음성 인식을 지원하지 않습니다.'); return; }

  stopListening(); // stop any previous session

  _recognition = new SR();
  _recognition.lang = 'ko-KR';
  _recognition.interimResults = true;   // lets engine process audio eagerly (helps short speech)
  _recognition.maxAlternatives = 5;
  _recognition.continuous = false;

  let _done = false;
  let _lastRaw = ''; // tracks latest transcript for onend fallback

  _recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const alts = Array.from(result);

      // Always update last known transcript (used as onend fallback)
      const t = alts[0]?.transcript?.trim();
      if (t) _lastRaw = t;

      // Only parse FINAL results — avoids "십" matching mid-word when saying "십오"
      if (!result.isFinal) continue;

      for (const alt of alts) {
        const raw = alt.transcript.trim();
        const num = parseSpokenNumber(raw);
        if (num !== null) { _done = true; onResult(num, raw); return; }
      }
      _done = true;
      onError(`"${alts[0]?.transcript ?? ''}" — 숫자를 인식하지 못했습니다.`);
      return;
    }
  };

  _recognition.onerror = (event) => {
    if (_done) return;
    const msgs = {
      'no-speech':   '소리가 감지되지 않았습니다.',
      'not-allowed': '마이크 권한을 허용해 주세요.',
      'aborted':     '',
      'audio-capture': '마이크를 찾을 수 없습니다.',
      'network':     '네트워크 오류가 발생했습니다.',
    };
    const msg = msgs[event.error] ?? `음성 인식 오류 (${event.error})`;
    if (msg) onError(msg);
  };

  // Fallback: if stop() was called before isFinal fired, try last captured text
  _recognition.onend = () => {
    if (!_done && _lastRaw) {
      const num = parseSpokenNumber(_lastRaw);
      if (num !== null) onResult(num, _lastRaw);
      else onError(`"${_lastRaw}" — 숫자를 인식하지 못했습니다.`);
    }
    _recognition = null;
  };

  try {
    _recognition.start();
  } catch (e) {
    onError('음성 인식을 시작할 수 없습니다.');
    _recognition = null;
  }
}

export function stopListening() {
  if (_recognition) {
    try { _recognition.abort(); } catch (_) {}
    _recognition = null;
  }
}

/** Stop recording and let the engine process buffered audio (fires onresult). */
export function stopAndProcess() {
  if (_recognition) {
    try { _recognition.stop(); } catch (_) {}
  }
}

// ─── Number Parser ────────────────────────────────────────────────────────────

const SINO_MAP = {
  '일': 1, '이': 2, '삼': 3, '사': 4, '오': 5,
  '육': 6, '칠': 7, '팔': 8, '구': 9,
};
const NATIVE_MAP = {
  '하나': 1, '둘': 2, '셋': 3, '넷': 4, '다섯': 5,
  '여섯': 6, '일곱': 7, '여덟': 8, '아홉': 9, '열': 10,
  '열하나': 11, '열둘': 12, '열셋': 13, '열넷': 14, '열다섯': 15,
  '열여섯': 16, '열일곱': 17, '열여덟': 18, '열아홉': 19, '스물': 20,
  '스물하나': 21, '스물둘': 22, '스물셋': 23, '스물넷': 24, '스물다섯': 25,
};

function parseSinoKorean(t) {
  // 십 = 10, 이십 = 20, X십Y = X*10+Y
  if (t === '십') return 10;
  // "이십오" → 25, "십오" → 15, "이십" → 20
  const m = t.match(/^([이삼사오육칠팔구]?)십([일이삼사오육칠팔구]?)$/);
  if (m) {
    const tens = m[1] ? (SINO_MAP[m[1]] ?? 0) : 1;
    const ones = m[2] ? (SINO_MAP[m[2]] ?? 0) : 0;
    return tens * 10 + ones;
  }
  // Single digit word
  return SINO_MAP[t] ?? null;
}

export function parseSpokenNumber(raw) {
  const t = raw.replace(/\s+/g, '').replace(/[.,!?]/g, '');

  // 1. Pure digits
  const digitMatch = t.match(/^(\d{1,2})$/);
  if (digitMatch) {
    const n = parseInt(digitMatch[1]);
    return (n >= 1 && n <= 25) ? n : null;
  }

  // 2. Digits embedded in text (e.g. "숫자 15")
  const embeddedDigit = t.match(/(\d{1,2})/);
  if (embeddedDigit) {
    const n = parseInt(embeddedDigit[1]);
    if (n >= 1 && n <= 25) return n;
  }

  // 3. Native Korean
  if (NATIVE_MAP[t] !== undefined) return NATIVE_MAP[t];

  // 4. Sino-Korean
  const sino = parseSinoKorean(t);
  if (sino !== null && sino >= 1 && sino <= 25) return sino;

  // 5. Partial match — strip prefixes like "숫자", "번", "호" etc.
  const stripped = t.replace(/^(숫자|번호|번|호|숫|Number|number)/i, '');
  if (stripped !== t) return parseSpokenNumber(stripped);

  return null;
}
