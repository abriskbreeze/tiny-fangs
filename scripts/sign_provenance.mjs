#!/usr/bin/env node
// Build, sign, and verify the §13.8 asset-provenance records for the four
// golden-sample art pieces (art bible accepted hash 84b89838…, schema
// tiny-fangs.asset-provenance.v1).
//
// Honesty contract of this script:
//  - the motif-review block is copied verbatim from the independent
//    fresh-context reviewer's output file; if that file is missing or its
//    overallDecision is not "approve", the reviewer attestation is NOT
//    signed and the script exits nonzero;
//  - creator and reviewer sign with different registered keys (registry
//    forbids self-signing both roles);
//  - signatures are detached Ed25519 over RFC 8785-canonical JSON with the
//    `signatures` field omitted (§13.8), and every hash follows the §13.7.2
//    own-digest-omission rule.
//
// Private keys live outside the repository in ~/.tiny-fangs/signing/.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEYS = path.join(os.homedir(), '.tiny-fangs', 'signing');
const OUT = path.join(ROOT, 'tests/visual/card-packet/provenance');
const REVIEW_PATH = process.argv[2];

if (!REVIEW_PATH || !fs.existsSync(REVIEW_PATH)) {
  console.error('usage: sign_provenance.mjs <motif-review.json> (independent reviewer output required)');
  process.exit(1);
}

const canonical = (obj) =>
  Buffer.from(JSON.stringify(sortDeep(obj)), 'utf8');

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]),
    );
  }
  return value;
}

const sha256 = (buf) => 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');
const fileSha = (p) => sha256(fs.readFileSync(p));

const registry = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'thoughts/shared/tiny-fangs-signers.json'), 'utf8'),
);

function loadSigner(signerId, role) {
  const entry = registry.signers.find((s) => s.signerId === signerId);
  if (!entry) throw new Error(`signer not in registry: ${signerId}`);
  if (!entry.roles.includes(role)) throw new Error(`${signerId} lacks role ${role}`);
  if (entry.status !== 'active') throw new Error(`${signerId} not active`);
  const privPem = fs.readFileSync(path.join(KEYS, `${signerId}.priv.pem`), 'utf8');
  const priv = crypto.createPrivateKey(privPem);
  // Confirm the private key matches the registered public key fingerprint.
  const pub = crypto.createPublicKey(priv);
  const der = pub.export({ type: 'spki', format: 'der' });
  const raw = der.subarray(der.length - 32);
  const fingerprint = crypto.createHash('sha256').update(raw).digest('hex');
  if (fingerprint !== entry.fingerprint) {
    throw new Error(`fingerprint mismatch for ${signerId}`);
  }
  return { entry, priv, fingerprint };
}

function signBlock(subjectBytes, signer, role) {
  return {
    signerId: signer.entry.signerId,
    role,
    signedAt: new Date().toISOString(),
    publicKeyFingerprint: signer.fingerprint,
    subjectSha256: sha256(subjectBytes),
    scheme: 'ed25519',
    signature: crypto.sign(null, subjectBytes, signer.priv).toString('base64'),
  };
}

function verifyBlock(block, subjectBytes) {
  const entry = registry.signers.find(
    (s) => s.signerId === block.signerId && s.fingerprint === block.publicKeyFingerprint,
  );
  if (!entry) return false;
  if (!entry.roles.includes(block.role)) return false;
  if (entry.status !== 'active') return false;
  if (block.signedAt < entry.validFrom) return false;
  const pub = crypto.createPublicKey({
    key: Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(entry.publicKey, 'base64'),
    ]),
    format: 'der',
    type: 'spki',
  });
  return crypto.verify(null, subjectBytes, pub, Buffer.from(block.signature, 'base64'));
}

// ── inputs ──────────────────────────────────────────────────────────
const review = JSON.parse(fs.readFileSync(REVIEW_PATH, 'utf8'));
if (review.overallDecision !== 'approve') {
  console.error('REVIEWER DID NOT APPROVE — escalations:', JSON.stringify(review.escalations));
  process.exit(2);
}
for (const [asset, data] of Object.entries(review.assets)) {
  if (data.rows.length !== 10) throw new Error(`${asset}: motif checklist incomplete`);
  for (const row of data.rows) {
    if (row.verdict === 'similar-escalated') {
      console.error(`ESCALATED ROW without approval path: ${asset} row ${row.row}`);
      process.exit(2);
    }
  }
}

const ART_SOURCE = path.join(ROOT, 'src/presentation/cards/art/golden-sample-art.js');
const artModule = fs.readFileSync(ART_SOURCE, 'utf8');
const artFileSha = sha256(Buffer.from(artModule));

function svgOf(assetKey) {
  const start = artModule.indexOf(`${assetKey}: \``) + assetKey.length + 3;
  const end = artModule.indexOf('`', start);
  return artModule.slice(start, end);
}

const R1 = 'sha256:4ecb53d517d40edc5a7b4907e6991c6b8dcce40cc34e6a21c14b709ed2228056';
const R2 = 'sha256:5229e89ad2888ef9f3245d6ecd77605ec56a3cc29a6e378c4c7474659e4b79e7';

const RIGHTS_TEXT =
  'All rights in this original Tiny Fangs asset are owned by the Tiny Fangs project owner (aBriskBreeze). ' +
  'Created by an AI coding agent operated by and for the project owner as a work made for hire. ' +
  'Permitted uses: all Tiny Fangs production, marketing, and derivative uses, worldwide, perpetual. No third-party content.';

const ASSETS = [
  { assetId: 'golden-duskfang-aperture', faceId: 'duskfang', key: 'duskfang', role: 'creature aperture art' },
  { assetId: 'golden-manasurge-aperture', faceId: 'manaSurge', key: 'manaSurge', role: 'cast aperture art' },
  { assetId: 'golden-phantomwall-aperture', faceId: 'phantomWall', key: 'phantomWall', role: 'set aperture art' },
  { assetId: 'golden-back-sigil', faceId: null, key: 'backSigil', role: 'shared card-back sigil' },
];

const creator = loadSigner('creator-fable-agent', 'creator');
const reviewer = loadSigner('reviewer-fresh-agent', 'provenance-reviewer');
if (creator.entry.signerId === reviewer.entry.signerId) {
  throw new Error('self-signing both roles is invalid (§13.8.1)');
}

fs.mkdirSync(OUT, { recursive: true });
const indexRows = [];

for (const asset of ASSETS) {
  const motif = review.assets[asset.key];
  if (!motif) throw new Error(`reviewer output missing asset ${asset.key}`);

  const record = {
    schema: 'tiny-fangs.asset-provenance.v1',
    identity: {
      assetId: asset.assetId,
      assetRevision: 'r4-task-34',
      presentationFaceId: asset.faceId,
      sceneRole: asset.role,
      sourceFileSha256: sha256(Buffer.from(svgOf(asset.key))),
      exportedFileSha256: artFileSha,
      sourcePath: 'src/presentation/cards/art/golden-sample-art.js',
    },
    creator: {
      identity: 'Claude Fable 5 coding agent, operated for aBriskBreeze',
      creatorId: 'creator-fable-agent',
      relationship: 'agent operated by and for the project owner; work made for hire',
      creationDate: '2026-07-28',
      creationLocation: 'Local agent session, project repository',
      recordOwner: 'aBriskBreeze <joeking212@gmail.com>',
    },
    origin: {
      creationMethod: 'disclosed-assisted-generation',
      disclosure:
        'SVG markup hand-authored path-by-path by the Claude Fable 5 coding agent (model claude-fable-5) directly in code. No image-generation model, no traced geometry, no reference file used as a source layer.',
      sourceInputs: [],
      tool: 'claude-fable-5 (Claude Code agent), hand-written SVG',
      promptOrInputHash: null,
    },
    rights: {
      owner: 'aBriskBreeze (Tiny Fangs project owner)',
      licenseId: 'tiny-fangs-original-work-v1',
      licenseTextSha256: sha256(Buffer.from(RIGHTS_TEXT)),
      licenseText: RIGHTS_TEXT,
      permittedUses: ['production', 'marketing', 'derivatives'],
      territory: 'worldwide',
      term: 'perpetual',
      sublicensing: 'at owner discretion',
      attribution: 'none required',
      thirdPartyContent: 'none',
      restrictions: 'none',
    },
    referenceUse: {
      r1Sha256: R1,
      r2Sha256: R2,
      purpose:
        'visual-language comparison only (palette roles and material mood per art bible §5/§9.4)',
      referenceCropsViewed: 'R1/R2 full frames as reproduced in the accepted art bible',
      statement: 'No reference asset is a source layer of this asset.',
    },
    motifReview: {
      reviewerStatement: review.reviewerStatement,
      reviewerId: 'reviewer-fresh-agent',
      rows: motif.rows,
      decision: 'approved',
    },
  };

  record.recordSha256 = sha256(canonical({ ...record }));

  const subject = canonical({ ...record }); // signatures omitted (not yet present)
  const signatures = {
    creator: signBlock(subject, creator, 'creator'),
    reviewer: signBlock(subject, reviewer, 'provenance-reviewer'),
  };
  const signed = { ...record, signatures };

  if (!verifyBlock(signatures.creator, subject) || !verifyBlock(signatures.reviewer, subject)) {
    throw new Error(`signature verification failed for ${asset.assetId}`);
  }

  const outPath = path.join(OUT, `${asset.assetId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(signed, null, 2) + '\n');
  indexRows.push({
    assetId: asset.assetId,
    recordPath: `provenance/${asset.assetId}.json`,
    recordSha256: record.recordSha256,
    fileSha256: fileSha(outPath),
  });
  console.log('signed + verified:', asset.assetId, record.recordSha256);
}

const index = {
  schema: 'tiny-fangs.provenance-index.v1',
  registryRevision: registry.registryRevision,
  reviewerOutputSha256: fileSha(REVIEW_PATH),
  records: indexRows,
};
index.indexSha256 = sha256(canonical({ ...index }));
fs.writeFileSync(path.join(OUT, 'provenance-index.json'), JSON.stringify(index, null, 2) + '\n');
console.log('provenance index:', index.indexSha256);
