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
    { name: 'Right Thumb', captured: false },
  ]);
  const [facingMode, setFacingMode] = useState('user');
  const [prediction, setPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Resize image to prevent oversized blobs
  const resizeImage = (dataURL, maxSize = 800) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = dataURL;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = (maxSize / width) * height;
          width = maxSize;
        } else if (height > maxSize) {
          width = (maxSize / height) * width;
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
    });
  };

  // Convert data URL to blob with proper error handling
  const dataURLtoBlob = (dataURL) => {
    try {
      console.log('Data URL (first 50 chars):', dataURL.substring(0, 50));
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      const u8arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      const blob = new Blob([u8arr], { type: 'image/jpeg' });
      console.log('Blob size:', blob.size, 'Type:', blob.type);
      return blob;
    } catch (error) {
      console.error('Error converting data URL to blob:', error);
      throw new Error('Failed to process image');
    }
  };

  // Enhanced image capture with proper blob creation
  const captureImage = async (gestureType) => {
    if (!webcamRef.current || webcamRef.current.video.readyState !== 4) {
      setApiError('Webcam not ready');
      return;
    }

    try {
      const imageSrc = webcamRef.current.getScreenshot({
        width: 1280,
        height: 720,
        screenshotQuality: 1.0,
      });

      if (!imageSrc || imageSrc.length < 100) {
        throw new Error('Empty or invalid screenshot captured');
      }

      // Resize image to ensure manageable size
      const resizedImageSrc = await resizeImage(imageSrc);
      const blob = await dataURLtoBlob(resizedImageSrc);

      if (blob.size < 500) {
        throw new Error('Image data is too small');
      }

      setCapturedImages((prev) => [
        ...prev,
        {
          type: gestureType,
          url: resizedImageSrc,
          blob,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      setRequiredGestures((prev) =>
        prev.map((g) => (g.name === gestureType ? { ...g, captured: true } : g))
      );

      setLastCaptureTime(Date.now());
      setTimer(5);
      setApiError(null);
    } catch (error) {
      setApiError(error.message);
      console.error('Capture error:', error);
    }
  };

  // Detect mobile device
  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setIsMobile(isMobileDevice);
    if (isMobileDevice) {
      setFacingMode('environment');
    }
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Initialize Hand Landmarker
  useEffect(() => {
    let isMounted = true;

    async function initializeHandLandmarker() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
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
        setApiError('Failed to initialize hand detection');
      }
    }

    initializeHandLandmarker();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Check if all gestures are captured
  useEffect(() => {
    const allCaptured = requiredGestures.every((g) => g.captured);
    if (allCaptured && isCapturing) {
      setIsCapturing(false);
    }
  }, [requiredGestures, isCapturing]);

  // Palm detection logic
  const detectPalm = async () => {
    if (!isCapturing || requiredGestures.every((g) => g.captured)) {
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

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let currentGesture = null;

      if (results.landmarks.length > 0) {
        for (let i = 0; i < results.landmarks.length; i++) {
          const landmarks = results.landmarks[i];
          const handedness = results.handedness[i][0].displayName; // Raw handedness (Left or Right)
          // Adjust handedness for gesture labeling based on facingMode
          const displayHandedness =
            facingMode === 'environment' ? handedness : handedness === 'Left' ? 'Right' : 'Left';

          const wrist = landmarks[0];
          const middleFingerMCP = landmarks[9];
          const isPalmFacing = wrist.z < middleFingerMCP.z;

          const thumbTip = landmarks[4];
          const thumbIP = landmarks[2];
          const isThumbBack = thumbTip.z < thumbIP.z;

          if (isPalmFacing) {
            currentGesture = `${displayHandedness} Palm`;
          } else if (isThumbBack) {
            currentGesture = `${displayHandedness} Thumb`;
          }

          // Draw hand landmarks using raw handedness for dot colors
          const keyPoints = [0, 4, 8, 12, 16, 20];
          for (const index of keyPoints) {
            const landmark = landmarks[index];
            ctx.beginPath();
            ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 5, 0, 2 * Math.PI);
            ctx.fillStyle = handedness === 'Left' ? 'blue' : 'red'; // Use raw handedness for dot color
            ctx.fill();
          }
        }
      }

      setDetectedGesture(currentGesture);
    } catch (error) {
      console.error('Detection error:', error);
      setApiError('Hand detection failed');
    }
  };

  // Timer effect
  useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(() => {
      const timeRemaining = Math.max(0, 5 - (Date.now() - lastCaptureTime) / 1000);
      setTimer(Math.ceil(timeRemaining));

      if (timeRemaining <= 0 && detectedGesture) {
        const nextGesture = requiredGestures.find((g) => !g.captured);
        if (nextGesture && detectedGesture.includes(nextGesture.name.split(' ')[0])) {
          captureImage(nextGesture.name);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastCaptureTime, detectedGesture, isCapturing, requiredGestures]);

  // Reset capture process
  const resetCapture = () => {
    setCapturedImages([]);
    setRequiredGestures([
      { name: 'Left Palm', captured: false },
      { name: 'Right Palm', captured: false },
      { name: 'Left Thumb', captured: false },
      { name: 'Right Thumb', captured: false },
    ]);
    setIsCapturing(true);
    setLastCaptureTime(0);
    setTimer(5);
    setPrediction(null);
    setShowPrediction(false);
    setApiError(null);
  };

  // Analyze palmistry with proper FormData handling
  const analyzePalmistry = async () => {
    setIsLoading(true);
    setApiError(null);

    try {
      if (capturedImages.length !== 4) {
        throw new Error('Please capture all four required images');
      }

      const formData = new FormData();
      capturedImages.forEach((image) => {
        if (!image.blob) {
          throw new Error(`Missing image data for ${image.type}`);
        }
        const key = image.type.replace(' ', '_').toLowerCase();
        console.log('Appending to FormData:', key, 'Size:', image.blob.size);
        formData.append(key, image.blob, `${key}.jpg`);
      });

      const response = await fetch('/api/palmistry', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      const result = await response.json();
      if (!result.data) {
        throw new Error('Invalid response format from server');
      }

      setPrediction({
        overall: result.data.overallReading || 'No overall reading available',
        leftpalm: result.data.leftPalm || 'Left palm analysis not available',
        rightpalm: result.data.rightPalm || 'Right palm analysis not available',
        leftthumb: result.data.leftThumb || 'Left thumb analysis not available',
        rightthumb: result.data.rightThumb || 'Right thumb analysis not available',
      });

      setShowPrediction(true);
    } catch (error) {
      console.error('Analysis error:', error);
      setApiError(error.message || 'Failed to analyze. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle camera with delay
  const toggleCamera = () => {
    setFacingMode((prev) => {
      const newMode = prev === 'user' ? 'environment' : 'user';
      setTimeout(() => {
        if (webcamRef.current) {
          console.log('Camera switched to:', newMode);
        }
      }, 500);
      return newMode;
    });
  };

  // Show prediction handler
  const handleShowPrediction = () => {
    if (!prediction) {
      analyzePalmistry();
    } else {
      setShowPrediction(true);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-gray-800 text-center">
        Palmistry Capture
      </h1>

      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Camera Section */}
        <div className="flex-1">
          {isCapturing ? (
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-xl">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={1.0}
                className="absolute top-0 left-0 w-full h-full object-cover"
                videoConstraints={{
                  facingMode,
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  frameRate: { ideal: 30 },
                }}
                mirrored={facingMode === 'user'}
              />
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
            </div>
          ) : (
            <div className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden shadow-xl flex items-center justify-center">
              <p className="text-xl font-medium text-gray-600">Capture Complete</p>
            </div>
          )}

          {isCapturing && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mt-4">
              <p className="text-sm">
                Ensure bright, even lighting and hold your hand steady for clear images.
              </p>
            </div>
          )}

          {isMobile && isCapturing && (
            <button
              onClick={toggleCamera}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Switch to {facingMode === 'user' ? 'Back' : 'Front'} Camera
            </button>
          )}
        </div>

        {/* Controls Section */}
        <div className="flex-1 max-w-md lg:max-w-none">
          {isCapturing ? (
            <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
              {detectedGesture && (
                <p className="text-lg font-semibold text-center mb-4 text-green-600">
                  {detectedGesture} Detected!
                </p>
              )}

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
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                <p className="font-bold">All required captures completed!</p>
                <p className="text-sm mt-1">Click below to view your palmistry reading.</p>
              </div>

              <button
                onClick={resetCapture}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                Reset Capture
              </button>

              {!showPrediction && (
                <button
                  onClick={handleShowPrediction}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                  disabled={isLoading}
                >
                  {isLoading ? 'Analyzing...' : 'View Palmistry Reading'}
                </button>
              )}

              {isLoading && (
                <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-md">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-gray-600">Analyzing your palmistry...</p>
                </div>
              )}

              {apiError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  <p>{apiError}</p>
                  <button
                    onClick={analyzePalmistry}
                    className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {showPrediction && prediction && (
                <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Your Palmistry Reading</h2>
                    <button
                      onClick={() => setShowPrediction(false)}
                      className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-sm"
                    >
                      Hide Reading
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-blue-800 mb-2">Overall Reading</h3>
                      <p className="text-gray-700 whitespace-pre-line">{prediction.overall}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h3 className="font-medium text-green-800 mb-2">Left Palm</h3>
                        <p className="text-gray-700 whitespace-pre-line">{prediction.leftpalm}</p>
                      </div>

                      <div className="p-4 bg-green-50 rounded-lg">
                        <h3 className="font-medium text-green-800 mb-2">Right Palm</h3>
                        <p className="text-gray-700 whitespace-pre-line">{prediction.rightpalm}</p>
                      </div>

                      <div className="p-4 bg-purple-50 rounded-lg">
                        <h3 className="font-medium text-purple-800 mb-2">Left Thumb</h3>
                        <p className="text-gray-700 whitespace-pre-line">{prediction.leftthumb}</p>
                      </div>

                      <div className="p-4 bg-purple-50 rounded-lg">
                        <h3 className="font-medium text-purple-800 mb-2">Right Thumb</h3>
                        <p className="text-gray-700 whitespace-pre-line">{prediction.rightthumb}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-2">
                      <p className="text-xs truncate">{image.type}</p>
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