const SEVERITY_MIN = 0;
const SEVERITY_MAX = 6;

const SCORE_FIELDS = {
  cognitive: 'cognitiveScore',
  physical: 'physicalScore',
  emotional: 'emotionalScore',
  sleep: 'sleepScore',
  communication: 'communicationScore'
};

const CATEGORY_WEIGHTS = {
  cognitive: 1.5,
  physical: 1.5,
  emotional: 1.0,
  sleep: 1.0,
  communication: 1.0
};

function activeCategories(languageSymptomsFlagged) {
  return Object.keys(SCORE_FIELDS).filter(
    cat => cat !== 'communication' || languageSymptomsFlagged
  );
}

function validateSymptomCheckin(checkin, { languageSymptomsFlagged }) {
  const errors = [];

  if (!checkin || typeof checkin !== 'object') {
    return ['checkin must be an object'];
  }

  const expectedCategories = activeCategories(languageSymptomsFlagged);

  for (const category of expectedCategories) {
    const field = SCORE_FIELDS[category];
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

  const communicationValue = checkin[SCORE_FIELDS.communication];
  if (!languageSymptomsFlagged && communicationValue !== undefined && communicationValue !== null) {
    errors.push('communicationScore was submitted but languageSymptomsFlagged is false - this patient was not flagged for language symptoms at intake');
  }

  const knownFields = new Set(Object.values(SCORE_FIELDS));
  for (const key of Object.keys(checkin)) {
    if (!knownFields.has(key)) {
      errors.push(`unknown field "${key}"`);
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

  score(checkin, opts) {
    const record = createSymptomCheckin(checkin, opts);
    const categories = activeCategories(record.languageSymptomsFlagged);

    const byCategory = {};
    let weightedSum = 0;
    let weightTotal = 0;

    for (const category of categories) {
      const value = record[SCORE_FIELDS[category]];
      byCategory[category] = Number(value.toFixed(2));

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
  SCORE_FIELDS,
  CATEGORY_WEIGHTS,
  validateSymptomCheckin,
  createSymptomCheckin,
  SymptomCheckinScorer
};
