// Vocal knowledge base: what each measurement means, which exercise addresses it,
// and how strong the evidence is. `basis` is shown to the user verbatim:
//   'research'  - backed by the cited paper/manual
//   'heuristic' - common voice-teaching / mixing practice, not validated here
// SOURCES[].verified records the 2026-10 web check of each citation:
//   'confirmed' - bibliographic details matched a primary/indexing record
//   'partial'   - paper exists and content matches; some details (pages, authors) unconfirmed

export const SOURCES = {
  boersma1993: {
    label: 'Boersma (1993) — 자기상관 기반 F0·HNR 측정',
    cite: 'Boersma, P. (1993). Accurate short-term analysis of the fundamental frequency and the harmonics-to-noise ratio of a sampled sound. Proc. Institute of Phonetic Sciences, Univ. of Amsterdam, 17, 97–110.',
    url: 'https://www.fon.hum.uva.nl/archive/1993/Proc17Boersma.pdf',
    verified: 'confirmed',
  },
  praatHarmonicity: {
    label: 'Praat 매뉴얼 "Harmonicity"',
    cite: 'Boersma, P. & Weenink, D. Praat manual: Harmonicity.',
    url: 'https://www.fon.hum.uva.nl/praat/manual/Harmonicity.html',
    verified: 'confirmed',
    note: '"건강한 화자의 지속 [a]·[i]는 약 20 dB, [u]는 약 40 dB" — 매뉴얼 문구 확인.',
  },
  omori1996: {
    label: 'Omori et al. (1996) — Singing Power Ratio',
    cite: 'Omori, K., et al. (1996). Singing power ratio: quantitative evaluation of singing voice quality. Journal of Voice, 10(3). doi:10.1016/S0892-1997(96)80003-8',
    url: 'https://doi.org/10.1016/S0892-1997(96)80003-8',
    verified: 'partial',
    note: '권·호·DOI·PMID 8865093 확인. 쪽수와 전체 저자 목록은 미확인.',
  },
  sundberg1974: {
    label: 'Sundberg (1974) — 가수 포먼트(2–4 kHz)',
    cite: 'Sundberg, J. (1974). Articulatory interpretation of the "singing formant". Journal of the Acoustical Society of America, 55(4).',
    verified: 'partial',
    note: '논문과 내용(후두관 공명 모델)은 2차 문헌으로 확인. 쪽수 미확인. 모델 일부는 이후 반론이 있음 (Sundberg 1995 "The singer\'s formant revisited").',
  },
  frokjaer1975: {
    label: 'Frøkjær-Jensen & Prytz (1975) — Alpha ratio',
    cite: 'Frøkjær-Jensen, B., & Prytz, S. (1975). Registration of voice quality. Annual Report of the Institute of Phonetics, University of Copenhagen (ARIPUC), 9, 237–251.',
    url: 'https://tidsskrift.dk/ARIPUC/article/view/130977',
    verified: 'confirmed',
    note: '원 논문은 1 kHz 위/아래 에너지 비로 정의. 이 앱의 50 Hz–1 kHz / 1–5 kHz 대역은 이후 LTAS 연구의 관례.',
  },
  titze2006: {
    label: 'Titze (2006) — 반폐쇄 성도(SOVT) 훈련',
    cite: 'Titze, I. R. (2006). Voice training and therapy with a semi-occluded vocal tract: rationale and scientific underpinnings. JSLHR, 49(2), 448–459.',
    url: 'https://doi.org/10.1044/1092-4388(2006/035)',
    verified: 'confirmed',
    note: '컴퓨터 시뮬레이션 기반의 이론 논문. 효과 임상시험은 별도 (예: Kapsner-Smith et al. 2015).',
  },
  aaohns2018: {
    label: 'AAO-HNS (2018) 쉰 목소리 진료 가이드라인',
    cite: 'Stachler, R. J., et al. (2018). Clinical Practice Guideline: Hoarseness (Dysphonia) (Update). Otolaryngology–Head and Neck Surgery, 158(1_suppl), S1–S42.',
    url: 'https://doi.org/10.1177/0194599817751030',
    verified: 'confirmed',
    note: '"4주 안에 호전되지 않으면 후두내시경" 권고 확인.',
  },
  rbj: {
    label: 'Audio EQ Cookbook (RBJ) — 필터 계수',
    cite: 'Bristow-Johnson, R. Audio EQ Cookbook. W3C Note.',
    url: 'https://www.w3.org/TR/audio-eq-cookbook/',
    verified: 'confirmed',
    note: '필터 공식은 단위 테스트로 수치 검증.',
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
    why: '후두개 위쪽 통로(epilarynx)를 좁히면 2–4 kHz 에너지가 모인다는 것이 가수 포먼트의 대표적 설명이다 (일부 반론 있음). 연습법 자체는 발성 교육의 경험칙.',
    basis: 'heuristic',
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
  yawnOpen: {
    name: '하품 직전 "호—"',
    how: '하품이 나오기 직전처럼 목 안쪽을 가볍게 연 상태에서 "호—"를 편하게 낸다. 목에 힘이 들어가면 멈추고 다시. 5회.',
    why: '입안·목 공간을 넓히면 저역 공명이 늘어난다. 지나치면 먹먹해지니 "직전"까지만.',
    basis: 'heuristic',
  },
  sibilant: {
    name: '약한 "스—"',
    how: '혀끝을 아랫니 뒤에 두고 숨을 약하게 내보내며 "스—". 휘파람 같은 날카로운 소리가 줄어드는 혀 위치를 찾은 뒤 "사, 스, 소"로 연결.',
    why: 'ㅅ 소리는 혀와 이 사이의 좁은 틈에서 나온다. 틈과 숨의 세기가 과하면 치찰음이 커진다.',
    basis: 'heuristic',
  },
  consonant: {
    name: '볼펜 물고 읽기',
    how: '볼펜을 앞니로 가볍게 물고 가사를 또박또박 1분 읽은 뒤, 볼펜을 빼고 같은 가사를 읽는다.',
    why: '발음을 방해받은 뒤 풀어 주면 혀·입술 움직임이 커져 자음이 또렷해진다.',
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
