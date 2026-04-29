import { describe, it, expect } from "vitest";
import { parseContractString } from "../../src/parser.js";
import {
  resolveRefs,
  collectRefs,
  validateRefs,
  RefResolutionError,
} from "../../src/ref-resolver.js";

describe("collectRefs", () => {
  it("collects all $ref strings", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Ref Test
  version: 0.1.0
commandSets:
  x:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/Result'
          '2':
            description: Error.
            stderr:
              format: json
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
    Result:
      type: object
    Error:
      type: object
`);
    const refs = collectRefs(doc);
    expect(refs).toContain("#/components/schemas/Result");
    expect(refs).toContain("#/components/schemas/Error");
    expect(refs.length).toBe(2);
  });
});

describe("validateRefs", () => {
  it("validates all internal refs resolve", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Valid Refs
  version: 0.1.0
commandSets:
  x:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/Result'
components:
  schemas:
    Result:
      type: object
`);
    const result = validateRefs(doc);
    expect(result.valid).toBe(true);
    expect(result.unresolvedRefs).toEqual([]);
  });

  it("detects unresolved refs", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Bad Refs
  version: 0.1.0
commandSets:
  x:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/Missing'
`);
    const result = validateRefs(doc);
    expect(result.valid).toBe(false);
    expect(result.unresolvedRefs).toContain("#/components/schemas/Missing");
  });
});

describe("resolveRefs", () => {
  it("resolves internal $ref pointers", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Resolve Test
  version: 0.1.0
commandSets:
  x:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/Result'
components:
  schemas:
    Result:
      type: object
      required: [status]
      properties:
        status:
          type: string
`);
    const resolved = resolveRefs(doc);
    const schema = resolved.commandSets.x.commands.hello.exits["0"].stdout?.schema;
    expect(schema).toBeDefined();
    expect(schema?.type).toBe("object");
    expect(schema?.required).toEqual(["status"]);
    expect(schema?.properties?.status?.type).toBe("string");
    // $ref should be gone
    expect(schema?.$ref).toBeUndefined();
  });

  it("throws on circular refs", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Circular
  version: 0.1.0
commandSets:
  x:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/A'
components:
  schemas:
    A:
      $ref: '#/components/schemas/B'
    B:
      $ref: '#/components/schemas/A'
`);
    expect(() => resolveRefs(doc)).toThrow(RefResolutionError);
  });

  it("leaves external refs untouched", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: External Ref
  version: 0.1.0
commandSets:
  x:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                $ref: ./schemas/external.json
`);
    const resolved = resolveRefs(doc);
    const schema = resolved.commandSets.x.commands.hello.exits["0"].stdout?.schema;
    expect(schema?.$ref).toBe("./schemas/external.json");
  });
});
