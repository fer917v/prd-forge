import { prdforgeLedger } from './agents/prdforge-ledger';
import { defineCrew } from './lib/crew';

/**
 * THE CREW — single source of truth for this project's agent roster. PRDForge has one
 * member: the deterministic ledger service. With a single member the orchestrator
 * collapses to that member, so the project imports flat into AgentBase and the MCP bridge
 * exposes the ledger's tools directly (docs/AGENT_SPEC.md §2).
 */
export const crew = defineCrew({
  members: [prdforgeLedger],
});

export { crewAgents } from './lib/crew';
