export function showToast(message: string, duration = 3000): void {
  const el = document.createElement('div');
  el.textContent = message;
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '32px',
    left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    background: 'rgba(53, 160, 67, 0.95)',
    color: '#fff',
    padding: '10px 24px',
    borderRadius: '20px',
    fontFamily: 'TTNorms, sans-serif',
    fontSize: '15px',
    fontWeight: '700',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    zIndex: '10000',
    opacity: '0',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    pointerEvents: 'none',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => el.remove(), 300);
  }, duration);
}
