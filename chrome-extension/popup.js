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
    if (tagName === 'svg') return 'SVG';
    if (tagName === 'input') {
      // file input은 별도 타입으로 처리 (Shadow DOM 버튼 때문)
      if (element.type === 'file') return 'FILE_INPUT';
      return 'INPUT';
    }
    if (tagName === 'textarea') return 'INPUT';
    if (tagName === 'select') return 'SELECT';

    // div는 항상 FRAME으로 유지 (레이아웃 구조 보존)
    if (tagName === 'div') return 'FRAME';

    // 텍스트 태그들 (div 제외, td/th는 FRAME으로 처리하여 padding 적용)
    const textTags = ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'a', 'button', 'li', 'strong', 'em', 'b', 'i'];

    // 내부에 SVG가 있는지 확인 (버튼/링크 + 아이콘 조합)
    const hasSvgChild = element.querySelector('svg') !== null;

    // 텍스트 태그이고 자식이 없거나 직접 텍스트가 있는 경우 → TEXT
    // 단, SVG 자식이 있으면 FRAME으로 처리하여 SVG도 추출
    if (textTags.includes(tagName) && !hasSvgChild) {
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

  // textAlign 정규화 (start→left, end→right)
  function normalizeTextAlign(align) {
    if (align === 'start') return 'left';
    if (align === 'end') return 'right';
    return align || 'left';
  }

  // SVG 요소에 computed style 인라인 적용
  function extractSvgWithStyles(svgElement) {
    // SVG 복제
    const clone = svgElement.cloneNode(true);

    // 부모의 color (currentColor 용)
    const parentStyle = window.getComputedStyle(svgElement.parentElement || svgElement);
    const currentColor = parentStyle.color || 'rgb(0, 0, 0)';

    // SVG 자체와 모든 자식 요소에 스타일 적용
    const allElements = [clone, ...clone.querySelectorAll('*')];

    allElements.forEach((el, index) => {
      // 원본 요소 찾기
      let originalEl;
      if (index === 0) {
        originalEl = svgElement;
      } else {
        const selector = el.tagName.toLowerCase();
        const originals = svgElement.querySelectorAll(selector);
        originalEl = originals[Array.from(clone.querySelectorAll(selector)).indexOf(el)];
      }

      if (!originalEl) return;

      const computed = window.getComputedStyle(originalEl);

      // fill 처리
      const fill = computed.fill;
      if (fill && fill !== 'none') {
        if (fill === 'currentColor' || fill.includes('currentcolor')) {
          el.setAttribute('fill', currentColor);
        } else if (fill.startsWith('rgb')) {
          el.setAttribute('fill', fill);
        }
      } else if (fill === 'none') {
        el.setAttribute('fill', 'none');
      }

      // stroke 처리
      const stroke = computed.stroke;
      if (stroke && stroke !== 'none') {
        if (stroke === 'currentColor' || stroke.includes('currentcolor')) {
          el.setAttribute('stroke', currentColor);
        } else if (stroke.startsWith('rgb')) {
          el.setAttribute('stroke', stroke);
        }
      }

      // stroke-width 처리
      const strokeWidth = computed.strokeWidth;
      if (strokeWidth && strokeWidth !== '0px') {
        el.setAttribute('stroke-width', strokeWidth);
      }

      // opacity 처리
      const fillOpacity = computed.fillOpacity;
      if (fillOpacity && fillOpacity !== '1') {
        el.setAttribute('fill-opacity', fillOpacity);
      }

      const strokeOpacity = computed.strokeOpacity;
      if (strokeOpacity && strokeOpacity !== '1') {
        el.setAttribute('stroke-opacity', strokeOpacity);
      }
    });

    return clone.outerHTML;
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
      node.textAlign = normalizeTextAlign(style.textAlign);
    }

    // SVG 노드 - 전체 SVG 문자열 추출 (색상 인라인 적용)
    if (nodeType === 'SVG') {
      node.svgString = extractSvgWithStyles(element);
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

    // FILE_INPUT 요소 - 파일 선택 버튼 UI 정보 추출
    if (nodeType === 'FILE_INPUT') {
      // 선택된 파일명 (있으면)
      node.fileName = element.files && element.files.length > 0 ? element.files[0].name : '';
      node.buttonText = '파일 선택';
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

      // FRAME인데 직접 텍스트 노드가 있으면 → TEXT 노드 추가
      // (혼합 콘텐츠: 텍스트 + 인라인 요소가 섞인 경우 처리)
      // 단, SVG 자식이 있으면 SVG는 유지하고 텍스트만 추가
      if (hasDirectTextContent(element)) {
        const hasSvgInChildren = children.some(c => c.type === 'SVG');

        if (hasSvgInChildren) {
          // SVG가 있으면 SVG 유지하고 텍스트 노드는 Range API로 실제 위치 추출
          for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
              const range = document.createRange();
              range.selectNodeContents(node);
              const textRect = range.getBoundingClientRect();

              children.push({
                type: 'TEXT',
                name: 'text',
                x: Math.round(textRect.left - rect.left),
                y: Math.round(textRect.top - rect.top),
                width: Math.round(textRect.width),
                height: Math.round(textRect.height),
                text: node.textContent.trim(),
                fontSize: parseInt(style.fontSize) || 14,
                fontFamily: (style.fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim(),
                fontWeight: style.fontWeight || '400',
                textColor: extractColor(style.color),
                textAlign: normalizeTextAlign(style.textAlign),
                fills: [],
                strokes: [],
                cornerRadius: 0,
                opacity: 1
              });
            }
          }
        } else {
          // SVG가 없으면 기존 로직: 자식 비우고 텍스트만
          children.length = 0;
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
            textAlign: normalizeTextAlign(style.textAlign),
            fills: [],
            strokes: [],
            cornerRadius: 0,
            opacity: 1
          });
        }
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
          textAlign: normalizeTextAlign(style.textAlign),
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
