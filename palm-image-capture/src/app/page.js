"use client";
import { useEffect, useRef, useMemo, useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [capturedImages, setCapturedImages] = useState([]);
  const [captureStep, setCaptureStep] = useState(0); // 0: not started, 1: right palm, 2: left palm, 3: thumbs back
  const [instruction, setInstruction] = useState('Click Start to begin capture');
  const [isCapturing, setIsCapturing] = useState(false);

  const captureSteps = useMemo(() => [
    { label: 'Right Palm', instruction: 'Show your right palm to the camera' },
    { label: 'Left Palm', instruction: 'Show your left palm to the camera' },
    { label: 'Thumbs Back', instruction: 'Show back of both thumbs to the camera' }
  ], []);

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
        // Fallback to any camera
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

  // Handle page visibility to prevent capture interruptions
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isCapturing) {
        setInstruction('Please keep this tab active to continue capturing.');
        setIsCapturing(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isCapturing]);

  // Handle automatic capture sequence
  useEffect(() => {
    let timeoutId;
    let animationFrameId;

    if (isCapturing && captureStep > 0 && captureStep <= 3) {
      let countdown = 5;
      setInstruction(`Preparing to capture ${captureSteps[captureStep - 1].label} in ${Math.ceil(countdown)}s...`);

      const updateCountdown = () => {
        countdown -= 1 / 60; // Assuming 60 FPS
        if (countdown <= 0) {
          setInstruction(`Capturing ${captureSteps[captureStep - 1].label}...`);
          captureImage();
          return;
        }
        setInstruction(
          `Preparing to capture ${captureSteps[captureStep - 1].label} in ${Math.ceil(countdown)}s...`
        );
        animationFrameId = requestAnimationFrame(updateCountdown);
      };

      animationFrameId = requestAnimationFrame(updateCountdown);
      timeoutId = setTimeout(() => {
        captureImage();
      }, 5000);
    }

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(animationFrameId);
    };
  }, [captureStep, isCapturing]);

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current || captureStep > 3) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const maxWidth = 640;
    const maxHeight = 480;
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    const aspectRatio = videoWidth / videoHeight;

    // Set canvas size with capped dimensions
    if (videoWidth > maxWidth || videoHeight > maxHeight) {
      canvas.width = maxWidth;
      canvas.height = maxWidth / aspectRatio;
    } else {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const newImage = {
      url: canvas.toDataURL('image/jpeg', 0.8),
      label: captureSteps[captureStep - 1]?.label || ''
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
    if (capturedImages.length >= 3) {
      setCapturedImages([]);
    }
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
        <style>{`
          video {
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
          }
        `}</style>
      </Head>

      <h1 className="text-3xl font-bold mb-6">Hand Image Capture</h1>

      <div className="mb-4 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded-lg shadow-lg w-full max-w-lg aspect-[4/3]"
        />
        <canvas ref={canvasRef} className="hidden" />
        {isCapturing && captureStep > 0 && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded">
            {captureSteps[captureStep - 1].label}
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
            disabled={capturedImages.length >= 3 && !isCapturing}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded disabled:opacity-50"
          >
            {capturedImages.length >= 3 ? 'Restart Capture' : 'Start Capture'}
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

      {capturedImages.length > 0 && (
        <div className="w-full">
          <h2 className="text-xl font-semibold mb-4">Captured Images ({capturedImages.length}/3)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array(3).fill(null).map((_, index) => (
              <div key={index} className="bg-white p-2 rounded-lg shadow border-2 border-gray-200 min-h-48 flex flex-col items-center justify-center">
                {capturedImages[index] ? (
                  <>
                    <img src={capturedImages[index].url} alt={`Captured ${capturedImages[index].label}`} className="object-contain" />
                    <p className="text-center text-sm mt-2">{capturedImages[index].label}</p>
                  </>
                ) : (
                  <p className="text-gray-400">Not captured yet</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

