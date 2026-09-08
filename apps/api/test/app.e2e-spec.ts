import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('FRIDAY API (e2e)', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(fastifyCookie);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    // Clean, deterministic slate for the next run - truncate rather than drop
    // so we don't need to re-run migrations between test invocations.
    await dataSource.query(
      'TRUNCATE TABLE "messages", "conversations", "refresh_tokens", "users" CASCADE',
    );
    await app.close();
  });

  function unique(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  describe('GET /api/health', () => {
    it('reports database and redis as up', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/health' });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.info.database.status).toBe('up');
      expect(body.info.redis.status).toBe('up');
    });
  });

  describe('POST /api/live/session', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/live/session' });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('auth + conversations + messages flow', () => {
    const email = `${unique('e2e')}@example.com`;
    const password = 'a-very-strong-password';
    let accessToken: string;
    let refreshCookie: string;
    let conversationId: string;

    it('rejects unauthenticated access to a protected route', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/conversations' });
      expect(response.statusCode).toBe(401);
    });

    it('registers a new user and returns tokens', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, password, displayName: 'E2E User' },
      });
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user.email).toBe(email);
      expect(body.accessToken).toEqual(expect.any(String));

      accessToken = body.accessToken;
      const setCookie = response.headers['set-cookie'];
      refreshCookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie) as string;
      expect(refreshCookie).toMatch(/^refresh_token=/);
      expect(refreshCookie).toMatch(/HttpOnly/i);
    });

    it('rejects duplicate registration with 409', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, password, displayName: 'E2E User' },
      });
      expect(response.statusCode).toBe(409);
    });

    it('rejects weak passwords at the validation layer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: unique('weak') + '@example.com', password: 'short', displayName: 'X' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('logs in with correct credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().accessToken).toEqual(expect.any(String));
    });

    it('rejects login with the wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password: 'wrong-password' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns the current user from a protected route', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().email).toBe(email);
    });

    it('rejects an obviously invalid access token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { authorization: 'Bearer not-a-real-token' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('creates a conversation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversations',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { title: 'E2E conversation' },
      });
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.title).toBe('E2E conversation');
      conversationId = body.id;
    });

    it('lists conversations for the owner', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/conversations',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.some((c: { id: string }) => c.id === conversationId)).toBe(true);
    });

    it('creates and lists messages under the conversation', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { role: 'user', content: 'Hello FRIDAY' },
      });
      expect(createResponse.statusCode).toBe(201);

      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(listResponse.statusCode).toBe(200);
      const messages = listResponse.json();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello FRIDAY');
    });

    it('rejects an empty turn body with 400 before touching Gemini', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/conversations/${conversationId}/turns`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { content: '' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects unauthenticated turn requests with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/conversations/${conversationId}/turns`,
        payload: { content: 'hello' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 404 (not 403) when another user requests this conversation', async () => {
      const otherEmail = `${unique('e2e-other')}@example.com`;
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: otherEmail, password, displayName: 'Other User' },
      });
      const otherToken = registerResponse.json().accessToken;

      const response = await app.inject({
        method: 'GET',
        url: `/api/conversations/${conversationId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(response.statusCode).toBe(404);

      // Ownership is checked before any SSE headers are written or Gemini is
      // called, so a foreign conversation id still comes back as a plain 404.
      const turnResponse = await app.inject({
        method: 'POST',
        url: `/api/conversations/${conversationId}/turns`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { content: 'hello' },
      });
      expect(turnResponse.statusCode).toBe(404);
    });

    it('rejects a malformed conversation id with 400', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/conversations/not-a-uuid',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(400);
    });

    it('refreshes the session using the httpOnly cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: refreshCookie.split(';')[0] },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().accessToken).toEqual(expect.any(String));

      const setCookie = response.headers['set-cookie'];
      refreshCookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie) as string;
    });

    it('logs out and revokes the refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie: refreshCookie.split(';')[0] },
      });
      expect(response.statusCode).toBe(204);

      const reuse = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: refreshCookie.split(';')[0] },
      });
      expect(reuse.statusCode).toBe(401);
    });
  });
});
