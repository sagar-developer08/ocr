const axios = require('axios');
const fs = require('fs');

// Audio Model Configurations
const AUDIO_MODELS = {
  INDIAN_LANGUAGES: {
    asrServiceId: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
    nmtServiceId: 'ai4bharat/indictrans-v2-all-gpu--t4', 
    ttsServiceId: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4'
  },
  ENGLISH: {
    asrServiceId: 'ai4bharat/whisper-medium-en--gpu--t4',
    nmtServiceId: 'ai4bharat/indictrans-v2-all-gpu--t4',
    ttsServiceId: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4'
  }
};

const BHASHINI_API_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

/**
 * Processes audio through Bhashini's ASR → Translation → TTS pipeline
 * @param {Object} file - Uploaded file object with path property
 * @param {Object} options - Processing options
 * @param {string} options.sourceLanguage - Source language code (default: 'hi')
 * @param {string} options.targetLanguage - Target language code (default: 'en')
 * @param {string} options.modelType - Model configuration type (default: 'INDIAN_LANGUAGES')
 * @param {string} options.apiKey - Bhashini API key
 * @returns {Promise<Object>} - API response data
 */
async function processAudioPipeline(file, options = {}) {
  const {
    sourceLanguage = 'en',
    targetLanguage = 'hi',
    // modelType = 'ENGLISH',
    apiKey
  } = options;

  // const models = AUDIO_MODELS[modelType];
  const fileBuffer = fs.readFileSync(file.path);
  const base64Content = fileBuffer.toString('base64');

  const payload = {
    pipelineTasks: [
      {
         taskType: "asr",
         config: {
           language: { sourceLanguage: sourceLanguage },
           serviceId: 'ai4bharat/whisper-medium-en--gpu--t4',
           audioFormat: "flac", 
           samplingRate: 16000
         }
      },
      {
         taskType: "translation",
         config: {
           language: {
             sourceLanguage: sourceLanguage,
             targetLanguage: targetLanguage
           },
           serviceId: 'ai4bharat/indictrans-v2-all-gpu--t4'
         }
      },
      {
         taskType: "tts",
         config: {
           language: { sourceLanguage: targetLanguage },
           serviceId: 'Bhashini/IITM/TTS',
           gender: "male",
           samplingRate: 8000
         }
      }
    ],
    inputData: {
      audio: [
        {
          audioContent: base64Content
        }
      ]
    }
  };

  try {
    const response = await axios.post(
      BHASHINI_API_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `aPiteHrq99sLfQkCZga9sBTPjqGU4ivk2mZfbbeZKKncdmART6JOgdt6qx4ea2ei`
        }
      }
    );

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Audio processing error:', error);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  } finally {
    // Clean up uploaded file
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
}

module.exports = {
  AUDIO_MODELS,
  processAudioPipeline
};
