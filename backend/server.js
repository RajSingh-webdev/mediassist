const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { supabase, hasSupabaseConfig } = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

function generateTokenNumber() {
  return Math.floor(100 + Math.random() * 900);
}

function toNullableString(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

app.get('/api/patient/:token', async (req, res) => {
  try {
    const tokenNumber = Number(req.params.token);

    if (Number.isNaN(tokenNumber)) {
      return res.status(400).json({
        success: false,
        message: 'A valid token is required.'
      });
    }

    if (!hasSupabaseConfig) {
      return res.status(500).json({
        success: false,
        message: 'Supabase credentials are not configured.'
      });
    }

    const { data: visitData, error: visitError } = await supabase
      .from('visits')
      .select()
      .eq('token_number', tokenNumber)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (visitError) {
      throw visitError;
    }

    if (!visitData) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found for this token.'
      });
    }

    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select()
      .eq('id', visitData.patient_id)
      .single();

    if (patientError) {
      throw patientError;
    }

    const { data: vitalsData, error: vitalsError } = await supabase
      .from('vitals')
      .select()
      .eq('visit_id', visitData.id)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (vitalsError) {
      throw vitalsError;
    }

    return res.status(200).json({
      success: true,
      token: visitData.token_number,
      patient: patientData,
      visit: {
        ...visitData,
        vitals: vitalsData || null
      }
    });
  } catch (error) {
    console.error('Error fetching patient by token:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

app.post('/api/vitals', async (req, res) => {
  try {
    const {
      token_number,
      blood_pressure,
      heart_rate,
      temperature,
      spo2
    } = req.body;

    const tokenNumber = Number(token_number);
    const normalizedBloodPressure = toNullableString(blood_pressure);
    const normalizedHeartRate = toNullableString(heart_rate);
    const normalizedTemperature = toNullableString(temperature);
    const normalizedSpo2 = toNullableString(spo2);

    if (
      Number.isNaN(tokenNumber) ||
      !normalizedBloodPressure ||
      !normalizedHeartRate ||
      !normalizedTemperature ||
      !normalizedSpo2
    ) {
      return res.status(400).json({
        success: false,
        message: 'token_number, blood_pressure, heart_rate, temperature, and spo2 are required.'
      });
    }

    if (!hasSupabaseConfig) {
      return res.status(500).json({
        success: false,
        message: 'Supabase credentials are not configured.'
      });
    }

    const { data: visitData, error: visitError } = await supabase
      .from('visits')
      .select()
      .eq('token_number', tokenNumber)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (visitError) {
      throw visitError;
    }

    if (!visitData) {
      return res.status(404).json({
        success: false,
        message: 'Invalid token. Visit not found.'
      });
    }

    const { data: vitalsData, error: vitalsError } = await supabase
      .from('vitals')
      .insert({
        visit_id: visitData.id,
        blood_pressure: normalizedBloodPressure,
        heart_rate: normalizedHeartRate,
        temperature: normalizedTemperature,
        spo2: normalizedSpo2
      })
      .select()
      .single();

    if (vitalsError) {
      throw vitalsError;
    }

    const { error: updateVisitError } = await supabase
      .from('visits')
      .update({
        status: 'vitals_done'
      })
      .eq('id', visitData.id);

    if (updateVisitError) {
      throw updateVisitError;
    }

    return res.status(201).json({
      success: true,
      vitals: vitalsData
    });
  } catch (error) {
    console.error('Error saving vitals:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

app.post('/api/patient/register', async (req, res) => {
  try {
    const {
      name,
      age,
      gender,
      symptoms,
      allergies,
      conditions,
      medications
    } = req.body;

    const normalizedName = toNullableString(name);
    const normalizedGender = toNullableString(gender);
    const normalizedSymptoms = toNullableString(symptoms);
    const normalizedAge = toNullableString(age);
    const numericAge = Number(age);

    if (!normalizedName || !normalizedGender || !normalizedSymptoms || !normalizedAge || Number.isNaN(numericAge)) {
      return res.status(400).json({
        success: false,
        message: 'name, age, gender, and symptoms are required.'
      });
    }

    if (!hasSupabaseConfig) {
      return res.status(500).json({
        success: false,
        message: 'Supabase credentials are not configured.'
      });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const { data: lastVisit, error: lastVisitError } = await supabase
      .from('visits')
      .select('token_number')
      .gte('created_at', startOfToday.toISOString())
      .lt('created_at', startOfTomorrow.toISOString())
      .order('token_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastVisitError) {
      throw lastVisitError;
    }

    const lastTokenNumber = Number(lastVisit?.token_number);
    const tokenNumber = Number.isFinite(lastTokenNumber) ? lastTokenNumber + 1 : 1;

    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .insert({
        name: normalizedName,
        age: numericAge,
        gender: normalizedGender
      })
      .select()
      .single();

    if (patientError) {
      throw patientError;
    }

    const { data: visitData, error: visitError } = await supabase
      .from('visits')
      .insert({
        patient_id: patientData.id,
        symptoms: normalizedSymptoms,
        allergies: toNullableString(allergies),
        conditions: toNullableString(conditions),
        medications: toNullableString(medications),
        status: 'registered',
        token_number: tokenNumber
      })
      .select()
      .single();

    if (visitError) {
      throw visitError;
    }

    return res.status(201).json({
      success: true,
      token: visitData.token_number,
      patient: patientData,
      visit: visitData
    });
  } catch (error) {
    console.error('Error registering patient:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

function startServer() {
  return app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer
};
