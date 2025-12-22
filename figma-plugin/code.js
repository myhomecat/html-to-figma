// Figma Plugin - DOM Import

figma.showUI(__html__, { width: 400, height: 360 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'import') {
    try {
      const data = JSON.parse(msg.data);

      // 기본 폰트 로드
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

      // 루트 프레임 생성
      const rootFrame = figma.createFrame();
      rootFrame.name = 'Imported Design';
      rootFrame.resize(data.width || 800, data.height || 600);
      rootFrame.x = figma.viewport.center.x - (data.width || 800) / 2;
      rootFrame.y = figma.viewport.center.y - (data.height || 600) / 2;

      // 루트 배경색
      if (data.fills && data.fills.length > 0) {
        rootFrame.fills = convertFills(data.fills);
      } else {
        rootFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
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
    } catch (err) {
      figma.ui.postMessage({ type: 'error', message: err.message });
    }
  }
};

// 노드 생성 함수
async function createNode(data, parent) {
  let node;
  let count = 1;

  switch (data.type) {
    case 'TEXT':
      node = await createTextNode(data);
      break;
    case 'IMAGE':
      node = createImagePlaceholder(data);
      break;
    case 'INPUT':
      node = await createInputNode(data);
      break;
    case 'SELECT':
      node = await createSelectNode(data);
      break;
    case 'BUTTON':
      node = await createButtonNode(data);
      break;
    default:
      node = createFrameNode(data);
  }

  // 위치 설정
  node.x = data.x || 0;
  node.y = data.y || 0;

  // 투명도
  if (data.opacity !== undefined && data.opacity < 1) {
    node.opacity = data.opacity;
  }

  // 부모에 추가
  parent.appendChild(node);

  // 자식 노드 재귀 생성
  if (data.children && data.children.length > 0 && 'appendChild' in node) {
    for (const child of data.children) {
      count += await createNode(child, node);
    }
  }

  return count;
}

// 프레임 노드 생성
function createFrameNode(data) {
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

  return frame;
}

// 텍스트 노드 생성
async function createTextNode(data) {
  // 배경색이나 테두리가 있으면 Frame + Text 조합
  var hasFills = data.fills && data.fills.length > 0;
  var hasStrokes = data.strokes && data.strokes.length > 0;
  var hasCornerRadius = data.cornerRadius && data.cornerRadius > 0;

  if (hasFills || hasStrokes || hasCornerRadius) {
    // 컨테이너 프레임 생성
    var frame = figma.createFrame();
    frame.name = (data.text && data.text.substring(0, 20)) || 'TextBox';
    frame.resize(
      Math.max(data.width || 100, 1),
      Math.max(data.height || 30, 1)
    );

    // 배경색
    if (hasFills) {
      frame.fills = convertFills(data.fills);
    } else {
      frame.fills = [];
    }

    // 테두리
    if (hasStrokes) {
      frame.strokes = convertFills(data.strokes);
      frame.strokeWeight = data.strokes[0].width || 1;
    }

    // 모서리 둥글기
    if (hasCornerRadius) {
      frame.cornerRadius = data.cornerRadius;
    }

    // 내부 텍스트 생성
    var innerText = await createPureTextNode(data);
    frame.appendChild(innerText);

    // 텍스트 중앙 정렬
    innerText.x = (frame.width - innerText.width) / 2;
    innerText.y = (frame.height - innerText.height) / 2;

    return frame;
  }

  // 순수 텍스트만
  return await createPureTextNode(data);
}

// 순수 텍스트 노드 생성 (배경 없음)
async function createPureTextNode(data) {
  var text = figma.createText();
  text.name = (data.text && data.text.substring(0, 20)) || 'Text';

  // 폰트 스타일 결정
  var fontStyle = getFontStyle(data.fontWeight);

  // 폰트 로드 시도
  try {
    var fontFamily = data.fontFamily || 'Inter';
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    text.fontName = { family: fontFamily, style: fontStyle };
  } catch (e) {
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

  // 텍스트 정렬
  if (data.textAlign) {
    var alignMap = {
      'left': 'LEFT',
      'center': 'CENTER',
      'right': 'RIGHT',
      'justify': 'JUSTIFIED',
      'start': 'LEFT',
      'end': 'RIGHT'
    };
    text.textAlignHorizontal = alignMap[data.textAlign] || 'LEFT';
  }

  return text;
}

// 이미지 플레이스홀더
function createImagePlaceholder(data) {
  const rect = figma.createRectangle();
  rect.name = 'Image Placeholder';
  rect.resize(data.width || 100, data.height || 100);
  rect.fills = [{
    type: 'SOLID',
    color: { r: 0.9, g: 0.9, b: 0.9 }
  }];
  rect.cornerRadius = data.cornerRadius || 0;
  return rect;
}

// Input 노드
async function createInputNode(data) {
  const frame = figma.createFrame();
  frame.name = data.name || 'Input';
  frame.resize(data.width || 200, data.height || 40);

  // 배경색
  if (data.fills && data.fills.length > 0) {
    frame.fills = convertFills(data.fills);
  } else {
    frame.fills = [{
      type: 'SOLID',
      color: { r: 1, g: 1, b: 1 }
    }];
  }

  // 테두리
  if (data.strokes && data.strokes.length > 0) {
    frame.strokes = convertFills(data.strokes);
    frame.strokeWeight = data.strokes[0].width || 1;
  } else {
    frame.strokes = [{
      type: 'SOLID',
      color: { r: 0.8, g: 0.8, b: 0.8 }
    }];
    frame.strokeWeight = 1;
  }

  frame.cornerRadius = data.cornerRadius || 4;

  // value가 있으면 value 표시, 없으면 placeholder 표시
  const displayText = data.value || data.placeholder || '';
  const isPlaceholder = !data.value && data.placeholder;

  if (displayText) {
    const text = figma.createText();
    text.name = isPlaceholder ? 'placeholder' : 'value';

    const fontFamily = data.fontFamily || 'Inter';
    try {
      await figma.loadFontAsync({ family: fontFamily, style: 'Regular' });
      text.fontName = { family: fontFamily, style: 'Regular' };
    } catch (e) {
      text.fontName = { family: 'Inter', style: 'Regular' };
    }

    text.characters = displayText;
    text.fontSize = data.fontSize || 14;

    // placeholder는 회색, value는 텍스트 색상
    if (isPlaceholder) {
      text.fills = [{
        type: 'SOLID',
        color: { r: 0.6, g: 0.6, b: 0.6 }
      }];
    } else if (data.textColor) {
      text.fills = [{
        type: 'SOLID',
        color: data.textColor
      }];
    } else {
      text.fills = [{
        type: 'SOLID',
        color: { r: 0.2, g: 0.2, b: 0.2 }
      }];
    }

    frame.appendChild(text);
    text.x = 12;
    text.y = (frame.height - text.height) / 2;
  }

  return frame;
}

// Select 노드
async function createSelectNode(data) {
  const frame = figma.createFrame();
  frame.name = data.name || 'Select';
  frame.resize(data.width || 200, data.height || 40);

  // 배경색
  if (data.fills && data.fills.length > 0) {
    frame.fills = convertFills(data.fills);
  } else {
    frame.fills = [{
      type: 'SOLID',
      color: { r: 1, g: 1, b: 1 }
    }];
  }

  // 테두리
  if (data.strokes && data.strokes.length > 0) {
    frame.strokes = convertFills(data.strokes);
    frame.strokeWeight = data.strokes[0].width || 1;
  } else {
    frame.strokes = [{
      type: 'SOLID',
      color: { r: 0.8, g: 0.8, b: 0.8 }
    }];
    frame.strokeWeight = 1;
  }

  frame.cornerRadius = data.cornerRadius || 4;

  // 선택된 값 표시
  const displayText = data.value || '';

  if (displayText) {
    const text = figma.createText();
    text.name = 'selected-value';

    const fontFamily = data.fontFamily || 'Inter';
    try {
      await figma.loadFontAsync({ family: fontFamily, style: 'Regular' });
      text.fontName = { family: fontFamily, style: 'Regular' };
    } catch (e) {
      text.fontName = { family: 'Inter', style: 'Regular' };
    }

    text.characters = displayText;
    text.fontSize = data.fontSize || 14;

    if (data.textColor) {
      text.fills = [{
        type: 'SOLID',
        color: data.textColor
      }];
    } else {
      text.fills = [{
        type: 'SOLID',
        color: { r: 0.2, g: 0.2, b: 0.2 }
      }];
    }

    frame.appendChild(text);
    text.x = 12;
    text.y = (frame.height - text.height) / 2;
  }

  return frame;
}

// Button 노드
async function createButtonNode(data) {
  const frame = figma.createFrame();
  frame.name = 'Button';
  frame.resize(data.width || 100, data.height || 40);

  if (data.fills && data.fills.length > 0) {
    frame.fills = convertFills(data.fills);
  } else {
    frame.fills = [{
      type: 'SOLID',
      color: { r: 0.23, g: 0.51, b: 0.96 }
    }];
  }

  frame.cornerRadius = data.cornerRadius || 6;

  return frame;
}

// 색상 변환
function convertFills(fills) {
  return fills.map(function(fill) {
    var color = fill.color || {};
    return {
      type: 'SOLID',
      color: {
        r: color.r !== undefined ? color.r : 0,
        g: color.g !== undefined ? color.g : 0,
        b: color.b !== undefined ? color.b : 0
      }
    };
  });
}

// 폰트 스타일 매핑
function getFontStyle(weight) {
  const w = typeof weight === 'string' ? parseInt(weight) : weight;
  if (w >= 700) return 'Bold';
  if (w >= 500) return 'Medium';
  return 'Regular';
}
