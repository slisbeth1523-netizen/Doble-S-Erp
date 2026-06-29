import { createRoot } from "react-dom/client";

function App() {
  return (
    <main>
      <h1>Doble S ERP</h1>
      <p>Base inicial del frontend SaaS modular.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
