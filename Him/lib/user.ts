export const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || "local-user";

export async function ensureLocalUser() {
  const { prisma } = await import("./prisma");
  const user = await prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {},
    create: { id: DEFAULT_USER_ID, name: "Me" },
  });
  return user;
}
