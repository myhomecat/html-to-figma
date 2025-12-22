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

    if (results && results[0] && results[0].result) {
      const json = JSON.stringify(results[0].result, null, 2);
      await navigator.clipboard.writeText(json);
      showStatus('클립보드에 복사됨! Figma 플러그인에서 붙여넣기하세요.', 'success');
    } else {
      showStatus('추출 실패', 'error');
    }
  } catch (err) {
    showStatus(`오류: ${err.message}`, 'error');
  }
};

// DOM 추출 함수 (페이지 컨텍스트에서 실행됨)
function extractFullPage() {

  // 직접 텍스트 노드가 있는지 확인
  function hasDirectTextContent(element) {
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        return true;
      }
    }
    return false;
  }

  // 노드 타입 결정
  function getNodeType(element, style) {
    const tagName = element.tagName ? element.tagName.toLowerCase() : '';

    // 이미지, SVG, 인풋 등은 우선 처리
    if (tagName === 'img') return 'IMAGE';
    if (tagName === 'svg') return 'VECTOR';
    if (tagName === 'input' || tagName === 'textarea') return 'INPUT';
    if (tagName === 'select') return 'SELECT';

    // div는 항상 FRAME으로 유지 (레이아웃 구조 보존)
    if (tagName === 'div') return 'FRAME';

    // 텍스트 태그들 (div 제외, td/th는 FRAME으로 처리하여 padding 적용)
    const textTags = ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'a', 'button', 'li', 'strong', 'em', 'b', 'i'];

    // 텍스트 태그이고 자식이 없거나 직접 텍스트가 있는 경우 → TEXT
    if (textTags.includes(tagName)) {
      if (element.children.length === 0 && element.innerText && element.innerText.trim()) {
        return 'TEXT';
      }
      if (hasDirectTextContent(element)) {
        return 'TEXT';
      }
    }

    return 'FRAME';
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

  // DOM 순회 및 변환
  function traverseDOM(element, parentRect = null) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    // 보이지 않는 요소 스킵
    if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) {
      return null;
    }

    const nodeType = getNodeType(element, style);

    const node = {
      type: nodeType,
      name: (element.className ? element.className.toString().split(' ')[0] : '') || (element.tagName ? element.tagName.toLowerCase() : 'element'),
      x: Math.round(parentRect ? rect.left - parentRect.left : rect.left),
      y: Math.round(parentRect ? rect.top - parentRect.top : rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      fills: extractFills(style),
      strokes: extractStrokes(style),
      cornerRadius: extractCornerRadius(style),
      opacity: parseFloat(style.opacity) || 1
    };

    // 텍스트 노드
    if (nodeType === 'TEXT') {
      node.text = element.innerText ? element.innerText.trim() : '';
      node.fontSize = parseInt(style.fontSize) || 14;
      var fontFamily = style.fontFamily || 'Inter';
      node.fontFamily = fontFamily.split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
      node.fontWeight = style.fontWeight || '400';
      node.textColor = extractColor(style.color);
      node.textAlign = style.textAlign || 'left';
    }

    // INPUT/TEXTAREA value 및 placeholder 추출
    if (nodeType === 'INPUT') {
      const inputType = element.type || 'text';

      // 실제 입력된 값 추출
      node.value = element.value || '';

      // date 계열 input의 기본 placeholder 설정 (브라우저 네이티브 UI는 Shadow DOM이라 접근 불가)
      if (inputType === 'date' && !element.value) {
        node.placeholder = '연 . 월 . 일';
      } else if (inputType === 'datetime-local' && !element.value) {
        node.placeholder = '연 . 월 . 일   --:--';
      } else if (inputType === 'time' && !element.value) {
        node.placeholder = '--:--';
      } else if (inputType === 'month' && !element.value) {
        node.placeholder = '연 . 월';
      } else if (inputType === 'week' && !element.value) {
        node.placeholder = '연 . 주';
      } else {
        node.placeholder = element.placeholder || '';
      }

      node.fontSize = parseInt(style.fontSize) || 14;
      node.fontFamily = (style.fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim();
      node.textColor = extractColor(style.color);
    }

    // SELECT 요소 - 현재 선택된 값만 추출
    if (nodeType === 'SELECT') {
      const selectedOption = element.options[element.selectedIndex];
      node.value = selectedOption ? selectedOption.text : '';
      node.selectedValue = element.value || '';
      node.fontSize = parseInt(style.fontSize) || 14;
      node.fontFamily = (style.fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim();
      node.textColor = extractColor(style.color);
    }

    // 자식 요소 (SELECT는 option 자식을 무시)
    if (nodeType !== 'TEXT' && nodeType !== 'SELECT') {
      const children = [];
      for (const child of element.children) {
        const childNode = traverseDOM(child, rect);
        if (childNode) {
          children.push(childNode);
        }
      }

      // FRAME인데 직접 텍스트 노드가 있으면 → 전체 innerText를 TEXT로 생성
      // (혼합 콘텐츠: 텍스트 + 인라인 요소가 섞인 경우 처리)
      if (hasDirectTextContent(element)) {
        // 자식 요소들 대신 전체 텍스트를 하나의 TEXT로 처리
        children.length = 0; // 기존 자식 비우기
        children.push({
          type: 'TEXT',
          name: 'text',
          x: parseInt(style.paddingLeft) || 0,
          y: parseInt(style.paddingTop) || 0,
          width: rect.width - (parseInt(style.paddingLeft) || 0) - (parseInt(style.paddingRight) || 0),
          height: rect.height - (parseInt(style.paddingTop) || 0) - (parseInt(style.paddingBottom) || 0),
          text: element.innerText.trim(),
          fontSize: parseInt(style.fontSize) || 14,
          fontFamily: (style.fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim(),
          fontWeight: style.fontWeight || '400',
          textColor: extractColor(style.color),
          textAlign: style.textAlign || 'left',
          fills: [],
          strokes: [],
          cornerRadius: 0,
          opacity: 1
        });
      }
      // FRAME인데 자식 요소가 없고 텍스트가 있으면 → 내부에 TEXT 노드 생성
      else if (children.length === 0 && element.innerText && element.innerText.trim()) {
        children.push({
          type: 'TEXT',
          name: 'text',
          x: parseInt(style.paddingLeft) || 0,
          y: parseInt(style.paddingTop) || 0,
          width: rect.width - (parseInt(style.paddingLeft) || 0) - (parseInt(style.paddingRight) || 0),
          height: rect.height - (parseInt(style.paddingTop) || 0) - (parseInt(style.paddingBottom) || 0),
          text: element.innerText.trim(),
          fontSize: parseInt(style.fontSize) || 14,
          fontFamily: (style.fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim(),
          fontWeight: style.fontWeight || '400',
          textColor: extractColor(style.color),
          textAlign: style.textAlign || 'left',
          fills: [],
          strokes: [],
          cornerRadius: 0,
          opacity: 1
        });
      }

      if (children.length > 0) {
        node.children = children;
      }
    }

    return node;
  }

  return traverseDOM(document.body);
}
