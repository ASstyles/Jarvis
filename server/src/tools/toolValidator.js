/**
 * JARVIS Gemini Tool Schema & Uniqueness Validator Gate
 * Inspects tool function declarations before sending them to LLM APIs.
 * Prevents malformed, undefined, duplicate, or incompatible schemas from reaching Gemini.
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

function checkGeminiSchemaCompatibility(schema) {
  if (!isZodSchema(schema)) {
    return { valid: false, error: "Schema is not a valid Zod schema instance." };
  }

  // Deep check for unsupported constructs (like un-typed z.record generating 'propertyNames')
  try {
    const def = schema._def;
    if (def && def.typeName === "ZodRecord" && (!def.valueType || !def.keyType)) {
      return { valid: false, error: "z.record() without explicit key and value types produces unsupported 'propertyNames' in Gemini JSON Schema." };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Schema inspection error: ${err.message}` };
  }
}

function validateToolsForGemini(tools, options = { strict: false, throwOnDuplicate: true }) {
  if (!Array.isArray(tools)) {
    throw new Error("[TOOL_VALIDATOR_ERROR] Tools input must be an array.");
  }

  const seenNames = new Map();
  const validTools = [];
  const blockedTools = [];

  for (let i = 0; i < tools.length; i++) {
    const t = tools[i];
    const name = t?.name || t?.constructor?.name;

    // 1. Validate Name
    if (!name || typeof name !== "string" || name.trim() === "") {
      const diagnostic = formatInvalidToolDiagnostic(name, `Tool at index ${i} has invalid or missing name.`);
      console.warn(diagnostic);
      blockedTools.push({ name: name || `index_${i}`, reason: "Invalid name" });
      if (options.strict) throw new Error(diagnostic);
      continue;
    }

    // 2. Validate Description
    if (!t.description || typeof t.description !== "string" || t.description.trim() === "") {
      const diagnostic = formatInvalidToolDiagnostic(name, `Tool '${name}' is missing a valid description.`);
      console.warn(diagnostic);
      blockedTools.push({ name, reason: "Missing description" });
      if (options.strict) throw new Error(diagnostic);
      continue;
    }

    // 3. Validate Uniqueness
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

    // 4. Validate Schema existence
    if (!t.schema) {
      const diagnostic = formatInvalidToolDiagnostic(name, `Tool '${name}' schema is undefined or null.`);
      console.warn(diagnostic);
      blockedTools.push({ name, reason: "Undefined schema" });
      if (options.strict) throw new Error(diagnostic);
      continue;
    }

    // 5. Validate Zod & Gemini Compatibility
    const compat = checkGeminiSchemaCompatibility(t.schema);
    if (!compat.valid) {
      const diagnostic = formatInvalidToolDiagnostic(name, compat.error);
      console.warn(diagnostic);
      blockedTools.push({ name, reason: compat.error });
      if (options.strict) throw new Error(diagnostic);
      continue;
    }

    seenNames.set(name, i);
    validTools.push(t);
  }

  if (blockedTools.length > 0) {
    console.warn(`[TOOL_VALIDATOR_WARNING] ${blockedTools.length} tools were BLOCKED due to schema defects.`);
  }

  console.log(`[TOOL_VALIDATION_SUCCESS] ${validTools.length} unique tool declarations validated cleanly.`);
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
      status: (descValid && schemaValid && geminiValid) ? 'HEALTHY' : 'DEFECTIVE'
    };
  });
}

module.exports = {
  validateToolsForGemini,
  formatInvalidToolDiagnostic,
  checkGeminiSchemaCompatibility,
  getToolHealthMatrix
};
