import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { requireCompanyContext, requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { accountingAccountService } from "../../application/AccountingAccountService.js";
import { accountingPeriodService } from "../../application/AccountingPeriodService.js";
import { generalLedgerService } from "../../application/GeneralLedgerService.js";
import { journalEntryService } from "../../application/JournalEntryService.js";
import { trialBalanceService } from "../../application/TrialBalanceService.js";
import {
  accountingAccountBlockSchema,
  accountingAccountIdParamsSchema,
  accountingAccountListQuerySchema,
  accountingAccountPayloadSchema
} from "../../validators/accounting-account.validators.js";
import {
  accountingPeriodCreateSchema,
  accountingPeriodIdParamsSchema,
  accountingPeriodListQuerySchema,
  accountingPeriodReopenSchema,
  accountingPeriodUpdateSchema
} from "../../validators/accounting-period.validators.js";
import {
  generalLedgerAccountParamsSchema,
  generalLedgerCostCenterParamsSchema,
  generalLedgerDetailQuerySchema,
  generalLedgerQuerySchema
} from "../../validators/general-ledger.validators.js";
import {
  journalEntryCreateSchema,
  journalEntryIdParamsSchema,
  journalEntryLineIdParamsSchema,
  journalEntryLinePayloadSchema,
  journalEntryListQuerySchema,
  journalEntryPostSchema,
  journalEntryUpdateSchema
} from "../../validators/journal-entry.validators.js";
import { trialBalanceQuerySchema } from "../../validators/trial-balance.validators.js";

export const accountingRouter = Router();

accountingRouter.use(requireAuth, requireTenantContext, requireCompanyContext);

function accountingContext(request: Parameters<typeof getRequestContext>[0]) {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext!.companyId!,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId
  };
}

accountingRouter.get(
  "/trial-balance",
  validateRequest({ query: trialBalanceQuerySchema }),
  requirePermission("accounting", "accounting.trial-balance.read"),
  asyncHandler(async (request, response) => {
    const result = await trialBalanceService.listAccounts(accountingContext(request), request.query);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/trial-balance/summary",
  validateRequest({ query: trialBalanceQuerySchema }),
  requirePermission("accounting", "accounting.trial-balance.read"),
  asyncHandler(async (request, response) => {
    const result = await trialBalanceService.getSummary(accountingContext(request), request.query);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/general-ledger",
  validateRequest({ query: generalLedgerDetailQuerySchema }),
  requirePermission("accounting", "accounting.general-ledger.read"),
  asyncHandler(async (request, response) => {
    const result = await generalLedgerService.listEntries(accountingContext(request), request.query);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/general-ledger/summary",
  validateRequest({ query: generalLedgerQuerySchema }),
  requirePermission("accounting", "accounting.general-ledger.read"),
  asyncHandler(async (request, response) => {
    const result = await generalLedgerService.getSummary(accountingContext(request), request.query);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/general-ledger/accounts",
  validateRequest({ query: generalLedgerQuerySchema }),
  requirePermission("accounting", "accounting.general-ledger.read"),
  asyncHandler(async (request, response) => {
    const result = await generalLedgerService.listAccountSummaries(accountingContext(request), request.query);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/general-ledger/accounts/:accountId",
  validateRequest({ params: generalLedgerAccountParamsSchema, query: generalLedgerQuerySchema }),
  requirePermission("accounting", "accounting.general-ledger.read"),
  asyncHandler(async (request, response) => {
    const result = await generalLedgerService.getAccountLedger(
      accountingContext(request),
      request.params.accountId!,
      request.query
    );

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/general-ledger/accounts/:accountId/periods",
  validateRequest({ params: generalLedgerAccountParamsSchema, query: generalLedgerQuerySchema }),
  requirePermission("accounting", "accounting.general-ledger.read"),
  asyncHandler(async (request, response) => {
    const result = await generalLedgerService.listAccountPeriodSummaries(
      accountingContext(request),
      request.params.accountId!,
      request.query
    );

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/general-ledger/cost-centers/:costCenterId",
  validateRequest({ params: generalLedgerCostCenterParamsSchema, query: generalLedgerQuerySchema }),
  requirePermission("accounting", "accounting.general-ledger.read"),
  asyncHandler(async (request, response) => {
    const result = await generalLedgerService.listCostCenterEntries(
      accountingContext(request),
      request.params.costCenterId!,
      request.query
    );

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/journal-entries",
  validateRequest({ query: journalEntryListQuerySchema }),
  requirePermission("accounting", "accounting.journal-entries.read"),
  asyncHandler(async (request, response) => {
    const result = await journalEntryService.listEntries(accountingContext(request), request.query);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/journal-entries/:id",
  validateRequest({ params: journalEntryIdParamsSchema }),
  requirePermission("accounting", "accounting.journal-entries.read"),
  asyncHandler(async (request, response) => {
    const result = await journalEntryService.getEntry(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/journal-entries/:id/lines",
  validateRequest({ params: journalEntryIdParamsSchema }),
  requirePermission("accounting", "accounting.journal-entries.read"),
  asyncHandler(async (request, response) => {
    const result = await journalEntryService.listLines(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/journal-entries",
  validateRequest({ body: journalEntryCreateSchema }),
  requirePermission("accounting", "accounting.journal-entries.create"),
  asyncHandler(async (request, response) => {
    const result = await journalEntryService.createEntry(accountingContext(request), request.body);

    sendSuccess(response, result, 201);
  })
);

accountingRouter.patch(
  "/journal-entries/:id",
  validateRequest({ params: journalEntryIdParamsSchema, body: journalEntryUpdateSchema }),
  requirePermission("accounting", "accounting.journal-entries.update"),
  asyncHandler(async (request, response) => {
    const result = await journalEntryService.updateEntry(accountingContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/journal-entries/:id/lines",
  validateRequest({ params: journalEntryIdParamsSchema, body: journalEntryLinePayloadSchema }),
  requirePermission("accounting", "accounting.journal-entries.update"),
  asyncHandler(async (request, response) => {
    const result = await journalEntryService.addLine(accountingContext(request), request.params.id!, request.body);

    sendSuccess(response, result, 201);
  })
);

accountingRouter.patch(
  "/journal-entries/:id/lines/:lineId",
  validateRequest({ params: journalEntryLineIdParamsSchema, body: journalEntryLinePayloadSchema }),
  requirePermission("accounting", "accounting.journal-entries.update"),
  asyncHandler(async (request, response) => {
    const result = await journalEntryService.updateLine(
      accountingContext(request),
      request.params.id!,
      request.params.lineId!,
      request.body
    );

    sendSuccess(response, result);
  })
);

accountingRouter.delete(
  "/journal-entries/:id/lines/:lineId",
  validateRequest({ params: journalEntryLineIdParamsSchema }),
  requirePermission("accounting", "accounting.journal-entries.update"),
  asyncHandler(async (request, response) => {
    const result = await journalEntryService.deleteLine(
      accountingContext(request),
      request.params.id!,
      request.params.lineId!
    );

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/journal-entries/:id/post",
  validateRequest({ params: journalEntryIdParamsSchema, body: journalEntryPostSchema }),
  requirePermission("accounting", "accounting.journal-entries.post"),
  asyncHandler(async (request, response) => {
    const result = await journalEntryService.postEntry(accountingContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/accounts",
  validateRequest({ query: accountingAccountListQuerySchema }),
  requirePermission("accounting", "accounting.accounts.read"),
  asyncHandler(async (request, response) => {
    const result = await accountingAccountService.listAccounts(accountingContext(request), request.query);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/accounts/:id",
  validateRequest({ params: accountingAccountIdParamsSchema }),
  requirePermission("accounting", "accounting.accounts.read"),
  asyncHandler(async (request, response) => {
    const result = await accountingAccountService.getAccount(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/accounts/:id/children",
  validateRequest({ params: accountingAccountIdParamsSchema }),
  requirePermission("accounting", "accounting.accounts.read"),
  asyncHandler(async (request, response) => {
    const result = await accountingAccountService.listChildren(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/accounts",
  validateRequest({ body: accountingAccountPayloadSchema }),
  requirePermission("accounting", "accounting.accounts.create"),
  asyncHandler(async (request, response) => {
    const result = await accountingAccountService.createAccount(accountingContext(request), request.body);

    sendSuccess(response, result, 201);
  })
);

accountingRouter.patch(
  "/accounts/:id",
  validateRequest({ params: accountingAccountIdParamsSchema, body: accountingAccountPayloadSchema }),
  requirePermission("accounting", "accounting.accounts.update"),
  asyncHandler(async (request, response) => {
    const result = await accountingAccountService.updateAccount(
      accountingContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/accounts/:id/block",
  validateRequest({ params: accountingAccountIdParamsSchema, body: accountingAccountBlockSchema }),
  requirePermission("accounting", "accounting.accounts.block"),
  asyncHandler(async (request, response) => {
    const result = await accountingAccountService.blockAccount(
      accountingContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/accounts/:id/unblock",
  validateRequest({ params: accountingAccountIdParamsSchema }),
  requirePermission("accounting", "accounting.accounts.unblock"),
  asyncHandler(async (request, response) => {
    const result = await accountingAccountService.unblockAccount(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/accounts/:id/activate",
  validateRequest({ params: accountingAccountIdParamsSchema }),
  requirePermission("accounting", "accounting.accounts.activate"),
  asyncHandler(async (request, response) => {
    const result = await accountingAccountService.activateAccount(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/accounts/:id/deactivate",
  validateRequest({ params: accountingAccountIdParamsSchema }),
  requirePermission("accounting", "accounting.accounts.deactivate"),
  asyncHandler(async (request, response) => {
    const result = await accountingAccountService.deactivateAccount(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/periods",
  validateRequest({ query: accountingPeriodListQuerySchema }),
  requirePermission("accounting", "accounting.periods.read"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.listPeriods(accountingContext(request), request.query);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/periods/:id",
  validateRequest({ params: accountingPeriodIdParamsSchema }),
  requirePermission("accounting", "accounting.periods.read"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.getPeriod(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/periods",
  validateRequest({ body: accountingPeriodCreateSchema }),
  requirePermission("accounting", "accounting.periods.create"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.createPeriod(accountingContext(request), request.body);

    sendSuccess(response, result, 201);
  })
);

accountingRouter.patch(
  "/periods/:id",
  validateRequest({ params: accountingPeriodIdParamsSchema, body: accountingPeriodUpdateSchema }),
  requirePermission("accounting", "accounting.periods.update"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.updatePeriod(
      accountingContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/periods/:id/close",
  validateRequest({ params: accountingPeriodIdParamsSchema }),
  requirePermission("accounting", "accounting.periods.close"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.closePeriod(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/periods/:id/reopen",
  validateRequest({ params: accountingPeriodIdParamsSchema, body: accountingPeriodReopenSchema }),
  requirePermission("accounting", "accounting.periods.reopen"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.reopenPeriod(
      accountingContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result);
  })
);

accountingRouter.patch(
  "/periods/:id/deactivate",
  validateRequest({ params: accountingPeriodIdParamsSchema }),
  requirePermission("accounting", "accounting.periods.update"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.deactivatePeriod(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);
