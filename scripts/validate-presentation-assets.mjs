import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSET_VALIDATION_PHASES,
  PRESENTATION_ASSET_MANIFEST
} from '../src/presentation/assets/manifest.js';
import { validatePresentationAssetManifest } from '../src/presentation/assets/manifest-validation.js';
import { createRepresentativeRuntimeFaces } from '../src/presentation/assets/runtime-face-samples.js';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

function parsePhase(argv) {
  const value = argv.find(argument => argument.startsWith('--phase='))
    ?.slice('--phase='.length) ?? ASSET_VALIDATION_PHASES.DRAFT;

  if (!Object.values(ASSET_VALIDATION_PHASES).includes(value)) {
    throw new Error(`--phase must be draft or release; received ${value}`);
  }
  return value;
}

function parsePngDimensions(buffer) {
  if (buffer.length < 24 ||
      buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function parseWebpDimensions(buffer) {
  if (buffer.length < 30 ||
      buffer.toString('ascii', 0, 4) !== 'RIFF' ||
      buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }

  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (chunk === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }

  if (chunk === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff)
    };
  }

  return null;
}

function parseJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) {
      return null;
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5)
      };
    }

    offset += 2 + length;
  }

  return null;
}

function readImageDimensions(buffer, extension) {
  if (extension === '.png') return parsePngDimensions(buffer);
  if (extension === '.webp') return parseWebpDimensions(buffer);
  if (extension === '.jpg' || extension === '.jpeg') {
    return parseJpegDimensions(buffer);
  }
  return null;
}

async function indexExpectedFiles(manifest) {
  const index = new Map();
  const expectedFiles = manifest.assets.flatMap(asset => asset.files);

  for (const file of expectedFiles) {
    const absolutePath = path.resolve(REPO_ROOT, file.path);
    const insideRepository = absolutePath === REPO_ROOT ||
      absolutePath.startsWith(`${REPO_ROOT}${path.sep}`);
    if (!insideRepository) {
      throw new Error(`Manifest path leaves repository root: ${file.path}`);
    }

    try {
      const [buffer, metadata] = await Promise.all([
        readFile(absolutePath),
        stat(absolutePath)
      ]);
      const dimensions = file.mediaType === 'image'
        ? readImageDimensions(buffer, path.extname(absolutePath).toLowerCase())
        : null;
      index.set(file.path, {
        bytes: metadata.size,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        ...(dimensions ?? {})
      });
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return index;
}

function countByCode(issues) {
  const counts = new Map();
  for (const item of issues) {
    counts.set(item.code, (counts.get(item.code) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

const phase = parsePhase(process.argv.slice(2));
const fileIndex = await indexExpectedFiles(PRESENTATION_ASSET_MANIFEST);
const runtimeFaces = createRepresentativeRuntimeFaces();
const report = validatePresentationAssetManifest(PRESENTATION_ASSET_MANIFEST, {
  phase,
  fileIndex,
  runtimeFaces
});

console.log(
  `Tiny Fangs asset manifest (${phase}): ` +
  `${report.summary.canonicalFaceCount} canonical faces, ` +
  `${report.summary.assetCount} total assets, ` +
  `${report.summary.requiredFileCount} required files`
);
console.log(`Errors: ${report.errors.length}; warnings: ${report.warnings.length}`);

for (const [code, count] of countByCode([...report.errors, ...report.warnings])) {
  console.log(`- ${code}: ${count}`);
}

if (!report.ok) {
  process.exitCode = 1;
}

