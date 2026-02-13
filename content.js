(function () {
  'use strict';

  // ─── Inject page-script.js vào MAIN world ───
  function injectPageScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('page-script.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }
  injectPageScript();

  // ─── Tùy chọn beautify mặc định ───
  const DEFAULT_OPTIONS = {
    indent_size: 2,
    indent_char: ' ',
    max_preserve_newlines: 2,
    preserve_newlines: true,
    end_with_newline: true,
    wrap_line_length: 0,
    indent_inner_html: true,
    indent_handlebars: false,
    extra_liners: [],
    templating: ['none'],
  };

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
    const heading = document.querySelector('h2, h3, [class*="filename"], [class*="file-name"]');
    if (heading) {
      const t = heading.textContent.trim().toLowerCase();
      if (t.includes('.css')) return 'css';
      if (t.includes('.js')) return 'js';
    }
    return 'html';
  }

  // ─── Bảo vệ TẤT CẢ Liquid tags ───
  function protectLiquidTags(code) {
    const placeholders = [];
    let idx = 0;

    function ph(match, prefix) {
      const p = `___LQ${prefix}${idx}___`;
      placeholders.push({ ph: p, val: match });
      idx++;
      return p;
    }

    // Block tags lớn trước (raw, comment, schema, style, javascript, capture)
    code = code.replace(/\{%-?\s*raw\s*-?%\}[\s\S]*?\{%-?\s*endraw\s*-?%\}/g, m => ph(m, 'R'));
    code = code.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, m => ph(m, 'C'));
    code = code.replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/g, m => ph(m, 'S'));
    code = code.replace(/\{%-?\s*style(?:sheet)?\s*-?%\}[\s\S]*?\{%-?\s*endstyle(?:sheet)?\s*-?%\}/g, m => ph(m, 'Y'));
    code = code.replace(/\{%-?\s*javascript\s*-?%\}[\s\S]*?\{%-?\s*endjavascript\s*-?%\}/g, m => ph(m, 'J'));
    code = code.replace(/\{%-?\s*capture\s+\w+\s*-?%\}[\s\S]*?\{%-?\s*endcapture\s*-?%\}/g, m => ph(m, 'P'));

    // ★ Bảo vệ TẤT CẢ {% ... %} và {{ ... }} tags
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

  // ─── Xoá các dòng trống liên tiếp ───
  function removeBlankLines(code) {
    // Giữ tối đa 1 dòng trống giữa các khối
    return code.replace(/\n\s*\n\s*\n/g, '\n\n');
  }

  // ─── Xoá hoàn toàn dòng trống ───
  function removeAllBlankLines(code) {
    return code.split('\n').filter(line => line.trim() !== '').join('\n');
  }

  // ─── Beautify code ───
  function beautifyCode(code, fileType, options) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    let result;
    if (fileType === 'css') {
      result = window.css_beautify(code, opts);
    } else if (fileType === 'js') {
      result = window.js_beautify(code, opts);
    } else {
      // HTML / Liquid: bảo vệ tất cả Liquid tags
      const p = protectLiquidTags(code);
      result = window.html_beautify(p.code, opts);
      result = restoreLiquidTags(result, p.placeholders);
    }

    // Xử lý dòng trống theo cài đặt
    if (opts.remove_blank_lines === 'all') {
      result = removeAllBlankLines(result);
    } else if (opts.remove_blank_lines === 'collapse') {
      result = removeBlankLines(result);
    }
    // 'keep' = giữ nguyên

    return result;
  }

  // ─── Toast thông báo ───
  function showToast(message, type = 'success') {
    const existing = document.querySelector('.hcb-toast');
    if (existing) existing.remove();

    const icons = { success: '✅', error: '❌', info: 'ℹ️', clipboard: '📋' };
    const toast = document.createElement('div');
    toast.className = `hcb-toast ${type === 'clipboard' ? 'info' : type}`;
    toast.innerHTML = `<span class="hcb-toast-icon">${icons[type] || ''}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, type === 'clipboard' ? 4000 : 2500);
  }

  // ─── Lấy user options ───
  function getUserOptions() {
    return new Promise(resolve => {
      chrome.storage.sync.get('beautifyOptions', d => resolve(d.beautifyOptions || {}));
    });
  }

  // ─── Beautify qua Clipboard ───
  async function beautifyFromClipboard() {
    try {
      const clipText = await navigator.clipboard.readText();

      if (!clipText || clipText.trim().length === 0) {
        showToast('Clipboard trống! Hãy Ctrl+A → Ctrl+C trước.', 'error');
        return;
      }

      const fileType = detectFileType();
      const opts = await getUserOptions();
      const beautified = beautifyCode(clipText, fileType, opts);

      await navigator.clipboard.writeText(beautified);

      const typeLabel = { html: 'HTML/Liquid', css: 'CSS', js: 'JavaScript' };
      showToast(
        `Đã làm đẹp ${typeLabel[fileType]}! Nhấn Ctrl+A → Ctrl+V để dán.`,
        'clipboard'
      );
    } catch (err) {
      console.error('[F1GENZ] Lỗi clipboard:', err);
      showToast('Lỗi clipboard: ' + err.message, 'error');
    }
  }

  // ─── Beautify trực tiếp trong editor ───
  function performBeautify() {
    console.log('[F1GENZ] Bắt đầu beautify...');

    let responded = false;

    const getCodeHandler = (e) => {
      responded = true;
      window.removeEventListener('hcb-code-data', getCodeHandler);

      const data = e.detail;

      if (data.error) {
        console.log('[F1GENZ] Editor không tìm thấy, chuyển sang Clipboard...');
        beautifyFromClipboard();
        return;
      }

      if (!data.code || data.code.trim().length === 0) {
        showToast('Editor trống, không có gì để làm đẹp.', 'info');
        return;
      }

      const fileType = detectFileType();
      console.log('[F1GENZ] Loại file:', fileType, '| Editor:', data.editor);

      chrome.storage.sync.get('beautifyOptions', (storageData) => {
        const userOpts = storageData.beautifyOptions || {};
        try {
          const beautified = beautifyCode(data.code, fileType, userOpts);
          window.dispatchEvent(new CustomEvent('hcb-set-code', {
            detail: { code: beautified, editor: data.editor }
          }));
          const typeLabel = { html: 'HTML/Liquid', css: 'CSS', js: 'JavaScript' };
          showToast(`Đã làm đẹp ${typeLabel[fileType] || fileType} thành công! ✨`, 'success');
        } catch (err) {
          console.error('[F1GENZ] Lỗi beautify:', err);
          showToast('Lỗi khi làm đẹp: ' + err.message, 'error');
        }
      });
    };

    window.addEventListener('hcb-code-data', getCodeHandler);
    window.dispatchEvent(new CustomEvent('hcb-get-code'));

    setTimeout(() => {
      if (!responded) {
        window.removeEventListener('hcb-code-data', getCodeHandler);
        console.log('[F1GENZ] Page-script không phản hồi, chuyển sang Clipboard...');
        beautifyFromClipboard();
      }
    }, 500);
  }

  // ─── Phím tắt Ctrl+B ───
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B') && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      performBeautify();
    }
  }, true); // capture phase

  // ─── ★ Auto-beautify khi Copy (dùng sự kiện 'copy') ★ ───
  document.addEventListener('copy', () => {
    // Đợi clipboard cập nhật xong thì beautify
    chrome.storage.sync.get('beautifyOptions', (data) => {
      const opts = data.beautifyOptions || {};
      if (opts.auto_copy_beautify === false) return;

      setTimeout(() => {
        beautifyFromClipboard();
      }, 200);
    });
  }, false);

  // ─── Message từ background (lệnh từ chrome.commands) ───
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'beautify') performBeautify();
  });

  // ─── Nút Beautify trên toolbar ───
  function injectButton() {
    if (document.querySelector('.hcb-beautify-btn')) return;
    const toolbar = document.querySelector(
      '.editor-toolbar, .code-toolbar, [class*="toolbar"], .actions, .btn-group'
    );
    if (toolbar) {
      const btn = document.createElement('button');
      btn.className = 'hcb-beautify-btn';
      btn.title = 'Làm đẹp Code (Ctrl+B)';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 7 4 4 20 4 20 7"></polyline>
          <line x1="9" y1="20" x2="15" y2="20"></line>
          <line x1="12" y1="4" x2="12" y2="20"></line>
        </svg>
        Làm đẹp
      `;
      btn.addEventListener('click', (e) => { e.preventDefault(); performBeautify(); });
      toolbar.appendChild(btn);
    }
  }

  const observer = new MutationObserver(() => injectButton());
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(injectButton, 1500);

  console.log('[F1GENZ Tools] ✅ Extension đã tải. Ctrl+B để làm đẹp code, Ctrl+C để auto-beautify clipboard.');
})();
