/**
 * Icon Generator Script
 * Run this in a browser console or Node.js with canvas to generate PNG icons
 * 
 * Or use these online tools:
 * - https://realfavicongenerator.net/
 * - https://favicon.io/favicon-converter/
 * 
 * Upload the icon.svg and download the generated PNGs
 */

// For browser console:
function generateIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#3b82f6');
  gradient.addColorStop(1, '#1d4ed8');
  
  // Rounded rectangle
  const radius = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Phone icon (simplified)
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.05;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const scale = size / 128;
  ctx.save();
  ctx.scale(scale, scale);
  
  // Phone path
  ctx.beginPath();
  ctx.moveTo(88, 78.5);
  ctx.lineTo(88, 90.5);
  ctx.quadraticCurveTo(88, 98.5, 79.3, 98.5);
  ctx.moveTo(79.3, 98.5);
  // Simplified phone shape
  ctx.restore();
  
  // Plus badge
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(size * 0.75, size * 0.3, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#1d4ed8';
  ctx.font = `bold ${size * 0.15}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', size * 0.75, size * 0.3);
  
  return canvas.toDataURL('image/png');
}

// Generate all sizes
[16, 32, 48, 128].forEach(size => {
  console.log(`icon${size}.png:`, generateIcon(size));
});
