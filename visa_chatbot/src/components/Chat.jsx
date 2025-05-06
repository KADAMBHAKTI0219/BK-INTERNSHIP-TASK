"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, getDocs } from "firebase/firestore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { useRouter } from "next/navigation";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState(null);
  const [queuedMessages, setQueuedMessages] = useState([]);
  const [predefinedQuestions, setPredefinedQuestions] = useState([]);
  const router = useRouter();
  const messagesEndRef = useRef(null);

  // Scroll to the bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Fetch predefined questions on mount
  useEffect(() => {
    const questionsRef = collection(db, "predefinedQuestions");
    const q = query(questionsRef, orderBy("index", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const questions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log(questions);
        setPredefinedQuestions(questions);
      },
      (error) => {
        console.error("Error fetching predefined questions:", error);
        setFirestoreError("Failed to load predefined questions.");
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(
      (user) => {
        if (!user) {
          router.push("/login");
          setAuthLoading(false);
        } else {
          setAuthLoading(false);
        }
      },
      (error) => {
        console.error("Auth state error:", error);
        setAuthLoading(false);
        router.push("/login");
      }
    );

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (authLoading || !auth.currentUser) return;

    const messagesRef = collection(db, "users", auth.currentUser.uid, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setFirestoreError(null);
        const fetchedMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(fetchedMessages);
        if (queuedMessages.length > 0) {
          processQueuedMessages(messagesRef);
        }
      },
      (error) => {
        console.error("Firestore snapshot error:", error);
        setFirestoreError(error.message);
        if (error.code === "permission-denied") {
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "assistant",
              content: "Permission denied. Please log in again.",
              timestamp: new Date(),
            },
          ]);
          router.push("/login");
        } else if (error.message.includes("Could not reach Cloud Firestore backend")) {
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "assistant",
              content: "Network error: Unable to connect to Firestore. Messages will sync when connectivity is restored.",
              timestamp: new Date(),
            },
          ]);
        }
      }
    );

    return () => unsubscribe();
  }, [authLoading, queuedMessages]);

  const processQueuedMessages = async (messagesRef) => {
    for (const msg of queuedMessages) {
      try {
        const userDoc = await addDoc(messagesRef, {
          role: "user",
          content: msg.content,
          timestamp: msg.timestamp,
        });
        console.log("Queued user message saved with ID:", userDoc.id);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, id: userDoc.id } : m
          )
        );

        // Check for predefined answer or reference number request
        const normalizedInput = msg.content.trim().toLowerCase();
        let botMessage;

        if (
          normalizedInput.includes("reference number") ||
          normalizedInput.includes("id number") ||
          normalizedInput.includes("user id") ||
          normalizedInput.includes("my id")
        ) {
          botMessage = {
            id: `bot-${Date.now()}`,
            role: "assistant",
            content: `Your reference number (User ID) is: ${auth.currentUser.uid}`,
            timestamp: new Date(),
          };
        } else {
          const matchedQuestion = predefinedQuestions.find(
            (q) => q.question.trim().toLowerCase() === normalizedInput
          );

          if (matchedQuestion) {
            botMessage = {
              id: `bot-${Date.now()}`,
              role: "assistant",
              content: matchedQuestion.answer,
              timestamp: new Date(),
            };
          } else {
            const res = await fetch("/api/gemini", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: msg.content, chatHistory: messages }),
            });
            if (!res.ok) {
              throw new Error(`Gemini API error: ${res.statusText}`);
            }
            const { response } = await res.json();
            botMessage = {
              id: `bot-${Date.now()}`,
              role: "assistant",
              content: response,
              timestamp: new Date(),
            };
          }
        }

        setMessages((prev) => [...prev, botMessage]);
        await addDoc(messagesRef, {
          role: "assistant",
          content: botMessage.content,
          timestamp: new Date(),
        });
      } catch (err) {
        console.error("Error processing queued message:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${err.message || "Failed to process queued message"}`,
            timestamp: new Date(),
          },
        ]);
      }
    }
    setQueuedMessages([]);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !auth.currentUser) return;

    const tempId = `temp-${Date.now()}`;
    const userMessage = { id: tempId, role: "user", content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const messagesRef = collection(db, "users", auth.currentUser.uid, "messages");
      const userDoc = await addDoc(messagesRef, {
        role: "user",
        content: input,
        timestamp: new Date(),
      });
      console.log("User message saved with ID:", userDoc.id);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...msg, id: userDoc.id } : msg
        )
      );

      // Check for reference number request or predefined answer
      const normalizedInput = input.trim().toLowerCase();
      let botMessage;

      if (
        normalizedInput.includes("reference number") ||
        normalizedInput.includes("id number") ||
        normalizedInput.includes("user id") ||
        normalizedInput.includes("my id")
      ) {
        botMessage = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: `Your reference number is: ${auth.currentUser.uid}`,
          timestamp: new Date(),
        };
      } else {
        const matchedQuestion = predefinedQuestions.find(
          (q) => q.question.trim().toLowerCase() === normalizedInput
        );

        if (matchedQuestion) {
          botMessage = {
            id: `bot-${Date.now()}`,
            role: "assistant",
            content: matchedQuestion.answer,
            timestamp: new Date(),
          };
        } else {
          const res = await fetch("/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: input, chatHistory: messages }),
          });
          if (!res.ok) {
            throw new Error(`Gemini API error: ${res.statusText}`);
          }
          const { response } = await res.json();
          botMessage = {
            id: `bot-${Date.now()}`,
            role: "assistant",
            content: response,
            timestamp: new Date(),
          };
        }
      }

      setMessages((prev) => [...prev, botMessage]);
      await addDoc(messagesRef, {
        role: "assistant",
        content: botMessage.content,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Error in handleSend:", err);
      if (err.message.includes("Could not reach Cloud Firestore backend")) {
        setQueuedMessages((prev) => [...prev, userMessage]);
        setMessages((prev) => [
          ...prev,
          {
            id: `info-${Date.now()}`,
            role: "assistant",
            content: "Message queued. It will sync when connectivity is restored.",
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${err.message || "Failed to process request"}`,
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to clear chats
  const handleClearChats = async () => {
    if (!auth.currentUser) return;

    try {
      const messagesRef = collection(db, "users", auth.currentUser.uid, "messages");
      const querySnapshot = await getDocs(messagesRef);

      // Delete each document in the messages collection
      const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Clear the local messages state
      setMessages([]);
      console.log("Chat history cleared successfully.");
    } catch (err) {
      console.error("Error clearing chat history:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err.message || "Failed to clear chat history"}`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  if (authLoading) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-10">
      <CardContent className="p-6">
        {firestoreError && (
          <div className="text-red-500 mb-4">{firestoreError}</div>
        )}
        <div className="flex justify-end mb-4">
          <Button
            onClick={handleClearChats}
            variant="destructive"
            disabled={loading || messages.length === 0}
          >
            Clear Chats
          </Button>
        </div>
        <ScrollArea className="h-[400px] mb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}
            >
              <span
                className={`inline-block p-2 rounded-lg ${
                  msg.role === "user" ? "bg-blue-100" : msg.role === "assistant" ? "bg-gray-100" : "bg-yellow-100"
                }`}
              >
                {msg.content}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>
        <form onSubmit={handleSend} className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about visas..."
            disabled={loading}
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )};