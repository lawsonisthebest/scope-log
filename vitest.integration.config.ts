import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
config({path:".env.local",quiet:true});
export default defineConfig({resolve:{alias:{"@":fileURLToPath(new URL(".",import.meta.url))}},test:{include:["tests/integration/**/*.test.ts"],environment:"node",testTimeout:30000,hookTimeout:30000,fileParallelism:false}});
