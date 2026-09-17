# 📊 Studio Nails — Painel Administrativo & Gestão (Admin)

> **Painel de Controle e Gestão Comercial desenvolvido por [Albert Sales & Development](https://asnamanga.vercel.app/).**  
> Aplicação web completa e intuitiva para Nail Designers e gestores administrarem solicitações de agendamento, catálogo de serviços, categorias e métricas financeiras em tempo real.

---

## 🚀 Funcionalidades Principais

- **📈 Dashboard Financeiro & Métricas:**
  - Resumo de faturamento total do mês/período.
  - Contadores rápidos de agendamentos: *Pendentes*, *Confirmados*, *Concluídos* e *Cancelados*.
- **📅 Gestão Completa de Agendamentos:**
  - Listagem detalhada com nome da cliente, WhatsApp, data/horário, serviços escolhidos e adicionais.
  - Atualização de status em tempo real com 1 clique.
  - Link direto para abrir conversa no WhatsApp da cliente com mensagem pré-formatada de confirmação.
- **💅 Gestão de Catálogo & Procedimentos:**
  - Cadastro de novos serviços com nome, descrição, valor, imagem e opção de aceitar adicionais.
  - Edição de preços e exclusão de procedimentos do catálogo.
- **🏷️ Gestão de Categorias:**
  - Organização estruturada de procedimentos (*Alongamentos, Esmaltação em Gel, SPA dos Pés, Nail Art, etc.*).
- **🔒 Autenticação & Segurança:**
  - Acesso protegido por login para o administrador do Studio.
- **⚡ Design Responsivo & Otimizado:**
  - Painel fluido que funciona perfeitamente em computadores, tablets ou no celular da profissional.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Roteamento:** [React Router DOM v7](https://reactrouter.com/)
- **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Ícones:** [Lucide React](https://lucide.dev/)
- **Banco de Dados & API:** [Supabase](https://supabase.com/) / [PostgREST Docker](https://postgrest.org/)
- **Tipografia:** Google Fonts (*Cinzel* & *Inter*)
- **Controle de Versão:** Git & GitHub

---

## 📂 Estrutura de Pastas

```text
Studio-Nails-Admin/
├── public/                 # Assets estáticos
├── src/
│   ├── assets/             # Logos e imagens da marca (Albert Sales)
│   ├── componentes/        # Componentes reutilizáveis (Header, Modais, Cards)
│   ├── lib/
│   │   └── supabase.js     # Adaptador universal para Supabase / Docker PostgREST
│   ├── paginas/
│   │   ├── Dashboard.jsx       # Métricas e listagem de agendamentos
│   │   ├── CatalogoManager.jsx # Cadastro e edição de serviços/categorias
│   │   └── Login.jsx           # Tela de autenticação administrativa
│   ├── App.jsx             # Definição de rotas e navegação
│   ├── index.css           # Configurações do Tailwind CSS v4
│   └── main.jsx            # Ponto de entrada da aplicação
├── .env.example            # Modelo de variáveis de ambiente
├── package.json            # Dependências e scripts
└── vite.config.js          # Configuração do Vite
```

---

## ⚙️ Configuração e Execução

### 1. Clonar o repositório
```bash
git clone https://github.com/ASbySales/template-admin-studio-nails.git
cd template-admin-studio-nails
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:
```env
# URL da API / Supabase
# Desenvolvimento Local: http://localhost:3001
# Produção: https://seu-projeto.supabase.co
VITE_SUPABASE_URL=http://localhost:3001
VITE_SUPABASE_ANON_KEY=anon
```

### 4. Executar em ambiente local
```bash
npm run dev
```
Acesse no navegador: **`http://localhost:5174`**

---

## 📦 Build para Produção

Para gerar o pacote estático otimizado para deploy:
```bash
npm run build
```
Os arquivos prontos serão gerados na pasta `dist/` para publicação na **Vercel**, **Netlify** ou servidor próprio.

---

## 👨‍💻 Autor & Direitos

Desenvolvido por **[Albert Sales](https://asnamanga.vercel.app/)** — *Albert Sales & Development*.  
Todos os direitos reservados.

