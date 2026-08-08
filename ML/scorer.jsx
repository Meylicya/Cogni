
const SEVERITY_MIN = 0;
const SEVERITY_MAX = 6;


const SYMPTOM_CATEGORIES = {
  cognitive: ['concentration', 'memory', 'mentalFog'],
  physical: ['headache', 'dizziness', 'fatigue', 'lightNoiseSensitivity', 'nausea', 'balance'],
  emotional: ['irritability', 'lowMood', 'anxiety'],
  sleep: ['sleepChange', 'unrested'], // "sleeping more/less than usual" -> sleepChange, "unrested" -> unrested
  communication: ['wordFindingDifficulty', 'conversationSpeed'] // conditional
};


const CATEGORY_WEIGHTS = {
  cognitive: 1.5,
  physical: 1.5,
  emotional: 1.0,
  sleep: 1.0,
  communication: 1.0
};

function activeCategories(languageSymptomsFlagged) {
  return Object.keys(SYMPTOM_CATEGORIES).filter(
    cat => cat !== 'communication' || languageSymptomsFlagged
  );
}

/**
 * @param {Object} checkin 
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
    if (!(category in checkin)) {
      errors.push(`missing category "${category}"`);
      continue;
    }
    for (const item of SYMPTOM_CATEGORIES[category]) {
      const value = checkin[category]?.[item];
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < SEVERITY_MIN ||
        value > SEVERITY_MAX
      ) {
        errors.push(`${category}.${item} must be an integer between ${SEVERITY_MIN} and ${SEVERITY_MAX}, got ${value}`);
      }
    }
  }

  if (!languageSymptomsFlagged && checkin.communication) {
    errors.push('communication category was submitted but languageSymptomsFlagged is false - this patient was not flagged for language symptoms at intake');
  }

  for (const category of Object.keys(checkin)) {
    if (!(category in SYMPTOM_CATEGORIES)) {
      errors.push(`unknown category "${category}"`);
    }
  }

  return errors;
}


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
   * @param {Object} checkin 
   * @param {Object} opts 
   * @returns {{
   *   normalizedSeverity: number,       // 0-1, feed straight into ZPDEngine.setSymptomSeverity()
   *   byCategory: Object<string, number>, // 0-6 mean per active category
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
      const items = SYMPTOM_CATEGORIES[category];
      const mean = items.reduce((a, item) => a + record[category][item], 0) / items.length;
      byCategory[category] = Number(mean.toFixed(2));

      const weight = CATEGORY_WEIGHTS[category];
      weightedSum += mean * weight;
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
  SYMPTOM_CATEGORIES,
  CATEGORY_WEIGHTS,
  validateSymptomCheckin,
  createSymptomCheckin,
  SymptomCheckinScorer
};