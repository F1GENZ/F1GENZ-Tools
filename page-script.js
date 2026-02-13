/**
 * page-script.js — Chạy trong MAIN world
 * Chỉ hỗ trợ CodeMirror (editor Haravan sử dụng)
 */
(function () {
  'use strict';

  // ─── Tìm CodeMirror instance ───
  function getCodeMirror() {
    // CodeMirror 5: element .CodeMirror có property .CodeMirror
    const cmEls = document.querySelectorAll('.CodeMirror');
    for (const el of cmEls) {
      if (el.CodeMirror) {
        console.log('[F1GENZ] ✅ Tìm thấy CodeMirror 5');
        return { type: 'cm5', instance: el.CodeMirror };
      }
    }

    // CodeMirror 6: element .cm-editor có cmView
    const cm6El = document.querySelector('.cm-editor');
    if (cm6El && cm6El.cmView && cm6El.cmView.view) {
      console.log('[F1GENZ] ✅ Tìm thấy CodeMirror 6');
      return { type: 'cm6', instance: cm6El.cmView.view };
    }

    // Fallback: tìm qua global
    if (typeof window.CodeMirror !== 'undefined') {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (ta.nextSibling && ta.nextSibling.CodeMirror) {
          console.log('[F1GENZ] ✅ Tìm thấy CodeMirror qua textarea');
          return { type: 'cm5', instance: ta.nextSibling.CodeMirror };
        }
      }
    }

    // Debug info
    console.log('[F1GENZ] ❌ Không tìm thấy CodeMirror.',
      'querySelector .CodeMirror:', document.querySelectorAll('.CodeMirror').length,
      '| .cm-editor:', document.querySelectorAll('.cm-editor').length,
      '| window.CodeMirror:', typeof window.CodeMirror
    );

    return null;
  }

  // ─── Lấy code ───
  function getCode() {
    const cm = getCodeMirror();
    if (!cm) return null;

    if (cm.type === 'cm5') {
      return { code: cm.instance.getValue(), editor: 'cm5' };
    }
    if (cm.type === 'cm6') {
      return { code: cm.instance.state.doc.toString(), editor: 'cm6' };
    }
    return null;
  }

  // ─── Đặt code ───
  function setCode(newCode, editorType) {
    const cm = getCodeMirror();
    if (!cm) return false;

    if (editorType === 'cm5' && cm.type === 'cm5') {
      const cursor = cm.instance.getCursor();
      const scroll = cm.instance.getScrollInfo();
      cm.instance.setValue(newCode);
      try { cm.instance.setCursor(cursor); } catch (e) {}
      cm.instance.scrollTo(scroll.left, scroll.top);
      cm.instance.focus();
      return true;
    }

    if (editorType === 'cm6' && cm.type === 'cm6') {
      cm.instance.dispatch({
        changes: { from: 0, to: cm.instance.state.doc.length, insert: newCode }
      });
      return true;
    }

    return false;
  }

  // ─── Event listeners ───
  window.addEventListener('hcb-get-code', () => {
    const result = getCode();
    if (result) {
      window.dispatchEvent(new CustomEvent('hcb-code-data', {
        detail: { code: result.code, editor: result.editor }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('hcb-code-data', {
        detail: { error: 'Không tìm thấy CodeMirror editor!' }
      }));
    }
  });

  window.addEventListener('hcb-set-code', (e) => {
    const { code, editor } = e.detail;
    const ok = setCode(code, editor);
    window.dispatchEvent(new CustomEvent('hcb-set-result', {
      detail: { success: ok }
    }));
  });

  console.log('[F1GENZ Tools] 📄 Page script đã tải — sẵn sàng truy cập CodeMirror.');
})();
