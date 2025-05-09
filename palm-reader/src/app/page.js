'use client';
import ImageUploader from '@/components/PalmReader';
import PredictionResult from '@/components/PredictionResult';
import { useState } from 'react';

export default function Home() {
  const [prediction, setPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (formData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Prediction failed');
      }

      const data = await response.json();
      setPrediction(data.prediction);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-800 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center">Mystic Palm Reader</h1>
        <p className="text-xl text-purple-200 mb-8 text-center">
          Upload a photo of your palm to discover your future
        </p>
        
        {!prediction ? (
          <ImageUploader onSubmit={handleSubmit} isLoading={isLoading} />
        ) : (
          <PredictionResult 
            prediction={prediction} 
            onReset={() => setPrediction(null)} 
          />
        )}
        
        {error && (
          <div className="mt-4 p-4 bg-red-900 rounded-lg">
            <p>Error: {error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-300 hover:text-white"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}