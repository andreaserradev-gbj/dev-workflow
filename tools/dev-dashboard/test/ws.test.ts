import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { DashboardState } from '../src/server/state.js';
import { registerApiRoutes } from '../src/server/api.js';
import { createWsBroadcaster, type WsBroadcaster } from '../src/server/ws.js';
import type { Feature, Project, WsEvent } from '../src/shared/types.js';

let app: FastifyInstance;
let state: DashboardState;
let broadcaster: WsBroadcaster;
let port: number;

const mockFeature: Feature = {
  name: 'auth-system',
  status: 'active',
  progress: { done: 8, total: 13, percent: 62 },
  currentPhase: { number: 2, total: 3, title: 'Token Management' },
  lastCheckpoint: '2026-03-20T14:30:00Z',
  nextAction: 'Implement refresh token rotation',
  branch: 'feature/auth-system',
  summary: 'Multi-provider authentication with OAuth2 and JWT.',
};

const mockProjects: Project[] = [
  {
    name: 'api-server',
    path: '/tmp/test/api-server',
    features: [mockFeature],
  },
];

interface TestClient {
  ws: WebSocket;
  messages: WsEvent[];
  waitForMessage: () => Promise<WsEvent>;
  close: () => void;
}

function connectClient(): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const messages: WsEvent[] = [];
    const waiters: Array<(msg: WsEvent) => void> = [];

    ws.on('message', (data) => {
      const msg: WsEvent = JSON.parse(data.toString());
      const waiter = waiters.shift();
      if (waiter) {
        waiter(msg);
      } else {
        messages.push(msg);
      }
    });

    ws.on('open', () =>
      resolve({
        ws,
        messages,
        waitForMessage: () => {
          const buffered = messages.shift();
          if (buffered) return Promise.resolve(buffered);
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error('Timeout waiting for WS message')), 3000);
            waiters.push((msg) => {
              clearTimeout(timer);
              res(msg);
            });
          });
        },
        close: () => ws.close(),
      })
    );
    ws.on('error', reject);
  });
}

beforeAll(async () => {
  state = new DashboardState();
  state.setProjects(mockProjects);

  app = Fastify();
  registerApiRoutes(app, state);

  // Listen on a random port
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  port = typeof address === 'object' && address ? address.port : 0;

  broadcaster = createWsBroadcaster(app.server, state);
});

afterAll(async () => {
  broadcaster.close();
  await app.close();
});

describe('WebSocket server', () => {
  it('sends full_refresh on new client connection', async () => {
    const client = await connectClient();
    const msg = await client.waitForMessage();

    expect(msg.type).toBe('full_refresh');
    if (msg.type === 'full_refresh') {
      expect(msg.data.projects).toHaveLength(1);
      expect(msg.data.projects[0].name).toBe('api-server');
    }

    client.close();
  });

  it('broadcasts feature_updated to all connected clients', async () => {
    const c1 = await connectClient();
    const c2 = await connectClient();

    // Consume the initial full_refresh messages
    await c1.waitForMessage();
    await c2.waitForMessage();

    // Broadcast a feature_updated event
    const updatedFeature: Feature = { ...mockFeature, status: 'complete' };
    broadcaster.broadcast({
      type: 'feature_updated',
      project: 'api-server',
      feature: 'auth-system',
      data: updatedFeature,
    });

    const msg1 = await c1.waitForMessage();
    const msg2 = await c2.waitForMessage();

    expect(msg1.type).toBe('feature_updated');
    expect(msg2.type).toBe('feature_updated');
    if (msg1.type === 'feature_updated') {
      expect(msg1.feature).toBe('auth-system');
      expect(msg1.data.status).toBe('complete');
    }

    c1.close();
    c2.close();
  });

  it('broadcasts feature_added', async () => {
    const client = await connectClient();
    await client.waitForMessage(); // full_refresh

    const newFeature: Feature = {
      name: 'new-feature',
      status: 'active',
      progress: { done: 0, total: 3, percent: 0 },
      currentPhase: { number: 1, total: 2, title: 'Setup' },
      lastCheckpoint: null,
      nextAction: 'Start implementation',
      branch: 'feature/new',
      summary: 'A new feature.',
    };

    broadcaster.broadcast({
      type: 'feature_added',
      project: 'api-server',
      feature: newFeature,
    });

    const msg = await client.waitForMessage();
    expect(msg.type).toBe('feature_added');
    if (msg.type === 'feature_added') {
      expect(msg.feature.name).toBe('new-feature');
    }

    client.close();
  });

  it('broadcasts feature_removed', async () => {
    const client = await connectClient();
    await client.waitForMessage(); // full_refresh

    broadcaster.broadcast({
      type: 'feature_removed',
      project: 'api-server',
      feature: 'auth-system',
    });

    const msg = await client.waitForMessage();
    expect(msg.type).toBe('feature_removed');
    if (msg.type === 'feature_removed') {
      expect(msg.feature).toBe('auth-system');
    }

    client.close();
  });

  it('does not send to closed clients', async () => {
    const client = await connectClient();
    await client.waitForMessage(); // full_refresh
    client.close();

    // Wait for close to propagate
    await new Promise((r) => setTimeout(r, 100));

    // This should not throw
    broadcaster.broadcast({
      type: 'feature_removed',
      project: 'api-server',
      feature: 'auth-system',
    });
  });

  it('reports connected client count', async () => {
    expect(broadcaster.clientCount).toBe(0);

    const c1 = await connectClient();
    await c1.waitForMessage();
    expect(broadcaster.clientCount).toBe(1);

    const c2 = await connectClient();
    await c2.waitForMessage();
    expect(broadcaster.clientCount).toBe(2);

    c1.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(broadcaster.clientCount).toBe(1);

    c2.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(broadcaster.clientCount).toBe(0);
  });
});
