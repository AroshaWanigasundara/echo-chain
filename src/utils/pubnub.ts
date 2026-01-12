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
let confirmationListener: any = null;

export function subscribeToConfirmations(
  userAddress: string,
  confirmationHandler: (confirmation: DeliveryConfirmation) => void
): void {
  if (!pubnubInstance) {
    console.error('PubNub not initialized');
    return;
  }

  const confirmationChannel = `confirmations-${userAddress}`;
  
  // Remove old listener if it exists
  if (confirmationListener) {
    pubnubInstance.removeListener(confirmationListener);
  }
  
  // Clear old handlers
  confirmationListeners = [];
  
  // Store the handler
  confirmationListeners.push(confirmationHandler);

  confirmationListener = {
    message: (event: any) => {
      if (event.channel === confirmationChannel) {
        console.log('📦 Delivery confirmation received:', event.message);
        const confirmation = event.message as unknown as DeliveryConfirmation;
        confirmationListeners.forEach(handler => handler(confirmation));
      }
    },
    status: (statusEvent: any) => {
      if (statusEvent.category === 'PNConnectedCategory') {
        console.log('✓ PubNub connected to confirmation channel:', confirmationChannel);
      }
    }
  };

  pubnubInstance.addListener(confirmationListener);
  pubnubInstance.subscribe({ channels: [confirmationChannel] });
  console.log('✓ Subscribed to confirmations:', confirmationChannel);
}

export function unsubscribeFromConfirmations(userAddress: string): void {
  if (!pubnubInstance || !confirmationListener) {
    return;
  }

  const confirmationChannel = `confirmations-${userAddress}`;
  pubnubInstance.unsubscribe({ channels: [confirmationChannel] });
  pubnubInstance.removeListener(confirmationListener);
  confirmationListener = null;
  confirmationListeners = [];
  console.log('✓ Unsubscribed from confirmations:', confirmationChannel);
}
