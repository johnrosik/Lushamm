const sharp = require('sharp');

// Create a small image that shouldn't need much compression
async function createSmallImage() {
  try {
    await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 100, g: 150, b: 200 }
      }
    })
    .jpeg({ quality: 70 })
    .toFile('./test-files/small-test-image.jpg');
    
    console.log('Small test image created!');
    
    const fs = require('fs');
    const stats = fs.statSync('./test-files/small-test-image.jpg');
    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('Error:', error);
  }
}

createSmallImage();
