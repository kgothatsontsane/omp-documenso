# Vercel Remix Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Route the current React Router/Remix and Hono application through Vercel instead of deploying its build directory as static files.

**Architecture:** Keep Turbo responsible for Prisma generation and the existing Remix build. Add a Vercel-compatible request entrypoint that imports the generated server build and exports the Hono/React Router handler. Remove the static output-directory assumption so Vercel detects the request entrypoint.

**Tech Stack:** React Router v7, Hono, Vite, Turbo, Vercel Node runtime.

---

### Task 1: Add Vercel request entrypoint

**Files:**
- Create: `api/index.ts`
- Create: `vercel.json`

- [ ] Export the built Hono handler from `api/index.ts` and configure Vercel to build the Remix workspace with Turbo.
- [ ] Keep `apps/remix/build` out of `outputDirectory`; it is an application build, not a static site root.
- [ ] Set the Vercel function runtime to Node.js with a route-wide handler.

### Task 2: Verify and deploy

**Files:**
- No source files beyond Task 1.

- [ ] Run the locked dependency install and the Vercel build.
- [ ] Deploy production with the linked `omp-documenso` project.
- [ ] Verify `/`, `/signin`, and `/api/health` return application responses instead of Vercel `NOT_FOUND`.
