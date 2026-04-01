const isPatientPage = document.body.classList.contains('patient-body');
const isStaffPage   = document.body.classList.contains('staff-body');
const isVitalsPage  = document.body.classList.contains('vitals-body');
const patientRecordKey = 'mediAI_patient';

function getPatientRecord() {
  try {
    return JSON.parse(localStorage.getItem(patientRecordKey) || '{}');
  } catch (e) {
    return {};
  }
}

function setPatientRecord(data) {
  localStorage.setItem(patientRecordKey, JSON.stringify(data));
}

function cleanFieldValue(value) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '--' || normalized === '—') return '';
  return normalized;
}

function hasCompleteVitals(data) {
  return Boolean(
    data &&
    data.vitals &&
    cleanFieldValue(data.vitals.bp) &&
    cleanFieldValue(data.vitals.hr) &&
    cleanFieldValue(data.vitals.temp) &&
    cleanFieldValue(data.vitals.spo2)
  );
}

function formatSharedToken(token) {
  return token ? `#${String(token).padStart(3, '0')}` : 'Pending';
}

function formatDisplayTime(value) {
  if (!value) return '--';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '--';
  return (
    dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) +
    ' at ' +
    dt.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true })
  );
}

function isSameStoredPatientRecord(record, storedRecord) {
  if (!record || !storedRecord) return false;

  if (record.visitId && storedRecord.visitId) {
    return String(record.visitId) === String(storedRecord.visitId);
  }

  if (record.patientId && storedRecord.patientId) {
    return String(record.patientId) === String(storedRecord.patientId);
  }

  return false;
}

function getStoredStaffNotes(data = null) {
  const record = data || getPatientRecord();
  const recordNotes = cleanFieldValue(record && record.staffNotes);
  if (recordNotes) return recordNotes;

  const storedRecord = getPatientRecord();
  const storedRecordNotes = cleanFieldValue(storedRecord && storedRecord.staffNotes);
  const legacyNotes = cleanFieldValue(localStorage.getItem('mediAI_notes'));

  if (!data) {
    return storedRecordNotes || legacyNotes;
  }

  if (isSameStoredPatientRecord(record, storedRecord)) {
    return storedRecordNotes || legacyNotes;
  }

  return '';
}

function resolveApiBaseUrl() {
  const configuredBaseUrl =
    (typeof window !== 'undefined' && typeof window.MEDIASSIST_API_BASE_URL === 'string' && window.MEDIASSIST_API_BASE_URL.trim()) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('mediAI_api_base_url')) ||
    '';

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }

  const { protocol, hostname } = window.location;
  const safeHostname = hostname || 'localhost';
  const normalizedProtocol = protocol === 'https:' ? 'https:' : 'http:';

  return `${normalizedProtocol}//${safeHostname}:5000`;
}

function buildApiUrl(path) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${resolveApiBaseUrl()}${normalizedPath}`;
}

function mapApiRequestError(error, apiUrl, fallbackMessage) {
  const rawMessage = String((error && error.message) || '').trim();

  if (/Failed to fetch|NetworkError|Load failed/i.test(rawMessage)) {
    return `Cannot reach the MediAssist backend at ${apiUrl}. Make sure the backend server is running on port 5000, then try again.`;
  }

  return rawMessage || fallbackMessage;
}

/* Live Clock */
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
  const dateStr = now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const full = `${dateStr} · ${timeStr}`;
  if (document.getElementById('kiosk-clock')) document.getElementById('kiosk-clock').textContent = full;
  if (document.getElementById('staff-clock'))  document.getElementById('staff-clock').textContent  = full;
}
updateClock();
setInterval(updateClock, 1000);

/* ══ PATIENT PAGE ══ */
if (isPatientPage) {

  let micActive = false;
  let mediaRecorder = null;
  let recordedChunks = [];
  let mediaStream = null;
  let recordingStartedAt = 0;
  let patientMicMode = 'idle';
  let latestPatientRegistration = null;
  let patientRequestInFlight = false;
  let patientMicHandlersBound = false;
  let isHandlingPatientMicToggle = false;
  let lastPatientMicToggleAt = 0;
  const patientRegisterApiUrl = buildApiUrl('/api/patient/register');
  const patientTranscribeApiUrl = buildApiUrl('/api/ai/transcribe');

  function formatPatientToken(token) {
    return `#${String(token).padStart(3, '0')}`;
  }

  function buildSharedPatientRecord(responseData, options = {}) {
    const patient = responseData && responseData.patient ? responseData.patient : {};
    const visit = responseData && responseData.visit ? responseData.visit : {};

    return {
      id: patient.id || options.id || '',
      patientId: patient.id || options.patientId || '',
      visitId: visit.id || options.visitId || '',
      name: patient.name || options.name || '',
      age: patient.age || options.age || '',
      gender: patient.gender || options.gender || '',
      symptoms: visit.symptoms || options.symptoms || '',
      allergies: visit.allergies || options.allergies || '',
      conditions: visit.conditions || options.conditions || '',
      medications: visit.medications || options.medications || '',
      token: responseData.token || visit.token_number || options.token || '',
      timestamp: visit.created_at || patient.created_at || options.timestamp || new Date().toISOString(),
      workflowStage: visit.status || options.workflowStage || 'registered',
      vitals: visit.vitals || options.vitals || null,
      staffConfirmed: Boolean(options.staffConfirmed)
    };
  }

  function syncPatientReviewFromStore() {
    if (!latestPatientRegistration || !latestPatientRegistration.visit || !latestPatientRegistration.visit.id) return;

    const stored = getPatientRecord();
    if (!stored || !stored.visitId) return;
    if (String(stored.visitId) !== String(latestPatientRegistration.visit.id)) return;

    latestPatientRegistration = {
      token: stored.token,
      patient: {
        id: stored.patientId || stored.id,
        name: stored.name,
        age: stored.age,
        gender: stored.gender
      },
      visit: {
        id: stored.visitId,
        symptoms: stored.symptoms,
        allergies: stored.allergies,
        conditions: stored.conditions,
        medications: stored.medications,
        status: stored.workflowStage,
        token_number: stored.token,
        created_at: stored.timestamp,
        vitals: stored.vitals || null
      },
      staffConfirmed: Boolean(stored.staffConfirmed)
    };

    updatePatientReviewStatus();
  }

  function setPatientSubmitState(isSubmitting) {
    patientRequestInFlight = isSubmitting;
    const submitBtn = document.querySelector('.patient-form .pform-submit-btn');
    if (!submitBtn) return;

    submitBtn.disabled = isSubmitting;
    submitBtn.style.opacity = isSubmitting ? '0.7' : '';
    submitBtn.style.cursor = isSubmitting ? 'not-allowed' : '';
    submitBtn.innerHTML = isSubmitting
      ? 'Submitting...'
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Submit`;
  }

  function updatePatientReviewStatus() {
    const successEl = document.getElementById('kiosk-success');
    if (!successEl || successEl.style.display === 'none') return;

    const successMsg = successEl.querySelector('.success-msg');
    const tokenStatus = successEl.querySelector('.success-token');
    const data = latestPatientRegistration;

    if (!successMsg || !tokenStatus) return;

    if (data && data.staffConfirmed && data.token) {
      const formattedToken = formatPatientToken(data.token);
      successMsg.textContent = 'Your registration is complete. Please keep this token ready when your turn is called.';
      tokenStatus.innerHTML = `Your token: <strong id="success-token-num">${formattedToken}</strong>`;
      return;
    }

    successMsg.textContent = 'Your information has been received. Please wait while the staff desk reviews and confirms your registration.';
    tokenStatus.textContent = 'Token status: Pending staff confirmation';
  }

  function showPatientSuccessScreen() {
    const kioskCard = document.querySelector('.kiosk-card');
    const successEl = document.getElementById('kiosk-success');
    if (kioskCard) kioskCard.style.display = 'none';
    if (successEl) successEl.style.display = 'block';
    updatePatientReviewStatus();
  }

  function showPatientFormScreen() {
    const kioskCard = document.querySelector('.kiosk-card');
    const successEl = document.getElementById('kiosk-success');
    if (kioskCard) kioskCard.style.display = 'block';
    if (successEl) successEl.style.display = 'none';
  }

  function restorePatientPageState() {
    if (latestPatientRegistration) {
      showPatientSuccessScreen();
      return;
    }

    showPatientFormScreen();
  }

  function setMicUiState(isRecording, statusText = '') {
    const btn = document.getElementById('mic-btn');
    const label = document.getElementById('mic-label');
    const status = document.getElementById('mic-status');
    const bars = document.getElementById('mic-bars');

    if (btn) btn.classList.toggle('mic-active', isRecording);
    if (bars) bars.classList.toggle('active', isRecording);

    if (label) {
      label.innerHTML = isRecording
        ? 'Listening...'
        : 'Tap to speak <span class="mic-soon">Voice input</span>';
    }

    if (status) {
      status.textContent = statusText;
      status.style.display = statusText ? 'block' : 'none';
    }
  }

  function showPatientAlert(message, tone = 'blue') {
    const alertEl = document.getElementById('p-alert');
    if (!alertEl) return;

    if (!message) {
      alertEl.style.display = 'none';
      return;
    }

    alertEl.className = `p-alert p-alert-${tone}`;
    alertEl.textContent = message;
    alertEl.style.display = 'flex';
  }

  function setMicButtonDisabled(isDisabled) {
    const btn = document.getElementById('mic-btn');
    if (!btn) return;

    btn.disabled = isDisabled;
    btn.style.opacity = isDisabled ? '0.65' : '';
    btn.style.cursor = isDisabled ? 'not-allowed' : '';
  }

  function updatePatientMicMode(mode, statusText = '') {
    patientMicMode = mode;

    if (mode === 'recording') {
      setMicButtonDisabled(false);
      setMicUiState(true, statusText || 'Recording...');
      showPatientAlert('Recording started. Tap the mic again to stop.', 'blue');
      showProcessingState('');
      return;
    }

    if (mode === 'processing') {
      setMicButtonDisabled(true);
      setMicUiState(false, statusText || 'Processing audio...');
      showPatientAlert('Voice captured. AI is transcribing and filling the form...', 'blue');
      showProcessingState('AI is processing the voice input...');
      return;
    }

    if (mode === 'success') {
      setMicButtonDisabled(false);
      setMicUiState(false, statusText || 'Voice recognized successfully.');
      showPatientAlert('Voice recognized and patient details were filled.', 'blue');
      showProcessingState('');
      return;
    }

    if (mode === 'error') {
      setMicButtonDisabled(false);
      setMicUiState(false, statusText || 'Unable to process voice input.');
      showProcessingState('');
      return;
    }

    setMicButtonDisabled(false);
    setMicUiState(false, statusText);
    showPatientAlert('');
    showProcessingState('');
  }

  function showProcessingState(message = '') {
    const processingEl = document.getElementById('ai-processing-box');
    if (!processingEl) return;

    processingEl.textContent = message || 'AI is processing the voice input...';
    processingEl.style.display = message ? 'flex' : 'none';
  }

  function setFieldIfPresent(id, value) {
    const el = document.getElementById(id);
    const normalizedValue = String(value || '').trim();
    if (!el || !normalizedValue) return;
    el.value = normalizedValue;
  }

  function fillPatientFormFromExtractedData(extracted) {
    if (!extracted || typeof extracted !== 'object') return;

    setFieldIfPresent('p-name', extracted.name);
    setFieldIfPresent('p-age', extracted.age);
    setFieldIfPresent('p-symptoms', extracted.symptoms);
    setFieldIfPresent('p-allergies', extracted.allergies);
    setFieldIfPresent('p-conditions', extracted.conditions);
    setFieldIfPresent('p-medications', extracted.medications);

    const genderEl = document.getElementById('p-gender');
    const gender = String(extracted.gender || '').trim();
    if (genderEl && gender) {
      genderEl.value = gender;
    }
  }

  function formatPreviewLine(label, value) {
    return value ? `<strong>${label}:</strong> ${value}` : '';
  }

  function showTranscriptResult(transcript) {
    const transcriptBox = document.getElementById('ai-transcript-box');
    const transcriptText = document.getElementById('ai-transcript-text');

    if (!transcriptBox || !transcriptText) return;

    transcriptText.textContent = transcript;
    transcriptBox.style.display = transcript ? 'flex' : 'none';
  }

  function showExtractedPreview(extracted) {
    const previewBox = document.getElementById('ai-extracted-box');
    const previewText = document.getElementById('ai-extracted-text');

    if (!previewBox || !previewText) return;

    const lines = [
      formatPreviewLine('Name', extracted.name),
      formatPreviewLine('Age', extracted.age),
      formatPreviewLine('Gender', extracted.gender),
      formatPreviewLine('Symptoms', extracted.symptoms),
      formatPreviewLine('Allergies', extracted.allergies),
      formatPreviewLine('Conditions', extracted.conditions),
      formatPreviewLine('Medications', extracted.medications)
    ].filter(Boolean);

    previewText.innerHTML = lines.join('<br/>');
    previewBox.style.display = lines.length ? 'flex' : 'none';
  }

  function showAiFillSuccessMessage() {
    const successEl = document.getElementById('ai-fill-success');
    if (!successEl) return;

    successEl.style.display = 'flex';
    setTimeout(() => {
      successEl.style.display = 'none';
    }, 2500);
  }

  function stopMicTracks() {
    if (!mediaStream) return;
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  function getRecordedMimeType() {
    if (typeof MediaRecorder === 'undefined') {
      return 'audio/webm';
    }

    const preferredTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];

    return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  async function sendRecordingForTranscription(audioBlob) {
    const formData = new FormData();
    const extension = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';

    formData.append('audio', audioBlob, `patient-recording.${extension}`);

    let response;
    let responseData = {};

    try {
      response = await fetch(patientTranscribeApiUrl, {
        method: 'POST',
        body: formData
      });

      responseData = await response.json().catch(() => ({}));
    } catch (error) {
      throw new Error(
        mapApiRequestError(
          error,
          patientTranscribeApiUrl,
          'Unable to transcribe audio right now.'
        )
      );
    }

    if (!response.ok) {
      throw new Error(responseData.message || 'Unable to transcribe audio right now.');
    }

    const transcript = String(
      responseData.transcript ||
      responseData.text ||
      ''
    ).trim();

    const extracted = responseData.extracted || responseData.fields || {};

    showTranscriptResult(transcript);
    showExtractedPreview(extracted);

    if (!responseData.success || !transcript) {
      updatePatientMicMode('error', responseData.message || 'No clear speech detected. Please try again.');
      showPatientAlert(responseData.message || 'No clear speech detected. Please try again.', 'amber');
      return;
    }

    if (!extracted || Object.keys(extracted).length === 0) {
      const symptomsField = document.getElementById('p-symptoms');
      if (symptomsField && transcript) {
        symptomsField.value = transcript;
      }
    }

    fillPatientFormFromExtractedData(extracted);

    if (!cleanFieldValue(document.getElementById('p-symptoms')?.value) && transcript) {
      document.getElementById('p-symptoms').value = transcript;
    }

    showPatientAlert('');
    showAiFillSuccessMessage();
    updatePatientMicMode('success', 'Voice recognized successfully.');
    setTimeout(() => updatePatientMicMode('idle', ''), 1800);
  }

  async function startMicRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.');
    }

    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser.');
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    recordingStartedAt = Date.now();

    const mimeType = getRecordedMimeType();
    mediaRecorder = mimeType
      ? new MediaRecorder(mediaStream, { mimeType })
      : new MediaRecorder(mediaStream);

    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener('error', () => {
      updatePatientMicMode('error', 'Recording failed. Please try again.');
      showPatientAlert('Recording failed. Please try again.', 'red');
      stopMicTracks();
      mediaRecorder = null;
      micActive = false;
    });

    mediaRecorder.addEventListener('stop', async () => {
      const recorderMimeType = mediaRecorder && mediaRecorder.mimeType ? mediaRecorder.mimeType : 'audio/webm';
      const audioBlob = new Blob(recordedChunks, { type: recorderMimeType });

      stopMicTracks();
      mediaRecorder = null;
      micActive = false;
      updatePatientMicMode('processing', 'Uploading audio...');

      try {
        if (!audioBlob.size) {
          throw new Error('No audio was recorded. Please try again.');
        }

        await sendRecordingForTranscription(audioBlob);
      } catch (error) {
        updatePatientMicMode('error', error.message || 'Transcription failed.');
        showPatientAlert(error.message || 'Transcription failed.', 'red');
      }
    });

    mediaRecorder.start();
    micActive = true;
    showPatientAlert('');
    updatePatientMicMode('recording', 'Recording...');
  }

  function stopMicRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    const recordingDurationMs = Date.now() - recordingStartedAt;
    if (recordingDurationMs < 800) {
      updatePatientMicMode('error', 'Please speak for a little longer.');
      showPatientAlert('Please record for at least 1 second so the AI can hear clearly.', 'amber');
      stopMicTracks();
      mediaRecorder = null;
      micActive = false;
      return;
    }

    updatePatientMicMode('processing', 'Processing audio...');
    mediaRecorder.stop();
  }

  async function handlePatientMicToggle() {
    const now = Date.now();
    if (isHandlingPatientMicToggle) {
      return;
    }

    if (now - lastPatientMicToggleAt < 300) {
      return;
    }

    lastPatientMicToggleAt = now;
    isHandlingPatientMicToggle = true;

    if (patientMicMode === 'processing') {
      isHandlingPatientMicToggle = false;
      return;
    }

    try {
      if (micActive) {
        stopMicRecording();
        return;
      }

      await startMicRecording();
    } catch (error) {
      micActive = false;
      stopMicTracks();
      mediaRecorder = null;
      updatePatientMicMode('error', error.message || 'Microphone access failed.');
      showPatientAlert(error.message || 'Microphone access failed.', 'red');
    } finally {
      isHandlingPatientMicToggle = false;
    }
  }

  window.toggleMic = handlePatientMicToggle;

  function analyseSymptoms(symptoms) {
    const s = symptoms.toLowerCase();
    if (s.includes('chest pain') || s.includes('breathing') || s.includes('shortness of breath') || s.includes('heart')) {
      return { type:'red', msg:'⚠ High Priority Case - Chest pain or breathing difficulty detected. Notify staff immediately.' };
    }
    if (s.includes('fever') && (s.includes('cough') || s.includes('cold'))) {
      return { type:'amber', msg:'⚠ Fever with cough or cold symptoms detected. Staff review may be needed.' };
    }
    if (s.includes('fever') && s.includes('rash')) {
      return { type:'amber', msg:'⚠ Fever with rash detected. Inform staff about recent medication changes or exposures.' };
    }
    if (s.includes('headache') && s.includes('vomit')) {
      return { type:'amber', msg:'⚠ Headache with vomiting detected. Inform staff if symptoms worsened suddenly.' };
    }
    return null;
  }

  function cleanPlaceholderSample(value) {
    return String(value || '')
      .trim()
      .replace(/^e\.g\.\s*/i, '')
      .replace(/\.\.\.$/, '')
      .trim();
  }

  function getPatientFieldValue(id, usePlaceholderFallback = false) {
    const el = document.getElementById(id);
    if (!el) return '';

    const value = String(el.value || '').trim();
    if (value) return value;
    if (!usePlaceholderFallback) return '';

    return cleanPlaceholderSample(el.getAttribute('placeholder'));
  }

  function buildPatientSubmissionData() {
    return {
      name:        getPatientFieldValue('p-name', true),
      age:         getPatientFieldValue('p-age', true),
      gender:      document.getElementById('p-gender').value,
      symptoms:    getPatientFieldValue('p-symptoms', true),
      allergies:   getPatientFieldValue('p-allergies'),
      conditions:  getPatientFieldValue('p-conditions'),
      medications: getPatientFieldValue('p-medications')
    };
  }

  function hydratePatientFormDefaults(data) {
    const fieldValues = {
      'p-name': data.name,
      'p-age': data.age,
      'p-symptoms': data.symptoms
    };

    Object.entries(fieldValues).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && !String(el.value || '').trim()) {
        el.value = value;
      }
    });

    const genderEl = document.getElementById('p-gender');
    if (genderEl && !genderEl.value) {
      genderEl.value = data.gender;
    }
  }

  function submitPatientForm() {
    if (patientRequestInFlight) return;

    const data     = buildPatientSubmissionData();
    const alertEl  = document.getElementById('p-alert');
    hydratePatientFormDefaults(data);

    if (!data.name)     { showFieldError('p-name',     'Please enter your full name.');    return; }
    if (!data.age)      { showFieldError('p-age',      'Please enter your age.');          return; }
    if (!data.gender)   { showFieldError('p-gender',   'Please select your gender.');      return; }
    if (!data.symptoms) { showFieldError('p-symptoms', 'Please describe your symptoms.');  return; }

    const analysis = analyseSymptoms(data.symptoms);
    if (analysis) {
      alertEl.className     = `p-alert p-alert-${analysis.type}`;
      alertEl.innerHTML     = analysis.msg;
      alertEl.style.display = 'flex';
      setPatientSubmitState(true);
      setTimeout(() => { void doSubmit(data, true); }, 2000);
      return;
    }
    alertEl.style.display = 'none';
    setPatientSubmitState(true);
    void doSubmit(data, true);
  }

  function showRequestError(message) {
    const alertEl = document.getElementById('p-alert');
    if (!alertEl) return;

    alertEl.className = 'p-alert p-alert-red';
    alertEl.textContent = message || 'Unable to submit registration right now. Please try again.';
    alertEl.style.display = 'flex';
  }

  async function doSubmit(preparedData, submitStateAlreadySet = false) {
    const data = preparedData || buildPatientSubmissionData();

    try {
      if (!submitStateAlreadySet) {
        setPatientSubmitState(true);
      }

      let response;
      let responseData = {};

      try {
        response = await fetch(patientRegisterApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        responseData = await response.json().catch(() => ({}));
      } catch (error) {
        throw new Error(
          mapApiRequestError(
            error,
            patientRegisterApiUrl,
            'Unable to submit registration right now. Please try again.'
          )
        );
      }

      if (!response.ok) {
        throw new Error(responseData.message || 'Registration failed. Please try again.');
      }

      const sharedPatientRecord = buildSharedPatientRecord(responseData);
      setPatientRecord(sharedPatientRecord);

      latestPatientRegistration = {
        token: sharedPatientRecord.token,
        patient: responseData.patient,
        visit: responseData.visit,
        staffConfirmed: false
      };

      showPatientSuccessScreen();
    } catch (error) {
      showRequestError(error.message);
    } finally {
      setPatientSubmitState(false);
    }
  }

  function showFieldError(id, msg) {
    const el = document.getElementById(id);
    el.style.borderColor = '#ef4444';
    el.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.1)';
    el.focus();
    setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 2000);
    const alertEl = document.getElementById('p-alert');
    alertEl.className     = 'p-alert p-alert-red';
    alertEl.innerHTML     = msg;
    alertEl.style.display = 'flex';
    setTimeout(() => { alertEl.style.display = 'none'; }, 3000);
  }

  function clearPatientForm() {
    ['p-name','p-age','p-symptoms','p-allergies','p-conditions','p-medications'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('p-gender').value = '';
    document.getElementById('p-alert').style.display = 'none';
    const transcriptBox = document.getElementById('ai-transcript-box');
    const transcriptText = document.getElementById('ai-transcript-text');
    const extractedBox = document.getElementById('ai-extracted-box');
    const extractedText = document.getElementById('ai-extracted-text');
    const aiFillSuccess = document.getElementById('ai-fill-success');
    const processingBox = document.getElementById('ai-processing-box');
    if (transcriptBox) transcriptBox.style.display = 'none';
    if (transcriptText) transcriptText.textContent = '';
    if (extractedBox) extractedBox.style.display = 'none';
    if (extractedText) extractedText.innerHTML = '';
    if (aiFillSuccess) aiFillSuccess.style.display = 'none';
    if (processingBox) processingBox.style.display = 'none';
    patientMicMode = 'idle';
    setMicButtonDisabled(false);
    setMicUiState(false, '');
    document.getElementById('p-name').focus();
  }

  function resetKiosk() {
    latestPatientRegistration = null;
    clearPatientForm();
    setPatientSubmitState(false);
    showPatientFormScreen();
  }

  function bindPatientPageActions() {
    if (patientMicHandlersBound) return;
    patientMicHandlersBound = true;
  }

  window.clearPatientForm = clearPatientForm;
  window.submitPatientForm = submitPatientForm;
  window.resetKiosk = resetKiosk;

  window.addEventListener('storage', (event) => {
    if (event.key === patientRecordKey) syncPatientReviewFromStore();
  });
  window.addEventListener('focus', syncPatientReviewFromStore);
  window.addEventListener('pageshow', restorePatientPageState);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncPatientReviewFromStore();
      restorePatientPageState();
    }
  });
  restorePatientPageState();
  bindPatientPageActions();
}

/* ══ STAFF PAGE ══ */
if (isStaffPage) {

  let isEditing    = false;
  let isVitalsEdit = false;

  const patientFields = ['s-name','s-age','s-gender','s-symptoms','s-allergies','s-conditions','s-medications'];
  const vitalsFields  = ['v-bp','v-hr','v-temp','v-spo2'];

  function formatToken(token) {
    return `#${String(token).padStart(3, '0')}`;
  }

  function hasSubmittedPatientRecord() {
    try {
      const data = JSON.parse(localStorage.getItem('mediAI_patient') || '{}');
      return Boolean(data && data.name && data.timestamp);
    } catch (e) {
      return false;
    }
  }

  function syncSaveButtonState() {
    const btnSave = document.getElementById('btn-save');
    if (!btnSave) return;
    btnSave.disabled = !isEditing && !hasSubmittedPatientRecord();
  }

  function updateTokenDisplay(token) {
    const tokenEl = document.querySelector('.sb-pid');
    if (!tokenEl) return;
    tokenEl.textContent = token ? `Token ${formatToken(token)}` : 'Token Pending';
  }

  function setVitalsDisplay(vitals) {
    const bp   = cleanFieldValue(vitals && vitals.bp)   || '--';
    const hr   = cleanFieldValue(vitals && vitals.hr)   || '--';
    const temp = cleanFieldValue(vitals && vitals.temp) || '--';
    const spo2 = cleanFieldValue(vitals && vitals.spo2) || '--';

    setVal('v-bp', bp);
    setVal('v-hr', hr);
    setVal('v-temp', temp);
    setVal('v-spo2', spo2);

    const sbBp = document.getElementById('sb-bp');
    const sbHr = document.getElementById('sb-hr');
    const sbTemp = document.getElementById('sb-temp');
    const sbSpo2 = document.getElementById('sb-spo2');
    if (sbBp) sbBp.textContent = bp;
    if (sbHr) sbHr.textContent = hr;
    if (sbTemp) sbTemp.textContent = temp;
    if (sbSpo2) sbSpo2.textContent = spo2;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function resetAIAnalysis() {
    const banner = document.getElementById('ai-alert-banner');
    const insightText = document.getElementById('ai-insight-text');
    if (banner) banner.style.display = 'none';
    if (insightText) insightText.textContent = 'No symptom analysis available yet.';
    setPriority('Normal', document.querySelector('.ppill-normal'));
  }

  function resetStaffDisplay() {
    setVal('s-name', '');
    setVal('s-age', '');
    setSelect('s-gender', '');
    setVal('s-symptoms', '');
    setVal('s-allergies', '');
    setVal('s-conditions', '');
    setVal('s-medications', '');
    setText('sb-name', 'No active patient');
    setText('staff-breadcrumb', 'No active patient');
    setText('last-updated', '—');
    const notesEl = document.getElementById('staff-notes');
    if (notesEl) notesEl.value = '';
    updateTokenDisplay();
    setVitalsDisplay();
    resetAIAnalysis();
  }

  function loadPatientData() {
    const raw = localStorage.getItem('mediAI_patient');
    if (!raw) {
      resetStaffDisplay();
      syncSaveButtonState();
      return;
    }
    try {
      const d = JSON.parse(raw);
      const name = cleanFieldValue(d.name);
      const age = cleanFieldValue(d.age);
      const gender = cleanFieldValue(d.gender);
      const symptoms = cleanFieldValue(d.symptoms);
      const allergies = cleanFieldValue(d.allergies);
      const conditions = cleanFieldValue(d.conditions);
      const medications = cleanFieldValue(d.medications);

      setVal('s-name', name);
      setVal('s-age', age);
      setSelect('s-gender', gender);
      setVal('s-symptoms', symptoms);
      setVal('s-allergies', allergies);
      setVal('s-conditions', conditions);
      setVal('s-medications', medications);
      setText('sb-name', name || 'No active patient');
      setText('staff-breadcrumb', name || 'No active patient');
      if (document.getElementById('staff-notes')) {
        document.getElementById('staff-notes').value = getStoredStaffNotes(d);
      }
      updateTokenDisplay(d.token);
      setVitalsDisplay(d.vitals);
      setText('last-updated', formatDisplayTime(d.timestamp).replace('--', '—'));
      if (symptoms) {
        runAIAnalysis(symptoms);
      } else {
        resetAIAnalysis();
      }
    } catch(e) {
      resetStaffDisplay();
    }
    syncSaveButtonState();
  }

  function setVal(id, val)    { const el = document.getElementById(id); if (el) el.value = val; }
  function setSelect(id, val) {
    const el = document.getElementById(id); if (!el) return;
    if (!val) {
      el.selectedIndex = 0;
      return;
    }
    for (let i = 0; i < el.options.length; i++) {
      if (el.options[i].text === val || el.options[i].value === val) {
        el.selectedIndex = i;
        return;
      }
    }
    el.selectedIndex = 0;
  }

  function runAIAnalysis(symptoms) {
    const s = symptoms.toLowerCase();
    const banner      = document.getElementById('ai-alert-banner');
    const insightText = document.getElementById('ai-insight-text');
    let alert = null, insight = '', autoPriority = 'Normal';

    if (s.includes('chest pain') || s.includes('breathing') || s.includes('shortness of breath')) {
      alert = { type:'red', msg:'⚠ HIGH PRIORITY - Chest discomfort or breathing difficulty detected. Recommend immediate clinical review and vital monitoring.' };
      insight = 'Reported symptoms need urgent clinician attention. Verify vital signs, keep the patient under close observation, and escalate without delay if symptoms persist or worsen.';
      autoPriority = 'Critical';
    } else if (s.includes('fever') && (s.includes('cough') || s.includes('cold'))) {
      alert = { type:'amber', msg:'⚠ Fever with cough or cold symptoms detected. Consider precautionary measures and staff review.' };
      insight = 'This symptom pattern should be assessed clinically. Monitor temperature and respiratory status, document symptom progression, and follow clinician guidance for any next steps.';
      autoPriority = 'Urgent';
    } else if (s.includes('fever') && s.includes('rash')) {
      alert = { type:'amber', msg:'⚠ Fever with rash detected. Review recent medications and exposures.' };
      insight = 'This combination should be reviewed carefully by staff. Document onset, spread, and associated symptoms, then follow clinician guidance for further evaluation.';
      autoPriority = 'Urgent';
    } else if (s.includes('headache') && s.includes('vomit')) {
      alert = { type:'amber', msg:'⚠ Headache with vomiting detected. Prompt clinical review is advised.' };
      insight = 'These symptoms should be assessed with the full clinical picture and current vitals. Monitor closely and escalate if pain intensifies, vomiting continues, or new symptoms appear.';
      autoPriority = 'Urgent';
    } else if (s.includes('fever')) {
      insight = 'Fever detected. Monitor temperature regularly, note any associated symptoms, and keep the clinician updated if it persists or worsens.';
    } else {
      insight = 'No high-priority symptom flags detected. Continue routine monitoring. Update notes with any changes in patient condition.';
    }

    if (alert) {
      banner.className = `ai-alert-banner ai-alert-${alert.type}`;
      banner.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2.5"/></svg><span>${alert.msg}</span>`;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }

    insightText.textContent = insight;
    setPriority(autoPriority, document.querySelector(`.ppill-${autoPriority.toLowerCase()}`));
  }

  function toggleEdit() {
    isEditing = !isEditing;
    const inputs  = patientFields.map(id => document.getElementById(id)).filter(Boolean);
    const btnEdit = document.getElementById('btn-edit');
    const btnSave = document.getElementById('btn-save');
    const badge   = document.getElementById('lock-badge');

    if (isEditing) {
      inputs.forEach(el => { el.disabled = false; });
      btnEdit.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg> Cancel`;
      btnEdit.classList.add('cancel');
      btnSave.disabled = false;
      badge.innerHTML  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg> Editing`;
      badge.classList.add('editing');
      document.getElementById('s-name').focus();
    } else {
      inputs.forEach(el => { el.disabled = true; });
      btnEdit.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg> Edit`;
      btnEdit.classList.remove('cancel');
      syncSaveButtonState();
      badge.innerHTML  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Locked`;
      badge.classList.remove('editing');
    }
  }

  function saveRecord() {
    const name     = document.getElementById('s-name').value.trim();
    const symptoms = document.getElementById('s-symptoms').value.trim();
    if (!name) { highlightError(document.getElementById('s-name')); return; }

    patientFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('field-flash'); setTimeout(() => el.classList.remove('field-flash'), 800); }
    });

    document.getElementById('sb-name').textContent = name;
    if (symptoms) runAIAnalysis(symptoms);

    const now = new Date();
    document.getElementById('last-updated').textContent =
      now.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) + ' at ' +
      now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});

    const d = getPatientRecord();
    d.name        = name;
    d.age         = document.getElementById('s-age').value.trim();
    d.symptoms    = symptoms;
    d.allergies   = document.getElementById('s-allergies').value.trim();
    d.conditions  = document.getElementById('s-conditions').value.trim();
    d.medications = document.getElementById('s-medications').value.trim();
    d.timestamp   = now.toISOString();
    d.workflowStage = hasCompleteVitals(d) ? 'ready_for_doctor' : 'registered';
    d.staffConfirmed = true;
    setPatientRecord(d);
    updateTokenDisplay(d.token);

  isEditing = true;
  toggleEdit();
  showToast(d.token ? 'Record saved successfully.' : 'Record saved. Token is still pending.');
  }

  function toggleVitalsEdit() {
    isVitalsEdit = !isVitalsEdit;
    const btn = document.getElementById('btn-vitals-edit');
    vitalsFields.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = !isVitalsEdit; });

    if (isVitalsEdit) {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="2"/><polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" stroke-width="2"/></svg> Save Vitals`;
      btn.classList.add('s-btn-save');
      btn.classList.remove('s-btn-edit');
      return;
    }

    const d = getPatientRecord();
    d.vitals = {
      bp: cleanFieldValue(document.getElementById('v-bp').value),
      hr: cleanFieldValue(document.getElementById('v-hr').value),
      temp: cleanFieldValue(document.getElementById('v-temp').value),
      spo2: cleanFieldValue(document.getElementById('v-spo2').value),
      updatedAt: new Date().toISOString()
    };
    if (d.name) d.workflowStage = hasCompleteVitals(d) ? 'ready_for_doctor' : 'registered';
    setPatientRecord(d);
    setVitalsDisplay(d.vitals);
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg> Edit`;
    btn.classList.remove('s-btn-save');
    btn.classList.add('s-btn-edit');
    showToast('Vitals updated.');
  }

  function setPriority(level, clickedBtn) {
    document.querySelectorAll('.ppill').forEach(b => b.classList.remove('active'));
    if (clickedBtn) clickedBtn.classList.add('active');
    const badge = document.getElementById('priority-badge');
    badge.className = 'priority-badge';
    document.getElementById('priority-label').textContent = level;
    if (level === 'Urgent')   badge.classList.add('urgent');
    if (level === 'Critical') badge.classList.add('critical');
  }

  function saveNotes() {
    const notes = document.getElementById('staff-notes').value.trim();
    localStorage.setItem('mediAI_notes', notes);
    const patientData = getPatientRecord();
    if (patientData && Object.keys(patientData).length > 0) {
      if (notes) patientData.staffNotes = notes;
      else delete patientData.staffNotes;
      setPatientRecord(patientData);
    }
    const el = document.getElementById('notes-saved');
    el.textContent = 'Saved at ' + new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
    showToast('Staff notes saved.');
  }

  function showToast(msg) {
    const t = document.getElementById('s-toast');
    document.getElementById('s-toast-msg').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }

  function highlightError(el) {
    el.style.borderColor = '#ef4444';
    el.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.1)';
    el.focus();
    setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 2000);
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'mediAI_patient') loadPatientData();
  });
  window.addEventListener('focus', loadPatientData);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadPatientData();
  });

  updateTokenDisplay();
  loadPatientData();

  const defaultSymptoms = document.getElementById('s-symptoms') ? document.getElementById('s-symptoms').value : '';
  if (defaultSymptoms) runAIAnalysis(defaultSymptoms);
}

/* VITALS PAGE */
if (isVitalsPage) {

  let vitalsTokenConfirmed = false;
  let activeVitalsPatient = null;
  const vitalsFieldIds = ['vt-bp', 'vt-hr', 'vt-temp', 'vt-spo2'];
  const patientLookupApiBaseUrl = buildApiUrl('/api/patient');
  const vitalsSaveApiUrl = buildApiUrl('/api/vitals');

  function setVitalsPageField(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = cleanFieldValue(value);
  }

  function setVitalsPageText(id, value, fallback = '--') {
    const el = document.getElementById(id);
    if (el) el.textContent = cleanFieldValue(value) || fallback;
  }

  function normalizeTokenInput(value) {
    const digits = String(value || '').replace(/[^0-9]/g, '');
    return digits ? String(Number(digits)) : '';
  }

  function getActiveVitalsPatient() {
    return activeVitalsPatient || {};
  }

  function setActiveVitalsPatient(data) {
    activeVitalsPatient = data && Object.keys(data).length > 0 ? data : null;
  }

  function normalizeVitalsPatientResponse(responseData) {
    const patient = responseData && responseData.patient ? responseData.patient : {};
    const visit = responseData && responseData.visit ? responseData.visit : {};

    return {
      id: patient.id,
      patientId: patient.id,
      visitId: visit.id,
      name: patient.name || '',
      age: patient.age || '',
      gender: patient.gender || '',
      symptoms: visit.symptoms || '',
      allergies: visit.allergies || '',
      conditions: visit.conditions || '',
      medications: visit.medications || '',
      token: responseData.token || visit.token_number || '',
      timestamp: visit.created_at || patient.created_at || '',
      workflowStage: visit.status || 'registered',
      vitals: visit.vitals || null
    };
  }

  function setVitalsInputsEnabled(enabled) {
    vitalsFieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
    const saveBtn = document.getElementById('vt-save-btn');
    if (saveBtn) saveBtn.disabled = !enabled;
  }

  function showVitalsToast(msg) {
    const toast = document.getElementById('s-toast');
    const toastMsg = document.getElementById('s-toast-msg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function highlightVitalsError(el) {
    if (!el) return;
    el.style.borderColor = '#ef4444';
    el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.1)';
    el.focus();
    setTimeout(() => {
      el.style.borderColor = '';
      el.style.boxShadow = '';
    }, 2000);
  }

  function updateReadyTag(mode, label) {
    const tag = document.getElementById('vt-ready-tag');
    if (!tag) return;
    tag.className = 'ai-tag';
    if (mode === 'waiting') tag.classList.add('status-waiting');
    if (mode === 'ready') tag.classList.add('status-ready');
    if (mode === 'complete') tag.classList.add('status-complete');
    tag.textContent = label;
  }

  function updateStatusBadge(label, mode) {
    const badge = document.getElementById('vt-status-badge');
    const text = document.getElementById('vt-status-label');
    if (badge) {
      badge.className = 'priority-badge';
      if (mode === 'waiting') badge.classList.add('urgent');
      if (mode === 'ready') badge.classList.add('info');
    }
    if (text) text.textContent = label;
  }

  function updateBanner(message, tone = 'blue') {
    const banner = document.getElementById('vt-banner');
    const text = document.getElementById('vt-banner-text');
    if (banner) banner.className = `ai-alert-banner ai-alert-${tone}`;
    if (text) text.textContent = message;
  }

  function updateWorkflowSteps(data) {
    const stepRegistration = document.getElementById('vt-step-registration');
    const stepCapture = document.getElementById('vt-step-capture');
    const stepReady = document.getElementById('vt-step-ready');
    [stepRegistration, stepCapture, stepReady].forEach(step => {
      if (step) step.className = 'vitals-step';
    });

    if (data.token && stepRegistration) stepRegistration.classList.add('complete');

    if (data.token && !hasCompleteVitals(data) && stepCapture) {
      stepCapture.classList.add('active');
    }

    if (hasCompleteVitals(data)) {
      if (stepCapture) stepCapture.classList.add('complete');
      if (stepReady) stepReady.classList.add('active');
    }
  }

  function renderVitalsPage(data) {
    const hasRegistration = Boolean(data && data.name);
    const hasToken = Boolean(data && data.token);
    const vitalsDone = hasCompleteVitals(data);
    const patientUnlocked = Boolean(hasRegistration && hasToken && vitalsTokenConfirmed);
    const formattedToken = formatSharedToken(data.token);
    const tokenInput = document.getElementById('vt-token-input');
    const lookupHelper = document.getElementById('vt-lookup-helper');
    const sideNote = document.getElementById('vt-side-note');
    const savedAt = document.getElementById('vt-saved-at');
    const lastSync = document.getElementById('vt-last-sync');

    document.getElementById('vt-side-name').textContent = patientUnlocked ? data.name : 'No active patient';
    document.getElementById('vt-side-token').textContent = patientUnlocked
      ? `Token ${formattedToken}`
      : (hasToken ? 'Token Locked' : 'Token Pending');
    setVitalsPageText('vt-side-age', patientUnlocked ? data.age : '');
    setVitalsPageText('vt-side-gender', patientUnlocked ? data.gender : '');
    setVitalsPageText('vt-side-submitted', patientUnlocked ? formatDisplayTime(data.timestamp) : '');
    setVitalsPageText('vt-side-token-text', patientUnlocked ? formattedToken : (hasToken ? 'Locked' : 'Pending'), hasToken ? 'Locked' : 'Pending');
    setVitalsPageText('vt-side-bp', patientUnlocked ? data.vitals && data.vitals.bp : '');
    setVitalsPageText('vt-side-hr', patientUnlocked ? data.vitals && data.vitals.hr : '');
    setVitalsPageText('vt-side-temp', patientUnlocked ? data.vitals && data.vitals.temp : '');
    setVitalsPageText('vt-side-spo2', patientUnlocked ? data.vitals && data.vitals.spo2 : '');

    document.getElementById('vt-breadcrumb-name').textContent = patientUnlocked ? data.name : 'No active case';
    setVitalsPageField('vt-name', patientUnlocked ? data.name : '');
    setVitalsPageField('vt-age', patientUnlocked ? data.age : '');
    setVitalsPageField('vt-gender', patientUnlocked ? data.gender : '');
    setVitalsPageField('vt-token-display', patientUnlocked ? formattedToken : '');
    setVitalsPageField('vt-allergies', patientUnlocked ? data.allergies : '');
    setVitalsPageField('vt-conditions', patientUnlocked ? data.conditions : '');
    setVitalsPageField('vt-symptoms', patientUnlocked ? data.symptoms : '');
    setVitalsPageField('vt-medications', patientUnlocked ? data.medications : '');
    setVitalsPageField('vt-staff-notes', patientUnlocked ? getStoredStaffNotes(data) : '');
    setVitalsPageField('vt-bp', patientUnlocked ? data.vitals && data.vitals.bp : '');
    setVitalsPageField('vt-hr', patientUnlocked ? data.vitals && data.vitals.hr : '');
    setVitalsPageField('vt-temp', patientUnlocked ? data.vitals && data.vitals.temp : '');
    setVitalsPageField('vt-spo2', patientUnlocked ? data.vitals && data.vitals.spo2 : '');

    if (savedAt) {
      savedAt.textContent = patientUnlocked && vitalsDone
        ? `Vitals saved ${formatDisplayTime(data.vitals.updatedAt)}`
        : (hasToken ? 'Load the patient by token to view or edit vitals.' : 'No vitals saved yet.');
    }

    if (lastSync) {
      lastSync.textContent = patientUnlocked
        ? formatDisplayTime((data.vitals && data.vitals.updatedAt) || data.timestamp)
        : '--';
    }

    if (!hasRegistration) {
      vitalsTokenConfirmed = false;
      updateStatusBadge('Awaiting Registration', 'waiting');
      updateReadyTag('waiting', 'Waiting');
      updateBanner('Waiting for a patient record from the registration desk.', 'blue');
      if (lookupHelper) lookupHelper.textContent = 'Registration staff must save the patient record before vitals can start.';
      if (sideNote) sideNote.textContent = 'Registration staff must assign a token before vitals can be recorded.';
    } else if (!hasToken) {
      vitalsTokenConfirmed = false;
      updateStatusBadge('Token Pending', 'waiting');
      updateReadyTag('waiting', 'Token Pending');
      updateBanner('Registration data is available, but a token is not yet available for this patient.', 'amber');
      if (lookupHelper) lookupHelper.textContent = 'The registration request must complete successfully before vitals can start.';
      if (sideNote) sideNote.textContent = 'The patient is registered, but the token is still pending from the registration desk.';
    } else if (!vitalsTokenConfirmed) {
      updateStatusBadge('Token Required', 'waiting');
      updateReadyTag('waiting', 'Locked');
      updateBanner('Enter the issued registration token to load this patient in the vitals panel.', 'amber');
      if (lookupHelper) lookupHelper.textContent = 'Patient details stay hidden until the correct token is entered here.';
      if (sideNote) sideNote.textContent = 'This panel stays locked until the patient token is confirmed manually.';
    } else if (vitalsDone) {
      updateStatusBadge('Ready for Doctor', 'complete');
      updateReadyTag('complete', 'Complete');
      updateBanner('Vitals are captured. This case is ready for doctor review.', 'blue');
      if (lookupHelper) {
        lookupHelper.textContent = 'Token confirmed. You can review or update the saved vitals if needed.';
      }
      if (sideNote) sideNote.textContent = 'Vitals are complete. The doctor handoff can happen from this point.';
    } else {
      updateStatusBadge('Ready for Vitals', 'ready');
      updateReadyTag('ready', 'Ready');
      updateBanner('Token confirmed. Capture all four vitals and save the record.', 'blue');
      if (lookupHelper) {
        lookupHelper.textContent = 'Vitals entry is unlocked for this patient.';
      }
      if (sideNote) sideNote.textContent = 'Vitals desk can continue as soon as the registration token is confirmed.';
    }

    updateWorkflowSteps(patientUnlocked ? data : {});
    setVitalsInputsEnabled(patientUnlocked);
  }

  async function loadVitalsPatientByToken() {
    const tokenInput = document.getElementById('vt-token-input');
    const enteredToken = normalizeTokenInput(tokenInput ? tokenInput.value : '');

    if (!enteredToken) {
      vitalsTokenConfirmed = false;
      setActiveVitalsPatient(null);
      if (tokenInput) highlightVitalsError(tokenInput);
      renderVitalsPage({});
      updateBanner('Enter the registration token before capturing vitals.', 'amber');
      showVitalsToast('Enter the registration token to continue.');
      return;
    }

    try {
      let response;
      let responseData = {};

      try {
        response = await fetch(`${patientLookupApiBaseUrl}/${enteredToken}`);
        responseData = await response.json().catch(() => ({}));
      } catch (error) {
        throw new Error(
          mapApiRequestError(
            error,
            `${patientLookupApiBaseUrl}/${enteredToken}`,
            'Unable to load patient.'
          )
        );
      }

      if (!response.ok) {
        throw new Error(responseData.message || 'Unable to load patient.');
      }

      const patientData = normalizeVitalsPatientResponse(responseData);
      setActiveVitalsPatient(patientData);
      vitalsTokenConfirmed = true;
      renderVitalsPage(patientData);
      showVitalsToast(hasCompleteVitals(patientData) ? 'Patient loaded. Existing vitals are ready to review.' : 'Patient loaded. Vitals entry is now unlocked.');
    } catch (error) {
      vitalsTokenConfirmed = false;
      setActiveVitalsPatient(null);
      renderVitalsPage({});
      updateBanner(error.message || 'Patient not found for this token.', 'amber');
      showVitalsToast(error.message || 'Patient not found for this token.');
    }
  }

  async function saveVitalsRecord() {
    const data = { ...getActiveVitalsPatient() };
    const tokenInput = document.getElementById('vt-token-input');
    const enteredToken = normalizeTokenInput(tokenInput ? tokenInput.value : '');
    const storedToken = normalizeTokenInput(data.token);
    const bp = cleanFieldValue(document.getElementById('vt-bp').value);
    const hr = cleanFieldValue(document.getElementById('vt-hr').value);
    const temp = cleanFieldValue(document.getElementById('vt-temp').value);
    const spo2 = cleanFieldValue(document.getElementById('vt-spo2').value);

    if (!data.token || enteredToken !== storedToken || !vitalsTokenConfirmed) {
      vitalsTokenConfirmed = false;
      renderVitalsPage(data);
      updateBanner('Confirm the patient token before saving vitals.', 'amber');
      showVitalsToast('Token confirmation is required before saving vitals.');
      return;
    }

    if (!bp) { highlightVitalsError(document.getElementById('vt-bp')); return; }
    if (!hr) { highlightVitalsError(document.getElementById('vt-hr')); return; }
    if (!temp) { highlightVitalsError(document.getElementById('vt-temp')); return; }
    if (!spo2) { highlightVitalsError(document.getElementById('vt-spo2')); return; }

    try {
      let response;
      let responseData = {};

      try {
        response = await fetch(vitalsSaveApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token_number: Number(enteredToken),
            blood_pressure: bp,
            heart_rate: hr,
            temperature: temp,
            spo2
          })
        });

        responseData = await response.json().catch(() => ({}));
      } catch (error) {
        throw new Error(
          mapApiRequestError(
            error,
            vitalsSaveApiUrl,
            'Unable to save vitals.'
          )
        );
      }

      if (!response.ok) {
        throw new Error(responseData.message || 'Unable to save vitals.');
      }

      data.vitals = {
        bp,
        hr,
        temp,
        spo2,
        updatedAt: (responseData.vitals && responseData.vitals.created_at) || new Date().toISOString()
      };
      data.workflowStage = 'vitals_done';
      setActiveVitalsPatient(data);
      vitalsTokenConfirmed = true;
      renderVitalsPage(data);
      updateBanner('Vitals saved. This case is ready for doctor review.', 'blue');
      showVitalsToast('Vitals saved.');
    } catch (error) {
      updateBanner(error.message || 'Unable to save vitals.', 'amber');
      showVitalsToast(error.message || 'Unable to save vitals.');
    }
  }

  function refreshVitalsPage() {
    const data = getActiveVitalsPatient();
    const tokenInput = document.getElementById('vt-token-input');
    const enteredToken = normalizeTokenInput(tokenInput ? tokenInput.value : '');
    const storedToken = normalizeTokenInput(data.token);

    if (vitalsTokenConfirmed && (!data.token || enteredToken !== storedToken)) {
      vitalsTokenConfirmed = false;
    }

    renderVitalsPage(data);
  }

  window.loadVitalsPatientByToken = loadVitalsPatientByToken;
  window.saveVitalsRecord = saveVitalsRecord;

  const tokenInput = document.getElementById('vt-token-input');
  if (tokenInput) {
    tokenInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void loadVitalsPatientByToken();
      }
    });
    tokenInput.addEventListener('input', () => {
      const data = getActiveVitalsPatient();
      const enteredToken = normalizeTokenInput(tokenInput.value);
      const storedToken = normalizeTokenInput(data.token);
      if (vitalsTokenConfirmed && enteredToken !== storedToken) {
        vitalsTokenConfirmed = false;
        renderVitalsPage(data);
      }
    });
  }
  window.addEventListener('focus', refreshVitalsPage);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshVitalsPage();
  });

  refreshVitalsPage();
}

