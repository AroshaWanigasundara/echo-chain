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

export interface DeliveryConfirmation {
  type: "delivery_confirmation";
  messageId: string;
  deliveredTo: string;
  deliveredAt: number;
  originalSender: string;
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
    confirmationHandlers = [];
    inboxHandlers = [];
    subscribedChannels = [];
    currentListener = null;
    console.log('✓ PubNub cleaned up');
  }
}

// Store all channel subscriptions and their handlers
let subscribedChannels: string[] = [];
let inboxHandlers: ((message: PubNubMessage) => void)[] = [];
let confirmationHandlers: ((confirmation: DeliveryConfirmation) => void)[] = [];

export function subscribeToInbox(userAddress: string, messageHandler: (message: PubNubMessage) => void): void {
  if (!pubnubInstance) {
    console.error('PubNub not initialized');
    return;
  }

  const inboxChannel = `inbox-${userAddress}`;
  
  // Add handler
  inboxHandlers.push(messageHandler);
  
  // Subscribe to inbox if not already subscribed
  if (!subscribedChannels.includes(inboxChannel)) {
    subscribedChannels.push(inboxChannel);
    setupUnifiedListener();
    pubnubInstance.subscribe({ channels: [inboxChannel] });
    console.log('✓ Subscribed to:', inboxChannel);
  }
}

function setupUnifiedListener(): void {
  if (!pubnubInstance || currentListener) {
    return;
  }

  currentListener = {
    message: (event: any) => {
      const inboxChannel = event.channel;
      const confirmationChannel = event.channel;
      
      // Handle inbox messages
      if (inboxChannel.startsWith('inbox-')) {
        console.log('📨 PubNub message received:', event.message);
        const msg = event.message as unknown as PubNubMessage;
        inboxHandlers.forEach(handler => handler(msg));
      }
      
      // Handle delivery confirmations
      if (confirmationChannel.startsWith('confirmations-')) {
        console.log('📦 Delivery confirmation received:', event.message);
        const confirmation = event.message as unknown as DeliveryConfirmation;
        confirmationHandlers.forEach(handler => handler(confirmation));
      }
    },
    status: (statusEvent: any) => {
      if (statusEvent.category === 'PNConnectedCategory') {
        console.log('✓ PubNub connected');
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

export async function fetchMessageHistory(userAddress: string): Promise<PubNubMessage[]> {
  if (!pubnubInstance) {
    console.error('PubNub not initialized');
    return [];
  }

  const inboxChannel = `inbox-${userAddress}`;
  
  try {
    console.log('📥 Fetching message history from:', inboxChannel);
    
    const result = await pubnubInstance.fetchMessages({ 
      channels: [inboxChannel],
      count: 100  // Fetch last 100 messages
    });

    const messages: PubNubMessage[] = [];
    
    if (result.channels && result.channels[inboxChannel]) {
      result.channels[inboxChannel].forEach((msg: any) => {
        try {
          const message = msg.message as PubNubMessage;
          if (message && message.messageId) {
            messages.push(message);
          }
        } catch (e) {
          console.warn('Failed to parse message from history:', e);
        }
      });
    }

    console.log(`✓ Fetched ${messages.length} messages from history`);
    return messages;
  } catch (error) {
    console.error('Failed to fetch message history:', error);
    return [];
  }
}

export async function sendDeliveryConfirmation(
  senderAddress: string,
  messageId: string,
  receiverAddress: string
): Promise<void> {
  if (!pubnubInstance) {
    throw new Error('PubNub not initialized');
  }

  const confirmationChannel = `confirmations-${senderAddress}`;
  const confirmation: DeliveryConfirmation = {
    type: "delivery_confirmation",
    messageId,
    deliveredTo: receiverAddress,
    deliveredAt: Date.now(),
    originalSender: senderAddress
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await pubnubInstance.publish({
      channel: confirmationChannel,
      message: confirmation as any
    });
    console.log('✓ Sent delivery confirmation:', messageId);
  } catch (error) {
    console.error('Failed to send delivery confirmation:', error);
    throw error;
  }
}

// Store confirmation listeners
let confirmationListeners: ((confirmation: DeliveryConfirmation) => void)[] = [];

export function subscribeToConfirmations(
  userAddress: string,
  confirmationHandler: (confirmation: DeliveryConfirmation) => void
): void {
  if (!pubnubInstance) {
    console.error('PubNub not initialized');
    return;
  }

  const confirmationChannel = `confirmations-${userAddress}`;
  
  // Add handler
  confirmationHandlers.push(confirmationHandler);
  
  // Subscribe to confirmations if not already subscribed
  if (!subscribedChannels.includes(confirmationChannel)) {
    subscribedChannels.push(confirmationChannel);
    setupUnifiedListener();
    pubnubInstance.subscribe({ channels: [confirmationChannel] });
    console.log('✓ Subscribed to confirmations:', confirmationChannel);
  }
}

export function unsubscribeFromConfirmations(userAddress: string): void {
  if (!pubnubInstance) {
    return;
  }

  const confirmationChannel = `confirmations-${userAddress}`;
  const index = subscribedChannels.indexOf(confirmationChannel);
  if (index > -1) {
    subscribedChannels.splice(index, 1);
  }
  
  pubnubInstance.unsubscribe({ channels: [confirmationChannel] });
  confirmationHandlers = [];
  console.log('✓ Unsubscribed from confirmations:', confirmationChannel);
}
