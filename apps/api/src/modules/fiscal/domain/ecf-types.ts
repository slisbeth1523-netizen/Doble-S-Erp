export type DgiiEnvironment = "TESTECF" | "CERTECF" | "PRODUCCION";

export type EcfTypeCode = "31" | "32" | "33" | "34" | "41" | "43" | "44" | "45" | "46" | "47";

export type EcfTypeDefinition = {
  code: EcfTypeCode;
  label: string;
  description: string;
  requiresCommercialApproval: boolean;
  usesForeignCurrency?: boolean;
};

export const ecfTypes: Record<EcfTypeCode, EcfTypeDefinition> = {
  "31": {
    code: "31",
    label: "Factura de credito fiscal electronica",
    description: "Comprobante que sustenta credito fiscal de ITBIS para el comprador.",
    requiresCommercialApproval: true
  },
  "32": {
    code: "32",
    label: "Factura de consumo electronica",
    description: "Comprobante para consumidor final.",
    requiresCommercialApproval: false
  },
  "33": {
    code: "33",
    label: "Nota de debito electronica",
    description: "Documento que aumenta el monto de un e-CF emitido.",
    requiresCommercialApproval: true
  },
  "34": {
    code: "34",
    label: "Nota de credito electronica",
    description: "Documento que disminuye, corrige o anula un e-CF emitido.",
    requiresCommercialApproval: true
  },
  "41": {
    code: "41",
    label: "Comprobante electronico de compras",
    description: "Emitido por el comprador cuando el vendedor no emite e-CF.",
    requiresCommercialApproval: false
  },
  "43": {
    code: "43",
    label: "Comprobante electronico para gastos menores",
    description: "Comprobante para gastos menores.",
    requiresCommercialApproval: false
  },
  "44": {
    code: "44",
    label: "Comprobante electronico para regimenes especiales",
    description: "Operaciones amparadas en regimenes especiales.",
    requiresCommercialApproval: true
  },
  "45": {
    code: "45",
    label: "Comprobante electronico gubernamental",
    description: "Operaciones realizadas con entidades del Estado dominicano.",
    requiresCommercialApproval: true
  },
  "46": {
    code: "46",
    label: "Comprobante electronico para exportaciones",
    description: "Operaciones de exportacion de bienes y servicios.",
    requiresCommercialApproval: false,
    usesForeignCurrency: true
  },
  "47": {
    code: "47",
    label: "Comprobante electronico para pagos al exterior",
    description: "Pagos a personas fisicas o juridicas no residentes.",
    requiresCommercialApproval: false,
    usesForeignCurrency: true
  }
};

export const dgiiEndpointSlugs: Record<DgiiEnvironment, string> = {
  TESTECF: "testecf",
  CERTECF: "certecf",
  PRODUCCION: "ecf"
};

export function getDgiiEndpoints(environment: DgiiEnvironment) {
  const host = "https://ecf.dgii.gov.do";
  const slug = dgiiEndpointSlugs[environment];

  return {
    environment,
    base: `${host}/${slug}`,
    semilla: `${host}/${slug}/autenticacion/api/autenticacion/semilla`,
    validarSemilla: `${host}/${slug}/autenticacion/api/autenticacion/validarsemilla`,
    recepcionECF: `${host}/${slug}/recepcion/api/ecf`,
    recepcionRFCE: `${host}/${slug}/recepcion/api/facturaconsumo`,
    aprobacionComercial: `${host}/${slug}/aprobacioncomercial/api/aprobacioncomercial`,
    consultaResultado: `${host}/${slug}/consultaresultado/api/consultaresultado`,
    anulacionRango: `${host}/${slug}/anulacionrango/api/anulacionrango`,
    directorio: `${host}/${slug}/consultadirectorio/api/consultadirectorio`
  };
}
