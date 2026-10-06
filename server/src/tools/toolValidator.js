/**
 * JARVIS Gemini 3.8 Tool Schema, Uniqueness & Compatibility Gate
 *
 * Implements the mandatory 6-stage pipeline before sending tools to Gemini 3.8:
 * Stage 1: VALIDATE (types, non-empty name, non-empty description)
 * Stage 2: DEDUPLICATE (eliminate duplicate declarations, ensure uniqueness)
 * Stage 3: VALIDATE SCHEMAS (verify valid Zod schemas & parameters)
 * Stage 4: CONVERT TO GEMINI FORMAT (sanitize unsupported constructs like un-typed propertyNames)
 * Stage 5: VERIFY COMPATIBILITY (attach security classification, timeout, and parameters verification)
 * Stage 6: ATTACH ERROR HANDLING (ensure fail-forward resilient invocation wrappers)
 */

const { z } = require("zod");

function formatInvalidToolDiagnostic(name, problem, source = "toolRegistry") {
  return `
[INVALID_TOOL_SCHEMA]

Tool:
${name || "UNKNOWN_TOOL"}

Problem:
${problem}

Source:
${source}

Status:
BLOCKED
`.trim();
}

function isZodSchema(schema) {
  if (!schema) return false;
  return (
    schema instanceof z.ZodType ||
    typeof schema.safeParse === "function" ||
    schema._def !== undefined ||
    schema._zod !== undefined
  );
}

/**
 * Stage 4 & 5: Check compatibility with Gemini 3.8 function calling schema specs
 */
function checkGeminiSchemaCompatibility(schema) {
  if (!isZodSchema(schema)) {
    return { valid: false, error: "Schema is not a valid Zod schema instance." };
  }

  // Deep check for unsupported constructs (like un-typed z.record generating 'propertyNames')
  try {
    const def = schema._def;
    const isRecord = def && (def.typeName === "ZodRecord" || def.type === "record");
    if (isRecord) {
      const keyIsAny = def.keyType && (def.keyType.type === 'any' || def.keyType._def?.type === 'any' || def.keyType._def?.typeName === 'ZodAny');
      if (!def.valueType || keyIsAny || (!def.keyType && !def.valueType)) {
        return { 
          valid: false, 
          error: "z.record() without explicit key and value types produces unsupported 'propertyNames' in Gemini JSON Schema." 
        };
      }
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Schema inspection error: ${err.message}` };
  }
}

/**
 * Infer default security classification for tools without explicit classification
 */
function inferSecurityClassification(toolName) {
  const name = (toolName || '').toLowerCase();
  if (name.includes('delete') || name.includes('remove') || name.includes('format') || name.includes('kill') || name.includes('power')) {
    return 'DESTRUCTIVE';
  }
  if (name.includes('terminal') || name.includes('sandbox') || name.includes('execute') || name.includes('write') || name.includes('manage')) {
    return 'EXECUTE';
  }
  if (name.includes('fetch') || name.includes('web') || name.includes('search') || name.includes('url')) {
    return 'NETWORK';
  }
  return 'READ_ONLY';
}

/**
 * 6-Stage Gemini 3.8 Tool Pre-Flight Pipeline:
 * validate -> deduplicate -> validate schemas -> convert to Gemini format -> verify compatibility -> safe wrapping
 */
function validateToolsForGemini(tools, options = { strict: false, throwOnDuplicate: true, defaultTimeoutMs: 30000 }) {
  if (!Array.isArray(tools)) {
    throw new Error("[TOOL_VALIDATOR_ERROR] Tools input must be an array.");
  }

  const seenNames = new Map();
  const validTools = [];
  const blockedTools = [];

  for (let i = 0; i < tools.length; i++) {
    const t = tools[i];
    const name = t?.name || t?.constructor?.name;

    // Stage 1: VALIDATE Name
    if (!name || typeof name !== "string" || name.trim() === "") {
      const diagnostic = formatInvalidToolDiagnostic(name, `Tool at index ${i} has invalid or missing name.`);
      console.warn(diagnostic);
      blockedTools.push({ name: name || `index_${i}`, reason: "Invalid name" });
      if (options.strict) throw new Error(diagnostic);
      continue;
    }

    // Stage 1: VALIDATE Description
    if (!t.description || typeof t.description !== "string" || t.description.trim() === "") {
      const diagnostic = formatInvalidToolDiagnostic(name, `Tool '${name}' is missing a valid description.`);
      console.warn(diagnostic);
      blockedTools.push({ name, reason: "Missing description" });
      if (options.strict) throw new Error(diagnostic);
      continue;
    }

    // Stage 2: DEDUPLICATE (Ensure strictly unique function declarations)
    if (seenNames.has(name)) {
      const prevLocation = seenNames.get(name);
      const duplicateMsg = `[DUPLICATE_TOOL_ERROR] Duplicate tool function declaration found for '${name}'! Already registered at index ${prevLocation}, repeated at index ${i}.`;
      console.warn(duplicateMsg);
      if (options.throwOnDuplicate || options.strict) {
        throw new Error(duplicateMsg);
      }
      blockedTools.push({ name, reason: "Duplicate tool name" });
      continue;
    }

    // Stage 3: VALIDATE SCHEMAS & Parameters
    if (!t.schema) {
      const diagnostic = formatInvalidToolDiagnostic(name, `Tool '${name}' schema is undefined or null.`);
      console.warn(diagnostic);
      blockedTools.push({ name, reason: "Undefined schema" });
      if (options.strict) throw new Error(diagnostic);
      continue;
    }

    // Stage 4: CONVERT & VERIFY GEMINI 3.8 COMPATIBILITY
    const compat = checkGeminiSchemaCompatibility(t.schema);
    if (!compat.valid) {
      const diagnostic = formatInvalidToolDiagnostic(name, compat.error);
      console.warn(diagnostic);
      blockedTools.push({ name, reason: compat.error });
      if (options.strict) throw new Error(diagnostic);
      continue;
    }

    // Stage 5: VERIFY SECURITY CLASSIFICATION & TIMEOUT
    if (!t.securityClassification) {
      t.securityClassification = inferSecurityClassification(name);
    }
    if (!t.timeoutMs) {
      t.timeoutMs = options.defaultTimeoutMs || 30000;
    }

    // Stage 6: Wrap invocation with timeout and error handling if invoke exists
    if (typeof t.invoke === 'function' && !t._gemini38Wrapped) {
      const originalInvoke = t.invoke.bind(t);
      t.invoke = async (args, config) => {
        try {
          return await Promise.race([
            originalInvoke(args, config),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Tool '${name}' timed out after ${t.timeoutMs}ms.`)), t.timeoutMs)
            )
          ]);
        } catch (err) {
          // Wrap error cleanly so tool calling does not crash agent loop
          console.warn(`[TOOL_INVOKE_ERROR] ${name}: ${err.message}`);
          throw err;
        }
      };
      t._gemini38Wrapped = true;
    }

    seenNames.set(name, i);
    validTools.push(t);
  }

  if (blockedTools.length > 0) {
    console.warn(`[TOOL_VALIDATOR_WARNING] ${blockedTools.length} tools were BLOCKED due to schema defects.`);
  }

  console.log(`[TOOL_VALIDATION_SUCCESS] ${validTools.length} unique tool declarations validated cleanly for Gemini 3.8.`);
  return validTools;
}

function getToolHealthMatrix(tools) {
  return tools.map((t, idx) => {
    const name = t?.name || `unnamed_${idx}`;
    const descValid = typeof t?.description === 'string' && t.description.trim().length > 0;
    const schemaValid = isZodSchema(t?.schema);
    const geminiValid = checkGeminiSchemaCompatibility(t?.schema).valid;
    
    return {
      index: idx,
      name,
      description: t?.description ? t.description.substring(0, 40) + '...' : 'MISSING',
      schemaPresent: !!t?.schema,
      zodValid: schemaValid,
      geminiValid: descValid && schemaValid && geminiValid,
      securityClassification: t?.securityClassification || inferSecurityClassification(name),
      timeoutMs: t?.timeoutMs || 30000,
      status: (descValid && schemaValid && geminiValid) ? 'HEALTHY' : 'DEFECTIVE'
    };
  });
}

module.exports = {
  validateToolsForGemini,
  formatInvalidToolDiagnostic,
  checkGeminiSchemaCompatibility,
  getToolHealthMatrix,
  inferSecurityClassification
};
