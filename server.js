const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { processAudioPipeline } = require('./audioProcessor');
const ocrApp = require('./ocr');
const {
  // ensureDevanagariFont,
  // extractTextElementsFromPDF,
  // getPDFDimensions,
  // batchTranslateTextElements,
  // createTranslatedPDF,
  translatePDFWithLayout
} = require('./pdfTranslateHelper');

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


app.post('/translate-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No PDF file uploaded.' });
    }
    
    // Create necessary directories
    const translatedDir = path.join(__dirname, 'translated');
    if (!fs.existsSync(translatedDir)) {
      fs.mkdirSync(translatedDir, { recursive: true });
    }

    const inputPdfPath = req.file.path;
    const outputPdfPath = path.join(translatedDir, `translated_${Date.now()}.pdf`);

    await translatePDFWithLayout(inputPdfPath, outputPdfPath);
    // Wait for the file to be fully written
    await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 5s

    // Send the file
    res.download(outputPdfPath, 'translated.pdf', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to send translated PDF.' });
        return;
      }

      // Clean up files
      try {
        fs.unlinkSync(inputPdfPath);
        fs.unlinkSync(outputPdfPath);
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    });
  } catch (error) {
    console.error('PDF Translation API Error:', error);
    
    // Clean up input file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    }

    res.status(500).json({ status: 'error', message: 'Translation failed.' });
  }
});

app.listen(4000, () => console.log('[INFO] Server started on http://localhost:4000'));
