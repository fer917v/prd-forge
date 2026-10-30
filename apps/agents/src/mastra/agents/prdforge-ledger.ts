import { Agent } from '@mastra/core/agent';
import { resolveAgentModel } from '../lib/agentbase-model';
import { ledgerTools } from '../tools/ledger';

export const AGENT_ID = 'prdforge-ledger';

/**
 * prdforge-ledger — the system of record behind the prdforge Claude skill (docs/AGENT_SPEC.md).
 *
 * It does not reason. Every tool is deterministic: store, validate, slice, diff, hash,
 * compile. The model is a formality Mastra requires; the instructions make it a router that
 * calls the requested tool and returns the result verbatim. No memory (transformation agent),
 * no MCP toolset (it reaches nothing outside its own Postgres).
 */
export const prdforgeLedger = new Agent({
  id: AGENT_ID,
  name: 'PRDForge Ledger',
  description:
    'Requirement ledger service for PRDForge: run state, anchored facts, grammar-checked requirements, Annex A coverage, Doc snapshots, approvals and the build bundle. Deterministic tools; no reasoning.',
  instructions:
    'You are a tool router for the PRDForge requirement ledger. You never reason about product ' +
    'requirements, never rewrite text, never invent data. When asked to perform an operation, call the ' +
    'single matching tool with exactly the arguments given and return its result verbatim as JSON. If ' +
    'the request names no tool or the arguments are incomplete, reply with the tool name and the ' +
    'missing fields, nothing else. Never call more than one tool per request unless the request ' +
    'explicitly lists several.',
  model: resolveAgentModel(AGENT_ID),
  tools: ledgerTools,
});
