-- Tabela de clientes
CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de agendamentos
CREATE TABLE agendamentos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  servico TEXT NOT NULL,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  observacoes TEXT,
  status TEXT CHECK (status IN ('confirmado', 'cancelado', 'pendente')) DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(cliente_id, data, hora)
);

-- Desabilitar Row Level Security (RLS) para permitir que a API funcione com a chave anônima
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos DISABLE ROW LEVEL SECURITY;
