/* QRnShort 공통 기능. API 문서: https://is.gd/apishorteningreference.php */
(function (root) {
  'use strict';
  function normalizeUrl(value) {
    let text = String(value || '').trim();
    if (!text) throw new Error('웹사이트 주소를 입력해 주세요.');
    if (!/^[a-z][a-z\d+.-]*:/i.test(text)) text = 'https://' + text;
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      throw new Error('HTTP 또는 HTTPS 웹사이트 주소만 사용할 수 있습니다.');
    }
    return url.href;
  }
  function read(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch (_) { return fallback; }
  }
  function validItem(item) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' ||
        !['qr', 'short'].includes(item.type) || typeof item.content !== 'string' ||
        typeof item.title !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) ||
        (item.clicks !== undefined && (!Number.isFinite(item.clicks) || item.clicks < 0))) return false;
    if (item.type === 'short') {
      try {
        normalizeUrl(item.content);
        if (item.shortUrl !== undefined) normalizeUrl(item.shortUrl);
      } catch (_) { return false; }
    }
    return true;
  }
  function getHistory() {
    const list = read('qrnshort_history', []);
    return Array.isArray(list) ? list.filter(item => validItem(item) && !['seed-1', 'seed-2'].includes(item.id)) : [];
  }
  function saveHistory(list) {
    if (!Array.isArray(list) || !list.every(validItem)) throw new Error('저장할 기록의 형식이 올바르지 않습니다.');
    localStorage.setItem('qrnshort_history', JSON.stringify(list));
  }
  function validateBackup(data) {
    if (!data || !['2.0', '2.1'].includes(data.version) || !Array.isArray(data.history) ||
        !data.history.every(validItem)) throw new Error('백업 파일 형식이 올바르지 않습니다. 기존 기록은 유지됩니다.');
    return data.history.filter(item => !['seed-1', 'seed-2'].includes(item.id));
  }
  function initTheme() {
    let theme;
    try { theme = localStorage.getItem('qrnshort_theme'); } catch (_) {}
    if (!['light', 'dark'].includes(theme)) theme = root.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('qrnshort_theme', theme); } catch (_) {}
    });
  }
  async function copyText(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; } } catch (_) {}
    const input = document.createElement('textarea');
    input.value = text; input.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(input); input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } finally { input.remove(); }
    if (!copied) throw new Error('자동 복사가 차단되었습니다. 결과 상자를 선택하여 직접 복사해 주세요.');
  }
  async function daShorten(original) {
    const endpoint = new URL('https://da.gd/s'); endpoint.searchParams.set('url', original);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint.href, {signal: controller.signal, credentials:'omit'});
      if (!response.ok) throw new Error('단축 서비스 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      const result = normalizeUrl((await response.text()).trim());
      if (new URL(result).hostname !== 'da.gd') throw new Error('단축 서비스 응답이 올바르지 않습니다.');
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('단축 서비스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function shorten(value, alias = '') {
    const original = normalizeUrl(value);
    if (alias && !/^[A-Za-z0-9_]{5,30}$/.test(alias)) return Promise.reject(new Error('맞춤 코드는 영문·숫자·밑줄 5~30자로 입력해 주세요.'));
    if (!alias) return daShorten(original);
    return new Promise((resolve, reject) => {
      const callback = 'qrnshort_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const endpoint = new URL('https://is.gd/create.php');
      endpoint.searchParams.set('format', 'json'); endpoint.searchParams.set('callback', callback);
      endpoint.searchParams.set('url', original); if (alias) endpoint.searchParams.set('shorturl', alias);
      let complete = false;
      const finish = (error, value) => {
        if (complete) return; complete = true; clearTimeout(timer); script.remove();
        root[callback] = () => {}; setTimeout(() => { delete root[callback]; }, 60000);
        if (error) reject(error); else resolve(value);
      };
      const timer = setTimeout(() => finish(new Error('단축 서비스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.')), 12000);
      root[callback] = data => {
        if (data?.errorcode) return finish(new Error(String(data.errormessage || '단축 서비스 요청에 실패했습니다.')));
        try {
          const result = normalizeUrl(data?.shorturl);
          if (new URL(result).hostname !== 'is.gd') throw new Error('예상하지 못한 단축 서비스 응답입니다.');
          finish(null, result);
        } catch (error) { finish(error); }
      };
      script.onerror = () => finish(new Error('단축 서비스에 연결할 수 없습니다. 인터넷 연결 또는 서비스 상태를 확인해 주세요.'));
      script.src = endpoint.href; document.head.append(script);
    });
  }
  root.QrnCore = {normalizeUrl, getHistory, saveHistory, validateBackup, initTheme, copyText, shorten};
})(window);
