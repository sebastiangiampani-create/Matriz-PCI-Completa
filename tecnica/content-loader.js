const ORIGINAL_FETCH = window.fetch.bind(window);

const CONTENT_PARTS = [
  'ciencias-naturales.json',
  'ciencias-sociales.json',
  'educacion-fisica.json',
  'lengua-literatura.json',
  'matematica.json',
  'educacion-artistica.json',
  'talleres.json',
  'tecnologia-representacion.json',
];

function isTechnicalContentsRequest(input) {
  const raw = typeof input === 'string' ? input : input?.url;
  if (!raw) return false;
  try {
    const url = new URL(raw, window.location.href);
    return url.pathname.endsWith('/tecnica/data/contents.json');
  } catch {
    return String(raw).includes('data/contents.json');
  }
}

window.fetch = async function technicalContentFetch(input, init) {
  if (!isTechnicalContentsRequest(input)) return ORIGINAL_FETCH(input, init);

  const chunks = await Promise.all(CONTENT_PARTS.map(async (filename) => {
    const response = await ORIGINAL_FETCH(`./data/${filename}`, { ...init, cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo cargar ${filename}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }));

  return new Response(JSON.stringify(chunks.flat()), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
