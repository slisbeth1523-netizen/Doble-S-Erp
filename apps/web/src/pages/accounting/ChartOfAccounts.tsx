import { useState, useEffect } from "react";
import { PageHeader, Badge, Card, Button, Input, Select, FormField } from "../../components/ui/index.js";

type Account = {
  id: number;
  code: string;
  name: string;
  type: string;
  balance: string;
  parentId?: number;
};

const initialAccounts: Account[] = [
  { id: 1, code: "1-00-00-000-000", name: "Activos", type: "Header", balance: "Normal Debit" },
  { id: 2, code: "1-01-00-000-000", name: "Activos Corrientes", type: "Header", balance: "Normal Debit", parentId: 1 },
  { id: 3, code: "1-01-01-000-000", name: "Efectivo y Equivalentes de Efectivo", type: "Header", balance: "Normal Debit", parentId: 2 },
  { id: 4, code: "1-01-01-001-000", name: "Caja General", type: "Detail", balance: "Normal Debit", parentId: 3 },
  { id: 5, code: "1-01-01-002-000", name: "Caja Chica", type: "Detail", balance: "Normal Debit", parentId: 3 },
  { id: 6, code: "1-01-01-003-000", name: "Bancos Nacionales", type: "Detail", balance: "Normal Debit", parentId: 3 },
  { id: 7, code: "2-00-00-000-000", name: "Pasivos", type: "Header", balance: "Normal Credit" },
  { id: 8, code: "2-01-00-000-000", name: "Pasivos Corrientes", type: "Header", balance: "Normal Credit", parentId: 7 },
  { id: 9, code: "2-01-01-000-000", name: "Cuentas por Pagar", type: "Header", balance: "Normal Credit", parentId: 8 },
  { id: 10, code: "2-01-01-001-000", name: "Proveedores Locales", type: "Detail", balance: "Normal Credit", parentId: 9 },
  { id: 11, code: "3-00-00-000-000", name: "Capital", type: "Header", balance: "Normal Credit" },
  { id: 12, code: "3-01-00-000-000", name: "Capital Social", type: "Detail", balance: "Normal Credit", parentId: 11 },
  { id: 13, code: "4-00-00-000-000", name: "Ingresos", type: "Header", balance: "Normal Credit" },
  { id: 14, code: "4-01-00-000-000", name: "Ingresos Operativos", type: "Header", balance: "Normal Credit", parentId: 13 },
  { id: 15, code: "4-01-01-000-000", name: "Ventas de Bienes", type: "Detail", balance: "Normal Credit", parentId: 14 },
  { id: 16, code: "5-00-00-000-000", name: "Costos", type: "Header", balance: "Normal Debit" },
  { id: 17, code: "6-00-00-000-000", name: "Gastos", type: "Header", balance: "Normal Debit" },
];

export function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true, 7: true, 8: true, 9: true, 11: true, 13: true, 14: true });
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  
  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("Detail");
  const [balance, setBalance] = useState("Normal Debit");
  const [parentId, setParentId] = useState<number | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);

  // Load from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem("dobles_erp_accounts");
    if (stored) {
      try {
        setAccounts(JSON.parse(stored));
      } catch {
        setAccounts(initialAccounts);
      }
    } else {
      setAccounts(initialAccounts);
      localStorage.setItem("dobles_erp_accounts", JSON.stringify(initialAccounts));
    }
  }, []);

  const saveToStorage = (updatedList: Account[]) => {
    setAccounts(updatedList);
    localStorage.setItem("dobles_erp_accounts", JSON.stringify(updatedList));
  };

  const handleSelectAccount = (acc: Account) => {
    setSelectedAccount(acc);
    setCode(acc.code);
    setName(acc.name);
    setType(acc.type);
    setBalance(acc.balance);
    setParentId(acc.parentId);
    setIsEditing(true);
  };

  const handleNewAccount = () => {
    setSelectedAccount(null);
    setCode("1-01-01-004-000"); // default template
    setName("");
    setType("Detail");
    setBalance(selectedAccount ? selectedAccount.balance : "Normal Debit");
    setParentId(selectedAccount ? selectedAccount.id : undefined);
    setIsEditing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && selectedAccount) {
      // Update
      const updated = accounts.map(acc => 
        acc.id === selectedAccount.id 
          ? { ...acc, code, name, type, balance, parentId } 
          : acc
      );
      saveToStorage(updated);
      setSelectedAccount(null);
      setIsEditing(false);
    } else {
      // Create
      const newAcc: Account = {
        id: Date.now(),
        code,
        name,
        type,
        balance,
        parentId
      };
      const updated = [...accounts, newAcc];
      saveToStorage(updated);
      if (parentId) {
        setExpanded(prev => ({ ...prev, [parentId]: true }));
      }
      handleNewAccount();
    }
  };

  const handleDelete = () => {
    if (selectedAccount) {
      const updated = accounts.filter(acc => acc.id !== selectedAccount.id);
      saveToStorage(updated);
      setSelectedAccount(null);
      setIsEditing(false);
    }
  };

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTree = (pId?: number) => {
    const nodes = accounts.filter(acc => acc.parentId === pId);
    if (nodes.length === 0) return null;

    return (
      <ul style={{ listStyleType: "none", paddingLeft: pId ? "16px" : "0", margin: 0 }}>
        {nodes.map(node => {
          const hasChildren = accounts.some(acc => acc.parentId === node.id);
          const isExpanded = expanded[node.id];
          const isSelected = selectedAccount?.id === node.id;

          return (
            <li key={node.id} style={{ margin: "4px 0" }}>
              <div 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  padding: "6px 10px", 
                  background: isSelected ? "var(--primary-light)" : (node.type === "Header" ? "var(--surface-muted)" : "transparent"),
                  border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "var(--transition)",
                  gap: "8px"
                }}
                onClick={() => handleSelectAccount(node)}
              >
                <div 
                  style={{ width: "20px", display: "flex", justifyContent: "center" }}
                  onClick={(e) => hasChildren && toggleExpand(node.id, e)}
                >
                  {hasChildren ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      style={{ 
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.15s ease",
                        opacity: 0.6
                      }}
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  ) : (
                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--muted)" }}></span>
                  )}
                </div>
                
                <span style={{ fontWeight: 600, width: "130px", fontSize: "0.85rem", color: "var(--color-primary-400)", fontFamily: "monospace", textAlign: "left" }}>
                  {node.code}
                </span>
                
                <span style={{ flex: 1, fontSize: "0.9rem", fontWeight: node.type === "Header" ? 600 : 400, textAlign: "left" }}>
                  {node.name}
                </span>
                
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <Badge tone={node.balance === "Normal Debit" ? "blue" : "neutral"}>
                    {node.balance === "Normal Debit" ? "Deudora" : "Acreedora"}
                  </Badge>
                  <Badge tone={node.type === "Header" ? "neutral" : "green"}>
                    {node.type === "Header" ? "Control" : "Detalle"}
                  </Badge>
                </div>
              </div>
              
              {isExpanded && renderTree(node.id)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
      <PageHeader
        eyebrow="Contabilidad"
        title="Catálogo de cuentas contables"
        description="Administra la estructura y clasificación de las cuentas utilizadas en la contabilidad."
        actions={<Button variant="primary" onClick={handleNewAccount}>Nueva Cuenta</Button>}
      />

      <div className="accounts-layout" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        {/* Left Side: Tree View */}
        <Card style={{ flex: "1 1 500px" }}>
          <div style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Árbol Jerárquico</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="secondary" onClick={() => setExpanded({})}>Colapsar Todo</Button>
                <Button variant="secondary" onClick={() => {
                  const allKeys = accounts.reduce((acc, curr) => ({ ...acc, [curr.id]: true }), {});
                  setExpanded(allKeys);
                }}>Expandir Todo</Button>
              </div>
            </div>
            
            <div style={{ 
              border: "1px solid var(--border)", 
              borderRadius: "var(--radius)", 
              padding: "16px", 
              background: "var(--surface-muted)",
              maxHeight: "600px",
              overflowY: "auto"
            }}>
              {renderTree(undefined)}
            </div>
          </div>
        </Card>

        {/* Right Side: Form Panel */}
        <Card style={{ flex: "1 1 350px" }}>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                {isEditing ? "Detalle de Cuenta" : "Crear Nueva Cuenta"}
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                {isEditing ? "Modifique o elimine la cuenta seleccionada." : "Defina los atributos de la cuenta."}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <FormField label="Código Contable">
                <Input 
                  type="text" 
                  value={code} 
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="1-00-00-000-000"
                  required
                  style={{ fontFamily: "monospace" }}
                />
              </FormField>

              <FormField label="Nombre de Cuenta">
                <Input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Caja Chica"
                  required
                />
              </FormField>

              <FormField label="Tipo de Cuenta">
                <Select 
                  value={type} 
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="Header">Cabecera / Control</option>
                  <option value="Detail">Detalle / Operativa</option>
                </Select>
              </FormField>

              <FormField label="Origen / Naturaleza">
                <Select 
                  value={balance} 
                  onChange={(e) => setBalance(e.target.value)}
                >
                  <option value="Normal Debit">Deudora (Débito)</option>
                  <option value="Normal Credit">Acreedora (Crédito)</option>
                </Select>
              </FormField>

              <FormField label="Cuenta Padre">
                <Select 
                  value={parentId || ""} 
                  onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">Ninguna (Raíz)</option>
                  {accounts.filter(acc => acc.type === "Header").map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </Select>
              </FormField>

              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>
                  {isEditing ? "Guardar Cambios" : "Crear Cuenta"}
                </Button>
                {isEditing && (
                  <Button type="button" variant="danger" onClick={handleDelete}>
                    Eliminar
                  </Button>
                )}
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
