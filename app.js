/**
 * East Village Move-In Pre-Check & Key Handoff Web App Controller (New 5-Page Template · 4 Steps)
 */
(function () {
  const STORAGE_SETTINGS_KEY = 'ev_movein_settings_v1';
  const STORAGE_DRAFT_KEY = 'ev_movein_draft_v2';
  const MAX_STEP = 3;

  const CLEANLINESS_ITEMS = [
    { id: 'C1', title: 'Professionally cleaned / move-in ready', cn: '专业清洁完成，达到入住标准' },
    { id: 'C2', title: 'Free of smoke, pet, or heavy cooking odors', cn: '无烟味、宠物味或重油烟异味' },
    { id: 'C3', title: 'Free of visible pests, rodents, or bed-bug signs', cn: '无可见虫害、鼠迹或臭虫迹象' },
    { id: 'C4', title: 'No active water leaks, water stains, or visible mold/mildew', cn: '无漏水、水渍或可见霉斑' }
  ];

  const SECURITY_ITEMS = [
    { id: 'S1', title: 'Smoke alarms (bedrooms, hallway, each level)', sub: 'tested via test button · 烟感报警器测试', hasNA: false },
    { id: 'S2', title: 'Carbon monoxide (CO) alarm(s)', sub: 'if installed · 一氧化碳报警器', hasNA: true },
    { id: 'S3', title: 'Exterior door lock(s) & smart keypad', sub: 'new resident code set / rekeyed · 入户门锁与密码', hasNA: false },
    { id: 'S4', title: 'Keyless bolting device(s) & door viewer(s)', sub: 'on exterior doors · 无钥匙插销与猫眼', hasNA: true },
    { id: 'S5', title: 'Window latches & sliding glass door pin lock/bar', sub: 'if present · 窗锁与推拉门安全插销', hasNA: true }
  ];

  const KEY_ITEMS = [
    { id: 'K1', label: 'Physical unit key(s)', cn: '入户实体钥匙', defaultQty: '2' },
    { id: 'K2', label: 'Mailbox key(s)', cn: '信箱钥匙', defaultQty: '1' },
    { id: 'K3', label: 'Garage door remote(s)', cn: '车库门遥控器', defaultQty: '1' }
  ];

  const AREA_OPTIONS = [
    '',
    'Entry & stairs',
    'Living & dining',
    'Kitchen surfaces',
    'Kitchen appliances',
    'Bedroom 1',
    'Bathroom 1',
    'Bedroom 2',
    'Bathroom 2',
    'Bedroom 3 / office',
    'Half bath',
    'Loft / flex space',
    'Laundry & HVAC',
    'Garage & rooftop',
    'Balcony / exterior',
    'Keys & smart lock'
  ];

  let currentStep = 0;
  let templatePdfCache = null;
  let pendingPhotoTargetSlot = null;

  const photos = Array.from({ length: 12 }, () => ({
    dataUrl: '',
    area: '',
    caption: ''
  }));

  const sigPads = {};

  function $(id) {
    return document.getElementById(id);
  }

  function showToast(msg, duration = 2600) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove('show'), duration);
  }

  function formatUSDate(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const y = date.getFullYear();
    return `${m}/${d}/${y}`;
  }

  function formatUSDateTime(date) {
    let h = date.getHours();
    const min = String(date.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${formatUSDate(date)} ${h}:${min} ${ampm}`;
  }

  function toDatetimeLocalValue(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  }

  function computeInitials(fullName) {
    if (!fullName) return '';
    return fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  function uint8ToBase64(bytes) {
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const sub = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      binary += String.fromCharCode.apply(null, sub);
    }
    return btoa(binary);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==================== Settings ====================
  function getSettings() {
    const defaults = window.EV_APP_CONFIG || {};
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_SETTINGS_KEY) || '{}');
    } catch (_) {}
    return {
      gasUrl: saved.gasUrl || defaults.GAS_WEB_APP_URL || '',
      pin: saved.pin !== undefined ? saved.pin : (defaults.ACCESS_PIN || ''),
      defaultEmail: saved.defaultEmail || defaults.DEFAULT_SUBMISSION_EMAIL || '',
      defaultStaff: saved.defaultStaff || defaults.DEFAULT_STAFF_NAME || '',
      photoMaxDim: defaults.PHOTO_MAX_DIMENSION || 1500,
      photoQuality: defaults.PHOTO_JPEG_QUALITY || 0.82
    };
  }

  function saveSettings(obj) {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(obj));
  }

  // ==================== Dynamic UI Builders ====================
  function renderCleanlinessSection() {
    const wrap = $('cleanlinessContainer');
    wrap.innerHTML = CLEANLINESS_ITEMS.map((item) => `
      <div class="check-item">
        <div class="check-item-head">
          <div>
            <div class="check-item-title">${item.title}</div>
            <div class="check-item-desc">${item.cn}</div>
          </div>
          <div class="pill-group" style="min-width:170px;">
            <label class="pill-option tone-ok">
              <input type="radio" name="PC_${item.id}" value="OK" />
              <span>OK</span>
            </label>
            <label class="pill-option tone-warn">
              <input type="radio" name="PC_${item.id}" value="PreEx" />
              <span>Pre-Ex</span>
            </label>
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <label>MGMT NOTE (IF ANY) <span class="sub">预检备注 / 照片编号</span></label>
            <input type="text" id="${item.id}_Mgmt_Note" placeholder="可留空" />
          </div>
          <div class="field">
            <label>RESIDENT COMMENTS (IF ANY) <span class="sub">交房时可选备注</span></label>
            <input type="text" id="${item.id}_Resident_Comments" placeholder="Optional note at key handoff" />
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderSecuritySection() {
    const wrap = $('securityContainer');
    wrap.innerHTML = SECURITY_ITEMS.map((item) => `
      <div class="check-item">
        <div class="check-item-head">
          <div>
            <div class="check-item-title">${item.title}</div>
            <div class="check-item-desc">${item.sub}</div>
          </div>
          <div class="pill-group" style="min-width:${item.hasNA ? 235 : 170}px;">
            <label class="pill-option tone-ok">
              <input type="radio" name="${item.id}_Status" value="Working" />
              <span>Working</span>
            </label>
            <label class="pill-option tone-danger">
              <input type="radio" name="${item.id}_Status" value="Issue" />
              <span>Issue</span>
            </label>
            ${item.hasNA ? `
              <label class="pill-option tone-na">
                <input type="radio" name="${item.id}_Status" value="NA" />
                <span>NA</span>
              </label>
            ` : ''}
          </div>
        </div>
        <div class="field">
          <label>TESTED / CODE SET DATE OR NOTE <span class="sub">测试日期 / 密码设置备注</span></label>
          <input type="text" id="${item.id}_Date_Note" placeholder="例如: Tested OK ${formatUSDate(new Date())}" />
        </div>
      </div>
    `).join('');
  }

  function renderKeysSection() {
    const wrap = $('keysContainer');
    wrap.innerHTML = KEY_ITEMS.map((k) => `
      <div class="check-item">
        <div class="check-item-title" style="margin-bottom:8px;">
          ${k.label} <span style="font-weight:400;color:var(--slate-500);font-size:12.5px;">${k.cn}</span>
        </div>
        <div class="grid-2">
          <div class="field">
            <label>QTY / ISSUED 交付数量</label>
            <input type="text" id="${k.id}_Qty_Issued" placeholder="例如: ${k.defaultQty}" />
          </div>
          <div class="field">
            <label>NOTES 备注</label>
            <input type="text" id="${k.id}_Notes" placeholder="例如: Key # / Remote tested" />
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderPhotoGrid() {
    const grid = $('photoGrid');
    grid.innerHTML = photos.map((p, idx) => {
      const num = idx + 1;
      const pageLabel = num <= 6 ? 'P3' : 'P4';
      const opts = AREA_OPTIONS.map((opt) =>
        `<option value="${escapeHtml(opt)}" ${p.area === opt ? 'selected' : ''}>${opt || '-- 选择区域 Area --'}</option>`
      ).join('');
      return `
        <div class="photo-slot" data-slot="${idx}">
          <div class="photo-slot-head">
            <span>PHOTO ${num} <small style="opacity:0.65;">(${pageLabel})</small></span>
            <div>
              ${p.dataUrl ? `<button type="button" class="mini-btn danger" data-remove-photo="${idx}" style="padding:3px 8px;font-size:11.5px;">删除</button>` : ''}
            </div>
          </div>
          <div class="photo-preview-wrap" data-pick-slot="${idx}">
            ${p.dataUrl
              ? `<img src="${p.dataUrl}" alt="Photo ${num}" />`
              : `<div class="photo-placeholder"><span class="cam-icon">📷</span>点击拍照或上传 Photo ${num}</div>`
            }
          </div>
          <div class="photo-slot-fields">
            <select data-photo-area="${idx}">${opts}</select>
            <input type="text" data-photo-caption="${idx}" value="${escapeHtml(p.caption)}" placeholder="Caption / Date 说明与日期" />
          </div>
        </div>
      `;
    }).join('');

    updatePhotoCounts();
  }

  function updatePhotoCounts() {
    const count = photos.filter((p) => p.dataUrl).length;
    $('photoNavCount').textContent = `(${count})`;
    $('photoHeaderBadge').textContent = `${count} / 12 张 · Pages 3–4`;
    $('totalMgmtPhotosDisplay').value = String(count);
  }

  // ==================== Photo Compression ====================
  async function compressImageFile(file) {
    const settings = getSettings();
    const maxDim = settings.photoMaxDim;
    const quality = settings.photoQuality;

    let source = null;
    let w = 0;
    let h = 0;

    if (typeof createImageBitmap === 'function') {
      try {
        source = await createImageBitmap(file, { imageOrientation: 'from-image' });
        w = source.width;
        h = source.height;
      } catch (_) {
        source = null;
      }
    }

    if (!source) {
      source = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
          const img = new Image();
          img.onerror = reject;
          img.onload = () => resolve(img);
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
      w = source.naturalWidth || source.width;
      h = source.naturalHeight || source.height;
    }

    const scale = Math.min(1, maxDim / Math.max(w, h));
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(source, 0, 0, targetW, targetH);

    if (source && typeof source.close === 'function') {
      source.close();
    }

    return canvas.toDataURL('image/jpeg', quality);
  }

  function findNextFreePhotoSlot() {
    return photos.findIndex((p) => !p.dataUrl);
  }

  async function handleFilesSelected(fileList, explicitSlotIndex = null) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
    if (!files.length) return;

    let added = 0;
    const stamp = formatUSDateTime(new Date());

    for (let i = 0; i < files.length; i++) {
      let slotIdx = (explicitSlotIndex !== null && i === 0) ? explicitSlotIndex : findNextFreePhotoSlot();
      if (slotIdx === -1) {
        showToast('12 个照片位已满，可删除旧照片后替换');
        break;
      }
      try {
        const dataUrl = await compressImageFile(files[i]);
        photos[slotIdx].dataUrl = dataUrl;
        if (!photos[slotIdx].caption) {
          photos[slotIdx].caption = stamp;
        }
        added++;
      } catch (err) {
        console.error('Image compression failed:', err);
        showToast('有照片读取失败，请重试（建议使用 JPG/PNG）');
      }
    }

    renderPhotoGrid();
    if (added > 0) {
      showToast(`已添加 ${added} 张照片（共 ${photos.filter((p) => p.dataUrl).length}/12 张）`);
    }
  }

  // ==================== Signature Pad Engine ====================
  function createSignaturePad(key, canvasId, hintId) {
    const canvas = $(canvasId);
    const hint = $(hintId);
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasInk = false;
    let strokes = [];
    let currentStroke = null;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f2730';
      ctx.lineWidth = 2.2;
      redraw();
    }

    function redraw() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      for (const stroke of strokes) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x * rect.width, stroke[0].y * rect.height);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x * rect.width, stroke[i].y * rect.height);
        }
        ctx.stroke();
      }
    }

    function getNormPoint(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      };
    }

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      hasInk = true;
      hint.classList.add('hidden');
      const pt = getNormPoint(e);
      currentStroke = [pt];
      strokes.push(currentStroke);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!drawing || !currentStroke) return;
      e.preventDefault();
      const pt = getNormPoint(e);
      const prev = currentStroke[currentStroke.length - 1];
      currentStroke.push(pt);
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(prev.x * rect.width, prev.y * rect.height);
      ctx.lineTo(pt.x * rect.width, pt.y * rect.height);
      ctx.stroke();
    });

    function endStroke(e) {
      if (!drawing) return;
      drawing = false;
      currentStroke = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);

    function clear() {
      strokes = [];
      hasInk = false;
      hint.classList.remove('hidden');
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width || canvas.width, rect.height || canvas.height);
    }

    function exportTrimmedPng() {
      if (!hasInk || strokes.length === 0) return '';
      const W = 600;
      const H = 180;
      let minX = W, minY = H, maxX = 0, maxY = 0;
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const octx = off.getContext('2d');
      octx.lineCap = 'round';
      octx.lineJoin = 'round';
      octx.strokeStyle = '#0f2730';
      octx.lineWidth = 4.2;

      for (const stroke of strokes) {
        if (stroke.length < 2) continue;
        octx.beginPath();
        stroke.forEach((p, idx) => {
          const px = p.x * W;
          const py = p.y * H;
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
          if (idx === 0) octx.moveTo(px, py);
          else octx.lineTo(px, py);
        });
        octx.stroke();
      }

      if (maxX <= minX || maxY <= minY) return '';
      const pad = 10;
      const sx = Math.max(0, Math.floor(minX - pad));
      const sy = Math.max(0, Math.floor(minY - pad));
      const sw = Math.min(W - sx, Math.ceil(maxX - minX + pad * 2));
      const sh = Math.min(H - sy, Math.ceil(maxY - minY + pad * 2));

      const trimmed = document.createElement('canvas');
      trimmed.width = Math.max(10, sw);
      trimmed.height = Math.max(10, sh);
      trimmed.getContext('2d').drawImage(off, sx, sy, sw, sh, 0, 0, sw, sh);
      return trimmed.toDataURL('image/png');
    }

    return { key, resize, clear, exportTrimmedPng, hasInk: () => hasInk };
  }

  function initSignaturePads() {
    sigPads.Res1 = createSignaturePad('Res1', 'canvasRes1', 'hintRes1');
    sigPads.Res2 = createSignaturePad('Res2', 'canvasRes2', 'hintRes2');
    sigPads.Res3 = createSignaturePad('Res3', 'canvasRes3', 'hintRes3');
    sigPads.Mgmt = createSignaturePad('Mgmt', 'canvasMgmt', 'hintMgmt');

    document.querySelectorAll('.sig-card').forEach((card) => {
      const buttons = card.querySelectorAll('[data-sig-mode]');
      const drawArea = card.querySelector('.sig-draw-area');
      const typeArea = card.querySelector('.sig-type-area');
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          buttons.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const mode = btn.dataset.sigMode;
          card.dataset.mode = mode;
          drawArea.classList.toggle('hidden', mode !== 'draw');
          typeArea.classList.toggle('hidden', mode !== 'type');
          if (mode === 'draw') {
            const pad = sigPads[card.dataset.sig];
            if (pad) pad.resize();
          }
        });
      });
      card.dataset.mode = 'draw';
    });

    document.querySelectorAll('[data-clear-sig]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.clearSig;
        if (sigPads[key]) sigPads[key].clear();
      });
    });

    window.addEventListener('resize', () => {
      Object.values(sigPads).forEach((p) => p.resize());
    });
  }

  // ==================== Stepper ====================
  function goToStep(stepIndex) {
    currentStep = Math.max(0, Math.min(MAX_STEP, stepIndex));
    document.querySelectorAll('.step-panel').forEach((p) => {
      p.classList.toggle('active', Number(p.dataset.step) === currentStep);
    });
    document.querySelectorAll('.step-tab').forEach((t) => {
      t.classList.toggle('active', Number(t.dataset.step) === currentStep);
    });
    $('btnPrevStep').disabled = currentStep === 0;
    $('btnNextStep').textContent = currentStep === MAX_STEP ? '完成 · 请在上方提交 ↑' : '下一步 →';
    $('btnNextStep').disabled = currentStep === MAX_STEP;

    if (currentStep === MAX_STEP) {
      syncAutoFieldsForSignStep();
      requestAnimationFrame(() => {
        Object.values(sigPads).forEach((p) => p.resize());
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function syncAutoFieldsForSignStep() {
    const res1Name = $('resident1FullName').value.trim();
    if (res1Name && !$('res1PrintedName').value.trim()) {
      $('res1PrintedName').value = res1Name;
    }
    if (res1Name && !$('residentInitials').value.trim()) {
      $('residentInitials').value = computeInitials(res1Name);
    }

    const today = formatUSDate(new Date());
    if (!$('res1Date').value.trim()) $('res1Date').value = today;
    if (!$('mgmtDateTime').value.trim()) {
      $('mgmtDateTime').value = $('keyHandoffDateTime').value.trim() || formatUSDateTime(new Date());
    }

    const prop = getRadioValue('property') || 'EV';
    const unit = $('unit').value.trim() || 'UNIT';
    if (!$('mgmtPhotoSetRef').value.trim() && photos.some((p) => p.dataUrl)) {
      const d = new Date();
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      $('mgmtPhotoSetRef').value = `${prop}-${unit}-${ymd}`;
    }
  }

  // ==================== Form Data Collection ====================
  function getRadioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }

  function setRadioValue(name, val) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
      el.checked = el.value === val;
    });
  }

  function collectFormData() {
    const cleanliness = {};
    CLEANLINESS_ITEMS.forEach((item) => {
      cleanliness[item.id] = {
        status: getRadioValue(`PC_${item.id}`),
        mgmtNote: $(`${item.id}_Mgmt_Note`).value.trim(),
        residentComments: $(`${item.id}_Resident_Comments`).value.trim()
      };
    });

    const security = {};
    SECURITY_ITEMS.forEach((item) => {
      security[item.id] = {
        status: getRadioValue(`${item.id}_Status`),
        dateNote: $(`${item.id}_Date_Note`).value.trim()
      };
    });

    const keys = {};
    KEY_ITEMS.forEach((k) => {
      keys[k.id] = {
        qty: $(`${k.id}_Qty_Issued`).value.trim(),
        notes: $(`${k.id}_Notes`).value.trim()
      };
    });

    function getSigPayload(sigKey, printedId, dateId, typedId) {
      const card = document.querySelector(`.sig-card[data-sig="${sigKey}"]`);
      const mode = card ? card.dataset.mode : 'draw';
      return {
        mode,
        printedName: printedId ? $(printedId).value.trim() : '',
        date: dateId ? $(dateId).value.trim() : '',
        typedName: $(typedId).value.trim(),
        imageDataUrl: mode === 'draw' && sigPads[sigKey] ? sigPads[sigKey].exportTrimmedPng() : ''
      };
    }

    const mgmtCard = document.querySelector('.sig-card[data-sig="Mgmt"]');
    const mgmtMode = mgmtCard ? mgmtCard.dataset.mode : 'draw';

    return {
      property: getRadioValue('property'),
      unit: $('unit').value.trim(),
      floorPlan: getRadioValue('floorPlan'),
      floorPlanOther: $('floorPlanOther').value.trim(),
      keyHandoffDateTime: $('keyHandoffDateTime').value.trim(),
      supplementDeadlineDateTime: $('supplementDeadlineDateTime').value.trim(),
      preCheckInspectorDate: $('preCheckInspectorDate').value.trim(),
      resident1FullName: $('resident1FullName').value.trim(),
      resident1Phone: $('resident1Phone').value.trim(),
      designatedEmail: $('designatedEmail').value.trim(),
      otherAdultResidents: $('otherAdultResidents').value.trim(),
      cleanliness,
      security,
      keys,
      handoffAdditionalNotes: $('handoffAdditionalNotes').value.trim(),
      submissionEmail: $('submissionEmail').value.trim(),
      noticeEmailDesignation: $('noticeEmailDesignation').checked,
      residentInitials: $('residentInitials').value.trim().toUpperCase(),
      photosTakenDate: $('photosTakenDate').value.trim(),
      photosTakenBy: $('photosTakenBy').value.trim(),
      photos: photos.map((p) => ({ ...p })),
      signatures: {
        Res1: getSigPayload('Res1', 'res1PrintedName', 'res1Date', 'typedRes1'),
        Res2: getSigPayload('Res2', 'res2PrintedName', 'res2Date', 'typedRes2'),
        Res3: getSigPayload('Res3', 'res3PrintedName', 'res3Date', 'typedRes3'),
        Mgmt: {
          mode: mgmtMode,
          staffName: $('mgmtStaffName').value.trim(),
          dateTime: $('mgmtDateTime').value.trim(),
          photoSetRef: $('mgmtPhotoSetRef').value.trim(),
          typedName: $('typedMgmt').value.trim(),
          imageDataUrl: mgmtMode === 'draw' && sigPads.Mgmt ? sigPads.Mgmt.exportTrimmedPng() : ''
        }
      }
    };
  }

  function buildPdfFileName(data) {
    const prop = data.property || 'EV';
    const unitClean = (data.unit || 'Unit').replace(/[^a-zA-Z0-9_-]/g, '');
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${prop}_Unit${unitClean}_MoveIn_PreCheck_${ymd}.pdf`;
  }

  function buildIssuesSummary(data) {
    const flags = [];
    CLEANLINESS_ITEMS.forEach((c) => {
      if (data.cleanliness[c.id].status === 'PreEx') flags.push(`${c.id}:PreEx`);
    });
    SECURITY_ITEMS.forEach((s) => {
      if (data.security[s.id].status === 'Issue') flags.push(`${s.id}:Issue`);
    });
    return flags.length ? flags.join(', ') : 'All OK / See Photos';
  }

  // ==================== Draft Auto-Save ====================
  function saveDraft() {
    try {
      const snapshot = collectFormData();
      delete snapshot.photos;
      delete snapshot.signatures;
      snapshot.res1PrintedName = $('res1PrintedName').value;
      snapshot.res2PrintedName = $('res2PrintedName').value;
      snapshot.res3PrintedName = $('res3PrintedName').value;
      snapshot.mgmtStaffName = $('mgmtStaffName').value;
      snapshot.mgmtPhotoSetRef = $('mgmtPhotoSetRef').value;
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(snapshot));
    } catch (_) {}
  }

  function restoreDraft() {
    let d = null;
    try {
      d = JSON.parse(localStorage.getItem(STORAGE_DRAFT_KEY) || 'null');
    } catch (_) {}
    if (!d) return false;

    setRadioValue('property', d.property);
    $('unit').value = d.unit || '';
    setRadioValue('floorPlan', d.floorPlan);
    $('floorPlanOther').value = d.floorPlanOther || '';
    $('floorPlanOtherWrap').classList.toggle('hidden', d.floorPlan !== 'Other');
    if (d.keyHandoffDateTime) $('keyHandoffDateTime').value = d.keyHandoffDateTime;
    if (d.supplementDeadlineDateTime) $('supplementDeadlineDateTime').value = d.supplementDeadlineDateTime;
    if (d.preCheckInspectorDate) $('preCheckInspectorDate').value = d.preCheckInspectorDate;
    $('resident1FullName').value = d.resident1FullName || '';
    $('resident1Phone').value = d.resident1Phone || '';
    $('designatedEmail').value = d.designatedEmail || '';
    $('otherAdultResidents').value = d.otherAdultResidents || '';

    if (d.cleanliness) {
      CLEANLINESS_ITEMS.forEach((item) => {
        const c = d.cleanliness[item.id] || {};
        setRadioValue(`PC_${item.id}`, c.status);
        $(`${item.id}_Mgmt_Note`).value = c.mgmtNote || '';
        $(`${item.id}_Resident_Comments`).value = c.residentComments || '';
      });
    }
    if (d.security) {
      SECURITY_ITEMS.forEach((item) => {
        const s = d.security[item.id] || {};
        setRadioValue(`${item.id}_Status`, s.status);
        $(`${item.id}_Date_Note`).value = s.dateNote || '';
      });
    }
    if (d.keys) {
      KEY_ITEMS.forEach((k) => {
        const kv = d.keys[k.id] || {};
        $(`${k.id}_Qty_Issued`).value = kv.qty || '';
        $(`${k.id}_Notes`).value = kv.notes || '';
      });
    }
    $('handoffAdditionalNotes').value = d.handoffAdditionalNotes || '';
    if (d.submissionEmail) $('submissionEmail').value = d.submissionEmail;
    $('noticeEmailDesignation').checked = !!d.noticeEmailDesignation;
    $('residentInitials').value = d.residentInitials || '';
    if (d.photosTakenDate) $('photosTakenDate').value = d.photosTakenDate;
    if (d.photosTakenBy) $('photosTakenBy').value = d.photosTakenBy;
    if (d.res1PrintedName) $('res1PrintedName').value = d.res1PrintedName;
    if (d.res2PrintedName) $('res2PrintedName').value = d.res2PrintedName;
    if (d.res3PrintedName) $('res3PrintedName').value = d.res3PrintedName;
    if (d.mgmtStaffName) $('mgmtStaffName').value = d.mgmtStaffName;
    if (d.mgmtPhotoSetRef) $('mgmtPhotoSetRef').value = d.mgmtPhotoSetRef;

    return true;
  }

  function applySmartDefaults() {
    const settings = getSettings();
    const now = new Date();
    const deadline = new Date(now.getTime() + 36 * 60 * 60 * 1000);

    $('keyHandoffPicker').value = toDatetimeLocalValue(now);
    if (!$('keyHandoffDateTime').value) $('keyHandoffDateTime').value = formatUSDateTime(now);
    if (!$('supplementDeadlineDateTime').value) $('supplementDeadlineDateTime').value = formatUSDateTime(deadline);
    if (!$('photosTakenDate').value) $('photosTakenDate').value = formatUSDate(now);
    if (!$('res1Date').value) $('res1Date').value = formatUSDate(now);

    if (settings.defaultEmail && !$('submissionEmail').value) {
      $('submissionEmail').value = settings.defaultEmail;
    }
    if (settings.defaultStaff) {
      if (!$('preCheckInspectorDate').value) {
        $('preCheckInspectorDate').value = `${settings.defaultStaff} · ${formatUSDate(now)}`;
      }
      if (!$('photosTakenBy').value) $('photosTakenBy').value = settings.defaultStaff;
      if (!$('mgmtStaffName').value) $('mgmtStaffName').value = settings.defaultStaff;
    }
  }

  // ==================== PDF Generation & Google Drive Upload ====================
  async function loadTemplateBytes() {
    if (templatePdfCache) return templatePdfCache;
    const res = await fetch('./template.pdf?v=2');
    if (!res.ok) {
      throw new Error(`无法加载模板 PDF (HTTP ${res.status})，请确认使用 HTTP(S) 服务访问网页`);
    }
    templatePdfCache = await res.arrayBuffer();
    return templatePdfCache;
  }

  function setLoading(open, text = '', sub = '') {
    $('loadingText').textContent = text;
    $('loadingSub').textContent = sub;
    $('loadingModal').classList.toggle('open', open);
  }

  function downloadPdfBytes(pdfBytes, fileName) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return blob;
  }

  async function generateFilledPdf() {
    if (!window.PDFLib || !window.EVPdfFiller) {
      throw new Error('PDF 引擎尚未加载完成，请检查网络后刷新页面重试');
    }
    const data = collectFormData();
    const templateBytes = await loadTemplateBytes();
    const pdfBytes = await window.EVPdfFiller.fillMoveInPdf(templateBytes, data);
    const fileName = buildPdfFileName(data);
    return { data, pdfBytes, fileName };
  }

  function validateBeforeSubmit(data) {
    const missing = [];
    if (!data.property) missing.push('物业 Property (EV1 / EV2)');
    if (!data.unit) missing.push('房号 Unit #');
    if (!data.resident1FullName) missing.push('主租客姓名 Primary Resident Name');
    if (!data.noticeEmailDesignation) missing.push('勾选通知邮箱指定确认框 (Designate Page 1 Email for Notices)');
    return missing;
  }

  async function handlePreviewPdf() {
    try {
      setLoading(true, '正在生成新版 5 页 PDF...', '嵌入现场照片与手写签名中');
      const { pdfBytes, fileName } = await generateFilledPdf();
      setLoading(false);
      downloadPdfBytes(pdfBytes, fileName);
      showToast(`已生成并下载: ${fileName}`, 3200);
    } catch (err) {
      setLoading(false);
      alert('生成 PDF 失败：\n' + err.message);
    }
  }

  async function handleSubmitToDrive() {
    const settings = getSettings();
    const data = collectFormData();

    const missing = validateBeforeSubmit(data);
    if (missing.length > 0) {
      alert('提交前请先补充以下必填项：\n• ' + missing.join('\n• '));
      return;
    }

    if (!settings.gasUrl) {
      const goSettings = confirm(
        '尚未配置 Google Apps Script Web App URL，暂时无法上传到 Google Drive。\n\n' +
        '点击「确定」立即打开设置填写 URL；或先使用「生成并预览/下载 PDF」在本地测试。'
      );
      if (goSettings) openSettingsModal();
      return;
    }

    try {
      setLoading(true, '第 1/2 步：正在生成新版 5 页 PDF...', '嵌入现场照片与手写签名');
      const { pdfBytes, fileName } = await generateFilledPdf();
      const pdfSizeMb = (pdfBytes.length / (1024 * 1024)).toFixed(2);

      setLoading(true, `第 2/2 步：正在上传到 Google Drive (${pdfSizeMb} MB)...`, '请保持屏幕常亮，通常需要 3–10 秒');

      const payload = {
        action: 'submit',
        pin: settings.pin || '',
        fileName,
        pdfBase64: uint8ToBase64(pdfBytes),
        meta: {
          property: data.property,
          unit: data.unit,
          floorPlan: data.floorPlan === 'Other' ? `Other (${data.floorPlanOther})` : data.floorPlan,
          residentName: data.resident1FullName,
          residentPhone: data.resident1Phone,
          designatedEmail: data.designatedEmail,
          keyHandoffDateTime: data.keyHandoffDateTime,
          supplementDeadline: data.supplementDeadlineDateTime,
          inspector: data.preCheckInspectorDate || data.signatures.Mgmt.staffName,
          photoCount: data.photos.filter((p) => p.dataUrl).length,
          issuesSummary: buildIssuesSummary(data)
        }
      };

      const response = await fetch(settings.gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      const rawText = await response.text();
      let result = null;
      try {
        result = JSON.parse(rawText);
      } catch (_) {
        throw new Error('Google Apps Script 返回了非 JSON 内容，请确认部署权限已设为「任何人 (Anyone)」');
      }

      if (!result || !result.ok) {
        throw new Error((result && result.error) || '上传失败，请检查访问口令或脚本权限');
      }

      setLoading(false);
      $('submitResultArea').innerHTML = `
        <div class="result-card ok">
          <div style="font-weight:800;font-size:15px;margin-bottom:6px;">✅ 已成功归档到 Google Drive！</div>
          <div>文件名：<strong>${escapeHtml(result.fileName || fileName)}</strong></div>
          <div style="margin-top:6px;">
            📁 PDF 链接：<a href="${escapeHtml(result.fileUrl)}" target="_blank" rel="noopener">点击在 Google Drive 中查看</a>
          </div>
          ${result.sheetUrl ? `<div style="margin-top:4px;">📊 台账链接：<a href="${escapeHtml(result.sheetUrl)}" target="_blank" rel="noopener">查看 Google Sheet 记录</a></div>` : ''}
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="mini-btn" id="btnDownloadBackup">💾 同时在手机保存一份副本</button>
          </div>
        </div>
      `;

      const backupBtn = $('btnDownloadBackup');
      if (backupBtn) {
        backupBtn.addEventListener('click', () => downloadPdfBytes(pdfBytes, fileName));
      }
      showToast('归档成功！已存入 Google Drive', 3500);
    } catch (err) {
      setLoading(false);
      $('submitResultArea').innerHTML = `
        <div class="result-card err">
          <div style="font-weight:800;margin-bottom:4px;">❌ 上传 Google Drive 失败</div>
          <div>${escapeHtml(err.message)}</div>
          <div style="margin-top:6px;font-size:12.5px;">您仍可点击「生成并预览/下载 5 页 PDF」先保存文件到手机本地，数据不会丢失。</div>
        </div>
      `;
    }
  }

  // ==================== Settings Modal ====================
  function openSettingsModal() {
    const s = getSettings();
    $('cfgGasUrl').value = s.gasUrl;
    $('cfgPin').value = s.pin;
    $('cfgEmail').value = s.defaultEmail;
    $('cfgStaffName').value = s.defaultStaff;
    $('gasTestStatus').textContent = '';
    $('settingsModal').classList.add('open');
  }

  function closeSettingsModal() {
    $('settingsModal').classList.remove('open');
  }

  async function testGasConnection() {
    const url = $('cfgGasUrl').value.trim();
    const pin = $('cfgPin').value.trim();
    const statusEl = $('gasTestStatus');
    if (!url) {
      statusEl.textContent = '请先填写 Web App URL';
      statusEl.style.color = 'var(--danger)';
      return;
    }
    statusEl.textContent = '正在测试连接...';
    statusEl.style.color = 'var(--slate-500)';
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}action=ping&pin=${encodeURIComponent(pin)}`, { redirect: 'follow' });
      const data = await res.json();
      if (data && data.ok) {
        statusEl.textContent = `✅ 连接成功（目标文件夹：${data.folderName || '已就绪'}）`;
        statusEl.style.color = 'var(--ok)';
      } else {
        statusEl.textContent = `❌ ${(data && data.error) || '口令错误或无权限'}`;
        statusEl.style.color = 'var(--danger)';
      }
    } catch (err) {
      statusEl.textContent = '❌ 无法连接，请检查 URL 与部署权限（需设为 Anyone）';
      statusEl.style.color = 'var(--danger)';
    }
  }

  // ==================== Event Bindings ====================
  function bindEvents() {
    document.querySelectorAll('.step-tab').forEach((tab) => {
      tab.addEventListener('click', () => goToStep(Number(tab.dataset.step)));
    });
    $('btnPrevStep').addEventListener('click', () => goToStep(currentStep - 1));
    $('btnNextStep').addEventListener('click', () => goToStep(currentStep + 1));

    document.querySelectorAll('input[name="floorPlan"]').forEach((r) => {
      r.addEventListener('change', () => {
        $('floorPlanOtherWrap').classList.toggle('hidden', r.value !== 'Other' || !r.checked);
      });
    });

    function getBaseHandoffDate() {
      const pickerVal = $('keyHandoffPicker').value;
      if (pickerVal) {
        const dt = new Date(pickerVal);
        if (!isNaN(dt.getTime())) return dt;
      }
      return new Date();
    }

    $('keyHandoffPicker').addEventListener('change', (e) => {
      if (!e.target.value) return;
      const dt = new Date(e.target.value);
      if (isNaN(dt.getTime())) return;
      const deadline = new Date(dt.getTime() + 36 * 60 * 60 * 1000);
      $('keyHandoffDateTime').value = formatUSDateTime(dt);
      $('supplementDeadlineDateTime').value = formatUSDateTime(deadline);
      $('mgmtDateTime').value = formatUSDateTime(dt);
      saveDraft();
    });

    document.querySelectorAll('[data-deadline-hours]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hrs = Number(btn.dataset.deadlineHours);
        const base = getBaseHandoffDate();
        const dl = new Date(base.getTime() + hrs * 60 * 60 * 1000);
        $('supplementDeadlineDateTime').value = formatUSDateTime(dl);
        saveDraft();
        showToast(`已将截止时间设为交房后 +${hrs} 小时`);
      });
    });

    $('btnAllCleanOk').addEventListener('click', () => {
      CLEANLINESS_ITEMS.forEach((c) => setRadioValue(`PC_${c.id}`, 'OK'));
      saveDraft();
      showToast('已将全部清洁异味项设为 OK');
    });

    $('btnAllSecWorking').addEventListener('click', () => {
      const todayNote = `Tested OK · ${formatUSDate(new Date())}`;
      SECURITY_ITEMS.forEach((s) => {
        setRadioValue(`${s.id}_Status`, 'Working');
        const noteInput = $(`${s.id}_Date_Note`);
        if (!noteInput.value.trim()) noteInput.value = todayNote;
      });
      saveDraft();
      showToast('已将全部烟感与安防项设为 Working');
    });

    $('btnTakePhoto').addEventListener('click', () => {
      if (findNextFreePhotoSlot() === -1) {
        showToast('12 张照片位已满，可点击单张照片替换或删除');
        return;
      }
      pendingPhotoTargetSlot = null;
      $('cameraInput').value = '';
      $('cameraInput').click();
    });

    $('btnPickGallery').addEventListener('click', () => {
      if (findNextFreePhotoSlot() === -1) {
        showToast('12 张照片位已满，请先删除不需要的照片');
        return;
      }
      pendingPhotoTargetSlot = null;
      $('galleryInput').value = '';
      $('galleryInput').click();
    });

    $('cameraInput').addEventListener('change', (e) => {
      handleFilesSelected(e.target.files, pendingPhotoTargetSlot);
    });

    $('galleryInput').addEventListener('change', (e) => {
      handleFilesSelected(e.target.files, null);
    });

    $('slotFileInput').addEventListener('change', (e) => {
      handleFilesSelected(e.target.files, pendingPhotoTargetSlot);
    });

    $('photoGrid').addEventListener('click', (e) => {
      const rmBtn = e.target.closest('[data-remove-photo]');
      if (rmBtn) {
        const idx = Number(rmBtn.dataset.removePhoto);
        photos[idx] = { dataUrl: '', area: '', caption: '' };
        renderPhotoGrid();
        showToast(`已删除 Photo ${idx + 1}`);
        return;
      }
      const pickWrap = e.target.closest('[data-pick-slot]');
      if (pickWrap) {
        pendingPhotoTargetSlot = Number(pickWrap.dataset.pickSlot);
        $('slotFileInput').value = '';
        $('slotFileInput').click();
      }
    });

    $('photoGrid').addEventListener('change', (e) => {
      if (e.target.dataset.photoArea !== undefined) {
        photos[Number(e.target.dataset.photoArea)].area = e.target.value;
      }
      if (e.target.dataset.photoCaption !== undefined) {
        photos[Number(e.target.dataset.photoCaption)].caption = e.target.value;
      }
    });

    $('photoGrid').addEventListener('input', (e) => {
      if (e.target.dataset.photoCaption !== undefined) {
        photos[Number(e.target.dataset.photoCaption)].caption = e.target.value;
      }
    });

    $('btnToggleRes3').addEventListener('click', () => {
      const card = $('cardRes3');
      const willShow = card.classList.contains('hidden');
      card.classList.toggle('hidden', !willShow);
      $('btnToggleRes3').textContent = willShow ? '− 隐藏 Resident 3 签名栏' : '+ 添加 Resident 3 签名栏';
      if (willShow) {
        if (!$('res3Date').value) $('res3Date').value = formatUSDate(new Date());
        requestAnimationFrame(() => sigPads.Res3.resize());
      }
    });

    document.querySelector('main').addEventListener('change', saveDraft);
    document.querySelector('main').addEventListener('input', () => {
      clearTimeout(bindEvents._saveT);
      bindEvents._saveT = setTimeout(saveDraft, 400);
    });

    $('btnPreviewPdf').addEventListener('click', handlePreviewPdf);
    $('btnSubmitDrive').addEventListener('click', handleSubmitToDrive);

    $('btnResetForm').addEventListener('click', () => {
      if (!confirm('确定清空当前所有表单内容、照片和签名，开始检查下一个房间吗？')) return;
      localStorage.removeItem(STORAGE_DRAFT_KEY);
      window.location.reload();
    });

    $('btnOpenSettings').addEventListener('click', openSettingsModal);
    $('btnCloseSettings').addEventListener('click', closeSettingsModal);
    $('btnCancelSettings').addEventListener('click', closeSettingsModal);
    $('btnTestGas').addEventListener('click', testGasConnection);
    $('btnSaveSettings').addEventListener('click', () => {
      saveSettings({
        gasUrl: $('cfgGasUrl').value.trim(),
        pin: $('cfgPin').value.trim(),
        defaultEmail: $('cfgEmail').value.trim(),
        defaultStaff: $('cfgStaffName').value.trim()
      });
      applySmartDefaults();
      closeSettingsModal();
      showToast('设置已保存');
    });
  }

  function init() {
    renderCleanlinessSection();
    renderSecuritySection();
    renderKeysSection();
    renderPhotoGrid();
    initSignaturePads();
    bindEvents();

    const hadDraft = restoreDraft();
    applySmartDefaults();
    if (hadDraft) {
      showToast('已自动恢复上次未完成的文字草稿', 2200);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
