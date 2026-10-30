import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/mastra/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['prdforge'],
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
