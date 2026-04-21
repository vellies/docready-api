const archiver = require("archiver");
const { processImage, getOutputFilename } = require("../services/imageService");
const { extractText } = require("../services/ocrService");

async function processFiles(req, res) {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const presetsRaw = req.body.presets;
    const presets = Array.isArray(presetsRaw) ? presetsRaw : [presetsRaw];

    const customOptionsRaw = req.body.customOptions;
    let customOptions = [];
    if (customOptionsRaw) {
      try {
        customOptions = Array.isArray(customOptionsRaw)
          ? customOptionsRaw.map((o) => JSON.parse(o))
          : [JSON.parse(customOptionsRaw)];
      } catch {
        customOptions = [];
      }
    }

    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const preset = presets[i] || "aadhaar";
      const opts = customOptions[i] || {};

      const outputBuffer = await processImage(file.buffer, preset, opts);
      const outputFilename = getOutputFilename(file.originalname, preset, opts.format);

      let ocrText = null;
      if (preset === "certificate") {
        ocrText = await extractText(file.buffer);
      }

      results.push({ filename: outputFilename, buffer: outputBuffer, ocrText });
    }

    if (results.length === 1) {
      const { filename, buffer, ocrText } = results[0];
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-OCR-Text", ocrText ? encodeURIComponent(ocrText) : "");
      res.setHeader(
        "Content-Type",
        filename.endsWith(".pdf") ? "application/pdf" : "image/jpeg"
      );
      return res.send(buffer);
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="docready_output.zip"');

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    for (const { filename, buffer, ocrText } of results) {
      archive.append(buffer, { name: filename });
      if (ocrText) {
        const txtName = filename.replace(/\.[^.]+$/, "_ocr.txt");
        archive.append(Buffer.from(ocrText, "utf8"), { name: txtName });
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error("Process error:", err);
    res.status(500).json({ error: err.message || "Processing failed" });
  }
}

module.exports = { processFiles };
