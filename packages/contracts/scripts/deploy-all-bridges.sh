#!/bin/bash

echo "🚀 Deploying Cash.io Bridge Contracts to All Testnets"
echo "================================================="

# Array of networks to deploy to
networks=(
    "sepolia:Ethereum Sepolia"
    "rskTestnet:RSK Testnet" 
    "arbitrumSepolia:Arbitrum Sepolia"
    "optimismSepolia:Optimism Sepolia"
    "baseSepolia:Base Sepolia"
    "polygonAmoy:Polygon Amoy"
)

failed_deployments=()
successful_deployments=()

for network_info in "${networks[@]}"; do
    network=${network_info%%:*}
    name=${network_info##*:}
    
    echo ""
    echo "🔄 Deploying to $name ($network)..."
    echo "-----------------------------------"
    
    if npm run deploy:bridges:$network; then
        echo "✅ Successfully deployed to $name"
        successful_deployments+=("$name")
        
        # Set up relayers after successful deployment
        echo "🔧 Setting up relayers for $name..."
        if npm run setup:relayers:$network; then
            echo "✅ Relayers configured for $name"
        else
            echo "⚠️  Relayer setup failed for $name (deployment still successful)"
        fi
    else
        echo "❌ Failed to deploy to $name"
        failed_deployments+=("$name")
    fi
done

echo ""
echo "📋 DEPLOYMENT SUMMARY"
echo "===================="

if [ ${#successful_deployments[@]} -gt 0 ]; then
    echo "✅ Successful deployments:"
    for deployment in "${successful_deployments[@]}"; do
        echo "   - $deployment"
    done
fi

if [ ${#failed_deployments[@]} -gt 0 ]; then
    echo "❌ Failed deployments:"
    for deployment in "${failed_deployments[@]}"; do
        echo "   - $deployment"
    done
fi

echo ""
echo "📁 Check deployments/ folder for contract addresses"
echo "💰 Remember to fund the relayer addresses for gas!"
echo ""
echo "🎉 Bridge deployment process completed!"