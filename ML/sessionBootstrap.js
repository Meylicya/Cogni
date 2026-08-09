import { getPatientSessionContext } from './patientSessionContext.js';
import { ZPDEngine } from './zpdEngine.js';
import { SymptomCheckinScorer } from './scorer.js';

git 
async function startPatientSession(patientId) {
  const { difficultyTier, languageSymptomsFlagged } = await getPatientSessionContext(patientId);

  const zpdEngine = new ZPDEngine({
    startingTier: difficultyTier
    
  });

  const symptomScorer = new SymptomCheckinScorer();

  return { zpdEngine, symptomScorer, languageSymptomsFlagged };
}

export { startPatientSession };