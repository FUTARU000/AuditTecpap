-- Phase 7.6 — Enterprise Document Experience

-- CreateTable: document_comments
CREATE TABLE "document_comments" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "previousBodies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: document_acknowledgements
CREATE TABLE "document_acknowledgements" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: document_collections
CREATE TABLE "document_collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: document_collection_items
CREATE TABLE "document_collection_items" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: document_bookmarks
CREATE TABLE "document_bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "versionId" TEXT,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_comments_documentId_idx" ON "document_comments"("documentId");
CREATE INDEX "document_comments_parentId_idx" ON "document_comments"("parentId");
CREATE UNIQUE INDEX "document_acknowledgements_documentId_versionId_userId_key" ON "document_acknowledgements"("documentId", "versionId", "userId");
CREATE INDEX "document_acknowledgements_documentId_idx" ON "document_acknowledgements"("documentId");
CREATE UNIQUE INDEX "document_collection_items_collectionId_documentId_key" ON "document_collection_items"("collectionId", "documentId");
CREATE UNIQUE INDEX "document_bookmarks_userId_type_entityId_key" ON "document_bookmarks"("userId", "type", "entityId");
CREATE INDEX "document_bookmarks_userId_idx" ON "document_bookmarks"("userId");

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "controlled_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "document_comments"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_acknowledgements" ADD CONSTRAINT "document_acknowledgements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "controlled_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_acknowledgements" ADD CONSTRAINT "document_acknowledgements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_collections" ADD CONSTRAINT "document_collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_collection_items" ADD CONSTRAINT "document_collection_items_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "document_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_collection_items" ADD CONSTRAINT "document_collection_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "controlled_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_bookmarks" ADD CONSTRAINT "document_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
