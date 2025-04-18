// Marathi to Hindi PDF Translation with Layout Preservation using Bhashini
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// Fix for PDF.js worker
// IMPORTANT: This needs to be set before any PDF.js operations
const PDFJS_WORKER_PATH = path.join(
  process.cwd(),
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.js"
);
if (fs.existsSync(PDFJS_WORKER_PATH)) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_PATH;
} else {
  // Fallback path
  pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/build/pdf.worker.js"
  );
}

// Configuration for Bhashini API
const BHASHINI_API_KEY =
  "zLA_jlURt70ufvlkYmhS5lYvGtgWOVwajrnygq_1dad5eszE2immUrUr8-hvysEe"; // Replace with your actual API key
const BHASHINI_API_ENDPOINT =
  "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
const SOURCE_LANGUAGE = "mr"; // Source language code (Marathi)
const TARGET_LANGUAGE = "hi"; // Target language code (Hindi)

// Paths to Indic fonts
const HINDI_FONT_PATH = path.join(
  __dirname,
  "fonts/NotoSansDevanagari-Regular.ttf"
);
const HINDI_FONT_BOLD_PATH = path.join(
  __dirname,
  "fonts/NotoSansDevanagari-Bold.ttf"
);

/**
 * Download Noto Sans Devanagari fonts if not present
 */
async function ensureDevanagariFont() {
  const fontsDir = path.join(__dirname, "fonts");

  // Create fonts directory if it doesn't exist
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  // Download regular font if not present
  if (!fs.existsSync(HINDI_FONT_PATH)) {
    console.log("Downloading Noto Sans Devanagari Regular font...");
    const fontUrl =
      "https://fonts.gstatic.com/s/notosansdevanagari/v19/TuGOUUk6hG0ZmCpvLS_T-gsinh1DAmOLDqULTSapqo4.ttf";
    const fontResponse = await axios.get(fontUrl, {
      responseType: "arraybuffer",
    });
    fs.writeFileSync(HINDI_FONT_PATH, fontResponse.data);
  }

  // Download bold font if not present
  if (!fs.existsSync(HINDI_FONT_BOLD_PATH)) {
    console.log("Downloading Noto Sans Devanagari Bold font...");
    const fontUrl =
      "https://fonts.gstatic.com/s/notosansdevanagari/v19/TuGWUUk6hG0ZmCpvLS_T-gsinNZRkI3u-lOTqDYoxvA.ttf";
    const fontResponse = await axios.get(fontUrl, {
      responseType: "arraybuffer",
    });
    fs.writeFileSync(HINDI_FONT_BOLD_PATH, fontResponse.data);
  }

  console.log("Devanagari fonts ready");
}

/**
 * Extract text elements with position data from a PDF
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<Array>} - Array of text elements with position data
 */
async function extractTextElementsFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
    const pdf = await loadingTask.promise;

    let textElements = [];

    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Processing page ${pageNum}/${pdf.numPages}`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Extract text items with their position data
      textContent.items.forEach((item) => {
        if (!item.transform || item.transform.length < 6) {
          console.warn("Skipping text item with invalid transform data");
          return;
        }

        const transform = item.transform;
        const [scaleX, skewY, skewX, scaleY, posX, posY] = transform;

        // Calculate font size (with fallback)
        let fontSize;
        try {
          fontSize = Math.sqrt(scaleX * scaleX + skewX * skewX);
          if (!fontSize || isNaN(fontSize) || fontSize < 1) {
            fontSize = 12; // Default font size if calculation fails
          }
        } catch (e) {
          fontSize = 12;
        }

        textElements.push({
          text: item.str || "",
          page: pageNum,
          x: posX || 0,
          y: posY || 0,
          fontSize: fontSize,
          width: item.width || 100,
          height: item.height || 15,
          fontName: item.fontName || "unknown",
          fontWeight:
            item.fontName && item.fontName.toLowerCase().includes("bold")
              ? "bold"
              : "normal",
        });
      });
    }

    return textElements;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw error;
  }
}

/**
 * Get PDF dimensions
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<Object>} - Object containing PDF dimensions
 */
async function getPDFDimensions(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });

    return {
      width: viewport.width,
      height: viewport.height,
      numPages: pdf.numPages,
    };
  } catch (error) {
    console.error("Error getting PDF dimensions:", error);
    throw error;
  }
}

/**
 * Batch translate array of text elements using Bhashini API
 * @param {Array} textElements - Array of text elements to translate
 * @returns {Promise<Array>} - Array of translated text elements
 */
// async function batchTranslateTextElements(textElements) {
//   // Extract just the text strings for translation (non-empty)
//   const textStrings = textElements
//     .map((element) => element.text)
//     .filter((text) => text && text.trim().length > 0);

//   if (textStrings.length === 0) {
//     console.log("No text to translate");
//     return textElements;
//   }

//   // Group texts into manageable chunks (to avoid API limitations)
//   const CHUNK_SIZE = 20; // Smaller chunk size for Bhashini API
//   const textChunks = [];

//   for (let i = 0; i < textStrings.length; i += CHUNK_SIZE) {
//     textChunks.push(textStrings.slice(i, i + CHUNK_SIZE));
//   }

//   let translatedStrings = [];

//   // Process each chunk
//   for (let i = 0; i < textChunks.length; i++) {
//     const chunk = textChunks[i];
//     console.log(
//       `Translating chunk ${i + 1}/${textChunks.length} (${chunk.length} items)`
//     );
//     console.log(chunk,'chunnks')
//     try {
//       const response = await axios.post(
//         BHASHINI_API_ENDPOINT,
//         {
//           pipelineTasks: [
//             {
//               taskType: "translation",
//               config: {
//                 language: {
//                   sourceLanguage: SOURCE_LANGUAGE,
//                   targetLanguage: TARGET_LANGUAGE,
//                 },
//               },
//             },
//           ],
//           inputData: {
//             input: chunk.map((text) => ({ source: text })),
//           },
//         },
//         {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: ` ${BHASHINI_API_KEY}`,
//           },
//         }
//       );

//       // Extract translations from response (adjust based on actual Bhashini API response structure)
//       const chunkTranslations = response.data.output.map((item) => item.target);
//       translatedStrings = translatedStrings.concat(chunkTranslations);
//       console.log(tra);
//       // Add small delay to avoid rate limiting
//       await new Promise((resolve) => setTimeout(resolve, 300));
//     } catch (error) {
//       console.error("Error translating chunk:", error.message);
//       // For failed chunks, use original text as fallback
//       translatedStrings = translatedStrings.concat(chunk);
//     }
//   }

//   // Map translated strings back to text elements
//   let translatedElements = [];
//   let translationIndex = 0;

//   textElements.forEach((element) => {
//     if (element.text && element.text.trim().length > 0) {
//       const translatedElement = {
//         ...element,
//         originalText: element.text,
//         text: translatedStrings[translationIndex] || element.text, // Fallback to original
//       };
//       translatedElements.push(translatedElement);
//       translationIndex++;
//     } else {
//       // Keep empty/whitespace elements unchanged
//       translatedElements.push(element);
//     }
//   });

//   return translatedElements;
// }

async function batchTranslateTextElements(textElements) {
  const textStrings = textElements
    .map((element) => element.text)
    .filter((text) => text && text.trim().length > 0);

  if (textStrings.length === 0) {
    console.log("No text to translate");
    return textElements;
  }

  const CHUNK_SIZE = 20;
  const textChunks = [];

  for (let i = 0; i < textStrings.length; i += CHUNK_SIZE) {
    textChunks.push(textStrings.slice(i, i + CHUNK_SIZE));
  }

  let translatedStrings = [];

  for (let i = 0; i < textChunks.length; i++) {
    const chunk = textChunks[i];
    console.log(`Translating chunk ${i + 1}/${textChunks.length} (${chunk.length} items)`);
    try {
      const response = await axios.post(
        BHASHINI_API_ENDPOINT,
        {
          pipelineTasks: [
            {
              taskType: "translation",
              config: {
                language: {
                  sourceLanguage: SOURCE_LANGUAGE,
                  targetLanguage: TARGET_LANGUAGE,
                },
              },
            },
          ],
          inputData: {
            input: chunk.map((text) => ({ source: text })),
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: ` ${BHASHINI_API_KEY}`,
          },
        }
      );
      const output = response.data.pipelineResponse[0].output;
      console.log(output,'out')
      if (Array.isArray(output)) {
        const chunkTranslations = output.map((item) => item.target || "");
        translatedStrings = translatedStrings.concat(chunkTranslations);
      } else {
        console.warn("Unexpected response structure from Bhashini API:", response.data);
        translatedStrings = translatedStrings.concat(chunk); // fallback
      }

      await new Promise((resolve) => setTimeout(resolve, 300)); // Rate limiting
    } catch (error) {
      console.error("Error translating chunk:", error.message);
      console.error("Response data:", error?.response?.data);
      translatedStrings = translatedStrings.concat(chunk); // fallback
    }
  }

  let translatedElements = [];
  let translationIndex = 0;

  textElements.forEach((element) => {
    if (element.text && element.text.trim().length > 0) {
      const translatedElement = {
        ...element,
        originalText: element.text,
        text: translatedStrings[translationIndex] || element.text,
      };
      translatedElements.push(translatedElement);
      translationIndex++;
    } else {
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
    autoFirstPage: false,
    bufferPages: true, // Important for managing multiple pages
  });

  try {
    // Register Hindi fonts
    doc.registerFont("DevanagariRegular", HINDI_FONT_PATH);
    doc.registerFont("DevanagariBold", HINDI_FONT_BOLD_PATH);

    const outputStream = fs.createWriteStream(outputPath);
    outputStream.on("error", (err) => {
      console.error("Error writing to output file:", err);
    });

    doc.pipe(outputStream);

    // Group elements by page
    const elementsByPage = {};
    translatedElements.forEach((element) => {
      if (!elementsByPage[element.page]) {
        elementsByPage[element.page] = [];
      }
      elementsByPage[element.page].push(element);
    });

    // Process each page
    for (let pageNum = 1; pageNum <= pdfDimensions.numPages; pageNum++) {
      doc.addPage({
        size: [pdfDimensions.width, pdfDimensions.height],
        margin: 0,
      });

      const pageElements = elementsByPage[pageNum] || [];

      // Draw each text element
      pageElements.forEach((element) => {
        try {
          // Skip elements with invalid positions
          if (isNaN(element.x) || isNaN(element.y) || isNaN(element.fontSize)) {
            return;
          }

          // Flip Y-coordinate (PDF coordinate system starts from bottom-left)
          const y = pdfDimensions.height - element.y;

          // Choose appropriate Devanagari font based on original font weight
          const fontName =
            element.fontWeight === "bold"
              ? "DevanagariBold"
              : "DevanagariRegular";

          // Skip empty text
          if (!element.text || element.text.trim() === "") {
            return;
          }

          doc
            .font(fontName)
            .fontSize(element.fontSize)
            .text(element.text, element.x, y, {
              width: element.width * 1.2, // Slightly wider for Hindi text
              align: "left",
              lineBreak: false,
            });
        } catch (err) {
          console.warn(
            `Error placing text element on page ${pageNum}:`,
            err.message
          );
        }
      });
    }

    doc.end();
    console.log(`Translated PDF created: ${outputPath}`);
  } catch (error) {
    console.error("Error creating PDF:", error);

    // Try to close the document in case of error
    try {
      doc.end();
    } catch (e) {
      // Ignore
    }
  }
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
    console.log(
      `PDF dimensions: ${pdfDimensions.width}x${pdfDimensions.height}, ${pdfDimensions.numPages} pages`
    );

    // Translate text elements from Marathi to Hindi
    console.log(
      `Translating from ${SOURCE_LANGUAGE} (Marathi) to ${TARGET_LANGUAGE} (Hindi)...`
    );
    const translatedElements = await batchTranslateTextElements(textElements);
    console.log("Translation completed");

    // Create translated PDF with same layout
    createTranslatedPDF(translatedElements, pdfDimensions, outputPath);
  } catch (error) {
    console.error("Translation process failed:", error);
    throw error;
  }
}

// Example usage
const inputPdfPath = path.join(__dirname, "GR.pdf");
const outputPdfPath = path.join(__dirname, "marathi_to_hindi_translated1.pdf");

// Run the translation process
translatePDFWithLayout(inputPdfPath, outputPdfPath)
  .then(() => {
    console.log("PDF translation process completed successfully");
  })
  .catch((error) => {
    console.error("PDF translation process failed:", error);
  });
