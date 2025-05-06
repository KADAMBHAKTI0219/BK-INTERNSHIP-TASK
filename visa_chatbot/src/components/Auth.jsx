'use client'
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { auth } from "@/lib/firebase";

export default function Auth({ mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (auth.currentUser) {
      router.push("/chat");
    }
  }, []);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/chat");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/chat");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-10">
      <CardHeader>
        <CardTitle>{mode === "signup" ? "Sign Up" : "Log In"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-500">{error}</p>}
          <Button type="submit" className="w-full">
            {mode === "signup" ? "Sign Up" : "Log In"}
          </Button>
        </form>
        <Button variant="outline" onClick={handleGoogleSignIn} className="w-full mt-4">
          Sign in with Google
        </Button>
      </CardContent>
    </Card>
  );
}