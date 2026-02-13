// F1GENZ Tools — Background Service Worker

// ─── GitHub Update Config ───
const GITHUB_REPO = 'F1GENZ/F1GENZ-Tools';
const VERSION_URL_TEMPLATE = 'https://raw.githubusercontent.com/{REPO}/main/version.json';

// ─── Xử lý phím tắt ───
chrome.commands.onCommand.addListener((command) => {
  if (command === 'beautify-code') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'beautify' });
      }
    });
  }
});

// ─── Kiểm tra cập nhật từ GitHub ───
async function checkForUpdates() {
  if (!GITHUB_REPO) {
    console.log('[F1GENZ] Chưa cấu hình GITHUB_REPO, bỏ qua kiểm tra cập nhật.');
    return;
  }

  const url = VERSION_URL_TEMPLATE.replace('{REPO}', GITHUB_REPO);

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const currentVersion = chrome.runtime.getManifest().version;

    if (data.version && data.version !== currentVersion) {
      const downloadUrl = data.downloadUrl ||
        `https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip`;

      chrome.storage.local.set({
        updateAvailable: {
          version: data.version,
          changelog: data.changelog || '',
          downloadUrl: downloadUrl,
          checkedAt: Date.now(),
        }
      });
      // Hiện badge ↑ trên icon
      chrome.action.setBadgeText({ text: '↑' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      console.log(`[F1GENZ] 🆕 Có bản mới: v${data.version} (hiện tại: v${currentVersion})`);
    } else {
      chrome.storage.local.remove('updateAvailable');
      chrome.action.setBadgeText({ text: '' });
      console.log(`[F1GENZ] ✅ Đang dùng phiên bản mới nhất: v${currentVersion}`);
    }
  } catch (err) {
    console.log('[F1GENZ] Không thể kiểm tra cập nhật:', err.message);
  }
}

// Kiểm tra mỗi khi extension được load/reload
chrome.runtime.onInstalled.addListener(() => {
  console.log('[F1GENZ] Extension đã cài đặt/cập nhật. Kiểm tra phiên bản...');
  checkForUpdates();
});

// Kiểm tra khi service worker khởi động
checkForUpdates();
