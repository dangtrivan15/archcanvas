/**
 * Creates a .archc test file with format version 9999 (future version).
 * Used to test that ArchCanvas rejects files with unsupported format versions.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the valid ecommerce.archc as a base
const validFile = readFileSync(join(__dirname, '..', 'public', 'ecommerce.archc'));
const data = new Uint8Array(validFile);

// Clone the data
const modified = new Uint8Array(data);

// The format version is at byte offset 6-7 (uint16 big-endian, after 6-byte magic)
// Set version to 9999 (0x270F)
const version = 9999;
modified[6] = (version >> 8) & 0xFF; // 0x27
modified[7] = version & 0xFF;         // 0x0F

// Write output
const outPath = join(__dirname, '..', 'public', 'future-version.archc');
writeFileSync(outPath, modified);

console.log(`Created future-version.archc with format version ${version}`);
console.log(`  Version bytes: 0x${modified[6].toString(16).padStart(2, '0')} 0x${modified[7].toString(16).padStart(2, '0')}`);
console.log(`  Total size: ${modified.length} bytes`);
