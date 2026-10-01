/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Geometry Dash .GMD File Parser & Converter for Cube Dash Engine
 * Complies with ES2019 & Kindle browser restrictions.
 */

import { ungzip, inflate, inflateRaw } from 'pako';
import { LevelData, ROWS } from '../types';

export interface GMDParseResult {
  success: boolean;
  level?: LevelData;
  error?: string;
  stats?: {
    objectCount: number;
    coins: number;
    cols: number;
  };
}

/**
 * Clean and decode Base64 string to Uint8Array safely
 */
function base64ToUint8Array(b64: string): Uint8Array {
  let clean = b64.trim();
  // Handle URL-encoded base64 if present
  if (clean.includes('%')) {
    try {
      clean = decodeURIComponent(clean);
    } catch (e) {}
  }
  // Remove whitespace and url-safe base64 replacements
  clean = clean.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  // Remove any non-base64 characters
  clean = clean.replace(/[^A-Za-z0-9+/=]/g, '');
  // Pad if needed
  while (clean.length % 4 !== 0) {
    clean += '=';
  }
  const binaryString = atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Helper to convert Uint8Array into a UTF-8 string safely
 */
function decodeBytesToString(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

/**
 * Decode common XML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Decompresses GZIP / ZLIB / Deflate data or returns raw text.
 * Robustly handles RobTop / GD exports where GZIP trailer CRC32 is omitted or invalid.
 */
function decompressLevelData(dataStr: string): string {
  if (!dataStr) return '';
  let trimmed = dataStr.trim();

  // If URL-encoded, decode it first
  if (trimmed.includes('%')) {
    try {
      trimmed = decodeURIComponent(trimmed);
    } catch (e) {}
  }

  // If it's already a raw level string (starts with kS, kA, or contains object delimiter ';')
  if (trimmed.indexOf(';') !== -1 && (trimmed.indexOf('kS') === 0 || trimmed.indexOf('kA') === 0 || trimmed.indexOf('1,') !== -1)) {
    return trimmed;
  }

  try {
    const bytes = base64ToUint8Array(trimmed);
    if (!bytes || bytes.length === 0) return trimmed;

    let decompressed: string | null = null;

    // Check GZIP magic bytes: 0x1f, 0x8b
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      try {
        decompressed = decodeBytesToString(ungzip(bytes));
      } catch (eGzip) {
        // RobTop / GD exports frequently fail standard GZIP trailer check ("incorrect data check").
        // Parse RFC 1952 header flags to find the exact start of raw deflate payload:
        let offset = 10;
        if (bytes.length >= 4) {
          const flg = bytes[3];
          if (flg & 4) {
            // FEXTRA
            if (offset + 2 <= bytes.length) {
              const xlen = bytes[offset] | (bytes[offset + 1] << 8);
              offset += 2 + xlen;
            }
          }
          if (flg & 8) {
            // FNAME
            while (offset < bytes.length && bytes[offset] !== 0) offset++;
            offset++; // skip null byte
          }
          if (flg & 16) {
            // FCOMMENT
            while (offset < bytes.length && bytes[offset] !== 0) offset++;
            offset++; // skip null byte
          }
          if (flg & 2) {
            // FHCRC
            offset += 2;
          }
        }

        // Try raw inflate without 8-byte trailer
        if (bytes.length >= offset + 8) {
          try {
            decompressed = decodeBytesToString(inflateRaw(bytes.subarray(offset, bytes.length - 8)));
          } catch (eRaw1) {}
        }

        // Try raw inflate with remaining buffer (pako inflateRaw stops at stream end)
        if (!decompressed) {
          try {
            decompressed = decodeBytesToString(inflateRaw(bytes.subarray(offset)));
          } catch (eRaw2) {}
        }

        // Try default offset 10 if offset was different
        if (!decompressed && offset !== 10) {
          try {
            decompressed = decodeBytesToString(inflateRaw(bytes.subarray(10)));
          } catch (eRaw3) {}
        }
      }
    }

    // Check ZLIB magic bytes: 0x78
    if (!decompressed && bytes.length >= 2 && bytes[0] === 0x78) {
      try {
        decompressed = decodeBytesToString(inflate(bytes));
      } catch (eZlib) {
        try {
          decompressed = decodeBytesToString(inflateRaw(bytes.subarray(2)));
        } catch (eRaw) {}
      }
    }

    // Try raw inflate without headers
    if (!decompressed) {
      try {
        decompressed = decodeBytesToString(inflateRaw(bytes));
      } catch (e1) {
        try {
          decompressed = decodeBytesToString(inflate(bytes));
        } catch (e2) {
          try {
            decompressed = decodeBytesToString(ungzip(bytes));
          } catch (e3) {}
        }
      }
    }

    // If binary was plain text UTF-8 or ASCII
    if (!decompressed) {
      const plain = decodeBytesToString(bytes);
      if (plain.indexOf(';') !== -1 || plain.indexOf('1,') !== -1) {
        decompressed = plain;
      }
    }

    if (decompressed) {
      // In some GD versions, the inner level string may be double-encoded
      const decTrimmed = decompressed.trim();
      if (decTrimmed.indexOf(';') === -1) {
        if (decTrimmed.startsWith('H4sI') || decTrimmed.startsWith('eJ') || decTrimmed.includes('%20') || decTrimmed.includes('%2C')) {
          const secondPass = decompressLevelData(decTrimmed);
          if (secondPass && secondPass.indexOf(';') !== -1) {
            return secondPass;
          }
        }
      }
      return decompressed;
    }

    return trimmed;
  } catch (err) {
    // If base64 decoding fails, return the string as-is
    return trimmed;
  }
}

/**
 * Extracts a key's value from an XML Plist / RobTop <d> string
 */
function extractPlistTag(xml: string, keyName: string): string | null {
  // Pattern 1: <k>keyName</k><s>value</s> or <k> keyName </k><s ...>value</s>
  const regex1 = new RegExp('<k>\\s*' + keyName + '\\s*<\\/k>\\s*<s[^>]*>([\\s\\S]*?)<\\/s>', 'i');
  const m1 = xml.match(regex1);
  if (m1 && m1[1] !== undefined) {
    return decodeXmlEntities(m1[1]);
  }

  // Pattern 2: <key>keyName</key><string>value</string>
  const regex2 = new RegExp('<key>\\s*' + keyName + '\\s*<\\/key>\\s*<string[^>]*>([\\s\\S]*?)<\\/string>', 'i');
  const m2 = xml.match(regex2);
  if (m2 && m2[1] !== undefined) {
    return decodeXmlEntities(m2[1]);
  }

  // Pattern 3: integer values <k>keyName</k><i>123</i>
  const intRegex1 = new RegExp('<k>\\s*' + keyName + '\\s*<\\/k>\\s*<i[^>]*>([\\s\\S]*?)<\\/i>', 'i');
  const m3 = xml.match(intRegex1);
  if (m3 && m3[1] !== undefined) {
    return decodeXmlEntities(m3[1]);
  }

  // Pattern 4: integer values <key>keyName</key><integer>123</integer>
  const intRegex2 = new RegExp('<key>\\s*' + keyName + '\\s*<\\/key>\\s*<integer[^>]*>([\\s\\S]*?)<\\/integer>', 'i');
  const m4 = xml.match(intRegex2);
  if (m4 && m4[1] !== undefined) {
    return decodeXmlEntities(m4[1]);
  }

  return null;
}

/**
 * Main parser: takes a .GMD string (or file content) and returns a LevelData object
 */
export function parseGMDContent(content: string, fallbackFileName?: string): GMDParseResult {
  if (!content || !content.trim()) {
    return { success: false, error: 'Empty .GMD file content' };
  }

  const trimmed = content.trim();
  let levelName = 'GMD LEVEL';
  let authorName = 'GD Creator';
  let rawLevelString = '';

  // 1. Check if it's an XML Plist / RobTop dictionary format
  // Geometry Dash saves and exports use <d><k>key</k><s>value</s> or <plist><dict>...
  const isXml =
    trimmed.startsWith('<') ||
    trimmed.indexOf('<plist') !== -1 ||
    trimmed.indexOf('<dict') !== -1 ||
    trimmed.indexOf('<d>') !== -1 ||
    trimmed.indexOf('<d ') !== -1 ||
    trimmed.indexOf('</d>') !== -1 ||
    trimmed.indexOf('<k>') !== -1 ||
    trimmed.indexOf('<key>') !== -1;

  if (isXml) {
    const k2 = extractPlistTag(trimmed, 'k2') || extractPlistTag(trimmed, 'name'); // Level name
    const k5 = extractPlistTag(trimmed, 'k5') || extractPlistTag(trimmed, 'author'); // Author
    let k4 = extractPlistTag(trimmed, 'k4') || extractPlistTag(trimmed, 'data') || extractPlistTag(trimmed, 'levelString'); // Level data string

    if (k2) levelName = k2;
    if (k5) authorName = k5;

    // Fallback: If k4 wasn't found by tag name, scan for string tags containing base64 gzip data
    if (!k4) {
      const genericStrMatch = trimmed.match(/<s[^>]*>(H4sI[\s\S]*?)<\/s>/i) ||
                              trimmed.match(/<string[^>]*>(H4sI[\s\S]*?)<\/string>/i) ||
                              trimmed.match(/<s[^>]*>(eJ[\s\S]*?)<\/s>/i) ||
                              trimmed.match(/<string[^>]*>(eJ[\s\S]*?)<\/string>/i);
      if (genericStrMatch && genericStrMatch[1]) {
        k4 = genericStrMatch[1];
      }
    }

    if (!k4) {
      return { success: false, error: 'No level data (key k4) found in .GMD / XML level file' };
    }

    rawLevelString = decompressLevelData(k4);
  } else if (trimmed.indexOf('{') === 0) {
    // 2. Check if JSON formatted .GMD
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.name) levelName = parsed.name;
      else if (parsed.k2) levelName = parsed.k2;

      if (parsed.author) authorName = parsed.author;
      else if (parsed.k5) authorName = parsed.k5;

      const dataField = parsed.k4 || parsed.levelString || parsed.data || parsed.raw;
      if (dataField) {
        rawLevelString = decompressLevelData(dataField);
      } else if (parsed.grid && Array.isArray(parsed.grid)) {
        // Direct Cube Dash JSON level
        return {
          success: true,
          level: parsed,
          stats: {
            objectCount: 0,
            coins: parsed.gearsTotal || 0,
            cols: parsed.cols || 60
          }
        };
      } else {
        return { success: false, error: 'JSON .GMD missing level data string' };
      }
    } catch (e) {
      // Fallback to raw string parsing
      rawLevelString = decompressLevelData(trimmed);
    }
  } else {
    // 3. Raw level string or base64 gzip directly
    rawLevelString = decompressLevelData(trimmed);
  }

  if (!rawLevelString || rawLevelString.indexOf(';') === -1) {
    return {
      success: false,
      error: 'Failed to decompress or parse Geometry Dash level data string'
    };
  }

  if (fallbackFileName && levelName === 'GMD LEVEL') {
    levelName = fallbackFileName.replace(/\.gmd2?$/i, '').toUpperCase();
  }

  // Parse Geometry Dash objects
  const objectStrings = rawLevelString.split(';');
  let maxCol = 50;
  let parsedObjectCount = 0;
  let coinCount = 0;

  // First pass: collect valid raw objects to detect level bounds and ground baseline
  interface RawGDObject {
    objId: number;
    posX: number;
    posY: number;
    flipY: boolean;
    rot: number;
    noTouch: boolean;
  }
  const rawObjects: RawGDObject[] = [];

  for (let idx = 1; idx < objectStrings.length; idx++) {
    const objStr = objectStrings[idx].trim();
    if (!objStr) continue;

    const tokens = objStr.split(',');
    const objMap: Record<string, string> = {};
    for (let t = 0; t < tokens.length - 1; t += 2) {
      objMap[tokens[t]] = tokens[t + 1];
    }

    const objId = parseInt(objMap['1'], 10);
    const posX = parseFloat(objMap['2']);
    const posY = parseFloat(objMap['3']);
    const flipY = objMap['5'] === '1';
    const rot = parseFloat(objMap['6'] || '0');
    const noTouch = objMap['107'] === '1';

    if (isNaN(objId) || isNaN(posX) || isNaN(posY)) {
      continue;
    }

    // Filter out stray objects placed millions of units away in the editor
    if (posX > 32000) {
      continue;
    }

    rawObjects.push({ objId, posX, posY, flipY, rot, noTouch });
  }

  // Determine Ground Baseline:
  // In Geometry Dash, standard ground-level blocks and spikes have center Y=15 (or Y=7.5 for half blocks/spikes).
  // Blocks stacked above the floor have Y = 45, 75, 105, 135...
  // In some custom levels built higher up in the air, the lowest floor may start at Y=105.
  let baseY = 15;
  let minPosX = 150;
  if (rawObjects.length > 0) {
    const minPosY = Math.min(...rawObjects.map(o => o.posY));
    const detectedMinX = Math.min(...rawObjects.map(o => o.posX));
    if (minPosY >= 75) {
      baseY = 105;
    } else {
      baseY = 15;
    }
    minPosX = Math.min(detectedMinX, 150);
  }

  // Temporary list of parsed GD elements
  interface ParsedElem {
    col: number;
    row: number;
    tileChar: string;
  }
  const elements: ParsedElem[] = [];

  // Second pass: map each object to Cube Dash tiles
  for (const obj of rawObjects) {
    const { objId, posX, posY, flipY, rot, noTouch } = obj;

    // Offset column so start has 5 columns of run-up room before the first obstacle
    const col = Math.max(0, Math.round((posX - minPosX) / 30) + 5);
    // Ground Y (gdGridY = 0) maps to Row 9 in Cube Dash (floor level)
    const gdGridY = Math.round((posY - baseY) / 30);
    const row = 9 - gdGridY;

    if (col > maxCol) maxCol = col;

    let tileChar = '';

    // Determine tile character based on Geometry Dash object ID & properties
    // In GD: standard spike points UP. It points DOWN if rotated ~180° or flipped vertically,
    // points RIGHT if rotated ~90°, and points LEFT if rotated ~270°.
    const normRot = ((Math.round(rot) % 360) + 360) % 360;
    const isDownSpike = (normRot >= 135 && normRot <= 225) !== flipY;
    const isRightSpike = normRot >= 45 && normRot < 135;
    const isLeftSpike = normRot > 225 && normRot <= 315;

    // 0. Passable / Phasable Walls & Fake Blocks (OpenGD object_type 7 decoration blocks)
    // ID 5 is square_05_001.png - the classic fake block RobTop placed in Stereo Madness for the secret coin wall!
    const isFakeBlock =
      objId === 5 ||
      objId === 73 ||
      objId === 80 ||
      objId === 120 ||
      objId === 164 ||
      objId === 193 ||
      (objId >= 233 && objId <= 235) ||
      objId === 245 ||
      objId === 246 ||
      (objId >= 279 && objId <= 282) ||
      objId === 502 ||
      (objId >= 1140 && objId <= 1153) ||
      (objId >= 1893 && objId <= 1898) ||
      noTouch;

    if (isFakeBlock) {
      tileChar = 'f'; // Phasable / Fake Wall (walk/jump through without dying)
    }
    // 1. Solid Blocks (In GD, IDs 1..4, 6, 7 are standard square blocks; 5 is fake block)
    else if (
      (objId >= 1 && objId <= 7 && objId !== 5) ||
      (objId >= 62 && objId <= 66) ||
      objId === 68 ||
      objId === 69 ||
      objId === 70 ||
      (objId >= 71 && objId <= 78 && objId !== 73) ||
      objId === 81 ||
      objId === 82 ||
      objId === 83 ||
      (objId >= 90 && objId <= 96) ||
      (objId >= 116 && objId <= 122 && objId !== 120) ||
      objId === 143 ||
      objId === 146 ||
      (objId >= 160 && objId <= 176 && objId !== 164) ||
      objId === 192 ||
      objId === 194 ||
      objId === 195 ||
      objId === 197 ||
      (objId >= 206 && objId <= 213) ||
      objId === 220 ||
      (objId >= 247 && objId <= 275) ||
      (objId >= 467 && objId <= 470) ||
      (objId >= 483 && objId <= 494)
    ) {
      tileChar = 'b'; // Solid block
    }
    // 2. Decorative / Fake Spikes (noTouch or decorative spikes: non-lethal)
    else if (
      (noTouch && (objId === 8 || objId === 39 || objId === 103)) ||
      (objId >= 135 && objId <= 139) ||
      objId === 247 ||
      objId === 248
    ) {
      tileChar = isDownSpike ? 'd' : 'D'; // Decorative safe spike
    }
    // 3. Full Spikes (Standard spike is ID 8: spike_01_001.png)
    else if (
      objId === 8 ||
      (objId >= 18 && objId <= 21) ||
      objId === 103 ||
      (objId >= 123 && objId <= 128) ||
      (objId >= 177 && objId <= 179) ||
      objId === 191 ||
      objId === 198 ||
      objId === 199 ||
      (objId >= 216 && objId <= 217) ||
      objId === 392
    ) {
      if (isDownSpike) tileChar = 'c';
      else if (isLeftSpike) tileChar = '<';
      else if (isRightSpike) tileChar = '>';
      else tileChar = 's';
    }
    // 4. Half Spikes / Short Spikes (ID 39: spike_02_001.png)
    else if (
      objId === 39 ||
      objId === 205 ||
      objId === 218
    ) {
      if (isDownSpike) tileChar = 'H';
      else if (isLeftSpike) tileChar = '<';
      else if (isRightSpike) tileChar = '>';
      else tileChar = 'h';
    }
    // 5. Platforms / Slabs (ID 40: plank_01_001.png)
    else if (
      objId === 40 ||
      objId === 147 ||
      objId === 196 ||
      objId === 204 ||
      objId === 215 ||
      objId === 219 ||
      (objId >= 369 && objId <= 374) ||
      (objId >= 471 && objId <= 474) ||
      (objId >= 769 && objId <= 770) ||
      (objId >= 289 && objId <= 300)
    ) {
      tileChar = 'B'; // Half platform
    }
    // 5. Saws & Hazard Wheels
    else if (
      objId === 88 ||
      objId === 89 ||
      objId === 98 ||
      (objId >= 183 && objId <= 188) ||
      (objId >= 397 && objId <= 399) ||
      (objId >= 675 && objId <= 677)
    ) {
      tileChar = 'x'; // Saw hazard
    }
    // 6. Jump Pads
    else if (objId === 35 || objId === 140 || objId === 1332) {
      tileChar = 'p'; // Yellow/Pink bounce pad
    } else if (objId === 67) {
      tileChar = 'g'; // Blue gravity pad -> invert gravity
    }
    // 7. Jump Rings / Orbs
    else if (
      objId === 36 || // Yellow orb
      objId === 84 || // Blue orb
      objId === 141 || // Pink orb
      objId === 1022 || // Green orb
      objId === 1330 || // Black orb
      objId === 1333 || // Dash orb
      objId === 1704
    ) {
      tileChar = 'r'; // Air ring
    }
    // 8. Gravity Portals (ID 10 = Normal gravity, ID 11 = Invert gravity)
    else if (objId === 10) {
      tileChar = 'n'; // Normal gravity portal
    } else if (objId === 11) {
      tileChar = 'g'; // Invert gravity portal
    }
    // 9. Game Mode Portals (ID 12 = Cube, ID 13 = Ship, ID 47 = Ball, ID 111 = UFO)
    else if (objId === 12) {
      tileChar = 'q'; // Cube portal
    } else if (objId === 13) {
      tileChar = 'w'; // Ship portal
    } else if (objId === 47 || objId === 221) {
      tileChar = 'a'; // Ball portal
    } else if (objId === 111) {
      tileChar = 'u'; // UFO portal
    } else if (objId === 660) {
      tileChar = 'v'; // Wave portal
    } else if (objId === 745 || objId === 901) {
      tileChar = 'k'; // Robot portal
    } else if (objId === 1331 || objId === 1932) {
      tileChar = 'y'; // Swing portal
    }
    // 10. Speed Portals
    else if (objId === 200) {
      tileChar = '1'; // Speed 0.5x
    } else if (objId === 201) {
      tileChar = '2'; // Speed 1.0x
    } else if (objId === 202) {
      tileChar = '3'; // Speed 2.0x
    } else if (objId === 203 || objId === 1334) {
      tileChar = '4'; // Speed 3.0x
    }
    // 11. Secret & User Coins
    else if (objId === 142 || objId === 1329) {
      if (coinCount < 3) {
        tileChar = '*';
        coinCount++;
      }
    }
    // 12. StartPos (ID 31, 34: edit_eStartPosBtn_001)
    else if (objId === 31 || objId === 34) {
      tileChar = 'S'; // StartPos practice spawn
    }
    // 13. GD 2.2 Camera Zoom Trigger (ID 1914)
    else if (objId === 1914) {
      tileChar = 'Z'; // Zoom in trigger
    }

    if (tileChar) {
      parsedObjectCount++;
      // Clamp row within visible playfield (Row 2 to 9)
      const clampedRow = Math.max(2, Math.min(9, row));
      elements.push({ col, row: clampedRow, tileChar });
    }
  }

  if (elements.length === 0) {
    return {
      success: false,
      error: 'No recognized Geometry Dash obstacles could be mapped from this .GMD file.'
    };
  }

  // Build 12-row grid matrix
  const totalCols = Math.max(60, maxCol + 8);
  const gridMatrix: string[][] = Array.from({ length: ROWS }, () =>
    Array(totalCols).fill('.')
  );

  // Fill in parsed elements
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.col < totalCols && el.row >= 0 && el.row < ROWS) {
      // If portal or speed trigger, fill vertical column so player cannot miss it
      const isPortalOrTrigger =
        el.tileChar === 'w' ||
        el.tileChar === 'q' ||
        el.tileChar === 'a' ||
        el.tileChar === 'u' ||
        el.tileChar === 'v' ||
        el.tileChar === 'k' ||
        el.tileChar === 'y' ||
        el.tileChar === 'g' ||
        el.tileChar === 'n' ||
        el.tileChar === '1' ||
        el.tileChar === '2' ||
        el.tileChar === '3' ||
        el.tileChar === '4';

      if (isPortalOrTrigger) {
        for (let r = 2; r <= 9; r++) {
          gridMatrix[r][el.col] = el.tileChar;
        }
      } else {
        gridMatrix[el.row][el.col] = el.tileChar;
      }
    }
  }

  // Add Finish line at the end
  const finishCol = totalCols - 2;
  for (let r = 2; r <= 9; r++) {
    gridMatrix[r][finishCol] = 'e';
  }

  const gridStrings = gridMatrix.map(row => row.join(''));

  const resultLevel: LevelData = {
    id: 'gmd-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    name: levelName.toUpperCase().slice(0, 32),
    author: authorName.slice(0, 24),
    diff: 1, // Default Normal
    speed: 1.0, // 1.0x GD Normal speed
    cols: totalCols,
    rows: ROWS,
    grid: gridStrings,
    gearsTotal: coinCount,
    isCommunity: true,
    createdAt: Date.now()
  };

  return {
    success: true,
    level: resultLevel,
    stats: {
      objectCount: parsedObjectCount,
      coins: coinCount,
      cols: totalCols
    }
  };
}
