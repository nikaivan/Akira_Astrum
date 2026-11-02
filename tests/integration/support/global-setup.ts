import type { TestProject } from "vitest/node";
import { assertTestEnvironment } from "./environment";
import { createSessions, removeEverything, sweepLeftovers, type Fixtures } from "./service-role";

declare module "vitest" {
  export interface ProvidedContext {
    fixtures: Fixtures;
  }
}

export default async function setup(project: TestProject) {
  assertTestEnvironment(process.env); // aborta antes de cualquier petición
  await sweepLeftovers();
  const fixtures = await createSessions();
  project.provide("fixtures", fixtures);
  return () => removeEverything(fixtures.runId);
}
