#!/usr/bin/env node
// Verify every signed §13.8 provenance record against the committed signer
// registry (§13.8.1/§13.8.2): registry resolution, role, validity window,
// active status, fingerprint match, and Ed25519 signature over the
// signatures-omitted RFC 8785 canonical subject. Exits nonzero on any
// failure. Prints the provenance index digest and registry revision.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROV = path.join(ROOT, 'tests/visual/card-packet/provenance');

const sortDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]),
    );
  }
  return value;
};
const canonical = (obj) => Buffer.from(JSON.stringify(sortDeep(obj)), 'utf8');
const sha256 = (buf) => 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');

const registry = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'thoughts/shared/tiny-fangs-signers.json'), 'utf8'),
);

function verifyBlock(block, subjectBytes, expectedRole) {
  const entry = registry.signers.find(
    (s) => s.signerId === block.signerId && s.fingerprint === block.publicKeyFingerprint,
  );
  if (!entry) throw new Error(`unresolved signer ${block.signerId}`);
  if (block.role !== expectedRole || !entry.roles.includes(expectedRole)) {
    throw new Error(`${block.signerId} wrong role ${block.role}`);
  }
  if (entry.status !== 'active') throw new Error(`${block.signerId} not active`);
  if (block.signedAt < entry.validFrom) throw new Error(`${block.signerId} signed before validFrom`);
  if (entry.validUntil && block.signedAt > entry.validUntil) {
    throw new Error(`${block.signerId} signed after validUntil`);
  }
  if (block.subjectSha256 !== sha256(subjectBytes)) {
    throw new Error(`${block.signerId} subject digest mismatch`);
  }
  const pub = crypto.createPublicKey({
    key: Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(entry.publicKey, 'base64'),
    ]),
    format: 'der',
    type: 'spki',
  });
  if (!crypto.verify(null, subjectBytes, pub, Buffer.from(block.signature, 'base64'))) {
    throw new Error(`${block.signerId} signature invalid`);
  }
}

const index = JSON.parse(fs.readFileSync(path.join(PROV, 'provenance-index.json'), 'utf8'));
const { indexSha256, ...indexRest } = index;
if (sha256(canonical(indexRest)) !== indexSha256) {
  throw new Error('provenance index digest mismatch');
}

for (const row of index.records) {
  const recordPath = path.join(ROOT, 'tests/visual/card-packet', row.recordPath);
  if (sha256(fs.readFileSync(recordPath)) !== row.fileSha256) {
    throw new Error(`file digest mismatch: ${row.recordPath}`);
  }
  const signed = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  const { signatures, ...record } = signed;
  const { recordSha256, ...recordRest } = record;
  if (sha256(canonical(recordRest)) !== recordSha256 || recordSha256 !== row.recordSha256) {
    throw new Error(`record digest mismatch: ${row.assetId}`);
  }
  const subject = canonical(record);
  verifyBlock(signatures.creator, subject, 'creator');
  verifyBlock(signatures.reviewer, subject, 'provenance-reviewer');
  if (signatures.creator.signerId === signatures.reviewer.signerId) {
    throw new Error(`self-signed record: ${row.assetId}`);
  }
  // Motif review must be complete with no unresolved escalation.
  const rows = signed.motifReview.rows;
  if (rows.length !== 10 || rows.some((r) => r.verdict === 'similar-escalated')) {
    throw new Error(`motif review incomplete/escalated: ${row.assetId}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  registryRevision: registry.registryRevision,
  provenanceIndexSha256: indexSha256,
  records: index.records.length,
}));
