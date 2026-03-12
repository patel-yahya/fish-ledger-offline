import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import FishermenPage from "./pages/FishermenPage";
import FishermanDetail from "./pages/FishermanDetail";
import SpeciesPage from "./pages/SpeciesPage";
import PassesPage from "./pages/PassesPage";
import SettlementPage from "./pages/SettlementPage";
import DataPage from "./pages/DataPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/fishermen" element={<FishermenPage />} />
            <Route path="/fishermen/:id" element={<FishermanDetail />} />
            <Route path="/species" element={<SpeciesPage />} />
            <Route path="/passes" element={<PassesPage />} />
            <Route path="/settlement" element={<SettlementPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
