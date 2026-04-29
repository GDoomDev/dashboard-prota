# Dashboard Prota

Dashboard web para visualização e análise de performance de canais do YouTube. Consome dados de uma planilha Google Sheets pública (sem autenticação) e os apresenta em quatro visões: **Por canal**, **Por longos**, **Por shorts** e **Por time**.

## Funcionalidades

- Detecção automática de novos canais (abas `*_longos` / `*_curtos`) sem alteração de código
- Atribuição temporal de dados a times conforme o changelog da planilha
- Seletor de período: 7 d / 30 d / 90 d / personalizado
- Modo comparativo — sobrepõe entidades num mesmo gráfico
- Progresso de metas trimestrais por time (3 milestones)
- Cache ISR de 5 minutos — atualiza automaticamente sem redeploy
- Dark mode automático (segue preferência do SO)

## Pré-requisitos

- Node.js 18+ (recomendado: 20+)
- npm 9+

## Instalação e execução local

```bash
# 1. Clone ou extraia o projeto
cd dashboard-prota

# 2. Instale as dependências
npm install

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador. O dashboard redireciona automaticamente para `/canais`.

## Variáveis de ambiente (opcionais)

Não há segredos — a planilha é pública. As variáveis abaixo permitem customizar o comportamento sem alterar código:

| Variável | Padrão | Descrição |
|---|---|---|
| `SHEET_PUB_ID` | ID embutido no código | ID da planilha publicada (parte da URL `pubhtml`) |
| `SHEET_REVALIDATE` | `300` | Intervalo de cache em segundos |

Para alterar, crie um `.env.local` na raiz:

```env
SHEET_REVALIDATE=120
```

## Deploy no Vercel

### Opção 1 — via CLI

```bash
npm install -g vercel   # se ainda não tiver instalado
vercel --prod
```

### Opção 2 — via repositório conectado

1. Faça push do projeto para um repositório GitHub/GitLab/Bitbucket
2. Acesse [vercel.com/new](https://vercel.com/new), importe o repositório
3. Mantenha as configurações padrão (framework detectado automaticamente: Next.js)
4. Clique em **Deploy**

Não há variáveis de ambiente obrigatórias para o deploy funcionar.

## Estrutura do projeto

```
src/
├── app/
│   ├── layout.tsx          # Shell com sidebar de navegação
│   ├── page.tsx            # Redirect → /canais
│   ├── canais/page.tsx     # Visão por canal (longos + curtos somados)
│   ├── longos/page.tsx     # Visão por longos
│   ├── shorts/page.tsx     # Visão por shorts
│   └── times/page.tsx      # Visão por time + progresso de metas
├── components/
│   ├── DashboardView.tsx   # Layout reutilizável das 4 visões
│   ├── MetricChart.tsx     # Gráfico de linha/barra (Recharts)
│   ├── StatCard.tsx        # Card de métrica acumulada
│   ├── GoalProgress.tsx    # Barra de progresso de meta trimestral
│   ├── PeriodPicker.tsx    # Seletor de período (URL-driven)
│   ├── CompareToggle.tsx   # Toggle de modo comparativo (URL-driven)
│   └── SidebarNav.tsx      # Navegação lateral
└── lib/
    ├── sheets.ts           # Ingestão da planilha (discovery + CSV fetch)
    ├── parsers.ts          # Parser CSV, datas BR/ISO, números BR
    ├── transforms.ts       # Agregações, atribuição temporal de times
    ├── period.ts           # Resolução de período a partir dos URL params
    ├── format.ts           # Formatadores de moeda, inteiros, datas
    └── types.ts            # Tipos TypeScript compartilhados
```

## Adicionando um novo canal

Nenhuma alteração de código é necessária. Basta criar as abas `novocanal_longos` e `novocanal_curtos` na planilha com as colunas `Date`, `Estimated revenue (USD)` e `Views`. O dashboard detecta automaticamente na próxima atualização do cache (≤5 min).

## Adicionando um novo time ou transferindo um segmento

Inclua um novo registro na aba `changelog` da planilha:

```
Dados            | Data       | Time
novocanal_longos | 01-04-2026 | NomeDoTime
```

A atribuição vale a partir da data informada; dados anteriores permanecem com o time anterior.
