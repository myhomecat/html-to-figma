# Quick Start - 빠른 시작 가이드

## 전제 조건

- Chrome 브라우저
- Figma 데스크톱 앱 (권장) 또는 Figma 웹

---

## Step 1: 크롬 익스텐션 설치

```bash
# 1. 폴더 생성
mkdir -p ~/dom-to-figma/chrome-extension
cd ~/dom-to-figma/chrome-extension

# 2. 파일 생성 (chrome-extension.md 참고)
# - manifest.json
# - popup.html
# - popup.js
```

```
# 3. 크롬에서 설치
1. chrome://extensions 접속
2. "개발자 모드" ON
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. chrome-extension 폴더 선택
```

---

## Step 2: Figma 플러그인 설치

```bash
# 1. 폴더 생성
mkdir -p ~/dom-to-figma/figma-plugin
cd ~/dom-to-figma/figma-plugin

# 2. 파일 생성 (figma-plugin.md 참고)
# - manifest.json
# - code.js (또는 code.ts 컴파일)
# - ui.html
```

```
# 3. Figma에서 설치
1. Figma 데스크톱 앱 열기
2. 메뉴 → Plugins → Development → Import plugin from manifest...
3. figma-plugin/manifest.json 선택
```

---

## Step 3: 사용하기

```
1. 크롬에서 변환할 웹페이지 열기

2. 크롬 익스텐션 아이콘 클릭 → "전체 페이지 추출"
   → "클립보드에 복사됨" 메시지 확인

3. Figma 열기

4. 메뉴 → Plugins → Development → DOM Import

5. "붙여넣기" 버튼 클릭 (또는 Ctrl+V)

6. "Import" 버튼 클릭

7. 디자인 생성 완료!
```

---

## 트러블슈팅

### 크롬 익스텐션이 동작하지 않음
- `chrome://extensions`에서 "오류" 버튼 확인
- manifest.json의 permissions 확인

### Figma 플러그인에서 "유효하지 않은 JSON"
- 크롬 익스텐션에서 복사가 제대로 되었는지 확인
- JSON 시작/끝이 `{`와 `}`인지 확인

### 폰트가 다르게 보임
- Figma에서 해당 폰트가 설치되어 있어야 함
- 기본 폴백: Inter 폰트 사용

### 이미지가 회색 박스로 표시됨
- 현재 버전은 이미지를 플레이스홀더로 대체
- 향후 Base64 이미지 지원 예정

---

## 파일 구조 요약

```
dom-to-figma/
├── chrome-extension/
│   ├── manifest.json
│   ├── popup.html
│   └── popup.js
│
└── figma-plugin/
    ├── manifest.json
    ├── code.js
    └── ui.html
```

---

## 다음 단계

1. **선택 영역 추출** - 특정 요소만 선택해서 추출
2. **이미지 지원** - Base64 인코딩으로 이미지 포함
3. **서버 연동** - 클립보드 대신 서버 통신으로 완전 자동화
4. **배치 처리** - 여러 페이지 한번에 변환
