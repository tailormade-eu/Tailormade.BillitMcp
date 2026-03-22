import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";
import { companyId, respond } from "./utils.js";

export function registerPartyTools(server: McpServer, client: BillitClient) {
  server.tool(
    "billit_list_parties",
    "List parties (customers and/or suppliers) in Billit. Returns array with PartyID, CommercialName, VATNumber, Email, PartyType. Supports OData $filter, $orderby, full-text search. Next steps: billit_get_party for full details, billit_create_order to create an invoice for a party.\n\nEXAMPLES:\n- filter=\"PartyType eq 'Customer'\"\n- filter=\"DisplayName eq 'Acme NV'\"\n- orderby='CommercialName asc'\n\nNOTE: fullTextSearch is a separate param — do NOT put it in OData $filter.",
    {
      party_type: z.enum(["Customer", "Supplier", "Both"]).optional().describe("Shortcut filter by party type. Equivalent to filter=\"PartyType eq '...'\"."),
      filter: z.string().optional().describe("OData $filter expression. Examples: \"DisplayName eq 'Acme NV'\", \"PartyType eq 'Customer'\". NOTE: If you also provide party_type, it will be merged with AND unless your filter already contains a PartyType condition."),
      orderby: z.string().optional().describe("OData $orderby expression. Examples: 'CommercialName asc', 'DisplayName desc'"),
      search: z.string().optional().describe("Full-text search on name, VAT number, email. Sent as separate 'fullTextSearch' query param."),
      top: z.coerce.number().optional().describe("Max results per page (max: 120)"),
      skip: z.coerce.number().optional().describe("Items to skip for pagination (default: 0)"),
      company_id: companyId,
    },
    async ({ party_type, filter, orderby, search, top, skip, company_id }) => {
      const filters: string[] = [];
      if (party_type && !(filter && /PartyType/i.test(filter))) {
        filters.push(`PartyType eq '${party_type}'`);
      }
      if (filter) filters.push(filter);
      const params = new URLSearchParams();
      if (filters.length) params.set("$filter", filters.join(" and "));
      if (orderby) params.set("$orderby", orderby);
      if (search) params.set("fullTextSearch", search);
      if (top) params.set("$top", String(top));
      if (skip) params.set("$skip", String(skip));
      const qs = params.toString();
      const data = await client.request("GET", `/v1/parties${qs ? `?${qs}` : ""}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_get_party",
    "Get full details of a party including all addresses, identifiers (GLN, VAT), IBAN/BIC, language, and contact info. Use PartyID from billit_list_parties.",
    {
      party_id: z.coerce.number().describe("Numeric party ID from billit_list_parties result"),
      company_id: companyId,
    },
    async ({ party_id, company_id }) => {
      const data = await client.request("GET", `/v1/parties/${party_id}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_create_party",
    "Create a new customer or supplier party in Billit. Use billit_search_company first to auto-fill company details from KBO/VAT lookup. Returns the created PartyID. Next steps: billit_create_order to create an invoice for this party.\n\nNOTE: Use billit_search_company with the company VAT/KBO number to look up official company data (name, address) before creating. This avoids typos and ensures correct data.",
    {
      commercial_name: z.string().describe("Company or person name (required)"),
      party_type: z.enum(["Customer", "Supplier", "Both"]).optional().describe("'Customer', 'Supplier', or 'Both' (default: Customer)"),
      vat_number: z.string().optional().describe("VAT number in BE format: BE0123456789"),
      enterprise_number: z.string().optional().describe("KBO enterprise number (9 digits)"),
      email: z.string().optional().describe("Primary email address"),
      phone: z.string().optional().describe("Phone number"),
      language: z.enum(["NL", "FR", "EN", "DE"]).optional().describe("Communication language: NL, FR, EN, or DE"),
      iban: z.string().optional().describe("IBAN bank account number"),
      bic: z.string().optional().describe("BIC/SWIFT code"),
      street: z.string().optional().describe("Street name"),
      street_number: z.string().optional().describe("Street number"),
      box: z.string().optional().describe("Box/apartment number"),
      zipcode: z.string().optional().describe("Postal code"),
      city: z.string().optional().describe("City name"),
      country_code: z.string().optional().describe("ISO country code (default: BE)"),
      address_type: z.enum(["InvoiceAddress", "DeliveryAddress"]).optional().describe("Address type: 'InvoiceAddress' (default) or 'DeliveryAddress'"),
      company_id: companyId,
    },
    async (params) => {
      const body: Record<string, unknown> = {
        CommercialName: params.commercial_name,
        PartyType: params.party_type ?? "Customer",
        ...(params.vat_number && { VATNumber: params.vat_number }),
        ...(params.enterprise_number && { EnterpriseNumber: params.enterprise_number }),
        ...(params.email && { Email: params.email }),
        ...(params.phone && { Phone: params.phone }),
        ...(params.language && { Language: params.language }),
        ...(params.iban && { IBAN: params.iban }),
        ...(params.bic && { BIC: params.bic }),
      };
      if (params.street || params.city) {
        body.Addresses = [{
          AddressType: params.address_type ?? "InvoiceAddress",
          ...(params.street && { Street: params.street }),
          ...(params.street_number && { StreetNumber: params.street_number }),
          ...(params.box && { Box: params.box }),
          ...(params.zipcode && { Zipcode: params.zipcode }),
          ...(params.city && { City: params.city }),
          CountryCode: params.country_code ?? "BE",
        }];
      }
      const data = await client.request("POST", "/v1/parties", body, params.company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_update_party",
    "Update party details. Only fields provided in the request are modified — absent fields remain unchanged.",
    {
      party_id: z.coerce.number().describe("Numeric party ID to update"),
      commercial_name: z.string().optional().describe("Updated company or person name"),
      vat_number: z.string().optional().describe("Updated VAT number"),
      email: z.string().optional().describe("Updated email address"),
      phone: z.string().optional().describe("Updated phone number"),
      language: z.enum(["NL", "FR", "EN", "DE"]).optional().describe("Updated language: NL, FR, EN, or DE"),
      iban: z.string().optional().describe("Updated IBAN"),
      bic: z.string().optional().describe("Updated BIC/SWIFT"),
      company_id: companyId,
    },
    async ({ party_id, commercial_name, vat_number, email, phone, language, iban, bic, company_id }) => {
      const body: Record<string, unknown> = {};
      if (commercial_name !== undefined) body.CommercialName = commercial_name;
      if (vat_number !== undefined) body.VATNumber = vat_number;
      if (email !== undefined) body.Email = email;
      if (phone !== undefined) body.Phone = phone;
      if (language !== undefined) body.Language = language;
      if (iban !== undefined) body.IBAN = iban;
      if (bic !== undefined) body.BIC = bic;
      const data = await client.request("PATCH", `/v1/parties/${party_id}`, body, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );
}
