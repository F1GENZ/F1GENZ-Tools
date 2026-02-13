/**
 * page-script.js — MAIN world
 * Truy cập trực tiếp CodeMirror + xử lý beautify + phím tắt Ctrl+B
 * Chạy bên trong iframe web.haravan.app
 */
(function () {
  'use strict';

  // ─── Settings mặc định ───
  let settings = {
    indent_size: 2,
    indent_char: ' ',
    preserve_newlines: true,
    end_with_newline: true,
    auto_copy_beautify: true,
    remove_blank_lines: 'collapse',
  };

  // ─── Nhận settings từ content script ───
  window.addEventListener('f1genz-settings', (e) => {
    if (e.detail) {
      settings = Object.assign(settings, e.detail);
      console.log('[F1GENZ] ⚙️ Cập nhật settings:', settings);
    }
  });

  // ─── Tìm CodeMirror ───
  function getCodeMirror() {
    // CodeMirror 5
    const cmEls = document.querySelectorAll('.CodeMirror');
    for (const el of cmEls) {
      if (el.CodeMirror) {
        return { type: 'cm5', instance: el.CodeMirror };
      }
    }

    // CodeMirror 6
    const cm6El = document.querySelector('.cm-editor');
    if (cm6El && cm6El.cmView && cm6El.cmView.view) {
      return { type: 'cm6', instance: cm6El.cmView.view };
    }

    // Tìm qua global
    if (typeof window.CodeMirror !== 'undefined') {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (ta.nextSibling && ta.nextSibling.CodeMirror) {
          return { type: 'cm5', instance: ta.nextSibling.CodeMirror };
        }
      }
    }

    return null;
  }

  // ─── Nhận diện loại file ───
  function detectFileType() {
    const selectors = [
      '.tab-item.active', '.tabs .tab.active',
      '[class*="tab"][class*="active"]',
      '.nav-tabs .active', '.file-tabs .active',
      '.editor-tabs .active a', '.editor-tabs .active',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.trim().toLowerCase();
        if (text.endsWith('.css')) return 'css';
        if (text.endsWith('.js')) return 'js';
        if (text.endsWith('.json')) return 'js';
      }
    }
    return 'html';
  }

  // ─── Bảo vệ Liquid tags ───
  function protectLiquidTags(code) {
    const placeholders = [];
    let idx = 0;

    function ph(match, prefix) {
      const p = `___LQ${prefix}${idx}___`;
      placeholders.push({ ph: p, val: match });
      idx++;
      return p;
    }

    // Block tags lớn
    code = code.replace(/\{%-?\s*raw\s*-?%\}[\s\S]*?\{%-?\s*endraw\s*-?%\}/g, m => ph(m, 'R'));
    code = code.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, m => ph(m, 'C'));
    code = code.replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/g, m => ph(m, 'S'));
    code = code.replace(/\{%-?\s*style(?:sheet)?\s*-?%\}[\s\S]*?\{%-?\s*endstyle(?:sheet)?\s*-?%\}/g, m => ph(m, 'Y'));
    code = code.replace(/\{%-?\s*javascript\s*-?%\}[\s\S]*?\{%-?\s*endjavascript\s*-?%\}/g, m => ph(m, 'J'));
    code = code.replace(/\{%-?\s*capture\s+\w+\s*-?%\}[\s\S]*?\{%-?\s*endcapture\s*-?%\}/g, m => ph(m, 'P'));

    // Tất cả {% %} và {{ }}
    code = code.replace(/\{%-?[\s\S]*?-?%\}/g, m => ph(m, 'T'));
    code = code.replace(/\{\{-?[\s\S]*?-?\}\}/g, m => ph(m, 'O'));

    return { code, placeholders };
  }

  function restoreLiquidTags(code, placeholders) {
    for (let i = placeholders.length - 1; i >= 0; i--) {
      code = code.split(placeholders[i].ph).join(placeholders[i].val);
    }
    return code;
  }

  // ─── Xoá dòng trống ───
  function removeBlankLines(code, mode) {
    if (mode === 'all') {
      return code.split('\n').filter(line => line.trim() !== '').join('\n');
    } else if (mode === 'collapse') {
      return code.replace(/\n\s*\n\s*\n/g, '\n\n');
    }
    return code;
  }

  // ─── Beautify code ───
  function beautifyCode(code, fileType) {
    const opts = {
      indent_size: settings.indent_size || 2,
      indent_char: settings.indent_char || ' ',
      max_preserve_newlines: 2,
      preserve_newlines: settings.preserve_newlines !== false,
      end_with_newline: settings.end_with_newline !== false,
      wrap_line_length: 0,
      indent_inner_html: true,
      indent_handlebars: false,
      extra_liners: [],
      templating: ['none'],
    };

    let result;
    if (fileType === 'css') {
      result = window.css_beautify(code, opts);
    } else if (fileType === 'js') {
      result = window.js_beautify(code, opts);
    } else {
      const p = protectLiquidTags(code);
      result = window.html_beautify(p.code, opts);
      result = restoreLiquidTags(result, p.placeholders);
    }

    result = removeBlankLines(result, settings.remove_blank_lines || 'collapse');
    return result;
  }

  // ─── Gửi toast cho content script hiển thị ───
  function showToast(message, type) {
    window.dispatchEvent(new CustomEvent('f1genz-toast', {
      detail: { message, type }
    }));
  }

  // ─── Lấy code từ CodeMirror ───
  function getCode(cm) {
    if (cm.type === 'cm5') return cm.instance.getValue();
    if (cm.type === 'cm6') return cm.instance.state.doc.toString();
    return '';
  }

  // ─── Đặt code vào CodeMirror ───
  function setCode(cm, newCode) {
    if (cm.type === 'cm5') {
      const cursor = cm.instance.getCursor();
      const scroll = cm.instance.getScrollInfo();
      cm.instance.setValue(newCode);
      try { cm.instance.setCursor(cursor); } catch (e) {}
      cm.instance.scrollTo(scroll.left, scroll.top);
      cm.instance.focus();
      return true;
    }
    if (cm.type === 'cm6') {
      cm.instance.dispatch({
        changes: { from: 0, to: cm.instance.state.doc.length, insert: newCode }
      });
      return true;
    }
    return false;
  }

  // ─── Beautify trực tiếp trong editor ───
  function performBeautify() {
    const cm = getCodeMirror();

    if (!cm) {
      console.log('[F1GENZ] ❌ Không tìm thấy CodeMirror!');
      showToast('Không tìm thấy CodeMirror editor!', 'error');
      // Fallback clipboard
      beautifyClipboard();
      return;
    }

    const code = getCode(cm);
    if (!code || code.trim().length === 0) {
      showToast('Editor trống!', 'info');
      return;
    }

    const fileType = detectFileType();
    console.log('[F1GENZ] 🎨 Beautify', fileType, '| Editor:', cm.type);

    try {
      const beautified = beautifyCode(code, fileType);
      setCode(cm, beautified);
      const typeLabel = { html: 'HTML/Liquid', css: 'CSS', js: 'JavaScript' };
      showToast(`Đã làm đẹp ${typeLabel[fileType]} thành công! ✨`, 'success');
    } catch (err) {
      console.error('[F1GENZ] Lỗi:', err);
      showToast('Lỗi beautify: ' + err.message, 'error');
    }
  }

  // ─── Fallback: beautify clipboard ───
  async function beautifyClipboard() {
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText || clipText.trim().length === 0) {
        showToast('Clipboard trống!', 'error');
        return;
      }
      const fileType = detectFileType();
      const beautified = beautifyCode(clipText, fileType);
      await navigator.clipboard.writeText(beautified);
      showToast('Đã làm đẹp clipboard! Ctrl+A → Ctrl+V để dán.', 'clipboard');
    } catch (err) {
      console.error('[F1GENZ] Clipboard error:', err);
      showToast('Lỗi clipboard: ' + err.message, 'error');
    }
  }

  // ─── ★ Phím tắt Ctrl+B (capture phase — trước CodeMirror) ★ ───
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B') && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[F1GENZ] ⌨️ Ctrl+B pressed!');
      performBeautify();
    }
  }, true); // ← capture phase, bắt TRƯỚC CodeMirror

  // ─── ★ Auto-beautify khi Copy ★ ───
  document.addEventListener('copy', () => {
    if (!settings.auto_copy_beautify) return;

    const cm = getCodeMirror();
    if (!cm) return;

    // Đợi clipboard cập nhật xong
    setTimeout(async () => {
      try {
        // Lấy text đã copy từ CodeMirror selection
        let selectedText = '';
        if (cm.type === 'cm5') {
          selectedText = cm.instance.getSelection();
        } else if (cm.type === 'cm6') {
          const state = cm.instance.state;
          selectedText = state.sliceDoc(
            state.selection.main.from,
            state.selection.main.to
          );
        }

        // Nếu không có selection (Ctrl+A chọn hết), lấy toàn bộ code
        if (!selectedText || selectedText.trim().length === 0) {
          selectedText = getCode(cm);
        }

        if (!selectedText || selectedText.trim().length === 0) return;

        const fileType = detectFileType();
        const beautified = beautifyCode(selectedText, fileType);

        await navigator.clipboard.writeText(beautified);
        const typeLabel = { html: 'HTML/Liquid', css: 'CSS', js: 'JavaScript' };
        showToast(`Đã beautify ${typeLabel[fileType]} trong clipboard! Ctrl+V để dán.`, 'clipboard');
      } catch (err) {
        console.error('[F1GENZ] Auto-copy beautify error:', err);
      }
    }, 150);
  }, true);

  // ─── Lắng nghe lệnh beautify từ content script ───
  window.addEventListener('f1genz-beautify', () => {
    performBeautify();
  });

  // ─── Chờ beautify libs load xong ───
  function waitForLibs(callback, retries) {
    if (typeof window.html_beautify === 'function') {
      console.log('[F1GENZ] ✅ Beautify libs đã sẵn sàng');
      callback();
      return;
    }
    if (retries <= 0) {
      console.error('[F1GENZ] ❌ Beautify libs không load được!');
      return;
    }
    setTimeout(() => waitForLibs(callback, retries - 1), 100);
  }

  waitForLibs(() => {
    console.log('[F1GENZ Tools] ✅ Page script đã tải — Ctrl+B để beautify, Ctrl+C để auto-beautify.');
  }, 50);
})();
