# HTML to Figma 자동화 파이프라인

웹페이지 DOM을 추출하여 Figma 디자인으로 자동 변환하는 시스템.

## 배경

### 기존 도구들의 한계

| 도구 | 무료 제한 |
|-----|----------|
| html.to.design | 월 3회 |
| Website To Design | 5회 |
| Builder.io | 무료 티어 있음 (횟수 제한) |
| code.to.design API | 유료 |

**완전 무료 무제한 도구가 없음** → 직접 구축 필요

### Figma API 종류

| | REST API | Plugin API |
|---|----------|------------|
| 실행 위치 | 외부 서버/스크립트 | Figma 앱 내부 |
| 인증 | 토큰 필요 | 불필요 (앱 내부 실행) |
| 파일 읽기 | ✅ | ✅ |
| **디자인 생성** | ❌ | ✅ |

- REST API: 파일 정보 조회, 이미지 내보내기, 코멘트 등 **읽기 위주**
- Plugin API: `figma.createFrame()`, `figma.createText()` 등 **생성 가능**

**결론:** 디자인 자동 생성은 Plugin API로만 가능

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        자동화 파이프라인                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [크롬 브라우저]                    [Figma 데스크톱]              │
│         │                                │                      │
│    크롬 익스텐션                     Figma 플러그인               │
│         │                                │                      │
│    1. DOM 분석                      3. JSON 파싱                │
│    2. JSON 생성 ──── 클립보드 ────→ 4. Figma 노드 생성           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 데이터 흐름

1. **크롬 익스텐션**: 현재 웹페이지 DOM 순회 → 스타일/위치/크기 추출 → JSON 생성
2. **클립보드**: JSON 데이터 전달 (가장 단순한 방식)
3. **Figma 플러그인**: JSON 파싱 → Figma API로 노드 생성

### JSON 데이터 구조

```json
{
  "type": "FRAME",
  "x": 0,
  "y": 0,
  "width": 600,
  "height": 400,
  "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }],
  "cornerRadius": 12,
  "children": [
    {
      "type": "TEXT",
      "x": 20,
      "y": 20,
      "text": "Hello",
      "fontSize": 16,
      "fontFamily": "Inter"
    }
  ]
}
```

---

## 참고 자료

- [sergcen/html-to-figma](https://github.com/sergcen/html-to-figma) - DOM → Figma 변환 라이브러리
- [Figma Plugin API Reference](https://developers.figma.com/docs/plugins/api/api-reference/)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
