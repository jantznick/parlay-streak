import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Parlay Streak API',
      version: '1.0.0',
      description: 'Backend API for Parlay Streak sports prediction game',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3001}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'parlay.sid',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/swagger/*.yaml'],
};

export const swaggerSpec = swaggerJsdoc(options);

