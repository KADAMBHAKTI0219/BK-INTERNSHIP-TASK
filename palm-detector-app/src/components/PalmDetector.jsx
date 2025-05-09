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
    { name: 'Left Thumb', captured: false },
    { name: 'Right Thumb', captured: false }
  ]);
  const [facingMode, setFacingMode] = useState('user');

  // Detect mobile device and set camera mode
  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(isMobileDevice);
    
    // Use back camera by default on mobile
    if (isMobileDevice) {
      setFacingMode('environment');
    }

    const handleResize = () => {
      // Responsive logic if needed
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  // Palm detection logic
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
          const handedness = results.handedness[i][0].displayName;
          
          // For back camera, we don't need to flip the handedness
          const displayHandedness = facingMode === 'environment' ? handedness : 
                                   handedness === 'Left' ? 'Right' : 'Left';
          
          // Palm detection (front facing)
          const wrist = landmarks[0];
          const middleFingerMCP = landmarks[9];
          const isPalmFacing = wrist.z < middleFingerMCP.z;
          
          // Thumb detection
          const thumbTip = landmarks[4];
          const thumbIP = landmarks[2];
          const isThumbBack = thumbTip.z < thumbIP.z;

          if (isPalmFacing) {
            currentGesture = `${displayHandedness} Palm`;
          } else if (isThumbBack) {
            currentGesture = `${displayHandedness} Thumb`;
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
            ctx.fillStyle = displayHandedness === 'Left' ? 'blue' : 'red';
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

  // Toggle camera (front/back)
  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="flex flex-col items-center p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-gray-800 text-center">
        Palmistry Capture
      </h1>
      
      <div className="w-full max-w-4xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Camera and Canvas Section */}
        <div className="flex-1">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-xl">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="absolute top-0 left-0 w-full h-full object-cover"
              videoConstraints={{
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
              }}
              mirrored={facingMode === 'user'} // Only mirror for front camera
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
            />
          </div>

          {isMobile && (
            <button 
              onClick={toggleCamera}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Switch to {facingMode === 'user' ? 'Back' : 'Front'} Camera
            </button>
          )}
        </div>

        {/* Controls and Info Section */}
        <div className="flex-1 max-w-md lg:max-w-none">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
            {detectedGesture && (
              <p className="text-lg font-semibold text-center mb-4 text-green-600">
                {detectedGesture} Detected!
              </p>
            )}
            
            {isCapturing ? (
              <>
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-500">Next capture in</p>
                  <p className="text-3xl font-bold text-blue-600">{timer}s</p>
                </div>
                
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-3 text-center">Required Gestures</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {requiredGestures.map((gesture, index) => (
                      <div 
                        key={index} 
                        className={`p-3 rounded-lg text-center transition-all ${
                          gesture.captured 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-gray-50 text-gray-700 border border-gray-200'
                        }`}
                      >
                        <span className="block text-sm font-medium">{gesture.name}</span>
                        <span className="block text-xs mt-1">
                          {gesture.captured ? '✓ Captured' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-center">
                <p className="font-bold">All required captures completed!</p>
                <p className="text-sm mt-1">You can review your captured images below</p>
              </div>
            )}
          </div>

          {/* Captured Images Section */}
          {capturedImages.length > 0 && (
            <div className="mt-6 bg-white rounded-xl shadow-md p-4 md:p-6">
              <h2 className="text-lg font-semibold mb-4">Captured Images</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {capturedImages.map((image, index) => (
                  <div key={index} className="group relative">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={image.url}
                        alt={image.type}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs truncate">{image.type}</p>
                      <p className="text-xxs">{image.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}