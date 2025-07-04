// Simple icon generator script for PWA
// This creates placeholder icons - in production, use proper icon generation tools

const fs = require('fs');

// Create a simple colored square icon as placeholder
function createIcon(size) {
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="#6366f1"/>
        <g transform="translate(${size/4}, ${size/4})">
            <rect width="${size/2}" height="${size/8}" fill="white" rx="${size/32}"/>
            <rect y="${size/4}" width="${size/2}" height="${size/8}" fill="white" rx="${size/32}"/>
            <rect y="${size/2}" width="${size/3}" height="${size/8}" fill="white" rx="${size/32}"/>
        </g>
    </svg>`;
    
    fs.writeFileSync(`icon-${size}x${size}.svg`, svg);
    console.log(`Created icon-${size}x${size}.svg`);
}

// Generate icons for different sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach(createIcon);

console.log('Icon generation complete!');
console.log('Note: These are SVG placeholders. For production, convert to PNG using an icon generator tool.');
