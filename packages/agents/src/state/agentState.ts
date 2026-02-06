/**
 * Cash.io Agent State
 * 
 * Shared state object that flows through the LangGraph workflow.
 * All agents can read and modify this state.
 */

import { Annotation } from "@langchain/langgraph";

/**
 * Transaction intent parsed from user input
 */
export interface TransactionIntent {
    type: "deposit" | "withdraw" | "transfer" | "bridge";
    sourceChain?: "ethereum" | "solana" | "rootstock" | "subnet";
    destinationChain?: "ethereum" | "solana" | "rootstock" | "subnet";
    amount?: string;
    recipient?: string;
    commitment?: string;
    isPrivate: boolean;
    rawInput: string;
}

/**
 * Proof generation status
 */
export interface ProofStatus {
    state: "pending" | "generating" | "completed" | "failed";
    proofType: "deposit" | "withdraw" | "transfer" | "batch";
    inputHash?: string;
    proof?: string;
    publicInputs?: string[];
    error?: string;
    generationTimeMs?: number;
}

/**
 * Transaction submission status
 */
export interface TransactionStatus {
    state: "pending" | "submitted" | "confirmed" | "failed";
    userOpHash?: string;
    transactionHash?: string;
    blockNumber?: number;
    gasUsed?: string;
    error?: string;
}

/**
 * Chain health status
 */
export interface ChainHealth {
    chain: string;
    isHealthy: boolean;
    blockNumber: number;
    latency: number;
    lastChecked: Date;
    issues?: string[];
}

/**
 * Approval request for HITL (Human-in-the-Loop)
 */
export interface ApprovalRequest {
    id: string;
    type: "large_withdrawal" | "first_bridge" | "suspicious_activity";
    details: Record<string, unknown>;
    requestedAt: Date;
    approved?: boolean;
    approvedBy?: string;
    approvedAt?: Date;
}

/**
 * Main agent state annotation
 */
export const AgentState = Annotation.Root({
    // User input and intent
    userInput: Annotation<string>({
        reducer: (_, next) => next,
        default: () => "",
    }),

    intent: Annotation<TransactionIntent | null>({
        reducer: (_, next) => next,
        default: () => null,
    }),

    // Proof generation
    proofStatus: Annotation<ProofStatus | null>({
        reducer: (_, next) => next,
        default: () => null,
    }),

    // Transaction status
    transactionStatus: Annotation<TransactionStatus | null>({
        reducer: (_, next) => next,
        default: () => null,
    }),

    // Messages/conversation history
    messages: Annotation<string[]>({
        reducer: (prev, next) => [...prev, ...next],
        default: () => [],
    }),

    // Chain health data
    chainHealth: Annotation<Record<string, ChainHealth>>({
        reducer: (prev, next) => ({ ...prev, ...next }),
        default: () => ({}),
    }),

    // Approval requests
    pendingApprovals: Annotation<ApprovalRequest[]>({
        reducer: (prev, next) => [...prev, ...next],
        default: () => [],
    }),

    // Error tracking
    errors: Annotation<string[]>({
        reducer: (prev, next) => [...prev, ...next],
        default: () => [],
    }),

    // Current step in workflow
    currentStep: Annotation<string>({
        reducer: (_, next) => next,
        default: () => "start",
    }),

    // Retry count for failure handling
    retryCount: Annotation<number>({
        reducer: (_, next) => next,
        default: () => 0,
    }),

    // Maximum retries allowed
    maxRetries: Annotation<number>({
        reducer: (_, next) => next,
        default: () => 3,
    }),
});

export type AgentStateType = typeof AgentState.State;
