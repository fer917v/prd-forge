import { runCreate, runGet, runSetDigest, runSetProfile, runSetState } from './run';
import { controlsShortlist, ledgerCreateSections, rubricOutline, rubricSlice } from './rubric';
import {
  ledgerWriteDecision,
  ledgerWriteFacts,
  ledgerWriteFindings,
  ledgerWriteMappings,
  ledgerWriteRequirements,
  ledgerWriteRevision,
  ledgerWriteSectionNarrative,
  ledgerWriteWorkflow,
} from './writes';
import {
  controlsCoverage,
  ledgerFindSimilar,
  ledgerReadSection,
  ledgerSummary,
  ledgerTraceAudit,
} from './reads';
import {
  approvalCreate,
  bundleCompile,
  bundleGet,
  bundleVerify,
  ledgerRender,
  snapshotDiff,
  snapshotWrite,
} from './doc-and-bundle';

/**
 * The 26 tools of docs/AGENT_SPEC.md §1, keyed as the agent (and the AgentBase MCP bridge)
 * exposes them. Spec names use dots (`run.create`); tool ids use underscores (`run_create`)
 * because tool-calling APIs restrict names to [A-Za-z0-9_-].
 */
export const ledgerTools = {
  runCreate,
  runGet,
  runSetState,
  runSetDigest,
  runSetProfile,
  ledgerWriteFacts,
  ledgerWriteWorkflow,
  ledgerCreateSections,
  ledgerWriteRequirements,
  ledgerWriteRevision,
  ledgerWriteSectionNarrative,
  ledgerReadSection,
  ledgerWriteMappings,
  ledgerWriteFindings,
  ledgerWriteDecision,
  rubricOutline,
  rubricSlice,
  controlsShortlist,
  controlsCoverage,
  snapshotWrite,
  snapshotDiff,
  ledgerRender,
  approvalCreate,
  bundleCompile,
  bundleVerify,
  bundleGet,
  ledgerSummary,
  ledgerTraceAudit,
  ledgerFindSimilar,
};
