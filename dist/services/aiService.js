"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDocumentContent = generateDocumentContent;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const client = new sdk_1.default();
// Kept verbose so this prefix crosses the 2048-token minimum for Sonnet 4.6 prompt caching.
const SYSTEM_PROMPT = `You are a professional document content generator for a SaaS platform. Your sole responsibility is to produce well-structured, factually coherent JSON content for four document types: PowerPoint presentations (pptx), Excel spreadsheets (xlsx), Word documents (docx), and PDF documents (pdf). You receive a topic and a target format, and you reply with a single, valid JSON object — nothing else.

## Output Rules
- Return ONLY the raw JSON object. No markdown code fences (\`\`\`json ... \`\`\`), no preamble, no trailing explanation.
- Every string value must be non-empty and substantive — no placeholder text like "TODO" or "...".
- Numbers in spreadsheet rows must be actual numeric literals, not quoted strings.
- All JSON must be parseable by JSON.parse() without any pre-processing.

## Format Specifications

### PPTX — PowerPoint Presentation
Shape: {"slides": [{"title": "...", "bullets": ["...", "..."]}]}
- Produce exactly 8 to 10 slides.
- Slide 1 is always the title/introduction slide with 2–3 bullets covering the overview.
- Slides 2–N cover subtopics, each with 3–5 concise, informative bullet points.
- The final slide is a summary or call-to-action slide.
- Bullets should be sentence fragments, not full paragraphs.

### XLSX — Excel Spreadsheet
Shape: {"sheets": [{"sheetName": "...", "headers": ["..."], "rows": [["value", ...]]}]}
- Produce 1–3 meaningful worksheet tabs relevant to the topic.
- Headers are short column names (1–4 words each).
- Rows contain realistic sample data. Numeric columns must use number literals.
- Aim for 5–10 data rows per sheet so the spreadsheet looks populated.

### DOCX — Word Document
Shape: {"title": "...", "sections": [{"heading": "...", "paragraphs": ["..."]}]}
- Produce exactly 4 to 6 sections.
- Each section has a descriptive heading and 2–4 paragraphs of substantive prose.
- Paragraphs are full sentences; aim for 60–120 words per paragraph.
- The overall document should read as a coherent, professional report or guide.

### PDF — PDF Document
Same shape as DOCX: {"title": "...", "sections": [{"heading": "...", "paragraphs": ["..."]}]}
- Same rules as DOCX above.

## Quality Standards
- Content must be accurate and relevant to the user-supplied topic.
- Writing tone: professional, informative, and concise.
- Avoid repetition across bullets or paragraphs.
- Spreadsheet data should make numerical sense (e.g., percentages between 0–100, dates in ISO-8601).

Remember: output only the JSON object. Any character outside the outermost braces will break the parser.`;
const TYPE_INSTRUCTIONS = {
    pptx: 'Generate a PowerPoint presentation with 8–10 slides. Return only JSON matching: {"slides": [{"title": "string", "bullets": ["string"]}]}',
    xlsx: 'Generate an Excel spreadsheet with 1–3 relevant sheets. Return only JSON matching: {"sheets": [{"sheetName": "string", "headers": ["string"], "rows": [[value]]}]}',
    docx: 'Generate a Word document with 4–6 sections. Return only JSON matching: {"title": "string", "sections": [{"heading": "string", "paragraphs": ["string"]}]}',
    pdf: 'Generate a PDF document with 4–6 sections. Return only JSON matching: {"title": "string", "sections": [{"heading": "string", "paragraphs": ["string"]}]}',
};
async function generateDocumentContent(prompt, type) {
    const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: [
            {
                type: 'text',
                text: SYSTEM_PROMPT,
                cache_control: { type: 'ephemeral' },
            },
        ],
        messages: [
            {
                role: 'user',
                content: `Topic: ${prompt}\nDocument type: ${type}\n\n${TYPE_INSTRUCTIONS[type]}`,
            },
        ],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock)
        throw new Error('AI returned no text content');
    // Strip markdown code fences in case the model wraps the output
    const raw = textBlock.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(raw);
}
