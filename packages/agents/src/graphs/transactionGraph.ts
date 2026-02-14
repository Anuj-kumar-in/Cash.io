/**
 * Cash.io Agent Graph
 * 
 * Main LangGraph workflow definition for the Cash.io transaction agent.
 * Implements the Intent → Proof → Submit → Monitor pipeline.
 */

import { StateGraph, END, START } from "@langchain/langgraph";
import { AgentState, AgentStateType } from "../state/agentState.js";
import { createIntentParserNode, createSimpleIntentParser } from "../nodes/intentParser.js";
import { createProofCoordinatorNode } from "../nodes/proofCoordinator.js";
import { createTransactionSubmitterNode, createTransactionMonitorNode } from "../nodes/transactionSubmitter.js";
import { createHealthMonitorNode, createSystemHealthCheckNode } from "../nodes/healthMonitor.js";
import { createBridgeCoordinatorNode, createBridgeRelayerNode } from "../nodes/bridgeCoordinator.js";

/**
 * Create the main transaction agent graph
 */
export function createTransactionAgentGraph() {
    // Create the graph with our state annotation
    const graph = new StateGraph(AgentState);

    // Add nodes
    graph.addNode("parse_intent", createIntentParserNode());
    graph.addNode("generate_proof", createProofCoordinatorNode());
    graph.addNode("submit_transaction", createTransactionSubmitterNode());
    graph.addNode("monitor_transaction", createTransactionMonitorNode());
    graph.addNode("health_check", createHealthMonitorNode());
    graph.addNode("handle_error", handleErrorNode);
    graph.addNode("request_approval", requestApprovalNode);
    graph.addNode("bridge_coordinator", createBridgeCoordinatorNode());
    graph.addNode("bridge_relayer", createBridgeRelayerNode());

    // Define edges

    // Start with health check, then parse intent
    graph.addEdge(START, "health_check");

    // Health check routing
    graph.addConditionalEdges("health_check", (state: AgentStateType) => {
        if (state.currentStep === "health_critical") {
            return "handle_error";
        }
        return "parse_intent";
    });

    // Intent parsing routing
    graph.addConditionalEdges("parse_intent", (state: AgentStateType) => {
        switch (state.currentStep) {
            case "error":
                return "handle_error";
            case "validation_needed":
                return "request_approval";
            case "intent_parsed":
                // Route bridge intents to bridge coordinator
                if (state.intent?.type === "bridge") {
                    return "bridge_coordinator";
                }
                return "generate_proof";
            default:
                return "handle_error";
        }
    });

    // Bridge coordinator routing
    graph.addConditionalEdges("bridge_coordinator", (state: AgentStateType) => {
        switch (state.currentStep) {
            case "error":
                return "handle_error";
            case "generate_proof":
                return "generate_proof";
            case "awaiting_relay":
                return "bridge_relayer";
            default:
                return "generate_proof";
        }
    });

    // Bridge relayer routing
    graph.addConditionalEdges("bridge_relayer", (state: AgentStateType) => {
        switch (state.currentStep) {
            case "error":
                return "handle_error";
            case "monitor":
                return "monitor_transaction";
            case "completed":
                return END;
            default:
                return "monitor_transaction";
        }
    });

    // Approval routing
    graph.addConditionalEdges("request_approval", (state: AgentStateType) => {
        // In production: wait for human approval
        // For now: auto-approve and continue
        return "generate_proof";
    });

    // Proof generation routing
    graph.addConditionalEdges("generate_proof", (state: AgentStateType) => {
        switch (state.currentStep) {
            case "error":
                return "handle_error";
            case "proof_retry":
                return "generate_proof"; // Retry
            case "proof_ready":
                return "submit_transaction";
            default:
                return "handle_error";
        }
    });

    // Transaction submission routing
    graph.addConditionalEdges("submit_transaction", (state: AgentStateType) => {
        switch (state.currentStep) {
            case "error":
                return "handle_error";
            case "submission_retry":
                return "submit_transaction"; // Retry
            case "awaiting_confirmation":
                return "monitor_transaction";
            default:
                return "handle_error";
        }
    });

    // Transaction monitoring routing
    graph.addConditionalEdges("monitor_transaction", (state: AgentStateType) => {
        switch (state.currentStep) {
            case "completed":
                return END;
            case "awaiting_confirmation":
                return "monitor_transaction"; // Keep polling
            case "error":
                return "handle_error";
            default:
                return END;
        }
    });

    // Error handler always ends
    graph.addEdge("handle_error", END);

    return graph.compile();
}

/**
 * Error handler node
 */
async function handleErrorNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    const errors = state.errors;

    console.error("Agent encountered errors:", errors);

    return {
        messages: [
            "❌ Transaction failed",
            ...errors.map(e => `  - ${e}`),
        ],
        currentStep: "failed",
    };
}

/**
 * Request approval node (HITL)
 */
async function requestApprovalNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    const { intent, errors } = state;

    // Create approval request
    const approvalId = `approval_${Date.now()}`;

    // In production: send to approval queue and wait
    // For now: log and auto-approve
    console.log(`Approval requested: ${approvalId}`);
    console.log("Intent:", intent);
    console.log("Warnings:", errors);

    // Auto-approve after delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
        pendingApprovals: [{
            id: approvalId,
            type: "first_bridge",
            details: { intent },
            requestedAt: new Date(),
            approved: true,
            approvedBy: "auto",
            approvedAt: new Date(),
        }],
        messages: ["✅ Auto-approved (dev mode)"],
        currentStep: "approved",
        errors: [], // Clear warnings after approval
    };
}

/**
 * Create a simpler fallback graph without LLM dependencies
 */
export function createSimpleTransactionGraph() {
    const graph = new StateGraph(AgentState);

    graph.addNode("parse_intent", createSimpleIntentParser());
    graph.addNode("generate_proof", createProofCoordinatorNode());
    graph.addNode("submit_transaction", createTransactionSubmitterNode());
    graph.addNode("handle_error", handleErrorNode);

    graph.addEdge(START, "parse_intent");

    graph.addConditionalEdges("parse_intent", (state: AgentStateType) => {
        return state.currentStep === "error" ? "handle_error" : "generate_proof";
    });

    graph.addConditionalEdges("generate_proof", (state: AgentStateType) => {
        switch (state.currentStep) {
            case "proof_ready":
                return "submit_transaction";
            case "proof_retry":
                return "generate_proof";
            default:
                return "handle_error";
        }
    });

    graph.addConditionalEdges("submit_transaction", (state: AgentStateType) => {
        return state.currentStep === "error" ? "handle_error" : END;
    });

    graph.addEdge("handle_error", END);

    return graph.compile();
}

/**
 * Create a health monitoring graph that runs continuously
 */
export function createHealthMonitorGraph() {
    const graph = new StateGraph(AgentState);

    graph.addNode("check_chains", createHealthMonitorNode());
    graph.addNode("check_system", createSystemHealthCheckNode());
    graph.addNode("alert", alertNode);

    graph.addEdge(START, "check_chains");
    graph.addEdge("check_chains", "check_system");

    graph.addConditionalEdges("check_system", (state: AgentStateType) => {
        if (state.currentStep === "system_degraded") {
            return "alert";
        }
        return END;
    });

    graph.addEdge("alert", END);

    return graph.compile();
}

/**
 * Alert node for critical issues
 */
async function alertNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    console.warn("🚨 ALERT: System health is degraded");
    console.warn("Errors:", state.errors);
    console.warn("Chain health:", state.chainHealth);

    // In production: send to alerting system (PagerDuty, Slack, etc.)

    return {
        messages: ["🚨 Alert sent to operators"],
        currentStep: "alerted",
    };
}
