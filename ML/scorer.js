/**
 * scorer.js
 *
 * Rewritten to match the check-in shape actually persisted by the API/DB
 * layer (symptomCheckins.js + Symptomcheckin.js): one pre-aggregated 0-6
 * score per category, not per-item breakdowns.
 *
 *   { cognitiveScore, physicalScore, emotionalScore, sleepScore, communicationScore }
 *
 * The previous version of this file expected each category to be an
 * object of individually-scored items (e.g. cognitive.concentration,
 * cognitive.memory, cognitive.mentalFog) and averaged those into a
 * per-category mean itself. That per-item detail was never actually
 * collected anywhere in this codebase — the DB model only ever stored
 * one number per category — so that averaging step served no purpose
 * here and has been removed rather than faked.
 *
 * Everything downstream of "one number per category" is unchanged:
 * same category weights, same baseline/worsening-vs-baseline logic,
 * same 0-1 normalizedSeverity output that feeds
 * ZPDEngine.setVoiceHesitation()'s sibling, setSymptomSeverity().
 */

const SEVERITY_MIN = 0;
const SEVERITY_MAX = 6;

// Maps each category to the field name it actually arrives as, matching
// Symptomcheckin.js's schema field names exactly.
const CATEGORY_FIELDS = {
  cognitive: 'cognitiveScore',
  physical: 'physicalScore',
  emotional: 'emotionalScore',
  sleep: 'sleepScore',
  communication: 'communicationScore' // conditional — only when languageSymptomsFlagged
};

const CATEGORY_WEIGHTS = {
  cognitive: 1.5,
  physical: 1.5,
  emotional: 1.0,
  sleep: 1.0,
  communication: 1.0
};

function activeCategories(languageSymptomsFlagged) {
  return Object.keys(CATEGORY_FIELDS).filter(
    cat => cat !== 'communication' || languageSymptomsFlagged
  );
}

/**
 * @param {Object} checkin - shape from symptomCheckins.js's req.body /
 *   Symptomcheckin.js's document: { cognitiveScore, physicalScore,
 *   emotionalScore, sleepScore, communicationScore }
 * @param {Object} opts
 * @param {boolean} opts.languageSymptomsFlagged
 * @returns {string[]}
 **/
function validateSymptomCheckin(checkin, { languageSymptomsFlagged }) {
  const errors = [];

  if (!checkin || typeof checkin !== 'object') {
    return ['checkin must be an object'];
  }

  const expectedCategories = activeCategories(languageSymptomsFlagged);

  for (const category of expectedCategories) {
    const field = CATEGORY_FIELDS[category];
    const value = checkin[field];
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < SEVERITY_MIN ||
      value > SEVERITY_MAX
    ) {
      errors.push(`${field} must be an integer between ${SEVERITY_MIN} and ${SEVERITY_MAX}, got ${value}`);
    }
  }

  // Mirrors Symptomcheckin.js's own contract: communicationScore only
  // makes sense when the patient was flagged for language symptoms.
  const hasCommunicationScore =
    checkin.communicationScore !== null && checkin.communicationScore !== undefined;
  if (!languageSymptomsFlagged && hasCommunicationScore) {
    errors.push(
      'communicationScore was submitted but languageSymptomsFlagged is false - this patient was not flagged for language symptoms at intake'
    );
  }

  return errors;
}

/**
 * Constructs a validated, frozen check-in record. Same "fail loud, fail
 * at construction time" contract the previous version had.
 */
function createSymptomCheckin(checkin, { languageSymptomsFlagged, timestamp = Date.now() } = {}) {
  const errors = validateSymptomCheckin(checkin, { languageSymptomsFlagged });
  if (errors.length > 0) {
    throw new Error(`Invalid symptom check-in: ${errors.join('; ')}`);
  }
  return Object.freeze({
    ...JSON.parse(JSON.stringify(checkin)),
    languageSymptomsFlagged: Boolean(languageSymptomsFlagged),
    timestamp
  });
}

class SymptomCheckinScorer {
  constructor({ baselineWindowSize = 7, worseningMargin = 0.15 } = {}) {
    this.baselineWindowSize = baselineWindowSize;
    this.worseningMargin = worseningMargin;
    this.history = [];
  }

  /**
   * @param {Object} checkin - { cognitiveScore, physicalScore,
   *   emotionalScore, sleepScore, communicationScore } as persisted by
   *   symptomCheckins.js
   * @param {Object} opts
   * @param {boolean} opts.languageSymptomsFlagged
   * @returns {{
   *   normalizedSeverity: number,       // 0-1, feed straight into ZPDEngine.setSymptomSeverity()
   *   byCategory: Object<string, number>, // 0-6 score per active category
   *   baseline: number|null,            // mean of prior check-ins, null if not enough history yet
   *   worseningVsBaseline: boolean
   * }}
   */
  score(checkin, opts) {
    const record = createSymptomCheckin(checkin, opts);
    const categories = activeCategories(record.languageSymptomsFlagged);

    const byCategory = {};
    let weightedSum = 0;
    let weightTotal = 0;

    for (const category of categories) {
      const field = CATEGORY_FIELDS[category];
      const value = record[field];
      byCategory[category] = value;

      const weight = CATEGORY_WEIGHTS[category];
      weightedSum += value * weight;
      weightTotal += weight;
    }

    const weightedMean = weightedSum / weightTotal;
    const normalizedSeverity = weightedMean / SEVERITY_MAX;

    const baseline = this.history.length > 0
      ? this.history.reduce((a, v) => a + v, 0) / this.history.length
      : null;

    const worseningVsBaseline = baseline !== null && normalizedSeverity >= baseline + this.worseningMargin;

    this.history.push(normalizedSeverity);
    while (this.history.length > this.baselineWindowSize) this.history.shift();

    return {
      normalizedSeverity: Number(normalizedSeverity.toFixed(3)),
      byCategory,
      baseline: baseline !== null ? Number(baseline.toFixed(3)) : null,
      worseningVsBaseline
    };
  }
}

export {
  SEVERITY_MIN,
  SEVERITY_MAX,
  CATEGORY_FIELDS,
  CATEGORY_WEIGHTS,
  validateSymptomCheckin,
  createSymptomCheckin,
  SymptomCheckinScorer
};