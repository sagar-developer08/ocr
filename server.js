const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { processAudioPipeline } = require('./audioProcessor');
const ocrApp = require('./ocr');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Mount OCR route
app.use('/', ocrApp);

// const BHASHINI_API_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const API_KEY = '19cee3351c-515a-4774-b47f-b0ed54859a0c'; // Replace with your key

app.post('/process-audio', upload.single('file'), async (req, res) => {
  try {
    console.log(req.body,'ody')
    const result = await processAudioPipeline(req.file, {
      sourceLanguage: req.body.sourceLanguage,
      targetLanguage: req.body.targetLanguage,
      apiKey: API_KEY
    });

    if (result.success) {
      res.json({
        status: 'success',
        data: result
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: result.error
      });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});


app.listen(3000, () => console.log('[INFO] Server started on http://localhost:3000'));
