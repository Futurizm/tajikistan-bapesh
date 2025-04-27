const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    console.log('[GET /api/friends] Request received:', {
      user: req.user,
      cookies: req.cookies,
    });

    if (!req.user || !req.user.id) {
      console.error('[GET /api/friends] No user ID in req.user');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = parseInt(req.user.id, 10);
    if (isNaN(userId)) {
      console.error('[GET /api/friends] Invalid userId:', req.user.id);
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    console.log(`[GET /api/friends] Fetching friends for userId: ${userId}`);

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ userId: userId }, { friendId: userId }],
        status: 'accepted',
      },
      include: {
        user: { select: { id: true, username: true, profilePicture: true } },
        friend: { select: { id: true, username: true, profilePicture: true } },
      },
    });

    const friends = friendships.map((friendship) => {
      const friend = friendship.userId === userId ? friendship.friend : friendship.user;
      return {
        id: friend.id,
        username: friend.username,
        profilePicture:
          friend.profilePicture && typeof friend.profilePicture === 'string'
            ? `http://localhost:5000/uploads/${path.basename(friend.profilePicture)}`
            : null,
      };
    });

    console.log(`[GET /api/friends] Friends fetched:`, friends);
    res.json(friends);
  } catch (error) {
    console.error(`[GET /api/friends] Error:`, {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

router.get('/requests', async (req, res) => {
  try {
    console.log('[GET /api/friends/requests] Request received:', {
      user: req.user,
      cookies: req.cookies,
    });

    if (!req.user || !req.user.id) {
      console.error('[GET /api/friends/requests] No user ID in req.user');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = parseInt(req.user.id, 10);
    if (isNaN(userId)) {
      console.error('[GET /api/friends/requests] Invalid userId:', req.user.id);
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    console.log(`[GET /api/friends/requests] Fetching friend requests for userId: ${userId}`);

    const requests = await prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: 'pending',
      },
      include: {
        user: { select: { id: true, username: true, profilePicture: true } },
      },
    });

    const formattedRequests = requests.map((request) => ({
      id: request.id,
      userId: request.userId,
      friendId: request.friendId,
      requester: {
        id: request.user.id,
        username: request.user.username,
        profilePicture:
          request.user.profilePicture && typeof request.user.profilePicture === 'string'
            ? `http://localhost:5000/uploads/${path.basename(request.user.profilePicture)}`
            : null,
      },
    }));

    console.log(`[GET /api/friends/requests] Friend requests fetched:`, formattedRequests);
    res.json(formattedRequests);
  } catch (error) {
    console.error(`[GET /api/friends/requests] Error:`, {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

router.get('/search', async (req, res) => {
  try {
    console.log('[GET /api/friends/search] Request received:', {
      user: req.user,
      query: req.query,
    });

    if (!req.user || !req.user.id) {
      console.error('[GET /api/friends/search] No user ID in req.user');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = parseInt(req.user.id, 10);
    const { query } = req.query;

    if (isNaN(userId)) {
      console.error('[GET /api/friends/search] Invalid userId:', req.user.id);
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (!query || typeof query !== 'string') {
      console.log('[GET /api/friends/search] No query provided');
      return res.status(400).json({ message: 'Search query is required' });
    }

    console.log(`[GET /api/friends/search] Searching users for userId: ${userId} with query: ${query}`);

    const users = await prisma.users.findMany({
      where: {
        username: { contains: query, mode: 'insensitive' },
        id: { not: userId },
        NOT: {
          userFriendships: {
            some: {
              friendId: userId,
              status: 'accepted',
            },
          },
          friendFriendships: {
            some: {
              userId: userId,
              status: 'accepted',
            },
          },
        },
      },
      select: {
        id: true,
        username: true,
        profilePicture: true,
      },
      take: 10,
    });

    const formattedUsers = users.map((user) => ({
      id: user.id,
      username: user.username,
      profilePicture:
        user.profilePicture && typeof user.profilePicture === 'string'
          ? `http://localhost:5000/uploads/${path.basename(user.profilePicture)}`
          : null,
    }));

    console.log(`[GET /api/friends/search] Found users:`, formattedUsers);
    res.json(formattedUsers);
  } catch (error) {
    console.error(`[GET /api/friends/search] Error:`, {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      query: req.query.query,
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

router.get('/:userId', async (req, res) => {
  try {
    console.log('[GET /api/friends/:userId] Request received:', {
      user: req.user,
      params: req.params,
    });

    const userIdParam = req.params.userId;
    const userId = parseInt(userIdParam, 10);

    if (isNaN(userId)) {
      console.error(`[GET /api/friends/${userIdParam}] Invalid userId: ${userIdParam}`);
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    console.log(`[GET /api/friends/${userIdParam}] Fetching friends for userId: ${userId}`);

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ userId: userId }, { friendId: userId }],
        status: 'accepted',
      },
      include: {
        user: { select: { id: true, username: true, profilePicture: true } },
        friend: { select: { id: true, username: true, profilePicture: true } },
      },
    });

    const friends = friendships.map((friendship) => {
      const friend = friendship.userId === userId ? friendship.friend : friendship.user;
      return {
        id: friend.id,
        username: friend.username,
        profilePicture:
          friend.profilePicture && typeof friend.profilePicture === 'string'
            ? `http://localhost:5000/uploads/${path.basename(friend.profilePicture)}`
            : null,
      };
    });

    console.log(`[GET /api/friends/${userIdParam}] Friends fetched:`, friends);
    res.json(friends);
  } catch (error) {
    console.error(`[GET /api/friends/${userIdParam}] Error:`, {
      message: error.message,
      stack: error.stack,
      userIdParam,
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

router.delete('/:friendId', async (req, res) => {
  try {
    console.log('[DELETE /api/friends/:friendId] Request received:', {
      user: req.user,
      params: req.params,
    });

    if (!req.user || !req.user.id) {
      console.error('[DELETE /api/friends/:friendId] No user ID in req.user');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = parseInt(req.user.id, 10);
    const friendId = parseInt(req.params.friendId, 10);

    if (isNaN(userId) || isNaN(friendId)) {
      console.error(`[DELETE /api/friends/${req.params.friendId}] Invalid IDs:`, {
        userId: req.user.id,
        friendId: req.params.friendId,
      });
      return res.status(400).json({ message: 'Invalid user or friend ID' });
    }

    console.log(`[DELETE /api/friends/${friendId}] Removing friend for userId: ${userId}`);

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: userId, friendId: friendId },
          { userId: friendId, friendId: userId },
        ],
        status: 'accepted',
      },
    });

    if (!friendship) {
      console.log(`[DELETE /api/friends/${friendId}] Friendship not found`);
      return res.status(404).json({ message: 'Friendship not found' });
    }

    await prisma.friendship.delete({
      where: { id: friendship.id },
    });

    console.log(`[DELETE /api/friends/${friendId}] Friend removed`);
    res.status(204).send();
  } catch (error) {
    console.error(`[DELETE /api/friends/${req.params.friendId}] Error:`, {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      friendId: req.params.friendId,
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

router.post('/', async (req, res) => {
  try {
    console.log('[POST /api/friends] Request received:', {
      user: req.user,
      body: req.body,
    });

    if (!req.user || !req.user.id) {
      console.error('[POST /api/friends] No user ID in req.user');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = parseInt(req.user.id, 10);
    const { friendId } = req.body;

    if (isNaN(userId) || !friendId || isNaN(parseInt(friendId, 10)) || friendId === userId) {
      console.error('[POST /api/friends] Invalid IDs:', {
        userId: req.user.id,
        friendId,
      });
      return res.status(400).json({ message: 'Invalid user or friend ID' });
    }

    console.log(`[POST /api/friends] Sending friend request from userId: ${userId} to friendId: ${friendId}`);

    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: userId, friendId: parseInt(friendId, 10) },
          { userId: parseInt(friendId, 10), friendId: userId },
        ],
      },
    });

    if (existingFriendship) {
      console.log(`[POST /api/friends] Friendship already exists:`, existingFriendship);
      return res.status(400).json({ message: 'Friendship request already exists or user is already a friend' });
    }

    const friendRequest = await prisma.friendship.create({
      data: {
        userId: userId,
        friendId: parseInt(friendId, 10),
        status: 'pending',
      },
    });

    console.log(`[POST /api/friends] Friend request created:`, friendRequest);
    res.status(201).json(friendRequest);
  } catch (error) {
    console.error(`[POST /api/friends] Error:`, {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      friendId: req.body.friendId,
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

router.put('/:id/accept', async (req, res) => {
  try {
    console.log('[PUT /api/friends/:id/accept] Request received:', {
      user: req.user,
      params: req.params,
    });

    if (!req.user || !req.user.id) {
      console.error('[PUT /api/friends/:id/accept] No user ID in req.user');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = parseInt(req.user.id, 10);
    const requestId = parseInt(req.params.id, 10);

    if (isNaN(userId) || isNaN(requestId)) {
      console.error(`[PUT /api/friends/${req.params.id}/accept] Invalid IDs:`, {
        userId: req.user.id,
        requestId: req.params.id,
      });
      return res.status(400).json({ message: 'Invalid user or request ID' });
    }

    console.log(`[PUT /api/friends/${requestId}/accept] Accepting friend request for userId: ${userId}`);

    const friendRequest = await prisma.friendship.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { id: true, username: true, profilePicture: true } },
      },
    });

    if (!friendRequest || friendRequest.friendId !== userId || friendRequest.status !== 'pending') {
      console.log(`[PUT /api/friends/${requestId}/accept] Invalid or unauthorized request:`, {
        friendRequest,
        userId,
      });
      return res.status(400).json({ message: 'Invalid or unauthorized friend request' });
    }

    const updatedFriendship = await prisma.friendship.update({
      where: { id: requestId },
      data: { status: 'accepted' },
      include: {
        user: { select: { id: true, username: true, profilePicture: true } },
      },
    });

    const formattedFriendship = {
      ...updatedFriendship,
      requester: {
        id: updatedFriendship.user.id,
        username: updatedFriendship.user.username,
        profilePicture:
          updatedFriendship.user.profilePicture && typeof updatedFriendship.user.profilePicture === 'string'
            ? `http://localhost:5000/uploads/${path.basename(updatedFriendship.user.profilePicture)}`
            : null,
      },
    };

    console.log(`[PUT /api/friends/${requestId}/accept] Friend request accepted:`, formattedFriendship);
    res.json(formattedFriendship);
  } catch (error) {
    console.error(`[PUT /api/friends/${req.params.id}/accept] Error:`, {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      requestId: req.params.id,
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

module.exports = router;