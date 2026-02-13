document.addEventListener('DOMContentLoaded', () => {
  const indentSizeBtns = document.querySelectorAll('#indentSize .radio-btn');
  const indentCharBtns = document.querySelectorAll('#indentChar .radio-btn');
  const blankLineBtns = document.querySelectorAll('#removeBlankLines .radio-btn');
  const preserveNewlines = document.getElementById('preserveNewlines');
  const endWithNewline = document.getElementById('endWithNewline');
  const autoCopyBeautify = document.getElementById('autoCopyBeautify');
  const saveBtn = document.getElementById('saveBtn');
  const versionLabel = document.getElementById('versionLabel');
  const updateBanner = document.getElementById('updateBanner');
  const updateVersion = document.getElementById('updateVersion');
  const updateChangelog = document.getElementById('updateChangelog');
  const updateLink = document.getElementById('updateLink');

  // ─── Hiện version ───
  const manifest = chrome.runtime.getManifest();
  versionLabel.textContent = `v${manifest.version}`;

  // ─── Kiểm tra cập nhật ───
  chrome.storage.local.get('updateAvailable', (data) => {
    if (data.updateAvailable) {
      const u = data.updateAvailable;
      updateBanner.hidden = false;
      updateVersion.textContent = `v${u.version}`;
      updateChangelog.textContent = u.changelog || '';
      if (u.downloadUrl) {
        updateLink.href = u.downloadUrl;
      } else {
        updateLink.style.display = 'none';
      }
    }
  });

  // ─── Tải cài đặt ───
  chrome.storage.sync.get('beautifyOptions', (data) => {
    const opts = data.beautifyOptions || {};

    if (opts.indent_size) {
      indentSizeBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.value === String(opts.indent_size));
      });
    }

    if (opts.indent_char) {
      const charVal = opts.indent_char === '\t' ? 'tab' : 'space';
      indentCharBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.value === charVal);
      });
    }

    if (opts.remove_blank_lines) {
      blankLineBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.value === opts.remove_blank_lines);
      });
    }

    if (typeof opts.preserve_newlines === 'boolean') {
      preserveNewlines.checked = opts.preserve_newlines;
    }
    if (typeof opts.end_with_newline === 'boolean') {
      endWithNewline.checked = opts.end_with_newline;
    }
    if (typeof opts.auto_copy_beautify === 'boolean') {
      autoCopyBeautify.checked = opts.auto_copy_beautify;
    }
  });

  // ─── Radio buttons ───
  function setupRadioGroup(buttons) {
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  setupRadioGroup(indentSizeBtns);
  setupRadioGroup(indentCharBtns);
  setupRadioGroup(blankLineBtns);

  // ─── Lưu cài đặt ───
  saveBtn.addEventListener('click', () => {
    const activeSize = document.querySelector('#indentSize .radio-btn.active');
    const activeChar = document.querySelector('#indentChar .radio-btn.active');
    const activeBlank = document.querySelector('#removeBlankLines .radio-btn.active');

    const options = {
      indent_size: parseInt(activeSize.dataset.value, 10),
      indent_char: activeChar.dataset.value === 'tab' ? '\t' : ' ',
      indent_with_tabs: activeChar.dataset.value === 'tab',
      preserve_newlines: preserveNewlines.checked,
      end_with_newline: endWithNewline.checked,
      auto_copy_beautify: autoCopyBeautify.checked,
      remove_blank_lines: activeBlank.dataset.value,
    };

    chrome.storage.sync.set({ beautifyOptions: options }, () => {
      saveBtn.textContent = '✅ Đã Lưu!';
      saveBtn.classList.add('saved');
      setTimeout(() => {
        saveBtn.innerHTML = '<span>💾</span> Lưu Cài Đặt';
        saveBtn.classList.remove('saved');
      }, 1500);
    });
  });
});
