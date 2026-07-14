import { escapeXml, formatEcfDate, formatMoney } from "../utils/ecf-format.js";

export type EcfXmlLine = {
  lineNumber: number;
  itemName: string;
  itemDescription?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type EcfXmlInput = {
  ecfNumber: string;
  invoiceType: string;
  sequenceExpirationDate?: Date | null;
  invoiceDate: Date;
  dueDate?: Date | null;
  companyTaxId: string;
  companyName: string;
  companyAddress?: string | null;
  customerTaxId?: string | null;
  customerName: string;
  customerAddress?: string | null;
  sourceInvoiceNumber: string;
  orderNumber?: string | null;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  lines: EcfXmlLine[];
};

function node(name: string, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  return `<${name}>${escapeXml(value)}</${name}>`;
}

export function buildEcfXml(input: EcfXmlInput) {
  const expirationDate = input.sequenceExpirationDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const lines = input.lines
    .map(
      (line) => `
      <Item>
        ${node("NumeroLinea", line.lineNumber)}
        ${node("IndicadorFacturacion", "4")}
        ${node("NombreItem", line.itemName)}
        ${node("DescripcionItem", line.itemDescription ?? line.itemName)}
        ${node("CantidadItem", formatMoney(line.quantity))}
        ${node("PrecioUnitarioItem", formatMoney(line.unitPrice))}
        ${node("MontoItem", formatMoney(line.lineTotal))}
      </Item>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ECF>
  <Encabezado>
    <Version>1.0</Version>
    <IdDoc>
      ${node("TipoeCF", input.invoiceType)}
      ${node("eNCF", input.ecfNumber)}
      ${node("FechaVencimientoSecuencia", formatEcfDate(expirationDate))}
      ${node("IndicadorMontoGravado", "0")}
      ${node("TipoIngresos", "01")}
      ${node("TipoPago", "2")}
      ${node("FechaLimitePago", input.dueDate ? formatEcfDate(input.dueDate) : undefined)}
    </IdDoc>
    <Emisor>
      ${node("RNCEmisor", input.companyTaxId)}
      ${node("RazonSocialEmisor", input.companyName)}
      ${node("DireccionEmisor", input.companyAddress ?? "Direccion no especificada")}
      ${node("NumeroFacturaInterna", input.sourceInvoiceNumber)}
      ${node("NumeroPedidoInterno", input.orderNumber)}
      ${node("FechaEmision", formatEcfDate(input.invoiceDate))}
    </Emisor>
    <Comprador>
      ${node("RNCComprador", input.customerTaxId)}
      ${node("RazonSocialComprador", input.customerName)}
      ${node("DireccionComprador", input.customerAddress)}
    </Comprador>
    <Totales>
      ${node("MontoGravadoTotal", input.subtotalAmount > 0 ? formatMoney(input.subtotalAmount) : undefined)}
      ${node("MontoExento", input.subtotalAmount > 0 ? undefined : formatMoney(input.totalAmount))}
      ${node("TotalITBIS", input.taxAmount > 0 ? formatMoney(input.taxAmount) : undefined)}
      ${node("MontoTotal", formatMoney(input.totalAmount))}
    </Totales>
  </Encabezado>
  <DetallesItems>${lines}
  </DetallesItems>
</ECF>`;
}
