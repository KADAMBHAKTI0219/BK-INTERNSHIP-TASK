'use client';

import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function PalmDetector() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isPalmDetected, setIsPalmDetected] = useState(false);
  const handLandmarkerRef = useRef(null);

  // Initialize MediaPipe Hand Landmarker
  useEffect(() => {
    async function initializeHandLandmarker() {
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
      detectPalm();
    }
    initializeHandLandmarker();
  }, []);

  // Detect palm and draw landmarks
  const detectPalm = async () => {
    if (
      webcamRef.current &&
      webcamRef.current.video.readyState === 4 &&
      handLandmarkerRef.current
    ) {
      const video = webcamRef.current.video;
      const results = await handLandmarkerRef.current.detectForVideo(video, Date.now());

      // Check if palm is detected
      if (results.landmarks.length > 0 && !isPalmDetected) {
        setIsPalmDetected(true);
        captureImage();
      } else if (results.landmarks.length === 0) {
        setIsPalmDetected(false);
      }

      // Draw landmarks on canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (results.landmarks) {
        for (const landmarks of results.landmarks) {
          for (const landmark of landmarks) {
            ctx.beginPath();
            ctx.arc(
              landmark.x * canvas.width,
              landmark.y * canvas.height,
              5,
              0,
              2 * Math.PI
            );
            ctx.fillStyle = 'red';
            ctx.fill();
          }
        }
      }

      requestAnimationFrame(detectPalm);
    } else {
      requestAnimationFrame(detectPalm);
    }
  };

  // Capture image and upload to Cloudinary
  const captureImage = async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);

      // Upload to Cloudinary
      const formData = new FormData();
      const blob = await fetch(imageSrc).then((res) => res.blob());
      formData.append('file', blob, 'palm.jpg');
      formData.append('upload_preset', 'palm_detector');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );
      const data = await response.json();
      setCapturedImage(data.secure_url);
    }
  };

  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">Palm Image Detector</h1>
      <div className="relative">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          width={640}
          height={480}
          className="rounded-lg"
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute top-0 left-0"
        />
      </div>
      {isPalmDetected && (
        <p className="text-green-500 mt-2">Palm Detected!</p>
      )}
      {capturedImage && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold">Captured Image:</h2>
          <img
            src={capturedImage}
            alt="Captured Palm"
            className="mt-2 rounded-lg max-w-full h-auto"
          />
        </div>
      )}
    </div>
  );
}