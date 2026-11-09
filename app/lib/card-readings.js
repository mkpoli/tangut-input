// A card can have rhyme-book or manuscript evidence without a reconstructed reading.
/** @param {{ readings: unknown[], keyed?: unknown[], rhymeClass: string, spelling: string,
 *   hands?: { tibetan?: unknown[], sanskrit?: unknown[] }, glosses: unknown[] }} data */
export const hasCardReadings = ({ readings, keyed = [], rhymeClass, spelling, hands, glosses }) =>
  Boolean(readings.length || keyed.length || rhymeClass || spelling || hands?.tibetan?.length || hands?.sanskrit?.length || glosses.length)
