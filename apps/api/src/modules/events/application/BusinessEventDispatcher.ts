import { logger } from "../../../utils/logger.js";
import { salesAccountingHandler } from "../../sales/application/SalesAccountingHandler.js";
import type { BusinessEventEnvelope } from "./BusinessEvent.js";
import type { BusinessEventHandler } from "./BusinessEventHandler.js";

export class BusinessEventDispatcher {
  constructor(private readonly handlers: BusinessEventHandler[] = [salesAccountingHandler]) {}

  async dispatch(envelope: BusinessEventEnvelope) {
    let handledCount = 0;
    for (const handler of this.handlers) {
      if (!handler.canHandle(envelope)) {
        continue;
      }
      await handler.handle(envelope);
      handledCount += 1;
      logger.info("Business event handled", {
        eventName: envelope.event.eventName,
        sourceEntityId: envelope.event.sourceEntityId,
        handlerName: handler.name
      });
    }

    return { handledCount };
  }
}

export const businessEventDispatcher = new BusinessEventDispatcher();
