# Daneshjoyar — AI Study Assistant

**An AI-powered study assistant for Bale Messenger that answers questions from uploaded PDFs — including scanned ones — handles follow-up questions, and manages study documents. Runs fully locally.**

Built with TypeScript, Node.js, PostgreSQL, pgvector, Ollama, and Qwen 3.5 9B.

## Screenshots

<p align="center">
  <img src="screenshots/Screenshot_20261025_201501_Bale.jpg" width="18%" alt="Start Screen" />
  <img src="screenshots/Screenshot_20261025_202152_Bale.jpg" width="18%" alt="Multi Language Support" />
  <img src="screenshots/Screenshot_20261025_202331_Bale.jpg" width="18%" alt="Document Support" />
  <img src="screenshots/Screenshot_20261025_202413_Bale.jpg" width="18%" alt="Precise RAG Responses" />
  <img src="screenshots/Screenshot_20261025_202440_Bale.jpg" width="18%" alt="Multiple Document Management" />
</p>

## Features

- **PDF Management:** Upload, process, list, select, and delete study documents.
- **Document-Grounded Q&A:** Answer questions using passages retrieved from uploaded PDFs, with document names and page references.
- **Scanned & Broken PDFs:** Detects pages with no text layer or broken Persian letters and reads them with a local vision model (hybrid OCR), with progress updates in the chat.
- **Intelligent Query Routing:** Classify messages and choose between document-based answers and general chat.
- **Adaptive Retrieval:** Focused, multi-part, or broad strategies; hits are expanded with neighbouring chunks for context.
- **Follow-Up Understanding:** Short follow-ups ("explain more") are rewritten into standalone questions using the conversation.
- **Long-Document Summarization:** Summarize document batches sized to the model's context window, then combine them.
- **Non-Blocking & Cancellable:** Slow work runs in the background; `/cancel` stops a running request.

## Technical Highlights

| Component          | Implementation                                                                   |
| ------------------ | -------------------------------------------------------------------------------- |
| Backend            | Node.js, TypeScript                                                              |
| Messaging          | Bale Bot API (long polling, idempotent update processing)                        |
| Database           | PostgreSQL, node-pg-migrate migrations                                           |
| Vector search      | pgvector (cosine distance, relevance threshold)                                  |
| Embeddings         | BGE-M3 (1024-d, batched)                                                         |
| LLM inference      | Ollama, Qwen 3.5 9B (text + vision), explicit context window and per-task sampling |
| Document pipeline  | PDF text extraction, Persian text normalization, page-aware chunking, hybrid OCR |
| Retrieval          | Vector search, neighbour expansion, adaptive modes, LLM query rewriting          |
| Conversation state | Persistent message history and active-document selection                         |
| Testing            | Vitest unit tests with mocks, DB integration tests, coverage, GitHub Actions CI  |
| Evaluation         | Retrieval, router, end-to-end answer, OCR and latency harnesses                  |
| Deployment         | Docker Compose (PostgreSQL + pgvector)                                           |

## Architecture & Implementation

1. **Document ingestion:** Receive PDFs through Bale, extract text per page, normalize Persian text (Unicode NFKC, tabs, Arabic/Persian letter variants), and detect unreadable pages.
2. **Hybrid OCR:** Only empty or garbled pages are rendered to images and transcribed by the local vision model; every chunk records whether it came from the text layer or OCR.
3. **Vector storage:** Page-tagged chunks and embeddings are stored in PostgreSQL with pgvector.
4. **Message classification:** An LLM router with a JSON schema picks document retrieval or general conversation, plus the retrieval mode.
5. **Retrieval:** Rewrite follow-ups, search by similarity, add neighbouring chunks, and cite only the pages that were actual hits.
6. **Answer generation:** Grounded prompts with low temperature and an explicit context window; long documents use a map-reduce summary.
7. **Reliability:** Typed errors mapped to friendly messages, background processing, request cancellation, and deduplicated updates.

## Quality & Engineering

### Evaluation (does the AI do the right thing?)

| Harness                | What it measures                                                                                     | Current result (draft sets)                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `npm run eval`         | Retrieval on 44 questions by type (exact term, paraphrase, multi-page, follow-up, unanswerable): hit@k, MRR, context coverage, threshold calibration, diff vs previous run | hit@1 65%, hit@3 88%, MRR 0.79, answer page in context 90% |
| `npm run eval:router`  | Router accuracy on 30 labelled messages, with a confusion matrix                                     | route 100%, route + mode 97%                   |
| `npm run eval:answers` | Full pipeline: cites the right page, contains key facts, answers in Persian, refuses unanswerable questions; LLM-as-judge faithfulness | 20/20 pass, 4/4 unanswerable refused          |
| `npm run eval:ocr`     | OCR character error rate against an automatic answer key (pages with a good text layer)             | prose 5–7% CER                                 |
| `npm run benchmark`    | Time per stage (router, rewrite, retrieval, generation), p50/p95                                     | 8.5 s median; generation 76%, router 23%       |

**Found by measuring:** Ollama's default 4096-token context silently truncated long prompts; default sampling (temperature 1.0) was too random for factual answers; every citation was one page off and page 1 was never indexed; the follow-up rewriter sometimes answered instead of rewriting and once replaced a name ("روسو") with a hallucinated one — fixed with a few-shot prompt (follow-ups reaching the right context: 25% → 75%); unanswerable questions have the same vector distances as answerable ones, so the similarity threshold cannot filter them — grounding in the prompt has to (and does); the vision model reverses the letters of Persian words on slide pages (~60% CER).

### Tests (does the code stay correct?)

- **Unit tests** (`npm test`, 212 tests, < 1 s): pure logic (chunking, normalization, page-quality detection, context merging, citations) plus mocked flows — update deduplication and retry, `/cancel`, the chat pipeline, Ollama timeouts and bad responses, the OCR loop, delete confirmation.
- **Integration tests** (`npm run test:integration`): real PostgreSQL + pgvector with fake embeddings — one user can never search, select or delete another user's documents (verified by deliberately breaking the SQL filter and watching the tests fail), cascade deletes, failed ingestion stores nothing.
- **CI:** GitHub Actions runs type checks (including tests and scripts), unit tests with coverage, and integration tests on every push.
- **Clean layering:** configuration, prompts, user-facing messages, SQL, and platform code each live in one place.

## Technology Stack

`TypeScript` · `Node.js` · `PostgreSQL` · `pgvector` · `BGE-M3` · `Ollama` · `Qwen 3.5 9B` · `Vitest` · `Docker` · `Bale Bot API`

## Project Status

An actively developed personal project exploring retrieval-augmented generation (RAG), local vision-based OCR, context-aware conversations, document retrieval strategies, and LLM-powered study assistance.

## Project structure

```
src/
  main.ts            entry point: health endpoint + Bale polling
  config.ts          all env vars and tunables (models, context size, timeouts, chunking, OCR)
  messages.ts        every user-facing text (Persian)
  logger.ts          leveled logger (LOG_LEVEL=debug|info|warn|error)
  errors.ts          typed errors mapped to user-facing text
  bale.ts            Bale API client (messages, updates, file download)
  bot/               polling loop, update dispatcher, commands
  chat/              message pipeline and PDF upload flow
  llm/               Ollama client (chat, vision, embeddings) and prompts
  rag/               router, ingest, OCR, chunking, retrieval, query rewriting, answers
  db/                one module per table; all SQL lives here
migrations/          node-pg-migrate schema migrations
scripts/             evaluation harnesses, benchmark, data reset, local PDF ingestion
eval/                labelled question sets (results go to eval/results/, not committed)
tests/               unit tests; tests/integration/ runs against a real database
```

## Getting started

```bash
docker compose up -d          # PostgreSQL + pgvector
npm install
npm run migrate:up
ollama pull qwen3.5:9b && ollama pull bge-m3
npm run dev                   # start the bot
npm test                      # unit tests
npm run test:integration      # database tests (creates daneshjohandbot_test)
npm run eval                  # retrieval evaluation (also: eval:router, eval:answers, eval:ocr, benchmark)
```

Configure `.env` with `BALE_TOKEN`, `DATABASE_URL`, `LLM_URL`, `LLM_MODEL`, `EMBEDDING_MODEL`, `PORT`, and the Postgres credentials.
