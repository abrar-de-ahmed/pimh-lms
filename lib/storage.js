const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');

// Ensure directory exists synchronously on startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Extracts base64 and writes to local disk.
 * Returns the public URL path /api/downloads/:filename
 */
async function uploadBase64(dataUrl, folder = 'uploads') {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl; 
  }

  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid Base64 Data URL format');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  
  let ext = 'bin';
  if (mimeType.includes('/')) {
    ext = mimeType.split('/')[1];
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ext = 'docx';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') ext = 'pptx';
  if (mimeType === 'application/pdf') ext = 'pdf';
  if (mimeType === 'text/plain') ext = 'txt';

  const filename = `${folder}_${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  await fs.promises.writeFile(filePath, buffer);
  
  return `/api/downloads/${filename}`;
}

module.exports = { uploadBase64 };
