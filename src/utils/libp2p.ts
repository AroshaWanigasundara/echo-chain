/* eslint-disable @typescript-eslint/no-explicit-any */
import { createLibp2p } from 'libp2p';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { bootstrap } from '@libp2p/bootstrap';

// Use 'any' to avoid version conflicts between libp2p packages
let libp2pNode: any = null;

// Bootstrap peers for discovery
const BOOTSTRAP_PEERS = [
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
];

export interface P2PMessage {
  messageId: string;
  conversationId: string;
  sender: string;
  recipient: string;
  encryptedData: {
    ciphertext: string;
    nonce: string;
  };
  messageHash: string;
  blockNumber?: number;
  timestamp: number;
}

export async function startLibp2pNode(userAddress: string): Promise<any> {
  if (libp2pNode) {
    console.log('libp2p node already running');
    return libp2pNode;
  }

  try {
    console.log('Starting libp2p node for address:', userAddress);
    
    libp2pNode = await createLibp2p({
      transports: [
        webSockets() as any,
        webRTC() as any,
      ],
      connectionEncryption: [noise() as any],
      streamMuxers: [yamux() as any],
      peerDiscovery: [
        bootstrap({
          list: BOOTSTRAP_PEERS,
          timeout: 3000,
        }) as any,
      ],
      services: {
        pubsub: gossipsub({
          emitSelf: false,
          allowPublishToZeroTopicPeers: true,
          floodPublish: true,
          fallbackToFloodsub: true,
        }) as any,
      },
    });

    await libp2pNode.start();
    
    console.log('✓ libp2p node started');
    console.log('Peer ID:', libp2pNode.peerId.toString());

    // Log connection events
    libp2pNode.addEventListener('peer:connect', (evt: any) => {
      console.log('Connected to peer:', evt.detail.toString());
    });

    libp2pNode.addEventListener('peer:disconnect', (evt: any) => {
      console.log('Disconnected from peer:', evt.detail.toString());
    });

    return libp2pNode;
  } catch (error) {
    console.error('Failed to start libp2p node:', error);
    throw error;
  }
}

export async function stopLibp2pNode(): Promise<void> {
  if (libp2pNode) {
    try {
      await libp2pNode.stop();
      libp2pNode = null;
      console.log('✓ libp2p node stopped');
    } catch (error) {
      console.error('Error stopping libp2p node:', error);
    }
  }
}

export function getLibp2pNode(): any {
  return libp2pNode;
}

export function isLibp2pRunning(): boolean {
  return libp2pNode !== null && libp2pNode.status === 'started';
}

export function getInboxTopic(address: string): string {
  return `secure-messaging/inbox/${address}`;
}

export async function subscribeToInbox(
  address: string,
  onMessage: (message: P2PMessage) => void
): Promise<void> {
  const node = getLibp2pNode();
  if (!node) {
    console.error('Cannot subscribe: libp2p node not running');
    return;
  }

  const topic = getInboxTopic(address);
  
  try {
    // Subscribe to the topic
    node.services.pubsub.subscribe(topic);
    console.log('✓ Subscribed to inbox:', topic);
    
    // Set up message listener
    node.services.pubsub.addEventListener('message', (event: any) => {
      if (event.detail.topic === topic) {
        try {
          const decoder = new TextDecoder();
          const messageJson = decoder.decode(event.detail.data);
          const message = JSON.parse(messageJson) as P2PMessage;
          
          console.log('📨 Received P2P message:', message.messageId);
          onMessage(message);
        } catch (error) {
          console.error('Failed to parse incoming P2P message:', error);
        }
      }
    });
  } catch (error) {
    console.error('Failed to subscribe to inbox:', error);
    throw error;
  }
}

export async function unsubscribeFromInbox(address: string): Promise<void> {
  const node = getLibp2pNode();
  if (!node) return;

  const topic = getInboxTopic(address);
  
  try {
    node.services.pubsub.unsubscribe(topic);
    console.log('✓ Unsubscribed from inbox:', topic);
  } catch (error) {
    console.error('Failed to unsubscribe from inbox:', error);
  }
}

export async function publishToInbox(
  recipientAddress: string,
  message: P2PMessage
): Promise<boolean> {
  const node = getLibp2pNode();
  
  if (!node || !isLibp2pRunning()) {
    console.log('libp2p not available, skipping P2P delivery');
    return false;
  }

  const topic = getInboxTopic(recipientAddress);
  
  try {
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(JSON.stringify(message));
    
    await node.services.pubsub.publish(topic, payloadBytes);
    
    console.log('✓ Message delivered via P2P to:', topic);
    return true;
  } catch (error) {
    console.error('P2P delivery failed:', error);
    return false;
  }
}

export function getPeerCount(): number {
  const node = getLibp2pNode();
  if (!node) return 0;
  
  try {
    return node.getPeers().length;
  } catch {
    return 0;
  }
}
