import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";
import { companyId, respond, withLlmTip } from "./utils.js";

interface Order {
  OrderID: number;
  OrderNumber: string;
  OrderDate: string;
  TotalIncl: number;
  CounterParty: {
    DisplayName: string;
    VATNumber?: string;
  };
}

interface OrdersResponse {
  Items: Order[];
}

interface PeppolLookupResponse {
  Registered: boolean;
}

interface FullOrder {
  OrderID: number;
  OrderNumber: string;
  OrderDate?: string;
  TotalIncl?: number;
  Customer?: {
    DisplayName: string;
    VATNumber?: string;
  };
  CurrentDocumentDeliveryDetails?: {
    IsDocumentDelivered?: boolean;
    DocumentDeliveryStatus?: string;
    ExternalProvider?: string;
  };
  Messages?: Array<{
    SentDate?: string;
    DeliveredDate?: string;
    TransportType?: string;
    ExternalProvider?: string;
  }>;
}

async function batchAll<T>(tasks: (() => Promise<T>)[], batchSize = 5): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    results.push(...await Promise.all(batch.map(fn => fn())));
  }
  return results;
}

function currentYearStart(): string {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
}

const MAX_PAGES = 100;

export function registerWorkflowTools(server: McpServer, client: BillitClient) {
  server.tool(
    "billit_check_peppol_coverage",
    withLlmTip(
      "WORKFLOW (multi-step): Scans all outgoing invoices (Income/Invoice) since a date, deduplicates customers by VAT number, and checks each unique VAT against the Peppol network. Returns two groups: customers NOT on Peppol (priority list for onboarding) and customers already on Peppol.\n\nUSE THIS when the user asks: 'which customers are not on Peppol?', 'who should I onboard to e-invoicing?', 'check Peppol coverage', 'which invoices can't be sent via Peppol?'\nDO NOT use this for a single VAT lookup — use billit_peppol_lookup_participant instead.\n\nOUTPUT: { summary: { period_from, total_customers_with_vat, not_on_peppol, on_peppol }, not_on_peppol: [{ vat, name, invoiceCount, totalAmount, invoices[] }] sorted by totalAmount desc, on_peppol: [{ vat, name, invoiceCount }] }",
      "May be slow if there are many invoices — paginates through all pages automatically. Peppol lookups run in parallel."
    ),
    {
      since_date: z.string().optional()
        .describe("Start date for invoice scan (YYYY-MM-DD). Default: start of current year (YYYY-01-01). Use a recent date to limit scope and improve speed."),
      company_id: companyId,
    },
    async ({ since_date, company_id }) => {
      if (since_date && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(since_date)) {
        return respond("Error: since_date must be ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)");
      }
      const fromDate = since_date ?? currentYearStart();

      // Fetch all outgoing invoices since date (paginate through all pages)
      const allOrders: Order[] = [];
      let skip = 0;
      const pageSize = 120;

      for (let page_num = 0; page_num < MAX_PAGES; page_num++) {
        const filter = `OrderDirection eq 'Income' and OrderType eq 'Invoice' and OrderDate ge datetime'${fromDate}T00:00:00'`;
        const params = new URLSearchParams({
          "$filter": filter,
          "$top": String(pageSize),
          "$skip": String(skip),
          "$orderby": "OrderDate desc",
        });
        const page = await client.request<OrdersResponse>("GET", `/v1/orders?${params.toString()}`, undefined, company_id);
        const items = page?.Items ?? [];
        allOrders.push(...items);
        if (items.length < pageSize) break;
        skip += pageSize;
        if (page_num === MAX_PAGES - 1) throw new Error(`Pagination limit reached (${MAX_PAGES} pages / ${MAX_PAGES * pageSize} items). Use a more recent since_date to narrow scope.`);
      }

      // Deduplicate by VAT number — collect unique VATs with their invoices
      const byVat = new Map<string, { name: string; invoices: Array<{ id: number; number: string; date: string; amount: number }> }>();

      for (const order of allOrders) {
        const vat = order.CounterParty?.VATNumber;
        if (!vat) continue;

        if (!byVat.has(vat)) {
          byVat.set(vat, { name: order.CounterParty.DisplayName, invoices: [] });
        }
        byVat.get(vat)!.invoices.push({
          id: order.OrderID,
          number: order.OrderNumber,
          date: (order.OrderDate ?? "").slice(0, 10),
          amount: order.TotalIncl,
        });
      }

      // Check Peppol registration for each unique VAT (batches of 5)
      const vatList = Array.from(byVat.entries());
      const peppolResults = await batchAll(
        vatList.map(([vat]) => () =>
          client.request<PeppolLookupResponse>("GET", `/v1/peppol/participantInformation/${encodeURIComponent(vat)}`)
            .then(r => ({ vat, registered: r?.Registered ?? false, error: undefined as string | undefined }))
            .catch((e: unknown) => ({ vat, registered: false, error: e instanceof Error ? e.message : "lookup failed" }))
        )
      );

      // Split into registered / not registered / failed
      type InvoiceEntry = { id: number; number: string; date: string; amount: number };
      const notOnPeppol: Array<{ vat: string; name: string; invoiceCount: number; totalAmount: number; invoices: InvoiceEntry[] }> = [];
      const onPeppol: Array<{ vat: string; name: string; invoiceCount: number }> = [];
      const lookupFailed: Array<{ vat: string; name: string; invoiceCount: number; error: string }> = [];

      for (const { vat, registered, error } of peppolResults) {
        const entry = byVat.get(vat)!;
        const totalAmount = entry.invoices.reduce((sum, i) => sum + i.amount, 0);
        if (error) {
          lookupFailed.push({ vat, name: entry.name, invoiceCount: entry.invoices.length, error });
        } else if (registered) {
          onPeppol.push({ vat, name: entry.name, invoiceCount: entry.invoices.length });
        } else {
          notOnPeppol.push({ vat, name: entry.name, invoiceCount: entry.invoices.length, totalAmount, invoices: entry.invoices });
        }
      }

      const result = {
        summary: {
          period_from: fromDate,
          total_customers_with_vat: vatList.length,
          not_on_peppol: notOnPeppol.length,
          on_peppol: onPeppol.length,
          lookup_failed: lookupFailed.length,
        },
        not_on_peppol: notOnPeppol.sort((a, b) => b.totalAmount - a.totalAmount),
        on_peppol: onPeppol,
        ...(lookupFailed.length > 0 ? { lookup_failed: lookupFailed } : {}),
      };

      return respond(JSON.stringify(result, null, 2));
    },
  );

  server.tool(
    "billit_peppol_send_report",
    withLlmTip(
      "WORKFLOW (multi-step): Scans all outgoing invoices (Income/Invoice) since a date and reports their Peppol send status. For each invoice with a VAT number: checks if customer is on Peppol, then fetches full order to check if it was actually sent via Peppol.\n\nUSE THIS when the user asks: 'which invoices were sent via Peppol?', 'which Peppol invoices are not yet sent?', 'Peppol send status overview', 'which invoices still need to be sent via Peppol?', 'have all Peppol invoices been dispatched?'\nDO NOT use this to check if a customer is on Peppol — use billit_check_peppol_coverage or billit_peppol_lookup_participant instead.\nDO NOT use this to send invoices — use billit_peppol_send_order to dispatch a single invoice.\n\nOUTPUT: { summary: { period_from, total_invoices, sent_via_peppol, on_peppol_not_sent, not_on_peppol, no_vat }, sent_via_peppol: [{ id, number, date, amount, vat, customer, deliveryStatus }], on_peppol_not_sent: [...], not_on_peppol: [...] }",
      "Slower than billit_check_peppol_coverage — fetches full order details for every Peppol-eligible invoice (N requests). Use a recent since_date to limit scope. Peppol send is detected via order Messages (TransportType='Peppol') or CurrentDocumentDeliveryDetails.IsDocumentDelivered."
    ),
    {
      since_date: z.string().optional()
        .describe("Start date for invoice scan (YYYY-MM-DD). Default: start of current year (YYYY-01-01). Use a recent date (e.g. current month) to limit scope and reduce API calls."),
      company_id: companyId,
    },
    async ({ since_date, company_id }) => {
      if (since_date && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(since_date)) {
        return respond("Error: since_date must be ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)");
      }
      const fromDate = since_date ?? currentYearStart();

      // 1. Paginate all Income invoices since date
      const allOrders: Order[] = [];
      let skip = 0;
      const pageSize = 120;

      for (let page_num = 0; page_num < MAX_PAGES; page_num++) {
        const filter = `OrderDirection eq 'Income' and OrderType eq 'Invoice' and OrderDate ge datetime'${fromDate}T00:00:00'`;
        const params = new URLSearchParams({
          "$filter": filter,
          "$top": String(pageSize),
          "$skip": String(skip),
          "$orderby": "OrderDate desc",
        });
        const page = await client.request<OrdersResponse>("GET", `/v1/orders?${params.toString()}`, undefined, company_id);
        const items = page?.Items ?? [];
        allOrders.push(...items);
        if (items.length < pageSize) break;
        skip += pageSize;
        if (page_num === MAX_PAGES - 1) throw new Error(`Pagination limit reached (${MAX_PAGES} pages / ${MAX_PAGES * pageSize} items). Use a more recent since_date to narrow scope.`);
      }

      // 2. Split: no VAT / has VAT
      const noVat: Order[] = [];
      const hasVat: Order[] = [];
      for (const order of allOrders) {
        if (!order.CounterParty?.VATNumber) noVat.push(order);
        else hasVat.push(order);
      }

      // 3. Deduplicate VATs for Peppol lookup (batches of 5)
      const uniqueVats = [...new Set(hasVat.map(o => o.CounterParty.VATNumber!))];
      const peppolMap = new Map<string, boolean>();
      const peppolLookupErrors = new Map<string, string>();
      await batchAll(
        uniqueVats.map(vat => () =>
          client.request<PeppolLookupResponse>("GET", `/v1/peppol/participantInformation/${encodeURIComponent(vat)}`)
            .then(r => { peppolMap.set(vat, r?.Registered ?? false); })
            .catch((e: unknown) => { peppolMap.set(vat, false); peppolLookupErrors.set(vat, e instanceof Error ? e.message : "lookup failed"); })
        )
      );

      // 4. Split into Peppol-eligible / not on Peppol / lookup failed
      const notOnPeppolOrders: Order[] = [];
      const peppolEligible: Order[] = [];
      const lookupFailedOrders: Order[] = [];
      for (const order of hasVat) {
        const vat = order.CounterParty.VATNumber!;
        if (peppolLookupErrors.has(vat)) lookupFailedOrders.push(order);
        else if (peppolMap.get(vat)) peppolEligible.push(order);
        else notOnPeppolOrders.push(order);
      }

      // 5. Fetch full orders for Peppol-eligible (batches of 5) to check send status
      type SendStatus = { order: Order; sent: boolean; deliveryStatus?: string; fetchError?: string };
      const fullOrderResults = await batchAll(
        peppolEligible.map(order => () =>
          client.request<FullOrder>("GET", `/v1/orders/${order.OrderID}`, undefined, company_id)
            .then(full => {
              // Check Messages for Peppol send
              const peppolMsg = full?.Messages?.find(m =>
                m.TransportType === "Peppol" || m.ExternalProvider === "Peppol"
              );
              const sent = !!(peppolMsg?.SentDate || peppolMsg?.DeliveredDate ||
                full?.CurrentDocumentDeliveryDetails?.IsDocumentDelivered);
              const deliveryStatus = full?.CurrentDocumentDeliveryDetails?.DocumentDeliveryStatus;
              return { order, sent, deliveryStatus } as SendStatus;
            })
            .catch((e: unknown) => ({ order, sent: false, fetchError: e instanceof Error ? e.message : "fetch failed" } as SendStatus))
        )
      );

      // 6. Split sent vs not sent vs fetch failed
      type InvoiceInfo = { id: number; number: string; date: string; amount: number; vat: string; customer: string; deliveryStatus?: string; error?: string };
      const sentViaPeppol: InvoiceInfo[] = [];
      const onPeppolNotSent: InvoiceInfo[] = [];
      const fetchFailedOrders: InvoiceInfo[] = [];

      for (const { order, sent, deliveryStatus, fetchError } of fullOrderResults) {
        const info: InvoiceInfo = {
          id: order.OrderID,
          number: order.OrderNumber,
          date: (order.OrderDate ?? "").slice(0, 10),
          amount: order.TotalIncl,
          vat: order.CounterParty.VATNumber!,
          customer: order.CounterParty.DisplayName,
          deliveryStatus,
        };
        if (fetchError) fetchFailedOrders.push({ ...info, error: fetchError });
        else if (sent) sentViaPeppol.push(info);
        else onPeppolNotSent.push(info);
      }

      const notOnPeppol: InvoiceInfo[] = notOnPeppolOrders.map(o => ({
        id: o.OrderID,
        number: o.OrderNumber,
        date: (o.OrderDate ?? "").slice(0, 10),
        amount: o.TotalIncl,
        vat: o.CounterParty.VATNumber!,
        customer: o.CounterParty.DisplayName,
      }));

      // Deduplicate lookup-failed VATs for the report
      const failedVats = [...new Set(lookupFailedOrders.map(o => o.CounterParty.VATNumber!))];
      const lookupFailed = failedVats.map(vat => {
        const orders = lookupFailedOrders.filter(o => o.CounterParty.VATNumber === vat);
        return { vat, customer: orders[0].CounterParty.DisplayName, invoiceCount: orders.length, error: peppolLookupErrors.get(vat)! };
      });

      const result = {
        summary: {
          period_from: fromDate,
          total_invoices: allOrders.length,
          no_vat: noVat.length,
          sent_via_peppol: sentViaPeppol.length,
          on_peppol_not_sent: onPeppolNotSent.length,
          not_on_peppol: notOnPeppol.length,
          lookup_failed: lookupFailed.length,
          fetch_failed: fetchFailedOrders.length,
        },
        sent_via_peppol: sentViaPeppol,
        on_peppol_not_sent: onPeppolNotSent,
        not_on_peppol: notOnPeppol,
        ...(lookupFailed.length > 0 ? { lookup_failed: lookupFailed } : {}),
        ...(fetchFailedOrders.length > 0 ? { fetch_failed: fetchFailedOrders } : {}),
      };

      return respond(JSON.stringify(result, null, 2));
    },
  );
}
