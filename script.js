const isPatientPage = document.body.classList.contains('patient-body');
const isStaffPage   = document.body.classList.contains('staff-body');

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
      return { type:'red', msg:'⚠ High Priority Case — Possible cardiac or respiratory emergency. Notify staff immediately.' };
    }
    if (s.includes('fever') && (s.includes('cough') || s.includes('cold'))) {
      return { type:'amber', msg:'🤧 Possible Flu — Fever + cough combination detected. Isolation may be recommended.' };
    }
    if (s.includes('fever') && s.includes('rash')) {
      return { type:'amber', msg:'⚠ Possible Allergic Reaction — Fever with rash detected. Inform staff of recent medication changes.' };
    }
    if (s.includes('headache') && s.includes('vomit')) {
      return { type:'amber', msg:'⚠ Possible Neurological Concern — Inform staff if symptoms worsened suddenly.' };
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
      setTimeout(() => doSubmit(name), 2000);
      return;
    }
    alertEl.style.display = 'none';
    doSubmit(name);
  }

  function doSubmit(name) {
    const data = {
      name:        document.getElementById('p-name').value.trim(),
      age:         document.getElementById('p-age').value.trim(),
      gender:      document.getElementById('p-gender').value,
      symptoms:    document.getElementById('p-symptoms').value.trim(),
      allergies:   document.getElementById('p-allergies').value.trim(),
      conditions:  document.getElementById('p-conditions').value.trim(),
      medications: document.getElementById('p-medications').value.trim(),
      timestamp:   new Date().toISOString(),
      token:       Math.floor(Math.random() * 900) + 100
    };
    localStorage.setItem('mediAI_patient', JSON.stringify(data));
    document.querySelector('.kiosk-card').style.display = 'none';
    const successEl = document.getElementById('kiosk-success');
    successEl.style.display = 'block';
    document.getElementById('success-token-num').textContent = `#0${data.token}`;
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
    document.querySelector('.kiosk-card').style.display = 'block';
    document.getElementById('kiosk-success').style.display = 'none';
  }
}

/* ══ STAFF PAGE ══ */
if (isStaffPage) {

  let isEditing    = false;
  let isVitalsEdit = false;

  const patientFields = ['s-name','s-age','s-gender','s-symptoms','s-allergies','s-conditions','s-medications'];
  const vitalsFields  = ['v-bp','v-hr','v-temp','v-spo2'];

  function loadPatientData() {
    const raw = localStorage.getItem('mediAI_patient');
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.name)        { setVal('s-name', d.name); document.getElementById('sb-name').textContent = d.name; }
      if (d.age)         setVal('s-age',        d.age);
      if (d.gender)      setSelect('s-gender',  d.gender);
      if (d.symptoms)    setVal('s-symptoms',    d.symptoms);
      if (d.allergies)   setVal('s-allergies',   d.allergies);
      if (d.conditions)  setVal('s-conditions',  d.conditions);
      if (d.medications) setVal('s-medications', d.medications);
      if (d.timestamp) {
        const ts = new Date(d.timestamp);
        document.getElementById('last-updated').textContent =
          ts.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) + ' at ' +
          ts.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
      }
      if (d.symptoms) runAIAnalysis(d.symptoms);
    } catch(e) {}
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
      alert = { type:'red', msg:'⚠ HIGH PRIORITY — Possible cardiac or respiratory emergency. Recommend immediate ECG and SpO₂ monitoring.' };
      insight = 'Symptoms strongly suggest a possible acute respiratory or cardiac event. Differential: pneumonia, pulmonary embolism, angina. Recommend ECG, chest X-ray, troponin levels. Do NOT delay — escalate immediately.';
      autoPriority = 'Critical';
    } else if (s.includes('fever') && (s.includes('cough') || s.includes('cold'))) {
      alert = { type:'amber', msg:'🤧 Possible Flu — Fever + cough combination detected. Consider isolation protocol.' };
      insight = 'Symptom combination of fever and cough is consistent with influenza or viral URTI. Recommend rapid flu test, CBC, CRP. Isolation advised.';
      autoPriority = 'Urgent';
    } else if (s.includes('fever') && s.includes('rash')) {
      alert = { type:'amber', msg:'⚠ Possible Allergic Reaction — Fever with rash detected. Review recent medications.' };
      insight = 'Fever combined with rash may indicate allergic drug reaction, viral exanthem, or dengue. Recommend CBC with differential and dengue serology if applicable.';
      autoPriority = 'Urgent';
    } else if (s.includes('headache') && s.includes('vomit')) {
      alert = { type:'amber', msg:'⚠ Neurological Concern — Headache with vomiting. Rule out meningitis or hypertensive crisis.' };
      insight = 'Headache and vomiting together may indicate elevated ICP, migraine with nausea, or hypertensive emergency. Check BP immediately.';
      autoPriority = 'Urgent';
    } else if (s.includes('fever')) {
      insight = 'Fever detected. Monitor temperature q2h. Recommend CBC if fever >38.5°C persists beyond 48 hours.';
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
      btnSave.disabled = true;
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

    const d = JSON.parse(localStorage.getItem('mediAI_patient') || '{}');
    d.name        = name;
    d.age         = document.getElementById('s-age').value.trim();
    d.symptoms    = symptoms;
    d.allergies   = document.getElementById('s-allergies').value.trim();
    d.conditions  = document.getElementById('s-conditions').value.trim();
    d.medications = document.getElementById('s-medications').value.trim();
    d.timestamp   = now.toISOString();
    localStorage.setItem('mediAI_patient', JSON.stringify(d));

    isEditing = true;
    toggleEdit();
    showToast('Record saved successfully.');
  }

  function toggleVitalsEdit() {
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

  loadPatientData();

  const savedNotes = localStorage.getItem('mediAI_notes');
  if (savedNotes && document.getElementById('staff-notes')) {
    document.getElementById('staff-notes').value = savedNotes;
  }

  const defaultSymptoms = document.getElementById('s-symptoms') ? document.getElementById('s-symptoms').value : '';
  if (defaultSymptoms) runAIAnalysis(defaultSymptoms);
}