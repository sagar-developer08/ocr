// Marathi to Hindi PDF Translation with Layout Preservation using Bhashini
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Configuration for Bhashini API
const BHASHINI_API_KEY = 'zLA_jlURt70ufvlkYmhS5lYvGtgWOVwajrnygq_1dad5eszE2immUrUr8-hvysEe'; // Replace with your actual API key
const BHASHINI_API_ENDPOINT = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const SOURCE_LANGUAGE = 'mr'; // Source language code (Marathi)
const TARGET_LANGUAGE = 'hi'; // Target language code (Hindi)

// Paths to Indic fonts
const HINDI_FONT_PATH = path.join(__dirname, './fonts/NotoSansDevanagari-VariableFont_wdth,wght.ttf');
const HINDI_FONT_BOLD_PATH = path.join(__dirname, './fonts/NotoSansDevanagari-VariableFont_wdth,wght.ttf');

/**
 * Download Noto Sans Devanagari fonts if not present
 */
async function ensureDevanagariFont() {
  const fontsDir = path.join(__dirname, 'fonts');
  
  // Create fonts directory if it doesn't exist
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }
  
  // Download regular font if not present
  if (!fs.existsSync(HINDI_FONT_PATH)) {
    console.log('Downloading Noto Sans Devanagari Regular font...');
    const fontUrl = 'https://fonts.gstatic.com/s/notosansdevanagari/v19/TuGOUUk6hG0ZmCpvLS_T-gsinh1DAmOLDqULTSapqo4.ttf';
    const fontResponse = await axios.get(fontUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(HINDI_FONT_PATH, fontResponse.data);
  }
  
  // Download bold font if not present
  if (!fs.existsSync(HINDI_FONT_BOLD_PATH)) {
    console.log('Downloading Noto Sans Devanagari Bold font...');
    const fontUrl = 'https://fonts.gstatic.com/s/notosansdevanagari/v19/TuGWUUk6hG0ZmCpvLS_T-gsinNZRkI3u-lOTqDYoxvA.ttf';
    const fontResponse = await axios.get(fontUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(HINDI_FONT_BOLD_PATH, fontResponse.data);
  }
  
  console.log('Devanagari fonts ready');
}

/**
 * Extract text elements with position data from a PDF
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<Array>} - Array of text elements with position data
 */
async function extractTextElementsFromPDF(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  
  // Set up PDF.js worker
  const pdfjsWorker = require('pdfjs-dist/build/pdf.worker.entry'); pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
 
  
  const loadingTask = pdfjsLib.getDocument({data: dataBuffer});
  const pdf = await loadingTask.promise;
  
  let textElements = [];
  
  // Process each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    console.log(`Processing page ${pageNum}/${pdf.numPages}`);
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Extract text items with their position data
    textContent.items.forEach(item => {
      const transform = item.transform;
      const [scaleX, skewY, skewX, scaleY, posX, posY] = transform;
      
      textElements.push({
        text: item.str,
        page: pageNum,
        x: posX,
        y: posY,
        fontSize: Math.sqrt(scaleX * scaleX + skewX * skewX) || 12, // Default to 12 if calculation fails
        width: item.width,
        height: item.height,
        fontName: item.fontName,
        fontWeight: item.fontName && item.fontName.toLowerCase().includes('bold') ? 'bold' : 'normal'
      });
    });
  }
  
  return textElements;
}

/**
 * Get PDF dimensions
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<Object>} - Object containing PDF dimensions
 */
async function getPDFDimensions(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry');
  
  const loadingTask = pdfjsLib.getDocument({data: dataBuffer});
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({scale: 1.0});
  
  return {
    width: viewport.width,
    height: viewport.height,
    numPages: pdf.numPages
  };
}

/**
 * Batch translate array of text elements using Bhashini API
 * @param {Array} textElements - Array of text elements to translate
 * @returns {Promise<Array>} - Array of translated text elements
 */
async function batchTranslateTextElements(textElements) {
  // Extract just the text strings for translation
  const textStrings = textElements.map(element => element.text).filter(text => text.trim().length > 0);
  
  // Group texts into manageable chunks (to avoid API limitations)
  const CHUNK_SIZE = 20; // Smaller chunk size for Bhashini API
  const textChunks = [];
  
  for (let i = 0; i < textStrings.length; i += CHUNK_SIZE) {
    textChunks.push(textStrings.slice(i, i + CHUNK_SIZE));
  }
  
  let translatedStrings = [];
  
  // Process each chunk
  for (let i = 0; i < textChunks.length; i++) {
    const chunk = textChunks[i];
    console.log(`Translating chunk ${i+1}/${textChunks.length} (${chunk.length} items)`);
    
    try {
      const response = await axios.post(
        BHASHINI_API_ENDPOINT,
        {
          input: chunk.map(text => ({ source: text })),
          config: {
            language: {
              sourceLanguage: SOURCE_LANGUAGE,
              targetLanguage: TARGET_LANGUAGE
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BHASHINI_API_KEY}`
          }
        }
      );
      
      // Extract translations from response (adjust based on actual Bhashini API response structure)
      const chunkTranslations = response.data.output.map(item => item.target);
      translatedStrings = translatedStrings.concat(chunkTranslations);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error('Error translating chunk:', error.message);
      // For failed chunks, use original text as fallback
      translatedStrings = translatedStrings.concat(chunk);
    }
  }
  
  // Map translated strings back to text elements
  let translatedElements = [];
  let translationIndex = 0;
  
  textElements.forEach(element => {
    if (element.text.trim().length > 0) {
      const translatedElement = {
        ...element,
        originalText: element.text,
        text: translatedStrings[translationIndex]
      };
      translatedElements.push(translatedElement);
      translationIndex++;
    } else {
      // Keep empty/whitespace elements unchanged
      translatedElements.push(element);
    }
  });
  
  return translatedElements;
}

/**
 * Create a translated PDF with the same layout as the original
 * @param {Array} translatedElements - Array of translated text elements
 * @param {Object} pdfDimensions - Object containing PDF dimensions
 * @param {string} outputPath - Path to save the translated PDF
 */
function createTranslatedPDF(translatedElements, pdfDimensions, outputPath) {
  const doc = new PDFDocument({
    size: [pdfDimensions.width, pdfDimensions.height],
    autoFirstPage: false
  });
  
  // Register Hindi fonts
  doc.registerFont('DevanagariRegular', HINDI_FONT_PATH);
  doc.registerFont('DevanagariBold', HINDI_FONT_BOLD_PATH);
  
  doc.pipe(fs.createWriteStream(outputPath));
  
  // Group elements by page
  const elementsByPage = {};
  translatedElements.forEach(element => {
    if (!elementsByPage[element.page]) {
      elementsByPage[element.page] = [];
    }
    elementsByPage[element.page].push(element);
  });
  
  // Process each page
  for (let pageNum = 1; pageNum <= pdfDimensions.numPages; pageNum++) {
    doc.addPage({
      size: [pdfDimensions.width, pdfDimensions.height]
    });
    
    const pageElements = elementsByPage[pageNum] || [];
    
    // Draw each text element
    pageElements.forEach(element => {
      // Flip Y-coordinate (PDF coordinate system starts from bottom-left)
      const y = pdfDimensions.height - element.y;
      
      // Choose appropriate Devanagari font based on original font weight
      const fontName = element.fontWeight === 'bold' ? 'DevanagariBold' : 'DevanagariRegular';
      
      doc.font(fontName)
         .fontSize(element.fontSize)
         .text(element.text, element.x, y, {
           width: element.width * 1.2, // Slightly wider for Hindi text
           align: 'left',
           lineBreak: false
         });
    });
  }
  
  doc.end();
  console.log(`Translated PDF created: ${outputPath}`);
}

/**
 * Main function to process PDF translation with layout preservation
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputPath - Path to save the translated PDF
 */
async function translatePDFWithLayout(pdfPath, outputPath) {
  try {
    console.log(`Processing PDF: ${pdfPath}`);
    
    // Ensure Devanagari fonts are available
    await ensureDevanagariFont();
    
    // Extract text elements with position data
    const textElements = await extractTextElementsFromPDF(pdfPath);
    console.log(`Extracted ${textElements.length} text elements`);
    
    // Get PDF dimensions
    const pdfDimensions = await getPDFDimensions(pdfPath);
    console.log(`PDF dimensions: ${pdfDimensions.width}x${pdfDimensions.height}, ${pdfDimensions.numPages} pages`);
    
    // Translate text elements from Marathi to Hindi
    console.log(`Translating from ${SOURCE_LANGUAGE} (Marathi) to ${TARGET_LANGUAGE} (Hindi)...`);
    const translatedElements = await batchTranslateTextElements(textElements);
    console.log('Translation completed');
    
    // Create translated PDF with same layout
    createTranslatedPDF(translatedElements, pdfDimensions, outputPath);
  } catch (error) {
    console.error('Translation process failed:', error);
  }
}

// Example usage
const inputPdfPath = path.join(__dirname, 'GR.pdf');
const outputPdfPath = path.join(__dirname, 'marathi_to_hindi_translated.pdf');

// Run the translation process
translatePDFWithLayout(inputPdfPath, outputPdfPath);