import WebcamCapture from "@/components/WebCamCapture";
import Image from "next/image";

export default function Home() {
  return (
     <main className="min-h-screen bg-gray-100">
      <WebcamCapture />
    </main>
  );
}
