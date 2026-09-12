const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const knowledgeVault = require("../vault/knowledgeVault");

const queryKnowledgeVaultTool = tool(async ({ query, limit = 4 }) => {
  const results = knowledgeVault.queryKnowledge(query, limit);
  if (results.length === 0) {
    return `No matching documents found in Knowledge Vault for query: "${query}".`;
  }
  return JSON.stringify(results, null, 2);
}, {
  name: "query_knowledge_vault",
  description: "Query and retrieve user-provided documents, architectural notes, code snippets, and imported web content with source references.",
  schema: z.object({
    query: z.string().describe("The knowledge topic or search query to look up in the vault."),
    limit: z.number().optional().default(4).describe("Maximum number of results.")
  })
});

const ingestVaultDocumentTool = tool(async ({ title, content, category = 'note', tags = [], sourcePath = 'manual' }) => {
  const doc = knowledgeVault.ingestDocument(title, content, category, tags, sourcePath);
  return JSON.stringify({ success: true, docId: doc.id, title: doc.title, message: `Document "${title}" indexed in Knowledge Vault.` });
}, {
  name: "ingest_vault_document",
  description: "Ingest a new note, document, code snippet, or web content into the Knowledge Vault for persistent reference.",
  schema: z.object({
    title: z.string().describe("Title or identifier of the document."),
    content: z.string().describe("Full text content of the document."),
    category: z.enum(['document', 'note', 'code_snippet', 'web_import']).optional().default('note').describe("Category of document."),
    tags: z.array(z.string()).optional().default([]).describe("Relevant search tags."),
    sourcePath: z.string().optional().default('manual').describe("File path or URL source.")
  })
});

module.exports = {
  queryKnowledgeVaultTool,
  ingestVaultDocumentTool
};
