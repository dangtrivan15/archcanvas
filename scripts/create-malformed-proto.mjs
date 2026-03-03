import fs from 'fs';
import crypto from 'crypto';

// Create a malformed protobuf payload: field 10, wire type 7 (invalid)
const payload = Buffer.from([0x57, 0x00, 0x01, 0x02]);

// Compute correct SHA-256 for this payload
const checksum = crypto.createHash('sha256').update(payload).digest();

// Build .archc file: magic(6) + version(2) + sha256(32) + payload
const magic = Buffer.from([0x41, 0x52, 0x43, 0x48, 0x43, 0x00]); // ARCHC\0
const version = Buffer.from([0x00, 0x01]); // version 1

const result = Buffer.concat([magic, version, checksum, payload]);
fs.writeFileSync('public/malformed-proto.archc', result);
console.log('Created malformed-proto.archc (' + result.length + ' bytes)');
console.log('Payload: [' + Array.from(payload).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ') + ']');
