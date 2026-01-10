import PubNub from 'pubnub';

let pubnubInstance: PubNub | null = null;
let messageListeners: ((message: PubNubMessage) => void)[] = [];
let statusListeners: ((connected: boolean) => void)[] = [];
let isConnected = false;
let currentListener: any = null;

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
    publishKey: 'pub-c-4d5827a5-129f-46a7-afb3-ae1060cc7277',
    subscribeKey: 'sub-c-7781c1a9-a4ba-4f26-8516-c5aca921beb8',
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
    currentListener = null;
    console.log('✓ PubNub cleaned up');
  }
}

export function subscribeToInbox(userAddress: string, messageHandler: (message: PubNubMessage) => void): void {
  if (!pubnubInstance) {
    console.error('PubNub not initialized');
    return;
  }

  const inboxChannel = `inbox-${userAddress}`;
  
  // Remove old listener if it exists
  if (currentListener) {
    pubnubInstance.removeListener(currentListener);
  }
  
  // Clear old handlers
  messageListeners = [];
  statusListeners = [];
  
  // Store the handler
  messageListeners.push(messageHandler);

  currentListener = {
    message: (event: any) => {
      if (event.channel === inboxChannel) {
        console.log('📨 PubNub message received:', event.message);
        // Cast the message to our type
        const msg = event.message as unknown as PubNubMessage;
        messageListeners.forEach(handler => handler(msg));
      }
    },
    status: (statusEvent: any) => {
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
  };

  pubnubInstance.addListener(currentListener);
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
