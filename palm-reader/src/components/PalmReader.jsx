'use client';
import { useState, useRef } from 'react';

export default function ImageUploader({ onSubmit, isLoading }) {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [question, setQuestion] = useState('');
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) return;
    
    const formData = new FormData();
    formData.append('image', image);
    if (question) formData.append('question', question);
    
    onSubmit(formData);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-purple-800/50 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold mb-4">Upload Your Palm Photo</h2>
      
      <div className="space-y-4">
        {preview ? (
          <div className="flex flex-col items-center">
            <div className="relative w-64 h-64 mb-4 border-2 border-purple-500 rounded-lg overflow-hidden">
              <img 
                src={preview} 
                alt="Palm preview" 
                className="w-full h-full object-contain"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setImage(null);
                setPreview(null);
              }}
              className="text-purple-300 hover:text-white text-sm"
            >
              Change Image
            </button>
          </div>
        ) : (
          <div 
            onClick={triggerFileInput}
            className="border-2 border-dashed border-purple-500 rounded-lg p-8 text-center cursor-pointer hover:bg-purple-900/30 transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
              required
            />
            <p className="text-purple-300">Click to upload palm photo</p>
            <p className="text-sm text-purple-400 mt-2">(JPEG, PNG, WEBP supported)</p>
          </div>
        )}

        <div>
          <label className="block mb-1">Your Specific Question (optional)</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you want to know about your future?"
            className="w-full p-2 rounded bg-purple-900 text-white border border-purple-700"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !image}
          className={`w-full py-3 px-4 rounded-lg font-medium ${(isLoading || !image) ? 'bg-purple-800' : 'bg-purple-600 hover:bg-purple-700'} transition-colors`}
        >
          {isLoading ? 'Reading Your Palm...' : 'Reveal My Future'}
        </button>
      </div>
    </form>
  );
}