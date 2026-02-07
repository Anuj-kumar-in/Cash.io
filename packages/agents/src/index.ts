/**
 * Cash.io Agents - Main Entry Point
 * 
 * Exports the agent graphs and utilities for use in the application.
 */

import { createTransactionAgentGraph, createSimpleTransactionGraph, createHealthMonitorGraph } from "./graphs/transactionGraph.js";
import { AgentState } from "./state/agentState.js";
import type { AgentStateType } from "./state/agentState.js";

export {
    // Graphs
    createTransactionAgentGraph,
    createSimpleTransactionGraph,
    createHealthMonitorGraph,

    // State
    AgentState,
};

export type {
    AgentStateType,
};

/**
 * Example usage and CLI runner
 */
async function main() {
    console.log("🚀 Cash.io Agent System Starting...\n");

    // Create the transaction agent
    const transactionAgent = createSimpleTransactionGraph();

    // Example: Process a deposit intent
    const depositResult = await transactionAgent.invoke({
        userInput: "I want to deposit 0.5 ETH from Ethereum to the shielded pool",
        maxRetries: 3,
    });

    console.log("\n📊 Deposit Result:");
    console.log("Messages:", depositResult.messages);
    console.log("Intent:", depositResult.intent);
    console.log("Proof Status:", depositResult.proofStatus?.state);
    console.log("Transaction Status:", depositResult.transactionStatus?.state);

    console.log("\n---\n");

    // Example: Health check
    const healthAgent = createHealthMonitorGraph();

    console.log("🏥 Running Health Check...");
    const healthResult = await healthAgent.invoke({});

    console.log("\n📊 Health Result:");
    console.log("Messages:", healthResult.messages);
    console.log("Errors:", healthResult.errors);

    console.log("\n✅ Agent System Ready");
}

// Run if executed directly
const isMainModule = process.argv[1]?.includes("index");
if (isMainModule) {
    main().catch(console.error);
}
