import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { DashboardState } from './state.js';
import type { WsEvent } from '../shared/types.js';

export interface WsBroadcaster {
  broadcast: (event: WsEvent) => void;
  close: () => void;
  readonly clientCount: number;
}

export function createWsBroadcaster(server: Server, state: DashboardState): WsBroadcaster {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    // Send full_refresh with current state on connect
    const refreshEvent: WsEvent = {
      type: 'full_refresh',
      data: { projects: state.getProjects() },
    };
    ws.send(JSON.stringify(refreshEvent));
  });

  return {
    broadcast(event: WsEvent): void {
      const data = JSON.stringify(event);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    },

    close(): void {
      wss.close();
    },

    get clientCount(): number {
      let count = 0;
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          count++;
        }
      }
      return count;
    },
  };
}
