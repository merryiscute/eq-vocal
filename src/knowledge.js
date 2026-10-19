// Vocal knowledge base: what each measurement means, which exercise addresses it,
// and how strong the evidence is. `basis` is shown to the user verbatim:
//   'research'  - backed by the cited paper/manual
//   'heuristic' - common voice-teaching / mixing practice, not validated here

export const SOURCES = {
  boersma1993: {
    label: 'Boersma (1993) — 자기상관 기반 F0·HNR 측정',
    cite: 'Boersma, P. (1993). Accurate short-term analysis of the fundamental frequency and the harmonics-to-noise ratio of a sampled sound. Proc. Institute of Phonetic Sciences, Univ. of Amsterdam, 17, 97–110.',
  },
  praatHarmonicity: {
    label: 'Praat 매뉴얼 "Harmonicity"',
    cite: 'Boersma, P. & Weenink, D. Praat manual: Harmonicity.',
    url: 'https://www.fon.hum.uva.nl/praat/manual/Harmonicity.html',
  },
  omori1996: {
    label: 'Omori et al. (1996) — Singing Power Ratio',
    cite: 'Omori, K., Kacker, A., Carroll, L. M., Riley, W. D., & Blaugrund, S. M. (1996). Singing power ratio: quantitative evaluation of singing voice quality in singers and nonsingers. Journal of Voice, 10(3), 228–235.',
  },
  sundberg1974: {
    label: 'Sundberg (1974) — 가수 포먼트(2–4 kHz)',
    cite: 'Sundberg, J. (1974). Articulatory interpretation of the "singing formant". JASA, 55(4), 838–844.',
  },
  frokjaer1976: {
    label: 'Frøkjær-Jensen & Prytz (1976) — Alpha ratio',
    cite: 'Frøkjær-Jensen, B., & Prytz, S. (1976). Registration of voice quality. Brüel & Kjær Technical Review, 3, 3–17.',
  },
  titze2006: {
    label: 'Titze (2006) — 반폐쇄 성도(SOVT) 훈련',
    cite: 'Titze, I. R. (2006). Voice training and therapy with a semi-occluded vocal tract: rationale and scientific underpinnings. JSLHR, 49(2), 448–459.',
  },
  aaohns2018: {
    label: 'AAO-HNS (2018) 쉰 목소리 진료 가이드라인',
    cite: 'Stachler, R. J., et al. (2018). Clinical Practice Guideline: Hoarseness (Dysphonia) (Update). Otolaryngology–Head and Neck Surgery, 158(1_suppl), S1–S42.',
  },
  rbj: {
    label: 'Audio EQ Cookbook (RBJ) — 필터 계수',
    cite: 'Bristow-Johnson, R. Audio EQ Cookbook. W3C Note.',
    url: 'https://www.w3.org/TR/audio-eq-cookbook/',
  },
};

export const EXERCISES = {
  straw: {
    name: '빨대 발성 (SOVT)',
    how: '가는 빨대를 물고 "우—" 소리로 5초 롱톤 → 낮은음에서 높은음으로 사이렌. 하루 3분 × 3세트.',
    why: '입 앞을 좁히면 성도 안 압력이 성대 진동을 돕고, 적은 힘으로 안정된 진동을 만든다.',
    basis: 'research',
    source: 'titze2006',
  },
  longTone: {
    name: '롱톤 + 튜너',
    how: '편한 음 하나를 정해 튜너를 보며 8초 유지. 바늘이 ±10 cent 안에 머물도록. 5회.',
    why: '음정 유지는 귀-후두 피드백 루프 훈련이다. 눈(튜너)으로 피드백을 보조한다.',
    basis: 'heuristic',
  },
  balancedOnset: {
    name: '균형 시작 (balanced onset)',
    how: '"하—"(숨 먼저)와 "ㅇ아"(꽉 막았다 터뜨림) 사이의 중간을 찾는다. 숨소리도 "딱" 소리도 없이 "아"가 바로 시작되게. 10회.',
    why: '숨이 섞인 소리는 성대가 덜 닫힌 상태. 시작 순간의 접촉을 조율하는 연습이다.',
    basis: 'heuristic',
  },
  hummingOpen: {
    name: '허밍 → 모음 열기',
    how: '"음—" 허밍으로 입술·콧등이 간질간질한 진동을 찾은 뒤, 그 느낌 그대로 "음—마—" 로 입을 연다. 5회.',
    why: '앞쪽 공명 감각을 모음까지 이어 가는 연습.',
    basis: 'heuristic',
  },
  twang: {
    name: '트왱 "냐-냐-냐"',
    how: '약간 짓궂은 아이 목소리처럼 밝게 "냐냐냐" → 같은 위치로 "냐—아—". 소리가 작아도 멀리 가는 느낌이 목표. 크게 지르지 말 것.',
    why: '후두개 위쪽 통로(epilarynx)를 좁히면 2–4 kHz 에너지가 모인다는 것이 가수 포먼트의 대표적 설명이다.',
    basis: 'research',
    source: 'sundberg1974',
  },
  tongueForward: {
    name: '혀끝 앞니 뒤 고정',
    how: '혀끝을 아랫니 뒤에 붙인 채 "이—에—아" 를 이어 부른다. 혀뿌리가 뒤로 말려 들어가지 않게 거울로 확인.',
    why: '혀뿌리가 뒤로 밀리면 소리가 먹먹하고 어두워지기 쉽다.',
    basis: 'heuristic',
  },
  nosePinch: {
    name: '코 막기 확인 + "카-아"',
    how: '"아"를 내면서 코를 막았다 뗐다 한다. 소리가 변하면 콧길이 열린 것. "카—아" 로 연구개를 들어 올린 느낌을 기억하고, 코를 막아도 변화가 없어질 때까지 반복.',
    why: '비음이 아닌 모음에서 연구개가 닫히면 코로 소리가 새지 않아, 코를 막아도 음색이 거의 같다.',
    basis: 'heuristic',
  },
  softer: {
    name: '음량 낮춰 같은 울림 유지',
    how: '지금보다 한 단계 작게 같은 음을 내되, 소리가 앞으로 나가는 느낌은 유지. 날카로움이 줄면 그 볼륨을 기준으로 삼는다.',
    why: '과한 밀어붙임(press)은 고역을 거칠게 만든다.',
    basis: 'heuristic',
  },
};

export const DISCLAIMER = {
  text: '이 앱은 연습 보조 도구이며 진단 기기가 아닙니다. 쉰 목소리가 4주 이상 지속되거나 통증·삼킴 곤란이 있으면 이비인후과 진료를 받으세요.',
  source: 'aaohns2018',
};
