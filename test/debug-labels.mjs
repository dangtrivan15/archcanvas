import fs from 'fs';

// Check NodeDetailPanel
let source = fs.readFileSync('src/components/panels/NodeDetailPanel.tsx', 'utf-8');

let inputMatches = [...source.matchAll(/<input\b[^>]*>/gs)];
console.log('NodeDetailPanel - Total inputs found:', inputMatches.length);
inputMatches.forEach((m, i) => {
  let tag = m[0];
  let hasId = /\bid="[^"]+"/i.test(tag);
  let hasAriaLabel = /aria-label/i.test(tag);
  if (!hasId && !hasAriaLabel) {
    console.log('MISSING label - input #' + i + ':', tag.substring(0, 200));
  }
});

let selectMatches = [...source.matchAll(/<select\b[^>]*>/gs)];
console.log('NodeDetailPanel - Total selects found:', selectMatches.length);
selectMatches.forEach((m, i) => {
  let tag = m[0];
  let hasId = /\bid="[^"]+"/i.test(tag);
  let hasAriaLabel = /aria-label/i.test(tag);
  if (!hasId && !hasAriaLabel) {
    console.log('MISSING label - select #' + i + ':', tag.substring(0, 200));
  }
});

let textareaMatches = [...source.matchAll(/<textarea\b[^>]*>/gs)];
console.log('NodeDetailPanel - Total textareas found:', textareaMatches.length);
textareaMatches.forEach((m, i) => {
  let tag = m[0];
  let hasId = /\bid="[^"]+"/i.test(tag);
  let hasAriaLabel = /aria-label/i.test(tag);
  if (!hasId && !hasAriaLabel) {
    console.log('MISSING label - textarea #' + i + ':', tag.substring(0, 200));
  }
});

// Check AIChatTab textareas
let aiSource = fs.readFileSync('src/components/panels/AIChatTab.tsx', 'utf-8');
let aiTextareas = [...aiSource.matchAll(/<textarea\b[^>]*>/gs)];
console.log('AIChatTab - Total textareas found:', aiTextareas.length);
aiTextareas.forEach((m, i) => {
  let tag = m[0];
  let hasId = /\bid="[^"]+"/i.test(tag);
  let hasAriaLabel = /aria-label/i.test(tag);
  if (!hasId && !hasAriaLabel) {
    console.log('MISSING label - textarea #' + i + ':', tag.substring(0, 200));
  }
});
