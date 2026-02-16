// Minimal PNG icon generator — no dependencies required
// Creates simple colored PNG icons for the Chrome extension

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
    // Create RGBA pixel data
    const pixels = Buffer.alloc(size * size * 4);
    const center = size / 2;
    const cornerR = size * 0.1875;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;

            // Rounded rectangle check
            let inside = true;
            if (x < cornerR && y < cornerR) {
                inside = Math.sqrt((cornerR - x) ** 2 + (cornerR - y) ** 2) <= cornerR;
            } else if (x > size - cornerR && y < cornerR) {
                inside = Math.sqrt((x - (size - cornerR)) ** 2 + (cornerR - y) ** 2) <= cornerR;
            } else if (x < cornerR && y > size - cornerR) {
                inside = Math.sqrt((cornerR - x) ** 2 + (y - (size - cornerR)) ** 2) <= cornerR;
            } else if (x > size - cornerR && y > size - cornerR) {
                inside = Math.sqrt((x - (size - cornerR)) ** 2 + (y - (size - cornerR)) ** 2) <= cornerR;
            }

            if (!inside) {
                pixels[idx] = 0;
                pixels[idx + 1] = 0;
                pixels[idx + 2] = 0;
                pixels[idx + 3] = 0;
                continue;
            }

            // Background gradient (dark blue)
            const t = (x + y) / (2 * size);
            const bgR = Math.floor(15 + t * 11);
            const bgG = Math.floor(15 + t * 11);
            const bgB = Math.floor(35 + t * 11);

            // Lock body region
            const bodyX1 = size * 0.25;
            const bodyX2 = size * 0.75;
            const bodyY1 = size * 0.45;
            const bodyY2 = size * 0.85;

            // Lock shackle region (arc)
            const shackleR = size * 0.15;
            const shackleCX = size * 0.5;
            const shackleCY = size * 0.42;
            const shackleThickness = size * 0.07;

            const distToShackle = Math.sqrt((x - shackleCX) ** 2 + (y - shackleCY) ** 2);
            const isShackle = y < shackleCY &&
                Math.abs(distToShackle - shackleR) < shackleThickness &&
                x > shackleCX - shackleR - shackleThickness &&
                x < shackleCX + shackleR + shackleThickness;

            const isBody = x >= bodyX1 && x <= bodyX2 && y >= bodyY1 && y <= bodyY2;

            if (isBody || isShackle) {
                // Gold gradient
                const goldT = (x + y) / (2 * size);
                pixels[idx] = Math.floor(251 - goldT * 10);     // R
                pixels[idx + 1] = Math.floor(191 - goldT * 30); // G
                pixels[idx + 2] = Math.floor(36 + goldT * 5);   // B
                pixels[idx + 3] = 255;
            } else {
                pixels[idx] = bgR;
                pixels[idx + 1] = bgG;
                pixels[idx + 2] = bgB;
                pixels[idx + 3] = 255;
            }
        }
    }

    // Encode as PNG
    return encodePNG(pixels, size, size);
}

function encodePNG(pixels, width, height) {
    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8;  // bit depth
    ihdrData[9] = 6;  // RGBA
    ihdrData[10] = 0; // compression
    ihdrData[11] = 0; // filter
    ihdrData[12] = 0; // interlace
    const ihdr = createChunk('IHDR', ihdrData);

    // IDAT chunk — create raw image data with filter byte per row
    const rawData = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
        rawData[y * (1 + width * 4)] = 0; // filter type: None
        pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
    }
    const compressed = zlib.deflateSync(rawData);
    const idat = createChunk('IDAT', compressed);

    // IEND chunk
    const iend = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = crc32(crcData);
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);
    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
    const png = createPNG(size);
    const filename = `icon${size}.png`;
    fs.writeFileSync(path.join(iconsDir, filename), png);
    console.log(`Generated ${filename} (${png.length} bytes)`);
});

console.log('All icons generated successfully!');
