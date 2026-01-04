import { ethers } from 'ethers';
import { ChainId } from '../../types/chains';
import { RelayMessage, RelayResult } from '../../types/message';
import { getChainConfig } from '../../config/chains';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Gateway contract ABI - executeMessage function
 */
const GATEWAY_ABI = [
  'function executeMessage(uint32 srcChainId, bytes sender, bytes receiver, uint64 messageNonce, bytes payload, bytes relayerSignature) external',
  'function sendMessage(uint32 dstChainId, bytes receiver, bytes payload) external payable returns (bytes32 messageId)',
  'event MessageSent(bytes32 indexed messageId, uint32 dstChainId, bytes receiver, bytes sender, uint64 nonce, bytes payload)',
];

/**
 * Ethereum Sepolia message executor
 * Executes messages on Sepolia gateway contract
 */
export class SepoliaExecutor {
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;
  private readonly GATEWAY_ADDRESS: string;
  private readonly SEPOLIA_CHAIN_ID = 11155111;

  constructor() {
    this.GATEWAY_ADDRESS = env.ETHEREUM_SEPOLIA_GATEWAY || '0xe6F75A8E2d21EeFD33A5ecA76215bB20DbE0bb1F';
  }

  /**
   * Initialize executor
   */
  async initialize(): Promise<void> {
    try {
      const config = getChainConfig(ChainId.ETHEREUM_SEPOLIA);
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

      if (config.privateKey) {
        this.signer = new ethers.Wallet(config.privateKey, this.provider);
        const signerAddress = await this.signer.getAddress();
        
        // Verify relayer address matches contract
        const contract = new ethers.Contract(
          this.GATEWAY_ADDRESS,
          ['function relayer() external view returns (address)'],
          this.provider
        );
        
        try {
          const contractRelayer = await contract.relayer();
          const isMatch = contractRelayer.toLowerCase() === signerAddress.toLowerCase();
          
          if (!isMatch) {
            logger.error(
              {
                signerAddress,
                contractRelayer,
                gatewayAddress: this.GATEWAY_ADDRESS,
              },
              '❌ CRITICAL: Relayer address does not match contract relayer address!'
            );
            logger.error(
              {
                signerAddress,
                contractRelayer,
              },
              'The signer address must match the contract\'s relayer address for signature verification to work!'
            );
          } else {
            logger.info(
              {
                signerAddress,
                contractRelayer,
              },
              '✅ Relayer address matches contract'
            );
          }
          
          // Also check if chain is supported
          const isChainSupported = await contract.supportedChains(3); // Casper chain ID
          logger.info(
            {
              chainId: 3,
              isSupported: isChainSupported,
            },
            isChainSupported ? '✅ Chain 3 (Casper) is supported' : '❌ Chain 3 (Casper) is NOT supported'
          );
        } catch (error) {
          logger.warn({ error }, 'Could not verify relayer address from contract');
        }
        
        logger.info(
          { 
            address: signerAddress,
            gatewayAddress: this.GATEWAY_ADDRESS,
          },
          'Ethereum Sepolia executor initialized'
        );
      } else {
        throw new Error('No private key configured for Ethereum Sepolia executor');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Ethereum Sepolia executor');
      throw error;
    }
  }

  /**
   * Sign message for relayer signature
   * The contract expects a signature over the message hash
   * Based on MessageHash.sol: keccak256(abi.encode(srcChainId, dstChainId, srcGateway, keccak256(receiver), nonce, keccak256(payload)))
   * 
   * The contract's SignatureVerifier.verify does:
   *   bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageId));
   *   address recovered = ecrecover(ethHash, v, r, s);
   * 
   * So we need to sign the raw messageId (messageHash), and the contract will add the EIP-191 prefix.
   * We should NOT use signMessage() as it adds the prefix itself.
   */
  private async signMessageForRelayer(
    srcChainId: number,
    dstChainId: number,
    sender: string,
    receiver: string,
    nonce: number,
    payload: string
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not initialized');
    }

    // Build message hash (same as contract's MessageHash.compute)
    // The contract uses: keccak256(abi.encode(srcChainId, dstChainId, srcGateway, keccak256(receiver), nonce, keccak256(payload)))
    // 
    // IMPORTANT: The contract uses abi.encode, NOT abi.encodePacked
    // This means:
    // - uint32 is padded to 32 bytes
    // - bytes has a length prefix
    // - bytes32 is 32 bytes
    // - uint64 is padded to 32 bytes
    
    const receiverHash = ethers.keccak256(receiver);
    const payloadHash = ethers.keccak256(payload);
    
    logger.debug(
      {
        srcChainId,
        dstChainId,
        senderLength: ethers.getBytes(sender).length,
        receiverLength: ethers.getBytes(receiver).length,
        receiverHash,
        nonce,
        payloadLength: ethers.getBytes(payload).length,
        payloadHash,
      },
      'Computing message hash components'
    );
    
    // Use abi.encode (not abi.encodePacked) - this adds padding and length prefixes
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint32', 'uint32', 'bytes', 'bytes32', 'uint64', 'bytes32'],
      [srcChainId, dstChainId, sender, receiverHash, nonce, payloadHash]
    );
    
    const messageId = ethers.keccak256(encoded);
    
    logger.debug(
      {
        encodedLength: ethers.getBytes(encoded).length,
        messageId,
        encodedHex: encoded.substring(0, 100) + '...',
      },
      'Computed message hash'
    );

    logger.debug(
      {
        messageId,
        srcChainId,
        dstChainId,
        senderLength: ethers.getBytes(sender).length,
        receiverLength: ethers.getBytes(receiver).length,
        nonce,
        payloadLength: ethers.getBytes(payload).length,
      },
      'Computed message hash for signing'
    );

    // Sign the message hash that the contract will verify
    // The contract's SignatureVerifier.verify does:
    //   bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageId));
    //   address recovered = ecrecover(ethHash, v, r, s);
    // 
    // So we need to:
    // 1. Take messageId (32 bytes)
    // 2. Prepend "\x19Ethereum Signed Message:\n32" (note: "32" is the string "32", not the length)
    // 3. Hash it: keccak256(prefix + messageId)
    // 4. Sign that hash
    // 5. Contract will recover from the same hash
    
    const messageIdBytes = ethers.getBytes(messageId);
    
    // Verify the messageId is 32 bytes
    if (messageIdBytes.length !== 32) {
      throw new Error(`MessageId must be 32 bytes, got ${messageIdBytes.length}`);
    }
    
    // Create the hash that the contract will use (same as contract's SignatureVerifier)
    const prefix = '\x19Ethereum Signed Message:\n32';
    const prefixBytes = new Uint8Array(prefix.length);
    for (let i = 0; i < prefix.length; i++) {
      prefixBytes[i] = prefix.charCodeAt(i);
    }
    
    // Concatenate prefix + messageId (abi.encodePacked style - direct concatenation)
    const ethHashInput = ethers.concat([prefixBytes, messageIdBytes]);
    const ethHash = ethers.keccak256(ethHashInput);
    
    // Sign the ethHash (this is what ecrecover will verify)
    const signature = this.signer.signingKey.sign(ethers.getBytes(ethHash));
    
    // Convert to 65-byte format: r (32) + s (32) + v (1)
    // v must be 27 or 28 for ecrecover
    let v = signature.v;
    if (v < 27) {
      v += 27;
    }
    // Ensure v is 27 or 28
    if (v !== 27 && v !== 28) {
      throw new Error(`Invalid v value: ${v}, must be 27 or 28`);
    }
    
    const sigBytes = ethers.concat([
      signature.r,
      signature.s,
      ethers.toBeArray(v)
    ]);
    
    // Verify signature can be recovered (same way contract does it)
    const recoveredAddress = ethers.recoverAddress(ethHash, {
      r: signature.r,
      s: signature.s,
      v: v
    });
    
    logger.debug(
      {
        messageId,
        messageIdHex: ethers.hexlify(messageIdBytes),
        prefix,
        ethHashInputLength: ethHashInput.length,
        ethHash,
        signature: ethers.hexlify(sigBytes),
        r: signature.r,
        s: signature.s,
        v,
        signerAddress: this.signer.address,
        recoveredAddress,
        signatureValid: recoveredAddress.toLowerCase() === this.signer.address.toLowerCase(),
      },
      'Generated and verified relayer signature'
    );
    
    if (recoveredAddress.toLowerCase() !== this.signer.address.toLowerCase()) {
      logger.error(
        {
          expected: this.signer.address,
          recovered: recoveredAddress,
          messageId,
          ethHash,
          v,
          prefix,
        },
        '❌ Signature recovery failed - signature will not be accepted by contract!'
      );
      throw new Error(`Signature recovery failed: expected ${this.signer.address}, got ${recoveredAddress}. The contract's relayer address must match the signer address.`);
    }
    
    return ethers.hexlify(sigBytes);
  }

  /**
   * Execute message on Sepolia gateway contract
   */
  async executeMessage(message: RelayMessage): Promise<RelayResult> {
    if (!this.provider || !this.signer) {
      await this.initialize();
    }

    if (!this.signer) {
      throw new Error('Ethereum Sepolia executor not properly initialized');
    }

    try {
      // Parse source chain ID
      const srcChainId = message.sourceChain === ChainId.ETHEREUM_SEPOLIA ? 11155111 :
                        message.sourceChain === ChainId.CASPER_TESTNET ? 3 :
                        parseInt(message.sourceChain.replace('chain-', '')) || 0;

      // Parse sender (source gateway)
      // For EVM, sender is an address (20 bytes) or bytes
      let sender: string;
      if (message.sourceGateway.startsWith('0x')) {
        // Already an address
        sender = message.sourceGateway;
      } else if (message.sourceGateway.startsWith('hash-')) {
        // Casper contract hash - extract bytes
        const senderHex = message.sourceGateway.replace('hash-', '');
        sender = ethers.hexlify(Buffer.from(senderHex, 'hex'));
      } else {
        sender = ethers.hexlify(Buffer.from(message.sourceGateway, 'hex'));
      }

      // Parse receiver
      // The contract expects: bytes calldata receiver, then does abi.decode(receiver, (address))
      // So receiver must be ABI-encoded as address (32 bytes: 12 bytes padding + 20 bytes address)
      // 
      // From Casper message, receiver is stored as 32 bytes
      // Format: 20 bytes address + 12 bytes padding (zeros)
      // Example: d3b1c72361f03d5f138c2c768afdf700266bb39a000000000000000000000000
      //          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ address (20 bytes)
      //                                                  ^^^^^^^^^^^^^^^^^^^^ padding (12 bytes)
      
      let receiverAddress: string;
      if (message.destinationGateway.startsWith('0x')) {
        // Already an address
        receiverAddress = ethers.getAddress(message.destinationGateway);
      } else if (message.destinationGateway.startsWith('hash-')) {
        // Casper contract hash format - extract the 20-byte address
        const receiverHex = message.destinationGateway.replace('hash-', '');
        const receiverBytes = Buffer.from(receiverHex, 'hex');
        
        logger.debug(
          {
            destinationGateway: message.destinationGateway,
            receiverHex,
            receiverBytesLength: receiverBytes.length,
            receiverBytesHex: receiverBytes.toString('hex'),
            first20Bytes: receiverBytes.slice(0, 20).toString('hex'),
            last12Bytes: receiverBytes.length >= 32 ? receiverBytes.slice(20, 32).toString('hex') : 'N/A',
          },
          'Extracting receiver address from Casper format'
        );
        
        if (receiverBytes.length === 32) {
          // Check if last 12 bytes are zeros (address at start, padding at end)
          const last12Bytes = receiverBytes.slice(20, 32);
          const first12Bytes = receiverBytes.slice(0, 12);
          
          if (last12Bytes.every(b => b === 0)) {
            // Address is at bytes 0-20 (standard format: address + padding)
            receiverAddress = ethers.getAddress(ethers.hexlify(receiverBytes.slice(0, 20)));
            logger.debug(
              { 
                format: 'address_at_start',
                extractedAddress: receiverAddress,
                first20Hex: receiverBytes.slice(0, 20).toString('hex'),
              },
              'Extracted address from start (address + padding format)'
            );
          } else if (first12Bytes.every(b => b === 0)) {
            // Address is at bytes 12-32 (ABI-encoded format: padding + address)
            receiverAddress = ethers.getAddress(ethers.hexlify(receiverBytes.slice(12, 32)));
            logger.debug(
              { 
                format: 'address_at_end',
                extractedAddress: receiverAddress,
                last20Hex: receiverBytes.slice(12, 32).toString('hex'),
              },
              'Extracted address from end (padding + address format)'
            );
          } else if (receiverBytes[0] === 0x17 && receiverBytes[1] === 0x5f && receiverBytes[2] === 0xc9 && receiverBytes[3] === 0xfe) {
            // Has 4-byte prefix (0x175fc9fe), address is at bytes 4-24
            receiverAddress = ethers.getAddress(ethers.hexlify(receiverBytes.slice(4, 24)));
            logger.debug(
              { 
                format: 'address_with_prefix',
                extractedAddress: receiverAddress,
                addressHex: receiverBytes.slice(4, 24).toString('hex'),
              },
              'Extracted address with 4-byte prefix'
            );
          } else {
            // Default: take first 20 bytes (most common format)
            receiverAddress = ethers.getAddress(ethers.hexlify(receiverBytes.slice(0, 20)));
            logger.warn(
              { 
                format: 'default_first_20',
                extractedAddress: receiverAddress,
                receiverBytesHex: receiverBytes.toString('hex'),
              },
              '⚠️  Using default extraction (first 20 bytes) - verify this is correct!'
            );
          }
        } else if (receiverBytes.length === 20) {
          receiverAddress = ethers.getAddress(ethers.hexlify(receiverBytes));
          logger.debug(
            { extractedAddress: receiverAddress },
            'Receiver is already 20 bytes (address)'
          );
        } else if (receiverBytes.length > 20) {
          // Take first 20 bytes
          receiverAddress = ethers.getAddress(ethers.hexlify(receiverBytes.slice(0, 20)));
          logger.warn(
            { 
              extractedAddress: receiverAddress,
              receiverBytesLength: receiverBytes.length,
            },
            '⚠️  Receiver length > 20, taking first 20 bytes'
          );
        } else {
          throw new Error(`Invalid receiver length: ${receiverBytes.length} bytes (expected 20 or 32)`);
        }
      } else {
        const receiverBytes = Buffer.from(message.destinationGateway, 'hex');
        if (receiverBytes.length >= 20) {
          receiverAddress = ethers.getAddress(ethers.hexlify(receiverBytes.slice(0, 20)));
        } else {
          throw new Error(`Invalid receiver format: ${message.destinationGateway}`);
        }
      }
      
      // Validate the extracted address matches expected format
      if (!ethers.isAddress(receiverAddress)) {
        throw new Error(`Invalid receiver address extracted: ${receiverAddress}`);
      }
      
      // ABI-encode the address as bytes (contract expects abi.decode(receiver, (address)))
      // This creates 32 bytes: 12 bytes padding (zeros) + 20 bytes address
      // Format: 0x000000000000000000000000<20-byte-address>
      const receiver = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [receiverAddress]);
      
      // Verify the encoding is correct (should be 32 bytes with address at end)
      const encodedBytes = ethers.getBytes(receiver);
      if (encodedBytes.length !== 32) {
        throw new Error(`ABI-encoded receiver should be 32 bytes, got ${encodedBytes.length}`);
      }
      
      // Verify first 12 bytes are zeros
      const padding = encodedBytes.slice(0, 12);
      if (!padding.every(b => b === 0)) {
        throw new Error(`ABI-encoded receiver padding should be zeros, got ${ethers.hexlify(padding)}`);
      }
      
      // Verify last 20 bytes match the address
      const encodedAddress = ethers.getAddress(ethers.hexlify(encodedBytes.slice(12, 32)));
      if (encodedAddress.toLowerCase() !== receiverAddress.toLowerCase()) {
        throw new Error(`ABI-encoded address mismatch: expected ${receiverAddress}, got ${encodedAddress}`);
      }
      
      logger.info(
        {
          destinationGateway: message.destinationGateway,
          extractedAddress: receiverAddress,
          abiEncodedReceiver: receiver,
          receiverLength: ethers.getBytes(receiver).length,
          padding: ethers.hexlify(ethers.getBytes(receiver).slice(0, 12)),
          addressInEncoded: ethers.hexlify(ethers.getBytes(receiver).slice(12, 32)),
        },
        '✅ Receiver address extraction and encoding complete'
      );

      // Parse payload - convert from ASCII string to number, then encode as 32-byte uint256
      // Example: 0x31 (ASCII '1' = 49) → "1" (string) → 1 (number) → 0x0000000000000000000000000000000000000000000000000000000000000001
      const rawPayload = '0x' + message.payload;
      const rawPayloadBytes = ethers.getBytes(rawPayload);
      
      // Convert bytes to string (UTF-8)
      const payloadString = Buffer.from(rawPayloadBytes).toString('utf8');
      
      // Parse string as number (handles integers and decimals)
      let payload: string;
      let payloadNumber: bigint;
      
      try {
        // Try parsing as integer first
        const parsedInt = parseInt(payloadString.trim(), 10);
        if (isNaN(parsedInt)) {
          throw new Error(`Cannot parse payload as number: ${payloadString}`);
        }
        payloadNumber = BigInt(parsedInt);
        
        // Encode number as 32-byte uint256 (right-padded with zeros)
        // Format: 0x0000000000000000000000000000000000000000000000000000000000000001
        payload = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [payloadNumber]);
      } catch (error) {
        logger.warn(
          { payloadString, rawPayload, error },
          'Failed to parse payload as number, using raw bytes (padded to 32 bytes)'
        );
        // Fallback: use raw bytes if parsing fails, pad to 32 bytes
        const payloadBytes = new Uint8Array(32);
        if (rawPayloadBytes.length <= 32) {
          payloadBytes.set(rawPayloadBytes, 32 - rawPayloadBytes.length);
        } else {
          // If payload is longer than 32 bytes, truncate or use first 32 bytes
          payloadBytes.set(rawPayloadBytes.slice(0, 32));
        }
        payload = ethers.hexlify(payloadBytes);
        payloadNumber = BigInt(0); // Set to 0 for logging
      }
      
      logger.info(
        {
          messageId: message.messageId,
          srcChainId,
          srcChainIdHex: `0x${srcChainId.toString(16).padStart(8, '0')}`,
          sender: sender,
          senderLength: ethers.getBytes(sender).length,
          receiverAddress,
          receiver: receiver,
          receiverLength: ethers.getBytes(receiver).length,
          nonce: message.nonce,
          nonceHex: `0x${message.nonce.toString(16)}`,
          rawPayload: rawPayload,
          rawPayloadLength: rawPayloadBytes.length,
          payloadString: payloadString,
          payloadNumber: payloadNumber ? payloadNumber.toString() : 'N/A (using raw bytes)',
          payload: payload,
          payloadLength: ethers.getBytes(payload).length,
          payloadAsString: payloadString,
          payloadHex: payload,
        },
        '📤 All inputs being sent to Sepolia executeMessage'
      );

      // Sign message for relayer signature
      // IMPORTANT: Use the same padded payload format for signing as we use for the contract call
      // This ensures the message hash matches what the contract computes
      const relayerSignature = await this.signMessageForRelayer(
        srcChainId,
        this.SEPOLIA_CHAIN_ID,
        sender,
        receiver,
        message.nonce,
        payload  // Use the padded 32-byte payload
      );

      logger.info(
        {
          relayerSignature: relayerSignature,
          signatureLength: ethers.getBytes(relayerSignature).length,
          signerAddress: this.signer.address,
        },
        'Generated relayer signature, calling executeMessage'
      );

      // Create contract instance first (needed for encoding calldata)
      const contract = new ethers.Contract(
        this.GATEWAY_ADDRESS,
        GATEWAY_ABI,
        this.signer
      );
      
      // Log complete function call details
      logger.info(
        {
          function: 'executeMessage',
          contractAddress: this.GATEWAY_ADDRESS,
          parameters: {
            srcChainId: srcChainId,
            sender: sender,
            receiver: receiver,
            messageNonce: message.nonce,
            payload: payload,
            relayerSignature: relayerSignature,
          },
          calldata: contract.interface.encodeFunctionData('executeMessage', [
            srcChainId,
            sender,
            receiver,
            message.nonce,
            payload,
            relayerSignature,
          ]),
        },
        '🔧 Complete executeMessage call details for Sepolia'
      );

      // Try to simulate the transaction first to get revert reason
      try {
        await contract.executeMessage.staticCall(
          srcChainId,
          sender,
          receiver,
          message.nonce,
          payload,
          relayerSignature
        );
        logger.info('✅ Transaction simulation successful');
      } catch (simError: any) {
        // Try to decode the revert reason
        let revertReason = 'Unknown error';
        const errorData = simError.data || simError.error?.data;
        
        if (errorData && errorData !== '0x') {
          // Try to decode error selector
          const errorSelectors: Record<string, string> = {
            '0x82b42900': 'AlreadyExecuted',
            '0x4e487b71': 'InsufficientFee', 
            '0x8baa579f': 'InvalidSignature',
            '0xfe0d94c1': 'UnsupportedChain',
          };
          
          const selector = errorData.substring(0, 10);
          if (errorSelectors[selector]) {
            revertReason = errorSelectors[selector];
          }
        } else if (simError.reason) {
          revertReason = simError.reason;
        }
        
        logger.error(
          {
            error: simError.message || simError,
            reason: revertReason,
            data: errorData,
            code: simError.code,
          },
          `⚠️  Transaction simulation failed: ${revertReason}`
        );
        
        // If it's a clear error, throw it instead of continuing
        if (revertReason !== 'Unknown error' && revertReason !== 'require(false)') {
          throw new Error(`Transaction will fail: ${revertReason}`);
        }
      }

      // Call executeMessage with proper types
      const tx = await contract.executeMessage(
        srcChainId,
        sender,
        receiver,
        message.nonce,
        payload,
        relayerSignature,
        { gasLimit: 500000 }
      );

      logger.info({ transactionHash: tx.hash }, 'Transaction sent, waiting for confirmation...');

      // Wait for transaction
      let receipt;
      try {
        receipt = await tx.wait();
      } catch (waitError: any) {
        // Try to get revert reason from the error
        if (waitError.receipt) {
          receipt = waitError.receipt;
        } else {
          throw waitError;
        }
      }

      if (receipt.status === 1) {
        logger.info(
          {
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
          },
          '✅ Message executed successfully on Sepolia!'
        );

        return {
          success: true,
          messageId: message.messageId,
          transactionHash: receipt.hash,
          timestamp: new Date(),
        };
      } else {
        // Transaction reverted - try to decode the revert reason
        let revertReason = 'Transaction reverted';
        
        try {
          // Try to call the contract to get revert reason
          const code = await this.provider!.getCode(this.GATEWAY_ADDRESS);
          if (code && code !== '0x') {
            // Try to decode using common error selectors
            const errorSelectors = {
              '0x82b42900': 'AlreadyExecuted',
              '0x4e487b71': 'InsufficientFee',
              '0x8baa579f': 'InvalidSignature',
              '0xfe0d94c1': 'UnsupportedChain',
            };
            
            // Check transaction input data for error selector
            const txData = await this.provider!.getTransaction(tx.hash);
            if (txData && txData.data) {
              const selector = txData.data.substring(0, 10);
              if (errorSelectors[selector as keyof typeof errorSelectors]) {
                revertReason = errorSelectors[selector as keyof typeof errorSelectors];
              }
            }
          }
        } catch (decodeError) {
          logger.debug({ decodeError }, 'Could not decode revert reason');
        }
        
        throw new Error(revertReason);
      }
    } catch (error: any) {
      // Try to extract more detailed error information
      let errorMessage = error.message || String(error);
      let errorData = null;
      
      if (error.data) {
        errorData = error.data;
      } else if (error.reason) {
        errorMessage = error.reason;
      } else if (error.error?.message) {
        errorMessage = error.error.message;
        errorData = error.error.data;
      }
      
      // Check if it's a revert with reason
      if (error.receipt && error.receipt.status === 0) {
        // Transaction was sent but reverted
        logger.error(
          {
            messageId: message.messageId,
            transactionHash: error.receipt?.hash || error.transaction?.hash,
            gasUsed: error.receipt?.gasUsed?.toString(),
            errorMessage,
            errorData,
            errorCode: error.code,
          },
          'Transaction reverted on Sepolia'
        );
      } else {
        logger.error(
          {
            messageId: message.messageId,
            error: errorMessage,
            errorData,
            errorCode: error.code,
            fullError: error,
          },
          'Failed to execute message on Sepolia'
        );
      }
      
      return {
        success: false,
        messageId: message.messageId,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }
}
