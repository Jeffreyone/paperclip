import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./dist/schema/*.js",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    url: process.env.DATABASE_URL!,
  },
});
