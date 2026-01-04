/**
 * Debug script to test executeMessage on Sepolia
 * This helps verify the message hash and signature are correct
 */

import { ethers } from 'ethers';
import { getChainConfig } from '../config/chains';
import { ChainId } from '../types/chains';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const GATEWAY_ADDRESS = env.ETHEREUM_SEPOLIA_GATEWAY || '0xe6F75A8E2d21EeFD33A5ecA76215bB20DbE0bb1F';

const GATEWAY_ABI = [
  'function executeMessage(uint32 srcChainId, bytes sender, bytes receiver, uint64 messageNonce, bytes payload, bytes relayerSignature) external',
  'function relayer() external view returns (address)',
  'function supportedChains(uint32) external view returns (bool)',
];

async function main() {
  try {
    const config = getChainConfig(ChainId.ETHEREUM_SEPOLIA);
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    if (!config.privateKey) {
      throw new Error('No private key configured');
    }
    
    const signer = new ethers.Wallet(config.privateKey, provider);
    const contract = new ethers.Contract(GATEWAY_ADDRESS, GATEWAY_ABI, signer);
    
    // Test parameters (from your logs)
    const srcChainId = 3; // Casper
    const sender = '0x' + '4ce6b9ec80fde0158f7ab13f37cff883660048c1d457e9e48130cc884ce83073'.padStart(64, '0');
    const receiverAddress = '0xD3B1c72361f03d5F138C2c768AfdF700266bb39a';
    const receiver = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [receiverAddress]);
    const nonce = 3;
    const payload = '0x31'; // "1"
    
    logger.info(
      {
        srcChainId,
        sender,
        receiverAddress,
        receiver,
        nonce,
        payload,
      },
      'Test parameters'
    );
    
    // Check relayer address
    const contractRelayer = await contract.relayer();
    const signerAddress = await signer.getAddress();
    
    logger.info(
      {
        contractRelayer,
        signerAddress,
        match: contractRelayer.toLowerCase() === signerAddress.toLowerCase(),
      },
      'Relayer address check'
    );
    
    // Check if chain is supported
    const isSupported = await contract.supportedChains(srcChainId);
    logger.info({ srcChainId, isSupported }, 'Chain support check');
    
    // Compute message hash
    const receiverHash = ethers.keccak256(receiver);
    const payloadHash = ethers.keccak256(payload);
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint32', 'uint32', 'bytes', 'bytes32', 'uint64', 'bytes32'],
      [srcChainId, 11155111, sender, receiverHash, nonce, payloadHash]
    );
    const messageId = ethers.keccak256(encoded);
    
    logger.info({ messageId }, 'Computed message ID');
    
    // Sign the message
    const messageIdBytes = ethers.getBytes(messageId);
    const signature = signer.signingKey.sign(messageIdBytes);
    let v = signature.v;
    if (v < 27) {
      v += 27;
    }
    const relayerSignature = ethers.concat([
      signature.r,
      signature.s,
      ethers.toBeArray(v)
    ]);
    
    logger.info(
      {
        messageId,
        signature: ethers.hexlify(relayerSignature),
        r: signature.r,
        s: signature.s,
        v,
      },
      'Generated signature'
    );
    
    // Try to simulate
    try {
      await contract.executeMessage.staticCall(
        srcChainId,
        sender,
        receiver,
        nonce,
        payload,
        relayerSignature
      );
      logger.info('✅ Simulation successful!');
    } catch (simError: any) {
      logger.error(
        {
          error: simError.message,
          reason: simError.reason,
          data: simError.data,
          code: simError.code,
        },
        '❌ Simulation failed'
      );
    }
    
  } catch (error) {
    logger.error({ error }, 'Script failed');
    process.exit(1);
  }
}

main();
