/* 교안 기반 QR 생성·OpenAPI 단축·스캔·로컬 보관함 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const Core = window.QrnCore;
  const $ = id => document.getElementById(id);
  const on = (id, event, fn) => $(id)?.addEventListener(event, fn);
  Core.initTheme();
  function toast(message, type = 'info') {
    const box = document.createElement('div');
    box.className = `toast toast-${type}`; box.setAttribute('role','status');
    box.textContent = message; $('toast-container')?.append(box);
    setTimeout(() => box.remove(), 5000);
  }
  const showError = error => toast(error.message || '처리하지 못했습니다.', 'error');
  const uid = () => window.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2);
  function store(item) {
    try { Core.saveHistory([item, ...Core.getHistory()]); renderHistory(); return true; }
    catch (_) { toast('결과는 생성되었으나 이 브라우저에 기록을 저장하지 못했습니다.', 'error'); return false; }
  }
  let activeType = 'url', currentPayload = '', currentLogo = null, renderVersion = 0;
  let currentCanvas = null, generationTimer = null;
  const isQrPage = !!$('qrcode-container');
  function setType(type) {
    activeType = type;
    document.querySelectorAll('#qr-type-chips .chip').forEach(button => {
      button.classList.toggle('active',button.dataset.type === type);
      button.setAttribute('aria-pressed',String(button.dataset.type === type));
    });
    document.querySelectorAll('#qr-input-fields .field-group').forEach(field => field.classList.toggle('hidden',field.id !== 'group-' + type));
  }
  const escapeWifi = text => String(text).replace(/([\\;,:"])/g,'\\$1');
  const escapeCard = text => String(text).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/([;,])/g,'\\$1');
  function payload() {
    if (activeType === 'url') return Core.normalizeUrl($('qr-input-url').value);
    if (activeType === 'text') {
      const text = $('qr-input-text').value;
      if (!text.trim()) throw new Error('QR에 담을 텍스트를 입력해 주세요.');
      return text;
    }
    if (activeType === 'wifi') {
      const ssid = $('wifi-ssid').value, password = $('wifi-pass').value;
      const auth = $('wifi-auth').value;
      if (!ssid) throw new Error('네트워크 이름을 입력해 주세요.');
      if (auth !== 'nopass' && !password) throw new Error('Wi-Fi 비밀번호를 입력해 주세요.');
      return `WIFI:T:${auth};S:${escapeWifi(ssid)};P:${auth === 'nopass' ? '' : escapeWifi(password)};H:${$('wifi-hidden').checked};;`;
    }
    if (activeType === 'vcard') {
      const name = $('vcard-name').value.trim();
      if (!name) throw new Error('명함에 표시할 이름을 입력해 주세요.');
      return ['BEGIN:VCARD','VERSION:3.0',`N:${escapeCard(name)};;;;`,`FN:${escapeCard(name)}`,
        `ORG:${escapeCard($('vcard-org').value)}`,`TEL:${escapeCard($('vcard-phone').value)}`,
        `EMAIL:${escapeCard($('vcard-email').value)}`,'END:VCARD'].join('\r\n');
    }
    throw new Error('지원하지 않는 QR 유형입니다.');
  }
  function invalidateQr(message = '') {
    currentCanvas = null; currentPayload = '';
    $('qrcode-container').replaceChildren();
    if (message) $('qrcode-container').textContent = message;
    ['btn-download-png','btn-download-jpg','btn-copy-clipboard','btn-save-qr-history','btn-go-to-shortener'].forEach(id => {if ($(id)) $(id).disabled = true;});
  }
  function renderQr(notify = false) {
    if (!isQrPage) return false;
    renderVersion++;
    try {
      const text = payload();
      if (typeof QRCode === 'undefined') throw new Error('QR 생성 라이브러리를 불러오지 못했습니다.');
      const size = Math.max(180,Math.min(600,Number($('qr-size-slider').value) || 280));
      const dark = $('qr-fg-color').value, light = $('qr-bg-color').value;
      if (dark.toLowerCase() === light.toLowerCase()) throw new Error('QR 색상과 배경색을 다르게 선택해 주세요.');
      const level = currentLogo ? 'H' : $('qr-correct-level').value;
      if (currentLogo) $('qr-correct-level').value = 'H';
      const holder = document.createElement('div');
      const qr = new QRCode(holder,{text,width:size,height:size,colorDark:dark,colorLight:light,correctLevel:QRCode.CorrectLevel[level] ?? QRCode.CorrectLevel.H});
      const matrix = qr._oQRCode;
      const modules = matrix.getModuleCount();
      const count = modules + 8; // 4-module quiet zone on each side, also included in downloads.
      const cell = Math.max(1, Math.floor(size / count));
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      context.fillStyle = light; context.fillRect(0,0,size,size);
      const offset = Math.floor((size - modules * cell)/2);
      context.fillStyle = dark;
      for (let row=0;row<modules;row++) for (let col=0;col<modules;col++) {
        if(matrix.isDark(row,col)) context.fillRect(offset+col*cell,offset+row*cell,cell,cell);
      }
      if (currentLogo) {
        const side = Math.round(modules * cell * .16), x=(size-side)/2;
        context.fillStyle = '#fff'; context.fillRect(x-4,x-4,side+8,side+8);
        context.drawImage(currentLogo,x,x,side,side);
      }
      canvas.setAttribute('aria-label',`${activeType} QR 코드, 복원력 ${level}, ${size}px. 클릭하면 JPG 저장`);
      canvas.setAttribute('role','img');
      $('qrcode-container').replaceChildren(canvas); $('qrcode-container').dataset.level = level;
      $('qr-center-logo-img')?.classList.add('hidden');
      currentCanvas = canvas; currentPayload = text;
      if ($('preview-res-tag')) $('preview-res-tag').textContent = `${size} × ${size} px · ${level}`;
      ['btn-download-png','btn-download-jpg','btn-copy-clipboard','btn-save-qr-history','btn-go-to-shortener'].forEach(id => {if ($(id)) $(id).disabled=false;});
      if (notify) toast('QR 코드가 생성되었습니다.','success');
      return true;
    } catch (error) { invalidateQr(error.message); if (notify) showError(error); return false; }
  }
  function scheduleQr() { clearTimeout(generationTimer); invalidateQr(); generationTimer = setTimeout(()=>renderQr(),160); }
  function download(extension) {
    if (!renderQr()) return toast('입력 내용과 QR 설정을 확인해 주세요.','error');
    const anchor = document.createElement('a');
    anchor.download = `QRnShort_${Date.now()}.${extension}`;
    anchor.href = currentCanvas.toDataURL(extension === 'jpg' ? 'image/jpeg' : 'image/png',.95);
    anchor.click();
    toast(`${extension.toUpperCase()} 이미지가 다운로드되었습니다.`,'success');
  }
  if (isQrPage) {
    document.querySelectorAll('#qr-type-chips .chip').forEach(button => button.addEventListener('click',()=>{setType(button.dataset.type);scheduleQr();}));
    document.querySelectorAll('#qr-input-fields input,#qr-input-fields textarea,#qr-input-fields select').forEach(input=>input.addEventListener('input',scheduleQr));
    document.querySelectorAll('.preset-pill').forEach(button=>button.addEventListener('click',()=>{$('qr-input-url').value=button.dataset.fill;setType('url');renderQr();}));
    on('btn-clear-url','click',()=>{$('qr-input-url').value='';scheduleQr();});
    on('btn-generate-qr','click',()=>{clearTimeout(generationTimer);renderQr(true);});
    ['qr-fg-color','qr-bg-color','qr-correct-level'].forEach(id=>on(id,'input',()=>{
      if ($('qr-fg-hex')) $('qr-fg-hex').value=$('qr-fg-color').value;
      if ($('qr-bg-hex')) $('qr-bg-hex').value=$('qr-bg-color').value;
      scheduleQr();
    }));
    ['fg','bg'].forEach(kind=>on('qr-'+kind+'-hex','input',()=>{const value=$('qr-'+kind+'-hex').value;if(/^#[\da-f]{6}$/i.test(value)){$('qr-'+kind+'-color').value=value;scheduleQr();}}));
    on('qr-size-slider','input',()=>{$('size-val').textContent=$('qr-size-slider').value+'px';scheduleQr();});
    on('toggle-custom-opt','click',()=>{$('custom-body').hidden=!$('custom-body').hidden;});
    let logoVersion = 0;
    async function applyLogo(source) {
      const version = ++logoVersion; currentLogo=null;
      if (source !== 'none') {
        const image = new Image();
        try { await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('로고 이미지를 읽지 못했습니다.'));image.src=source;}); }
        catch(error) { if(version===logoVersion)showError(error); return; }
        if(version!==logoVersion)return; currentLogo=image;
      }
      renderQr();
    }
    document.querySelectorAll('.logo-choice').forEach(button=>button.addEventListener('click',()=>{
      document.querySelectorAll('.logo-choice').forEach(el=>el.classList.toggle('active',el===button));applyLogo(button.dataset.logo);
    }));
    on('custom-logo-upload','change',event=>{
      const file=event.target.files[0];if(!file)return;
      if(!file.type.startsWith('image/')||file.size>5*1024*1024)return toast('5MB 이하의 이미지 파일을 선택해 주세요.','error');
      const reader=new FileReader();reader.onload=()=>applyLogo(reader.result);reader.readAsDataURL(file);
    });
    on('btn-reset-qr','click',()=>{
      clearTimeout(generationTimer);logoVersion++;currentLogo=null;
      document.querySelectorAll('#qr-input-fields input,#qr-input-fields textarea').forEach(input=>{input.value='';if(input.type==='checkbox')input.checked=false;});
      $('qr-input-url').value='https://www.sdu.ac.kr/';$('wifi-auth').value='WPA';
      $('qr-correct-level').value='H';$('qr-fg-color').value=$('qr-fg-hex').value='#0f172a';
      $('qr-bg-color').value=$('qr-bg-hex').value='#ffffff';$('qr-size-slider').value=280;$('size-val').textContent='280px';
      $('custom-logo-upload').value='';document.querySelectorAll('.logo-choice').forEach(button=>button.classList.toggle('active',button.dataset.logo==='none'));
      setType('url');renderQr();toast('모든 QR 설정이 초기화되었습니다.');
    });
    on('btn-download-png','click',()=>download('png'));on('btn-download-jpg','click',()=>download('jpg'));
    on('qr-canvas-wrapper','click',()=>download('jpg'));
    $('qr-canvas-wrapper').setAttribute('tabindex','0');$('qr-canvas-wrapper').setAttribute('role','button');
    on('qr-canvas-wrapper','keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();download('jpg');}});
    on('btn-copy-clipboard','click',async()=>{
      if(!renderQr())return toast('QR 입력을 먼저 확인해 주세요.','error');
      try {
        if(!navigator.clipboard?.write || typeof ClipboardItem==='undefined')throw new Error('이미지 복사 미지원');
        const blob=await new Promise((resolve,reject)=>currentCanvas.toBlob(value=>value?resolve(value):reject(new Error('이미지 변환 실패')),'image/png'));
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);toast('QR 이미지가 복사되었습니다.','success');
      } catch (_) {try {await Core.copyText(currentPayload);toast('이미지 복사가 지원되지 않아 QR의 내용 텍스트를 복사했습니다.');}catch(error){showError(error);}}
    });
    on('btn-save-qr-history','click',()=>{
      if(!renderQr())return;
      if(store({id:uid(),type:'qr',title:activeType==='url'?currentPayload:activeType.toUpperCase()+' QR',content:currentPayload,createdAt:new Date().toISOString(),clicks:0}))toast('이 브라우저의 보관함에 저장했습니다.','success');
    });
    on('btn-go-to-shortener','click',()=>{
      if(activeType!=='url'||!renderQr())return toast('URL 유형의 QR만 단축할 수 있습니다.','error');
      const url=new URL('../urlShort/index.html',location.href);url.searchParams.set('url',currentPayload);location.href=url.href;
    });
    const incoming=new URLSearchParams(location.search).get('url');
    if(incoming){try{$('qr-input-url').value=Core.normalizeUrl(incoming);}catch(error){showError(error);}}
    setType('url');renderQr();
  }

  if ($('shortener-form')) {
    let busy=false, shortUrl='';
    const sync=()=>{
      $('btn-create-short').disabled=busy||!$('long-url-input').value.trim();$('btn-create-short').textContent=busy?'단축 중...':'단축하기';
      ['long-url-input','short-title-input','short-alias-input','btn-clear-short-url'].forEach(id=>{$(id).disabled=busy;});
    };
    const clearResult=()=>{shortUrl='';$('result-url-readonly').value='';$('result-short-url').removeAttribute('href');$('result-short-url').textContent='';$('short-result-container').classList.add('hidden');};
    on('long-url-input','input',()=>{clearResult();sync();});on('short-alias-input','input',clearResult);
    on('shortener-form','submit',async event=>{
      event.preventDefault();if(busy)return;
      clearResult();
      try {
        const original=Core.normalizeUrl($('long-url-input').value), alias=$('short-alias-input').value.trim();
        busy=true;sync();
        const cached=!alias&&Core.getHistory().find(item=>item.type==='short'&&item.content===original&&item.shortUrl);
        shortUrl=cached?cached.shortUrl:await Core.shorten(original,alias);
        $('result-url-readonly').value=shortUrl;$('result-short-url').textContent=shortUrl;$('result-short-url').href=shortUrl;
        $('result-orig-url').textContent=original;$('btn-visit-short-url').href=shortUrl;
        $('short-result-container').classList.remove('hidden');
        const holder=$('short-result-qr-preview');holder.replaceChildren();
        if(typeof QRCode!=='undefined'){try{new QRCode(holder,{text:shortUrl,width:180,height:180,colorDark:'#0f172a',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});}catch(_){holder.textContent='QR 미리보기를 만들지 못했습니다. QR 생성 화면을 이용해 주세요.';}}
        if(!cached)store({id:uid(),type:'short',title:$('short-title-input').value.trim()||original,content:original,shortUrl,createdAt:new Date().toISOString(),clicks:0});
        toast('실제 단축 주소가 생성되었습니다.','success');
      } catch(error){clearResult();showError(error);}
      finally {busy=false;sync();}
    });
    on('btn-copy-short-url','click',async()=>{try{await Core.copyText(shortUrl);toast('복사하였습니다.','success');}catch(error){showError(error);}});
    on('btn-short-to-qr','click',()=>{if(!shortUrl)return;const url=new URL('../url2qr/index.html',location.href);url.searchParams.set('url',shortUrl);location.href=url.href;});
    on('btn-clear-short-url','click',()=>{$('long-url-input').value='';clearResult();sync();});
    const incoming=new URLSearchParams(location.search).get('url');if(incoming){try{$('long-url-input').value=Core.normalizeUrl(incoming);}catch(error){showError(error);}}
    sync();
  }

  // 공통 보관함: 이 브라우저의 기록만 관리합니다. 삭제해도 외부 단축 링크는 폐기되지 않습니다.
  function renderHistory() {
    const list=$('history-list');if(!list)return;
    list.replaceChildren();const items=Core.getHistory(),query=$('history-query').value.toLowerCase(),filter=$('history-filter').value;
    $('history-count').textContent=`저장 기록 ${items.length}개 (이 브라우저)`;
    const selected=items.filter(item=>(filter==='all'||item.type===filter)&&(item.title+' '+item.content).toLowerCase().includes(query));
    if(!selected.length){const p=document.createElement('p');p.textContent='저장된 기록이 없습니다.';list.append(p);}
    selected.forEach(item=>{
      const card=document.createElement('article');card.className='history-item-card';
      const details=document.createElement('div');details.style.minWidth='0';details.style.flex='1';
      const title=document.createElement('strong');title.textContent=item.title;
      const content=document.createElement('p');content.textContent=item.content;content.style.overflowWrap='anywhere';
      const short=document.createElement('p');short.textContent=item.shortUrl|| (item.type==='short'?'이전 로컬 기록 · 원본 주소만 보관됨':'QR 코드');
      details.append(title,content,short);card.append(details);
      const copy=document.createElement('button');copy.className='btn btn-secondary';copy.textContent='복사';
      copy.onclick=async()=>{try{await Core.copyText(item.shortUrl||item.content);toast('기록 내용이 복사되었습니다.','success');}catch(error){showError(error);}};
      const remove=document.createElement('button');remove.className='btn btn-glass';remove.textContent='기록 삭제';
      remove.onclick=()=>{try{Core.saveHistory(Core.getHistory().filter(entry=>entry.id!==item.id));renderHistory();toast('이 브라우저의 기록을 삭제했습니다. 외부 단축 링크는 유지됩니다.');}catch(error){showError(error);}};
      card.append(copy,remove);list.append(card);
    });
  }
  const history=document.createElement('section');history.className='panel-card utility-panel';history.setAttribute('aria-label','내 보관함');
  history.innerHTML='<h2>내 보관함</h2><p id="history-count"></p><p class="utility-help">이 브라우저에만 저장됩니다. 기록을 삭제해도 이미 발급된 외부 단축 주소는 유지됩니다.</p><div class="utility-row"><input id="history-query" class="form-input" placeholder="기록 검색" aria-label="기록 검색"><select id="history-filter" class="form-select" aria-label="기록 종류"><option value="all">전체</option><option value="qr">QR</option><option value="short">단축 주소</option></select></div><div class="utility-row"><button type="button" id="btn-export-backup" class="btn btn-secondary">백업 내보내기</button><button type="button" id="btn-import-backup" class="btn btn-secondary">백업 가져오기</button><button type="button" id="btn-clear-history" class="btn btn-glass">기록 전체 삭제</button><input type="file" id="backup-file-input" accept="application/json,.json" hidden></div><div id="history-list" class="utility-history"></div>';
  document.querySelector('main').append(history);
  on('history-query','input',renderHistory);on('history-filter','change',renderHistory);renderHistory();
  on('btn-clear-history','click',()=>{if(confirm('이 브라우저의 보관함을 비울까요? 외부 단축 주소는 유지됩니다.')){try{Core.saveHistory([]);renderHistory();toast('보관함을 비웠습니다.');}catch(error){showError(error);}}});
  on('btn-export-backup','click',()=>{
    const blob=new Blob([JSON.stringify({version:'2.1',history:Core.getHistory()},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='QRnShort_Backup.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  on('btn-import-backup','click',()=>$('backup-file-input').click());
  on('backup-file-input','change',event=>{
    const file=event.target.files[0];if(!file)return;
    if(file.size>5*1024*1024){toast('5MB 이하의 백업을 선택해 주세요.','error');return;}
    const reader=new FileReader();reader.onload=()=>{
      try{const incoming=Core.validateBackup(JSON.parse(reader.result)),items=Core.getHistory(),ids=new Set(items.map(item=>item.id));
        incoming.forEach(item=>{if(!ids.has(item.id)){items.push(item);ids.add(item.id);}});Core.saveHistory(items);renderHistory();toast('백업을 가져왔습니다.','success');}
      catch(error){toast('백업 파일 형식이 올바르지 않습니다. 기존 기록은 유지됩니다.','error');}
      finally{event.target.value='';}
    };reader.onerror=()=>toast('백업 파일을 읽지 못했습니다.','error');reader.readAsText(file);
  });

  if (isQrPage) {
    const scanner=document.createElement('section');scanner.className='panel-card utility-panel';scanner.setAttribute('aria-label','QR 스캐너');
    scanner.innerHTML='<h2>QR 스캐너</h2><p class="utility-help">이미지를 선택하거나 카메라를 켜서 QR 내용을 읽습니다.</p><div class="utility-row" id="scan-upload-area"><label for="scan-file-input" class="btn btn-secondary">QR 이미지 선택</label><input id="scan-file-input" type="file" accept="image/*"></div><div class="utility-row"><button type="button" id="camera-start" class="btn btn-secondary">카메라 시작</button><button type="button" id="camera-stop" class="btn btn-glass">중지</button></div><video id="scan-video" playsinline muted hidden></video><p id="scan-status" role="status">스캔 대기 중</p><pre id="scan-result" class="scan-result"></pre><div class="utility-row"><button type="button" id="scan-copy" class="btn btn-secondary" disabled>결과 복사</button><button type="button" id="scan-to-qr" class="btn btn-secondary" disabled>QR로 다시 만들기</button><a id="scan-open" class="btn btn-secondary hidden" target="_blank" rel="noopener noreferrer">주소 열기</a></div>';
    document.querySelector('main').append(scanner);
    let stream=null,cameraVersion=0,frame=null,scanned='';
    function stopCamera(){cameraVersion++;if(frame)cancelAnimationFrame(frame);frame=null;if(stream)stream.getTracks().forEach(track=>track.stop());stream=null;$('scan-video').srcObject=null;$('scan-video').hidden=true;$('camera-start').disabled=false;}
    function clearScan(){scanned='';$('scan-result').textContent='';$('scan-copy').disabled=$('scan-to-qr').disabled=true;$('scan-open').classList.add('hidden');}
    function showScan(text){scanned=text;$('scan-result').textContent=text;$('scan-copy').disabled=$('scan-to-qr').disabled=false;
      try{if(!/^https?:\/\//i.test(text))throw new Error();$('scan-open').href=Core.normalizeUrl(text);$('scan-open').classList.remove('hidden');}catch(_) {$('scan-open').classList.add('hidden');}
      $('scan-status').textContent='QR 코드를 읽었습니다.';
    }
    function readImage(image){if(typeof jsQR==='undefined')throw new Error('스캔 라이브러리를 불러오지 못했습니다.');const scale=Math.min(1,1600/image.width);const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);const d=ctx.getImageData(0,0,canvas.width,canvas.height);return jsQR(d.data,d.width,d.height,{inversionAttempts:'attemptBoth'})?.data;}
    async function scanFile(file){stopCamera();clearScan();if(!file||!file.type.startsWith('image/')||file.size>10*1024*1024)return toast('10MB 이하의 이미지를 선택해 주세요.','error');
      const url=URL.createObjectURL(file),image=new Image();try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('이미지를 읽지 못했습니다.'));image.src=url;});const text=readImage(image);if(!text)throw new Error('QR을 찾지 못했습니다. 선명한 이미지를 사용해 주세요.');showScan(text);}catch(error){$('scan-status').textContent=error.message;showError(error);}finally{URL.revokeObjectURL(url);}}
    on('scan-file-input','change',event=>scanFile(event.target.files[0]));on('scan-upload-area','dragover',event=>event.preventDefault());on('scan-upload-area','drop',event=>{event.preventDefault();scanFile(event.dataTransfer.files[0]);});
    on('camera-start','click',async()=>{
      stopCamera();clearScan();const version=cameraVersion;$('camera-start').disabled=true;$('scan-status').textContent='카메라 연결 중...';
      try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('HTTPS 또는 localhost에서 카메라를 사용할 수 있습니다.');const incoming=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
        if(version!==cameraVersion){incoming.getTracks().forEach(track=>track.stop());return;}
        stream=incoming;const video=$('scan-video');video.srcObject=stream;video.hidden=false;await video.play();if(version!==cameraVersion)return;
        $('scan-status').textContent='카메라 스캔 중...';
        // drawImage needs the video element, with its intrinsic dimensions supplied directly.
        const live=()=>{if(version!==cameraVersion)return;try{if(video.videoWidth){const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0);const d=ctx.getImageData(0,0,canvas.width,canvas.height);const text=window.jsQR?.(d.data,d.width,d.height,{inversionAttempts:'attemptBoth'})?.data;if(text){showScan(text);stopCamera();return;}}}catch(error){stopCamera();showError(error);return;}frame=requestAnimationFrame(live);};frame=requestAnimationFrame(live);
      }catch(error){stopCamera();$('scan-status').textContent='카메라 접근 실패. 이미지 파일을 사용할 수 있습니다.';showError(error);}
    });
    on('camera-stop','click',()=>{stopCamera();$('scan-status').textContent='카메라를 중지했습니다.';});window.addEventListener('pagehide',stopCamera);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
    on('scan-copy','click',async()=>{try{await Core.copyText(scanned);toast('스캔 결과를 복사했습니다.','success');}catch(error){showError(error);}});
    on('scan-to-qr','click',()=>{if(/^https?:\/\//i.test(scanned)){setType('url');$('qr-input-url').value=scanned;}else{setType('text');$('qr-input-text').value=scanned;}renderQr();$('qr-stage').scrollIntoView({behavior:'smooth'});});
  }
});
