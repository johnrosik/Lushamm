const sharp = require('sharp');
const fs = require('fs');

// Create a simple colored rectangle as test image
const width = 800;
const height = 600;

const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#4A90E2"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="48" fill="white">
    LUSHAMM RPG
  </text>
  <text x="50%" y="60%" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="24" fill="#E8F4FD">
    Test Image for Upload
  </text>
</svg>
`;

async function createTestImage() {
  try {
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 90 })
      .toFile('./test-files/large-test-image.jpg');
    
    console.log('Test image created successfully!');
    
    // Check file size
    const stats = fs.statSync('./test-files/large-test-image.jpg');
    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('Error creating test image:', error);
  }
}

createTestImage();
