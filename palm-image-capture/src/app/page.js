"use client";
import { useEffect, useRef, useMemo, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [capturedImages, setCapturedImages] = useState([]);
  const [captureStep, setCaptureStep] = useState(0);
  const [instruction, setInstruction] = useState('Click Start to begin capture');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPalmDetected, setIsPalmDetected] = useState(false);
  const palmDetectionModelRef = useRef(null);

  const captureSteps = useMemo(() => [
    { label: 'Right Palm', instruction: 'Show your right palm to the camera' },
    { label: 'Left Palm', instruction: 'Show your left palm to the camera' },
    { label: 'Thumbs Back', instruction: 'Show back of both thumbs to the camera' }
  ], []);

  // Load palm detection model
  useEffect(() => {
    async function loadModel() {
      try {
        // In a real implementation, you would load a palm detection model here
        // For example, using TensorFlow.js or MediaPipe HandPose
        // This is just a placeholder to simulate model loading
        await new Promise(resolve => setTimeout(resolve, 1000));
        palmDetectionModelRef.current = { ready: true };
        setInstruction('Palm detection ready. Show your palm to the camera.');
      } catch (err) {
        console.error('Failed to load palm detection model:', err);
        setInstruction('Palm detection unavailable. Using basic capture only.');
      }
    }
    
    loadModel();
    
    return () => {
      // Clean up model if needed
      palmDetectionModelRef.current = null;
    };
  }, []);

  // Initialize webcam
  const setupWebcam = async () => {
    try {
      let stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise(resolve => {
          videoRef.current.onloadedmetadata = resolve;
        });
      }
    } catch (err) {
      console.error('Camera error:', err);
      setInstruction('Unable to access camera. Please enable permissions or check device compatibility.');
    }
  };

  // Palm detection function
  const detectPalm = async (videoElement) => {
    if (!palmDetectionModelRef.current?.ready) return false;
    
    // In a real implementation, you would:
    // 1. Get video frame
    // 2. Process with palm detection model
    // 3. Analyze results for palm presence
    
    // For this example, we'll simulate detection with these checks:
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Get image data for analysis
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Simple heuristic to detect skin-like colors (very basic, not production-ready)
    let skinPixelCount = 0;
    let totalPixels = 0;
    
    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += 40) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Basic skin color detection (adjust these ranges as needed)
      if (r > 150 && g > 80 && b > 60 && 
          Math.abs(r - g) > 15 && r > g && r > b) {
        skinPixelCount++;
      }
      totalPixels++;
    }
    
    const skinRatio = skinPixelCount / (totalPixels || 1);
    
    // Additional checks could include:
    // - Shape analysis (palm is roughly circular/oval)
    // - Size relative to frame
    // - Position in frame
    
    return skinRatio > 0.3; // If more than 30% of pixels are skin-like
  };

  // Passive palm detection
  useEffect(() => {
    if (!isCapturing && videoRef.current) {
      let isProcessing = false;
      
      const interval = setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;
        
        try {
          const hasPalm = await detectPalm(videoRef.current);
          
          if (hasPalm) {
            setIsPalmDetected(true);
            setInstruction('Palm detected! Ready to capture.');
            capturePassiveImage();
          } else {
            setIsPalmDetected(false);
            setInstruction('Show your palm to the camera');
          }
        } catch (err) {
          console.error('Palm detection error:', err);
        } finally {
          isProcessing = false;
        }
      }, 1000); // Check for palm every second

      return () => clearInterval(interval);
    }
  }, [isCapturing]);

  const capturePassiveImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const newImage = {
      url: canvas.toDataURL('image/jpeg', 0.8),
      label: 'Detected Palm',
      timestamp: new Date().toISOString()
    };

    setCapturedImages(prev => [newImage, ...prev].slice(0, 5)); // Keep last 5 detections
  };

  // Active capture sequence (original functionality)
  useEffect(() => {
    let timeoutId;
    let animationFrameId;

    if (isCapturing && captureStep > 0 && captureStep <= 3) {
      let countdown = 5;
      setInstruction(`Preparing to capture ${captureSteps[captureStep - 1].label} in ${Math.ceil(countdown)}s...`);

      const updateCountdown = () => {
        countdown -= 1 / 60;
        if (countdown <= 0) {
          setInstruction(`Capturing ${captureSteps[captureStep - 1].label}...`);
          captureActiveImage();
          return;
        }
        setInstruction(`Preparing to capture ${captureSteps[captureStep - 1].label} in ${Math.ceil(countdown)}s...`);
        animationFrameId = requestAnimationFrame(updateCountdown);
      };

      animationFrameId = requestAnimationFrame(updateCountdown);
      timeoutId = setTimeout(() => {
        captureActiveImage();
      }, 5000);
    }

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(animationFrameId);
    };
  }, [captureStep, isCapturing]);

  const captureActiveImage = () => {
    if (!videoRef.current || !canvasRef.current || captureStep > 3) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const newImage = {
      url: canvas.toDataURL('image/jpeg', 0.8),
      label: captureSteps[captureStep - 1]?.label || '',
      timestamp: new Date().toISOString()
    };

    setCapturedImages(prev => {
      const updated = [...prev];
      updated[captureStep - 1] = newImage;
      return updated.slice(0, 3);
    });

    if (captureStep < 3) {
      setCaptureStep(captureStep + 1);
    } else {
      setInstruction('All 3 images captured successfully!');
      setIsCapturing(false);
    }
  };

  const startCaptureProcess = async () => {
    setCapturedImages([]);
    await setupWebcam();
    setCaptureStep(1);
    setIsCapturing(true);
  };

  const stopCaptureProcess = () => {
    setIsCapturing(false);
    setInstruction('Capture stopped');
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 w-full max-w-4xl mx-auto">
      <Head>
        <title>Hand Image Capture</title>
        <meta name="description" content="Capture hand images for authentication" />
      </Head>

      <h1 className="text-3xl font-bold mb-6">Palm Image Capture</h1>

      <div className="mb-4 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded-lg shadow-lg w-full max-w-lg aspect-[4/3] border-2 border-blue-500"
        />
        <canvas ref={canvasRef} className="hidden" />
        {isCapturing && captureStep > 0 && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded">
            {captureSteps[captureStep - 1].label}
          </div>
        )}
        {!isCapturing && isPalmDetected && (
          <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded">
            Palm Detected
          </div>
        )}
      </div>

      <div className="mb-6 min-h-16 flex items-center justify-center">
        <p className="text-lg font-semibold text-center">{instruction}</p>
      </div>

      <div className="flex gap-4 mb-8">
        {!isCapturing ? (
          <button
            onClick={startCaptureProcess}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded"
          >
            Start Active Capture
          </button>
        ) : (
          <button
            onClick={stopCaptureProcess}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-3 px-6 rounded"
          >
            Stop Capture
          </button>
        )}
      </div>

      <div className="w-full">
        <h2 className="text-xl font-semibold mb-4">
          {isCapturing ? 'Active Capture Progress' : 'Palm Detections'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isCapturing ? (
            Array(3).fill(null).map((_, index) => (
              <div key={index} className="bg-white p-2 rounded-lg shadow border-2 border-gray-200 min-h-48 flex flex-col items-center justify-center">
                {capturedImages[index] ? (
                  <>
                    <Image src={capturedImages[index].url} alt={`Captured ${capturedImages[index].label}`} className="object-contain max-h-36" />
                    <p className="text-center text-sm mt-2">{capturedImages[index].label}</p>
                  </>
                ) : (
                  <p className="text-gray-400">Not captured yet</p>
                )}
              </div>
            ))
          ) : (
            capturedImages.slice(0, 3).map((image, index) => (
              <div key={index} className="bg-white p-2 rounded-lg shadow border-2 border-gray-200 min-h-48 flex flex-col items-center justify-center">
                <Image src={image.url} alt={`Detected ${image.label}`} className="object-contain max-h-36" />
                <p className="text-center text-sm mt-2">{image.label}</p>
                <p className="text-xs text-gray-500">{new Date(image.timestamp).toLocaleTimeString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
