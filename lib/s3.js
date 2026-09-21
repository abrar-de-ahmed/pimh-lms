const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const bucketName = process.env.AWS_S3_BUCKET || 'pimh-lms-uploads';
const region = process.env.AWS_REGION || 'us-east-1';

const s3Client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy-key',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy-secret'
  }
});

/**
 * Uploads a base64 encoded dataURL to S3.
 * Returns the public URL of the uploaded object if successful.
 * If credentials are 'dummy-key', bypasses AWS upload and returns the Base64 directly 
 * to ensure the app doesn't break locally without AWS credentials configured yet.
 */
async function uploadBase64ToS3(dataUrl, folder = 'uploads') {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl; // Might just be a standard URL or empty string
  }
  
  if (process.env.AWS_ACCESS_KEY_ID === 'dummy-key' || !process.env.AWS_ACCESS_KEY_ID) {
    // Graceful fallback for local development without credentials configured
    console.log('[S3 Stub] Upload bypassed, returning raw Base64 dataURL (Add AWS creds to .env to enable real S3 uploads)');
    return dataUrl;
  }

  // Parse dataUrl, e.g. data:image/png;base64,iVBORw0KG...
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

  const filename = `${folder}/${crypto.randomBytes(16).toString('hex')}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: filename,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  
  return `https://${bucketName}.s3.${region}.amazonaws.com/${filename}`;
}

module.exports = { uploadBase64ToS3 };
