-- CreateTable
CREATE TABLE "MasterAdmin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterAdminRefreshToken" (
    "id" TEXT NOT NULL,
    "masterAdminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterAdminRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterAdmin_username_key" ON "MasterAdmin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "MasterAdmin_email_key" ON "MasterAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MasterAdminRefreshToken_tokenHash_key" ON "MasterAdminRefreshToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "MasterAdminRefreshToken" ADD CONSTRAINT "MasterAdminRefreshToken_masterAdminId_fkey" FOREIGN KEY ("masterAdminId") REFERENCES "MasterAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
