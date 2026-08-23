import { hashPassword } from '../lib/crypto.js';

function resolveBootstrapEmail(username, email) {
  if (email) return email.toLowerCase();
  return username.includes('@') ? username.toLowerCase() : null;
}

export async function bootstrapMasterAdmin(prisma, { username, password, email }) {
  const resolvedEmail = resolveBootstrapEmail(username, email);
  const existing = await prisma.masterAdmin.findFirst({
    where: {
      OR: [
        { username },
        ...(resolvedEmail ? [{ email: resolvedEmail }] : [])
      ]
    }
  });
  if (existing) {
    return { created: false, masterAdmin: existing };
  }
  const passwordHash = await hashPassword(password);
  const masterAdmin = await prisma.masterAdmin.create({
    data: {
      username,
      email: resolvedEmail,
      passwordHash,
      status: 'active'
    }
  });
  return { created: true, masterAdmin };
}
