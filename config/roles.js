const prisma = require('../prisma/client');

const initializeRoles = async() => {
    try {
        const userRole = await prisma.roles.upsert({
            where: { value: 'user' },
            update: {},
            create: { value: 'user' },
        });
        const adminRole = await prisma.roles.upsert({
            where: { value: 'admin' },
            update: {},
            create: { value: 'admin' },
        });
        console.log('Roles initialized:', { userRole, adminRole });
    } catch (error) {
        console.log('Error initializing roles:', error);
    }
};

module.exports = initializeRoles;