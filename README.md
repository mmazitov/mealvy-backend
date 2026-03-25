# Mealvy Backend API

GraphQL API для Mealvy - застосунку для планування меню та управління продуктами.

## Tech Stack

- **Node.js** + **Express**
- **Apollo Server** (GraphQL)
- **Prisma** (MongoDB ORM)
- **TypeScript**
- **Passport.js** (OAuth authentication)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Створи `.env` файл на основі `.env.example`:

```bash
cp .env.example .env
```

Заповни необхідні змінні:
- `DATABASE_URL` - MongoDB connection string
- `JWT_SECRET` - secret для JWT tokens
- `SESSION_SECRET` - secret для sessions
- `CLIENT_URL` - URL твого frontend (для CORS та OAuth redirects)
- OAuth credentials (Google, GitHub, Facebook)

### 3. Prisma setup

```bash
npm run prisma:generate  # Generate Prisma Client
npm run prisma:push      # Push schema to database
```

### 4. Run development server

```bash
npm run dev
```

Server буде доступний на `http://localhost:4000/graphql`

## Scripts

- `npm run dev` - запустити development server з hot reload
- `npm run build` - build для production
- `npm start` - запустити production server
- `npm run prisma:generate` - згенерувати Prisma Client
- `npm run prisma:push` - синхронізувати schema з DB
- `npm run prisma:studio` - відкрити Prisma Studio

## Deployment (Render)

### Automatic deployment

1. Push код до GitHub
2. В Render Dashboard:
   - Create New → Web Service
   - Connect repository
   - Render автоматично знайде `render.yaml`
3. Додай environment variables через Render UI або використай `sync: false` у `render.yaml`

### Manual deployment

```bash
npm run build
npm start
```

## GraphQL Endpoint

- **Development**: `http://localhost:4000/graphql`
- **Production**: `https://mealvy-api.onrender.com/graphql`

## OAuth Callbacks

Переконайся, що в OAuth providers (Google, GitHub, Facebook) додані правильні callback URLs:

- **Development**: `http://localhost:4000/auth/{provider}/callback`
- **Production**: `https://mealvy-api.onrender.com/auth/{provider}/callback`

## Environment Variables

Детальний список всіх змінних дивись у `.env.example`
