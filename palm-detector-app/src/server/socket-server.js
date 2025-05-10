const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Create storage directory if it doesn't exist
const IMAGE_DIR = path.join(__dirname, 'captured-images');
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR);
}

let capturedImages = [];

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Send initial images
  socket.emit('initial-images', capturedImages);

  // Handle image capture with acknowledgement
  socket.on('capture-image', (imageData, callback) => {
    try {
      const timestamp = Date.now();
      const filename = `img-${timestamp}-${imageData.type.replace(' ', '')}.jpg`;
      
      // Save image locally (optional)
      const base64Data = imageData.url.replace(/^data:image\/jpeg;base64,/, "");
      fs.writeFileSync(path.join(IMAGE_DIR, filename), base64Data, 'base64');
      
      // Add to memory
      const savedImage = {
        ...imageData,
        filename,
        savedAt: new Date().toISOString()
      };
      
      capturedImages.push(savedImage);
      io.emit('image-captured', savedImage);
      
      // Send acknowledgement
      callback({ success: true, message: 'Image saved successfully' });
    } catch (error) {
      console.error('Error saving image:', error);
      callback({ success: false, message: 'Failed to save image' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
  console.log(`Connect your phone to: http:192.168.1.5:${PORT}`);
});