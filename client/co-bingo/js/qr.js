/**
 * QR code generation wrapper around qrcode.js (loaded via CDN as global QRCode).
 */
export function generateQR(containerId, text) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (typeof QRCode === 'undefined') {
    container.textContent = 'QR 로드 실패';
    return;
  }

  new QRCode(container, {
    text,
    width: 180,
    height: 180,
    colorDark: '#0a0a1a',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });
}
