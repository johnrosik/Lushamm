const sharp = require('sharp');
const fs = require('fs');

// Create a larger, more complex image for compression testing
const width = 2400;
const height = 1600;

const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF6B6B;stop-opacity:1" />
      <stop offset="25%" style="stop-color:#4ECDC4;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#45B7D1;stop-opacity:1" />
      <stop offset="75%" style="stop-color:#96CEB4;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFEAA7;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="100%" height="100%" fill="url(#grad1)"/>
  
  <!-- Decorative elements to increase file size -->
  <g opacity="0.3">
    ${Array.from({length: 50}, (_, i) => `
      <circle cx="${Math.random() * width}" cy="${Math.random() * height}" 
              r="${Math.random() * 50 + 10}" fill="white"/>
    `).join('')}
  </g>
  
  <text x="50%" y="30%" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="96" fill="white" stroke="black" stroke-width="2">
    LUSHAMM RPG
  </text>
  
  <text x="50%" y="40%" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="48" fill="#FFF">
    Sistema de Compressão de Imagens
  </text>
  
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="32" fill="#FFF">
    Teste de Upload - Imagem ${width}x${height}
  </text>
  
  <text x="50%" y="60%" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="24" fill="#FFF">
    Esta imagem deve ser comprimida para menos de 1MB
  </text>
  
  <!-- Additional complex patterns -->
  <g opacity="0.2">
    ${Array.from({length: 100}, (_, i) => `
      <rect x="${Math.random() * width}" y="${Math.random() * height}" 
            width="${Math.random() * 100 + 20}" height="${Math.random() * 100 + 20}" 
            fill="rgba(255,255,255,0.${Math.floor(Math.random() * 5) + 1})" 
            transform="rotate(${Math.random() * 360} ${Math.random() * width} ${Math.random() * height})"/>
    `).join('')}
  </g>
</svg>
`;

async function createLargeTestImage() {
  try {
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 95 })
      .toFile('./test-files/very-large-test-image.jpg');
    
    console.log('Large test image created successfully!');
    
    // Check file size
    const stats = fs.statSync('./test-files/very-large-test-image.jpg');
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.error('Error creating large test image:', error);
  }
}

createLargeTestImage();
