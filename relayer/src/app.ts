import { EventEmitter } from 'events';
import { connectMongo } from './config/mongo';
import { logger } from './utils/logger';
import { RelayExecutor } from './relayer/relay.executor';
import { RelayMessage } from './types/message';
import { SepoliaListener } from './chains/evm/sepolia.listener';
import { CasperListener } from './chains/casper/casper.listener';

/**
 * Main application class
 */
export class App extends EventEmitter {
  private relayExecutor: RelayExecutor;
  private sepoliaListener: SepoliaListener;
  private casperListener: CasperListener;
  private isRunning = false;

  constructor() {
    super();
    this.relayExecutor = new RelayExecutor();
    this.sepoliaListener = new SepoliaListener();
    this.casperListener = new CasperListener();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing relayer server...');

      // Connect to MongoDB
      await connectMongo();

      // Initialize relay executor
      await this.relayExecutor.initialize();

      // Initialize chain listeners
      await Promise.all([
        this.sepoliaListener.initialize(),
        this.casperListener.initialize(),
      ]);

      // Set up message handlers
      this.setupMessageHandlers();

      logger.info('✅ Relayer server initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize relayer server');
      throw error;
    }
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Relayer server is already running');
      return;
    }

    try {
      logger.info('Starting relayer server...');

      // Start all chain listeners
      await Promise.all([
        this.sepoliaListener.startListening(),
        this.casperListener.startListening(),
      ]);

      this.isRunning = true;
      logger.info('✅ Relayer server started successfully');
      this.emit('started');
    } catch (error) {
      logger.error({ error }, 'Failed to start relayer server');
      throw error;
    }
  }

  /**
   * Stop the application
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('Stopping relayer server...');

      // Stop all chain listeners
      await Promise.all([
        this.sepoliaListener.stopListening(),
        this.casperListener.stopListening(),
      ]);

      this.isRunning = false;
      logger.info('Relayer server stopped');
      this.emit('stopped');
    } catch (error) {
      logger.error({ error }, 'Error stopping relayer server');
      throw error;
    }
  }

  /**
   * Set up message handlers for chain listeners
   */
  private setupMessageHandlers(): void {
    // Handle messages from Ethereum Sepolia
    this.sepoliaListener.on('message', (message: RelayMessage) => {
      this.handleIncomingMessage(message);
    });

    // Handle messages from Casper Testnet
    this.casperListener.on('message', (message: RelayMessage) => {
      this.handleIncomingMessage(message);
    });
  }

  /**
   * Handle incoming message from any chain
   */
  private async handleIncomingMessage(message: RelayMessage): Promise<void> {
    try {
      logger.info(
        {
          messageId: message.messageId,
          sourceChain: message.sourceChain,
          destinationChain: message.destinationChain,
        },
        'Received message from source chain'
      );

      // Execute relay
      const result = await this.relayExecutor.execute(message);

      if (result.success) {
        logger.info(
          { messageId: message.messageId, txHash: result.transactionHash },
          'Message relayed successfully'
        );
      } else {
        logger.error(
          { messageId: message.messageId, error: result.error },
          'Message relay failed'
        );
      }

      this.emit('messageRelayed', { message, result });
    } catch (error) {
      logger.error(
        { error, messageId: message.messageId },
        'Error handling incoming message'
      );
      this.emit('messageError', { message, error });
    }
  }

  /**
   * Check if app is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}
