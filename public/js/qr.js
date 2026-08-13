(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function qrDataUrl(text) {
    if (typeof window.qrcode !== 'function') return null;
    var qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(8, 2);
  }

  function renderQR(container, text, size) {
    if (typeof window.qrcode !== 'function') {
      container.innerHTML = '<span class="text-muted">QR unavailable</span>';
      return;
    }
    size = size || 220;
    var url = qrDataUrl(text);
    var img = container.querySelector('img.qr-img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'qr-img';
      img.alt = 'QR Code';
      container.appendChild(img);
    }
    img.src = url;
    img.width = size;
    img.height = size;
    container.dataset.qrUrl = url;
    container.dataset.qrText = text;
  }

  // Landscape label for 24mm (1") tape: 70mm long (along the tape) x 24mm high
  // (tape width). Page size matches the label exactly so it prints edge-to-edge.
  // opts: { qrUrl, tag, descr, agreement, vendor, labelAgreement, labelVendor, title }
  function labelHTML(opts, isLast) {
    var e = escapeHtml;
    return '<div class="label"' + (isLast ? '' : ' style="page-break-after: always; break-after: page;"') + '>' +
      '<div class="text">' +
      '<div class="tag">' + e(opts.tag || '') + '</div>' +
      '<div class="descr">' + e(opts.descr || '') + '</div>' +
      '<div class="meta">' +
      '<div><span>' + e(opts.labelAgreement || '') + ':</span> ' + e(opts.agreement || '') + '</div>' +
      '<div><span>' + e(opts.labelVendor || '') + ':</span> ' + e(opts.vendor || '') + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="qrw"><img src="' + opts.qrUrl + '"></div>' +
      '</div>';
  }

  function openLabelWindow(items, docTitle) {
    var e = escapeHtml;
    var html =
      '<html><head><meta charset="utf-8"><title>' + e(docTitle || '') + '</title>' +
      '<style>' +
      '@page { size: 70mm 24mm; margin: 0; }' +
      'html, body { margin: 0; padding: 0; }' +
      'body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
      '.label { box-sizing: border-box; width: 70mm; height: 24mm; background: #ffffff; color: #000; ' +
      'border: 0.6pt solid #000; display: flex; align-items: stretch; gap: 1.5mm; padding: 1.5mm; ' +
      'overflow: hidden; page-break-inside: avoid; break-inside: avoid; }' +
      '.text { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }' +
      '.tag { font-size: 10pt; font-weight: bold; line-height: 1.05; word-break: break-all; }' +
      '.descr { font-size: 7pt; margin-top: 0.6mm; line-height: 1.15; overflow: hidden; ' +
      'display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-all; }' +
      '.meta { font-size: 6.5pt; margin-top: 0.6mm; line-height: 1.2; word-break: break-all; }' +
      '.meta div { margin: 0; }' +
      '.meta span { font-weight: bold; }' +
      '.qrw { width: 17mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center; ' +
      'background: #fff; border: 0.4pt solid #ccc; }' +
      '.qrw img { width: 16mm; height: 16mm; }' +
      '</style></head><body>' +
      items.map(function (o, i) { return labelHTML(o, i === items.length - 1); }).join('') +
      '<scr' + 'ipt>window.onload=function(){window.print()}</scr' + 'ipt></body></html>';
    var w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }

  function printLabel(opts) {
    if (!opts.qrUrl) return;
    openLabelWindow([opts], opts.title || '');
  }

  function printLabels(items) {
    if (!items || items.length === 0) return;
    openLabelWindow(items, items.length + ' labels');
  }

  window.renderQR = renderQR;
  window.qrDataUrl = qrDataUrl;
  window.printLabel = printLabel;
  window.printLabels = printLabels;
  window.qrEscape = escapeHtml;
})();
