function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCapturedValue(value) {
  return normalizeText(value)
    .replace(/^[,:-]\s*/, '')
    .replace(/[.,]$/, '')
    .trim();
}

function toTitleCase(value) {
  return normalizeText(value)
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function collapseAdjacentDuplicateWords(value) {
  const words = normalizeText(value).split(' ').filter(Boolean);
  const compact = [];

  words.forEach((word) => {
    const lastWord = compact[compact.length - 1];
    if (lastWord && lastWord.toLowerCase() === word.toLowerCase()) {
      return;
    }
    compact.push(word);
  });

  return compact.join(' ');
}

function findFirstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return cleanCapturedValue(match[1]);
    }
  }

  return '';
}

function splitTranscriptIntoParts(text) {
  return normalizeText(text)
    .split(/[.!?]+/)
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

function splitPartIntoClauses(part) {
  return normalizeText(part)
    .split(/\s*,\s*|\s+and\s+|\s+but\s+|\s+also\s+/i)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function uniqueJoin(values) {
  const normalized = [];

  values.forEach((value) => {
    const cleanValue = cleanListStyleValue(value);
    if (!cleanValue) return;

    const alreadyExists = normalized.some(
      (item) => item.toLowerCase() === cleanValue.toLowerCase()
    );

    if (!alreadyExists) {
      normalized.push(cleanValue);
    }
  });

  return normalized.join(', ');
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SYMPTOM_KEYWORDS = [
  'pain', 'fever', 'cough', 'cold', 'headache', 'vomiting', 'vomit', 'nausea',
  'sore throat', 'breathing', 'breathlessness', 'dizziness', 'weakness', 'rash',
  'discomfort', 'burning', 'swelling', 'body pain', 'chest', 'stomach', 'abdomen',
  'loose motion', 'diarrhea', 'constipation', 'chills', 'fatigue', 'shortness of breath',
  'throat', 'pressure', 'tired', 'itching', 'sneezing'
];

const CONDITION_KEYWORDS = [
  'asthma', 'diabetes', 'hypertension', 'thyroid', 'bp', 'blood pressure', 'migraine',
  'arthritis', 'copd', 'tb', 'tuberculosis', 'heart disease', 'kidney disease',
  'liver disease', 'sinus', 'epilepsy', 'pcod', 'pcos'
];

const ALLERGY_KEYWORDS = [
  'penicillin', 'cashew', 'capsicum', 'peanut', 'nuts', 'dust', 'pollen',
  'milk', 'seafood', 'egg', 'eggs', 'shellfish', 'gluten'
];

const MEDICATION_KEYWORDS = [
  'paracetamol', 'crocin', 'dolo', 'calpol', 'azithromycin', 'amoxicillin', 'tablet',
  'capsule', 'syrup', 'inhaler', 'insulin', 'metformin', 'amlodipine', 'medicine',
  'medicines', 'medication', 'medications', 'antibiotic'
];

const TERM_CORRECTIONS = {
  allergies: {
    casio: 'cashew',
    kashu: 'cashew',
    cashu: 'cashew',
    'cast you': 'cashew',
    'cash you': 'cashew',
    'capsicum in the machine': 'capsicum',
    'capsicum machine': 'capsicum',
    gaseous: 'gas'
  },
  medications: {
    doloo: 'Dolo',
    dolor: 'Dolo',
    dolo650: 'Dolo 650',
    paracitamol: 'paracetamol',
    parasitamol: 'paracetamol',
    parasuitamol: 'paracetamol',
    parasutamol: 'paracetamol'
  },
  conditions: {
    asma: 'asthma',
    sugar: 'diabetes',
    bp: 'blood pressure'
  }
};

const TRANSCRIPT_CORRECTIONS = {
  'cast you': 'cashew',
  'cash you': 'cashew',
  'capsicum in the machine': 'capsicum',
  'capsicum machine': 'capsicum',
  'described by': 'prescribed by',
  dolor: 'dolo',
  parasuitamol: 'paracetamol',
  parasutamol: 'paracetamol',
  paracitamol: 'paracetamol',
  parasitamol: 'paracetamol'
};

function applyTranscriptCorrections(value) {
  let result = normalizeText(value);

  Object.entries(TRANSCRIPT_CORRECTIONS).forEach(([wrongValue, correctedValue]) => {
    const wrongPattern = new RegExp(`\\b${escapeRegExp(wrongValue)}\\b`, 'gi');
    result = result.replace(wrongPattern, correctedValue);
  });

  return normalizeText(result);
}

function removeLeadingIntakePhrase(value) {
  return normalizeText(value)
    .replace(/^(i have|i am having|i've been having|having|suffering from|suffer from|problem is|issue is|issues are)\s+/i, '')
    .replace(/^(i have|i am diagnosed with|diagnosed with|history of)\s+/i, '')
    .replace(/^(i have|i am having)\s+/i, '')
    .trim();
}

function sanitizeSymptoms(value, context = {}) {
  let result = normalizeText(value);

  if (!result) return '';

  const removablePatterns = [
    /^my name is\s+[a-z\s]+[, ]*/i,
    /^name is\s+[a-z\s]+[, ]*/i,
    /^i am\s+\d{1,3}\s*(?:years old|year old|yrs old|yrs|years)[, ]*/i,
    /^i'm\s+\d{1,3}\s*(?:years old|year old|yrs old|yrs|years)[, ]*/i,
    /^im\s+\d{1,3}\s*(?:years old|year old|yrs old|yrs|years)[, ]*/i,
    /^age\s*(?:is|:)?\s*\d{1,3}[, ]*/i,
    /^i am\s+(?:a\s+)?(?:male|female|other)[, ]*/i,
    /^i'm\s+(?:a\s+)?(?:male|female|other)[, ]*/i,
    /^im\s+(?:a\s+)?(?:male|female|other)[, ]*/i,
    /^(?:male|female|other)[, ]*/i
  ];

  removablePatterns.forEach((pattern) => {
    result = result.replace(pattern, '').trim();
  });

  if (context.name) {
    const namePattern = new RegExp(`\\b${escapeRegExp(context.name)}\\b[,. ]*`, 'i');
    result = result.replace(namePattern, '').trim();
  }

  if (context.age) {
    const agePattern = new RegExp(`\\b${escapeRegExp(String(context.age))}\\s*(?:years old|year old|yrs old|yrs|years)?\\b[,. ]*`, 'i');
    result = result.replace(agePattern, '').trim();
  }

  if (context.gender) {
    const genderPattern = new RegExp(`\\b(?:a\\s+)?${escapeRegExp(String(context.gender))}\\b[,. ]*`, 'i');
    result = result.replace(genderPattern, '').trim();
  }

  result = result
    .replace(/^(and|then)\s+/i, '')
    .replace(/[,. ]+$/i, '')
    .trim();

  return removeLeadingIntakePhrase(result);
}

function extractAge(text) {
  const patterns = [
    /\b(?:i am|i'm|im)\s+(\d{1,3})\s*(?:years old|year old|yrs old|yrs|years)\b/i,
    /\bage\s*(?:is|:)?\s*(\d{1,3})\b/i,
    /\b(\d{1,3})\s*(?:years old|year old|yrs old|yrs|years)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return Number(match[1]);
    }
  }

  return '';
}

function extractGender(text) {
  const lowerText = text.toLowerCase();

  if (/\bmale\b/.test(lowerText)) return 'Male';
  if (/\bfemale\b/.test(lowerText)) return 'Female';
  if (/\bwoman\b|\bgirl\b|\blady\b/.test(lowerText)) return 'Female';
  if (/\bman\b|\bboy\b/.test(lowerText)) return 'Male';
  if (/\bother\b|\bnon binary\b|\bnon-binary\b/.test(lowerText)) return 'Other';

  return '';
}

function isAllergyPart(text) {
  if (/\b(allergic to|allergy|allergies|reaction to)\b/i.test(text)) {
    return true;
  }

  const hasAllergyKeyword = ALLERGY_KEYWORDS.some((keyword) => {
    return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(text);
  });

  if (!hasAllergyKeyword) {
    return false;
  }

  return !isMedicationPart(text) && !hasStrongSymptomKeywords(text);
}

function isMedicationPart(text) {
  if (/\b(i take|i am taking|i'm taking|taking|i use|use|medicine|medicines|medication|medications|tablet|capsule|syrup|inhaler|on|prescribed|prescribed by|doctor gave|doctor prescribed)\b/i.test(text)) {
    return true;
  }

  return MEDICATION_KEYWORDS.some((keyword) => {
    return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(text);
  });
}

function isConditionPart(text) {
  if (/\b(condition|conditions|diagnosed with|history of|medical problem|illness|disease)\b/i.test(text)) {
    return true;
  }

  return /\b(asthma|diabetes|hypertension|thyroid|bp|blood pressure|migraine|arthritis|copd|tb|tuberculosis|heart disease|kidney disease|liver disease|sinus|epilepsy)\b/i.test(text);
}

function hasStrongSymptomKeywords(text) {
  return SYMPTOM_KEYWORDS.some((keyword) => new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(text));
}

function cleanAllergyValue(value) {
  return normalizeText(value)
    .replace(/^(i am|i'm|im|i have)\s+/i, '')
    .replace(/^(allergic to|allergy to|allergy of|allergy is|allergies are|known allergy is|known allergies are|mujhe allergy hai|meri allergy hai)\s+/i, '')
    .replace(/\b(?:in|on)\s+the\s+machine\b/gi, '')
    .trim();
}

function cleanMedicationValue(value) {
  return normalizeText(value)
    .replace(/^(i take|i am taking|i'm taking|taking|i use|use|on|my medicines are|medicine is|medicines are|medication is|medications are|i have been prescribed by|i have been prescribed|i was prescribed by|i was prescribed|prescribed by|doctor gave|doctor prescribed)\s+/i, '')
    .trim();
}

function cleanConditionValue(value) {
  return removeLeadingIntakePhrase(value)
    .replace(/^(condition is|conditions are|diagnosed with|history of)\s+/i, '')
    .trim();
}

function cleanSymptomValue(value) {
  return removeLeadingIntakePhrase(value)
    .replace(/^(symptoms are|symptom is)\s+/i, '')
    .trim();
}

function extractAllergies(text) {
  const parts = splitTranscriptIntoParts(text);
  const values = parts
    .flatMap((part) => splitPartIntoClauses(part))
    .filter((part) => isAllergyPart(part))
    .map((part) => cleanAllergyValue(part));

  if (values.length) {
    return uniqueJoin(values);
  }

  return findFirstMatch(text, [
    /\b(?:allergic to|allergy to|allergy of|allergy is|allergies are|known allergy is|known allergies are|mujhe allergy hai|meri allergy hai)\s+(.+?)(?=\b(?:i take|taking|on|medicine|medication|condition|symptom|problem|my name is|i am)\b|$)/i
  ]);
}

function extractConditions(text) {
  const parts = splitTranscriptIntoParts(text);
  const values = parts
    .flatMap((part) => splitPartIntoClauses(part))
    .filter((part) => isConditionPart(part) && !isAllergyPart(part) && !isMedicationPart(part))
    .map((part) => cleanConditionValue(part));

  if (values.length) {
    return uniqueJoin(values);
  }

  return findFirstMatch(text, [
    /\b(?:known condition is|known conditions are|medical condition is|medical conditions are|i am diagnosed with|diagnosed with|i have a history of|history of)\s+(.+?)(?=\b(?:allergic to|i take|taking|on medication|medicine|symptoms are|symptom is)\b|$)/i
  ]);
}

function extractMedications(text) {
  const parts = splitTranscriptIntoParts(text);
  const values = parts
    .flatMap((part) => splitPartIntoClauses(part))
    .filter((part) => isMedicationPart(part) && !isAllergyPart(part))
    .map((part) => cleanMedicationValue(part));

  if (values.length) {
    return uniqueJoin(values);
  }

  return findFirstMatch(text, [
    /\b(?:i take|i am taking|i'm taking|taking|on|my medicines are|medicine is|medicines are|medication is|medications are)\s+(.+?)(?=\b(?:allergic to|condition|symptom|my name is|i am)\b|$)/i
  ]);
}

function extractSymptoms(text) {
  const parts = splitTranscriptIntoParts(text);
  const values = parts
    .flatMap((part) => splitPartIntoClauses(part))
    .filter((part) => {
      if (isAllergyPart(part) || isMedicationPart(part)) return false;
      if (isConditionPart(part) && !hasStrongSymptomKeywords(part)) return false;
      return /\b(i have|i am having|i've been having|having|suffering from|suffer from|complaining of|complaint is|problem is|issues are|symptoms are|symptom is)\b/i.test(part)
        || hasStrongSymptomKeywords(part);
    })
    .map((part) => cleanSymptomValue(part));

  if (values.length) {
    return uniqueJoin(values);
  }

  return findFirstMatch(text, [
    /\b(?:i have|i am having|i've been having|having|suffering from|suffer from|complaining of|complaint is|problem is|issues are)\s+(.+?)(?=\b(?:allergic to|allergy is|known allergy|i take|taking|on|medicine|medicines|medication|medications|condition|conditions|disease|problem since|my name is|name is|i am|i'm|im)\b|$)/i,
    /\b(?:symptoms are|symptom is)\s+(.+?)(?=\b(?:allergic to|i take|taking|medication|conditions?)\b|$)/i
  ]);
}

function extractName(text) {
  const name = findFirstMatch(text, [
    /\b(?:my name is|name is|this is)\s+([a-z][a-z\s]+?)(?=[,.;]|\s+\bi am\b|\s+\bi'm\b|\s+\bim\b|\s+\bage\b|\s+\bmale\b|\s+\bfemale\b|\s+\bold\b|$)/i,
    /\b(?:i am|i'm|im)\s+([a-z][a-z\s]+?)(?=[,.;]|\s+\d{1,3}\s*(?:years old|year old|yrs old|yrs|years)\b|\s+\bage\b|\s+\bmale\b|\s+\bfemale\b|\s+\bother\b|$)/i
  ]);

  if (!name) return '';

  const blockedWords = ['male', 'female', 'other', 'fever', 'headache', 'cough'];
  if (blockedWords.includes(name.toLowerCase())) {
    return '';
  }

  return toTitleCase(collapseAdjacentDuplicateWords(name));
}

function cleanListStyleValue(value) {
  return normalizeText(value)
    .replace(/\b(and|or)\s+(male|female|other)$/i, '')
    .replace(/\b(please|bas|that is all|thats all|that's all)$/i, '')
    .replace(/^of\s+/i, '')
    .trim();
}

function normalizeFieldValue(value, fieldName) {
  let result = cleanListStyleValue(value);

  if (!result) return '';

  if (fieldName === 'allergies') {
    result = result
      .replace(/\b(?:to|of)\s+/i, '')
      .replace(/^gas(eous|s)?$/i, 'gas')
      .trim();
  }

  if (fieldName === 'medications') {
    result = result
      .replace(/^current\s+/i, '')
      .trim();
  }

  const fieldCorrections = TERM_CORRECTIONS[fieldName] || {};
  Object.entries(fieldCorrections).forEach(([wrongValue, correctedValue]) => {
    const wrongPattern = new RegExp(`\\b${escapeRegExp(wrongValue)}\\b`, 'gi');
    result = result.replace(wrongPattern, correctedValue);
  });

  result = result
    .replace(/\b(?:and|,)\s*(?:in|on)\s+the\s+machine\b/gi, '')
    .replace(/\b(?:been\s+described\s+by)\b/gi, '')
    .replace(/[,\s]+$/g, '')
    .trim();

  return result;
}

function extractPatientFieldsFromTranscript(transcript) {
  const text = applyTranscriptCorrections(transcript);

  const fields = {
    name: extractName(text),
    age: extractAge(text),
    gender: extractGender(text),
    symptoms: '',
    allergies: normalizeFieldValue(extractAllergies(text), 'allergies'),
    conditions: normalizeFieldValue(extractConditions(text), 'conditions'),
    medications: normalizeFieldValue(extractMedications(text), 'medications')
  };

  fields.symptoms = normalizeFieldValue(
    sanitizeSymptoms(extractSymptoms(text), {
      name: fields.name,
      age: fields.age,
      gender: fields.gender
    }),
    'symptoms'
  );

  if (fields.conditions && fields.symptoms) {
    const lowerConditions = fields.conditions.toLowerCase();
    const lowerSymptoms = fields.symptoms.toLowerCase();

    if (lowerConditions === lowerSymptoms) {
      fields.conditions = '';
    }
  }

  CONDITION_KEYWORDS.forEach((keyword) => {
    const keywordPattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
    if (!fields.conditions && keywordPattern.test(text) && !keywordPattern.test(fields.symptoms)) {
      fields.conditions = toTitleCase(keyword);
    }
  });

  if (!fields.medications) {
    const matchedMedication = MEDICATION_KEYWORDS.find((keyword) => {
      const keywordPattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
      return keywordPattern.test(text);
    });

    if (matchedMedication && !/medicine|medication/i.test(matchedMedication)) {
      fields.medications = toTitleCase(matchedMedication);
    }
  }

  return fields;
}

module.exports = {
  extractPatientFieldsFromTranscript
};
