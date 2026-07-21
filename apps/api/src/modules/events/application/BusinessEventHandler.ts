import type { BusinessEventEnvelope } from "./BusinessEvent.js";

export interface BusinessEventHandler {
  readonly name: string;
  canHandle(envelope: BusinessEventEnvelope): boolean;
  handle(envelope: BusinessEventEnvelope): Promise<void>;
}
