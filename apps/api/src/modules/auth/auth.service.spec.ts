import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';

const JWT_CONFIG = {
  accessSecret: 'test-access-secret',
  accessExpiresIn: '15m',
  refreshSecret: 'test-refresh-secret',
  refreshExpiresInDays: 7,
  issuer: 'friday-test',
  audience: 'friday-test-clients',
};

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: { findByEmail: jest.Mock; findById: jest.Mock; create: jest.Mock };
  let jwtService: { signAsync: jest.Mock };
  let refreshTokenRepo: {
    save: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const meta = { userAgent: 'jest', ipAddress: '127.0.0.1' };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    refreshTokenRepo = {
      save: jest.fn(),
      create: jest.fn((data) => data),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(JWT_CONFIG) },
        },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokenRepo },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  function buildUser(overrides: Partial<User> = {}): User {
    return {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: '',
      displayName: 'Test User',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as User;
  }

  describe('register', () => {
    it('hashes the password and issues tokens for a new user', async () => {
      const user = buildUser();
      usersService.create.mockResolvedValue(user);
      refreshTokenRepo.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity, id: 'refresh-1' }),
      );

      const result = await authService.register(
        { email: 'user@example.com', password: 'a-strong-password', displayName: 'Test User' },
        meta,
      );

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com', displayName: 'Test User' }),
      );
      const passedHash = usersService.create.mock.calls[0][0].passwordHash;
      expect(await argon2.verify(passedHash, 'a-strong-password')).toBe(true);
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toMatch(/^[0-9a-f]+\.[0-9a-f]+$/);
      expect(result.accessTokenExpiresIn).toBe(900);
    });
  });

  describe('validateCredentials', () => {
    it('rejects an unknown email with a generic error', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        authService.validateCredentials('nobody@example.com', 'whatever'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an inactive user', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ isActive: false }));
      await expect(authService.validateCredentials('user@example.com', 'x')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await argon2.hash('correct-password');
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash }));
      await expect(
        authService.validateCredentials('user@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns the user on a correct password', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = buildUser({ passwordHash });
      usersService.findByEmail.mockResolvedValue(user);
      const result = await authService.validateCredentials('user@example.com', 'correct-password');
      expect(result.id).toBe(user.id);
    });
  });

  describe('refresh', () => {
    it('rejects a malformed token', async () => {
      await expect(authService.refresh('not-a-valid-token', meta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an unknown selector', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(authService.refresh('deadbeef.cafebabe', meta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('detects reuse of a revoked token and revokes the whole session family', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        selector: 'deadbeef',
        tokenHash: 'irrelevant',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(authService.refresh('deadbeef.cafebabe', meta)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('rejects an expired token', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        selector: 'deadbeef',
        tokenHash: 'irrelevant',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(authService.refresh('deadbeef.cafebabe', meta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rotates a valid token and issues a new pair', async () => {
      const validator = 'cafebabe';
      const tokenHash = await argon2.hash(validator);
      const existing = {
        id: 'refresh-1',
        userId: 'user-1',
        selector: 'deadbeef',
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      };
      refreshTokenRepo.findOne.mockResolvedValue(existing);
      usersService.findById.mockResolvedValue(buildUser());
      refreshTokenRepo.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity, id: entity.id ?? 'refresh-2' }),
      );

      const result = await authService.refresh(`deadbeef.${validator}`, meta);

      expect(result.accessToken).toBe('signed.jwt.token');
      // The old row is saved back with revokedAt set (rotation), not deleted.
      expect(refreshTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ selector: 'deadbeef', revokedAt: expect.any(Date) }),
      );
    });
  });

  describe('logout', () => {
    it('revokes the token if found and not already revoked', async () => {
      const existing = { selector: 'deadbeef', revokedAt: null };
      refreshTokenRepo.findOne.mockResolvedValue(existing);
      await authService.logout('deadbeef.cafebabe');
      expect(refreshTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('is a no-op when the token does not exist', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(authService.logout('deadbeef.cafebabe')).resolves.toBeUndefined();
      expect(refreshTokenRepo.save).not.toHaveBeenCalled();
    });
  });
});
