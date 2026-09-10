# BulkQuestionUploader & Backend Ingestion Diagnostic Report

**Date & Time**: September 10, 2026  
**Target Component**: `BulkQuestionUploader.tsx`, `csvQuestionParser.ts`, and `/api/questions/insert`

---

## 1. Executive Summary
This diagnostic report evaluates the ingestion lifecycle of the **Bulk Question Uploader** and the backend batch insert logic in **Scholars Resort**. Specifically, it addresses:
1. Why questions were previously flagged as duplicates or skipped.
2. How the server-side proxy (`/api/questions/insert`) resolves Row Level Security (RLS) constraints to guarantee persistence across page refreshes.
3. How unique constraints and in-place upserts prevent redundant AI token usage.

---

## 2. Backend Insert Logic & RLS Persistence Analysis
* **Previous Issue**: Client-side inserts into Supabase were occasionally blocked by strict Table RLS (Row Level Security) policies, causing uploads to fall back to transient local storage or return silent validation failures, which presented as missing questions upon browser refresh.
* **Resolution**: 
  - Implemented the server-side proxy route `/api/questions/insert` backed by `getScopedSupabaseClient` using administrative service credentials (`SUPABASE_SERVICE_ROLE_KEY`).
  - This guarantees that batch inserts and in-place updates bypass client permission restrictions, writing directly to the Supabase `questions` table with 100% durability.

---

## 3. Duplicate Flagging & In-Place Upsert Verification
* **Why Questions Were Flagged**: 
  - The parser normalizes question stems (`normalizeQuestionStem()`) by stripping leading question numbering (e.g. `1. `, `Q1: `), punctuation, and extra whitespace.
  - Previously, exact or near-match Jaccard similarity thresholding ($\ge 0.88$) flagged re-uploaded question sets as duplicates, prompting the system to skip them unless explicitly overridden.
* **Current Smart Upsert Strategy**:
  - Instead of blocking re-uploads or generating duplicate database rows, the system now performs a **smart in-place upsert**.
  - When a question stem matches an existing record in the database, the backend **updates the existing record in-place** with the latest recommended column format (`exam_year`, `explanation`, `topic_id`, `difficulty`, `options`, `correct_answer`).
  - This ensures that re-uploading enriched CSV files updates existing entries without inflating the question count or showing duplicate items to students.

---

## 4. Token Optimization & Explanation Handling
* **Zero AI Token Waste**:
  - All questions uploaded via CSV include pre-written pedagogical explanations (`explanation` column).
  - These explanations are stored directly in the database and rendered instantly in the student test review interface.
  - Automatic AI token generation is bypassed entirely; AI models are only invoked if a student explicitly clicks the optional "Ask AI Tutor for Deeper Breakdown" button.
