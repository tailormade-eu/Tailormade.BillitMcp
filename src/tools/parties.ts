import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";

function respond(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

const companyId = z.number().optional()
  .describe("Billit PartyID of the company to act as. If not set, uses BILLIT_PARTY_ID env. If env is 0, call billit_get_account_info first to discover available companies.");

export function registerPartyTools(server: McpServer, client: BillitClient) {
  server.tool(
    "billit_list_parties",
    "List parties (customers and/or suppliers) in Billit. Returns array with PartyID, CommercialName, VATNumber, Email, PartyType. Use party_type to filter customers vs suppliers. Supports full-text search by name or VAT. Next steps: billit_get_party for full details, billit_create_order to create an invoice for a party.\n\nNOTE: fullTextSearch is a separate query param — do NOT put it in the OData $filter. Use billit_search_company to look up company details by VAT/KBO number before creating a new party.",
    {
      party_type: z.enum(["Customer", "Supplier", "Both"]).optional().describe("Filter by party type: 'Customer', 'Supplier', or 'Both'. Omit to return all."),
      search: z.string().optional().describe("Full-text search on name, VAT number, email. Sent as separate 'fullTextSearch' query param."),
      top: z.number().optional().describe("Max results per page (default: 50)"),
      skip: z.number().optional().describe("Items to skip for pagination (default: 0)"),
      company_id: companyId,
    },
    async ({ party_type, search, top, skip, company_id }) => {
      const params = new URLSearchParams();
      if (party_type) params.set("$filter", `PartyType eq '${party_type}'`);
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
      party_id: z.number().describe("Numeric party ID from billit_list_parties result"),
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
      party_id: z.number().describe("Numeric party ID to update"),
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
