// Browser-only PDF text extraction for "Decode This" - pdfjs-dist is
// dynamically imported (never in the main bundle, only loaded when a
// customer actually opens this one screen). The extracted text is the ONLY
// thing that ever leaves the browser - the raw PDF binary is never uploaded
// anywhere, this app has no file-storage backend and doesn't need one for
// this feature.
const MAX_PAGES = 50; // a loan agreement/insurance PDS is well under this; a safety cap, not a real limitation for the target use case
const MAX_CHARS = 20000; // matches the cap document_reviews stores server-side
const MIN_CHARS_PER_PAGE = 20; // below this, pdf.js almost certainly found no real text layer (scanned/image PDF)

export async function extractPdfText(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    // Real documents often don't embed font metrics (standardFontDataUrl) or
    // use non-Latin encodings (cMapUrl - relevant since this app supports
    // zh/ms/ta) - confirmed via a real extraction test that omitting these
    // produces an actual warning/degraded result, not a theoretical concern.
    standardFontDataUrl: "/pdf-standard-fonts/",
    cMapUrl: "/pdf-cmaps/",
    cMapPacked: true,
  }).promise;

  const pagesToRead = Math.min(pdf.numPages, MAX_PAGES);
  const pageTexts = [];
  for (let pageNum = 1; pageNum <= pagesToRead; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    pageTexts.push(textContent.items.map((item) => item.str).join(" "));
  }

  const fullText = pageTexts.join("\n\n").trim();

  // A scanned/image-only PDF has no real text layer - pdf.js returns
  // near-empty text in that case. Never send that to the AI as if it were
  // real content to analyze.
  if (fullText.length < MIN_CHARS_PER_PAGE * pagesToRead) {
    return { error: "no_text_layer", text: null, pageCount: pdf.numPages };
  }

  return {
    error: null,
    text: fullText.length > MAX_CHARS ? fullText.slice(0, MAX_CHARS) : fullText,
    truncated: fullText.length > MAX_CHARS || pdf.numPages > MAX_PAGES,
    pageCount: pdf.numPages,
  };
}
