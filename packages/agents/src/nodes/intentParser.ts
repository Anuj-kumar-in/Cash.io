/**
 * Intent Parser Node
 * 
 * Parses natural language user input into structured transaction intents.
 * Uses LLM to understand user's desired action and extract parameters.
 */

import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { AgentStateType, TransactionIntent } from "../state/agentState.js";

// Intent schema for structured output
const IntentSchema = z.object({
    type: z.enum(["deposit", "withdraw", "transfer", "bridge"]),
    sourceChain: z.enum(["ethereum", "solana", "rootstock", "subnet"]).optional(),
    destinationChain: z.enum(["ethereum", "solana", "rootstock", "subnet"]).optional(),
    amount: z.string().optional(),
    recipient: z.string().optional(),
    isPrivate: z.boolean(),
});

const INTENT_PROMPT = `You are a transaction intent parser for Cash.io, a privacy-preserving multi-chain DeFi protocol.

Analyze the user's message and extract the transaction intent. Cash.io supports:
- Deposits: Adding funds to the shielded pool (from any supported chain)
- Withdrawals: Removing funds from the shielded pool (to any supported chain)
- Transfers: Private transfers within the shielded pool
- Bridges: Moving funds between chains (ETH, Solana, Rootstock/Bitcoin)

Supported chains:
- ethereum: Ethereum mainnet/testnet
- solana: Solana mainnet/devnet
- rootstock: Rootstock (Bitcoin sidechain)
- subnet: Cash.io Avalanche Subnet (hub chain)

Extract the following if mentioned:
- Transaction type
- Source chain (for bridges/deposits)
- Destination chain (for bridges/withdrawals)
- Amount (with units if specified)
- Recipient address (for transfers/withdrawals)
- Whether it should be private (default to true for this privacy-focused protocol)

User message: {input}

Respond with a JSON object matching the intent schema.`;

/**
 * Create the intent parser node
 */
export function createIntentParserNode() {
    const model = new ChatOpenAI({
        modelName: "gpt-4-turbo-preview",
        temperature: 0,
    });

    const structuredModel = model.withStructuredOutput(IntentSchema);

    return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
        const userInput = state.userInput;

        if (!userInput || userInput.trim() === "") {
            return {
                intent: null,
                errors: ["No user input provided"],
                currentStep: "error",
            };
        }

        try {
            const result = await structuredModel.invoke(
                INTENT_PROMPT.replace("{input}", userInput)
            );

            const intent: TransactionIntent = {
                ...result,
                rawInput: userInput,
            };

            // Validate intent
            const validationErrors = validateIntent(intent);
            if (validationErrors.length > 0) {
                return {
                    intent,
                    errors: validationErrors,
                    messages: [`⚠️ Intent parsed with warnings: ${validationErrors.join(", ")}`],
                    currentStep: "validation_needed",
                };
            }

            return {
                intent,
                messages: [`✅ Intent parsed: ${intent.type} ${intent.amount || ""} ${intent.isPrivate ? "(private)" : ""}`],
                currentStep: "intent_parsed",
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return {
                intent: null,
                errors: [`Intent parsing failed: ${errorMessage}`],
                currentStep: "error",
            };
        }
    };
}

/**
 * Validate the parsed intent
 */
function validateIntent(intent: TransactionIntent): string[] {
    const errors: string[] = [];

    // Check for missing required fields based on intent type
    switch (intent.type) {
        case "deposit":
            if (!intent.amount) {
                errors.push("Deposit amount not specified");
            }
            break;

        case "withdraw":
            if (!intent.amount) {
                errors.push("Withdrawal amount not specified");
            }
            if (!intent.recipient) {
                // For withdrawals, recipient might be the user's own address
                errors.push("Withdrawal recipient not specified (will use sender address)");
            }
            break;

        case "transfer":
            if (!intent.amount) {
                errors.push("Transfer amount not specified");
            }
            if (!intent.recipient) {
                errors.push("Transfer recipient required");
            }
            break;

        case "bridge":
            if (!intent.sourceChain || !intent.destinationChain) {
                errors.push("Bridge requires both source and destination chains");
            }
            if (intent.sourceChain === intent.destinationChain) {
                errors.push("Source and destination chains cannot be the same");
            }
            if (!intent.amount) {
                errors.push("Bridge amount not specified");
            }
            break;
    }

    return errors;
}

/**
 * Create a simple rule-based intent parser (fallback without LLM)
 */
export function createSimpleIntentParser() {
    return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
        const input = state.userInput.toLowerCase();

        let intent: TransactionIntent = {
            type: "transfer",
            isPrivate: true,
            rawInput: state.userInput,
        };

        // Detect transaction type
        if (input.includes("deposit") || input.includes("shield")) {
            intent.type = "deposit";
        } else if (input.includes("withdraw") || input.includes("unshield")) {
            intent.type = "withdraw";
        } else if (input.includes("bridge") || input.includes("cross-chain")) {
            intent.type = "bridge";
        } else if (input.includes("send") || input.includes("transfer")) {
            intent.type = "transfer";
        }

        // Detect chains
        if (input.includes("ethereum") || input.includes("eth")) {
            intent.sourceChain = intent.sourceChain || "ethereum";
        }
        if (input.includes("solana") || input.includes("sol")) {
            intent.sourceChain = intent.sourceChain || "solana";
        }
        if (input.includes("rootstock") || input.includes("rsk") || input.includes("bitcoin") || input.includes("btc")) {
            intent.sourceChain = intent.sourceChain || "rootstock";
        }

        // Extract amount (simple regex)
        const amountMatch = input.match(/(\d+\.?\d*)\s*(eth|sol|rbtc|avax)?/i);
        if (amountMatch) {
            intent.amount = amountMatch[1];
        }

        // Extract address (0x... or base58 for Solana)
        const ethAddressMatch = input.match(/0x[a-fA-F0-9]{40}/);
        const solAddressMatch = input.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        if (ethAddressMatch) {
            intent.recipient = ethAddressMatch[0];
        } else if (solAddressMatch) {
            intent.recipient = solAddressMatch[0];
        }

        return {
            intent,
            messages: [`📝 Parsed intent (rule-based): ${intent.type}`],
            currentStep: "intent_parsed",
        };
    };
}
