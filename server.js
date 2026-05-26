require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');


const app = express();
const port = process.env.PORT || 3000;

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para verificar se a configuração do Supabase está presente
const checkSupabase = (req, res, next) => {
    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Supabase não configurado. Verifique as variáveis de ambiente.' });
    }
    next();
};

app.use('/api', checkSupabase);

// --- ROTAS DE CLIENTES ---

app.get('/api/clientes', async (req, res) => {
    try {
        const { data, error } = await supabase.from('clientes').select('*').order('nome');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/clientes', async (req, res) => {
    try {
        const { nome, telefone, email } = req.body;
        if (!nome || !telefone) return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });

        const { data, error } = await supabase.from('clientes').insert([{ nome, telefone, email }]).select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, telefone, email } = req.body;
        const { data, error } = await supabase.from('clientes').update({ nome, telefone, email }).eq('id', id).select();
        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Opcional: verificar se existem agendamentos pendentes
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Cliente excluído com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ROTAS DE AGENDAMENTOS ---

app.get('/api/agendamentos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('agendamentos')
            .select('*, clientes(nome)')
            .order('data', { ascending: true })
            .order('hora', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/agendamentos', async (req, res) => {
    try {
        const { cliente_id, servico, data, hora, observacoes, status } = req.body;

        // Validação de agendamento duplicado
        const { data: existing, error: checkError } = await supabase
            .from('agendamentos')
            .select('*')
            .eq('cliente_id', cliente_id)
            .eq('data', data)
            .eq('hora', hora);

        if (checkError) throw checkError;
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Este cliente já possui um agendamento nesta data e horário.' });
        }

        const { data: newAgendamento, error } = await supabase
            .from('agendamentos')
            .insert([{ cliente_id, servico, data, hora, observacoes, status }])
            .select();

        if (error) throw error;
        res.status(201).json(newAgendamento[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/agendamentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { cliente_id, servico, data, hora, observacoes, status } = req.body;

        // Verifica duplicação apenas se estiver mudando data, hora ou cliente_id
        const { data: current, error: currentError } = await supabase.from('agendamentos').select('*').eq('id', id).single();
        if (currentError) throw currentError;

        if (current.data !== data || current.hora !== hora || current.cliente_id !== cliente_id) {
            const { data: existing, error: checkError } = await supabase
                .from('agendamentos')
                .select('*')
                .eq('cliente_id', cliente_id)
                .eq('data', data)
                .eq('hora', hora);

            if (checkError) throw checkError;
            if (existing.length > 0 && existing[0].id != id) {
                return res.status(400).json({ error: 'Este cliente já possui um agendamento nesta data e horário.' });
            }
        }

        const { data: updated, error } = await supabase
            .from('agendamentos')
            .update({ cliente_id, servico, data, hora, observacoes, status })
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json(updated[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/agendamentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('agendamentos').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Agendamento excluído com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ROTA DE DASHBOARD ---
app.get('/api/dashboard', async (req, res) => {
    try {
        const hoje = new Date().toISOString().split('T')[0];

        // Total de agendamentos hoje
        const { count: agendamentosHoje, error: err1 } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('data', hoje);

        // Total de clientes
        const { count: totalClientes, error: err2 } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true });

        // Próximos 2 agendamentos a partir de agora
        const horaAtual = new Date().toTimeString().split(' ')[0].substring(0, 5);
        const { data: proximos, error: err3 } = await supabase
            .from('agendamentos')
            .select('*, clientes(nome)')
            .eq('data', hoje)
            .gte('hora', horaAtual)
            .order('hora', { ascending: true })
            .limit(2);

        // Agendamentos do dia (lista simples)
        const { data: agendamentosDoDia, error: err4 } = await supabase
            .from('agendamentos')
            .select('*, clientes(nome)')
            .eq('data', hoje)
            .order('hora', { ascending: true });

        if (err1 || err2 || err3 || err4) throw err1 || err2 || err3 || err4;

        res.json({
            agendamentosHoje: agendamentosHoje || 0,
            totalClientes: totalClientes || 0,
            proximos: proximos || [],
            agendamentosDoDia: agendamentosDoDia || []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ROTA DE ESTATÍSTICAS ---
app.get('/api/estatisticas', async (req, res) => {
    try {
        const hoje = new Date();
        const seteDiasAtras = new Date(hoje);
        seteDiasAtras.setDate(hoje.getDate() - 6);
        const dataInicial = seteDiasAtras.toISOString().split('T')[0];
        const dataFinal = hoje.toISOString().split('T')[0];

        const { data: agendamentos, error } = await supabase
            .from('agendamentos')
            .select('*')
            .gte('data', dataInicial)
            .lte('data', dataFinal);

        if (error) throw error;

        // Processar para gráficos (7 dias)
        const agendamentosPorDia = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(seteDiasAtras);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            agendamentosPorDia[dateStr] = 0;
        }

        const agendamentosPorStatus = { confirmado: 0, cancelado: 0, pendente: 0 };
        const servicosRanking = {};

        agendamentos.forEach(a => {
            // Por dia
            if (agendamentosPorDia[a.data] !== undefined) {
                agendamentosPorDia[a.data]++;
            }

            // Por status
            if (a.status) {
                agendamentosPorStatus[a.status] = (agendamentosPorStatus[a.status] || 0) + 1;
            }

            // Por serviço
            servicosRanking[a.servico] = (servicosRanking[a.servico] || 0) + 1;
        });

        res.json({
            agendamentosPorDia,
            agendamentosPorStatus,
            servicosRanking
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Serve frontend para qualquer outra rota (SPA fallback)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});