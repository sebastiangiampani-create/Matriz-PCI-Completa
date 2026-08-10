export const ART_LANGUAGES = ['Artes Visuales', 'Música', 'Teatro'];
export const ART_AXES = ['Producción', 'Apreciación', 'Contextualización'];

export const EF_NUCLEI = [
  { id: 'deportes-abiertos', label: 'Deportes abiertos' },
  { id: 'deportes-cerrados-atletismo', label: 'Deportes cerrados / Atletismo' },
  { id: 'gimnasia-expresiones', label: 'Gimnasia en sus diferentes expresiones' },
  { id: 'gimnasia-formacion-corporal', label: 'Gimnasia para la formación corporal' },
  { id: 'juegos', label: 'Juegos' },
];

export function normalizeCurriculumText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function artLanguageForContent(content) {
  const haystack = normalizeCurriculumText(`${content?.subject ?? ''} ${content?.axis ?? ''}`);
  if (haystack.includes('artes visuales') || haystack.includes('artes plasticas')) return 'Artes Visuales';
  if (haystack.includes('musica')) return 'Música';
  if (haystack.includes('teatro')) return 'Teatro';
  return null;
}

export function artAxisForContent(content) {
  const axis = normalizeCurriculumText(content?.axis);
  if (axis.includes('produccion')) return 'Producción';
  if (axis.includes('apreciacion')) return 'Apreciación';
  if (axis.includes('contextualizacion')) return 'Contextualización';
  return null;
}

export function efNucleusForContent(content) {
  const axis = normalizeCurriculumText(content?.axis);
  if (axis.includes('ambiente natural') || axis.includes('medio natural') || axis.includes('experiencias en la naturaleza')) {
    return 'ambiente-natural';
  }
  if (axis.includes('gimnasia para la formacion corporal')) return 'gimnasia-formacion-corporal';
  if (axis.includes('gimnasia en sus diferentes expresiones')) return 'gimnasia-expresiones';
  if (axis.includes('gimnasia') && (axis.includes('artistica') || axis.includes('ritmica') || axis.includes('expresiva'))) {
    return 'gimnasia-expresiones';
  }
  if (axis.includes('deportes abiertos')) return 'deportes-abiertos';
  if (axis.includes('deportes cerrados') || axis.includes('atletismo')) return 'deportes-cerrados-atletismo';
  if (axis.includes('juegos')) return 'juegos';
  return null;
}

function contentMap(data) {
  return new Map((data ?? []).map((content) => [String(content.id), content]));
}

export function evaluateArts(state, data) {
  const selectedLanguages = [...new Set(
    (state?.curriculumRules?.artLanguages ?? []).filter((language) => ART_LANGUAGES.includes(language)),
  )].slice(0, 2);
  const byId = contentMap(data);
  const groups = state?.areas?.Artes?.groups ?? [];

  const workshops = groups.map((group) => {
    const contents = (group.items ?? []).map((id) => byId.get(String(id))).filter(Boolean);
    const eligible = contents.filter((content) => selectedLanguages.includes(artLanguageForContent(content)));
    const axes = new Set(eligible.map(artAxisForContent).filter(Boolean));
    const missingAxes = ART_AXES.filter((axis) => !axes.has(axis));
    const unselectedLanguageItems = contents.filter((content) => {
      const language = artLanguageForContent(content);
      return language && !selectedLanguages.includes(language);
    });
    return {
      groupId: group.id,
      groupName: group.name,
      axes: [...axes],
      missingAxes,
      unselectedLanguageItems,
      complete: missingAxes.length === 0 && unselectedLanguageItems.length === 0,
    };
  });

  const completeWorkshops = workshops.filter((workshop) => workshop.complete).length;
  const unselectedAssignments = workshops.flatMap((workshop) => workshop.unselectedLanguageItems);
  return {
    selectedLanguages,
    totalWorkshops: groups.length,
    completeWorkshops,
    workshops,
    unselectedAssignments,
    complete: selectedLanguages.length === 2
      && groups.length > 0
      && completeWorkshops === groups.length
      && unselectedAssignments.length === 0,
  };
}

export function evaluatePhysicalEducation(state, data) {
  const byId = contentMap(data);
  const groups = state?.areas?.['Educación Física']?.groups ?? [];
  const mandatoryIds = new Set(EF_NUCLEI.map((nucleus) => nucleus.id));
  const covered = new Set();

  const workshops = groups.map((group) => {
    const nuclei = new Set();
    for (const id of group.items ?? []) {
      const content = byId.get(String(id));
      const nucleus = content ? efNucleusForContent(content) : null;
      if (mandatoryIds.has(nucleus)) {
        nuclei.add(nucleus);
        covered.add(nucleus);
      }
    }
    return {
      groupId: group.id,
      groupName: group.name,
      nuclei: [...nuclei],
      complete: nuclei.size > 0,
    };
  });

  const coveredNuclei = EF_NUCLEI.filter((nucleus) => covered.has(nucleus.id));
  const missingNuclei = EF_NUCLEI.filter((nucleus) => !covered.has(nucleus.id));
  const completeWorkshops = workshops.filter((workshop) => workshop.complete).length;
  return {
    totalWorkshops: groups.length,
    completeWorkshops,
    workshops,
    coveredNuclei,
    missingNuclei,
    complete: groups.length > 0
      && completeWorkshops === groups.length
      && missingNuclei.length === 0,
  };
}

export function isTutoriaContent(content) {
  return normalizeCurriculumText(content?.area) === 'tutoria'
    || normalizeCurriculumText(content?.subject) === 'tutoria';
}

export function isIndividuallyRequired(content) {
  const area = normalizeCurriculumText(content?.area);
  return area !== 'artes' && area !== 'educacion fisica';
}
