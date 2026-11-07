// A card can have rhyme-book or manuscript evidence without a reconstructed reading.
/** @param {{ readings: unknown[], rhymeClass: string, spelling: string,
 *   hands?: { tibetan?: unknown[], sanskrit?: unknown[] }, glosses: unknown[] }} data */
export const hasCardReadings = ({ readings, rhymeClass, spelling, hands, glosses }) =>
  Boolean(readings.length || rhymeClass || spelling || hands?.tibetan?.length || hands?.sanskrit?.length || glosses.length)
