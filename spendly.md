# 🪙 Spendly App Knowledge Base (SmartExpense AI)

Welcome to the comprehensive guide to **Spendly** (also known as **SmartExpense AI**). This document serves as the absolute source of truth for the Spendly personal finance platform, its architectures, features, supported modes, offline functionalities, and its intelligent AI Hub.

---

## 📖 Table of Contents
1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Supported Spending Categories](#supported-spending-categories)
4. [Offline-First Architecture & Syncing](#offline-first-architecture-syncing)
5. [Spendly AI Hub & RAG Chatbot](#spendly-ai-hub-rag-chatbot)
6. [Rate Limits & Observability](#rate-limits-observability)
7. [Database Schema & Tables](#database-schema-tables)
8. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)

---

## 1. Overview
**Spendly** is a premium, intelligent, offline-first personal finance tracker designed to eliminate the friction of managing budgets and logging transactions. It integrates local-first SQLite performance with real-time Supabase cloud sync and Google Gemini AI services.

* **Frontend**: React Native, Expo, TypeScript, Expo Router (file-based routing), and Zustand (global state stores).
* **Backend Layer**: Supabase Authentication, Supabase Storage, Supabase PostgreSQL, and Supabase Edge Functions.
* **AI Engine**: Google Gemini AI (for OCR, category mapping, embedding vector generation, and conversational RAG synthesis).

---

## 2. Core Features

### 🤖 Gemini-Powered OCR Scanner
* **Receipt Capture**: Users can snap pictures of physical receipts. Gemini AI extracts the merchant name, total transaction value, tax, transaction date, payment method, and individual line items with near-perfect accuracy.
* **Smart Parsing**: Converts messy receipt images into structured JSON transactions, ready to be reviewed and logged with a single click.

### 📸 UPI Screenshot Auto-Detection
* **Supported Apps**: Google Pay, PhonePe, and Paytm.
* **Instant Logs**: Users can upload transaction confirmation screenshots. The parser detects payment amounts, transaction dates, bank references, and merchant names, adding them directly to the database.

### 🧠 AI Category Classifier
* **Instant Mapping**: Automatically maps any merchant name to its correct spending category in milliseconds (e.g., *Starbucks* -> `Food`, *Costco* -> `Grocery`, *Shell* -> `Fuel`).

### 📊 Interactive Visual Analytics
* **Charts**: Custom bar charts and pie charts mapping spending trends month-over-month.
* **Filters**: View metrics filtered by date range or specific categories.

### 💸 Multi-Currency Converter
* **Syncing**: Real-time currency exchange rates are cached locally, allowing users to enter expenses in foreign currencies and convert them instantly to their default ledger currency.

---

## 3. Supported Spending Categories
Spendly maps all incoming expenses to one of the following 12 structured categories:

1. 🍕 **Food**: Restaurants, cafes, food deliveries (Starbucks, Swiggy, Zomato, McDonald's).
2. 🛒 **Grocery**: Supermarkets and wholesale outlets (Walmart, Target, Costco, local grocers).
3. ✈️ **Travel**: Flights, taxi rides, trains, hotel bookings, and ride-hailing (Uber, Lyft, Airbnb).
4. ⛽ **Fuel**: Gas stations and charging stations (Shell, Chevron, ExxonMobil).
5. 🛍️ **Shopping**: Online retail, apparel, and gadgets (Amazon, Nike, Zara, Apple Store).
6. 🎬 **Entertainment**: Movies, streaming services, video games (Netflix, Spotify, Steam, PlayStation).
7. 🔌 **Bills**: Utilities, internet subscriptions, phone recharges, and insurance (AT&T, electricity, gas).
8. 🏥 **Health**: Medical checkups, pharmacies, gym memberships, and clinical charges (CVS, Walgreens).
9. 🏠 **Rent**: Monthly housing leases, mortgages, and landlord payouts.
10. 💳 **EMI**: Loan installments, financing interest, and credit card payments.
11. 📚 **Education**: Courses, school/college fees, book purchases (Udemy, Coursera, textbooks).
12. 📦 **Other**: General fallback for miscellaneous or uncategorized items.

---

## 4. Offline-First Architecture & Syncing

Spendly is built around a local-first repository layout to guarantee the app remains fully functional under any network condition.

### Local SQLite Cache
* All transactions, settings, and budgets are read from and written to a highly optimized local SQLite database cache.
* This ensures instant screen load times and zero dependency on a network connection for basic features.

### Supabase Cloud Synchronization
* **Online Sync**: When an internet connection is established, changes made offline are automatically batch-synchronized with the remote Supabase PostgreSQL database.
* **Zustand & Network Monitors**: A Zustand-managed state engine combined with hardware network listeners monitors connection transitions. If a user goes offline during a network request (like LLM streaming), the app gracefully pauses and notifies the user.

---

## 5. Spendly AI Hub & RAG Chatbot

The **Spendly AI Chat Assistant** is a Retrieval-Augmented Generation (RAG) agent that answers user queries using uploaded documents and files, combined with LLM reasoning.

### Supported File Formats for Ingestion
* 📄 **PDFs (`.pdf`)**: Parsed page-by-page using the edge-native `unpdf` library in the cloud.
* 📝 **Word Documents (`.docx`)**: Parsed using the `mammoth` OpenXML parser library.
* 📊 **Spreadsheets (`.xlsx`, `.csv`)**: Analyzed and chunked by row using the SheetJS (`xlsx`) library. Spreadsheet rows are structured as individual Q&A blocks to maintain ledger formatting.
* ✍️ **Text & Markdown (`.txt`, `.md`)**: Decoded and parsed natively.

### RAG Pipeline Flow
1. **Document Upload**: Users pick a file from the app. It uploads to a private Supabase Storage bucket (`documents`).
2. **Metadata Registration**: A metadata entry is created in the database.
3. **Ingestion Trigger**: The `ingest-document` Supabase Edge Function is triggered. It downloads the file, parses text, splits it into semantic chunks with a sliding window (including headings), generates 768-dimension vectors using Google's `gemini-embedding-001` model, and saves them into the `document_chunks` table.
4. **Chat Invocations**: The user types a message in the chat dashboard.
5. **Context Retrieval**: The `chat` Edge Function generates an embedding for the user's query and performs a **Cosine Similarity & Keyword Hybrid Search** against the vector index.
6. **LLM Synthesis**: The top 5 matching text chunks are appended as context to the system prompt, which is sent to Google's `gemini-2.5-flash` model.
7. **SSE Streaming**: Responses are streamed back in real-time as Server-Sent Events (SSE) to the mobile client using a fragmented packet buffer parser.

### Citations and References
* The assistant is instructed to only answer questions using the provided documents.
* In-line references (e.g. `[1]`, `[2]`) are parsed by the app and link directly to a modal showing citation metadata (Document Title, Page number, or Row number).
* **Strict Fallback**: If the requested information is not in the uploaded documents, the assistant responds with exactly: *"I'm sorry, I cannot find that information in your uploaded documents."*

---

## 6. Rate Limits & Observability

To prevent abuse and keep operating costs low, the AI Hub enforces strict rate limits on the backend:

* **Message Frequency**: A user can send a maximum of **10 messages per minute**.
* **Daily Token Allowance**: A user is capped at **50,000 daily tokens** (including prompts and completions).
* **Feedback Observability**: Users can rate messages with a thumbs up/down. This logs the conversation context to the `chat_feedback` table for quality assurance.
* **Auto-Summarization**: When a conversation thread contains more than 10 messages, a background worker triggers Gemini to summarize the historical dialogue, compressing context length to save tokens.

---

## 7. Database Schema & Tables

Here is the PostgreSQL schema backing the Spendly AI Hub features:

### 1. `public.documents`
Stores metadata of files uploaded to the Knowledge Base.
* `id` (uuid, primary key)
* `title` (text)
* `filename` (text)
* `storage_path` (text)
* `uploaded_by` (uuid, references auth.users)
* `file_type` (text)
* `version` (int)
* `created_at` / `updated_at` (timestamptz)

### 2. `public.document_chunks`
Stores parsed semantic text blocks and their vector embeddings.
* `id` (uuid, primary key)
* `document_id` (uuid, references public.documents)
* `chunk_text` (text)
* `embedding` (vector(768)) -- generated by `gemini-embedding-001`
* `page_number` (int, optional)
* `section` (text, optional)
* `metadata` (jsonb)

### 3. `public.chat_conversations`
Holds individual chat threads.
* `id` (uuid, primary key)
* `title` (text)
* `user_id` (uuid, references auth.users)
* `summary` (text, optional)
* `created_at` / `updated_at` (timestamptz)

### 4. `public.chat_messages`
Stores conversation messages.
* `id` (uuid, primary key)
* `conversation_id` (uuid, references public.chat_conversations)
* `role` (text, check constraint: `'user'`, `'assistant'`, or `'system'`)
* `content` (text)
* `citations` (jsonb, optional)
* `token_usage` (jsonb)
* `created_at` (timestamptz)

### 5. `public.chat_feedback`
Stores user ratings for quality control.
* `id` (uuid, primary key)
* `message_id` (uuid, references public.chat_messages)
* `is_positive` (boolean)
* `comment` (text, optional)
* `created_at` (timestamptz)

---

## 8. Frequently Asked Questions (FAQ)

### Q: Why does the chat assistant say it cannot find information?
**A**: By default, the chatbot operates under strict RAG constraints. If you have not uploaded files containing the answers, or if the answers are not found in the semantic context chunks, the chatbot will reply with a standard fallback: *"I'm sorry, I cannot find that information in your uploaded documents."* Go to the **Knowledge Base** tab to upload your references.

### Q: Can I run Spendly completely offline?
**A**: Yes! You can log expenses, track budgets, and view analytics offline. Your changes will sync automatically to the cloud when your connection is restored. However, AI features (such as Receipt Scanning, UPI Screenshot Parsing, and AI Chat Assistant) require a network connection to reach Google's Gemini models.

### Q: Is there a file size limit for uploads?
**A**: Yes, the maximum supported upload limit is **10MB** per file. Files exceeding this size will fail to upload.

### Q: How do I delete my uploaded documents?
**A**: In the **Knowledge Base** tab, find your document in the list and click the trash can icon. This will delete the document metadata, its vector chunks, and remove the file from your Supabase Storage bucket.

### Q: What is the rate limit for chat?
**A**: To ensure fair usage, the chatbot is limited to **10 messages per minute** and **50,000 total tokens per day** per user. If you hit the limit, wait a few minutes before sending another message.
