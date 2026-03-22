import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";
import { coerceBool, companyId, respond, withLlmTip } from "./utils.js";

export function registerOrderTools(server: McpServer, client: BillitClient) {
  server.tool(
    "billit_list_orders",
    withLlmTip(
      "List orders from Billit. Returns paginated array of orders (invoices, credit notes, offers). Use direction='Income' for outgoing (sales) orders, direction='Cost' for incoming (purchase) orders. Supports OData filtering and full-text search. Next steps: billit_get_order for full details including order lines, billit_confirm_order to approve, billit_register_payment when paid.",
      "OrderDirection naming is counter-intuitive: 'Income' = outgoing invoices you send to customers, 'Cost' = incoming invoices from suppliers.\nERROR: fullTextSearch in $filter → CAUSE: fullTextSearch is a separate query param → FIX: pass as 'fullTextSearch' param, not inside $filter.\nOData date filter syntax: LastModified ge datetime'2026-01-01T00:00:00'.\nPartyName may be empty in list responses — use billit_get_order for full party/supplier details."
    ),
    {
      direction: z.enum(["Income", "Cost"]).optional()
        .describe("Filter by order direction: 'Income' = outgoing sales invoices (money coming in), 'Cost' = incoming purchase invoices (money going out)"),
      order_type: z.enum(["Invoice", "CreditNote", "Offer"]).optional()
        .describe("Filter by type: 'Invoice', 'CreditNote', or 'Offer'"),
      modified_after: z.string().optional()
        .describe("ISO date string — only orders modified after this date. Used in OData filter: LastModified ge datetime'YYYY-MM-DDTHH:MM:SS'"),
      approval_status: z.enum(["none", "approved", "rejected"]).optional()
        .describe("Filter by approval status: 'none' (pending), 'approved', 'rejected'"),
      paid: coerceBool.describe("Filter by payment status: true = paid, false = unpaid"),
      search: z.string().optional()
        .describe("Full-text search across order fields (order number, customer name, reference). Sent as separate 'fullTextSearch' query param, NOT in OData filter."),
      orderby: z.string().optional()
        .describe("OData $orderby expression. Examples: 'OrderDate desc', 'TotalAmountInclVat desc', 'LastModified desc'"),
      top: z.coerce.number().optional()
        .describe("Max results per page (max: 120)"),
      skip: z.coerce.number().optional()
        .describe("Items to skip for pagination (default: 0)"),
      company_id: companyId,
    },
    async ({ direction, order_type, modified_after, approval_status, paid, search, orderby, top, skip, company_id }) => {
      const filters: string[] = [];
      if (direction) filters.push(`OrderDirection eq '${direction}'`);
      if (order_type) filters.push(`OrderType eq '${order_type}'`);
      if (modified_after) {
        if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(modified_after)) {
          return respond("Error: modified_after must be ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)");
        }
        filters.push(`LastModified ge datetime'${modified_after}'`);
      }
      if (approval_status) filters.push(`ApprovalStatus eq '${approval_status}'`);
      if (paid !== undefined) filters.push(`Paid eq ${paid}`);
      const params = new URLSearchParams();
      if (filters.length) params.set("$filter", filters.join(" and "));
      if (search) params.set("fullTextSearch", search);
      if (orderby) params.set("$orderby", orderby);
      if (top !== undefined) params.set("$top", String(top));
      if (skip !== undefined) params.set("$skip", String(skip));
      const qs = params.toString();
      const data = await client.request("GET", `/v1/orders${qs ? `?${qs}` : ""}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_get_order",
    "Get full details of an order including all order lines, customer/supplier info, totals (excl/incl VAT), payment status, and booking entries. Use this after billit_list_orders to get line items. Next steps: billit_update_order (mark paid/sent), billit_register_payment, billit_confirm_order, billit_send_order.",
    {
      order_id: z.coerce.number().describe("Numeric order ID from billit_list_orders result"),
      company_id: companyId,
    },
    async ({ order_id, company_id }) => {
      const data = await client.request("GET", `/v1/orders/${order_id}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_create_order",
    withLlmTip(
      "Create a new order (invoice or credit note) in Billit. For outgoing sales invoices use order_direction='Income'. For incoming purchase invoices use order_direction='Cost'. Returns the created order ID. Next steps: billit_confirm_order to set ApprovalStatus=approved, billit_send_order to email/Peppol.",
      "ERROR: lines param not parsed → CAUSE: must be a JSON string array → FIX: pass '[{\"description\":\"Service\",\"quantity\":1,\"unit_price_excl\":100,\"vat_percentage\":21}]'.\nExample: sales invoice for BE0123456789 → order_direction='Income', order_type='Invoice'."
    ),
    {
      order_type: z.enum(["Invoice", "CreditNote"]).describe("'Invoice' or 'CreditNote'"),
      order_direction: z.enum(["Income", "Cost"]).describe("'Income' = outgoing sales invoice (you send to customer), 'Cost' = incoming purchase invoice (from supplier)"),
      order_date: z.string().describe("Invoice date (YYYY-MM-DD)"),
      customer_name: z.string().describe("Customer/supplier company name"),
      customer_vat: z.string().optional().describe("VAT number (e.g. BE0123456789)"),
      customer_email: z.string().optional().describe("Customer email address"),
      customer_language: z.enum(["NL", "FR", "EN", "DE"]).optional().describe("Language code: NL, FR, EN, DE"),
      customer_street: z.string().optional().describe("Street name"),
      customer_street_number: z.string().optional().describe("Street number"),
      customer_city: z.string().optional().describe("City name"),
      customer_zipcode: z.string().optional().describe("Postal code"),
      customer_country: z.string().optional().describe("Country code (default: BE)"),
      order_title: z.string().optional().describe("Invoice title/subject"),
      reference: z.string().optional().describe("PO number or external reference"),
      payment_reference: z.string().optional().describe("Structured payment reference (e.g. +++084/2613/66074+++)"),
      currency: z.string().optional().describe("Currency code (default: EUR)"),
      lines: z.string().describe("JSON string array of order lines: [{\"description\": \"...\", \"quantity\": 1, \"unit_price_excl\": 100.0, \"vat_percentage\": 21}]"),
      company_id: companyId,
    },
    async (params) => {
      let parsedLines: Array<{
        description: string; quantity: number; unit_price_excl: number; vat_percentage: number; reference?: string;
      }>;
      try {
        parsedLines = JSON.parse(params.lines);
      } catch {
        return respond(
          `Error: 'lines' is not valid JSON. Expected a JSON array of objects, e.g.:\n` +
          `[{"description":"Service","quantity":1,"unit_price_excl":100,"vat_percentage":21}]`
        );
      }
      const body: Record<string, unknown> = {
        OrderType: params.order_type,
        OrderDirection: params.order_direction,
        OrderDate: params.order_date,
        Customer: {
          Name: params.customer_name,
          PartyType: params.order_direction === "Income" ? "Customer" : "Supplier",
          ...(params.customer_vat && { VATNumber: params.customer_vat }),
          ...(params.customer_email && { Email: params.customer_email }),
          ...(params.customer_language && { Language: params.customer_language }),
          Addresses: (params.customer_street || params.customer_city) ? [{
            AddressType: "InvoiceAddress",
            ...(params.customer_street && { Street: params.customer_street }),
            ...(params.customer_street_number && { StreetNumber: params.customer_street_number }),
            ...(params.customer_city && { City: params.customer_city }),
            ...(params.customer_zipcode && { Zipcode: params.customer_zipcode }),
            CountryCode: params.customer_country ?? "BE",
          }] : undefined,
        },
        OrderLines: parsedLines.map((l) => ({
          Description: l.description, Quantity: l.quantity, UnitPriceExcl: l.unit_price_excl, VATPercentage: l.vat_percentage,
          ...(l.reference && { Reference: l.reference }),
        })),
        ...(params.order_title && { OrderTitle: params.order_title }),
        ...(params.reference && { Reference: params.reference }),
        ...(params.payment_reference && { PaymentReference: params.payment_reference }),
        ...(params.currency && { Currency: params.currency }),
      };
      const data = await client.request("POST", "/v1/orders", body, params.company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_update_order",
    withLlmTip(
      "Update a limited set of fields on an existing order: payment status, send status, approval status, internal info, account code, export flags. Only include fields you want to change — absent fields are not modified.",
      "Only fields present in the request are updated. To mark as paid, provide both paid=true and paid_date. To approve use billit_confirm_order (shortcut) or set approval_status='approved' here."
    ),
    {
      order_id: z.coerce.number().describe("Numeric order ID to update"),
      paid: coerceBool.describe("Set to true to mark order as paid"),
      paid_date: z.string().optional().describe("Date payment was received (YYYY-MM-DD), required when setting paid=true"),
      is_sent: coerceBool.describe("Mark order as sent to customer"),
      approval_status: z.enum(["none", "approved", "rejected"]).optional().describe("'none', 'approved', or 'rejected' — controls Billit processing"),
      internal_info: z.string().optional().describe("Internal note/memo not visible to customer"),
      account_code: z.string().optional().describe("Accounting code for bookkeeping export"),
      invoiced: coerceBool.describe("Mark as invoiced (for offers)"),
      exported_to_connector: coerceBool.describe("Mark as exported to external accounting connector"),
      company_id: companyId,
    },
    async ({ order_id, paid, paid_date, is_sent, approval_status, internal_info, account_code, invoiced, exported_to_connector, company_id }) => {
      const body: Record<string, unknown> = {};
      if (paid !== undefined) body.Paid = paid;
      if (paid_date !== undefined) body.PaidDate = paid_date;
      if (is_sent !== undefined) body.IsSent = is_sent;
      if (approval_status !== undefined) body.ApprovalStatus = approval_status;
      if (internal_info !== undefined) body.InternalInfo = internal_info;
      if (account_code !== undefined) body.AccountCode = account_code;
      if (invoiced !== undefined) body.Invoiced = invoiced;
      if (exported_to_connector !== undefined) body.ExportedToConnector = exported_to_connector;
      const data = await client.request("PATCH", `/v1/orders/${order_id}`, body, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_confirm_order",
    "Shortcut to approve an order for Billit processing. Sets ApprovalStatus to 'approved'. Required before Billit will process/send the invoice. Equivalent to billit_update_order with approval_status='approved'.",
    {
      order_id: z.coerce.number().describe("Numeric order ID to approve"),
      company_id: companyId,
    },
    async ({ order_id, company_id }) => {
      const data = await client.request("PATCH", `/v1/orders/${order_id}`, { ApprovalStatus: "approved" }, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_delete_order",
    "Delete an order permanently. Typically only applicable for draft or rejected orders. Supports dry_run=true to preview without deleting.",
    {
      order_id: z.coerce.number().describe("Numeric order ID to delete"),
      dry_run: coerceBool.describe("When true, simulates the delete without making changes (default: false)"),
      company_id: companyId,
    },
    async ({ order_id, dry_run, company_id }) => {
      if (dry_run) {
        return respond(`Dry run: would delete order ${order_id}. No changes made.`);
      }
      await client.request("DELETE", `/v1/orders/${order_id}`, undefined, company_id);
      return respond(`Order ${order_id} deleted.`);
    },
  );

  server.tool(
    "billit_register_payment",
    "Register a payment for an order. Use after confirming receipt of payment. Multiple payments can be registered (partial payments). Next step: billit_update_order with paid=true when fully paid.",
    {
      order_id: z.coerce.number().describe("Numeric order ID"),
      amount: z.coerce.number().describe("Payment amount as decimal (e.g. 121.00)"),
      payment_date: z.string().describe("Date payment was received (YYYY-MM-DD)"),
      payment_reference: z.string().optional().describe("Payment reference or bank transaction ID"),
      company_id: companyId,
    },
    async ({ order_id, amount, payment_date, payment_reference, company_id }) => {
      const body: Record<string, unknown> = { Amount: amount, PaymentDate: payment_date };
      if (payment_reference) body.PaymentReference = payment_reference;
      const data = await client.request("POST", `/v1/orders/${order_id}/payments`, body, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_send_order",
    withLlmTip(
      "Send one or more orders to the customer via email or Peppol (depending on customer configuration). Returns immediately — delivery is async. Prerequisites: order must be confirmed (ApprovalStatus=approved). Use billit_peppol_lookup_participant first to check if customer is on Peppol.",
      "Sending method (email vs Peppol) is determined by Billit based on customer config. To force Peppol, use billit_peppol_send_order instead.\nERROR: send fails → CAUSE: order not approved → FIX: call billit_confirm_order first to set ApprovalStatus='approved'."
    ),
    {
      order_ids: z.array(z.number()).describe("Array of numeric order IDs to send (can send multiple at once)"),
      company_id: companyId,
    },
    async ({ order_ids, company_id }) => {
      const data = await client.request("POST", "/v1/orders/commands/send", { OrderIDs: order_ids }, company_id);
      return respond(JSON.stringify(data ?? { sent: order_ids }, null, 2));
    },
  );
}
