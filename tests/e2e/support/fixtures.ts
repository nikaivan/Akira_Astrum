import { test as base } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { createE2EBlog, createE2EUser, deleteE2EBlog, deleteE2EUser, type E2EBlog, type E2EUser } from "./service-role";

type Users = { admin: E2EUser; user: E2EUser };

const octet = () => randomBytes(1)[0];
/** Una IP distinta por test: el límite de intentos es por IP y no debe afectar a otros tests. */
export const randomIp = () => `10.${octet()}.${octet()}.${1 + (octet() % 254)}`;

export const test = base.extend<object, { users: Users; blog: E2EBlog }>({
  // Los usuarios temporales solo se crean si un test los pide (los tests sin Supabase no los piden).
  users: [
    async ({}, provide) => {
      const runId = `itest-e2e-${randomBytes(4).toString("hex")}`;
      const [admin, user] = await Promise.all([
        createE2EUser(runId, "admin", "admin"),
        createE2EUser(runId, "user", "user"),
      ]);
      try {
        await provide({ admin, user });
      } finally {
        await Promise.all([deleteE2EUser(admin.id), deleteE2EUser(user.id)]);
      }
    },
    { scope: "worker" },
  ],

  // Datos del blog público: solo se crean si un test los pide. Un juego por trabajador (escritorio y móvil
  // no comparten datos), siempre con el prefijo itest-e2e- para que la limpieza los encuentre.
  blog: [
    async ({ users }, provide) => {
      const blog = await createE2EBlog(`itest-e2e-${randomBytes(4).toString("hex")}`, users.admin.id);
      try {
        await provide(blog);
      } finally {
        await deleteE2EBlog(blog);
      }
    },
    { scope: "worker" },
  ],

  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": randomIp() });
  },
});

export { expect } from "@playwright/test";
