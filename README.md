# 🎙️ Nova — Real-Time Multilingual AI Voice Agent

Nova is a real-time AI voice agent that lets users have natural voice conversations with AI in **English, Hindi, and Hinglish**.

The project focuses on building the complete real-time voice pipeline — from microphone audio capture and PCM processing to WebSocket streaming, speech transcription, NLP/LLM processing, AI voice generation, interruption handling, and secure authentication.

🔗 **Live Demo:** https://voice-agent-six-theta.vercel.app

---

## ✨ Features

- 🎙️ Real-time voice conversations
- 🌍 English, Hindi & Hinglish support
- 🔄 Automatic language switching
- 📝 Live user & AI transcription
- 🔊 Streaming AI voice responses
- ⚡ Bidirectional WebSocket communication
- 🗣️ Natural interruption / barge-in handling
- 🔐 Secure Gemini ephemeral authentication
- 🎧 Browser-based real-time audio processing
- ☁️ Vercel + Render deployment

---

## 🧠 How It Works

```text
Microphone
    ↓
Web Audio API
    ↓
PCM Audio Processing
    ↓
Base64 Encoding
    ↓
Gemini Live WebSocket
    ↓
Speech Recognition
    ↓
NLP / LLM Processing
    ↓
AI Response Generation
    ↓
Streaming Audio
    ↓
Browser Speaker
