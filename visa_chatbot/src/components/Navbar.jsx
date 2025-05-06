'use client'

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { auth } from "@/lib/firebase";

export default function Navbar() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <nav className="bg-blue-600 p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-white text-2xl font-bold">Visa Chatbot</h1>
        {auth.currentUser && (
          <Button variant="outline" onClick={handleSignOut} className=" border-white">
            Sign Out
          </Button>
        )}
      </div>
    </nav>
  );
}