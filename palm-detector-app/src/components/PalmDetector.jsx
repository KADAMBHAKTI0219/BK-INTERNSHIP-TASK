'use client';

import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function PalmDetector() {
 const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [capturedImages, setCapturedImages] = useState([]);
  const [detectedGesture, setDetectedGesture] = useState(null);
  const [isCapturing, setIsCapturing] = useState(true);
  const [lastCaptureTime, setLastCaptureTime] = useState(0);
  const [timer, setTimer] = useState(5);
  const [isMobile, setIsMobile] = useState(false);
  const handLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [requiredGestures, setRequiredGestures] = useState([
    { name: 'Left Palm', captured: false },
    { name: 'Right Palm', captured: false },
    { name: 'Back Thumb', captured: false }
  ]);

  // Detect mobile device
  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(isMobileDevice);
  }, []);

  // Initialize MediaPipe Hand Landmarker
  useEffect(() => {
    async function initializeHandLandmarker() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        if (isCapturing) {
          detectPalm();
        }
      } catch (error) {
        console.error('Error initializing HandLandmarker:', error);
      }
    }
    initializeHandLandmarker();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);


  // Update timer every second
  useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const timeSinceLastCapture = (currentTime - lastCaptureTime) / 1000;
      const timeRemaining = Math.max(0, 5 - timeSinceLastCapture);
      setTimer(Math.ceil(timeRemaining));

      if (timeRemaining <= 0 && detectedGesture) {
        const gestureToCapture = requiredGestures.find(g => !g.captured);
        if (gestureToCapture && 
            ((gestureToCapture.name === 'Left Palm' && detectedGesture === 'Left Palm') ||
             (gestureToCapture.name === 'Right Palm' && detectedGesture === 'Right Palm') ||
             (gestureToCapture.name === 'Back Thumb' && detectedGesture === 'Back Thumb'))) {
          captureImage(gestureToCapture.name);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastCaptureTime, detectedGesture, isCapturing, requiredGestures]);

  // Check image clarity using variance of Laplacian
  const isImageClear = (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let sum = 0;
        let sumSq = 0;
        let pixelCount = 0;

        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const idx = (y * canvas.width + x) * 4;
            const gray =
              0.299 * data[idx] +
              0.587 * data[idx + 1] +
              0.114 * data[idx + 2];
            const laplacian =
              -4 * gray +
              (data[((y - 1) * canvas.width + x) * 4] * 0.299 +
                data[((y - 1) * canvas.width + x) * 4 + 1] * 0.587 +
                data[((y - 1) * canvas.width + x) * 4 + 2] * 0.114) +
              (data[((y + 1) * canvas.width + x) * 4] * 0.299 +
                data[((y + 1) * canvas.width + x) * 4 + 1] * 0.587 +
                data[((y + 1) * canvas.width + x) * 4 + 2] * 0.114) +
              (data[(y * canvas.width + (x - 1)) * 4] * 0.299 +
                data[(y * canvas.width + (x - 1)) * 4 + 1] * 0.587 +
                data[(y * canvas.width + (x - 1)) * 4 + 2] * 0.114) +
              (data[(y * canvas.width + (x + 1)) * 4] * 0.299 +
                data[(y * canvas.width + (x + 1)) * 4 + 1] * 0.587 +
                data[(y * canvas.width + (x + 1)) * 4 + 2] * 0.114);
            sum += laplacian;
            sumSq += laplacian * laplacian;
            pixelCount++;
          }
        }

        const mean = sum / pixelCount;
        const variance = sumSq / pixelCount - mean * mean;
        resolve(variance > 20); // Clarity threshold
      };
      img.onerror = () => resolve(false);
    });
  };

  // Detect gestures (front palm and back thumb)
  const detectPalm = async () => {
    if (!isCapturing || requiredGestures.every(g => g.captured)) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setIsCapturing(false);
      return;
    }

    if (webcamRef.current?.video?.readyState === 4 && handLandmarkerRef.current) {
      try {
        const video = webcamRef.current.video;
        const results = await handLandmarkerRef.current.detectForVideo(video, Date.now());

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let currentGesture = null;

        if (results.landmarks.length > 0) {
          for (let i = 0; i < results.landmarks.length; i++) {
            const landmarks = results.landmarks[i];
            const handedness = results.handedness[i][0].displayName; // 'Left' or 'Right'
            
            // Palm detection (front facing)
            const wrist = landmarks[0];
            const middleFingerMCP = landmarks[9]; // Middle finger MCP (metacarpophalangeal joint)
            const isPalmFacing = wrist.z < middleFingerMCP.z;
            
            // Thumb back detection
            const thumbTip = landmarks[4];
            const thumbIP = landmarks[2]; // Thumb interphalangeal joint
            const isThumbBack = thumbTip.z < thumbIP.z;

            // Determine gesture
            if (isPalmFacing) {
              currentGesture = `${handedness} Palm`;
            } else if (isThumbBack) {
              currentGesture = 'Back Thumb';
            }

            // Draw landmarks
            for (const landmark of landmarks) {
              ctx.beginPath();
              ctx.arc(
                landmark.x * canvas.width,
                landmark.y * canvas.height,
                5,
                0,
                2 * Math.PI
              );
              ctx.fillStyle = handedness === 'Left' ? 'blue' : 'red';
              ctx.fill();
            }
          }
        }

        setDetectedGesture(currentGesture);
      } catch (error) {
        console.error('Error detecting hand:', error);
      }
    }
    animationFrameRef.current = requestAnimationFrame(detectPalm);
  };

  // Capture image and upload
  const captureImage = async (gestureType) => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      const isClear = await isImageClear(imageSrc);
      if (!isClear) {
        console.log('Image is blurry, not capturing');
        return;
      }

      try {
        console.log(`Captured ${gestureType} image`);
        setCapturedImages(prev => [...prev, { 
          type: gestureType, 
          url: imageSrc,
          timestamp: new Date().toLocaleTimeString()
        }]);
        
        setRequiredGestures(prev => 
          prev.map(g => g.name === gestureType ? {...g, captured: true} : g)
        );
        setLastCaptureTime(Date.now());
        setTimer(5);
        
        if (requiredGestures.filter(g => !g.captured).length === 0) {
          setIsCapturing(false);
        }
      } catch (error) {
        console.error('Error capturing image:', error);
      }
    }
  };

  return (
    <div className="flex flex-col items-center p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Palmistry Capture</h1>
      
      <div className="relative mb-8">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          width={640}
          height={480}
          className="rounded-lg shadow-lg"
          videoConstraints={{
            facingMode: isMobile ? { exact: 'environment' } : 'user',
            width: 640,
            height: 480,
            frameRate: { ideal: 30 }
          }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute top-0 left-0"
        />
      </div>
      
      {detectedGesture && (
        <p className="text-green-600 font-semibold mb-4">
          {detectedGesture} Detected!
        </p>
      )}
      
      {isCapturing && (
        <div className="text-center mb-4">
          <p className="text-lg font-semibold text-gray-700">
            Next capture in: {timer} seconds
          </p>
          <div className="mt-4">
            <p className="text-md font-medium text-gray-600">
              Required captures:
            </p>
            <ul className="list-disc list-inside">
              {requiredGestures.map((gesture, index) => (
                <li 
                  key={index} 
                  className={gesture.captured ? 'text-green-600 line-through' : 'text-gray-800'}
                >
                  {gesture.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {!isCapturing && requiredGestures.every(g => g.captured) && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          All required captures completed!
        </div>
      )}
      
      {capturedImages.length > 0 && (
        <div className="w-full max-w-2xl">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Captured Images</h2>
          <div className="grid grid-cols-1 gap-4">
            {capturedImages.map((image, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow">
                <p className="font-medium text-gray-800 mb-2">
                  {image.type} - {image.timestamp}
                </p>
                <img
                  src={image.url}
                  alt={image.type}
                  className="rounded-lg w-full h-auto border border-gray-200"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}