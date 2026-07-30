import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TipoManutencao } from "@/entities/TipoManutencao";
import { StatusOS } from "@/entities/StatusOS";
import { AreaManutencao } from "@/entities/AreaManutencao";
import { Prioridade } from "@/entities/Prioridade";
import { CentroCusto } from "@/entities/CentroCusto";
import ModuleLabel from "@/components/ModuleLabel";
import CadastroGenerico from "../components/cadastros/CadastroGenerico";
import EquipamentosTab from "../components/cadastros/EquipamentosTab";
import MateriaisTab from "../components/cadastros/MateriaisTab";
import MantenedoresTab from "../components/cadastros/MantenedoresTab";
import PrestadorasTab from "../components/cadastros/PrestadorasTab";
import LocalizacoesTab from "../components/cadastros/LocalizacoesTab";

export default function Cadastros() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden p-3 sm:p-4 lg:h-screen lg:p-6">
      <Tabs defaultValue="equipamentos" className="flex min-h-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 shrink-0 space-y-3 bg-background pb-3">
          <ModuleLabel>Cadastros</ModuleLabel>
        <TabsList className="h-auto min-h-10 w-full justify-start overflow-x-auto rounded-lg border bg-white p-1 text-slate-600 shadow-sm">
          <TabsTrigger value="equipamentos" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Equipamentos</TabsTrigger>
          <TabsTrigger value="materiais" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Materiais</TabsTrigger>
          <TabsTrigger value="mantenedores" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Mantenedores</TabsTrigger>
          <TabsTrigger value="prestadoras" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Prestadoras</TabsTrigger>
          <TabsTrigger value="localizacoes" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Localizações</TabsTrigger>
          <TabsTrigger value="tipos" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Tipos</TabsTrigger>
          <TabsTrigger value="status" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Status</TabsTrigger>
          <TabsTrigger value="areas" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Áreas</TabsTrigger>
          <TabsTrigger value="prioridades" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Prioridades</TabsTrigger>
          <TabsTrigger value="centroscusto" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Centros de Custo</TabsTrigger>
        </TabsList>
        </div>
        
        <TabsContent value="equipamentos" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <EquipamentosTab />
        </TabsContent>
        
        <TabsContent value="materiais" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <MateriaisTab />
        </TabsContent>

        <TabsContent value="mantenedores" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <MantenedoresTab />
        </TabsContent>
        
        <TabsContent value="prestadoras" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <PrestadorasTab />
        </TabsContent>

        <TabsContent value="localizacoes" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <LocalizacoesTab />
        </TabsContent>

        <TabsContent value="tipos" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <CadastroGenerico
            titulo="Tipos de Manutenção"
            Entity={TipoManutencao}
            campos={[
              { name: "descricao", label: "Descrição", required: true },
              {
                name: "categoria",
                label: "Categoria operacional",
                type: "select",
                required: true,
                defaultValue: "other",
                options: [
                  { value: "corrective", label: "Corretiva" },
                  { value: "preventive", label: "Preventiva" },
                  { value: "predictive", label: "Preditiva" },
                  { value: "emergency", label: "Emergencial" },
                  { value: "improvement", label: "Melhoria" },
                  { value: "relocation", label: "Realocação" },
                  { value: "outsourced", label: "Terceirizada" },
                  { value: "other", label: "Outra" },
                ],
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="status" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <CadastroGenerico
            titulo="Status OS"
            Entity={StatusOS}
            campos={[
              { name: "descricao", label: "Descrição", required: true },
              {
                name: "categoria",
                label: "Etapa do fluxo",
                type: "select",
                required: true,
                defaultValue: "other",
                options: [
                  { value: "open", label: "Aberta" },
                  { value: "in_progress", label: "Em andamento" },
                  { value: "waiting_parts", label: "Aguardando peças" },
                  { value: "waiting_document", label: "Aguardando documento" },
                  { value: "completed", label: "Concluída" },
                  { value: "cancelled", label: "Cancelada" },
                  { value: "rejected", label: "Reprovada" },
                  { value: "other", label: "Outra" },
                ],
              },
              { name: "ordem", label: "Ordem", required: false, placeholder: "10" },
            ]}
            onSaveCustom={async (formData, editingItem, Entity) => {
              const payload = {
                ...formData,
                inicial: formData.categoria === "open",
                final: ["completed", "cancelled", "rejected"].includes(formData.categoria),
              };
              if (editingItem) await Entity.update(editingItem.id, payload);
              else await Entity.create(payload);
            }}
          />
        </TabsContent>

        <TabsContent value="areas" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <CadastroGenerico
            titulo="Áreas de Manutenção"
            Entity={AreaManutencao}
          />
        </TabsContent>

        <TabsContent value="prioridades" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <CadastroGenerico
            titulo="Prioridades"
            Entity={Prioridade}
            campos={[
              { name: 'descricao', label: 'Descrição', required: true },
              { name: 'cor', label: 'Cor', required: false, placeholder: '#FF0000' },
              { name: 'ordem', label: 'Ordem', required: false, placeholder: '1' },
              {
                name: "severidade",
                label: "Severidade operacional",
                type: "select",
                required: true,
                defaultValue: "normal",
                options: [
                  { value: "low", label: "Baixa" },
                  { value: "normal", label: "Normal" },
                  { value: "high", label: "Alta" },
                  { value: "critical", label: "Crítica" },
                  { value: "emergency", label: "Emergência" },
                ],
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="centroscusto" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <CadastroGenerico
            titulo="Centros de Custo"
            Entity={CentroCusto}
            campos={[
              { name: 'codigo', label: 'Código', required: false },
              { name: 'descricao', label: 'Descrição', required: true }
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
