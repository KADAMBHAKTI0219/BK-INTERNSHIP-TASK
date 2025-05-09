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
  const [usingFrontCamera, setUsingFrontCamera] = useState(false);
  const handLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [requiredGestures, setRequiredGestures] = useState([
    { name: 'Left Palm', captured: false },
    { name: 'Right Palm', captured: false },
    { name: 'Left Thumb', captured: false },
    { name: 'Right Thumb', captured: false }
  ]);

  // Detect mobile device
  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(isMobileDevice);
    setUsingFrontCamera(!isMobileDevice); // Default to front camera on desktop, back on mobile
  }, []);

  // Initialize MediaPipe Hand Landmarker
  useEffect(() => {
    let isMounted = true;
    
    async function initializeHandLandmarker() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        
        if (isMounted) {
          handLandmarkerRef.current = landmarker;
          detectPalm();
        }
      } catch (error) {
        console.error('Error initializing HandLandmarker:', error);
      }
    }
    
    initializeHandLandmarker();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Fast palm detection
  const detectPalm = async () => {
    if (!isCapturing || requiredGestures.every(g => g.captured)) {
      cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    animationFrameRef.current = requestAnimationFrame(detectPalm);

    const video = webcamRef.current?.video;
    if (!video || video.readyState !== 4 || !handLandmarkerRef.current) return;

    try {
      const results = await handLandmarkerRef.current.detectForVideo(video, Date.now());
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let currentGesture = null;

      if (results.landmarks.length > 0) {
        for (let i = 0; i < results.landmarks.length; i++) {
          const landmarks = results.landmarks[i];
          let handedness = results.handedness[i][0].displayName;
          
          // Only flip handedness if using front camera
          if (usingFrontCamera) {
            handedness = handedness === 'Left' ? 'Right' : 'Left';
          }
          
          // Palm detection (front facing)
          const wrist = landmarks[0];
          const middleFingerMCP = landmarks[9];
          const isPalmFacing = wrist.z < middleFingerMCP.z;
          
          // Thumb detection
          const thumbTip = landmarks[4];
          const thumbIP = landmarks[2];
          const isThumbBack = thumbTip.z < thumbIP.z;

          if (isPalmFacing) {
            currentGesture = `${handedness} Palm`;
          } else if (isThumbBack) {
            currentGesture = `${handedness} Thumb`;
          }

          // Draw only key landmarks for performance
          const keyPoints = [0, 4, 8, 12, 16, 20]; // Wrist and finger tips
          for (const index of keyPoints) {
            const landmark = landmarks[index];
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
      console.error('Detection error:', error);
    }
  };

  // Capture image
  const captureImage = async (gestureType) => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

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
  };

  // Toggle between front and back camera
  const toggleCamera = () => {
    setUsingFrontCamera(prev => !prev);
  };

  // Timer effect
  useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(() => {
      const timeRemaining = Math.max(0, 5 - (Date.now() - lastCaptureTime) / 1000);
      setTimer(Math.ceil(timeRemaining));

      if (timeRemaining <= 0 && detectedGesture) {
        const nextGesture = requiredGestures.find(g => !g.captured);
        if (nextGesture && detectedGesture.includes(nextGesture.name.split(' ')[0])) {
          captureImage(nextGesture.name);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastCaptureTime, detectedGesture, isCapturing, requiredGestures]);

  return (
    <div className="flex flex-col items-center p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-gray-800">Palmistry Capture</h1>
      
      <div className="relative w-full max-w-md mb-4 md:mb-8">
        <div className="aspect-w-4 aspect-h-3">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="rounded-lg shadow-lg w-full h-auto"
            videoConstraints={{
              facingMode: usingFrontCamera ? 'user' : { exact: 'environment' },
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 }
            }}
            mirrored={false} // No mirroring - we handle handedness manually
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
          />
        </div>
        {isMobile && (
          <button
            onClick={toggleCamera}
            className="absolute bottom-2 right-2 bg-white p-2 rounded-full shadow-md"
          >
            {usingFrontCamera ? 'Switch to Back' : 'Switch to Front'}
          </button>
        )}
      </div>
      
      <div className="w-full max-w-md space-y-4">
        {detectedGesture && (
          <p className="text-green-600 font-semibold text-center">
            {detectedGesture} Detected!
          </p>
        )}
        
        {isCapturing ? (
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-center font-medium mb-2">
              Next capture in: {timer} seconds
            </p>
            <div className="grid grid-cols-2 gap-2">
              {requiredGestures.map((gesture, index) => (
                <div 
                  key={index} 
                  className={`p-2 rounded text-center ${
                    gesture.captured 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {gesture.name}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-center">
            All required captures completed!
          </div>
        )}
        
        {capturedImages.length > 0 && (
          <div className="mt-4">
            <h2 className="text-xl font-semibold mb-2">Captured Images</h2>
            <div className="grid grid-cols-2 gap-2">
              {capturedImages.map((image, index) => (
                <div key={index} className="bg-white p-2 rounded shadow">
                  <img
                    src={image.url}
                    alt={image.type}
                    className="rounded w-full h-auto border border-gray-200"
                  />
                  <p className="text-xs mt-1 text-center">
                    {image.type} - {image.timestamp}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}