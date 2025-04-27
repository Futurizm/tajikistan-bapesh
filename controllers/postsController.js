const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PostsController {
    async createPost(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            console.log(`[POST /api/posts] Creating post for userId: ${userId}`, {
                user: req.user,
                body: req.body,
                filesCount: req.files?.length || 0,
            });

            if (isNaN(userId)) {
                console.log(`[POST /api/posts] Invalid userId: ${req.user.id}`, { user: req.user });
                return res.status(400).json({ message: 'Недействительный ID пользователя' });
            }

            const {
                title,
                description,
                location,
                price,
                bedrooms,
                bathrooms,
                squareMeters,
                address,
                propertyType,
                yearBuilt,
            } = req.body;

            if (!title || !description || !location || !price) {
                console.log(`[POST /api/posts] Missing required fields`);
                return res.status(400).json({ message: 'Все обязательные поля (title, description, location, price) должны быть заполнены' });
            }

            const parsedPrice = parseFloat(price);
            if (isNaN(parsedPrice) || parsedPrice <= 0) {
                console.log(`[POST /api/posts] Invalid price: ${price}`);
                return res.status(400).json({ message: 'Цена должна быть положительным числом' });
            }

            const parsedYearBuilt = yearBuilt ? parseInt(yearBuilt) : null;
            if (yearBuilt && (isNaN(parsedYearBuilt) || parsedYearBuilt < 1800 || parsedYearBuilt > new Date().getFullYear())) {
                console.log(`[POST /api/posts] Invalid yearBuilt: ${yearBuilt}`);
                return res.status(400).json({ message: 'Год постройки должен быть валидным числом между 1800 и текущим годом' });
            }

            if (!req.files || req.files.length === 0) {
                console.log(`[POST /api/posts] No files uploaded`);
                return res.status(400).json({ message: 'Требуется хотя бы одно изображение' });
            }

            const user = await prisma.users.findUnique({
                where: { id: userId },
            });
            if (!user) {
                console.log(`[POST /api/posts] User not found: ${userId}`);
                return res.status(404).json({ message: 'Пользователь не найден' });
            }

            const imageUrls = req.files.map(file => `/Uploads/posts/${file.filename}`);
            console.log(`[POST /api/posts] Generated image URLs:`, imageUrls);

            const post = await prisma.post.create({
                data: {
                    title: title.trim(),
                    description: description.trim(),
                    location: location.trim(),
                    price: parsedPrice,
                    bedrooms: bedrooms ? parseInt(bedrooms) : null,
                    bathrooms: bathrooms ? parseInt(bathrooms) : null,
                    squareMeters: squareMeters ? parseInt(squareMeters) : null,
                    address: address ? address.trim() : null,
                    propertyType: propertyType ? propertyType.trim() : null,
                    yearBuilt: parsedYearBuilt,
                    imageUrls,
                    authorId: userId,
                    createdAt: new Date(),
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phone: true,
                            profilePicture: true,
                            skills: true,
                        },
                    },
                },
            });

            const response = {
                id: post.id,
                authorId: post.authorId,
                title: post.title,
                description: post.description,
                location: post.location,
                price: post.price,
                bedrooms: post.bedrooms,
                bathrooms: post.bathrooms,
                squareMeters: post.squareMeters,
                address: post.address,
                propertyType: post.propertyType,
                yearBuilt: post.yearBuilt,
                imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls.map(url => `http://localhost:5000${url}`) : [],
                createdAt: post.createdAt,
                likes: [],
                seller: {
                    id: post.author.id,
                    name: post.author.username,
                    email: post.author.email,
                    phone: post.author.phone,
                    avatar: post.author.profilePicture ? `http://localhost:5000${post.author.profilePicture}` : null,
                    skills: Array.isArray(post.author.skills) ? post.author.skills : [],
                },
            };

            console.log(`[POST /api/posts] Post created:`, { id: response.id, title: response.title });
            res.status(201).json(response);
        } catch (error) {
            console.error(`[POST /api/posts] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Ошибка создания объявления', error: error.message });
        }
    }

    async getPosts(req, res) {
        try {
            console.log(`[GET /api/posts] Fetching posts`);
            const posts = await prisma.post.findMany({
                include: {
                    author: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phone: true,
                            profilePicture: true,
                            skills: true,
                        },
                    },
                    likes: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            console.log(`[GET /api/posts] Raw posts from DB:`, posts);

            const response = posts.map(post => ({
                id: post.id,
                authorId: post.authorId,
                title: post.title,
                description: post.description,
                location: post.location,
                price: post.price,
                bedrooms: post.bedrooms,
                bathrooms: post.bathrooms,
                squareMeters: post.squareMeters,
                address: post.address,
                propertyType: post.propertyType,
                yearBuilt: post.yearBuilt,
                imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls.map(url => `http://localhost:5000${url}`) : [],
                createdAt: post.createdAt,
                likes: post.likes.map(like => like.userId),
                seller: {
                    id: post.author.id,
                    name: post.author.username,
                    email: post.author.email,
                    phone: post.author.phone,
                    avatar: post.author.profilePicture ? `http://localhost:5000${post.author.profilePicture}` : null,
                    skills: post.author.skills || [],
                },
            }));

            console.log(`[GET /api/posts] Processed response:`, response);
            res.json(response);
        } catch (error) {
            console.error(`[GET /api/posts] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера', error: error.message });
        }
    }

    async getMultiplePosts(req, res) {
        try {
            const { postIds } = req.body;
            console.log(`[POST /api/posts/multiple] Fetching posts with IDs:`, postIds);

            if (!Array.isArray(postIds) || postIds.length === 0) {
                console.log(`[POST /api/posts/multiple] Invalid postIds`);
                return res.status(400).json({ message: 'Недействительный или пустой массив postIds' });
            }

            const posts = await prisma.post.findMany({
                where: {
                    id: { in: postIds.map(id => parseInt(id)) },
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phone: true,
                            profilePicture: true,
                            skills: true,
                        },
                    },
                    likes: true,
                },
            });

            const response = posts.map(post => ({
                id: post.id,
                authorId: post.authorId,
                title: post.title,
                description: post.description,
                location: post.location,
                price: post.price,
                bedrooms: post.bedrooms,
                bathrooms: post.bathrooms,
                squareMeters: post.squareMeters,
                imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls.map(url => `http://localhost:5000${url}`) : [],
                createdAt: post.createdAt,
                likes: post.likes.map(like => like.userId),
                seller: {
                    id: post.author.id,
                    name: post.author.username,
                    email: post.author.email,
                    phone: post.author.phone,
                    avatar: post.author.profilePicture ? `http://localhost:5000${post.author.profilePicture}` : null,
                    skills: post.author.skills || [],
                },
            }));

            console.log(`[POST /api/posts/multiple] Posts fetched: ${response.length}`);
            res.json(response);
        } catch (error) {
            console.error(`[POST /api/posts/multiple] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера', error: error.message });
        }
    }

    async getUserPosts(req, res) {
        try {
            const userId = parseInt(req.params.userId);
            console.log(`[GET /api/posts/user/${req.params.userId}] Fetching posts for userId: ${userId}`);

            if (isNaN(userId)) {
                console.log(`[GET /api/posts/user/${req.params.userId}] Invalid userId: ${req.params.userId}`);
                return res.status(400).json({ message: 'Недействительный ID пользователя' });
            }

            const posts = await prisma.post.findMany({
                where: { authorId: userId },
                include: {
                    author: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phone: true,
                            profilePicture: true,
                            skills: true,
                        },
                    },
                    likes: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            const response = posts.map(post => ({
                id: post.id,
                authorId: post.authorId,
                title: post.title,
                description: post.description,
                location: post.location,
                price: post.price,
                bedrooms: post.bedrooms,
                bathrooms: post.bathrooms,
                squareMeters: post.squareMeters,
                imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls.map(url => `http://localhost:5000${url}`) : [],
                createdAt: post.createdAt,
                likes: post.likes.map(like => like.userId),
                seller: {
                    id: post.author.id,
                    name: post.author.username,
                    email: post.author.email,
                    phone: post.author.phone,
                    avatar: post.author.profilePicture ? `http://localhost:5000${post.author.profilePicture}` : null,
                    skills: post.author.skills || [],
                },
            }));

            console.log(`[GET /api/posts/user/${userId}] Posts fetched: ${response.length}`);
            res.json(response);
        } catch (error) {
            console.error(`[GET /api/posts/user/${req.params.userId}] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера', error: error.message });
        }
    }

    async getMyPosts(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            console.log(`[GET /api/posts/my] Fetching posts for userId: ${userId}`, {
                user: req.user,
                idType: typeof req.user.id,
                rawId: req.user.id,
            });

            if (isNaN(userId)) {
                console.log(`[GET /api/posts/my] Invalid userId: ${req.user.id}`, { user: req.user });
                return res.status(400).json({ message: 'Недействительный ID пользователя' });
            }

            const posts = await prisma.post.findMany({
                where: { authorId: userId },
                include: {
                    author: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phone: true,
                            profilePicture: true,
                            skills: true,
                        },
                    },
                    likes: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            const response = posts.map(post => ({
                id: post.id,
                authorId: post.authorId,
                title: post.title,
                description: post.description,
                location: post.location,
                price: post.price,
                bedrooms: post.bedrooms,
                bathrooms: post.bathrooms,
                squareMeters: post.squareMeters,
                imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls.map(url => `http://localhost:5000${url}`) : [],
                createdAt: post.createdAt,
                likes: post.likes.map(like => like.userId),
                seller: {
                    id: post.author.id,
                    name: post.author.username,
                    email: post.author.email,
                    phone: post.author.phone,
                    avatar: post.author.profilePicture ? `http://localhost:5000${post.author.profilePicture}` : null,
                    skills: post.author.skills || [],
                },
            }));

            console.log(`[GET /api/posts/my] Posts fetched: ${response.length}`);
            res.json(response);
        } catch (error) {
            console.error(`[GET /api/posts/my] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера', error: error.message });
        }
    }

    async getPostById(req, res) {
        try {
            const postId = parseInt(req.params.id);
            console.log(`[GET /api/posts/${postId}] Fetching post`);

            if (isNaN(postId)) {
                console.log(`[GET /api/posts/${req.params.id}] Invalid postId`);
                return res.status(400).json({ message: 'Недействительный ID поста' });
            }

            const post = await prisma.post.findUnique({
                where: { id: postId },
                include: {
                    author: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phone: true,
                            profilePicture: true,
                            skills: true,
                        },
                    },
                    likes: true,
                },
            });

            if (!post) {
                console.log(`[GET /api/posts/${postId}] Post not found`);
                return res.status(404).json({ message: 'Пост не найден' });
            }

            const response = {
                id: post.id,
                authorId: post.authorId,
                title: post.title,
                description: post.description,
                location: post.location,
                price: post.price,
                bedrooms: post.bedrooms,
                bathrooms: post.bathrooms,
                squareMeters: post.squareMeters,
                imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls.map(url => `http://localhost:5000${url}`) : [],
                createdAt: post.createdAt,
                likes: post.likes.map(like => like.userId),
                seller: {
                    id: post.author.id,
                    name: post.author.username,
                    email: post.author.email,
                    phone: post.author.phone,
                    avatar: post.author.profilePicture ? `http://localhost:5000${post.author.profilePicture}` : null,
                    skills: post.author.skills || [],
                },
            };

            console.log(`[GET /api/posts/${postId}] Post fetched:`, { id: response.id, title: response.title });
            res.json(response);
        } catch (error) {
            console.error(`[GET /api/posts/${req.params.id}] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера', error: error.message });
        }
    }

    async deletePost(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const postId = parseInt(req.params.id);
            console.log(`[DELETE /api/posts/${postId}] Deleting post for userId: ${userId}`, { user: req.user });

            if (isNaN(userId) || isNaN(postId)) {
                console.log(`[DELETE /api/posts/${postId}] Invalid userId or postId`, { userId: req.user.id, postId: req.params.id });
                return res.status(400).json({ message: 'Недействительный ID пользователя или поста' });
            }

            const post = await prisma.post.findUnique({
                where: { id: postId },
            });

            if (!post) {
                console.log(`[DELETE /api/posts/${postId}] Post not found`);
                return res.status(404).json({ message: 'Пост не найден' });
            }

            if (post.authorId !== userId) {
                console.log(`[DELETE /api/posts/${postId}] Unauthorized attempt by userId: ${userId}`);
                return res.status(403).json({ message: 'Вы не авторизованы для удаления этого поста' });
            }

            await prisma.post.delete({
                where: { id: postId },
            });

            console.log(`[DELETE /api/posts/${postId}] Post deleted`);
            res.status(204).send();
        } catch (error) {
            console.error(`[DELETE /api/posts/${req.params.id}] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера', error: error.message });
        }
    }
    
    async getTopAgents(req, res) {
      try {
        console.log('[GET /api/posts/top-agents] Fetching top agents');
        const agents = await prisma.users.findMany({
          take: 6,
          orderBy: [
            {
              userFriendships: {
                _count: 'desc'
              }
            },
            {
              friendFriendships: {
                _count: 'desc'
              }
            },
            { id: 'asc' }
          ],
          select: {
            id: true,
            username: true,
            profilePicture: true,
            _count: {
              select: {
                userFriendships: {
                  where: { status: 'accepted' }
                },
                friendFriendships: {
                  where: { status: 'accepted' }
                }
              }
            }
          }
        });
  
        const formattedAgents = agents.map(agent => {
          const profilePicture = agent.profilePicture
            ? `http://localhost:5000/uploads/${agent.profilePicture}`
            : null;
          console.log('[GET /api/posts/top-agents] Agent profilePicture:', {
            username: agent.username,
            profilePicture,
            rawProfilePicture: agent.profilePicture,
          });
          return {
            id: agent.id.toString(),
            username: agent.username,
            profilePicture,
            friendsCount: (agent._count.userFriendships || 0) + (agent._count.friendFriendships || 0)
          };
        });
  
        console.log('[GET /api/posts/top-agents] Fetched agents:', formattedAgents);
        res.json(formattedAgents);
      } catch (error) {
        console.error('[GET /api/posts/top-agents] Error:', error.message, error.stack);
        res.status(500).json({ message: 'Ошибка сервера' });
      }
    }
  
    async getTrendingProperties(req, res) {
      try {
        console.log('[GET /api/posts/trending] Fetching trending properties');
        const properties = await prisma.post.findMany({
          take: 6,
          orderBy: {
            likes: {
              _count: 'desc'
            }
          },
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            price: true,
            bedrooms: true,
            bathrooms: true,
            squareMeters: true,
            imageUrls: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                username: true,
                profilePicture: true
              }
            },
            _count: {
              select: { likes: true }
            }
          }
        });
  
        const formattedProperties = properties.map(property => {
          const imageUrls = property.imageUrls.map(url => {
            if (url.startsWith('http')) return url;
            if (url.startsWith('/Uploads/posts/')) return `http://localhost:5000${url}`;
            return `http://localhost:5000/uploads/posts/${url}`;
          });
          const authorProfilePicture = property.author.profilePicture
            ? `http://localhost:5000/uploads/profiles/${property.author.profilePicture}`
            : null;
          console.log('[GET /api/posts/trending] Property data:', {
            title: property.title,
            imageUrls,
            author: {
              username: property.author.username,
              profilePicture: authorProfilePicture,
              rawProfilePicture: property.author.profilePicture,
            },
          });
          return {
            id: property.id,
            title: property.title,
            description: property.description,
            location: property.location,
            price: property.price,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            squareMeters: property.squareMeters,
            imageUrls,
            likes: property._count.likes,
            createdAt: property.createdAt.toISOString(),
            author: {
              id: property.author.id.toString(),
              username: property.author.username,
              profilePicture: authorProfilePicture,
            }
          };
        });
  
        console.log('[GET /api/posts/trending] Fetched properties:', formattedProperties.length);
        res.json(formattedProperties);
      } catch (error) {
        console.error('[GET /api/posts/trending] Error:', error.message, error.stack);
        res.status(500).json({ message: 'Ошибка сервера' });
      }
    }
  
    async getAllPosts(req, res) {
      try {
        console.log('[GET /api/posts/feed] Fetching all posts');
        const posts = await prisma.post.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            price: true,
            bedrooms: true,
            bathrooms: true,
            squareMeters: true,
            imageUrls: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                username: true,
                profilePicture: true
              }
            },
            _count: {
              select: { likes: true }
            }
          }
        });
  
        const formattedPosts = posts.map(post => {
          const imageUrls = post.imageUrls.map(url => {
            if (url.startsWith('http')) return url;
            if (url.startsWith('/Uploads/posts/')) return `http://localhost:5000${url}`;
            return `http://localhost:5000/uploads/posts/${url}`;
          });
          const authorProfilePicture = post.author.profilePicture
            ? `http://localhost:5000/uploads/${post.author.profilePicture}`
            : null;
          console.log('[GET /api/posts/feed] Post data:', {
            title: post.title,
            imageUrls,
            author: {
              username: post.author.username,
              profilePicture: authorProfilePicture,
              rawProfilePicture: post.author.profilePicture,
            },
          });
          return {
            id: post.id,
            title: post.title,
            description: post.description,
            location: post.location,
            price: post.price,
            bedrooms: post.bedrooms,
            bathrooms: post.bathrooms,
            squareMeters: post.squareMeters,
            imageUrls,
            likes: post._count.likes,
            createdAt: post.createdAt.toISOString(),
            author: {
              id: post.author.id.toString(),
              username: post.author.username,
              profilePicture: authorProfilePicture,
            }
          };
        });
  
        console.log('[GET /api/posts/feed] Fetched posts:', formattedPosts.length);
        res.json(formattedPosts);
      } catch (error) {
        console.error('[GET /api/posts/feed] Error:', error.message, error.stack);
        res.status(500).json({ message: 'Ошибка сервера' });
      }
    }

    async toggleLike(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const postId = parseInt(req.params.postId);
            console.log(`[POST /api/posts/${postId}/like] Toggling like for userId: ${userId}`, { user: req.user });

            if (isNaN(userId) || isNaN(postId)) {
                console.log(`[POST /api/posts/${postId}/like] Invalid userId or postId`, { userId: req.user.id, postId: req.params.postId });
                return res.status(400).json({ message: 'Недействительный ID пользователя или поста' });
            }

            const post = await prisma.post.findUnique({
                where: { id: postId },
            });

            if (!post) {
                console.log(`[POST /api/posts/${postId}/like] Post not found`);
                return res.status(404).json({ message: 'Пост не найден' });
            }

            const existingLike = await prisma.like.findFirst({
                where: {
                    userId: userId,
                    postId: postId,
                },
            });

            if (existingLike) {
                await prisma.like.delete({
                    where: { id: existingLike.id },
                });
                console.log(`[POST /api/posts/${postId}/like] Like removed`);
            } else {
                await prisma.like.create({
                    data: {
                        userId: userId,
                        postId: postId,
                    },
                });
                console.log(`[POST /api/posts/${postId}/like] Like added`);
            }

            const updatedLikes = await prisma.like.findMany({
                where: { postId: postId },
            });

            res.json({ likes: updatedLikes.map(like => like.userId) });
        } catch (error) {
            console.error(`[POST /api/posts/${req.params.postId}/like] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера', error: error.message });
        }
    }
}

module.exports = new PostsController();