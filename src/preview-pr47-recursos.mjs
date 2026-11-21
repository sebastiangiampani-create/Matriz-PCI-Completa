/**
 * Resuelve recursos de la revisión con sus mismas copias locales.
 * Se aplica al ensamblar los embeds; los archivos originales de vendor no cambian.
 * No sustituye los enlaces a la licencia ni modifica contenidos curriculares.
 */
const RECURSOS = [
  ['https://raw.githubusercontent.com/sebastiangiampani-create/Matriz-PCI-Completa/main/assets/em-logo-header.svg', 'assets/em-logo-header.svg'],
  ['https://raw.githubusercontent.com/sebastiangiampani-create/Matriz-PCI-Completa/main/assets/em-logo-footer.svg', 'assets/em-logo-footer.svg'],
  ['https://raw.githubusercontent.com/sebastiangiampani-create/Matriz-PCI-Completa/main/assets/ministerio-footer.svg', 'assets/ministerio-footer.svg'],
  ['https://licensebuttons.net/l/by-nc-nd/4.0/88x31.png', 'assets/cc-by-nc-nd-88x31.png'],
  ['https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js', 'assets/exceljs-4.4.0.min.js'],
  ['https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js', 'assets/exceljs-4.4.0.min.js'],
  ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'assets/xlsx-0.18.5.full.min.js'],
];

export function localizarRecursosRevision(source, pageUrl) {
  let result = String(source);
  for (const [remote, local] of RECURSOS)
    result = result.replaceAll(remote, new URL(local, pageUrl).href);
  return result;
}
