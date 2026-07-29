import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { appApi } from '@/api/appClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Layers } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createPageUrl } from '@/utils';
import EquipamentoTree from '../components/equipamentos/EquipamentoTree';
import ModuleLabel from '@/components/ModuleLabel';

function ComponenteFormModal({ isOpen, onClose, onSave, equipamentoPai, itemToEdit, localizacoes }) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit?.id) {
        // Edição - buscar localização atualizada
        let item = { ...itemToEdit };
        if (item.localizacao_id && localizacoes) {
          const foundLocation = localizacoes.find(loc => loc.id === item.localizacao_id);
          if (foundLocation) {
            item.localizacao_celula = foundLocation.descricao || '';
            item.localizacao_setor = foundLocation.setor || '';
          }
        }
        setFormData(item);
      } else {
        // Criação - herdar localização do pai
        let novoComponente = { 
          status: 'Ativo', 
          parent_id: equipamentoPai.id 
        };
        
        // Buscar localização atualizada do pai
        if (equipamentoPai.localizacao_id && localizacoes) {
          const foundLocation = localizacoes.find(loc => loc.id === equipamentoPai.localizacao_id);
          if (foundLocation) {
            novoComponente.localizacao_celula = foundLocation.descricao || '';
            novoComponente.localizacao_setor = foundLocation.setor || '';
            novoComponente.localizacao_id = equipamentoPai.localizacao_id;
          }
        } else {
          novoComponente.localizacao_celula = equipamentoPai.localizacao_celula;
          novoComponente.localizacao_setor = equipamentoPai.localizacao_setor;
          novoComponente.localizacao_id = equipamentoPai.localizacao_id;
        }
        
        setFormData(novoComponente);
      }
      setError('');
    }
  }, [isOpen, itemToEdit, equipamentoPai, localizacoes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.codigo || !formData.descricao) {
      setError('Código e Descrição são obrigatórios.');
      return;
    }
    
    try {
      // Sempre sincronizar localização antes de salvar
      let dataToSave = { ...formData };
      if (dataToSave.localizacao_id && localizacoes) {
        const foundLocation = localizacoes.find(loc => loc.id === dataToSave.localizacao_id);
        if (foundLocation) {
          dataToSave.localizacao_celula = foundLocation.descricao || '';
          dataToSave.localizacao_setor = foundLocation.setor || '';
        }
      }
      
      if (itemToEdit?.id && formData.id) {
        await appApi.entities.Equipamento.update(formData.id, dataToSave);
      } else {
        await appApi.entities.Equipamento.create(dataToSave);
      }
      onSave();
      onClose();
    } catch (err) {
      setError('Erro ao salvar componente.');
      console.error(err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{itemToEdit?.id ? 'Editar Componente' : 'Adicionar Novo Componente'}</DialogTitle>
          <DialogDescription>
            Adicionando componente para: <strong>{equipamentoPai.descricao}</strong>
            {formData.localizacao_celula && (
              <div className="mt-2 text-sm">
                Localização: <strong>{formData.localizacao_setor && `${formData.localizacao_setor} - `}{formData.localizacao_celula}</strong>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label htmlFor="comp-codigo">Código <span className="text-red-500">*</span></Label>
            <Input id="comp-codigo" value={formData.codigo || ''} onChange={e => setFormData(p => ({ ...p, codigo: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="comp-descricao">Descrição <span className="text-red-500">*</span></Label>
            <Input id="comp-descricao" value={formData.descricao || ''} onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))} />
          </div>
          <div>
             <Label htmlFor="comp-marca">Marca</Label>
             <Input id="comp-marca" value={formData.marca || ''} onChange={e => setFormData(p => ({ ...p, marca: e.target.value }))} />
          </div>
          <div>
             <Label htmlFor="comp-modelo">Modelo</Label>
             <Input id="comp-modelo" value={formData.modelo || ''} onChange={e => setFormData(p => ({ ...p, modelo: e.target.value }))} />
          </div>
           <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status || "Ativo"}
                onValueChange={(value) => setFormData(p => ({ ...p, status: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Salvar Componente</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export default function EquipamentoDetalhes() {
  const [equipamento, setEquipamento] = useState(null);
  const [allEquipamentos, setAllEquipamentos] = useState([]);
  const [localizacoes, setLocalizacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);

  const equipamentoId = useMemo(() => new URLSearchParams(location.search).get('id'), [location.search]);

  const loadData = useCallback(async () => {
    if (!equipamentoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [equipData, allEquipData, localizacoesData] = await Promise.all([
        appApi.entities.Equipamento.get(equipamentoId),
        appApi.entities.Equipamento.list(),
        appApi.entities.Localizacao.list()
      ]);
      
      // Sincronizar localização do equipamento principal
      if (equipData.localizacao_id) {
        const foundLocation = localizacoesData.find(loc => loc.id === equipData.localizacao_id);
        if (foundLocation) {
          equipData.localizacao_celula = foundLocation.descricao || '';
          equipData.localizacao_setor = foundLocation.setor || '';
        }
      }
      
      setEquipamento(equipData);
      setAllEquipamentos(allEquipData);
      setLocalizacoes(localizacoesData);
    } catch (error) {
      console.error("Erro ao carregar dados do equipamento:", error);
    } finally {
      setLoading(false);
    }
  }, [equipamentoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const handleOpenModal = (itemToEdit = null) => {
    setEditingComponent(itemToEdit);
    setIsModalOpen(true);
  };
  
  const handleDeleteComponent = async (id) => {
      if (window.confirm("Tem certeza que deseja excluir este componente? A ação não pode ser desfeita.")) {
          try {
              await appApi.entities.Equipamento.delete(id);
              await loadData();
          } catch(err) {
              alert("Erro ao excluir componente.");
          }
      }
  };

  const childrenMap = useMemo(() => {
    const map = {};
    (allEquipamentos || []).forEach(eq => {
      const pid = eq.parent_id || null;
      if (!map[pid]) map[pid] = [];
      map[pid].push(eq);
    });
    return map;
  }, [allEquipamentos]);

  if (loading) return <div>Carregando...</div>;
  if (!equipamento) return <div>Equipamento não encontrado.</div>;
  
  const componentesDoEquipamento = childrenMap[equipamento.id] || [];

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <ModuleLabel>Cadastros / Equipamentos</ModuleLabel>
        <Link to={createPageUrl('Cadastros')} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Cadastros
        </Link>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{equipamento.codigo} - {equipamento.descricao}</CardTitle>
          <div className="flex gap-2 pt-2 flex-wrap">
            <Badge variant={equipamento.status === 'Ativo' ? 'default' : 'destructive'} className={equipamento.status === 'Ativo' ? 'bg-green-100 text-green-800' : ''}>
              {equipamento.status}
            </Badge>
            {equipamento.localizacao_setor && (
              <Badge variant="outline">{equipamento.localizacao_setor}</Badge>
            )}
            {equipamento.localizacao_celula && (
              <Badge variant="outline">{equipamento.localizacao_celula}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Detalhes do equipamento */}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5"/>Componentes / Sub-Equipamentos</CardTitle>
            <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Componente
            </Button>
        </CardHeader>
        <CardContent>
            {componentesDoEquipamento.length > 0 ? (
                 <div className="rounded-lg border p-4">
                    <EquipamentoTree 
                        equipamentos={componentesDoEquipamento} 
                        onSelect={(id) => {
                            const comp = allEquipamentos.find(e => e.id === id);
                            if(comp) handleOpenModal(comp);
                        }}
                    />
                 </div>
            ) : (
                <p className="text-slate-500 text-center py-4">Nenhum componente cadastrado para este equipamento.</p>
            )}
        </CardContent>
      </Card>

      <ComponenteFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={loadData}
        equipamentoPai={equipamento}
        itemToEdit={editingComponent}
        localizacoes={localizacoes}
      />
    </div>
  );
}
