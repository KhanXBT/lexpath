import * as pdfjsLib from 'pdfjs-dist';

// Use a CDN worker for simplicity in client-side Vite apps without complex config
// Alternatively, standard import if vite-plugin-static-copy is used, but CDN is robust for a hackathon demo.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export async function extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += `\n\n--- PAGE ${i} ---\n${pageText}`;
    }

    return fullText;
}
