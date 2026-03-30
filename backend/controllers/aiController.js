const path = require('path');
const fs = require('fs');
const { transcribeWithWorker } = require('../services/transcriptionWorker');
const { extractPatientFieldsFromTranscript } = require('../utils/extractPatientFieldsFromTranscript');

function normalizeTranscriptSpacing(value) {
  return String(value || '')
    .replace(/(?<=[A-Za-z])-(?=[A-Za-z])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getComparableToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9']/g, '');
}

function trimRepeatedTail(text) {
  const normalizedText = normalizeTranscriptSpacing(text);
  const tokens = normalizedText.split(' ').filter(Boolean);

  if (tokens.length < 8) {
    return normalizedText;
  }

  for (let size = 1; size <= 4; size += 1) {
    for (let start = 0; start <= tokens.length - size * 4; start += 1) {
      const phrase = tokens.slice(start, start + size).map(getComparableToken);

      if (!phrase.every(Boolean)) {
        continue;
      }

      let repeats = 1;
      let cursor = start + size;

      while (cursor + size <= tokens.length) {
        const candidate = tokens.slice(cursor, cursor + size).map(getComparableToken);
        const isSamePhrase = candidate.every((token, index) => token === phrase[index]);

        if (!isSamePhrase) {
          break;
        }

        repeats += 1;
        cursor += size;
      }

      if (repeats >= 4) {
        return tokens
          .slice(0, start)
          .join(' ')
          .replace(/[,\-;:]+$/g, '')
          .trim();
      }
    }
  }

  return normalizedText;
}

function cleanupTranscriptText(value) {
  let result = normalizeTranscriptSpacing(value);

  result = result.replace(/\b([a-z]+)(?: \1){4,}\b/gi, '$1');
  result = trimRepeatedTail(result);
  result = result.replace(/[,\-;:]+$/g, '').trim();
  result = result.replace(/\b(?:i|and|but|so|then)$/i, '').trim();
  result = result.replace(/[,\-;:]+$/g, '').trim();

  return result;
}

function mapTranscriptionErrorMessage(error) {
  const rawMessage = String((error && error.message) || '').trim();

  if (/Invalid data found when processing input/i.test(rawMessage)) {
    return 'The recorded audio could not be decoded. Please record again and speak clearly for 2 to 3 seconds.';
  }

  if (/Audio file path is required/i.test(rawMessage)) {
    return 'No audio was received. Please try recording again.';
  }

  return rawMessage || 'Unable to transcribe audio.';
}

function removeFileIfExists(filePath) {
  if (!filePath) return;

  fs.unlink(filePath, (error) => {
    if (error && error.code !== 'ENOENT') {
      console.error(`Failed to remove temporary file: ${filePath}`, error);
    }
  });
}

async function transcribeAudio(req, res) {
  const uploadedFilePath = req.file && req.file.path;
  const emptyExtraction = {
    name: '',
    age: '',
    gender: '',
    symptoms: '',
    allergies: '',
    conditions: '',
    medications: ''
  };

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Audio file is required.'
      });
    }

    const result = await transcribeWithWorker(uploadedFilePath);
    const rawText = String(result && result.text ? result.text : '').trim();
    const text = cleanupTranscriptText(rawText);
    const device = String(result && result.device ? result.device : 'cpu');

    if (!text) {
      return res.status(200).json({
        success: false,
        message: 'No clear speech was detected. Please try again.',
        device,
        transcript: '',
        extracted: emptyExtraction,
        text: '',
        fields: emptyExtraction
      });
    }

    const extracted = extractPatientFieldsFromTranscript(text);

    return res.status(200).json({
      success: true,
      device,
      transcript: text,
      extracted,
      text,
      fields: extracted
    });
  } catch (error) {
    console.error('Error transcribing audio:', error);

    return res.status(500).json({
      success: false,
      message: mapTranscriptionErrorMessage(error)
    });
  } finally {
    removeFileIfExists(uploadedFilePath);
  }
}

module.exports = {
  transcribeAudio
};
