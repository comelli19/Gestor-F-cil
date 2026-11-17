# Gestor Fácil — Protótipo Interativo de Gestão SaaS

Protótipo visual completo e navegável do **Gestor Fácil**, plataforma de gestão em português brasileiro (moeda `R$` e fuso `America/Sao_Paulo`) para MEIs, autônomos, prestadores de serviço e pequenos comércios, operando inteiramente com dados fictícios em memória para validação de fluxos, telas e identidade visual.

---

### Decisões Críticas e Alinhamento com o Usuário

> [!IMPORTANT]
> As escolhas abaixo foram confirmadas na etapa de alinhamento inicial e orientam toda a construção do protótipo, sem conexão com backend, banco de dados ou autenticação real.

- **Escopo Completo de Entrega**: Todas as 8 telas solicitadas (Login/Recuperação, Dashboard, Clientes, Produtos e Serviços, Estoque, Vendas/Orçamentos/Ordens de Serviço, Financeiro e Configurações) serão entregues conectadas em uma única experiência navegável, priorizando a consistência entre Login, Dashboard e Clientes e estendendo os fluxos aos demais módulos.
- **Segmento Ativo Inicial**: A empresa fictícia de demonstração iniciará com **Comércio e Serviços** habilitados simultaneamente (`segment_features: ['comercio', 'servicos']`), exibindo todos os módulos no menu lateral — com possibilidade de ligar ou desligar segmentos em Configurações para validar o comportamento adaptativo do menu.
- **Identidade Visual e Tema Padrão**: Paleta em **Azul Petróleo e Slate** iniciando no **tema claro**, com alternância imediata para o **tema escuro** no cabeçalho e na tela de login.
- **Regra de Zero Movimentação**: O Dashboard incluirá dados fictícios realistas por padrão e oferecerá um filtro de período sem movimentação (além de um alternador de cenário "Empresa sem movimentação") para validar visualmente que todos os indicadores exibem `R$ 0,00` e `0` quando não há registros.

---

### 1. Visão Geral e Conceito Central

- **O que faz**: Reúne em uma interface única e responsiva a entrada no sistema (login e recuperação de senha), visão gerencial de indicadores e gráficos, cadastro e histórico de clientes, catálogo separado de produtos e serviços, controle de saldos e movimentações de estoque, operação comercial (vendas, orçamentos e ordens de serviço), gestão financeira (contas a pagar/receber separadas do fluxo de caixa) e configurações da empresa.
- **Público-alvo**: MEIs, técnicos e prestadores de serviço (informática, manutenção, instalação) e pequenos comércios que precisam operar com clareza tanto no computador quanto no navegador do celular.
- **Valor principal**: Permite testar a navegação completa, a densidade de informações, os estados vazios/zerados, a validação visual de formulários (como CPF/CNPJ e cálculo de margem) e a coerência entre módulos com alterações refletidas em memória durante a sessão.

---

### 2. Experiência do Usuário e Design Visual

#### Fluxos Principais do Usuário
1. **Acesso (Login e Recuperação de Senha)**:
   - Tela dividida/centralizada limpa com validação visual em tempo real de e-mail e senha (indicador de senha mínima conforme padrão da especificação, mensagens claras de erro inline e botão de demonstração rápida).
   - Fluxo alternativo de **Recuperação de Senha** na mesma superfície, exibindo feedback genérico de envio sem expor se o e-mail está cadastrado.
   - Ao entrar, redireciona diretamente para o Dashboard da empresa ativa.
2. **Dashboard Gerencial**:
   - Filtro de período no topo (`Este mês`, `Mês anterior`, `Últimos 3 meses`, `Período sem movimento`) que recalcula os indicadores e gráficos em tempo real.
   - Grade de cartões de KPIs: Faturamento do mês, Contas a receber, Contas a pagar, Saldo financeiro, Produtos com estoque baixo, Orçamentos aguardando aprovação e Ordens de serviço em andamento.
   - Dois gráficos interativos: **Faturamento Mensal** e **Receitas vs. Despesas** com tooltips formatados em `R$`.
3. **Clientes**:
   - Barra de busca instantânea por nome, CPF/CNPJ ou telefone + filtro segmentado por situação (`Todos`, `Ativos`, `Inativos`).
   - Formulário de cadastro/edição com máscara e **validação real de dígitos verificadores para CPF e CNPJ**, bloqueando duplicidade de documento em memória e permitindo inativar clientes com histórico em vez de excluí-los.
   - Painel/gaveta de detalhes do cliente com total comprado e abas de histórico: Compras, Serviços, Orçamentos, Contas a receber e Pagamentos.
4. **Produtos e Serviços**:
   - Alternância explícita entre as tabelas de **Produtos** e **Serviços** (garantindo que serviços nunca movimentem estoque).
   - Formulário de Produto com código interno, código de barras, custo de aquisição, preço de venda, **margem estimada calculada automaticamente**, estoque mínimo e controle de estoque (`Sim`/`Não`).
   - Formulário de Serviço com código, preço padrão, custo estimado e tempo estimado.
5. **Estoque**:
   - Posição atual por produto e local de estoque exibindo **Saldo Físico**, **Reservado** e **Disponível** (`Físico - Reservado`), destacando itens abaixo do estoque mínimo.
   - Formulário de movimentação (Entrada por compra, Saída manual, Ajuste de inventário com justificativa obrigatória e Transferência entre locais) que atualiza os saldos e o histórico de movimentações em memória.
6. **Operação Comercial (Vendas, Orçamentos e Ordens de Serviço)**:
   - Listas e formulários dedicados com etiquetas de status coloridas acompanhadas de rótulo textual e ícone claro, respeitando integralmente os status do documento:
     - *Vendas*: `Rascunho`, `Confirmada`, `Aguardando entrega`, `Entregue`, `Cancelada`.
     - *Orçamentos*: `Rascunho`, `Enviado`, `Aguardando aprovação`, `Aprovado`, `Recusado`, `Expirado`, `Cancelado` — com conversão única para Venda ou OS e pré-visualização de link de compartilhamento.
     - *Ordens de Serviço*: `Aberta`, `Em análise`, `Aguardando aprovação`, `Aguardando peças`, `Em execução`, `Concluída`, `Entregue`, `Cancelada` — com equipamento, problema, diagnóstico, responsável, produtos utilizados (reservando saldo ao abrir e baixando ao concluir) e mão de obra.
7. **Financeiro**:
   - Abas claras separando **Contas a Receber**, **Contas a Pagar** e **Fluxo de Caixa Realizado** (garantindo que previsões futuras e orçamentos nunca se misturem ao saldo realizado).
   - Registro de pagamentos totais ou parciais que atualizam o saldo pendente do título e lançam a entrada/saída correspondente no fluxo de caixa.
8. **Configurações**:
   - Dados da empresa (nome, CNPJ, telefone, e-mail, endereço), alternância de segmentos ativos (`Comércio` / `Serviços`), regra de bloqueio/permissão de estoque negativo e cadastro de formas de pagamento.

#### Identidade Visual, Cores e Tipografia
- **Direção Estética**: Software SaaS contemporâneo, limpo e silencioso, priorizando legibilidade financeira, respiro visual e hierarquia sem ruído ornamental (sem barras laterais coloridas grossas em cards, sem pontos pulsantes decorativos e sem cápsulas excessivas em metadados estáticos).
- **Paleta de Cores (60-30-10)**:
  - *Tema Claro (Padrão)*: Fundo principal neutro frio (`#F8FAFC`), superfícies de cards e barra lateral em branco puro (`#FFFFFF`) com bordas finas de `1px` (`#E2E8F0`), texto principal em Slate profundo (`#0F172A`) e secundário em `#475569`.
  - *Tema Escuro*: Fundo principal em Slate profundo (`#0B1120`), superfícies estruturais em `#111827` / `#1E293B` com bordas `#1E293B` / `#334155`, texto principal em `#F8FAFC` com compensação óptica de contraste.
  - *Cor de Destaque (10%)*: Azul Petróleo (`#0F766E` no claro / `#14B8A6` no escuro) concentrado em botões primários, estados ativos de navegação e focos de formulário.
  - *Cores Semânticas*: Verde (`#16A34A`) para concluído/ativo/receita, Âmbar (`#D97706`) para aguardando/alerta de estoque, Vermelho (`#DC2626`) para vencido/cancelado/despesa e Azul (`#0284C7`) para em análise/execução.
- **Tipografia**:
  - *Títulos e Navegação*: `Plus Jakarta Sans` (pesos 600 e 700, com `text-wrap: balance`).
  - *Corpo e Tabelas*: `DM Sans` (pesos 400 e 500).
  - *Números, Moeda e Documentos*: `JetBrains Mono` / `tabular-nums` garantindo alinhamento vertical de valores em `R$`, CPFs/CNPJs e datas no fuso `America/Sao_Paulo`.
- **Layout e Responsividade**:
  - Navegação lateral fixa em telas desktop (`256px`), recolhível em gaveta deslizante no celular com barra superior compacta (três zonas: título/breadcrumb da tela, indicador de empresa ativa e alternador de tema + saída).

---

### 3. Decisões de Produto e Trade-offs

- **Estado Compartilhado em Memória (Context + Reducers/Ações Tipadas)**
  - *Abordagem escolhida*: Manter um estado global único em memória com dados iniciais coerentes entre módulos (mesmos clientes, produtos, saldos, vendas, OS e lançamentos financeiros conectados entre si).
  - *Por quê*: Embora não haja banco de dados, criar uma venda, movimentar o estoque ou quitar uma parcela financeira atualiza imediatamente o Dashboard e as demais telas durante o teste, demonstrando a regra de negócio real sem exigir infraestrutura.
  - *Alternativa descartada*: Dados estáticos isolados por página, que deixariam os módulos desconectados ao testar fluxos como converter um orçamento ou baixar estoque.

- **Separação Modular no Menu Lateral (Comércio vs. Serviços)**
  - *Abordagem escolhida*: Renderizar itens individuais no menu lateral (Dashboard, Clientes, Produtos e Serviços, Estoque, Vendas, Orçamentos, Ordens de Serviço, Financeiro e Configurações), respeitando os segmentos ativos da empresa.
  - *Por quê*: Mantém acesso direto em 1 clique a cada tela solicitada e demonstra na prática a regra de `segment_features` da Seção 2 do documento.
  - *Alternativa descartada*: Agrupar Vendas, Orçamentos e OS em uma única tela com abas ocultas, o que dificultaria o acesso rápido no dia a dia e esconderia a flexibilidade de segmento.

- **Cálculos Monetários e Validação no Navegador (Modo Protótipo)**
  - *Abordagem escolhida*: Utilizar arredondamento seguro em centavos inteiros para simulações de totais, margens e parcelas, além de validação matemática real de dígitos verificadores de CPF/CNPJ.
  - *Por quê*: Garante fidelidade à regra `RN-04` (validação real de documento) e `RN-19` (precisão sem ruído de ponto flutuante) mesmo antes da existência do banco PostgreSQL.

---

### 4. Arquitetura Técnica e Estratégia de Dados

#### Diagrama de Arquitetura do Protótipo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AppShell & ThemeProvider                        │
│   (Tema Claro/Escuro · Estado de Sessão Fictícia · Navegação/Drawer)    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
             ┌──────────────────┴──────────────────┐
             ▼                                     ▼
┌──────────────────────────┐         ┌────────────────────────────────────┐
│    Fluxo de Entrada      │         │      GestorStore (Em Memória)      │
│  · Login (validação UI)  │         │  · Empresa & Configurações         │
│  · Recuperação de Senha  │         │  · Clientes & Histórico            │
└──────────────────────────┘         │  · Produtos, Serviços & Estoque    │
                                     │  · Vendas, Orçamentos & OS         │
                                     │  · Financeiro (Previsto/Realizado) │
                                     └─────────────────┬──────────────────┘
                                                       │
       ┌───────────────┬───────────────┬───────────────┼───────────────┐
       ▼               ▼               ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Dashboard  │ │  Cadastros  │ │   Estoque   │ │  Operação   │ │ Financeiro  │
│  KPIs +     │ │  Clientes   │ │  Saldos +   │ │  Vendas     │ │  A Receber  │
│  Gráficos   │ │  Prod./Serv.│ │  Moviment.  │ │  Orçamentos │ │  A Pagar    │
│  Zero-State │ │  Val. CPF   │ │  Mínimos    │ │  Ordens OS  │ │  Fluxo Caixa│
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

#### Modelo de Dados em Memória
- **Empresa e Configurações**: Nome, CNPJ, telefone, e-mail, endereço, `segment_features` (`comercio`, `servicos`), `allow_negative_stock` e lista de `payment_methods`.
- **Clientes**: Identificador, nome/razão social, CPF/CNPJ, telefone, WhatsApp, e-mail, CEP, endereço, cidade, UF, observações, situação (`ativo`/`inativo`), data de cadastro e vínculos com vendas, OS, orçamentos e títulos.
- **Produtos e Serviços**: Tabelas distintas em memória (`products` com `sku`, `barcode`, `cost_price`, `sale_price`, `min_stock`, `tracks_stock`, `status`; `services` com `code`, `default_price`, `estimated_cost`, `estimated_time`, `status`).
- **Estoque**: Locais (`warehouses`), saldos por produto/local (`physical_qty`, `reserved_qty`, calculando `available_qty`) e trilha de `stock_movements` (tipo, origem, justificativa, responsável, data).
- **Operação Comercial**: `sales`, `quotes` (com `revision`, `share_token`, `converted_at`) e `service_orders` (com itens de produto/serviço, reserva e conclusão), com numeração sequencial por tipo.
- **Financeiro**: `financial_entries` (`receivable` / `payable`, status `pendente`, `parcial`, `quitado`, `vencido`, `cancelado`) separados de `financial_payments` (pagamentos efetivados que alimentam o Fluxo de Caixa Realizado).

#### Mapeamento de Interações e Estados
- **Validações de Formulário**: Feedback visual instantâneo em Login (e-mail válido e senha mínima), Clientes (dígitos verificadores de CPF/CNPJ e bloqueio de documento duplicado), Produtos (margem estimada atualizada ao digitar custo/preço) e Estoque (bloqueio de saldo negativo quando desativado nas configurações).
- **Gráficos e Visualização**: Uso da biblioteca `Recharts` para os gráficos do Dashboard (Faturamento Mensal e Receitas vs. Despesas), responsivos ao redimensionamento e adaptados às cores do tema claro e escuro.
- **Feedback de Ações**: Mensagens de confirmação não intrusivas (toasts discretos) ao salvar registros, movimentar estoque, converter orçamentos, registrar pagamentos ou alterar configurações.
