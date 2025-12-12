# Figma 플러그인 개발 가이드

JSON 데이터를 받아 Figma 디자인 노드로 변환하는 플러그인.

## 폴더 구조

```
figma-plugin/
├── manifest.json      # 플러그인 설정
├── code.ts            # 메인 로직 (TypeScript)
├── code.js            # 컴파일된 JS
├── ui.html            # UI
└── tsconfig.json      # TypeScript 설정 (선택)
```

---

## 파일별 코드

### manifest.json

```json
{
  "name": "DOM Import",
  "id": "dom-import-plugin",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["none"]
  }
}
```

### ui.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 16px;
      background: #fff;
    }
    h3 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #333;
    }
    textarea {
      width: 100%;
      height: 200px;
      padding: 12px;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 11px;
      resize: vertical;
      margin-bottom: 12px;
    }
    textarea:focus {
      outline: none;
      border-color: #18a0fb;
    }
    .btn-row {
      display: flex;
      gap: 8px;
    }
    .btn {
      flex: 1;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-primary {
      background: #18a0fb;
      color: white;
    }
    .btn-primary:hover {
      background: #0d8de3;
    }
    .btn-secondary {
      background: #f0f0f0;
      color: #333;
    }
    .btn-secondary:hover {
      background: #e5e5e5;
    }
    .status {
      margin-top: 12px;
      padding: 10px;
      border-radius: 6px;
      font-size: 11px;
      display: none;
    }
    .status.success {
      display: block;
      background: #e6f7ed;
      color: #1e7e34;
    }
    .status.error {
      display: block;
      background: #fce8e8;
      color: #c53030;
    }
    .status.info {
      display: block;
      background: #e8f4fd;
      color: #1a73e8;
    }
  </style>
</head>
<body>
  <h3>JSON 데이터 붙여넣기</h3>
  <textarea id="json" placeholder="크롬 익스텐션에서 복사한 JSON을 여기에 붙여넣으세요..."></textarea>
  <div class="btn-row">
    <button id="paste" class="btn btn-secondary">붙여넣기</button>
    <button id="import" class="btn btn-primary">Import</button>
  </div>
  <div id="status" class="status"></div>

  <script>
    const jsonEl = document.getElementById('json');
    const statusEl = document.getElementById('status');

    function showStatus(message, type) {
      statusEl.textContent = message;
      statusEl.className = `status ${type}`;
    }

    // 붙여넣기 버튼
    document.getElementById('paste').onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        jsonEl.value = text;
        showStatus('붙여넣기 완료', 'success');
      } catch (err) {
        showStatus('클립보드 접근 권한이 필요합니다', 'error');
      }
    };

    // Import 버튼
    document.getElementById('import').onclick = () => {
      const json = jsonEl.value.trim();

      if (!json) {
        showStatus('JSON 데이터를 입력해주세요', 'error');
        return;
      }

      try {
        JSON.parse(json); // 유효성 검사
        showStatus('변환 중...', 'info');
        parent.postMessage({ pluginMessage: { type: 'import', data: json } }, '*');
      } catch (err) {
        showStatus('유효하지 않은 JSON 형식입니다', 'error');
      }
    };

    // 플러그인 메시지 수신
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (msg.type === 'success') {
        showStatus(`완료! ${msg.count}개 노드 생성됨`, 'success');
      } else if (msg.type === 'error') {
        showStatus(`오류: ${msg.message}`, 'error');
      }
    };
  </script>
</body>
</html>
```

### code.ts (또는 code.js)

```typescript
// Figma Plugin API 타입 사용
// npm install --save-dev @figma/plugin-typings

figma.showUI(__html__, { width: 400, height: 360 });

figma.ui.onmessage = async (msg: { type: string; data: string }) => {
  if (msg.type === 'import') {
    try {
      const data = JSON.parse(msg.data);

      // 폰트 로드
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

      // 루트 프레임 생성
      const rootFrame = figma.createFrame();
      rootFrame.name = 'Imported Design';
      rootFrame.resize(data.width || 800, data.height || 600);
      rootFrame.x = figma.viewport.center.x - (data.width || 800) / 2;
      rootFrame.y = figma.viewport.center.y - (data.height || 600) / 2;

      if (data.fills && data.fills.length > 0) {
        rootFrame.fills = convertFills(data.fills);
      }

      // 자식 노드 생성
      let nodeCount = 1;
      if (data.children) {
        for (const child of data.children) {
          nodeCount += await createNode(child, rootFrame);
        }
      }

      // 선택 및 뷰포트 이동
      figma.currentPage.selection = [rootFrame];
      figma.viewport.scrollAndZoomIntoView([rootFrame]);

      figma.ui.postMessage({ type: 'success', count: nodeCount });
    } catch (err: any) {
      figma.ui.postMessage({ type: 'error', message: err.message });
    }
  }
};

// 노드 생성 함수
async function createNode(data: any, parent: FrameNode | GroupNode): Promise<number> {
  let node: SceneNode;
  let count = 1;

  switch (data.type) {
    case 'TEXT':
      node = await createTextNode(data);
      break;
    case 'IMAGE':
      node = createImageNode(data);
      break;
    default:
      node = createFrameNode(data);
  }

  // 위치 설정
  node.x = data.x || 0;
  node.y = data.y || 0;

  // 부모에 추가
  parent.appendChild(node);

  // 자식 노드 재귀 생성
  if (data.children && data.children.length > 0 && 'appendChild' in node) {
    for (const child of data.children) {
      count += await createNode(child, node as FrameNode);
    }
  }

  return count;
}

// 프레임 노드 생성
function createFrameNode(data: any): FrameNode {
  const frame = figma.createFrame();
  frame.name = data.name || 'Frame';
  frame.resize(
    Math.max(data.width || 100, 1),
    Math.max(data.height || 100, 1)
  );

  // 배경색
  if (data.fills && data.fills.length > 0) {
    frame.fills = convertFills(data.fills);
  } else {
    frame.fills = [];
  }

  // 테두리
  if (data.strokes && data.strokes.length > 0) {
    frame.strokes = convertFills(data.strokes);
    frame.strokeWeight = data.strokes[0].width || 1;
  }

  // 모서리 둥글기
  if (data.cornerRadius) {
    frame.cornerRadius = data.cornerRadius;
  }

  // 투명도
  if (data.opacity !== undefined) {
    frame.opacity = data.opacity;
  }

  return frame;
}

// 텍스트 노드 생성
async function createTextNode(data: any): Promise<TextNode> {
  const text = figma.createText();
  text.name = data.text?.substring(0, 20) || 'Text';

  // 폰트 로드 시도
  const fontFamily = data.fontFamily || 'Inter';
  const fontStyle = getFontStyle(data.fontWeight);

  try {
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    text.fontName = { family: fontFamily, style: fontStyle };
  } catch {
    // 폴백: Inter 사용
    text.fontName = { family: 'Inter', style: fontStyle };
  }

  text.characters = data.text || '';
  text.fontSize = data.fontSize || 14;

  // 텍스트 색상
  if (data.textColor) {
    text.fills = [{
      type: 'SOLID',
      color: data.textColor
    }];
  }

  // 크기 조정
  if (data.width) {
    text.resize(data.width, text.height);
    text.textAutoResize = 'HEIGHT';
  }

  return text;
}

// 이미지 노드 생성 (플레이스홀더)
function createImageNode(data: any): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = 'Image Placeholder';
  rect.resize(data.width || 100, data.height || 100);
  rect.fills = [{
    type: 'SOLID',
    color: { r: 0.9, g: 0.9, b: 0.9 }
  }];
  return rect;
}

// 색상 변환
function convertFills(fills: any[]): Paint[] {
  return fills.map(fill => ({
    type: 'SOLID' as const,
    color: {
      r: fill.color?.r ?? 0,
      g: fill.color?.g ?? 0,
      b: fill.color?.b ?? 0
    }
  }));
}

// 폰트 스타일 매핑
function getFontStyle(weight: string | number): string {
  const w = typeof weight === 'string' ? parseInt(weight) : weight;
  if (w >= 700) return 'Bold';
  if (w >= 500) return 'Medium';
  return 'Regular';
}
```

### tsconfig.json (TypeScript 사용 시)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "typeRoots": ["./node_modules/@figma/plugin-typings"]
  }
}
```

---

## 설치 방법

### 1. 폴더 생성
```bash
mkdir figma-plugin
cd figma-plugin
```

### 2. TypeScript 사용 시 (선택)
```bash
npm init -y
npm install --save-dev typescript @figma/plugin-typings
npx tsc code.ts
```

### 3. Figma에서 플러그인 등록
1. Figma 데스크톱 앱 열기
2. 메뉴 → **Plugins** → **Development** → **Import plugin from manifest...**
3. `figma-plugin/manifest.json` 선택

---

## 사용 방법

1. Figma 파일 열기
2. 메뉴 → **Plugins** → **Development** → **DOM Import**
3. 크롬 익스텐션에서 복사한 JSON 붙여넣기
4. **Import** 클릭
5. 디자인 생성 완료

---

## 지원 기능

| 기능 | 지원 |
|-----|------|
| 프레임/박스 | ✅ |
| 텍스트 | ✅ |
| 배경색 (단색) | ✅ |
| 테두리 | ✅ |
| 모서리 둥글기 | ✅ |
| 투명도 | ✅ |
| 이미지 | ⚠️ 플레이스홀더 |
| 그라데이션 | ❌ |
| 그림자 | ❌ |
| SVG | ❌ |

---

## 향후 개선 사항

- [ ] 이미지 Base64 → Figma 이미지 변환
- [ ] 그라데이션 배경 지원
- [ ] box-shadow → Figma Effects 변환
- [ ] SVG 인라인 삽입
- [ ] Auto Layout 자동 적용
- [ ] 컴포넌트 자동 감지
