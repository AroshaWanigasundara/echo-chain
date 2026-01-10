import PubNub from 'pubnub';

let pubnubInstance: PubNub | null = null;
let messageListeners: ((message: PubNubMessage) => void)[] = [];
let statusListeners: ((connected: boolean) => void)[] = [];
let isConnected = false;

export interface PubNubMessage {
  messageId: string;
  conversationId: string;
  sender: string;
  recipient: string;
  encryptedData: number[];
  nonce: number[];
  messageHash: string;
  blockNumber: number;
  timestamp: number;
}

export function initializePubNub(userAddress: string): PubNub {
  if (pubnubInstance) {
    console.log('PubNub already initialized');
    return pubnubInstance;
  }

  pubnubInstance = new PubNub({
    publishKey: 'YOUR_PUBLISH_KEY_HERE',
    subscribeKey: 'YOUR_SUBSCRIBE_KEY_HERE',
    userId: userAddress,
    restore: true,
    heartbeatInterval: 30
  });

  console.log('✓ PubNub initialized for', userAddress);
  return pubnubInstance;
}

export function getPubNubInstance(): PubNub | null {
  return pubnubInstance;
}

export function isPubNubConnected(): boolean {
  return isConnected;
}

export function cleanupPubNub(): void {
  if (pubnubInstance) {
    pubnubInstance.unsubscribeAll();
    pubnubInstance.removeAllListeners();
    pubnubInstance = null;
    isConnected = false;
    messageListeners = [];
    statusListeners = [];
    console.log('✓ PubNub cleaned up');
  }
}

export function subscribeToInbox(userAddress: string, messageHandler: (message: PubNubMessage) => void): void {
  if (!pubnubInstance) {
    console.error('PubNub not initialized');
    return;
  }

  const inboxChannel = `inbox-${userAddress}`;
  
  // Store the handler
  messageListeners.push(messageHandler);

  pubnubInstance.addListener({
    message: (event) => {
      if (event.channel === inboxChannel) {
        console.log('📨 PubNub message received:', event.message);
        // Cast the message to our type
        const msg = event.message as unknown as PubNubMessage;
        messageListeners.forEach(handler => handler(msg));
      }
    },
    status: (statusEvent) => {
      if (statusEvent.category === 'PNConnectedCategory') {
        console.log('✓ PubNub connected to channel:', inboxChannel);
        isConnected = true;
        statusListeners.forEach(handler => handler(true));
      } else if (statusEvent.category === 'PNNetworkDownCategory' || 
                 statusEvent.category === 'PNNetworkIssuesCategory') {
        console.log('⚠ PubNub connection issue');
        isConnected = false;
        statusListeners.forEach(handler => handler(false));
      } else if (statusEvent.category === 'PNReconnectedCategory') {
        console.log('✓ PubNub reconnected');
        isConnected = true;
        statusListeners.forEach(handler => handler(true));
      }
    }
  });

  pubnubInstance.subscribe({ channels: [inboxChannel] });
  console.log('✓ Subscribed to:', inboxChannel);
}

export async function publishMessage(recipientAddress: string, messageData: PubNubMessage): Promise<void> {
  if (!pubnubInstance) {
    throw new Error('PubNub not initialized');
  }

  const channel = `inbox-${recipientAddress}`;
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await pubnubInstance.publish({ 
      channel, 
      message: messageData as any
    });
    console.log('✓ Published message to:', channel);
  } catch (error) {
    console.error('Failed to publish to PubNub:', error);
    throw error;
  }
}

export function addStatusListener(handler: (connected: boolean) => void): void {
  statusListeners.push(handler);
}

export function removeStatusListener(handler: (connected: boolean) => void): void {
  statusListeners = statusListeners.filter(h => h !== handler);
}
