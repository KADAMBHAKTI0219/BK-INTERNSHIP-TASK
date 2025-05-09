"use client";

import React, { useEffect, useRef, useState } from "react";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

export default function WebcamCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);

  // Initialize webcam and MediaPipe Hands
  useEffect(() => {
    let camera;

    async function setupWebcamAndHands() {
      try {
        const videoElement = videoRef.current;

        // Initialize MediaPipe Hands
        const hands = new Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${"0.4.1675463741"}/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1, // Detect only one hand
          modelComplexity: 1, // Higher complexity for better accuracy
          minDetectionConfidence: 0.7, // Confidence threshold
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => {
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            // Hand detected
            const landmarks = results.multiHandLandmarks[0];
            const handedness = results.multiHandedness[0].label; // "Left" or "Right"

            // Calculate bounding box from landmarks
            const xValues = landmarks.map((lm) => lm.x * videoElement.videoWidth);
            const yValues = landmarks.map((lm) => lm.y * videoElement.videoHeight);
            const xmin = Math.min(...xValues);
            const xmax = Math.max(...xValues);
            const ymin = Math.min(...yValues);
            const ymax = Math.max(...yValues);
            const width = xmax - xmin;
            const height = ymax - ymin;

            // Validate bounding box size for palmistry
            const boxArea = width * height;
            const videoArea = videoElement.videoWidth * videoElement.videoHeight;
            if (boxArea / videoArea > 0.3 && boxArea / videoArea < 0.7) {
              captureImage();
            }

            // Optional: Draw landmarks for debugging (remove in production)
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            for (const lm of landmarks) {
              const x = lm.x * canvas.width;
              const y = lm.y * canvas.height;
              ctx.beginPath();
              ctx.arc(x, y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = "red";
              ctx.fill();
            }

            for (const connection of HAND_CONNECTIONS) {
              const [start, end] = connection;
              const startX = landmarks[start].x * canvas.width;
              const startY = landmarks[start].y * canvas.height;
              const endX = landmarks[end].x * canvas.width;
              const endY = landmarks[end].y * canvas.height;
              ctx.beginPath();
              ctx.moveTo(startX, startY);
              ctx.lineTo(endX, endY);
              ctx.strokeStyle = "green";
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
        });

        // Initialize webcam with MediaPipe Camera
        try {
          camera = new Camera(videoElement, {
            onFrame: async () => {
              await hands.send({ image: videoElement });
            },
            width: 640,
            height: 480,
          });
          await camera.start();
        } catch (err) {
          setError("Failed to access webcam. Please ensure camera permissions are granted.");
          console.error("Webcam error:", err);
        }
      } catch (err) {
        setError(`Failed to initialize detection: ${err.message}`);
        console.error("Initialization error:", err);
      }
    }

    setupWebcamAndHands();

    return () => {
      if (camera) camera.stop();
    };
  }, []);

  // Capture image from video feed
  const captureImage = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Enhance image for palmistry (increase contrast)
        ctx.filter = "contrast(1.2) brightness(1.1)";
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImage(imageData);
      }
    }
  };

  return (
    <div className="flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Palmistry Hand Detection</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <video ref={videoRef} className="mb-4 rounded-lg shadow-lg" />
      <canvas ref={canvasRef} className="mb-4 rounded-lg shadow-lg" />
      {capturedImage && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Captured Hand Image:</h2>
          <img
            src={capturedImage}
            alt="Captured hand"
            className="max-w-full rounded-lg shadow-md"
          />
        </div>
      )}
    </div>
  );
}