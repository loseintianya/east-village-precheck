/**
 * East Village Move-In Pre-Check PDF Filler (New 5-Page Template)
 * 使用 pdf-lib 在浏览器端回填新版 5 页 AcroForm PDF，嵌入现场照片与手写签名，并压平归档。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('pdf-lib'));
  } else {
    root.EVPdfFiller = factory(root.PDFLib);
  }
}(typeof self !== 'undefined' ? self : this, function (PDFLib) {
  const PHOTO_SLOTS = [
    // Page 3 (index 2) — Photo Appendix Part 1 of 2
    { num: 1, pageIndex: 2, rect: [41, 487, 298, 634] },
    { num: 2, pageIndex: 2, rect: [314, 487, 571, 634] },
    { num: 3, pageIndex: 2, rect: [41, 287, 298, 434] },
    { num: 4, pageIndex: 2, rect: [314, 287, 571, 434] },
    { num: 5, pageIndex: 2, rect: [41, 87, 298, 234] },
    { num: 6, pageIndex: 2, rect: [314, 87, 571, 234] },
    // Page 4 (index 3) — Photo Appendix Part 2 of 2
    { num: 7, pageIndex: 3, rect: [41, 487, 298, 634] },
    { num: 8, pageIndex: 3, rect: [314, 487, 571, 634] },
    { num: 9, pageIndex: 3, rect: [41, 287, 298, 434] },
    { num: 10, pageIndex: 3, rect: [314, 287, 571, 434] },
    { num: 11, pageIndex: 3, rect: [41, 87, 298, 234] },
    { num: 12, pageIndex: 3, rect: [314, 87, 571, 234] }
  ];

  // Page 5 (index 4) — Key Handoff Acknowledgment & Signature
  const SIGNATURE_RECTS = {
    Res1_Signature: { pageIndex: 4, rect: [292, 535.8, 474, 553.8] },
    Res2_Signature: { pageIndex: 4, rect: [292, 512.8, 474, 530.8] },
    Res3_Signature: { pageIndex: 4, rect: [292, 489.8, 474, 507.8] },
    Mgmt_Signature: { pageIndex: 4, rect: [179.5, 412.3, 302, 426.3] }
  };

  function normalizeText(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00A0/g, ' ')
      .trim();
  }

  function isWinAnsiSafe(str) {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code === 10 || code === 13 || code === 9) continue;
      if (code < 0x20 || code > 0xFF) return false;
    }
    return true;
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    if (typeof atob === 'function') {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  function renderUnicodeTextToPng(text, widthPt, heightPt, isMultiline) {
    if (typeof document === 'undefined') return null;
    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(10, Math.round(widthPt * scale));
    canvas.height = Math.max(10, Math.round(heightPt * scale));
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, widthPt, heightPt);
    ctx.fillStyle = '#162226';

    const fontSize = isMultiline ? 8.5 : Math.min(9.5, Math.max(7.5, heightPt * 0.56));
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif`;
    ctx.textBaseline = 'top';

    const padX = 3;
    const padY = isMultiline ? 3 : Math.max(2, (heightPt - fontSize) / 2 - 0.5);
    const maxW = widthPt - padX * 2;
    const lineH = fontSize * 1.3;

    if (!isMultiline) {
      ctx.fillText(text, padX, padY, maxW);
    } else {
      const paragraphs = text.split(/\r?\n/);
      let y = padY;
      for (const para of paragraphs) {
        let line = '';
        for (const ch of para) {
          const test = line + ch;
          if (ctx.measureText(test).width > maxW && line.length > 0) {
            ctx.fillText(line, padX, y);
            y += lineH;
            line = ch;
            if (y + fontSize > heightPt - 1) break;
          } else {
            line = test;
          }
        }
        if (line && y + fontSize <= heightPt - 1) {
          ctx.fillText(line, padX, y);
          y += lineH;
        }
        if (y + fontSize > heightPt - 1) break;
      }
    }

    return dataUrlToBytes(canvas.toDataURL('image/png'));
  }

  function getFieldRectAndPage(pdfDoc, field) {
    const widgets = field.acroField.getWidgets();
    if (!widgets || widgets.length === 0) return null;
    const widget = widgets[0];
    const rectObj = widget.getRectangle();
    const pages = pdfDoc.getPages();
    const pRef = widget.P();
    let pageIndex = 0;
    if (pRef) {
      const idx = pages.findIndex((p) => p.ref === pRef);
      if (idx >= 0) pageIndex = idx;
    }
    return {
      pageIndex,
      rect: [rectObj.x, rectObj.y, rectObj.x + rectObj.width, rectObj.y + rectObj.height]
    };
  }

  async function fillMoveInPdf(templateBytes, data) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.load(templateBytes);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();
    const unicodeOverlays = [];

    function setText(fieldName, value, isMultiline = false, fontSize = null) {
      const str = normalizeText(value);
      if (!str) return;
      try {
        const tf = form.getTextField(fieldName);
        if (isWinAnsiSafe(str)) {
          let size = fontSize !== null ? fontSize : (isMultiline ? 8.8 : 9.5);
          if (!isMultiline) {
            const info = getFieldRectAndPage(pdfDoc, tf);
            if (info) {
              const availW = (info.rect[2] - info.rect[0]) - 6;
              if (availW > 10) {
                const textW = helvetica.widthOfTextAtSize(str, size);
                if (textW > availW) {
                  size = Math.max(6.2, Number((size * (availW / textW)).toFixed(2)));
                }
              }
            }
          }
          tf.acroField.setDefaultAppearance(`/Helv ${size} Tf 0.09 0.13 0.15 rg`);
          tf.setText(str);
          tf.updateAppearances(helvetica);
        } else {
          const info = getFieldRectAndPage(pdfDoc, tf);
          tf.setText('');
          if (info) {
            unicodeOverlays.push({
              pageIndex: info.pageIndex,
              rect: info.rect,
              text: str,
              isMultiline
            });
          }
        }
      } catch (e) {
        console.warn('Skip text field:', fieldName, e.message);
      }
    }

    function setRadio(fieldName, optionValue) {
      if (!optionValue) return;
      try {
        form.getRadioGroup(fieldName).select(optionValue);
      } catch (e) {
        console.warn('Skip radio field:', fieldName, optionValue, e.message);
      }
    }

    function setCheckbox(fieldName, checked) {
      try {
        const cb = form.getCheckBox(fieldName);
        if (checked) cb.check();
        else cb.uncheck();
      } catch (e) {
        console.warn('Skip checkbox:', fieldName, e.message);
      }
    }

    // 1. Unit header synced across all 5 pages
    const unit = normalizeText(data.unit);
    for (let p = 1; p <= 5; p++) {
      setText(`Hdr_Unit_P${p}`, unit, false, 11);
    }

    // 2. Resident initials synced across all 5 pages
    const initials = normalizeText(data.residentInitials);
    for (let p = 1; p <= 5; p++) {
      setText(`P${p}_Initials`, initials, false, 10);
    }

    // 3. Page 1 Header & Resident Info
    setRadio('Property', data.property);
    setRadio('Floor_Plan', data.floorPlan);
    if (data.floorPlan === 'Other') {
      setText('Floor_Plan_Other', data.floorPlanOther);
    }
    setText('Key_Handoff_Date_Time', data.keyHandoffDateTime);
    setText('Supplement_Deadline_Date_Time', data.supplementDeadlineDateTime);
    setText('PreCheck_Inspector_Date', data.preCheckInspectorDate);
    setText('Resident1_Full_Name', data.resident1FullName);
    setText('Resident1_Phone', data.resident1Phone);
    setText('Designated_Email', data.designatedEmail);
    setText('Other_Adult_Residents', data.otherAdultResidents);

    // 4. Page 1 Section 1: Cleanliness, Odor & General Condition (4 items)
    for (let i = 1; i <= 4; i++) {
      const item = (data.cleanliness && data.cleanliness[`C${i}`]) || {};
      setRadio(`PC_C${i}`, item.status);
      setText(`C${i}_Mgmt_Note`, item.mgmtNote);
      setText(`C${i}_Resident_Comments`, item.residentComments);
    }

    // 5. Page 1 Section 2: Smoke Alarms & Security Devices (5 items)
    for (let i = 1; i <= 5; i++) {
      const item = (data.security && data.security[`S${i}`]) || {};
      setRadio(`S${i}_Status`, item.status);
      setText(`S${i}_Date_Note`, item.dateNote);
    }

    // 6. Page 2 Section 3: Keys, Remotes & Access Devices
    for (let i = 1; i <= 3; i++) {
      const k = (data.keys && data.keys[`K${i}`]) || {};
      setText(`K${i}_Qty_Issued`, k.qty);
      setText(`K${i}_Notes`, k.notes);
    }

    // 7. Page 2 Section 4: Additional Notes & Supplement Email
    setText('Handoff_Additional_Notes', data.handoffAdditionalNotes, true, 8.8);
    setText('Submission_Email', data.submissionEmail);

    const photos = Array.isArray(data.photos) ? data.photos : [];
    const attachedPhotoCount = photos.filter((p) => p && p.dataUrl).length;
    setText('Total_Mgmt_Photos', String(attachedPhotoCount));

    // 8. Pages 3-4: Photo Metadata Fields
    setText('Photos_Taken_Date_P3', data.photosTakenDate, false, 8.5);
    setText('Photos_Taken_By_P3', data.photosTakenBy, false, 8.5);
    setText('Photos_Taken_Date_P4', data.photosTakenDate, false, 8.5);
    setText('Photos_Taken_By_P4', data.photosTakenBy, false, 8.5);

    for (let i = 0; i < 12; i++) {
      const p = photos[i];
      if (!p) continue;
      const num = String(i + 1).padStart(2, '0');
      setText(`Photo_${num}_Area`, p.area, false, 8);
      setText(`Photo_${num}_Caption`, p.caption, false, 8);
    }

    // 9. Page 5 Section 5: Acknowledgment & Signatures
    setCheckbox('Notice_Email_Designation', !!data.noticeEmailDesignation);

    const sigs = data.signatures || {};
    const sigImagesToDraw = [];

    ['Res1', 'Res2', 'Res3'].forEach((key) => {
      const s = sigs[key] || {};
      setText(`${key}_Printed_Name`, s.printedName);
      setText(`${key}_Date`, s.date);
      if (s.mode === 'draw' && s.imageDataUrl) {
        sigImagesToDraw.push({
          ...SIGNATURE_RECTS[`${key}_Signature`],
          dataUrl: s.imageDataUrl
        });
      } else if (s.typedName) {
        setText(`${key}_Signature`, s.typedName);
      }
    });

    const mgmtSig = sigs.Mgmt || {};
    setText('Mgmt_Staff_Name', mgmtSig.staffName, false, 8.5);
    setText('Mgmt_Date_Time', mgmtSig.dateTime, false, 8.5);
    setText('Mgmt_Photo_Set_Ref', mgmtSig.photoSetRef, false, 8.5);
    if (mgmtSig.mode === 'draw' && mgmtSig.imageDataUrl) {
      sigImagesToDraw.push({
        ...SIGNATURE_RECTS.Mgmt_Signature,
        dataUrl: mgmtSig.imageDataUrl
      });
    } else if (mgmtSig.typedName) {
      setText('Mgmt_Signature', mgmtSig.typedName, false, 8.5);
    }

    // 10. Flatten AcroForm so all viewers render fields identically
    form.flatten();

    // 11. Draw Unicode text overlays (if any non-Latin text was typed in notes)
    for (const ov of unicodeOverlays) {
      const [x0, y0, x1, y1] = ov.rect;
      const w = x1 - x0;
      const h = y1 - y0;
      const pngBytes = renderUnicodeTextToPng(ov.text, w, h, ov.isMultiline);
      if (!pngBytes) continue;
      const img = await pdfDoc.embedPng(pngBytes);
      pages[ov.pageIndex].drawImage(img, { x: x0, y: y0, width: w, height: h });
    }

    // 12. Draw Hand-Drawn Signatures cleanly inside Page 5 signature boxes
    for (const sig of sigImagesToDraw) {
      try {
        const pngBytes = dataUrlToBytes(sig.dataUrl);
        const pngImage = await pdfDoc.embedPng(pngBytes);
        const [x0, y0, x1, y1] = sig.rect;
        const boxW = x1 - x0 - 4;
        const boxH = y1 - y0 - 2;
        const scale = Math.min(boxW / pngImage.width, boxH / pngImage.height);
        const drawW = pngImage.width * scale;
        const drawH = pngImage.height * scale;
        const drawX = x0 + 2 + (boxW - drawW) / 2;
        const drawY = y0 + 1 + (boxH - drawH) / 2;
        pages[sig.pageIndex].drawImage(pngImage, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH
        });
      } catch (e) {
        console.warn('Failed to embed signature PNG:', e);
      }
    }

    // 13. Draw Attached Photos into Pages 3-4 (covering placeholder camera icon cleanly)
    for (let i = 0; i < 12; i++) {
      const p = photos[i];
      if (!p || !p.dataUrl) continue;
      const slot = PHOTO_SLOTS[i];
      const page = pages[slot.pageIndex];
      const [x0, y0, x1, y1] = slot.rect;
      const frameW = x1 - x0;
      const frameH = y1 - y0;

      page.drawRectangle({
        x: x0 + 0.5,
        y: y0 + 0.5,
        width: frameW - 1,
        height: frameH - 1,
        color: rgb(0.96, 0.975, 0.98)
      });

      try {
        const imgBytes = dataUrlToBytes(p.dataUrl);
        const isPng = p.dataUrl.startsWith('data:image/png');
        const embedded = isPng
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes);

        const pad = 2;
        const availW = frameW - pad * 2;
        const availH = frameH - pad * 2;
        const scale = Math.min(availW / embedded.width, availH / embedded.height);
        const drawW = embedded.width * scale;
        const drawH = embedded.height * scale;
        const drawX = x0 + pad + (availW - drawW) / 2;
        const drawY = y0 + pad + (availH - drawH) / 2;

        page.drawImage(embedded, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH
        });
      } catch (e) {
        console.warn(`Failed to embed Photo ${i + 1}:`, e);
      }
    }

    return pdfDoc.save();
  }

  return {
    fillMoveInPdf,
    PHOTO_SLOTS,
    SIGNATURE_RECTS
  };
}));
