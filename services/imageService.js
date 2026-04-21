const sharp = require("sharp");
const { PDFDocument } = require("pdf-lib");
const path = require("path");

const PRESETS = {
  passport: { width: 200, height: 200, format: "jpeg", maxKB: 50 },
  signature: { width: 300, height: 100, format: "jpeg", maxKB: null },
  aadhaar: { width: null, height: null, format: "jpeg", maxKB: 200 },
  certificate: { width: null, height: null, format: "pdf", maxKB: null },
  custom: null,
};

async function processImage(inputBuffer, preset, customOptions = {}) {
  const config = preset === "custom" ? customOptions : PRESETS[preset];
  if (!config) throw new Error(`Unknown preset: ${preset}`);

  if (config.format === "pdf") {
    return await convertToPdf(inputBuffer);
  }

  let pipeline = sharp(inputBuffer);

  if (config.width || config.height) {
    pipeline = pipeline.resize(config.width || null, config.height || null, {
      fit: "cover",
      position: "center",
    });
  }

  pipeline = pipeline.toFormat(config.format === "jpeg" ? "jpeg" : config.format);

  if (config.maxKB) {
    const targetBytes = config.maxKB * 1024;

    const encode = (q) =>
      sharp(inputBuffer)
        .resize(config.width || null, config.height || null, { fit: "cover", position: "center" })
        .jpeg({ quality: q })
        .toBuffer();

    // Binary search: find highest quality whose output is <= targetBytes
    let lo = 1, hi = 95, best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const buf = await encode(mid);
      if (buf.length <= targetBytes) {
        best = buf;
        lo = mid + 1; // try higher quality (larger, closer to target)
      } else {
        hi = mid - 1;
      }
    }

    // best is the largest file still within the limit; fall back to q=1 if nothing fits
    return best ?? await encode(1);
  }

  return await pipeline.toBuffer();
}

async function convertToPdf(imageBuffer) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();

  let embeddedImage;
  try {
    embeddedImage = await pdfDoc.embedJpg(imageBuffer);
  } catch {
    const jpegBuffer = await sharp(imageBuffer).jpeg().toBuffer();
    embeddedImage = await pdfDoc.embedJpg(jpegBuffer);
  }

  const { width, height } = embeddedImage.scale(1);
  const pageWidth = 595;
  const pageHeight = (height / width) * pageWidth;

  page.setSize(pageWidth, pageHeight);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });

  return Buffer.from(await pdfDoc.save());
}

function getOutputFilename(originalName, preset, customFormat) {
  const base = path.parse(originalName).name;
  const format =
    preset === "custom"
      ? customFormat || "jpg"
      : preset === "certificate"
      ? "pdf"
      : "jpg";
  return `${base}_${preset}.${format}`;
}

module.exports = { processImage, getOutputFilename, PRESETS };
