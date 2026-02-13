(function () {
  'use strict';

  // ─── Inject scripts vào MAIN world (để truy cập CodeMirror) ───
  function injectScript(url) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(url);
      script.onload = () => { script.remove(); resolve(); };
      script.onerror = () => { script.remove(); resolve(); };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  async function injectAllScripts() {
    // Inject beautify libs trước, rồi page-script
    await injectScript('lib/beautify.js');
    await injectScript('lib/beautify-css.js');
    await injectScript('lib/beautify-html.js');
    await injectScript('page-script.js');
    console.log('[F1GENZ] ✅ Đã inject tất cả scripts vào MAIN world.');

    // Gửi settings cho page-script
    sendSettings();
  }

  injectAllScripts();

  // ─── Gửi settings từ chrome.storage → page-script ───
  function sendSettings() {
    chrome.storage.sync.get('beautifyOptions', (data) => {
      const opts = data.beautifyOptions || {};
      window.dispatchEvent(new CustomEvent('f1genz-settings', {
        detail: opts
      }));
    });
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

  // ─── Nhận toast requests từ page-script ───
  window.addEventListener('f1genz-toast', (e) => {
    if (e.detail) {
      showToast(e.detail.message, e.detail.type);
    }
  });

  // ─── Message từ background (chrome.commands Ctrl+B) ───
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'beautify') {
      window.dispatchEvent(new CustomEvent('f1genz-beautify'));
    }
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px">
          <polyline points="4 7 4 4 20 4 20 7"></polyline>
          <line x1="9" y1="20" x2="15" y2="20"></line>
          <line x1="12" y1="4" x2="12" y2="20"></line>
        </svg>
        Làm đẹp
      `;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('f1genz-beautify'));
      });
      toolbar.appendChild(btn);
    }
  }

  const observer = new MutationObserver(() => injectButton());
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(injectButton, 2000);

  console.log('[F1GENZ Tools] ✅ Content script đã tải trong frame:', window.location.hostname);
})();
