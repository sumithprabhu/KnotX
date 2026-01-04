import { ethers } from 'ethers';
import { ChainId } from '../types/chains';
import { getChainConfig } from '../config/chains';
import { env } from '../config/env';
import { logger } from './logger';
import { Message } from '../db/models/Message';
import { ChainState } from '../db/models/ChainState';

/**
 * Gateway contract ABI
 */
const GATEWAY_ABI = [
  'event MessageSent(bytes32 indexed messageId, uint32 dstChainId, bytes receiver, bytes sender, uint64 nonce, bytes payload)',
];

/**
 * Check if all events are processed and verify message tracking
 */
export async function checkEventProcessingStatus(): Promise<void> {
  try {
    logger.info('🔍 Checking event processing status...');

    const config = getChainConfig(ChainId.ETHEREUM_SEPOLIA);
    const gatewayAddress = env.ETHEREUM_SEPOLIA_GATEWAY || '0xD3B1c72361f03d5F138C2c768AfdF700266bb39a';
    
    // Use HTTP provider for checking (more reliable for queries)
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const contract = new ethers.Contract(gatewayAddress, GATEWAY_ABI, provider);

    // Get current block and last processed block
    const currentBlock = await provider.getBlockNumber();
    const chainState = await ChainState.findOne({ chainId: ChainId.ETHEREUM_SEPOLIA });
    const lastProcessedBlock = chainState?.lastProcessedBlock || 0;

    logger.info(
      { currentBlock, lastProcessedBlock, blocksBehind: currentBlock - lastProcessedBlock },
      'Block status'
    );

    // Query all MessageSent events from last processed block
    const filter = contract.filters.MessageSent();
    const events = await contract.queryFilter(filter, lastProcessedBlock + 1, currentBlock);

    logger.info(
      { eventCount: events.length, fromBlock: lastProcessedBlock + 1, toBlock: currentBlock },
      'Found events in range'
    );

    // Check which events are in database
    let processedCount = 0;
    let missingCount = 0;
    const missingEvents: any[] = [];

    for (const event of events) {
      if ('args' in event && event.args) {
        const args = event.args as any;
        const messageId = args[0] as string;
        const nonce = Number(args[4] as bigint);
        const payload = args[5] as string;
        
        // Create hash to check
        const payloadBytes = ethers.getBytes(payload);
        const crypto = await import('crypto');
        const payloadHash = crypto.createHash('sha256').update(payloadBytes).digest('hex');
        
        // Check if message exists in DB
        const dbMessage = await Message.findOne({
          $or: [
            { payloadHash, sourceChain: ChainId.ETHEREUM_SEPOLIA, nonce },
            { sourceGateway: gatewayAddress, nonce, sourceChain: ChainId.ETHEREUM_SEPOLIA },
          ],
        });

        if (dbMessage) {
          processedCount++;
          logger.debug(
            {
              messageId,
              nonce,
              status: dbMessage.status,
              txHash: dbMessage.transactionHash,
            },
            'Event already processed'
          );
        } else {
          missingCount++;
          missingEvents.push({
            messageId,
            nonce,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            dstChainId: Number(args[1]),
          });
          logger.warn(
            {
              messageId,
              nonce,
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
            },
            '⚠️  Event not found in database'
          );
        }
      }
    }

    // Summary
    logger.info(
      {
        totalEvents: events.length,
        processedCount,
        missingCount,
        lastProcessedBlock,
        currentBlock,
      },
      '📊 Event processing status summary'
    );

    if (missingCount > 0) {
      logger.warn(
        { missingEvents: missingEvents.slice(0, 10) }, // Show first 10
        '⚠️  Some events are not processed. Consider reprocessing.'
      );
    } else if (events.length > 0) {
      logger.info('✅ All events are processed');
    }

    // Check messages in DB
    const dbMessages = await Message.find({
      sourceChain: ChainId.ETHEREUM_SEPOLIA,
    }).sort({ createdAt: -1 }).limit(10);

    logger.info(
      {
        totalMessagesInDB: await Message.countDocuments({ sourceChain: ChainId.ETHEREUM_SEPOLIA }),
        recentMessages: dbMessages.map(m => ({
          messageId: m.messageId,
          nonce: m.nonce,
          status: m.status,
          destinationChain: m.destinationChain,
          createdAt: m.createdAt,
        })),
      },
      '📋 Recent messages in database'
    );

  } catch (error) {
    logger.error({ error }, 'Error checking event processing status');
    throw error;
  }
}
