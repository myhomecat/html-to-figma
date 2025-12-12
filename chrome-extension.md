# 크롬 익스텐션 개발 가이드

웹페이지 DOM을 추출하여 JSON으로 변환하는 크롬 익스텐션.

## 폴더 구조

```
chrome-extension/
├── manifest.json      # 익스텐션 설정
├── popup.html         # 팝업 UI
├── popup.js           # 팝업 로직
└── content.js         # DOM 추출 로직
```

---

## 파일별 코드

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "DOM to Figma",
  "version": "1.0",
  "description": "웹페이지 DOM을 Figma용 JSON으로 추출",
  "permissions": ["activeTab", "clipboardWrite", "scripting"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```

### popup.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      width: 280px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #333;
    }
    .btn {
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .btn-primary {
      background: #3b82f6;
      color: white;
    }
    .btn-primary:hover {
      background: #2563eb;
    }
    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }
    .btn-secondary:hover {
      background: #e5e7eb;
    }
    .status {
      margin-top: 12px;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      display: none;
    }
    .status.success {
      display: block;
      background: #d1fae5;
      color: #065f46;
    }
    .status.error {
      display: block;
      background: #fee2e2;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <h3>DOM to Figma</h3>
  <button id="extractPage" class="btn btn-primary">전체 페이지 추출</button>
  <button id="extractSelection" class="btn btn-secondary">선택 영역 추출</button>
  <div id="status" class="status"></div>
  <script src="popup.js"></script>
</body>
</html>
```

### popup.js

```javascript
const statusEl = document.getElementById('status');

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

// 전체 페이지 추출
document.getElementById('extractPage').onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractFullPage
    });

    if (results && results[0]) {
      await navigator.clipboard.writeText(JSON.stringify(results[0].result, null, 2));
      showStatus('클립보드에 복사됨! Figma 플러그인에서 붙여넣기하세요.', 'success');
    }
  } catch (err) {
    showStatus(`오류: ${err.message}`, 'error');
  }
};

// 선택 영역 추출 (향후 구현)
document.getElementById('extractSelection').onclick = () => {
  showStatus('선택 영역 추출은 향후 구현 예정', 'error');
};

// 전체 페이지 DOM 추출 함수
function extractFullPage() {
  return traverseDOM(document.body);
}

// DOM 순회 및 변환
function traverseDOM(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  // 보이지 않는 요소 스킵
  if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) {
    return null;
  }

  const node = {
    type: getNodeType(element, style),
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    fills: extractFills(style),
    strokes: extractStrokes(style),
    cornerRadius: extractCornerRadius(style),
    opacity: parseFloat(style.opacity) || 1
  };

  // 텍스트 노드
  if (node.type === 'TEXT') {
    node.text = element.innerText?.trim() || '';
    node.fontSize = parseInt(style.fontSize) || 14;
    node.fontFamily = style.fontFamily?.split(',')[0]?.replace(/['"]/g, '') || 'Inter';
    node.fontWeight = style.fontWeight || '400';
    node.textColor = extractColor(style.color);
    node.textAlign = style.textAlign || 'left';
    node.lineHeight = style.lineHeight;
  }

  // 자식 요소
  const children = [];
  for (const child of element.children) {
    const childNode = traverseDOM(child);
    if (childNode) {
      // 상대 좌표로 변환
      childNode.x = childNode.x - node.x;
      childNode.y = childNode.y - node.y;
      children.push(childNode);
    }
  }

  if (children.length > 0) {
    node.children = children;
  }

  return node;
}

// 노드 타입 결정
function getNodeType(element, style) {
  const tagName = element.tagName?.toLowerCase();

  if (['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'a'].includes(tagName)) {
    if (element.children.length === 0 || element.innerText) {
      return 'TEXT';
    }
  }

  if (tagName === 'img') return 'IMAGE';
  if (tagName === 'svg') return 'VECTOR';
  if (tagName === 'input' || tagName === 'textarea') return 'INPUT';
  if (tagName === 'button') return 'BUTTON';

  return 'FRAME';
}

// 배경색 추출
function extractFills(style) {
  const bg = style.backgroundColor;
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
    return [];
  }

  return [{
    type: 'SOLID',
    color: extractColor(bg)
  }];
}

// 테두리 추출
function extractStrokes(style) {
  const borderColor = style.borderColor;
  const borderWidth = parseInt(style.borderWidth);

  if (!borderWidth || borderWidth === 0) {
    return [];
  }

  return [{
    type: 'SOLID',
    color: extractColor(borderColor),
    width: borderWidth
  }];
}

// 모서리 둥글기 추출
function extractCornerRadius(style) {
  const radius = parseInt(style.borderRadius);
  return isNaN(radius) ? 0 : radius;
}

// 색상 추출 (rgb/rgba → {r, g, b})
function extractColor(colorStr) {
  if (!colorStr) return { r: 0, g: 0, b: 0 };

  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return {
      r: parseInt(match[1]) / 255,
      g: parseInt(match[2]) / 255,
      b: parseInt(match[3]) / 255
    };
  }

  return { r: 0, g: 0, b: 0 };
}
```

---

## 설치 방법

1. `chrome://extensions` 접속
2. 우측 상단 **"개발자 모드"** ON
3. **"압축해제된 확장 프로그램을 로드합니다"** 클릭
4. `chrome-extension` 폴더 선택

---

## 사용 방법

1. 변환하고 싶은 웹페이지 열기
2. 크롬 주소창 우측 익스텐션 아이콘 클릭
3. **"전체 페이지 추출"** 클릭
4. "클립보드에 복사됨" 메시지 확인
5. Figma에서 플러그인 실행 후 붙여넣기

---

## 향후 개선 사항

- [ ] 특정 요소 선택 추출
- [ ] 이미지 Base64 인라인 변환
- [ ] SVG 추출 지원
- [ ] 그라데이션 배경 지원
- [ ] 그림자(box-shadow) 지원
