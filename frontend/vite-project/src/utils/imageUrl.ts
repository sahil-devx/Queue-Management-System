export function getImageUrl(path?: string) {
  const apiBase = import.meta.env.VITE_API_URL || 'https://queue-system-backend.onrender.com/api';
  const origin = apiBase.replace(/\/api\/?$/, '');
  const normalized = path || '/uploads/default-avatar.svg';
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  return `${origin}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

