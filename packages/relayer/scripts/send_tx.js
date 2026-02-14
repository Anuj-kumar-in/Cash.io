import 'dotenv/config';
import { Wallet, JsonRpcProvider } from 'ethers';

async function main(){
  const pk = process.env.RELAYER_PRIVATE_KEY || process.env.VITE_DEPLOYER_PRIVATE_KEY;
  if(!pk){
    console.error('No private key found in RELAYER_PRIVATE_KEY or VITE_DEPLOYER_PRIVATE_KEY in packages/relayer/.env');
    process.exit(1);
  }
  const privateKey = pk.startsWith('0x') ? pk : '0x'+pk;
  const rpc = process.env.TESTNET_HUB_RPC_URL || process.env.HUB_RPC_URL;
  if(!rpc){
    console.error('No RPC URL found in TESTNET_HUB_RPC_URL or HUB_RPC_URL in packages/relayer/.env');
    process.exit(1);
  }

  const provider = new JsonRpcProvider(rpc);
  const wallet = new Wallet(privateKey, provider);

  console.log('Using address:', wallet.address);
  console.log('RPC URL:', rpc);

  // Prepare a 0-value tx to self (safe, no funds moved)
  const tx = await wallet.sendTransaction({ to: wallet.address, value: 0n, gasLimit: 21000 });
  console.log('Sent tx hash:', tx.hash);
  console.log('Waiting for receipt...');
  const receipt = await tx.wait(1);
  console.log('Receipt status:', receipt.status);
  console.log('BlockNumber:', receipt.blockNumber);
  console.log('Transaction confirmed.');
}

main().catch((e)=>{ console.error(e); process.exit(1); });
