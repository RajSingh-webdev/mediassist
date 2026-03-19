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
  const patientStatusKey = 'mediAI_patient_status';

  function formatPatientToken(token) {
    return `#${String(token).padStart(3, '0')}`;
  }

  function getStoredPatientData() {
    try {
      return JSON.parse(localStorage.getItem('mediAI_patient') || '{}');
    } catch (e) {
      return {};
    }
  }

  function updatePatientReviewStatus() {
    const successEl = document.getElementById('kiosk-success');
    if (!successEl || successEl.style.display === 'none') return;

    const successMsg = successEl.querySelector('.success-msg');
    const tokenStatus = successEl.querySelector('.success-token');
    const data = getStoredPatientData();

    if (!successMsg || !tokenStatus) return;

    if (data.token) {
      successMsg.textContent = 'Your information has been reviewed by staff. Please keep this token ready when your turn is called.';
      tokenStatus.innerHTML = `Your token: <strong>${formatPatientToken(data.token)}</strong>`;
      return;
    }

    successMsg.textContent = 'Your information has been received and sent for staff review. Please take a seat - your token will be assigned after verification.';
    tokenStatus.textContent = 'Token status: Pending staff review';
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
    const data = getStoredPatientData();
    const hasSubmittedRecord = Boolean(data && data.name && data.timestamp);
    const isAwaitingReview = localStorage.getItem(patientStatusKey) === 'submitted';

    if (hasSubmittedRecord && isAwaitingReview) {
      showPatientSuccessScreen();
      return;
    }

    showPatientFormScreen();
  }

  function toggleMic() {
    micActive = !micActive;
    const btn   = document.getElementById('mic-btn');
    const label = document.getElementById('mic-label');
    const bars  = document.getElementById('mic-bars');
    if (micActive) {
      btn.classList.add('mic-active');
      label.innerHTML = `Listening… <span class="mic-soon">(Simulated)</span>`;
      bars.classList.add('active');
    } else {
      btn.classList.remove('mic-active');
      label.innerHTML = `Tap to speak <span class="mic-soon">(Coming Soon)</span>`;
      bars.classList.remove('active');
    }
  }

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

  function submitPatientForm() {
    const name     = document.getElementById('p-name').value.trim();
    const age      = document.getElementById('p-age').value.trim();
    const gender   = document.getElementById('p-gender').value;
    const symptoms = document.getElementById('p-symptoms').value.trim();
    const alertEl  = document.getElementById('p-alert');

    if (!name)    { showFieldError('p-name',    'Please enter your full name.');    return; }
    if (!age)     { showFieldError('p-age',     'Please enter your age.');          return; }
    if (!gender)  { showFieldError('p-gender',  'Please select your gender.');      return; }
    if (!symptoms){ showFieldError('p-symptoms','Please describe your symptoms.');  return; }

    const analysis = analyseSymptoms(symptoms);
    if (analysis) {
      alertEl.className     = `p-alert p-alert-${analysis.type}`;
      alertEl.innerHTML     = analysis.msg;
      alertEl.style.display = 'flex';
      setTimeout(() => doSubmit(), 2000);
      return;
    }
    alertEl.style.display = 'none';
    doSubmit();
  }

  function doSubmit() {
    const data = {
      name:        document.getElementById('p-name').value.trim(),
      age:         document.getElementById('p-age').value.trim(),
      gender:      document.getElementById('p-gender').value,
      symptoms:    document.getElementById('p-symptoms').value.trim(),
      allergies:   document.getElementById('p-allergies').value.trim(),
      conditions:  document.getElementById('p-conditions').value.trim(),
      medications: document.getElementById('p-medications').value.trim(),
      timestamp:   new Date().toISOString(),
      workflowStage: 'submitted'
    };
    localStorage.setItem('mediAI_patient', JSON.stringify(data));
    localStorage.setItem(patientStatusKey, 'submitted');
    showPatientSuccessScreen();
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
    document.getElementById('p-name').focus();
  }

  function resetKiosk() {
    clearPatientForm();
    localStorage.removeItem(patientStatusKey);
    showPatientFormScreen();
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'mediAI_patient') updatePatientReviewStatus();
    if (event.key === patientStatusKey) restorePatientPageState();
  });

  window.addEventListener('pageshow', restorePatientPageState);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) restorePatientPageState();
  });
  setInterval(updatePatientReviewStatus, 1500);
  restorePatientPageState();
}

/* ══ STAFF PAGE ══ */
if (isStaffPage) {

  let isEditing    = false;
  let isVitalsEdit = false;

  const patientFields = ['s-name','s-age','s-gender','s-symptoms','s-allergies','s-conditions','s-medications'];
  const vitalsFields  = ['v-bp','v-hr','v-temp','v-spo2'];

  function generateToken() {
    return Math.floor(Math.random() * 999) + 1;
  }

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
    tokenEl.textContent = token ? `${formatToken(token)} · P-2041` : 'Token Pending · P-2041';
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
    const sbSpo2 = document.getElementById('sb-spo2') || document.querySelectorAll('.staff-sidebar .sb-section')[1]?.querySelectorAll('.sv-val')[3];
    if (sbBp) sbBp.textContent = bp;
    if (sbHr) sbHr.textContent = hr;
    if (sbTemp) sbTemp.textContent = temp;
    if (sbSpo2) sbSpo2.textContent = spo2;
  }

  function loadPatientData() {
    const raw = localStorage.getItem('mediAI_patient');
    if (!raw) {
      setVitalsDisplay();
      syncSaveButtonState();
      return;
    }
    try {
      const d = JSON.parse(raw);
      if (d.name)        { setVal('s-name', d.name); document.getElementById('sb-name').textContent = d.name; }
      if (d.age)         setVal('s-age',        d.age);
      if (d.gender)      setSelect('s-gender',  d.gender);
      if (d.symptoms)    setVal('s-symptoms',    d.symptoms);
      if (d.allergies)   setVal('s-allergies',   d.allergies);
      if (d.conditions)  setVal('s-conditions',  d.conditions);
      if (d.medications) setVal('s-medications', d.medications);
      updateTokenDisplay(d.token);
      setVitalsDisplay(d.vitals);
      if (d.timestamp) {
        const ts = new Date(d.timestamp);
        document.getElementById('last-updated').textContent =
          ts.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) + ' at ' +
          ts.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
      }
      if (d.symptoms) runAIAnalysis(d.symptoms);
    } catch(e) {}
    syncSaveButtonState();
  }

  function setVal(id, val)    { const el = document.getElementById(id); if (el) el.value = val; }
  function setSelect(id, val) {
    const el = document.getElementById(id); if (!el) return;
    for (let i = 0; i < el.options.length; i++) { if (el.options[i].text === val) { el.selectedIndex = i; break; } }
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
    const tokenWasPending = !d.token;
    d.name        = name;
    d.age         = document.getElementById('s-age').value.trim();
    d.symptoms    = symptoms;
    d.allergies   = document.getElementById('s-allergies').value.trim();
    d.conditions  = document.getElementById('s-conditions').value.trim();
    d.medications = document.getElementById('s-medications').value.trim();
    if (!d.token) d.token = generateToken();
    d.timestamp   = now.toISOString();
    d.workflowStage = hasCompleteVitals(d) ? 'ready_for_doctor' : 'registered';
    setPatientRecord(d);
    updateTokenDisplay(d.token);

  isEditing = true;
  toggleEdit();
  showToast(tokenWasPending ? `Record saved. Token ${formatToken(d.token)} assigned.` : 'Record saved successfully.');
  }

  function toggleVitalsEditLegacy() {
    isVitalsEdit = !isVitalsEdit;
    const btn = document.getElementById('btn-vitals-edit');
    vitalsFields.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = !isVitalsEdit; });

    if (isVitalsEdit) {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="2"/><polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" stroke-width="2"/></svg> Save Vitals`;
      btn.classList.add('s-btn-save'); btn.classList.remove('s-btn-edit');
    } else {
      document.getElementById('sb-bp').textContent   = document.getElementById('v-bp').value   || '—';
      document.getElementById('sb-hr').textContent   = document.getElementById('v-hr').value   || '—';
      document.getElementById('sb-temp').textContent = document.getElementById('v-temp').value || '—';
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg> Edit`;
      btn.classList.remove('s-btn-save'); btn.classList.add('s-btn-edit');
      showToast('Vitals updated.');
    }
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

  const savedNotes = localStorage.getItem('mediAI_notes');
  if (savedNotes && document.getElementById('staff-notes')) {
    document.getElementById('staff-notes').value = savedNotes;
  }

  const defaultSymptoms = document.getElementById('s-symptoms') ? document.getElementById('s-symptoms').value : '';
  if (defaultSymptoms) runAIAnalysis(defaultSymptoms);
}

/* VITALS PAGE */
if (isVitalsPage) {

  let vitalsTokenConfirmed = false;
  const vitalsFieldIds = ['vt-bp', 'vt-hr', 'vt-temp', 'vt-spo2'];

  function setVitalsPageField(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = cleanFieldValue(value);
  }

  function setVitalsPageText(id, value, fallback = '--') {
    const el = document.getElementById(id);
    if (el) el.textContent = cleanFieldValue(value) || fallback;
  }

  function normalizeTokenInput(value) {
    return String(value || '').replace(/[^0-9]/g, '');
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
    const formattedToken = formatSharedToken(data.token);
    const tokenInput = document.getElementById('vt-token-input');
    const lookupHelper = document.getElementById('vt-lookup-helper');
    const sideNote = document.getElementById('vt-side-note');
    const savedAt = document.getElementById('vt-saved-at');
    const lastSync = document.getElementById('vt-last-sync');

    document.getElementById('vt-side-name').textContent = hasRegistration ? data.name : 'No active patient';
    document.getElementById('vt-side-token').textContent = hasToken ? `${formattedToken} - P-2041` : 'Token Pending - P-2041';
    setVitalsPageText('vt-side-age', hasRegistration ? data.age : '');
    setVitalsPageText('vt-side-gender', hasRegistration ? data.gender : '');
    setVitalsPageText('vt-side-submitted', hasRegistration ? formatDisplayTime(data.timestamp) : '');
    setVitalsPageText('vt-side-token-text', hasToken ? formattedToken : 'Pending', 'Pending');
    setVitalsPageText('vt-side-bp', data.vitals && data.vitals.bp);
    setVitalsPageText('vt-side-hr', data.vitals && data.vitals.hr);
    setVitalsPageText('vt-side-temp', data.vitals && data.vitals.temp);
    setVitalsPageText('vt-side-spo2', data.vitals && data.vitals.spo2);

    document.getElementById('vt-breadcrumb-name').textContent = hasRegistration ? data.name : 'No active case';
    setVitalsPageField('vt-name', hasRegistration ? data.name : '');
    setVitalsPageField('vt-age', hasRegistration ? data.age : '');
    setVitalsPageField('vt-gender', hasRegistration ? data.gender : '');
    setVitalsPageField('vt-token-display', hasToken ? formattedToken : '');
    setVitalsPageField('vt-allergies', hasRegistration ? data.allergies : '');
    setVitalsPageField('vt-conditions', hasRegistration ? data.conditions : '');
    setVitalsPageField('vt-symptoms', hasRegistration ? data.symptoms : '');
    setVitalsPageField('vt-medications', hasRegistration ? data.medications : '');
    setVitalsPageField('vt-bp', data.vitals && data.vitals.bp);
    setVitalsPageField('vt-hr', data.vitals && data.vitals.hr);
    setVitalsPageField('vt-temp', data.vitals && data.vitals.temp);
    setVitalsPageField('vt-spo2', data.vitals && data.vitals.spo2);

    if (tokenInput && hasToken && !tokenInput.value.trim()) {
      tokenInput.value = formattedToken;
    }

    if (savedAt) {
      savedAt.textContent = vitalsDone
        ? `Vitals saved ${formatDisplayTime(data.vitals.updatedAt)}`
        : 'No vitals saved yet.';
    }

    if (lastSync) {
      lastSync.textContent = formatDisplayTime((data.vitals && data.vitals.updatedAt) || data.timestamp);
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
      updateBanner('Registration data is available, but a token must be generated before vitals can be recorded.', 'amber');
      if (lookupHelper) lookupHelper.textContent = 'Go back to the registration panel and save the record to generate the token.';
      if (sideNote) sideNote.textContent = 'The patient is registered, but the token is still pending from the registration desk.';
    } else if (vitalsDone) {
      updateStatusBadge('Ready for Doctor', 'complete');
      updateReadyTag('complete', 'Complete');
      updateBanner('Vitals are captured. This case is ready for doctor review.', 'blue');
      if (lookupHelper) {
        lookupHelper.textContent = vitalsTokenConfirmed
          ? 'Token confirmed. You can review or update the saved vitals if needed.'
          : 'Token already exists for this patient. Confirm it here to review or update the vitals.';
      }
      if (sideNote) sideNote.textContent = 'Vitals are complete. The doctor handoff can happen from this point.';
    } else {
      updateStatusBadge('Ready for Vitals', 'ready');
      updateReadyTag('ready', 'Ready');
      updateBanner(
        vitalsTokenConfirmed
          ? 'Token confirmed. Capture all four vitals and save the record.'
          : 'Token is available. Confirm it here before entering vitals.',
        'blue'
      );
      if (lookupHelper) {
        lookupHelper.textContent = vitalsTokenConfirmed
          ? 'Vitals entry is unlocked for this patient.'
          : 'Enter or confirm the issued registration token to unlock vitals entry.';
      }
      if (sideNote) sideNote.textContent = 'Vitals desk can continue as soon as the registration token is confirmed.';
    }

    updateWorkflowSteps(data);
    setVitalsInputsEnabled(Boolean(hasRegistration && hasToken && vitalsTokenConfirmed));
  }

  function useCurrentVitalsToken() {
    const data = getPatientRecord();
    const tokenInput = document.getElementById('vt-token-input');
    if (!data.token) {
      showVitalsToast('No registered token is available yet.');
      return;
    }
    if (tokenInput) tokenInput.value = formatSharedToken(data.token);
    loadVitalsPatientByToken();
  }

  function loadVitalsPatientByToken() {
    const data = getPatientRecord();
    const tokenInput = document.getElementById('vt-token-input');
    const enteredToken = normalizeTokenInput(tokenInput ? tokenInput.value : '');

    if (!data.name) {
      vitalsTokenConfirmed = false;
      renderVitalsPage({});
      showVitalsToast('No registered patient is available yet.');
      return;
    }

    if (!data.token) {
      vitalsTokenConfirmed = false;
      renderVitalsPage(data);
      showVitalsToast('Registration must save the record and generate a token first.');
      return;
    }

    if (!enteredToken) {
      vitalsTokenConfirmed = false;
      if (tokenInput) highlightVitalsError(tokenInput);
      renderVitalsPage(data);
      updateBanner('Enter the registration token before capturing vitals.', 'amber');
      showVitalsToast('Enter the registration token to continue.');
      return;
    }

    if (enteredToken !== String(data.token)) {
      vitalsTokenConfirmed = false;
      renderVitalsPage(data);
      updateBanner('Token mismatch. Please confirm the registration token before capturing vitals.', 'amber');
      showVitalsToast('Token mismatch. Please verify the patient token.');
      return;
    }

    vitalsTokenConfirmed = true;
    renderVitalsPage(data);
    showVitalsToast(hasCompleteVitals(data) ? 'Patient loaded. Existing vitals are ready to review.' : 'Patient loaded. Vitals entry is now unlocked.');
  }

  function saveVitalsRecord() {
    const data = getPatientRecord();
    const tokenInput = document.getElementById('vt-token-input');
    const enteredToken = normalizeTokenInput(tokenInput ? tokenInput.value : '');
    const bp = cleanFieldValue(document.getElementById('vt-bp').value);
    const hr = cleanFieldValue(document.getElementById('vt-hr').value);
    const temp = cleanFieldValue(document.getElementById('vt-temp').value);
    const spo2 = cleanFieldValue(document.getElementById('vt-spo2').value);

    if (!data.token || enteredToken !== String(data.token) || !vitalsTokenConfirmed) {
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

    data.vitals = {
      bp,
      hr,
      temp,
      spo2,
      updatedAt: new Date().toISOString()
    };
    data.workflowStage = 'ready_for_doctor';
    setPatientRecord(data);
    vitalsTokenConfirmed = true;
    renderVitalsPage(data);
    showVitalsToast('Vitals saved. Case is ready for doctor review.');
  }

  function refreshVitalsPage() {
    const data = getPatientRecord();
    const tokenInput = document.getElementById('vt-token-input');
    const enteredToken = normalizeTokenInput(tokenInput ? tokenInput.value : '');

    if (vitalsTokenConfirmed && (!data.token || enteredToken !== String(data.token))) {
      vitalsTokenConfirmed = false;
    }

    renderVitalsPage(data);
  }

  window.useCurrentVitalsToken = useCurrentVitalsToken;
  window.loadVitalsPatientByToken = loadVitalsPatientByToken;
  window.saveVitalsRecord = saveVitalsRecord;

  const tokenInput = document.getElementById('vt-token-input');
  if (tokenInput) {
    tokenInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        loadVitalsPatientByToken();
      }
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key === patientRecordKey) refreshVitalsPage();
  });
  window.addEventListener('focus', refreshVitalsPage);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshVitalsPage();
  });

  refreshVitalsPage();
}
