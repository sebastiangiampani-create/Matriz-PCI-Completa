const ORIGINAL_FETCH = window.fetch.bind(window);

const CONTENT_PARTS = [
  'ciencias-naturales-01.json',
  'ciencias-naturales-02.json',
  'ciencias-naturales-03.json',
  'ciencias-sociales-01.json',
  'ciencias-sociales-02.json',
  'ciencias-sociales-03.json',
  'ciencias-sociales-04.json',
  'educacion-fisica-01.json',
  'educacion-fisica-02.json',
  'lengua-literatura.json',
  'matematica-01.json',
  'matematica-02.json',
  'matematica-03.json',
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
