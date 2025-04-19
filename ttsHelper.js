const axios = require('axios');

const BHASHINI_API_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const BHASHINI_API_KEY = 'zLA_jlURt70ufvlkYmhS5lYvGtgWOVwajrnygq_1dad5eszE2immUrUr8-hvysEe';

async function convertTextToSpeech(options) {
    try {
        const {
            text,
            sourceLanguage,
            // callbackUrl,
            ttsServiceId = 'ai4bharat/indic-tts-coqui-misc-gpu--t4'
        } = options;

        if (!text) {
            throw new Error('Text is required');
        }
        if (!sourceLanguage) {
            throw new Error('Source language is required');
        }

        const payload = {
            pipelineTasks: [{
                taskType: "tts",
                config: {
                    language: {
                        sourceLanguage
                    },
                    serviceId: ttsServiceId,
                    gender: "male",
                    samplingRate: 8000
                }
            }],
            inputData: {
                input: [{
                    source: text
                }]
            }
        };

        const response = await axios.post(
            BHASHINI_API_URL,
            payload,
            {
                headers: {
                    Authorization: BHASHINI_API_KEY,
                    'Content-Type': 'application/json'
                },
                // params: {
                //     callbackUrl: callbackUrl
                // }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error in TTS conversion:', error);
        throw error;
    }
}

module.exports = {
    convertTextToSpeech
};
