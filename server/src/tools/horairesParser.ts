export type ParsedHoraire = {
  days: number[]; // 0 = Lundi, 1 = Mardi, ..., 6 = Dimanche
  hours: { from: string; to: string }[];
};

const dayMap: { [key: string]: number } = {
  // Français
  lu: 0,
  lun: 0,
  lundi: 0,
  ma: 1,
  mar: 1,
  mardi: 1,
  me: 2,
  mer: 2,
  mercredi: 2,
  je: 3,
  jeu: 3,
  jeudi: 3,
  ve: 4,
  ven: 4,
  vendredi: 4,
  sa: 5,
  sam: 5,
  samedi: 5,
  di: 6,
  dim: 6,
  dimanche: 6,
  // Anglais
  mo: 0,
  mon: 0,
  tu: 1,
  tue: 1,
  we: 2,
  wed: 2,
  th: 3,
  thu: 3,
  fr: 4,
  fri: 4,
  sat: 5,
  su: 6,
  sun: 6,
};

function parseDayRange(rangeStr: string): number[] {
  const days: number[] = [];
  const parts = rangeStr.split("-");
  if (parts.length === 2) {
    const startDay = dayMap[parts[0].trim().toLowerCase()];
    const endDay = dayMap[parts[1].trim().toLowerCase()];
    if (startDay !== undefined && endDay !== undefined && startDay <= endDay) {
      for (let i = startDay; i <= endDay; i++) {
        days.push(i);
      }
    }
  }
  return days;
}

/**
 * Prend un tableau potentiellement "sale" de règles d'horaires et le nettoie.
 * - Regroupe les règles qui s'appliquent aux mêmes jours.
 * - Fusionne les plages horaires qui se chevauchent ou sont adjacentes.
 * - Supprime les plages horaires en double.
 * @param schedules Le tableau de ParsedHoraire brut.
 * @returns Un tableau de ParsedHoraire propre et consolidé.
 */
function consolidateParsedSchedules(
  schedules: ParsedHoraire[],
): ParsedHoraire[] {
  if (!schedules || schedules.length === 0) {
    return [];
  }

  // Étape 1: Regrouper toutes les heures par ensemble de jours unique.
  const scheduleMap = new Map<string, { from: string; to: string }[]>();

  for (const schedule of schedules) {
    const dayKey = schedule.days.join(",");
    const existingHours = scheduleMap.get(dayKey);

    if (existingHours) {
      // Si un tableau d'heures existe déjà pour ces jours, on y ajoute les nouvelles heures.
      existingHours.push(...schedule.hours);
    } else {
      // Sinon, on crée une nouvelle entrée avec une copie des heures.
      // On utilise [...schedule.hours] pour créer une copie et éviter les mutations inattendues.
      scheduleMap.set(dayKey, [...schedule.hours]);
    }
  }

  const consolidatedResult: ParsedHoraire[] = [];

  // Étape 2: Pour chaque ensemble de jours, nettoyer et fusionner les plages horaires.
  for (const [dayKey, allHours] of scheduleMap.entries()) {
    // Supprimer les doublons exacts en convertissant en chaîne de caractères
    const uniqueHours = Array.from(
      new Set(allHours.map((h) => JSON.stringify(h))),
    ).map((s) => JSON.parse(s));

    // Trier les plages par heure de début
    uniqueHours.sort((a, b) => a.from.localeCompare(b.from));

    if (uniqueHours.length === 0) continue;

    const mergedHours: { from: string; to: string }[] = [];
    let currentMerge = { ...uniqueHours[0] };

    for (let i = 1; i < uniqueHours.length; i++) {
      const nextSlot = uniqueHours[i];
      // Si la plage suivante commence avant ou au moment où la plage actuelle se termine,
      // il y a un chevauchement ou une contiguïté.
      if (nextSlot.from <= currentMerge.to) {
        // On étend la plage de fusion pour couvrir jusqu'à la fin la plus tardive.
        if (nextSlot.to > currentMerge.to) {
          currentMerge.to = nextSlot.to;
        }
      } else {
        // Pas de chevauchement, la fusion actuelle est terminée.
        mergedHours.push(currentMerge);
        currentMerge = { ...nextSlot };
      }
    }
    // Ajouter la dernière plage fusionnée
    mergedHours.push(currentMerge);

    consolidatedResult.push({
      days: dayKey.split(",").map(Number),
      hours: mergedHours,
    });
  }

  return consolidatedResult;
}

/**
 * Analyse une chaîne de caractères d'horaires complexe et la transforme
 * en un tableau d'objets structurés.
 */
export function parseHoraires(
  horairesStr: string | null | undefined,
): ParsedHoraire[] | null {
  if (typeof horairesStr !== "string" || !horairesStr) {
    return null;
  }

  let normalizedStr = horairesStr.trim().toLowerCase();

  // --- DÉBUT DE LA LOGIQUE D'HARMONISATION ---
  const fullDaySchedule: ParsedHoraire[] = [
    {
      days: [0, 1, 2, 3, 4, 5, 6],
      hours: [{ from: "00:00", to: "24:00" }],
    },
  ];

  if (normalizedStr === "24/7" || normalizedStr.includes("24h/24")) {
    return fullDaySchedule;
  }

  const fullDayRegex = /(00:00|0:00)\s*-\s*(23:59|00:00|0:00)/;
  if (fullDayRegex.test(normalizedStr)) {
    return fullDaySchedule;
  }

  const almostFullDayRegex =
    /(lu|lun|lundi|mo|mon)[\s-.,]+(di|dim|dimanche|su|sun)[\s-.,]*(\d{1,2}:\d{2})[\s-]*(\d{1,2}:\d{2})/;
  const almostMatch = normalizedStr.match(almostFullDayRegex);

  if (almostMatch) {
    const fromTime = almostMatch[3];
    const toTime = almostMatch[4];
    const toMinutes =
      Number.parseInt(toTime.split(":")[0], 10) * 60 +
      Number.parseInt(toTime.split(":")[1], 10);

    if (fromTime === "00:00" && toMinutes >= 1430) {
      return fullDaySchedule;
    }
  }
  // --- FIN DE LA LOGIQUE D'HARMONISATION ---

  normalizedStr = normalizedStr.replace(/–/g, "-");
  normalizedStr = normalizedStr.replace(/\s+/g, " ");
  normalizedStr = normalizedStr.replace(/h/g, ":");

  const rules = normalizedStr.split(/;/).filter((r) => r.trim() !== "");
  const result: ParsedHoraire[] = [];

  for (const rule of rules) {
    const timeMatches = [...rule.matchAll(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/g)];
    if (timeMatches.length === 0) continue;

    const hours = timeMatches.map((m) => ({ from: m[1], to: m[2] }));
    const dayPartStr = rule.substring(0, timeMatches[0].index).trim();
    const days: number[] = [];
    const dayGroups = dayPartStr.split(",").map((g) => g.trim());

    for (const group of dayGroups) {
      if (group.includes("-")) {
        days.push(...parseDayRange(group));
      } else {
        const dayIndex = dayMap[group];
        if (dayIndex !== undefined) {
          days.push(dayIndex);
        }
      }
    }

    if (days.length > 0) {
      const uniqueSortedDays = [...new Set(days)].sort((a, b) => a - b);
      result.push({
        days: uniqueSortedDays,
        hours: hours,
      });
    }
  }

  if (result.length === 0) {
    const isAlreadyHandled =
      normalizedStr.includes("24/7") ||
      normalizedStr.includes("24h/24") ||
      fullDayRegex.test(normalizedStr) ||
      (almostMatch &&
        almostMatch[3] === "00:00" &&
        Number.parseInt(almostMatch[4].split(":")[0], 10) * 60 +
          Number.parseInt(almostMatch[4].split(":")[1], 10) >=
          1430);

    if (!isAlreadyHandled) {
      console.warn(
        `Impossible de parser la chaîne d'horaires: "${horairesStr}"`,
      );
    }
    return null;
  }

  // On passe le résultat brut dans notre nouvelle fonction de nettoyage avant de le retourner.
  return consolidateParsedSchedules(result);
}
