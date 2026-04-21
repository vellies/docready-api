const Tesseract = require("tesseract.js");

async function extractText(imageBuffer) {
  const {
    data: { text },
  } = await Tesseract.recognize(imageBuffer, "eng", {
    logger: () => {},
  });
  return text.trim();
}

module.exports = { extractText };
