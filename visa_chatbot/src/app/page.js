'use client'
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";


export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (auth.currentUser) {
      router.push("/chat");
    } else {
      router.push("/login");
    }
  }, []);

  return null;
}