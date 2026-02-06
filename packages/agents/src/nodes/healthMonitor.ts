/**
 * Health Monitor Node
 * 
 * Monitors the health of all connected chains and services.
 * Reports issues and can pause operations if critical problems are detected.
 */

import { ethers } from "ethers";
import { AgentStateType, ChainHealth } from "../state/agentState.js";

/**
 * Chain RPC endpoints
 */
const CHAIN_ENDPOINTS: Record<string, string> = {
    subnet: process.env.SUBNET_RPC_URL || "http://localhost:9650/ext/bc/cashio/rpc",
    ethereum: process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
    sepolia: process.env.SEPOLIA_RPC_URL || "https://sepolia.drpc.org",
    rootstock: process.env.RSK_RPC_URL || "https://public-node.rsk.co",
    rootstockTestnet: process.env.RSK_TESTNET_RPC_URL || "https://public-node.testnet.rsk.co",
};

/**
 * Solana RPC endpoints (different format)
 */
const SOLANA_ENDPOINTS = {
    mainnet: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    devnet: process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com",
};

/**
 * Health check thresholds
 */
const THRESHOLDS = {
    maxLatencyMs: 5000,
    maxBlockAge: 60, // seconds
    minPeerCount: 3,
};

/**
 * Create the health monitor node
 */
export function createHealthMonitorNode() {
    return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
        const healthResults: Record<string, ChainHealth> = {};
        const issues: string[] = [];

        // Check EVM chains
        for (const [chain, rpcUrl] of Object.entries(CHAIN_ENDPOINTS)) {
            try {
                const health = await checkEvmChainHealth(chain, rpcUrl);
                healthResults[chain] = health;

                if (!health.isHealthy) {
                    issues.push(`${chain}: ${health.issues?.join(", ")}`);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                healthResults[chain] = {
                    chain,
                    isHealthy: false,
                    blockNumber: 0,
                    latency: -1,
                    lastChecked: new Date(),
                    issues: [`Connection failed: ${errorMessage}`],
                };
                issues.push(`${chain}: Connection failed`);
            }
        }

        // Check Solana
        for (const [network, rpcUrl] of Object.entries(SOLANA_ENDPOINTS)) {
            const chainName = `solana_${network}`;
            try {
                const health = await checkSolanaHealth(chainName, rpcUrl);
                healthResults[chainName] = health;

                if (!health.isHealthy) {
                    issues.push(`${chainName}: ${health.issues?.join(", ")}`);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                healthResults[chainName] = {
                    chain: chainName,
                    isHealthy: false,
                    blockNumber: 0,
                    latency: -1,
                    lastChecked: new Date(),
                    issues: [`Connection failed: ${errorMessage}`],
                };
                issues.push(`${chainName}: Connection failed`);
            }
        }

        // Determine overall health and next step
        const criticalChains = ["subnet", "ethereum"]; // Chains that must be healthy
        const criticalIssues = criticalChains.filter(chain => !healthResults[chain]?.isHealthy);

        if (criticalIssues.length > 0) {
            return {
                chainHealth: healthResults,
                errors: issues,
                messages: [`🚨 Critical chains unhealthy: ${criticalIssues.join(", ")}`],
                currentStep: "health_critical",
            };
        }

        if (issues.length > 0) {
            return {
                chainHealth: healthResults,
                messages: [`⚠️ Some chains have issues: ${issues.length} warnings`],
                currentStep: "health_warning",
            };
        }

        return {
            chainHealth: healthResults,
            messages: ["✅ All chains healthy"],
            currentStep: "health_ok",
        };
    };
}

/**
 * Check EVM chain health
 */
async function checkEvmChainHealth(chain: string, rpcUrl: string): Promise<ChainHealth> {
    const startTime = Date.now();
    const issues: string[] = [];

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Get block number
    const blockNumber = await provider.getBlockNumber();

    // Get latest block to check age
    const block = await provider.getBlock(blockNumber);
    const blockAge = block ? Date.now() / 1000 - block.timestamp : Infinity;

    if (blockAge > THRESHOLDS.maxBlockAge) {
        issues.push(`Block age ${Math.round(blockAge)}s exceeds threshold`);
    }

    // Calculate latency
    const latency = Date.now() - startTime;

    if (latency > THRESHOLDS.maxLatencyMs) {
        issues.push(`Latency ${latency}ms exceeds threshold`);
    }

    // Try to get peer count (not all nodes support this)
    try {
        const peerCount = await provider.send("net_peerCount", []);
        const peers = parseInt(peerCount, 16);
        if (peers < THRESHOLDS.minPeerCount) {
            issues.push(`Only ${peers} peers connected`);
        }
    } catch {
        // Ignore if not supported
    }

    return {
        chain,
        isHealthy: issues.length === 0,
        blockNumber,
        latency,
        lastChecked: new Date(),
        issues: issues.length > 0 ? issues : undefined,
    };
}

/**
 * Check Solana health
 */
async function checkSolanaHealth(chain: string, rpcUrl: string): Promise<ChainHealth> {
    const startTime = Date.now();
    const issues: string[] = [];

    // Solana uses JSON-RPC with different method names
    const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getSlot",
            params: [],
        }),
    });

    const result = await response.json();
    const slot = result.result as number;

    // Check latency
    const latency = Date.now() - startTime;
    if (latency > THRESHOLDS.maxLatencyMs) {
        issues.push(`Latency ${latency}ms exceeds threshold`);
    }

    // Check cluster health
    const healthResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getHealth",
            params: [],
        }),
    });

    const healthResult = await healthResponse.json();
    if (healthResult.result !== "ok") {
        issues.push("Cluster reports unhealthy status");
    }

    return {
        chain,
        isHealthy: issues.length === 0,
        blockNumber: slot,
        latency,
        lastChecked: new Date(),
        issues: issues.length > 0 ? issues : undefined,
    };
}

/**
 * Create a chain watcher node for specific chain events
 */
export function createChainWatcherNode(chainName: string) {
    return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
        const rpcUrl = CHAIN_ENDPOINTS[chainName];

        if (!rpcUrl) {
            return {
                errors: [`Unknown chain: ${chainName}`],
                currentStep: "error",
            };
        }

        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            // Get recent events from bridge contract
            // In production: filter for deposit/withdrawal events
            const blockNumber = await provider.getBlockNumber();

            return {
                messages: [`👀 Watching ${chainName} at block ${blockNumber}`],
                currentStep: `watching_${chainName}`,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return {
                errors: [`Failed to watch ${chainName}: ${errorMessage}`],
                currentStep: "error",
            };
        }
    };
}

/**
 * Create an aggregate health check for the entire system
 */
export function createSystemHealthCheckNode() {
    return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
        const checks = {
            chains: Object.values(state.chainHealth).filter(h => h.isHealthy).length,
            totalChains: Object.values(state.chainHealth).length,
            pendingApprovals: state.pendingApprovals.length,
            errors: state.errors.length,
        };

        const healthScore = (checks.chains / Math.max(checks.totalChains, 1)) * 100;

        let status: string;
        if (healthScore >= 90) {
            status = "🟢 System healthy";
        } else if (healthScore >= 50) {
            status = "🟡 System degraded";
        } else {
            status = "🔴 System critical";
        }

        return {
            messages: [
                `${status}`,
                `Chains: ${checks.chains}/${checks.totalChains}`,
                `Pending approvals: ${checks.pendingApprovals}`,
                `Errors: ${checks.errors}`,
            ],
            currentStep: healthScore >= 50 ? "system_ok" : "system_degraded",
        };
    };
}
