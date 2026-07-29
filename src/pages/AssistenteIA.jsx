import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, User, Wrench, Search, DollarSign, Package, AlertCircle } from "lucide-react";
import { InvokeLLM } from "@/integrations/Core";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ModuleLabel from "@/components/ModuleLabel";
import ProviderSelector from "@/components/AssistenteIA/ProviderSelector";

function createSessionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `assistente-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AssistenteIA() {
  const [sessionId] = useState(() => createSessionId());
  const [currentProvider, setCurrentProvider] = useState("");
  const [sessionContext, setSessionContext] = useState({
    messageCount: 1,
    providersUsed: [],
    topics: [],
    estimatedTokens: 0,
    maxTokens: 8000,
    summary: "A conversa ainda nao possui resumo automatico.",
  });
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: 'Olá! Sou seu assistente especializado em peças de manutenção industrial. Posso ajudar você com:\n\n• Buscar especificações de peças\n• Consultar preços e fornecedores\n• Recomendar substitutos compatíveis\n• Identificar peças por código ou descrição\n• Sugerir peças preventivas\n• Análise de consumo e custos\n\nComo posso ajudar hoje?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const availableProviders = useMemo(() => ([
    { id: "gemini", name: "Google Gemini", freeTier: true, dailyLimit: 1500, remaining: 1500 },
    { id: "groq", name: "Groq", freeTier: true, dailyLimit: 1000, remaining: 1000 },
    { id: "deepseek", name: "DeepSeek", freeTier: true, dailyLimit: 50, remaining: 50 },
    { id: "cohere", name: "Cohere", freeTier: true, dailyLimit: 500, remaining: 500 },
  ]), []);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const prompt = `
Você é um assistente especializado em peças de manutenção industrial com amplo conhecimento em:
- Peças mecânicas, elétricas, pneumáticas e hidráulicas
- Especificações técnicas e códigos de peças
- Fornecedores e preços estimados
- Substitutos e compatibilidades
- Manutenção preventiva e preditiva

Pergunta do usuário: "${inputMessage}"

Forneça uma resposta profissional, técnica e útil. Se for sobre preços, mencione que são estimativas e podem variar. Se for sobre especificações, seja detalhado. Se não souber algo específico, seja honesto e sugira onde buscar mais informações.

Estruture sua resposta de forma clara e organize as informações quando necessário.
      `;

      const response = await InvokeLLM({
        prompt,
        add_context_from_internet: true,
        sessionId,
        provider: currentProvider || null,
        preserve_context: true
      });
      const responseText = typeof response === "string"
        ? response
        : response?.response || "Nao foi possivel obter uma resposta da IA.";

      if (response && typeof response === "object") {
        if (response.provider) setCurrentProvider(response.provider);
        setSessionContext(prev => ({
          ...prev,
          messageCount: response.contextInfo?.messageCount || prev.messageCount + 2,
          providersUsed: response.contextInfo?.providersUsed || prev.providersUsed,
          estimatedTokens: Math.min(
            prev.maxTokens,
            (prev.estimatedTokens || 0) + Number(response.usage?.tokens || 0)
          ),
        }));
      }

      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua consulta. Por favor, tente novamente.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { icon: Search, text: "Buscar peça por código", query: "Como posso identificar uma peça pelo código?" },
    { icon: DollarSign, text: "Consultar preços", query: "Preciso consultar preços de peças para orçamento" },
    { icon: Package, text: "Peças substitutos", query: "Como encontrar peças substitutas compatíveis?" },
    { icon: Wrench, text: "Manutenção preventiva", query: "Que peças devo ter em estoque para manutenção preventiva?" }
  ];

  const handleQuickAction = (query) => {
    setInputMessage(query);
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto">
      <ModuleLabel className="mb-3">Assistente IA</ModuleLabel>

      <div className="mb-4">
        <ProviderSelector
          currentProvider={currentProvider}
          sessionContext={sessionContext}
          onProviderChange={setCurrentProvider}
          availableProviders={availableProviders}
        />
      </div>

      {/* Ações Rápidas */}
      <Card className="shadow-sm border-0 bg-white mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 hover:bg-blue-50"
                onClick={() => handleQuickAction(action.query)}
              >
                <action.icon className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-center">{action.text}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card className="shadow-sm border-0 bg-white">
        <CardContent className="p-0">
          {/* Mensagens */}
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'user' ? 'bg-blue-600' : 'bg-emerald-600'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className={`rounded-lg p-4 ${
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 text-slate-900'
                  }`}>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                    <div className={`text-xs mt-2 ${
                      message.type === 'user' ? 'text-blue-100' : 'text-slate-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-slate-100 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                    <span className="text-sm text-slate-600">Pesquisando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex gap-3">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua pergunta sobre peças industriais..."
                className="resize-none"
                rows={2}
                disabled={isLoading}
              />
              <Button 
                onClick={handleSendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="px-6"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Pressione Enter para enviar • Shift + Enter para nova linha
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Alert className="mt-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          As informações fornecidas são baseadas em conhecimento geral e pesquisas online. 
          Sempre confirme especificações técnicas e preços com fornecedores oficiais antes de tomar decisões de compra.
        </AlertDescription>
      </Alert>
    </div>
  );
}
