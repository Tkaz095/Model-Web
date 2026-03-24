# Backend Setup for 3D-Model-Web

This project is configured with **Express**, **TypeScript**, **Prisma ORM**, and **PostgreSQL**.
Everything is pre-configured to run as containers via **Docker Compose**.

## Prerequisites
- Node.js (v20+ recommended)
- Docker & Docker Compose

## Quick Start (Docker)

To run both the PostgreSQL database and the API backend simultaneously using Docker Compose:

1. Open a terminal in the `Backend` directory.
2. Run the following command:
   ```bash
   docker-compose up -d --build
   ```
3. Docker will build the API image, start the PostgreSQL container, wait for it to be healthy, and then start the API server.
4. You can see the logs using:
   ```bash
   docker-compose logs -f api
   ```
5. The API server will be available at: **http://localhost:3000/health**

## Local Development (Without Docker for API)

If you prefer to run the Node app locally while the database runs on Docker:

1. Start only the PostgreSQL database using Docker Compose:
   ```bash
   docker-compose up -d db
   ```
2. Install local dependencies:
   ```bash
   npm install
   ```
3. Generate the Prisma Client and migrate the local database:
   ```bash
   npx prisma generate
   npm run db:migrate
   ```
4. Start the development server (runs with nodemon):
   ```bash
   npm run dev
   ```
5. The server will be available at: **http://localhost:3000/health**

## Adding More Models

1. Add your models to `prisma/schema.prisma`.
2. Generate the Prisma Client: `npx prisma generate`.
3. Create a migration and execute it: `npm run db:migrate`.
4. Import and use the model in your `src` files.
